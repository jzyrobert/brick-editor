import RAPIER from "@dimforge/rapier3d-compat";
import { Matrix4, Quaternion } from "three";
import { ensure, type Project, type Transform, type Vec3 } from "../core/types";
import { add, inverse, mv } from "../core/math";
import { KinematicSession } from "../mechanisms/kinematic";
import type { KinematicPose, MechanismSnapshot } from "../mechanisms/types";
import {
  CHARACTER_PROFILE as P,
  JOINT_TARGET_SPEED_LIMITS,
  type CollisionSnapshot,
  type PlayJointTargetReport,
} from "./types";
const S = P.scaleMetresPerLdu;
const physics = ([x, y, z]: Vec3) => ({ x: x * S, y: -y * S, z: -z * S });
const rotation = (frame: Transform) => {
  const b = frame.basis;
  return new Quaternion().setFromRotationMatrix(
    new Matrix4().set(
      b[0],
      -b[1],
      -b[2],
      0,
      -b[3],
      b[4],
      b[5],
      0,
      -b[6],
      b[7],
      b[8],
      0,
      0,
      0,
      0,
      1,
    ),
  );
};
export type PlayMechanismSource = {
  project: Project;
  rigId: string;
  groups: Record<string, CollisionSnapshot>;
};
export function validatePlayMechanismSource(
  source: PlayMechanismSource,
  revision: number,
) {
  ensure(
    source?.project &&
      typeof source.rigId === "string" &&
      Object.hasOwn(source.project.motionRigs ?? {}, source.rigId),
    "INVALID_INPUT",
    "Unknown authored Play rig",
  );
  ensure(
    source.project.revision === revision,
    "REVISION_CONFLICT",
    "Moving collision source revision differs from Play",
  );
  new KinematicSession(source.project, source.rigId);
  const rig = source.project.motionRigs![source.rigId];
  ensure(
    rig.groups.length <= 128,
    "LIMIT_EXCEEDED",
    "Play supports at most 128 moving rigid groups",
  );
  let triangles = 0;
  for (const group of rig.groups) {
    const mesh = source.groups[group.id];
    ensure(
      mesh &&
        mesh.revision === revision &&
        !mesh.unsupported &&
        mesh.vertices.length % 3 === 0 &&
        mesh.indices.length % 3 === 0 &&
        mesh.vertices.every(Number.isFinite) &&
        mesh.indices.every((i) => i < mesh.vertices.length / 3),
      "INVALID_INPUT",
      "Moving groups require valid complete geometry from the source revision",
    );
    triangles += mesh.indices.length / 3;
    ensure(
      triangles <= 200000,
      "LIMIT_EXCEEDED",
      "Moving collider budget is 200,000 triangles",
    );
  }
}
/** Validate all moving geometry before allocating any Rapier resources. */
export function validatePlayMechanismSources(
  sources: PlayMechanismSource[],
  revision: number,
) {
  ensure(
    sources.length <= 32,
    "LIMIT_EXCEEDED",
    "Play supports at most 32 authored rigs",
  );
  const rigs = new Set<string>(),
    members = new Set<string>();
  let groups = 0,
    triangles = 0;
  for (const source of sources) {
    ensure(
      source && typeof source === "object" && !rigs.has(source.rigId),
      "INVALID_INPUT",
      "Play rig IDs must be distinct",
    );
    rigs.add(source.rigId);
    validatePlayMechanismSource(source, revision);
    for (const group of source.project.motionRigs[source.rigId].groups) {
      groups++;
      triangles += source.groups[group.id].indices.length / 3;
      ensure(
        groups <= 128 && triangles <= 200000,
        "LIMIT_EXCEEDED",
        "Combined Play rigs exceed 128 groups or 200,000 moving triangles",
      );
      for (const id of group.occurrenceIds) {
        ensure(
          !members.has(id),
          "INVALID_INPUT",
          "Play rigs cannot share occurrence members",
        );
        members.add(id);
      }
    }
  }
}
/** Kinematic surfaces collide with the actor; this is not vehicle/world dynamics. */
export class PlayMechanism {
  private session: KinematicSession;
  private jointKinds = new Map<string, string>();
  private targets = new Map<string, Omit<PlayJointTargetReport, "current">>();
  private proxies: Array<{
    id: string;
    collider: RAPIER.Collider;
    radius: number;
  }> = [];
  private vehicleChassis?: string;
  private vehicleRoots = new Map<string, string>();
  private steeringWheels = new Set<string>();
  private blocked = false;
  private reason: string | undefined;
  constructor(
    private world: RAPIER.World,
    source: PlayMechanismSource,
    private actor: () => { position: Vec3; walk: boolean },
  ) {
    this.session = new KinematicSession(source.project, source.rigId);
    const rig = source.project.motionRigs![source.rigId];
    this.jointKinds = new Map(rig.joints.map((j) => [j.id, j.kind]));
    if (rig.vehicle) {
      this.vehicleChassis = rig.vehicle.chassisGroup;
      const roots = new Set([
        rig.vehicle.chassisGroup,
        ...rig.vehicle.wheels.map((w) => w.groupId),
      ]);
      const parents = new Map(rig.joints.map((j) => [j.bodyB, j.bodyA]));
      this.steeringWheels = new Set(
        rig.vehicle.wheels.filter((w) => w.steering).map((w) => w.groupId),
      );
      for (const group of rig.groups) {
        let root = group.id;
        while (parents.has(root)) root = parents.get(root)!;
        if (roots.has(root)) this.vehicleRoots.set(group.id, root);
      }
    }

    ensure(
      rig.groups.length <= 128,
      "LIMIT_EXCEEDED",
      "Play supports at most 128 moving rigid groups",
    );
    let triangles = 0;
    for (const group of rig.groups) {
      const mesh = source.groups[group.id];
      ensure(
        mesh && mesh.revision === source.project.revision && !mesh.unsupported,
        "INVALID_INPUT",
        "Moving groups require complete geometry from the source revision",
      );
      triangles += mesh.indices.length / 3;
      ensure(
        triangles <= 200000,
        "LIMIT_EXCEEDED",
        "Moving collider budget is 200,000 triangles",
      );
      const inv = inverse(group.frame),
        vertices = new Float32Array(mesh.vertices.length);
      let radius = 0;
      for (let i = 0; i < vertices.length; i += 3) {
        const local = add(
          inv.position,
          mv(inv.basis, [
            mesh.vertices[i],
            mesh.vertices[i + 1],
            mesh.vertices[i + 2],
          ]),
        );
        radius = Math.max(radius, Math.hypot(...local));
        const p = physics(local);
        vertices.set([p.x, p.y, p.z], i);
      }
      if (!mesh.indices.length) continue;
      const collider = world.createCollider(
        RAPIER.ColliderDesc.trimesh(vertices, mesh.indices),
      );
      this.proxies.push({ id: group.id, collider, radius });
    }
    this.apply(this.session.snapshot());
  }
  private apply(report: MechanismSnapshot) {
    for (const proxy of this.proxies) {
      const frame = report.groupFrames[proxy.id];
      proxy.collider.setTranslation(physics(frame.position));
      proxy.collider.setRotation(rotation(frame));
    }
  }
  private move(before: MechanismSnapshot, after: MechanismSnapshot) {
    const actor = this.actor();
    if (actor.walk)
      for (const proxy of this.proxies) {
        const a = before.groupFrames[proxy.id],
          b = after.groupFrames[proxy.id];
        let distance =
          Math.hypot(...a.position.map((v, k) => v - b.position[k])) +
          proxy.radius * rotation(a).angleTo(rotation(b));

        const va = before.pose.vehicle,
          vb = after.pose.vehicle,
          root = this.vehicleRoots.get(proxy.id);
        if (va && vb && root && this.vehicleChassis) {
          const heading =
            (Math.abs(vb.headingDegrees - va.headingDegrees) * Math.PI) / 180;
          const steering = this.steeringWheels.has(root)
            ? (Math.abs(vb.steeringDegrees - va.steeringDegrees) * Math.PI) /
              180
            : 0;
          const spin =
            (Math.abs(
              (vb.wheelAngles[root] ?? 0) - (va.wheelAngles[root] ?? 0),
            ) *
              Math.PI) /
            180;
          const chassis = before.groupFrames[this.vehicleChassis].position,
            wheel = before.groupFrames[root].position;
          // Keep angular contributions separate: endpoint rotations can cancel.
          distance =
            Math.hypot(...va.position.map((v, k) => v - vb.position[k])) +
            (Math.hypot(...a.position.map((v, k) => v - chassis[k])) +
              proxy.radius) *
              heading +
            (Math.hypot(...a.position.map((v, k) => v - wheel[k])) +
              proxy.radius) *
              (steering + spin);
        }
        if (distance < 1e-8) continue;
        // Every point on the swept proxy remains within this distance of its old
        // surface. Inflating the capsule therefore conservatively rejects crossing,
        // including rotating thin doors and endpoints clear on both sides.
        const inflated = new RAPIER.Capsule(
          (P.height / 2 - P.radius) * S,
          (P.radius + distance + 0.05) * S,
        );
        if (
          proxy.collider.intersectsShape(
            inflated,
            physics([
              actor.position[0],
              actor.position[1] - P.height / 2,
              actor.position[2],
            ]),
            { x: 0, y: 0, z: 0, w: 1 },
          )
        )
          return false;
      }
    this.apply(after);
    return true;
  }
  private interpolate(
    a: KinematicPose,
    b: KinematicPose,
    t: number,
  ): KinematicPose {
    const lerp = (x: number, y: number) => x + (y - x) * t;
    const pose: KinematicPose = {
      jointPositions: Object.fromEntries(
        Object.keys(a.jointPositions).map((id) => [
          id,
          lerp(a.jointPositions[id], b.jointPositions[id]),
        ]),
      ),
    };
    if (a.vehicle && b.vehicle)
      pose.vehicle = {
        position: a.vehicle.position.map((v, k) =>
          lerp(v, b.vehicle!.position[k]),
        ) as Vec3,
        headingDegrees: lerp(
          a.vehicle.headingDegrees,
          b.vehicle.headingDegrees,
        ),
        steeringDegrees: lerp(
          a.vehicle.steeringDegrees,
          b.vehicle.steeringDegrees,
        ),
        wheelAngles: Object.fromEntries(
          Object.keys(a.vehicle.wheelAngles).map((id) => [
            id,
            lerp(a.vehicle!.wheelAngles[id], b.vehicle!.wheelAngles[id]),
          ]),
        ),
      };
    return pose;
  }
  private accept(before: MechanismSnapshot, target: MechanismSnapshot) {
    let travel = Math.max(
      0,
      ...Object.keys(before.pose.jointPositions).map((id) =>
        Math.abs(
          target.pose.jointPositions[id] - before.pose.jointPositions[id],
        ),
      ),
    );
    if (before.pose.vehicle && target.pose.vehicle)
      travel = Math.max(
        travel,
        Math.hypot(
          ...before.pose.vehicle.position.map(
            (v, k) => v - target.pose.vehicle!.position[k],
          ),
        ),
        Math.abs(
          before.pose.vehicle.steeringDegrees -
            target.pose.vehicle.steeringDegrees,
        ),
        Math.abs(
          before.pose.vehicle.headingDegrees -
            target.pose.vehicle.headingDegrees,
        ),
        ...Object.keys(before.pose.vehicle.wheelAngles).map((id) =>
          Math.abs(
            before.pose.vehicle!.wheelAngles[id] -
              target.pose.vehicle!.wheelAngles[id],
          ),
        ),
      );
    const steps = Math.max(1, Math.ceil(travel / 2));
    if (steps > 1024) {
      this.session.setPose(before.pose);
      this.apply(before);
      this.session.clearInput();
      this.blocked = true;
      this.reason =
        "Motion exceeds 1,024 swept segments. Use a smaller joint target or lower the authored vehicle speed.";
      return false;
    }
    let last = before;
    this.blocked = false;
    this.reason = undefined;
    for (let n = 1; n <= steps; n++) {
      const next = this.session.setPose(
        n === steps
          ? target.pose
          : this.interpolate(before.pose, target.pose, n / steps),
      );
      if (!this.move(last, next)) {
        this.session.setPose(before.pose);
        this.apply(before);
        this.blocked = true;
        this.reason =
          "Motion stopped before it could intersect the player. Move clear and retry.";
        return false;
      }
      last = next;
    }
    return true;
  }
  setJointPosition(id: string, value: number) {
    const before = this.session.snapshot(),
      target = this.session.setJointPosition(id, value);
    this.targets.delete(id);
    this.accept(before, target);
    return this.snapshot();
  }
  setJointTarget(id: string, target: number, speed: number) {
    const kind = this.jointKinds.get(id);
    ensure(
      kind === "revolute" || kind === "prismatic",
      "INVALID_INPUT",
      "Only revolute and prismatic joints accept scalar travel targets",
    );
    const limits = JOINT_TARGET_SPEED_LIMITS[kind];
    ensure(
      Number.isFinite(speed) && speed >= limits.min && speed <= limits.max,
      "INVALID_INPUT",
      `Joint speed must be ${limits.min}–${limits.max} ${kind === "revolute" ? "degrees/s" : "LDU/s"}`,
    );
    const before = this.session.snapshot();
    // Reuse authoritative scalar/limit validation, then restore without touching proxies.
    try {
      this.session.setJointPosition(id, target);
    } finally {
      this.session.setPose(before.pose);
    }
    this.targets.set(id, {
      target,
      speed,
      status: before.pose.jointPositions[id] === target ? "complete" : "moving",
      units: kind === "revolute" ? "degrees" : "LDU",
      speedUnits: kind === "revolute" ? "degrees/s" : "LDU/s",
    });
    this.blocked = false;
    this.reason = undefined;
    return this.snapshot();
  }
  setVehicleInput(input: { throttle: number; steering: number }) {
    const before = this.session.snapshot();
    this.session.setVehicleInput(input);
    this.accept(before, this.session.snapshot());
    return this.snapshot();
  }
  step() {
    const before = this.session.snapshot(),
      after = this.session.stepTicks(1);
    this.accept(before, after);
    for (const id of [...this.targets.keys()].sort()) {
      const motion = this.targets.get(id)!;
      if (motion.status !== "moving") continue;
      const rest = this.session.snapshot(),
        current = rest.pose.jointPositions[id],
        distance = motion.target - current;
      const next =
        Math.abs(distance) <= motion.speed / 60
          ? motion.target
          : current + (Math.sign(distance) * motion.speed) / 60;
      const accepted = this.accept(
        rest,
        this.session.setJointPosition(id, next),
      );
      if (!accepted) {
        motion.status = "blocked";
        motion.blockedReason = this.reason;
      } else if (next === motion.target) motion.status = "complete";
    }
  }
  clearInput() {
    this.session.clearInput();
  }
  snapshot() {
    const state = this.session.snapshot();
    const jointTargets = Object.fromEntries(
      [...this.targets].map(([id, target]) => [
        id,
        { ...target, current: state.pose.jointPositions[id] },
      ]),
    );
    const stopped = Object.values(jointTargets).find(
      (t) => t.status === "blocked",
    );
    const reason = stopped?.blockedReason ?? this.reason;
    return {
      ...state,
      jointTargets,
      blocked: this.blocked || !!stopped,
      ...(reason ? { blockedReason: reason } : {}),
      warnings: [
        ...state.warnings,
        "Moving surfaces stop conservatively before touching the player. Riding, pushing and vehicle/world collision response are not simulated.",
      ],
    };
  }
  dispose() {
    for (const proxy of this.proxies)
      this.world.removeCollider(proxy.collider, true);
    this.proxies = [];
    this.targets.clear();
  }
}
