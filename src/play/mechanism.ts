import { PLAY_MEMBER_GEOMETRY_LIMITS } from "./member-geometry";
import { occurrences } from "../core/document";
import type { DrivingTriangleSource } from "./vehicle-obstacles";
import type { PlayVehicleCollisionReport } from "./types";
import type { VehicleCheck } from "./vehicle-world";
import RAPIER from "@dimforge/rapier3d-compat";
import { MechanicalQueryWorld } from "./mechanical-query-world";
import {
  invariantYRotationBounds,
  invariantYRotationEligible,
  invariantYLeafRotationEligible,
  invariantYRotationIntervalBounds,
} from "./invariant-rotational-support";
import { Matrix4, Quaternion, Vector3 } from "three";
import {
  ensure,
  AppError,
  type Occurrence,
  type Project,
  type Transform,
  type Vec3,
} from "../core/types";
import { add, inverse, mv } from "../core/math";
import { KinematicSession } from "../mechanisms/kinematic";
import { unsupportedMechanicalPlayContact } from "../mechanisms/mechanical-play-support";
import { reviewedMechanicalMember } from "./reviewed-mechanical-proxies";
import {
  MechanicalContactPolicy,
  mechanicalSolids,
  mechanicalStationarySolids,
  MECHANICAL_CONTACT_LIMITS,
  type MechanicalSolid,
  type PreparedMechanicalSource,
} from "./mechanical-solids";
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
import {
  effectiveMotor,
  validateMotorInput,
  KINEMATIC_MOTOR_RATE,
} from "./motor-input";
export { KINEMATIC_MOTOR_RATE } from "./motor-input";
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
  /** Optional per-occurrence surfaces for local mechanical collision solids. */
  members?: Record<string, CollisionSnapshot>;
  /** Source-bound canonical surfaces, separate from world-space member meshes. */
  memberLocals?: Record<string, import("./types").PlayMemberLocalGeometry>;
  /** Optional shared occurrence index of `project` (avoids re-expansion per rig). */
  lookup?: ReadonlyMap<string, Occurrence>;
};
export type PlaySourceValidationOptions = {
  /** Internal async entry checks structure first, then repeats required contact
   * validation after binding reviewed data and before native allocation. */
  deferReviewedContacts?: boolean;
};
export function validatePlayMechanismSource(
  source: PlayMechanismSource,
  revision: number,
  options: PlaySourceValidationOptions = {},
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
  let triangles = 0,
    memberTriangles = 0;
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
    if (source.members !== undefined) {
      for (const id of group.occurrenceIds) {
        const member = source.members[id];
        ensure(
          member &&
            member.revision === revision &&
            !member.unsupported &&
            member.vertices.length % 3 === 0 &&
            member.indices.length % 3 === 0 &&
            member.vertices.every(Number.isFinite) &&
            member.indices.every((i) => i < member.vertices.length / 3),
          "INVALID_INPUT",
          "Moving parts need complete geometry for every member from this project. Reload the parts and try again.",
        );
        memberTriangles += member.indices.length / 3;
        ensure(
          memberTriangles <= 200000,
          "LIMIT_EXCEEDED",
          "This mechanism is too complex to check safely. Try fewer moving parts.",
          {
            limit: "memberTriangles",
            maximum: 200000,
            actual: memberTriangles,
          },
        );
      }
    }
    triangles += mesh.indices.length / 3;
    ensure(
      triangles <= 200000,
      "LIMIT_EXCEEDED",
      "Moving collider budget is 200,000 triangles",
    );
  }
  if (source.memberLocals !== undefined) {
    ensure(
      source.memberLocals &&
        typeof source.memberLocals === "object" &&
        !Array.isArray(source.memberLocals),
      "INVALID_INPUT",
      "Canonical moving geometry must include every source member",
    );
    const lookup =
      source.lookup ??
      new Map(occurrences(source.project).map((o) => [o.id, o]));
    const ids = rig.groups.flatMap((g) => g.occurrenceIds),
      memberIds = new Set(ids);
    ensure(
      source.members &&
        Object.keys(source.memberLocals).length === ids.length &&
        Object.keys(source.memberLocals).every((id) => memberIds.has(id)),
      "INVALID_INPUT",
      "Canonical moving geometry must include every source member",
    );
    let localVertices = 0,
      localTriangles = 0;
    for (const id of ids) {
      const local = source.memberLocals[id],
        occurrence = lookup.get(id);
      ensure(
        local &&
          occurrence &&
          local.revision === revision &&
          local.occurrenceId === id &&
          local.namespace === occurrence.namespace &&
          occurrence.namespace !== "missing" &&
          Array.isArray(local.frame?.position) &&
          local.frame.position.length === 3 &&
          Array.isArray(local.frame?.basis) &&
          local.frame.basis.length === 9 &&
          local.frame.position.every(
            (n, k) => n === occurrence.transform.position[k],
          ) &&
          local.frame.basis.every(
            (n, k) => n === occurrence.transform.basis[k],
          ) &&
          !local.unsupported &&
          local.vertices instanceof Float64Array &&
          local.indices instanceof Uint32Array &&
          local.vertices.length > 0 &&
          local.vertices.length % 3 === 0 &&
          local.indices.length > 0 &&
          local.indices.length % 3 === 0 &&
          local.vertices.every(Number.isFinite) &&
          local.indices.every((n) => n < local.vertices.length / 3) &&
          local.vertices.length === source.members![id].vertices.length &&
          local.indices.length === source.members![id].indices.length &&
          Array.isArray(local.bounds?.min) &&
          local.bounds.min.length === 3 &&
          Array.isArray(local.bounds?.max) &&
          local.bounds.max.length === 3 &&
          local.bounds.min.every(Number.isFinite) &&
          local.bounds.max.every(Number.isFinite) &&
          local.vertices.every(
            (n, k) =>
              n >= local.bounds.min[k % 3] && n <= local.bounds.max[k % 3],
          ),
        "INVALID_INPUT",
        "Canonical moving geometry must match every authored source member and revision",
      );
      localVertices += local.vertices.length / 3;
      localTriangles += local.indices.length / 3;
      ensure(
        localVertices <= PLAY_MEMBER_GEOMETRY_LIMITS.vertices &&
          localTriangles <= PLAY_MEMBER_GEOMETRY_LIMITS.triangles,
        "LIMIT_EXCEEDED",
        "Canonical moving geometry exceeds the existing mechanical source budget",
      );
    }
  }
  if (!options.deferReviewedContacts) {
    const unsupported = unsupportedMechanicalPlayContact(
      source.project,
      rig,
      source.lookup,
    );
    ensure(
      !unsupported ||
        (reviewedMechanicalMember(source, unsupported.guideOccurrenceId) &&
          reviewedMechanicalMember(source, unsupported.rackOccurrenceId)),
      "INVALID_INPUT",
      unsupported?.reason ?? "Unsupported mechanical contact",
      unsupported,
    );
  }
}
/** Validate all moving geometry before allocating any Rapier resources. */
export function validatePlayMechanismSources(
  sources: PlayMechanismSource[],
  revision: number,
  options: PlaySourceValidationOptions = {},
) {
  ensure(
    sources.length <= 32,
    "LIMIT_EXCEEDED",
    "Play supports at most 32 authored rigs",
  );
  const rigs = new Set<string>(),
    members = new Set<string>();
  let groups = 0,
    triangles = 0,
    localVertices = 0,
    localTriangles = 0;
  for (const source of sources) {
    ensure(
      source && typeof source === "object" && !rigs.has(source.rigId),
      "INVALID_INPUT",
      "Play rig IDs must be distinct",
    );
    rigs.add(source.rigId);
    validatePlayMechanismSource(source, revision, options);
    for (const local of Object.values(source.memberLocals ?? {})) {
      localVertices += local.vertices.length / 3;
      localTriangles += local.indices.length / 3;
      ensure(
        localVertices <= PLAY_MEMBER_GEOMETRY_LIMITS.vertices &&
          localTriangles <= PLAY_MEMBER_GEOMETRY_LIMITS.triangles,
        "LIMIT_EXCEEDED",
        "Combined canonical moving geometry exceeds the existing mechanical source budget",
      );
    }

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
  private contactPolicy: MechanicalContactPolicy;
  private contactSolids: MechanicalSolid[];
  private stationarySolids: MechanicalSolid[];
  private contactChecks = 0;
  private contactEnumeration = 0;
  private invariantSupport = new Map<
    MechanicalSolid,
    { key: string; safe: boolean }
  >();
  private queries: MechanicalQueryWorld;
  private ownsQueries: boolean;
  private worldFailure?: string;
  private worldNeedsRefinement = false;
  private session: KinematicSession;
  private jointKinds = new Map<string, string>();
  private jointSpecs: JointSpec[];
  private restFrames: Record<string, Transform>;
  private hasClosedLoops: boolean;
  private motors = new Map<
    string,
    {
      joint: JointSpec;
      enabled: boolean;
      status: PlayMotorReport["status"];
      blockedReason?: string;
      input?: number;
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
  supportFrame(handle: number) {
    const proxy = this.proxies.find((p) => p.collider.handle === handle);
    return proxy
      ? {
          rigId: this.session.snapshot().rigId,
          groupId: proxy.id,
          frame: this.groupFrames()[proxy.id],
        }
      : undefined;
  }
  private supportGuard?: (
    before: MechanismSnapshot,
    after: MechanismSnapshot,
  ) => string | undefined;
  setSupportGuard(guard: NonNullable<PlayMechanism["supportGuard"]>) {
    this.supportGuard = guard;
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
      support?: { rigId: string; groupId: string };
      seat?: {
        rigId: string;
        envelopes: Array<{ frame: Transform; halfExtents: Vec3 }>;
      };
    },
    private completeWorld = true,
    prepared?: PreparedMechanicalSource,
    queries?: MechanicalQueryWorld,
  ) {
    validatePlayMechanismSource(source, source.project.revision);
    this.queries = queries ?? new MechanicalQueryWorld();
    this.ownsQueries = !queries;
    this.session = new KinematicSession(
      source.project,
      source.rigId,
      source.lookup,
    );
    const rig = source.project.motionRigs![source.rigId];
    this.contactPolicy =
      prepared?.policy ?? new MechanicalContactPolicy(rig, source);
    this.contactSolids =
      prepared?.solids ?? mechanicalSolids(source, this.contactPolicy);
    this.stationarySolids =
      prepared?.stationary ??
      mechanicalStationarySolids(source, this.contactSolids);
    this.jointSpecs = structuredClone(rig.joints);
    this.restFrames = Object.fromEntries(
      rig.groups.map((g) => [g.id, structuredClone(g.frame)]),
    );
    this.hasClosedLoops = !!rig.loopClosures?.length;
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
      const reviewed = [...this.contactSolids, ...this.stationarySolids].some(
        (s) => s.groupId === group.id && s.reviewedPlaneClass !== undefined,
      );
      const groupSolids = this.contactSolids.some((s) => s.groupId === group.id)
        ? this.contactSolids.filter((s) => s.groupId === group.id)
        : this.stationarySolids.filter((s) => s.groupId === group.id);
      // A fixed reviewed housing can share its group with ordinary bearings.
      // Their exact stationary triangle meshes cannot be children of a native
      // compound. Keep that fixed group's existing source-surface walking
      // proxy; moving reviewed groups use their flat convex volume children.
      const shape =
        reviewed && !groupSolids.some((s) => s.shape instanceof RAPIER.TriMesh)
          ? new RAPIER.Compound(
              groupSolids.flatMap((s) =>
                s.shape instanceof RAPIER.Compound ? s.shape.shapes : [s.shape],
              ),
              groupSolids.flatMap((s) =>
                s.shape instanceof RAPIER.Compound
                  ? s.shape.positions
                  : [{ x: 0, y: 0, z: 0 }],
              ),
              groupSolids.flatMap((s) =>
                s.shape instanceof RAPIER.Compound
                  ? s.shape.rotations
                  : [{ x: 0, y: 0, z: 0, w: 1 }],
              ),
            )
          : new RAPIER.TriMesh(vertices, mesh.indices);
      const collider = world.createCollider(new RAPIER.ColliderDesc(shape));
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
    this.worldFailure = undefined;
    this.worldNeedsRefinement = false;
    if (!this.checkWorld(before, after)) return false;
    const actor = this.actor();
    if (actor.walk)
      for (const proxy of this.proxies) {
        if (actor.seat?.rigId === before.rigId) continue;
        if (
          actor.support?.rigId === before.rigId &&
          actor.support.groupId === proxy.id
        )
          continue;
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
  /** The surface travel bound encloses every rotating point between samples.
   * Equal/separating existing contact permits a part to slide on a support;
   * new contact or deeper penetration refuses the complete connected move. */
  private checkWorld(before: MechanismSnapshot, after: MechanismSnapshot) {
    this.contactPolicy.updateGuideFrames(before.groupFrames, after.groupFrames);
    if (
      before.pose.vehicle &&
      JSON.stringify(before.pose.jointPositions) ===
        JSON.stringify(after.pose.jointPositions)
    )
      return true;
    const moving = this.contactSolids.filter(
      (s) =>
        JSON.stringify(before.groupFrames[s.groupId]) !==
        JSON.stringify(after.groupFrames[s.groupId]),
    );
    if (!moving.length) return true;
    if (!this.completeWorld) {
      this.worldFailure =
        "Joint motion needs complete included collision geometry";
      return false;
    }
    const movingGroups = new Set(moving.map((s) => s.groupId));
    const worldBounds = new Map<
      MechanicalSolid,
      { min: number[]; max: number[] }
    >();
    const sweptBounds = (solid: MechanicalSolid) => {
      let box = worldBounds.get(solid);
      if (box) return box;
      box = {
        min: [Infinity, Infinity, Infinity],
        max: [-Infinity, -Infinity, -Infinity],
      };
      for (const frames of [before.groupFrames, after.groupFrames]) {
        const f = frames[solid.groupId],
          q = rotation(f),
          t = physics(f.position);
        for (let n = 0; n < 8; n++) {
          const p = new Vector3(
            ...([0, 1, 2].map((k) =>
              n & (1 << k) ? solid.bounds.max[k] : solid.bounds.min[k],
            ) as Vec3),
          )
            .applyQuaternion(q)
            .add(new Vector3(t.x, t.y, t.z));
          p.toArray().forEach((v, k) => {
            box!.min[k] = Math.min(box!.min[k], v);
            box!.max[k] = Math.max(box!.max[k], v);
          });
        }
      }
      worldBounds.set(solid, box);
      return box;
    };
    const near = (
      a: MechanicalSolid,
      b: MechanicalSolid,
      prediction: number,
    ) => {
      const aa = sweptBounds(a),
        bb = sweptBounds(b);
      return (
        Math.hypot(
          ...[0, 1, 2].map((k) =>
            Math.max(0, aa.min[k] - bb.max[k], bb.min[k] - aa.max[k]),
          ),
        ) <= prediction
      );
    };
    const stationaryByGroup = new Map<string, MechanicalSolid[]>();
    for (const solid of this.stationarySolids) {
      const list = stationaryByGroup.get(solid.groupId) ?? [];
      list.push(solid);
      stationaryByGroup.set(solid.groupId, list);
    }
    for (const groupId of new Set(this.contactSolids.map((s) => s.groupId)))
      stationaryByGroup.set(
        groupId,
        this.contactSolids.filter((s) => s.groupId === groupId),
      );
    const own = new Map(this.proxies.map((p) => [p.collider.handle, p.id]));
    const colliders: RAPIER.Collider[] = [];
    this.world.forEachCollider((c) => {
      if (!c.isSensor()) colliders.push(c);
    });
    const enumerate = () =>
      ensure(
        ++this.contactEnumeration <= MECHANICAL_CONTACT_LIMITS.enumeration,
        "LIMIT_EXCEEDED",
        "This mechanism is too complex to check safely. Try fewer moving parts.",
        {
          limit: "enumeration",
          maximum: MECHANICAL_CONTACT_LIMITS.enumeration,
        },
      );
    const contact = (
      solid: MechanicalSolid,
      a: Transform,
      other: RAPIER.Shape,
      b: Transform,
      prediction: number,
    ) => {
      ensure(
        ++this.contactChecks <= MECHANICAL_CONTACT_LIMITS.pairChecks,
        "LIMIT_EXCEEDED",
        "This mechanism is too complex to check safely. Try fewer moving parts.",
        { limit: "pairChecks", maximum: MECHANICAL_CONTACT_LIMITS.pairChecks },
      );
      const ca = this.queries.collider(solid.shape),
        cb = this.queries.collider(other);
      ca.setTranslation(physics(a.position));
      ca.setRotation(rotation(a));
      cb.setTranslation(physics(b.position));
      cb.setRotation(rotation(b));
      return ca.contactCollider(cb, prediction)?.distance;
    };
    const blocked = (
      old: number | undefined,
      next: number | undefined,
      travel: number,
    ) => {
      const hit =
        next !== undefined &&
        next < travel + 0.001 * S &&
        (old === undefined ||
          (old > 0.001 * S ? next <= old + 0.001 * S : next < old - 0.001 * S));
      // A positive endpoint gap can be certified by a smaller travel bound.
      // Subdivision never permits a known penetration or spends unbounded work.
      if (hit && next! > 0.001 * S && (old === undefined || old > 0.001 * S))
        this.worldNeedsRefinement = true;
      return hit;
    };
    try {
      for (const solid of moving) {
        const a = before.groupFrames[solid.groupId],
          b = after.groupFrames[solid.groupId];
        const travel =
          (Math.hypot(...a.position.map((v, k) => v - b.position[k])) +
            solid.radius * rotation(a).angleTo(rotation(b))) *
          S;
        if (travel > MECHANICAL_CONTACT_LIMITS.sweepLdu * S + 1e-8) {
          this.worldNeedsRefinement = true;
          this.worldFailure = "Motion needs smaller collision-check segments";
          return false;
        }
        for (const collider of colliders) {
          enumerate();
          const ownGroup = own.get(collider.handle);
          if (
            ownGroup &&
            this.contactPolicy.allowed(solid, { groupId: ownGroup })
          )
            continue;
          if (ownGroup && movingGroups.has(ownGroup)) continue;
          if (ownGroup) {
            const frame = after.groupFrames[ownGroup];
            for (const other of stationaryByGroup.get(ownGroup) ?? []) {
              enumerate();
              if (
                this.contactPolicy.allowed(solid, other) ||
                !near(solid, other, travel + 0.001 * S)
              )
                continue;
              const old = contact(
                  solid,
                  a,
                  other.shape,
                  frame,
                  travel + 0.001 * S,
                ),
                next = contact(
                  solid,
                  b,
                  other.shape,
                  frame,
                  travel + 0.001 * S,
                );
              if (blocked(old, next, travel)) {
                this.worldFailure =
                  "Motion stopped before intersecting included world or another assembly. Move clear and retry.";
                return false;
              }
            }
          } else if (collider.shape instanceof RAPIER.HalfSpace) {
            // The pinned mechanical/HalfSpace contact query reports an inverted
            // signed distance above a plane. Certify its actual support gap
            // from every convex/compound boundary point instead. The existing
            // segment travel bound still encloses intermediate rotation.
            const shape = collider.shape;
            const normal = new Vector3(
              shape.normal.x,
              shape.normal.y,
              shape.normal.z,
            );
            const orientation = collider.rotation();
            normal.applyQuaternion(
              new Quaternion(
                orientation.x,
                orientation.y,
                orientation.z,
                orientation.w,
              ),
            );
            ensure(
              normal.lengthSq() > 1e-20,
              "INVALID_INPUT",
              "Ground collision needs a finite nonzero plane normal",
            );
            normal.normalize();
            const origin = collider.translation();
            const plane = new Vector3(origin.x, origin.y, origin.z);
            // A local box encloses every boundary point. Its support gap at
            // the old frame, minus the complete segment travel, certifies a
            // distant plane without scanning every convex vertex each tick.
            const oldNormal = normal
              .clone()
              .applyQuaternion(rotation(a).invert());
            const oldPosition = physics(a.position);
            const lower =
              normal.dot(
                new Vector3(oldPosition.x, oldPosition.y, oldPosition.z).sub(
                  plane,
                ),
              ) +
              [oldNormal.x, oldNormal.y, oldNormal.z].reduce(
                (sum, component, k) =>
                  sum +
                  component *
                    (component < 0 ? solid.bounds.max[k] : solid.bounds.min[k]),
                0,
              );
            ensure(
              ++this.contactChecks <= MECHANICAL_CONTACT_LIMITS.pairChecks,
              "LIMIT_EXCEEDED",
              "This mechanism is too complex to check safely. Try fewer moving parts.",
              {
                limit: "pairChecks",
                maximum: MECHANICAL_CONTACT_LIMITS.pairChecks,
              },
            );
            if (Number.isFinite(lower) && lower > travel + 0.001 * S) continue;
            const distance = (frame: Transform) => {
              const local = normal
                .clone()
                .applyQuaternion(rotation(frame).invert());
              const t = physics(frame.position);
              const offset = normal.dot(new Vector3(t.x, t.y, t.z).sub(plane));
              let closest = Infinity;
              for (let n = 0; n < solid.points.length; n += 3) {
                ensure(
                  ++this.contactChecks <= MECHANICAL_CONTACT_LIMITS.pairChecks,
                  "LIMIT_EXCEEDED",
                  "This mechanism is too complex to check safely. Try fewer moving parts.",
                  {
                    limit: "pairChecks",
                    maximum: MECHANICAL_CONTACT_LIMITS.pairChecks,
                  },
                );
                closest = Math.min(
                  closest,
                  offset +
                    local.x * solid.points[n] +
                    local.y * solid.points[n + 1] +
                    local.z * solid.points[n + 2],
                );
              }
              ensure(
                Number.isFinite(closest),
                "INVALID_INPUT",
                "Ground collision needs finite mechanical boundary points",
              );
              return closest;
            };
            if (blocked(distance(a), distance(b), travel)) {
              this.worldFailure =
                "Motion stopped before intersecting included ground. Move clear and retry.";
              return false;
            }
          } else {
            // A complete source-triangle slab proof covers the angular orbit
            // or the actual leaf interval. It applies only to the unchanged static mesh;
            // owned mating solids and every unresolved foreign surface retain
            // the normal native contact and subdivision path below.
            const registered = this.queries.hasStaticSupport(collider);
            const fullOrbit =
              registered &&
              invariantYRotationEligible(
                solid,
                this.jointSpecs,
                before,
                after,
                this.restFrames,
              );
            if (
              fullOrbit ||
              (registered &&
                !this.hasClosedLoops &&
                invariantYLeafRotationEligible(
                  solid,
                  this.jointSpecs,
                  before,
                  after,
                  this.restFrames,
                ))
            ) {
              const joint = this.jointSpecs.find(
                (j) => j.bodyB === solid.groupId,
              )!;
              const delta =
                after.pose.jointPositions[joint.id] -
                before.pose.jointPositions[joint.id];
              const key = JSON.stringify([
                collider.handle,
                a.position,
                before.groupFrames[joint.bodyA],
                fullOrbit
                  ? null
                  : [
                      a,
                      b,
                      before.pose.jointPositions[joint.id],
                      after.pose.jointPositions[joint.id],
                    ],
              ]);
              let proof = this.invariantSupport.get(solid);
              if (!proof || proof.key !== key) {
                this.contactEnumeration +=
                  ((fullOrbit ? 2 : 4) * solid.points.length) / 3;
                ensure(
                  this.contactEnumeration <=
                    MECHANICAL_CONTACT_LIMITS.enumeration,
                  "LIMIT_EXCEEDED",
                  "This mechanism is too complex to check safely. Try fewer moving parts.",
                );
                const enclosure = fullOrbit
                  ? invariantYRotationBounds(solid.points, a)
                  : invariantYRotationIntervalBounds(solid.points, a, b, delta);
                const result = this.queries.certifyStaticYSupport(
                  collider,
                  enclosure.query,
                  enclosure.minimum,
                  enclosure.maximum,
                  enclosure.guard,
                  MECHANICAL_CONTACT_LIMITS.enumeration -
                    this.contactEnumeration,
                )!;
                this.contactEnumeration += result.work;
                proof = { key, safe: result.safe };
                this.invariantSupport.set(solid, proof);
              }
              if (proof.safe) continue;
            }
            ensure(
              this.contactChecks + 2 <= MECHANICAL_CONTACT_LIMITS.pairChecks,
              "LIMIT_EXCEEDED",
              "This mechanism is too complex to check safely. Try fewer moving parts.",
              {
                limit: "pairChecks",
                maximum: MECHANICAL_CONTACT_LIMITS.pairChecks,
              },
            );
            this.contactChecks += 2;
            // Foreign handles never cross collider sets: cache an owned shape
            // shadow and synchronize only its accepted live pose.
            const ca = this.queries.collider(solid.shape),
              cb = this.queries.collider(collider.shape);
            cb.setTranslation(collider.translation());
            cb.setRotation(collider.rotation());
            ca.setTranslation(physics(a.position));
            ca.setRotation(rotation(a));
            const old = ca.contactCollider(cb, travel + 0.001 * S)?.distance;
            ca.setTranslation(physics(b.position));
            ca.setRotation(rotation(b));
            const next = ca.contactCollider(cb, travel + 0.001 * S)?.distance;
            if (blocked(old, next, travel)) {
              this.worldFailure =
                "Motion stopped before intersecting included world or another assembly. Move clear and retry.";
              return false;
            }
          }
        }
        for (const other of this.contactSolids) {
          enumerate();
          if (
            !movingGroups.has(other.groupId) ||
            this.contactPolicy.allowed(solid, other)
          )
            continue;
          const c = before.groupFrames[other.groupId],
            d = after.groupFrames[other.groupId];
          const otherTravel =
            (Math.hypot(...c.position.map((v, k) => v - d.position[k])) +
              other.radius * rotation(c).angleTo(rotation(d))) *
            S;
          if (!near(solid, other, travel + otherTravel + 0.001 * S)) continue;
          const old = contact(
            solid,
            a,
            other.shape,
            c,
            travel + otherTravel + 0.001 * S,
          );
          const next = contact(
            solid,
            b,
            other.shape,
            d,
            travel + otherTravel + 0.001 * S,
          );
          if (blocked(old, next, travel + otherTravel)) {
            this.worldFailure =
              "Motion stopped before intersecting another moving part in this mechanism. Move clear and retry.";
            return false;
          }
        }
      }
    } catch (error) {
      this.worldFailure =
        error instanceof Error
          ? error.message
          : "Joint collision could not be checked";
      return false;
    }
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
    return this.session.closePose(pose);
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
    const riderFailure =
      this.supportGuard?.(before, target) ?? this.riderGuard?.(before, target);
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
    const parents = new Map(this.jointSpecs.map((j) => [j.bodyB, j]));
    const slidePadding = this.jointSpecs
      .filter((j) => j.kind === "prismatic")
      .reduce(
        (n, j) =>
          n +
          Math.abs(
            (target.pose.jointPositions[j.id] ?? 0) -
              (before.pose.jointPositions[j.id] ?? 0),
          ),
        0,
      );
    const frameTravel = Math.max(
      0,
      ...this.contactSolids.map((s) => {
        const a = before.groupFrames[s.groupId],
          b = target.groupFrames[s.groupId];
        let unwrapped = 0,
          id = s.groupId;
        while (parents.has(id)) {
          const joint = parents.get(id)!;
          const delta = Math.abs(
            (target.pose.jointPositions[joint.id] ?? 0) -
              (before.pose.jointPositions[joint.id] ?? 0),
          );
          if (joint.kind === "prismatic") unwrapped += delta;
          else if (joint.kind === "revolute") {
            const carrier = before.groupFrames[joint.bodyA],
              pivot = add(carrier.position, mv(carrier.basis, joint.anchorA));
            unwrapped +=
              ((delta * Math.PI) / 180) *
              (Math.hypot(...a.position.map((v, k) => v - pivot[k])) +
                s.radius +
                slidePadding);
          }
          id = joint.bodyA;
        }
        return Math.max(
          unwrapped,
          Math.hypot(...a.position.map((v, k) => v - b.position[k])) +
            s.radius * rotation(a).angleTo(rotation(b)),
        );
      }),
    );
    const steps = Math.max(
      1,
      Math.ceil(travel / 2),
      Math.ceil(frameTravel / MECHANICAL_CONTACT_LIMITS.sweepLdu),
    );
    if (steps > 1024) {
      this.session.setPose(before.pose);
      this.apply(before);
      this.session.clearInput();
      this.blocked = true;
      this.reason =
        "This motion needs too many safety checks. Try a nearer target or a slower control.";
      return false;
    }
    let last = before;
    this.contactChecks = 0;
    this.contactEnumeration = 0;
    this.invariantSupport.clear();
    this.blocked = false;
    this.reason = undefined;
    let visited = 0;
    const advance = (
      from: MechanismSnapshot,
      to: MechanismSnapshot,
    ): boolean => {
      if (++visited > MECHANICAL_CONTACT_LIMITS.sweepSegments) {
        this.worldFailure =
          "This motion needs too many safety checks. Try a nearer target or a slower control.";
        return false;
      }
      this.session.setPose(to.pose);
      if (this.move(from, to)) return true;
      if (!this.worldNeedsRefinement) return false;
      const middle = this.session.setPose(
        this.interpolate(from.pose, to.pose, 0.5),
      );
      this.session.setPose(from.pose);
      this.apply(from);
      return advance(from, middle) && advance(middle, to);
    };
    for (let n = 1; n <= steps; n++) {
      const next = this.session.setPose(
        n === steps
          ? target.pose
          : this.interpolate(before.pose, target.pose, n / steps),
      );
      if (!advance(last, next)) {
        this.session.setPose(before.pose);
        this.apply(before);
        this.blocked = true;
        this.reason =
          this.worldFailure ??
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
    for (const other of this.session.coupledJointIds(id))
      this.targets.delete(other);
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
    ensure(
      speed <= this.session.jointSpeedLimit(id),
      "INVALID_INPUT",
      "Requested speed would exceed the supported speed of a coupled shaft.",
    );
    const before = this.session.snapshot();
    // Reuse authoritative scalar/limit validation, then restore without touching proxies.
    try {
      this.session.setJointPosition(id, target);
    } finally {
      this.session.setPose(before.pose);
    }
    this.pauseMotor(id);
    for (const other of this.session.coupledJointIds(id))
      this.targets.delete(other);
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
    for (const other of this.session.coupledJointIds(id)) {
      const motor = this.motors.get(other);
      if (motor) {
        motor.enabled = false;
        motor.status = "stopped";
        motor.blockedReason = undefined;
      }
    }
  }
  /** Enable or stop one authored motor. Manual joint commands stop it too. */
  setMotor(id: string, enabled: boolean, input?: number) {
    const motor = this.motors.get(id);
    ensure(
      motor,
      "INVALID_INPUT",
      "This joint has no authored revolute or prismatic motor",
    );
    validateMotorInput(enabled, input);
    if (motor.enabled === enabled && motor.input === input) return;
    motor.enabled = enabled;
    motor.input = input;
    motor.status = enabled ? "running" : "stopped";
    motor.blockedReason = undefined;
    if (enabled)
      for (const other of this.session.coupledJointIds(id))
        this.targets.delete(other);
    return this.snapshot();
  }
  private acceptJointStep(
    before: MechanismSnapshot,
    id: string,
    value: number,
  ) {
    try {
      return this.accept(before, this.session.setJointPosition(id, value));
    } catch (error) {
      if (
        !(error instanceof AppError) ||
        !/^Mechanism loop (cannot close|is at)/.test(error.message)
      )
        throw error;
      this.session.setPose(before.pose);
      this.apply(before);
      this.blocked = true;
      this.reason = error.message;
      return false;
    }
  }
  private stepMotors() {
    for (const id of [...this.motors.keys()].sort()) {
      const motor = this.motors.get(id)!;
      if (!motor.enabled) continue;
      const joint = motor.joint,
        spec = effectiveMotor(
          joint,
          motor.input,
          this.session.jointSpeedLimit(id),
        ),
        kind = joint.kind as "revolute" | "prismatic",
        state = this.session.snapshot(),
        current = state.pose.jointPositions[id],
        [low, high] = this.session.jointLimits(id);
      let next: number;
      if (spec.mode === "position") {
        const goal = Math.min(high, Math.max(low, spec.target)),
          rate =
            Math.min(
              KINEMATIC_MOTOR_RATE[kind],
              this.session.jointSpeedLimit(id),
            ) / 60,
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
      if (!this.acceptJointStep(state, id, next)) {
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
      // Retain accumulated turns: folding an input would change the phase of
      // a reduced output and would restart a multi-turn position target.
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
      const accepted = this.acceptJointStep(rest, id, next);
      if (!accepted) {
        motion.status = "blocked";
        motion.blockedReason = this.reason;
      } else if (next === motion.target) motion.status = "complete";
    }
    if (this.motors.size) this.stepMotors();
  }
  clearInput() {
    this.session.clearInput();
    for (const motor of this.motors.values())
      if (motor.input !== undefined) motor.input = 0;
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
          spec = effectiveMotor(
            motor.joint,
            motor.input,
            this.session.jointSpeedLimit(id),
          );
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
            ...(motor.input !== undefined ? { input: motor.input } : {}),
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
        "Moving surfaces carry standing players and stop before blocked movement. Seated vehicles and trains use their authored controls. Pushing is not simulated.",
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
    if (this.ownsQueries) this.queries.dispose();
    for (const proxy of this.proxies)
      this.world.removeCollider(proxy.collider, true);
    this.proxies = [];
    this.geometryCache = [];
    this.vehicleCheck = undefined;
    this.riderGuard = undefined;
    this.targets.clear();
  }
}
