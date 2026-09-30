import type { DrivingTriangleSource } from "./vehicle-obstacles";
import type { PlayVehicleCollisionReport } from "./types";
import type { VehicleCheck } from "./vehicle-world";
import RAPIER from "@dimforge/rapier3d-compat";
import { Matrix4, Quaternion, Vector3 } from "three";
import {
  ensure,
  type Occurrence,
  type Project,
  type Transform,
  type Vec3,
} from "../core/types";
import { add, inverse, mv } from "../core/math";
import { KinematicSession } from "../mechanisms/kinematic";
import type {
  JointSpec,
  KinematicPose,
  MechanismSnapshot,
} from "../mechanisms/types";
import {
  CHARACTER_PROFILE as P,
  JOINT_TARGET_SPEED_LIMITS,
  type CollisionSnapshot,
  type PlayJointTargetReport,
  type PlayMotorReport,
} from "./types";
/** Kinematic travel rate of authored position motors (maxEffort is not simulated). */
export const KINEMATIC_MOTOR_RATE = Object.freeze({
  revolute: 90,
  prismatic: 40,
});
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
  /** Optional shared occurrence index of `project` (avoids re-expansion per rig). */
  lookup?: ReadonlyMap<string, Occurrence>;
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
  new KinematicSession(source.project, source.rigId, source.lookup);
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
  private motors = new Map<
    string,
    {
      joint: JointSpec;
      enabled: boolean;
      status: PlayMotorReport["status"];
      blockedReason?: string;
    }
  >();
  private targets = new Map<string, Omit<PlayJointTargetReport, "current">>();
  private proxies: Array<{
    id: string;
    collider: RAPIER.Collider;
    radius: number;
    vertices: Float32Array;
    indices: Uint32Array;
  }> = [];
  private vehicleChassis?: string;
  private riderBlockedReason?: string;
  /** A stop reason, `{hold:true}` to refuse only this tick's motion (a work
   * budget, not a contact), or undefined when the rider is clear. */
  private riderGuard?: (
    before: MechanismSnapshot,
    after: MechanismSnapshot,
  ) => string | { hold: true } | undefined;
  setRiderGuard(guard: NonNullable<PlayMechanism["riderGuard"]>) {
    this.riderGuard = guard;
  }

  private geometryKey = "";
  private geometryCache: DrivingTriangleSource[] = [];
  private vehicleReport?: PlayVehicleCollisionReport;
  private vehicleCheck?: (
    before: MechanismSnapshot,
    after: MechanismSnapshot,
  ) => VehicleCheck;
  setVehicleWorld(
    check: NonNullable<PlayMechanism["vehicleCheck"]>,
    report?: PlayVehicleCollisionReport,
  ) {
    this.vehicleCheck = check;
    this.vehicleReport = report;
  }
  collisionSources(): readonly DrivingTriangleSource[] {
    const state = this.session.snapshot(),
      frames = state.groupFrames;
    const key = JSON.stringify(frames);
    if (key === this.geometryKey) return this.geometryCache;
    this.geometryKey = key;
    this.geometryCache = this.proxies.map((proxy) => {
      const frame = frames[proxy.id],
        q = rotation(frame),
        t = physics(frame.position);
      const vertices = new Float32Array(proxy.vertices.length);
      for (let i = 0; i < vertices.length; i += 3) {
        const point = new Vector3(
          proxy.vertices[i],
          proxy.vertices[i + 1],
          proxy.vertices[i + 2],
        ).applyQuaternion(q);
        vertices.set([point.x + t.x, point.y + t.y, point.z + t.z], i);
      }
      return {
        sourceId: JSON.stringify([state.rigId, proxy.id]),
        units: "metres",
        up: "+Y",
        owner: { kind: "rig", rigId: state.rigId },
        vertices,
        indices: proxy.indices,
      };
    });
    return this.geometryCache;
  }
  /** Group-local physics surfaces (metres), for mirroring into dynamic Play. */
  movingShapes() {
    return this.proxies.map(({ id, vertices, indices }) => ({
      id,
      vertices,
      indices,
    }));
  }
  groupFrames() {
    return this.session.snapshot().groupFrames;
  }
  /** Walking-world collider of one moving group, if it has surfaces. */
  proxyCollider(groupId: string) {
    return this.proxies.find((proxy) => proxy.id === groupId)?.collider;
  }
  /** Narrow a joint's limits for this session only (derived door swing). */
  restrictJointLimits(id: string, limits: [number, number]) {
    this.session.restrictLimits(id, limits);
  }
  private vehicleRoots = new Map<string, string>();
  private steeringWheels = new Set<string>();
  private blocked = false;
  private reason: string | undefined;
  constructor(
    private world: RAPIER.World,
    source: PlayMechanismSource,
    private actor: () => {
      position: Vec3;
      walk: boolean;
      seat?: {
        rigId: string;
        envelopes: Array<{ frame: Transform; halfExtents: Vec3 }>;
      };
    },
  ) {
    this.session = new KinematicSession(
      source.project,
      source.rigId,
      source.lookup,
    );
    const rig = source.project.motionRigs![source.rigId];
    this.jointKinds = new Map(rig.joints.map((j) => [j.id, j.kind]));
    for (const joint of rig.joints)
      if (
        joint.motor &&
        (joint.kind === "revolute" || joint.kind === "prismatic")
      )
        this.motors.set(joint.id, {
          joint: structuredClone(joint),
          enabled: true,
          status: "running",
        });
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
      this.proxies.push({
        id: group.id,
        collider,
        radius,
        vertices,
        indices: mesh.indices.slice(),
      });
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
        if (actor.seat?.rigId === before.rigId) continue;
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
        if (actor.seat) {
          for (const box of actor.seat.envelopes) {
            const inflated = new RAPIER.Cuboid(
              ...(box.halfExtents.map(
                (n) => (n + distance + 0.05) * S,
              ) as Vec3),
            );
            if (
              proxy.collider.intersectsShape(
                inflated,
                physics(box.frame.position),
                rotation(box.frame),
              )
            )
              return false;
          }
          continue;
        }
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
  private accept(
    before: MechanismSnapshot,
    target: MechanismSnapshot,
    forceVehicle = false,
  ) {
    if (target.pose.vehicle && this.vehicleCheck) {
      const changed =
        JSON.stringify(before.pose.vehicle) !==
        JSON.stringify(target.pose.vehicle);
      if (changed || forceVehicle) {
        const checked = this.vehicleCheck(before, target);
        if (checked.hold) {
          // Only this tick is refused: keep the pose and the driver's input.
          this.session.setPose(before.pose);
          this.apply(before);
          return false;
        }
        this.vehicleReport = checked.report;
        if (this.vehicleReport && this.vehicleReport.status !== "ready") {
          this.session.setPose(before.pose);
          this.apply(before);
          this.session.clearInput();
          this.blocked = true;
          this.reason = this.vehicleReport.reason;
          return false;
        }
      } else if (
        (this.vehicleReport?.status === "blocked" ||
          this.vehicleReport?.status === "unsupported") &&
        JSON.stringify(before.pose.jointPositions) ===
          JSON.stringify(target.pose.jointPositions)
      ) {
        this.session.setPose(before.pose);
        this.apply(before);
        this.session.clearInput();
        return false;
      }
    }
    if (
      this.riderBlockedReason &&
      !forceVehicle &&
      JSON.stringify(before.pose) === JSON.stringify(target.pose)
    ) {
      this.session.setPose(before.pose);
      this.session.clearInput();
      return false;
    }
    const riderFailure = this.riderGuard?.(before, target);
    if (typeof riderFailure === "object") {
      this.session.setPose(before.pose);
      this.apply(before);
      return false;
    }
    if (riderFailure) {
      this.session.setPose(before.pose);
      this.apply(before);
      this.session.clearInput();
      this.blocked = true;
      this.reason = riderFailure;
      this.riderBlockedReason = riderFailure;
      return false;
    }
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
    this.pauseMotor(id);
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
    this.pauseMotor(id);
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
  private pauseMotor(id: string) {
    const motor = this.motors.get(id);
    if (motor) {
      motor.enabled = false;
      motor.status = "stopped";
      motor.blockedReason = undefined;
    }
  }
  /** Enable or stop one authored motor. Manual joint commands stop it too. */
  setMotor(id: string, enabled: boolean) {
    const motor = this.motors.get(id);
    ensure(
      motor,
      "INVALID_INPUT",
      "This joint has no authored revolute or prismatic motor",
    );
    ensure(
      typeof enabled === "boolean",
      "INVALID_INPUT",
      "Motor enabled must be boolean",
    );
    motor.enabled = enabled;
    motor.status = enabled ? "running" : "stopped";
    motor.blockedReason = undefined;
    if (enabled) this.targets.delete(id);
    return this.snapshot();
  }
  private stepMotors() {
    for (const id of [...this.motors.keys()].sort()) {
      const motor = this.motors.get(id)!;
      if (!motor.enabled) continue;
      const joint = motor.joint,
        spec = joint.motor!,
        kind = joint.kind as "revolute" | "prismatic",
        state = this.session.snapshot(),
        current = state.pose.jointPositions[id],
        [low, high] = joint.limits ?? [-Infinity, Infinity];
      let next: number;
      if (spec.mode === "position") {
        const goal = Math.min(high, Math.max(low, spec.target)),
          rate = KINEMATIC_MOTOR_RATE[kind] / 60,
          distance = goal - current;
        if (distance === 0) {
          motor.status = "holding";
          motor.blockedReason = undefined;
          continue;
        }
        next =
          Math.abs(distance) <= rate
            ? goal
            : current + Math.sign(distance) * rate;
      } else {
        next = Math.min(high, Math.max(low, current + spec.target / 60));
        if (next === current) {
          motor.status = spec.target === 0 ? "holding" : "at-limit";
          motor.blockedReason = undefined;
          continue;
        }
      }
      if (!this.accept(state, this.session.setJointPosition(id, next))) {
        motor.status = "blocked";
        motor.blockedReason = this.reason;
        continue;
      }
      motor.blockedReason = undefined;
      motor.status =
        spec.mode === "position" &&
        next === Math.min(high, Math.max(low, spec.target))
          ? "holding"
          : "running";
      // An unlimited axle keeps turning; fold whole turns so the scalar stays
      // bounded. The rotation is identical, so no sweep is needed.
      if (kind === "revolute" && !joint.limits && Math.abs(next) >= 3600) {
        const folded = next - 360 * Math.trunc(next / 360);
        this.apply(this.session.setJointPosition(id, folded));
      }
    }
  }
  setVehicleInput(input: { throttle: number; steering: number }) {
    const before = this.session.snapshot();
    this.session.setVehicleInput(input);
    const after = this.session.snapshot();
    // Releasing a control clears throttle but is not an attempt to resume a
    // blocked vehicle. Preserve its explanation until motion/steering is requested.
    if (
      input.throttle !== 0 ||
      before.pose.vehicle?.steeringDegrees !==
        after.pose.vehicle?.steeringDegrees
    ) {
      this.riderBlockedReason = undefined;
      this.accept(before, after, true);
    }
    return this.snapshot();
  }
  step() {
    // Idle fast path: with no throttle, travel or running motor nothing can
    // move, so skip the pose/sweep work (and the collider updates it causes).
    if (
      this.session.stationary &&
      ![...this.targets.values()].some((t) => t.status === "moving") &&
      ![...this.motors.values()].some((m) => m.enabled)
    ) {
      this.session.idleTick();
      return;
    }
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
    if (this.motors.size) this.stepMotors();
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
    const vehicleStopped =
      this.vehicleReport && this.vehicleReport.status !== "ready";
    const reason =
      stopped?.blockedReason ??
      this.riderBlockedReason ??
      (vehicleStopped ? this.vehicleReport?.reason : undefined) ??
      this.reason;
    const motors = Object.fromEntries(
      [...this.motors].map(([id, motor]): [string, PlayMotorReport] => {
        const revolute = motor.joint.kind === "revolute",
          spec = motor.joint.motor!;
        return [
          id,
          {
            mode: spec.mode,
            target: spec.target,
            enabled: motor.enabled,
            status: motor.status,
            units: revolute ? "degrees" : "LDU",
            targetUnits:
              spec.mode === "position"
                ? revolute
                  ? "degrees"
                  : "LDU"
                : revolute
                  ? "degrees/s"
                  : "LDU/s",
            simulation: "kinematic-rate",
            ...(motor.blockedReason
              ? { blockedReason: motor.blockedReason }
              : {}),
          },
        ];
      }),
    );
    return {
      ...state,
      jointTargets,
      ...(this.motors.size ? { motors } : {}),
      ...(this.vehicleReport
        ? { vehicleCollision: structuredClone(this.vehicleReport) }
        : {}),
      blocked:
        this.blocked ||
        !!stopped ||
        !!vehicleStopped ||
        !!this.riderBlockedReason,
      ...(reason ? { blockedReason: reason } : {}),
      warnings: [
        ...state.warnings.map((warning) =>
          warning.startsWith("Motor targets and effort")
            ? "Authored motors run at kinematic rates in Play (position motors 90 degrees/s or 40 LDU/s; velocity motors at their target). Effort limits apply only to dynamic physics."
            : this.vehicleReport
              ? warning.replace(
                  "no suspension, traction or collision response.",
                  "no suspension, traction or dynamic collision response.",
                )
              : warning,
        ),
        "Moving surfaces stop conservatively before touching the player. Riding and pushing are not simulated.",
        ...(this.vehicleReport
          ? [
              this.vehicleReport.supported
                ? "Vehicle/world protection uses conservative compiled-source box envelopes; this is not dynamic vehicle physics."
                : "Vehicle motion is unavailable: " + this.vehicleReport.reason,
            ]
          : []),
      ],
    };
  }
  dispose() {
    for (const proxy of this.proxies)
      this.world.removeCollider(proxy.collider, true);
    this.proxies = [];
    this.geometryCache = [];
    this.vehicleCheck = undefined;
    this.riderGuard = undefined;
    this.targets.clear();
  }
}
