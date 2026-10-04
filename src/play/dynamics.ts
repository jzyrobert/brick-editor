import { Quaternion, Vector3 } from "three";
import type { SeatedPlacement } from "./seated-profile";
import RAPIER from "@dimforge/rapier3d-compat";
import { effectiveMotor, validateMotorInput } from "./motor-input";
import { occurrences } from "../core/document";
import { worldMechanicalFeatures } from "../mechanisms/mechanical-contacts";
import { AppError, ensure, type Transform, type Vec3 } from "../core/types";
import { add, compose, inverse, mv } from "../core/math";
import { axisRotation, KinematicSession } from "../mechanisms/kinematic";
import type { JointSpec, MotionRig, RigDynamics } from "../mechanisms/types";
import {
  validatePlayMechanismSource,
  validatePlayMechanismSources,
  type PlayMechanismSource,
} from "./mechanism";
import { anchoredGroup } from "../mechanisms/dynamics-settings";
import {
  MechanicalContactPolicy,
  mechanicalSolids,
  prepareMechanicalSources,
  type PreparedMechanicalSource,
  type MechanicalSolid,
} from "./mechanical-solids";
import {
  transmissionMap,
  transmissionSpeedLimit,
  TRANSMISSION_MAX_SPEED,
  type TransmissionMap,
} from "../mechanisms/transmissions";
import type { DrivingTriangleSource } from "./vehicle-obstacles";
import {
  CHARACTER_PROFILE as P,
  JOINT_TARGET_SPEED_LIMITS,
  type CollisionSnapshot,
  type PlayDynamicsReport,
  type PlayJointTargetReport,
  type PlayMechanismReport,
  type PlayMotorReport,
} from "./types";
import {
  METRES_PER_LDU as S,
  basisFromRotation,
  fromPhysics,
  fromPhysicsDirection,
  frameRotation,
  toPhysics,
  toPhysicsDirection,
} from "./physics-frame";

const DT = 1 / 60;
/**
 * Optional dynamic Play simulation (spec 19.4, M5/M6). Authored rigid groups
 * become Rapier rigid bodies with compound convex proxies built per member
 * occurrence; authored joints become constrained impulse joints with motors;
 * vehicles use Rapier's ray-cast wheel controller with sprung suspension.
 * Every brick is NOT an independent body: groups are the rigid unit, and
 * nothing models real clutch strength.
 */
export const DYNAMIC_LIMITS = Object.freeze({
  rigs: 14,
  bodies: 64,
  members: 512,
  hullPoints: 256,
  staticTriangles: 1_000_000,
  movingTriangles: 200_000,
});
export const DYNAMIC_DEFAULTS = Object.freeze({
  engine: "rapier3d-compat 0.21.0",
  gravity: 9.81,
  /** kg/m³ over convex proxy volume; hollow ABS bricks are far below solid. */
  density: 200,
  friction: 0.7,
  suspension: { restLength: 6, travel: 5, stiffness: 40, damping: 4 },
  /** Engine force per kilogram of chassis, N/kg, when not authored. */
  engineAccel: 4,
  /** Explicit targets on joints without an authored motor. */
  effort: { revolute: 500, prismatic: 2000 },
  /** Holding friction of idle joints, N·m or N. */
  idleEffort: { revolute: 2, prismatic: 5 },
  tolerance: { revolute: 1, prismatic: 0.5 },
  pushMassKg: 40,
});
const bit = (n: number) => 1 << n;
const STATIC_BIT = bit(0),
  MOVER_BIT = bit(1);
const groups = (membership: number, filter: number) =>
  ((membership & 0xffff) << 16) | (filter & 0xffff);
const rigBit = (index: number) => bit(2 + index);

export type DynamicRigSource = PlayMechanismSource & {
  /** Per-member geometry in world LDU, used for dynamic convex proxies. */
  members: Record<string, CollisionSnapshot>;
};
function meshOk(mesh: CollisionSnapshot | undefined, revision: number) {
  return (
    !!mesh &&
    mesh.revision === revision &&
    !mesh.unsupported &&
    mesh.vertices.length % 3 === 0 &&
    mesh.indices.length % 3 === 0 &&
    mesh.vertices.every(Number.isFinite) &&
    mesh.indices.every((i) => i < mesh.vertices.length / 3)
  );
}
export { anchoredGroup };
/** Validate all dynamic sources before any Rapier allocation. */
export function validateDynamicRigSources(
  sources: DynamicRigSource[],
  revision: number,
) {
  ensure(
    sources.length <= DYNAMIC_LIMITS.rigs,
    "LIMIT_EXCEEDED",
    `Dynamic Play supports at most ${DYNAMIC_LIMITS.rigs} rigs`,
  );
  let bodies = 0,
    members = 0;
  for (const source of sources) {
    new KinematicSession(source.project, source.rigId, source.lookup);
    const rig = source.project.motionRigs[source.rigId];
    const wheels = new Set(rig.vehicle?.wheels.map((w) => w.groupId) ?? []);
    for (const group of rig.groups) {
      if (wheels.has(group.id)) continue;
      bodies++;
      ensure(
        meshOk(source.groups[group.id], revision),
        "INVALID_INPUT",
        `Dynamic group ${group.id} needs complete geometry from the Play revision`,
      );
      if (anchoredGroup(rig, group.id)) continue;
      for (const id of group.occurrenceIds) {
        members++;
        const mesh = source.members?.[id];
        ensure(
          meshOk(mesh, revision),
          "INVALID_INPUT",
          `Dynamic group ${group.id} needs complete geometry for every member; ${id} has none from this revision`,
        );
        ensure(
          mesh!.indices.length > 0,
          "INVALID_INPUT",
          `Member ${id} of dynamic group ${group.id} has no surface to build a collision proxy. Remove it from the group, anchor the group, or use kinematic physics.`,
        );
      }
    }
    for (const joint of rig.joints)
      ensure(
        !wheels.has(joint.bodyA) && !wheels.has(joint.bodyB),
        "INVALID_INPUT",
        "Dynamic vehicle wheels are ray-cast wheels and cannot carry joints",
      );
  }
  ensure(
    bodies <= DYNAMIC_LIMITS.bodies && members <= DYNAMIC_LIMITS.members,
    "LIMIT_EXCEEDED",
    `Dynamic Play supports at most ${DYNAMIC_LIMITS.bodies} bodies and ${DYNAMIC_LIMITS.members} dynamic members`,
  );
}
/**
 * Convex proxy points in body-local metres: deduplicated on a quarter-LDU
 * grid, then (above the budget) the 26 directional extremes plus an even
 * stride. The hull of a subset is contained in the true hull, so reduction
 * can only shrink, never inflate, the proxy.
 */
export function proxyPoints(
  mesh: CollisionSnapshot,
  origin: Vec3,
  limit: number = DYNAMIC_LIMITS.hullPoints,
) {
  const seen = new Set<string>(),
    points: Vec3[] = [];
  const v = mesh.vertices;
  for (let i = 0; i < v.length; i += 3) {
    const p: Vec3 = [
      v[i] - origin[0],
      v[i + 1] - origin[1],
      v[i + 2] - origin[2],
    ];
    const key = p.map((n) => Math.round(n * 4)).join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    points.push(p);
  }
  let chosen = points;
  if (points.length > limit) {
    const picked = new Set<number>();
    for (const dx of [-1, 0, 1])
      for (const dy of [-1, 0, 1])
        for (const dz of [-1, 0, 1]) {
          if (!dx && !dy && !dz) continue;
          let best = 0,
            score = -Infinity;
          points.forEach((p, i) => {
            const s = p[0] * dx + p[1] * dy + p[2] * dz;
            if (s > score) {
              score = s;
              best = i;
            }
          });
          picked.add(best);
        }
    const stride = points.length / Math.max(1, limit - picked.size);
    for (let k = 0; picked.size < limit && k * stride < points.length; k++)
      picked.add(Math.floor(k * stride));
    chosen = [...picked].sort((a, b) => a - b).map((i) => points[i]);
  }
  const out = new Float32Array(chosen.length * 3);
  chosen.forEach((p, i) => {
    const q = toPhysics(p);
    out.set([q.x, q.y, q.z], i * 3);
  });
  return out;
}
type Body = {
  groupId: string;
  body: RAPIER.RigidBody;
  anchored: boolean;
  /** Group frame at authored rest; the body's rest rotation is identity. */
  rest: Transform;
  mirrors: RAPIER.Collider[];
  colliders: number;
};
type JointControl = {
  spec: JointSpec;
  joint: RAPIER.ImpulseJoint;
  axis: { x: number; y: number; z: number };
  /** Unwrapped scalar (degrees or LDU). */
  value: number;
  /** Holding-load compensation, in degrees/s; session-only and bounded. */
  positionIntegral: number;
  target?: Omit<PlayJointTargetReport, "current"> & {
    setpoint: number;
    stalledTicks: number;
    bestError: number;
  };
  motor?: {
    enabled: boolean;
    status: PlayMotorReport["status"];
    input?: number;
    stalledTicks?: number;
    blockedReason?: string;
    configured: string;
  };
  configured: string;
};
type Wheel = {
  groupId: string;
  index: number;
  restCenter: Vec3;
  restBasis: Transform["basis"];
  axleLdraw: Vec3;
  steering: boolean;
  connection: { x: number; y: number; z: number };
};
const quatMul = (
  a: { x: number; y: number; z: number; w: number },
  b: { x: number; y: number; z: number; w: number },
) => ({
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
});
const conj = (q: { x: number; y: number; z: number; w: number }) => ({
  x: -q.x,
  y: -q.y,
  z: -q.z,
  w: q.w,
});
const rotate = (
  q: { x: number; y: number; z: number; w: number },
  v: { x: number; y: number; z: number },
) => {
  const r = quatMul(quatMul(q, { ...v, w: 0 }), conj(q));
  return { x: r.x, y: r.y, z: r.z };
};

/** One dynamically simulated authored rig. */
export class DynamicRig {
  private contactEvents?: RAPIER.EventQueue;
  /** The pinned wrapper only invokes hooks through its event-queue path. */
  stepPhysics() {
    this.world.step(
      (this.contactEvents ??= new RAPIER.EventQueue(false)),
      this.physicsHooks,
    );
  }
  private contactPolicy!: MechanicalContactPolicy;
  private contactSolids = new Map<
    number,
    | MechanicalSolid
    | { groupId: string; memberId?: string; feature?: "rack-guide" }
  >();
  /** Direct Rapier harnesses must supply these hooks, as PlayDynamicsWorld does. */
  readonly physicsHooks: RAPIER.PhysicsHooks = {
    filterContactPair: (a, b) =>
      this.contactAllowed(a, b) ? RAPIER.SolverFlags.COMPUTE_IMPULSE : null,
    filterIntersectionPair: () => true,
  };
  contactAllowed(a: number, b: number) {
    const sa = this.contactSolids.get(a),
      sb = this.contactSolids.get(b);
    if (!sa || !sb) return true;
    if ("shape" in sa) return !this.contactPolicy.allowed(sa, sb);
    if ("shape" in sb) return !this.contactPolicy.allowed(sb, sa);
    return true;
  }
  readonly rigId: string;
  private rig: MotionRig;
  private settings: RigDynamics;
  private bodies = new Map<string, Body>();
  private joints = new Map<string, JointControl>();
  private transmissions: TransmissionMap;
  private vehicle?: {
    controller: RAPIER.DynamicRayCastVehicleController;
    chassis: Body;
    wheels: Wheel[];
    throttle: number;
    steering: number;
    engineForce: number;
    maxSpeed: number;
    maxSteerRadians: number;
    brake: number;
  };
  private meshes: Record<string, CollisionSnapshot>;
  private tick = 0;
  private cache?: { tick: number; report: PlayMechanismReport };
  private sourceCache?: { tick: number; sources: DrivingTriangleSource[] };
  constructor(
    private world: RAPIER.World,
    private characterWorld: RAPIER.World,
    source: DynamicRigSource,
    private index: number,
    private revision: number,
    prepared?: PreparedMechanicalSource,
  ) {
    validatePlayMechanismSource(source, revision);
    this.rigId = source.rigId;
    this.rig = structuredClone(source.project.motionRigs[source.rigId]);
    this.transmissions = transmissionMap(this.rig);
    this.settings = structuredClone(this.rig.dynamics ?? {});
    this.meshes = source.groups;
    this.contactPolicy =
      prepared?.policy ?? new MechanicalContactPolicy(this.rig, source);
    const solids =
      prepared?.solids ?? mechanicalSolids(source, this.contactPolicy);
    const friction = this.settings.friction ?? DYNAMIC_DEFAULTS.friction,
      own = rigBit(index),
      colliderGroups = groups(own, 0xffff);
    const wheels = new Set(
      this.rig.vehicle?.wheels.map((w) => w.groupId) ?? [],
    );
    // A small intermediate bearing carrying a heavy arm needs more iterations
    // than an independently mounted shaft. The native solver propagates this
    // fixed allowance to the connected island, rather than multiplying it by
    // the number of bodies. Simple rooted rigs retain the default cost.
    const articulated = this.rig.joints.some(
      (j) => !anchoredGroup(this.rig, j.bodyA),
    );
    for (const group of this.rig.groups) {
      if (wheels.has(group.id)) continue;
      const anchored = anchoredGroup(this.rig, group.id),
        origin = group.frame.position;
      const start = toPhysics(origin);
      const body = world.createRigidBody(
        (anchored
          ? RAPIER.RigidBodyDesc.fixed()
          : RAPIER.RigidBodyDesc.dynamic()
        )
          .setTranslation(start.x, start.y, start.z)
          .setCanSleep(true)
          .setLinearDamping(0.05)
          .setAngularDamping(0.1)
          .setCcdEnabled(!anchored),
      );
      if (!anchored && articulated) body.setAdditionalSolverIterations(8);
      const entry: Body = {
        groupId: group.id,
        body,
        anchored,
        rest: structuredClone(group.frame),
        mirrors: [],
        colliders: 0,
      };
      if (anchored) {
        // Anchored groups never move: exact trimesh keeps door-frame openings.
        const fixedMembers = source.members
          ? group.occurrenceIds.map((id) => [id, source.members[id]] as const)
          : [[undefined, source.groups[group.id]] as const];
        for (const [memberId, mesh] of fixedMembers) {
          const local = new Float32Array(mesh.vertices.length),
            worldVertices = new Float32Array(mesh.vertices.length);
          for (let i = 0; i < mesh.vertices.length; i += 3) {
            const p: Vec3 = [
              mesh.vertices[i],
              mesh.vertices[i + 1],
              mesh.vertices[i + 2],
            ];
            const a = toPhysics([
                p[0] - origin[0],
                p[1] - origin[1],
                p[2] - origin[2],
              ]),
              b = toPhysics(p);
            local.set([a.x, a.y, a.z], i);
            worldVertices.set([b.x, b.y, b.z], i);
          }
          if (mesh.indices.length) {
            const collider = world.createCollider(
              RAPIER.ColliderDesc.trimesh(local, mesh.indices.slice())
                .setFriction(friction)
                .setCollisionGroups(colliderGroups)
                .setActiveHooks(RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS),
              body,
            );
            const occurrence =
              memberId &&
              (
                source.lookup ??
                new Map(occurrences(source.project).map((o) => [o.id, o]))
              ).get(memberId);
            this.contactSolids.set(collider.handle, {
              groupId: group.id,
              ...(memberId ? { memberId } : {}),
              ...(occurrence &&
              worldMechanicalFeatures(occurrence)?.some(
                (f) => f.kind === "rack-guide",
              )
                ? { feature: "rack-guide" as const }
                : {}),
            });
            entry.mirrors.push(
              characterWorld.createCollider(
                RAPIER.ColliderDesc.trimesh(
                  worldVertices,
                  mesh.indices.slice(),
                ),
              ),
            );
            entry.colliders++;
          }
        }
      } else {
        for (const solid of solids.filter((s) => s.groupId === group.id)) {
          // Native bodies begin with identity rotation at the authored origin;
          // their member solids therefore include the authored group basis.
          const q = frameRotation(group.frame);
          // Rapier requires a flat compound: rotate each existing child through
          // the authored rest frame rather than nesting a compound.
          const native =
            solid.shape instanceof RAPIER.Compound
              ? new RAPIER.Compound(
                  solid.shape.shapes,
                  solid.shape.positions,
                  solid.shape.rotations.map((r) => quatMul(q, r)),
                )
              : new RAPIER.Compound([solid.shape], [{ x: 0, y: 0, z: 0 }], [q]);
          const desc = new RAPIER.ColliderDesc(native);
          const mirror = new RAPIER.ColliderDesc(native);
          const collider = world.createCollider(
            desc
              .setDensity(DYNAMIC_DEFAULTS.density)
              .setFriction(friction)
              .setCollisionGroups(colliderGroups)
              .setActiveHooks(RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS),
            body,
          );
          this.contactSolids.set(collider.handle, solid);
          entry.mirrors.push(characterWorld.createCollider(mirror!));
          entry.colliders++;
        }
        const mass = this.settings.groups?.[group.id]?.massKg;
        if (mass !== undefined) {
          body.recomputeMassPropertiesFromColliders();
          const current = body.mass();
          if (current > 0)
            for (let i = 0; i < body.numColliders(); i++)
              body
                .collider(i)
                .setDensity((DYNAMIC_DEFAULTS.density * mass) / current);
          body.recomputeMassPropertiesFromColliders();
        }
      }
      this.bodies.set(group.id, entry);
    }
    for (const spec of this.rig.joints) this.createJoint(spec);
    for (const closure of this.rig.loopClosures ?? []) {
      this.createJoint(closure);
      // Closure hinges constrain bodies physically but expose no independent
      // coordinate/motor. Passive tree coordinates remain in the reports.
      this.joints.delete(closure.id);
    }
    for (const link of this.rig.forceLinks ?? []) {
      const a = this.bodies.get(link.bodyA)!,
        b = this.bodies.get(link.bodyB)!;
      const anchorA = toPhysics(mv(a.rest.basis, link.anchorA)),
        anchorB = toPhysics(mv(b.rest.basis, link.anchorB));
      const data =
        link.kind === "spring"
          ? RAPIER.JointData.spring(
              link.restLengthLdu * S,
              link.stiffnessNewtonsPerMetre,
              link.dampingNewtonsSecondsPerMetre,
              anchorA,
              anchorB,
            )
          : RAPIER.JointData.rope(link.maxLengthLdu * S, anchorA, anchorB);
      this.world
        .createImpulseJoint(data, a.body, b.body, true)
        .setContactsEnabled(false);
    }
    if (this.rig.vehicle) this.createVehicle();
    this.syncMirrors();
  }
  private createJoint(spec: JointSpec) {
    const a = this.bodies.get(spec.bodyA)!,
      b = this.bodies.get(spec.bodyB)!;
    const world = add(a.rest.position, mv(a.rest.basis, spec.anchorA));
    const anchorA = toPhysics(
        world.map((v, k) => v - a.rest.position[k]) as Vec3,
      ),
      anchorB = toPhysics(world.map((v, k) => v - b.rest.position[k]) as Vec3);
    const axisWorld = spec.axisA ? mv(a.rest.basis, spec.axisA) : undefined;
    const axis = axisWorld
      ? toPhysicsDirection(axisWorld)
      : { x: 1, y: 0, z: 0 };
    const identity = { x: 0, y: 0, z: 0, w: 1 };
    const data =
      spec.kind === "revolute"
        ? RAPIER.JointData.revolute(anchorA, anchorB, axis)
        : spec.kind === "prismatic"
          ? RAPIER.JointData.prismatic(anchorA, anchorB, axis)
          : spec.kind === "fixed"
            ? RAPIER.JointData.fixed(anchorA, identity, anchorB, identity)
            : spec.kind === "cylindrical"
              ? RAPIER.JointData.generic(
                  anchorA,
                  anchorB,
                  axis,
                  RAPIER.JointAxesMask.LinY |
                    RAPIER.JointAxesMask.LinZ |
                    RAPIER.JointAxesMask.AngY |
                    RAPIER.JointAxesMask.AngZ,
                )
              : RAPIER.JointData.spherical(anchorA, anchorB);
    const joint = this.world.createImpulseJoint(data, a.body, b.body, true);
    joint.setContactsEnabled(true);
    if (spec.angularResistance) {
      // Rapier 0.21 wraps spherical data as Generic. Its exported spherical
      // wrapper accepts an existing handle and uses the public angular-axis
      // motor APIs, so no private raw WASM calls or unsafe casts are required.
      const ball = new RAPIER.SphericalImpulseJoint(
        this.world.impulseJoints.raw,
        this.world.bodies,
        joint.handle,
      );
      for (const axis of [
        RAPIER.JointAxis.AngX,
        RAPIER.JointAxis.AngY,
        RAPIER.JointAxis.AngZ,
      ]) {
        ball.configureMotorModel(axis, RAPIER.MotorModel.ForceBased);
        ball.setMotorMaxForce(axis, spec.angularResistance.maxTorqueNm / 3);
        ball.configureMotorVelocity(
          axis,
          0,
          spec.angularResistance.dampingNmSeconds,
        );
      }
    }
    if (spec.kind === "cylindrical" && spec.translationLimitsLdu) {
      // Public unit-axis wrapper selects LinX in the generic bearing frame.
      const linear = new RAPIER.PrismaticImpulseJoint(
        this.world.impulseJoints.raw,
        this.world.bodies,
        joint.handle,
      );
      linear.setLimits(
        spec.translationLimitsLdu[0] * S,
        spec.translationLimitsLdu[1] * S,
      );
    }
    const scale = spec.kind === "revolute" ? Math.PI / 180 : S;
    if (spec.limits && (spec.kind === "revolute" || spec.kind === "prismatic"))
      (joint as RAPIER.UnitImpulseJoint).setLimits(
        spec.limits[0] * scale,
        spec.limits[1] * scale,
      );
    this.joints.set(spec.id, {
      spec,
      joint,
      axis,
      value: 0,
      positionIntegral: 0,
      configured: "",
      ...(spec.motor && (spec.kind === "revolute" || spec.kind === "prismatic")
        ? { motor: { enabled: true, status: "running", configured: "" } }
        : {}),
    });
  }
  private createVehicle() {
    const v = this.rig.vehicle!,
      chassis = this.bodies.get(v.chassisGroup)!;
    const suspension = this.settings.suspension ?? DYNAMIC_DEFAULTS.suspension;
    const controller = this.world.createVehicleController(chassis.body);
    controller.indexUpAxis = 1;
    // The pinned typings name this setter setIndexForwardAxis.
    (
      controller as unknown as { setIndexForwardAxis: number }
    ).setIndexForwardAxis = 2;
    const up = { x: 0, y: 1, z: 0 },
      forward = { x: 0, y: 0, z: 1 };
    const wheels: Wheel[] = [];
    v.wheels.forEach((w, index) => {
      const group = this.rig.groups.find((g) => g.id === w.groupId)!;
      const center = group.frame.position;
      const local = toPhysics(
        center.map((c, k) => c - chassis.rest.position[k]) as Vec3,
      );
      const rest = suspension.restLength * S;
      const connection = { x: local.x, y: local.y + rest, z: local.z };
      const axleWorld = mv(group.frame.basis, w.axis);
      let axle = toPhysicsDirection(axleWorld);
      // Rapier drives along (up × axle); flip the axle so +throttle is forward.
      const drive = {
        x: up.y * axle.z - up.z * axle.y,
        y: up.z * axle.x - up.x * axle.z,
        z: up.x * axle.y - up.y * axle.x,
      };
      if (drive.x * forward.x + drive.y * forward.y + drive.z * forward.z < 0)
        axle = { x: -axle.x, y: -axle.y, z: -axle.z };
      controller.addWheel(
        connection,
        { x: 0, y: -1, z: 0 },
        axle,
        rest,
        w.radius * S,
      );
      controller.setWheelMaxSuspensionTravel(index, suspension.travel * S);
      controller.setWheelSuspensionStiffness(index, suspension.stiffness);
      controller.setWheelSuspensionCompression(index, suspension.damping);
      controller.setWheelSuspensionRelaxation(index, suspension.damping * 1.2);
      controller.setWheelMaxSuspensionForce(index, 100000);
      controller.setWheelFrictionSlip(index, 2);
      wheels.push({
        groupId: w.groupId,
        index,
        restCenter: [...center] as Vec3,
        restBasis: [...group.frame.basis] as Transform["basis"],
        axleLdraw: fromPhysicsDirection(axle),
        steering: w.steering,
        connection,
      });
    });
    chassis.body.recomputeMassPropertiesFromColliders();
    const mass = chassis.body.mass();
    this.vehicle = {
      controller,
      chassis,
      wheels,
      throttle: 0,
      steering: 0,
      engineForce:
        this.settings.engineForce ?? mass * DYNAMIC_DEFAULTS.engineAccel,
      maxSpeed: v.maxSpeed * S,
      maxSteerRadians: (v.maxSteerDegrees * Math.PI) / 180,
      brake: Math.max(1, mass * 0.1),
    };
  }
  private riderColliders: RAPIER.Collider[] = [];
  /** Rigid, zero-mass occupant shapes share the actual chassis response. */
  setRider(placement?: SeatedPlacement) {
    const chassis = this.vehicle?.chassis;
    ensure(chassis, "INVALID_INPUT", "A rider needs an active dynamic chassis");
    for (const collider of this.riderColliders)
      this.world.removeCollider(collider, false);
    this.riderColliders = [];
    if (!placement) return;
    const nativeFrame: Transform = {
      position: fromPhysics(chassis.body.translation()),
      basis: basisFromRotation(chassis.body.rotation()),
    };
    for (const box of placement.envelopes) {
      const local = compose(inverse(nativeFrame), box.frame);
      const t = toPhysics(local.position);
      this.riderColliders.push(
        this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(
            ...(box.halfExtents.map((n) => n * S) as Vec3),
          )
            .setTranslation(t.x, t.y, t.z)
            .setRotation(frameRotation(local))
            .setMass(0)
            .setFriction(0.7)
            .setCollisionGroups(chassis.body.collider(0).collisionGroups()),
          chassis.body,
        ),
      );
    }
  }
  private syncMirrors() {
    for (const entry of this.bodies.values()) {
      if (entry.anchored) continue;
      const t = entry.body.translation(),
        r = entry.body.rotation();
      for (const mirror of entry.mirrors) {
        mirror.setTranslation(t);
        mirror.setRotation(r);
      }
    }
  }
  /** Mirror colliders in the walking world, mapped to their dynamic bodies. */
  mirrorBodies() {
    const out = new Map<number, RAPIER.RigidBody>();
    for (const entry of this.bodies.values())
      if (!entry.anchored)
        for (const mirror of entry.mirrors) out.set(mirror.handle, entry.body);
    return out;
  }
  supportFrame(handle: number) {
    for (const entry of this.bodies.values())
      if (entry.mirrors.some((c) => c.handle === handle))
        return {
          rigId: this.rigId,
          groupId: entry.groupId,
          frame: this.frames()[entry.groupId],
        };
    return undefined;
  }
  supportNextFrame(handle: number) {
    for (const entry of this.bodies.values())
      if (entry.mirrors.some((c) => c.handle === handle)) {
        const p = entry.body.translation(),
          v = entry.body.linvel(),
          a = entry.body.angvel(),
          q = entry.body.rotation();
        const angle = Math.hypot(a.x, a.y, a.z) * DT;
        const rotation = new Quaternion(q.x, q.y, q.z, q.w);
        if (angle > 1e-12)
          rotation.premultiply(
            new Quaternion().setFromAxisAngle(
              new Vector3(a.x, a.y, a.z).normalize(),
              angle,
            ),
          );
        return {
          position: fromPhysics({
            x: p.x + v.x * DT,
            y: p.y + v.y * DT,
            z: p.z + v.z * DT,
          }),
          basis: mv3(basisFromRotation(rotation), entry.rest.basis),
        };
      }
    return undefined;
  }
  hasJoint(id: string) {
    return this.joints.has(id);
  }
  setVehicleInput(input: { throttle: number; steering: number }) {
    ensure(
      input &&
        typeof input === "object" &&
        Object.keys(input).every((k) => ["throttle", "steering"].includes(k)),
      "INVALID_INPUT",
      "Unknown vehicle input field.",
    );
    ensure(
      this.vehicle &&
        Number.isFinite(input.throttle) &&
        Math.abs(input.throttle) <= 1 &&
        Number.isFinite(input.steering) &&
        Math.abs(input.steering) <= 1,
      "INVALID_INPUT",
      "Vehicle input requires normalized throttle and steering.",
    );
    this.vehicle!.throttle = input.throttle;
    this.vehicle!.steering = input.steering;
    this.vehicle!.chassis.body.wakeUp();
    this.cache = undefined;
  }
  clearInput() {
    if (this.vehicle) this.vehicle.throttle = 0;
    for (const control of this.joints.values())
      if (control.motor?.input !== undefined) control.motor.input = 0;
    this.cache = undefined;
  }
  setJointTarget(id: string, target: number, speed: number) {
    ensure(
      !this.rig.loopClosures?.some((c) => c.dependentJointIds.includes(id)),
      "INVALID_INPUT",
      "Loop dependent joints are passive; control an independent joint.",
    );
    const control = this.joints.get(id);
    const kind = control?.spec.kind;
    ensure(
      control && (kind === "revolute" || kind === "prismatic"),
      "INVALID_INPUT",
      "Only revolute and prismatic joints accept scalar travel targets",
    );
    const limits = JOINT_TARGET_SPEED_LIMITS[kind];
    ensure(
      Number.isFinite(speed) && speed >= limits.min && speed <= limits.max,
      "INVALID_INPUT",
      `Joint speed must be ${limits.min}–${limits.max} ${kind === "revolute" ? "degrees/s" : "LDU/s"}`,
    );
    const [low, high] = this.jointLimits(id);
    ensure(
      !this.transmissions.has(id) ||
        speed <= transmissionSpeedLimit(this.transmissions, id),
      "INVALID_INPUT",
      "Requested speed would exceed the supported speed of a coupled shaft.",
    );
    ensure(
      Number.isFinite(target) && target >= low && target <= high,
      "INVALID_INPUT",
      "Joint position is outside authored limits.",
    );
    for (const other of this.transmissions.get(id)?.keys() ?? [id]) {
      const member = this.joints.get(other)!;
      member.target = undefined;
      member.positionIntegral = 0;
      if (member.motor) {
        member.motor.enabled = false;
        member.motor.status = "stopped";
      }
    }
    control.target = {
      target,
      speed,
      setpoint: control.value,
      stalledTicks: 0,
      bestError: Math.abs(target - control.value),
      status: "moving",
      units: kind === "revolute" ? "degrees" : "LDU",
      speedUnits: kind === "revolute" ? "degrees/s" : "LDU/s",
    };
    this.wake();
    this.cache = undefined;
  }
  setMotor(id: string, enabled: boolean, input?: number) {
    ensure(
      !this.rig.loopClosures?.some((c) => c.dependentJointIds.includes(id)),
      "INVALID_INPUT",
      "Loop dependent joints are passive; control an independent joint.",
    );
    const control = this.joints.get(id);
    ensure(
      control?.motor,
      "INVALID_INPUT",
      "This joint has no authored revolute or prismatic motor",
    );
    validateMotorInput(enabled, input);
    if (control.motor.enabled === enabled && control.motor.input === input)
      return;
    control.motor.enabled = enabled;
    control.motor.input = input;
    control.motor.stalledTicks = 0;
    control.motor.blockedReason = undefined;
    control.positionIntegral = 0;
    control.motor.status = enabled ? "running" : "stopped";
    if (enabled)
      for (const other of this.transmissions.get(id)?.keys() ?? [id])
        this.joints.get(other)!.target = undefined;
    this.wake();
    this.cache = undefined;
  }
  private wake() {
    for (const entry of this.bodies.values())
      if (!entry.anchored) entry.body.wakeUp();
  }
  private jointLimits(id: string): [number, number] {
    let low = -1e9,
      high = 1e9;
    for (const [other, ratio] of this.transmissions.get(id) ??
      new Map([[id, 1]])) {
      const values = (this.joints.get(other)!.spec.limits ?? [-1e9, 1e9]).map(
        (v) => v / ratio,
      );
      low = Math.max(low, Math.min(...values));
      high = Math.min(high, Math.max(...values));
    }
    return [low, high];
  }
  private configure(control: JointControl, key: string, apply: () => void) {
    if (control.configured === key) return;
    control.configured = key;
    apply();
  }
  /** Rapier's rotational position coordinate cannot encode accumulated turns.
   * Close the position loop in our unwrapped coordinate, driving a bounded
   * native velocity motor. The motor still applies physical, effort-limited
   * impulses; we never write body poses or velocities to reach a target. */
  private configurePosition(
    control: JointControl,
    setpoint: number,
    effort: number,
    speed = control.spec.kind === "revolute"
      ? JOINT_TARGET_SPEED_LIMITS.revolute.max
      : 40,
  ) {
    const joint = control.joint as RAPIER.UnitImpulseJoint;
    if (control.spec.kind === "revolute") {
      if (this.transmissions.has(control.spec.id))
        speed = Math.min(
          speed,
          transmissionSpeedLimit(this.transmissions, control.spec.id),
        );
      const error = setpoint - control.value;
      const carrier = this.bodies.get(control.spec.bodyA)!.body;
      const body = this.bodies.get(control.spec.bodyB)!.body;
      const axis = rotate(carrier.rotation(), control.axis);
      const a = carrier.angvel(),
        b = body.angvel();
      const actualSpeed = Math.abs(
        (((b.x - a.x) * axis.x + (b.y - a.y) * axis.y + (b.z - a.z) * axis.z) *
          180) /
          Math.PI,
      );
      const holding =
        !control.target || control.target.setpoint === control.target.target;
      const unwinding = control.positionIntegral * error < 0;
      if (
        holding &&
        (unwinding || (Math.abs(error) <= 10 && actualSpeed <= speed * 0.1))
      ) {
        const raw = error * 6 + control.positionIntegral;
        // Avoid winding up at the speed cap, but allow it to unwind/reverse.
        if (Math.abs(raw) < speed || Math.sign(error) !== Math.sign(raw))
          control.positionIntegral = Math.max(
            -speed,
            Math.min(speed, control.positionIntegral + error * 9 * DT),
          );
      }
      const velocity = Math.max(
        -speed,
        Math.min(speed, error * 6 + control.positionIntegral),
      );
      // Force-based damping is independent of the intermediate pin's inertia.
      // A stiff velocity loop lets the bounded motor oppose a static load;
      // maxEffort still caps its physical torque, including at a slow target.
      const damping = Math.max(10000, effort / ((speed * Math.PI) / 180));
      this.configure(control, `p:${velocity}:${effort}:${damping}`, () => {
        joint.configureMotorModel(RAPIER.MotorModel.ForceBased);
        joint.setMotorMaxForce(effort);
        joint.configureMotorVelocity((velocity * Math.PI) / 180, damping);
      });
    } else {
      // The same effort-limited slider feedback used by coupled racks also
      // holds an isolated linear actuator against gravity and spring loads.
      if (this.transmissions.has(control.spec.id))
        speed = Math.min(
          speed,
          transmissionSpeedLimit(this.transmissions, control.spec.id),
        );
      const error = setpoint - control.value;
      const holding =
        !control.target || control.target.setpoint === control.target.target;
      const raw = error * 6 + control.positionIntegral;
      if (
        holding &&
        Math.abs(error) <= 10 &&
        control.target?.status !== "blocked" &&
        (Math.abs(raw) < speed || Math.sign(error) !== Math.sign(raw))
      )
        control.positionIntegral = Math.max(
          -speed,
          Math.min(speed, control.positionIntegral + error * 9 * DT),
        );
      const velocity = Math.max(
        -speed,
        Math.min(speed, error * 6 + control.positionIntegral),
      );
      const damping = Math.max(10000, effort / (speed * S));
      this.configure(control, `p:${velocity}:${effort}:${damping}`, () => {
        joint.configureMotorModel(RAPIER.MotorModel.ForceBased);
        joint.setMotorMaxForce(effort);
        joint.configureMotorVelocity(velocity * S, damping);
      });
    }
  }
  /** Motor/controller inputs for the next world step. */
  beforeStep() {
    let awakened = false;
    const keepAwake = () => {
      if (!awakened) {
        this.wake();
        awakened = true;
      }
    };
    for (const id of [...this.joints.keys()].sort()) {
      const control = this.joints.get(id)!,
        spec = control.spec;
      if (spec.kind !== "revolute" && spec.kind !== "prismatic") continue;
      const joint = control.joint as RAPIER.UnitImpulseJoint,
        scale = spec.kind === "revolute" ? Math.PI / 180 : S;
      const target = control.target;
      if (target && target.status !== "complete") {
        keepAwake();
        const step = target.speed / 60,
          remaining = target.target - target.setpoint;
        target.setpoint =
          Math.abs(remaining) <= step
            ? target.target
            : target.setpoint + Math.sign(remaining) * step;
        const effort =
          spec.motor?.maxEffort.value ?? DYNAMIC_DEFAULTS.effort[spec.kind];
        this.configurePosition(control, target.setpoint, effort, target.speed);
        continue;
      }
      if (target) {
        // Completed targets hold their position with the same effort.
        const effort =
          spec.motor?.maxEffort.value ?? DYNAMIC_DEFAULTS.effort[spec.kind];
        this.configurePosition(control, target.target, effort, target.speed);
        continue;
      }
      const motor = control.motor;
      if (motor?.enabled && spec.motor) {
        const m = effectiveMotor(
          spec,
          motor.input,
          transmissionSpeedLimit(this.transmissions, id),
        );
        if (
          (m.mode === "velocity" && m.target !== 0) ||
          (m.mode === "position" &&
            Math.abs(control.value - m.target) >
              DYNAMIC_DEFAULTS.tolerance[spec.kind])
        )
          keepAwake();
        if (m.mode === "position") {
          const [low, high] = this.jointLimits(id);
          this.configurePosition(
            control,
            Math.min(high, Math.max(low, m.target)),
            m.maxEffort.value,
          );
        } else {
          const [low, high] = this.jointLimits(id);
          const forceBased =
            motor.input !== undefined || !!this.rig.loopClosures?.length;
          const velocity =
            (m.target > 0 && control.value >= high) ||
            (m.target < 0 && control.value <= low)
              ? 0
              : m.target;
          this.configure(
            control,
            `m:${velocity}:${m.maxEffort.value}:${motor.input !== undefined}`,
            () => {
              joint.configureMotorModel(
                forceBased
                  ? RAPIER.MotorModel.ForceBased
                  : RAPIER.MotorModel.AccelerationBased,
              );
              joint.setMotorMaxForce(m.maxEffort.value);
              joint.configureMotorVelocity(
                velocity * scale,
                forceBased ? 10000 : 10,
              );
            },
          );
        }
        continue;
      }
      this.configure(control, "idle", () => {
        joint.configureMotorModel(RAPIER.MotorModel.AccelerationBased);
        joint.setMotorMaxForce(
          this.transmissions.has(id) ||
            this.rig.loopClosures?.some((c) => c.dependentJointIds.includes(id))
            ? 0
            : DYNAMIC_DEFAULTS.idleEffort[
                spec.kind as "revolute" | "prismatic"
              ],
        );
        joint.configureMotorVelocity(0, 1);
      });
    }
    const v = this.vehicle;
    if (v) {
      const speed = v.controller.currentVehicleSpeed();
      const limited =
        (v.throttle > 0 && speed >= v.maxSpeed) ||
        (v.throttle < 0 && speed <= -v.maxSpeed);
      const force = limited
        ? 0
        : (v.throttle * v.engineForce) / v.wheels.length;
      for (const wheel of v.wheels) {
        v.controller.setWheelEngineForce(wheel.index, force);
        v.controller.setWheelBrake(wheel.index, v.throttle === 0 ? v.brake : 0);
        v.controller.setWheelSteering(
          wheel.index,
          wheel.steering ? v.steering * v.maxSteerRadians : 0,
        );
      }
      const own = rigBit(this.index);
      v.controller.updateVehicle(
        DT,
        undefined,
        groups(own, 0xffff & ~own & ~MOVER_BIT),
      );
    }
  }
  /** Read joint scalars and statuses after the world step. */
  afterStep() {
    this.tick++;
    for (const id of [...this.joints.keys()].sort()) {
      const control = this.joints.get(id)!,
        spec = control.spec;
      if (
        spec.kind !== "revolute" &&
        spec.kind !== "prismatic" &&
        spec.kind !== "cylindrical"
      )
        continue;
      const a = this.bodies.get(spec.bodyA)!.body,
        b = this.bodies.get(spec.bodyB)!.body;
      const previousValue = control.value;
      const qa = a.rotation(),
        qb = b.rotation();
      if (spec.kind === "revolute" || spec.kind === "cylindrical") {
        const rel = quatMul(conj(qa), qb);
        const along =
          rel.x * control.axis.x +
          rel.y * control.axis.y +
          rel.z * control.axis.z;
        let angle = (2 * Math.atan2(along, rel.w) * 180) / Math.PI;
        // Unwrap: keep continuity for continuously turning axles.
        const previous = control.value;
        angle += 360 * Math.round((previous - angle) / 360);
        control.value = angle;
      } else {
        const aRest = this.bodies.get(spec.bodyA)!.rest,
          bRest = this.bodies.get(spec.bodyB)!.rest;
        const world = add(aRest.position, mv(aRest.basis, spec.anchorA));
        const la = toPhysics(
            world.map((v, k) => v - aRest.position[k]) as Vec3,
          ),
          lb = toPhysics(world.map((v, k) => v - bRest.position[k]) as Vec3);
        const ta = a.translation(),
          tb = b.translation();
        const pa = rotate(qa, la),
          pb = rotate(qb, lb);
        const d = rotate(conj(qa), {
          x: tb.x + pb.x - ta.x - pa.x,
          y: tb.y + pb.y - ta.y - pa.y,
          z: tb.z + pb.z - ta.z - pa.z,
        });
        control.value =
          (d.x * control.axis.x + d.y * control.axis.y + d.z * control.axis.z) /
          S;
      }
      if (spec.kind === "cylindrical") continue;
      const tolerance = DYNAMIC_DEFAULTS.tolerance[spec.kind];
      const settled =
        Math.abs(control.value - previousValue) / DT <= tolerance * 2;
      const target = control.target;
      if (target) {
        const error = Math.abs(control.value - target.target);
        if (target.status === "complete" && (error > tolerance || !settled)) {
          target.status = "moving";
          target.bestError = error;
          target.stalledTicks = 0;
        }
        // A slow, loaded motor is moving, not stalled. Reset the timeout after
        // meaningful progress, accumulating tiny steps at the minimum speed.
        if (error < target.bestError - tolerance * 0.05) {
          target.bestError = error;
          target.stalledTicks = 0;
          target.status = "moving";
          target.blockedReason = undefined;
        }
        if (target.setpoint === target.target) {
          if (error <= tolerance && settled) {
            target.status = "complete";
            target.blockedReason = undefined;
          } else if (++target.stalledTicks >= 90) {
            target.status = "blocked";
            target.blockedReason =
              "The joint stalled before its target: something obstructs it, or the motor effort is too low.";
          } else if (target.status === "blocked") target.status = "moving";
        }
      }
      const motor = control.motor;
      if (motor?.enabled && spec.motor) {
        const m = effectiveMotor(
          spec,
          motor.input,
          transmissionSpeedLimit(this.transmissions, id),
        );
        if (m.mode === "position") {
          const [low, high] = this.jointLimits(id);
          motor.status =
            Math.abs(control.value - Math.min(high, Math.max(low, m.target))) <=
              tolerance && settled
              ? "holding"
              : "running";
        } else if (
          (m.target > 0 &&
            control.value >= this.jointLimits(id)[1] - tolerance) ||
          (m.target < 0 && control.value <= this.jointLimits(id)[0] + tolerance)
        )
          motor.status = "at-limit";
        else {
          motor.status = m.target === 0 ? "holding" : "running";
          if (motor.input !== undefined && m.target !== 0) {
            const progress = Math.abs(control.value - previousValue) / DT;
            motor.stalledTicks =
              progress < Math.abs(m.target) * 0.1
                ? (motor.stalledTicks ?? 0) + 1
                : 0;
            if (motor.stalledTicks >= 90) motor.status = "blocked";
          } else motor.stalledTicks = 0;
        }
        motor.blockedReason =
          motor.status === "blocked"
            ? "The motor cannot turn: something obstructs it, or its effort is too low."
            : undefined;
      }
    }
    this.solveTransmissions();
    this.syncMirrors();
    this.cache = undefined;
  }
  /** Sequential impulse constraint, separate from motor control. The Jacobian
   * enforces qB - ratio*qA = 0 and returns equal/opposite angular impulses to
   * both shafts and their carrier. Effective inertia transmits output loads
   * back to the effort-limited native motor. No body pose or velocity is set.
   * Baumgarte feedback corrects measured phase drift on following fixed ticks. */
  private solveTransmissions() {
    for (let pass = 0; pass < 8; pass++)
      for (const t of this.rig.transmissions ?? []) {
        if (t.kind === "rack") {
          this.solveRackTransmission(t);
          continue;
        }
        const ca = this.joints.get(t.jointA)!,
          cb = this.joints.get(t.jointB)!;
        const a = this.bodies.get(ca.spec.bodyB)!.body;
        const b = this.bodies.get(cb.spec.bodyB)!.body;
        const carrier = this.bodies.get(ca.spec.bodyA)!.body;
        const axisA = rotate(carrier.rotation(), ca.axis);
        const axisB = rotate(carrier.rotation(), cb.axis);
        const ratio = (-t.axisSign * t.teethA) / t.teethB;
        const ja = {
          x: -ratio * axisA.x,
          y: -ratio * axisA.y,
          z: -ratio * axisA.z,
        };
        const jb = axisB;
        const jc = { x: -ja.x - jb.x, y: -ja.y - jb.y, z: -ja.z - jb.z };
        const dot = (v: RAPIER.Vector, w: RAPIER.Vector) =>
          v.x * w.x + v.y * w.y + v.z * w.z;
        const inverseInertia = (body: RAPIER.RigidBody, v: RAPIER.Vector) => {
          const m = body.effectiveWorldInvInertia();
          return dot(v, {
            x: m.m11 * v.x + m.m12 * v.y + m.m13 * v.z,
            y: m.m21 * v.x + m.m22 * v.y + m.m23 * v.z,
            z: m.m31 * v.x + m.m32 * v.y + m.m33 * v.z,
          });
        };
        const inverseMass =
          inverseInertia(a, ja) +
          inverseInertia(b, jb) +
          inverseInertia(carrier, jc);
        if (inverseMass <= 1e-12) continue;
        const phaseError = ((cb.value - ratio * ca.value) * Math.PI) / 180;
        const speedError =
          dot(a.angvel(), ja) + dot(b.angvel(), jb) + dot(carrier.angvel(), jc);
        const maxCorrection = (TRANSMISSION_MAX_SPEED * Math.PI) / 180;
        const correction = Math.max(
          -maxCorrection,
          Math.min(maxCorrection, (0.8 * phaseError) / DT),
        );
        const impulse = -(speedError + correction) / inverseMass;
        if (Math.abs(impulse) < 1e-10) continue;
        for (const [body, jacobian] of [
          [a, ja],
          [b, jb],
          [carrier, jc],
        ] as const)
          body.applyTorqueImpulse(
            {
              x: jacobian.x * impulse,
              y: jacobian.y * impulse,
              z: jacobian.z * impulse,
            },
            true,
          );
      }
  }
  /** Ideal rolling constraint with linear rack impulses and angular pinion
   * impulses. Applying rack/carrier forces at the same world point preserves
   * their moment as well as returning the pinion torque to the carrier. */
  private solveRackTransmission(
    t: import("../mechanisms/types").RackTransmission,
  ) {
    const ca = this.joints.get(t.jointA)!,
      cb = this.joints.get(t.jointB)!;
    const a = this.bodies.get(ca.spec.bodyB)!.body;
    const b = this.bodies.get(cb.spec.bodyB)!.body;
    const c = this.bodies.get(ca.spec.bodyA)!.body;
    const u = rotate(c.rotation(), cb.axis),
      axis = rotate(c.rotation(), ca.axis);
    const r = t.pitchRadiusLdu * S;
    // The native prismatic joint locks rack orientation to its carrier. Use
    // the reduced sliding coordinate and apply at the rack center of mass;
    // counting its forbidden relative rotation as available inverse inertia
    // would absorb mesh impulses that the guide removes on the next tick.
    const com = b.worldCom();
    const p = { x: com.x, y: com.y, z: com.z };
    const dot = (v: RAPIER.Vector, w: RAPIER.Vector) =>
      v.x * w.x + v.y * w.y + v.z * w.z;
    const cross = (v: RAPIER.Vector, w: RAPIER.Vector) => ({
      x: v.y * w.z - v.z * w.y,
      y: v.z * w.x - v.x * w.z,
      z: v.x * w.y - v.y * w.x,
    });
    const scale = (v: RAPIER.Vector, n: number) => ({
      x: v.x * n,
      y: v.y * n,
      z: v.z * n,
    });
    const sub = (v: RAPIER.Vector, w: RAPIER.Vector) => ({
      x: v.x - w.x,
      y: v.y - w.y,
      z: v.z - w.z,
    });
    const ja = scale(axis, -r);
    const lever = cross(sub(p, c.worldCom()), u),
      jc = {
        x: r * axis.x - lever.x,
        y: r * axis.y - lever.y,
        z: r * axis.z - lever.z,
      };
    const angularMass = (body: RAPIER.RigidBody, v: RAPIER.Vector) => {
      const m = body.effectiveWorldInvInertia();
      return dot(v, {
        x: m.m11 * v.x + m.m12 * v.y + m.m13 * v.z,
        y: m.m21 * v.x + m.m22 * v.y + m.m23 * v.z,
        z: m.m31 * v.x + m.m32 * v.y + m.m33 * v.z,
      });
    };
    const linearMass = (body: RAPIER.RigidBody) => {
      const m = body.effectiveInvMass();
      return u.x * u.x * m.x + u.y * u.y * m.y + u.z * u.z * m.z;
    };
    const invMass =
      angularMass(a, ja) + angularMass(c, jc) + linearMass(b) + linearMass(c);
    if (invMass <= 1e-12) return;
    const error = cb.value * S - (r * ca.value * Math.PI) / 180;
    const vb = b.linvel(),
      vbCopy = { x: vb.x, y: vb.y, z: vb.z };
    const relativeVelocity = sub(vbCopy, c.linvel());
    const speed =
      dot(a.angvel(), ja) + dot(c.angvel(), jc) + dot(relativeVelocity, u);
    const correction = Math.max(-72, Math.min(72, (0.8 * error) / DT));
    const impulse = -(speed + correction) / invMass;
    if (Math.abs(impulse) < 1e-10) return;
    b.applyImpulseAtPoint(scale(u, impulse), p, true);
    c.applyImpulseAtPoint(scale(u, -impulse), p, true);
    a.applyTorqueImpulse(scale(ja, impulse), true);
    c.applyTorqueImpulse(scale(axis, r * impulse), true);
  }
  private frames(): Record<string, Transform> {
    const frames: Record<string, Transform> = {};
    for (const entry of this.bodies.values()) {
      const t = entry.body.translation(),
        r = entry.body.rotation();
      // Body rest rotation is identity at the group origin.
      const basis = basisFromRotation(r);
      frames[entry.groupId] = {
        position: fromPhysics(t),
        basis: mv3(basis, entry.rest.basis),
      };
    }
    const v = this.vehicle;
    if (v) {
      const chassisFrame = frames[v.chassis.groupId];
      const delta = compose(chassisFrame, inverse(v.chassis.rest));
      for (const wheel of v.wheels) {
        const length =
          v.controller.wheelSuspensionLength(wheel.index) ??
          (this.settings.suspension ?? DYNAMIC_DEFAULTS.suspension).restLength *
            S;
        const center = fromPhysics({
          x: wheel.connection.x,
          y: wheel.connection.y - length,
          z: wheel.connection.z,
        });
        const restCenter = add(v.chassis.rest.position, center);
        const steer =
          ((v.controller.wheelSteering(wheel.index) ?? 0) * 180) / Math.PI;
        const spin =
          ((v.controller.wheelRotation(wheel.index) ?? 0) * 180) / Math.PI;
        const local = mv3(
          mv3(
            axisRotation([0, -1, 0], steer),
            axisRotation(wheel.axleLdraw, spin),
          ),
          wheel.restBasis,
        );
        frames[wheel.groupId] = {
          position: add(delta.position, mv(delta.basis, restCenter)),
          basis: mv3(delta.basis, local),
        };
      }
    }
    return frames;
  }
  collisionSources(): readonly DrivingTriangleSource[] {
    if (this.sourceCache?.tick === this.tick) return this.sourceCache.sources;
    const frames = this.frames();
    const sources = this.rig.groups.map((group) => {
      const mesh = this.meshes[group.id],
        delta = compose(frames[group.id], inverse(group.frame));
      const vertices = new Float32Array(mesh.vertices.length);
      for (let i = 0; i < vertices.length; i += 3) {
        const p = add(
          delta.position,
          mv(delta.basis, [
            mesh.vertices[i],
            mesh.vertices[i + 1],
            mesh.vertices[i + 2],
          ]),
        );
        const q = toPhysics(p);
        vertices.set([q.x, q.y, q.z], i);
      }
      return {
        sourceId: JSON.stringify([this.rigId, group.id]),
        units: "metres" as const,
        up: "+Y" as const,
        owner: { kind: "rig" as const, rigId: this.rigId },
        vertices,
        indices: mesh.indices,
      };
    });
    this.sourceCache = { tick: this.tick, sources };
    return sources;
  }
  snapshot(): PlayMechanismReport {
    if (this.cache?.tick === this.tick)
      return structuredClone(this.cache.report);
    const frames = this.frames();
    const transforms: Record<string, Transform> = {};
    for (const group of this.rig.groups) {
      const delta = compose(frames[group.id], inverse(group.frame));
      for (const id of group.occurrenceIds)
        transforms[id] = compose(delta, group.restTransforms[id]);
    }
    const jointPositions: Record<string, number> = {};
    const jointTargets: Record<string, PlayJointTargetReport> = {};
    const motors: Record<string, PlayMotorReport> = {};
    const bearings: NonNullable<PlayDynamicsReport["bearings"]> = {};
    for (const [id, control] of this.joints) {
      const spec = control.spec;
      if (spec.kind === "cylindrical") {
        const a = frames[spec.bodyA],
          b = frames[spec.bodyB],
          pa = add(a.position, mv(a.basis, spec.anchorA)),
          pb = add(b.position, mv(b.basis, spec.anchorB)),
          axis = mv(a.basis, spec.axisA!);
        bearings[id] = {
          translationLdu: pb.reduce(
            (sum, v, k) => sum + (v - pa[k]) * axis[k],
            0,
          ),
          angleDegrees: control.value,
        };
      }
      if (spec.kind !== "revolute" && spec.kind !== "prismatic") continue;
      jointPositions[id] = control.value;
      const revolute = spec.kind === "revolute";
      if (control.target) {
        const {
          setpoint: _setpoint,
          stalledTicks: _stalled,
          bestError: _bestError,
          ...report
        } = control.target;
        jointTargets[id] = { ...report, current: control.value };
      }
      if (control.motor && spec.motor) {
        const m = effectiveMotor(
          spec,
          control.motor.input,
          transmissionSpeedLimit(this.transmissions, id),
        );
        motors[id] = {
          mode: m.mode,
          target: m.target,
          enabled: control.motor.enabled,
          status: control.motor.status,
          units: revolute ? "degrees" : "LDU",
          targetUnits:
            m.mode === "position"
              ? revolute
                ? "degrees"
                : "LDU"
              : revolute
                ? "degrees/s"
                : "LDU/s",
          simulation: "dynamic-motor",
          ...(control.motor.input !== undefined
            ? { input: control.motor.input }
            : {}),
          ...(control.motor.blockedReason
            ? { blockedReason: control.motor.blockedReason }
            : {}),
        };
      }
    }
    const bodies: PlayDynamicsReport["bodies"] = {};
    for (const entry of this.bodies.values()) {
      const lv = entry.body.linvel(),
        av = entry.body.angvel();
      bodies[entry.groupId] = {
        anchored: entry.anchored,
        massKg: entry.anchored ? 0 : entry.body.mass(),
        colliders: entry.colliders,
        sleeping: entry.anchored || entry.body.isSleeping(),
        linearVelocity: fromPhysics(lv),
        angularSpeed: (Math.hypot(av.x, av.y, av.z) * 180) / Math.PI,
      };
    }
    const dynamics: PlayDynamicsReport = {
      engine: DYNAMIC_DEFAULTS.engine,
      gravity: DYNAMIC_DEFAULTS.gravity,
      bodies,
      ...(Object.keys(bearings).length ? { bearings } : {}),
    };
    let vehiclePose: PlayMechanismReport["pose"]["vehicle"];
    const v = this.vehicle;
    if (v) {
      const chassis = frames[v.chassis.groupId];
      const forward = mv(
        chassis.basis,
        mv(inverse(v.chassis.rest).basis, [0, 0, -1]),
      );
      const wheelAngles: Record<string, number> = {};
      dynamics.wheels = {};
      for (const wheel of v.wheels) {
        const rotation =
          ((v.controller.wheelRotation(wheel.index) ?? 0) * 180) / Math.PI;
        wheelAngles[wheel.groupId] = rotation;
        dynamics.wheels[wheel.groupId] = {
          contact: v.controller.wheelIsInContact(wheel.index),
          suspensionLength:
            (v.controller.wheelSuspensionLength(wheel.index) ?? 0) / S,
          steeringDegrees:
            ((v.controller.wheelSteering(wheel.index) ?? 0) * 180) / Math.PI,
          rotationDegrees: rotation,
        };
      }
      dynamics.speed = v.controller.currentVehicleSpeed() / S;
      vehiclePose = {
        position: chassis.position.map(
          (p, k) => p - v.chassis.rest.position[k],
        ) as Vec3,
        headingDegrees: (Math.atan2(forward[0], -forward[2]) * 180) / Math.PI,
        steeringDegrees: (v.steering * v.maxSteerRadians * 180) / Math.PI,
        wheelAngles,
      };
    }
    const stalled =
      Object.values(jointTargets).find((t) => t.status === "blocked") ??
      Object.values(motors).find((m) => m.status === "blocked");
    const report: PlayMechanismReport = {
      sourceRevision: this.revision,
      rigId: this.rigId,
      tick: this.tick,
      simulationHz: 60,
      mode: "dynamic",
      units: "LDU",
      scaleMetresPerLdu: 0.02,
      pose: {
        jointPositions,
        ...(vehiclePose ? { vehicle: vehiclePose } : {}),
      },
      groupFrames: frames,
      transforms,
      jointTargets,
      ...(Object.keys(motors).length ? { motors } : {}),
      dynamics,
      blocked: !!stalled,
      ...(stalled?.blockedReason
        ? { blockedReason: stalled.blockedReason }
        : {}),
      warnings: [
        "Dynamic rigid-body simulation (Rapier): each authored group is one body with bounded convex compounds; anchored groups keep exact surfaces. Reviewed bores and gear openings are retained. Default proxy mass and inertia approximate the simulation geometry; thin source skins are hollow. Authored mass, motor effort and friction are simulation settings, not measured brick weight or clutch strength.",
        ...(this.rig.vehicle
          ? [
              "Dynamic vehicle: ray-cast wheels with sprung suspension. Authored open-bench seats attach their rigid rider body to the dynamic chassis.",
            ]
          : []),
        ...(this.rig.joints.some((j) => j.kind === "cylindrical")
          ? [
              "Cylindrical bearings translate and spin freely, with optional axial stops; their coordinates are read-only and have no scalar motor controls.",
            ]
          : []),
        ...(this.rig.joints.some((j) => j.kind === "spherical")
          ? [
              "Spherical joints retain free swing; optional angular resistance opposes rotation. Powered orientation and swing/twist limits are not exposed.",
            ]
          : []),
        "Standing explorers follow moving supports through capsule sweeps; walking pushes loose bodies. Other dynamic contacts do not push the explorer.",
      ],
    };
    this.cache = { tick: this.tick, report };
    return structuredClone(report);
  }
  dispose() {
    this.contactEvents?.free();
    for (const entry of this.bodies.values())
      for (const mirror of entry.mirrors)
        this.characterWorld.removeCollider(mirror, false);
    this.bodies.clear();
    this.joints.clear();
    this.vehicle = undefined;
  }
}
function mv3(a: Transform["basis"], b: Transform["basis"]): Transform["basis"] {
  const out = new Array(9).fill(0);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) out[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return out as Transform["basis"];
}

/**
 * The dynamic world is separate from the walking world. The walking actor is
 * a kinematic capsule here; kinematic rigs are kinematic bodies; dynamic rig
 * bodies appear in the walking world as mirrored obstacle colliders. Exactly
 * one dynamic step runs per fixed Play tick.
 */
export class PlayDynamicsWorld {
  readonly world: RAPIER.World;
  private rigs = new Map<string, DynamicRig>();
  private player: RAPIER.RigidBody;
  private events: RAPIER.EventQueue;
  private playerCollider: RAPIER.Collider;
  private kinematic = new Map<
    string,
    Array<{ id: string; body: RAPIER.RigidBody }>
  >();
  private mirrorBodies = new Map<number, RAPIER.RigidBody>();
  constructor(
    staticMesh: { vertices: Float32Array; indices: Uint32Array } | undefined,
    ground: boolean,
    private characterWorld: RAPIER.World,
    sources: DynamicRigSource[],
    revision: number,
    preparedContacts?: Map<string, PreparedMechanicalSource>,
  ) {
    validatePlayMechanismSources(sources, revision);
    preparedContacts ??= prepareMechanicalSources(sources);
    this.world = new RAPIER.World({ x: 0, y: -DYNAMIC_DEFAULTS.gravity, z: 0 });
    this.events = new RAPIER.EventQueue(false);
    this.world.timestep = DT;
    try {
      if (staticMesh?.indices.length) {
        ensure(
          staticMesh.indices.length / 3 <= DYNAMIC_LIMITS.staticTriangles,
          "LIMIT_EXCEEDED",
          "Dynamic Play supports at most 1,000,000 static triangles",
        );
        this.world.createCollider(
          RAPIER.ColliderDesc.trimesh(staticMesh.vertices, staticMesh.indices)
            .setFriction(DYNAMIC_DEFAULTS.friction)
            .setCollisionGroups(groups(STATIC_BIT, 0xffff)),
        );
      }
      if (ground)
        this.world.createCollider(
          new RAPIER.ColliderDesc(new RAPIER.HalfSpace({ x: 0, y: 1, z: 0 }))
            .setFriction(DYNAMIC_DEFAULTS.friction)
            .setCollisionGroups(groups(STATIC_BIT, 0xffff)),
        );
      this.player = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased(),
      );
      this.playerCollider = this.world.createCollider(
        RAPIER.ColliderDesc.capsule(
          (P.height / 2 - P.radius) * S,
          // One LDU safety pad resists solver penetration when a supported
          // explorer is pinned beneath a ceiling; the walking capsule is unchanged.
          (P.radius + 1) * S,
        )
          .setCollisionGroups(groups(MOVER_BIT, 0xffff & ~MOVER_BIT))
          .setActiveHooks(RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS),
        this.player,
      );
      [...sources]
        .sort((a, b) => (a.rigId < b.rigId ? -1 : a.rigId > b.rigId ? 1 : 0))
        .forEach((source, index) => {
          const rig = new DynamicRig(
            this.world,
            characterWorld,
            source,
            index,
            revision,
            preparedContacts!.get(source.rigId),
          );
          this.rigs.set(source.rigId, rig);
          for (const [handle, body] of rig.mirrorBodies())
            this.mirrorBodies.set(handle, body);
        });
    } catch (error) {
      for (const rig of this.rigs.values()) rig.dispose();
      this.events.free();
      this.world.free();
      throw error instanceof Error
        ? error
        : new AppError("INVALID_INPUT", String(error));
    }
  }
  rig(id: string) {
    return this.rigs.get(id);
  }
  rigIds() {
    return [...this.rigs.keys()].sort();
  }
  /** Kinematic rig surfaces as kinematic bodies, so moving doors push crates. */
  addKinematicRig(
    rigId: string,
    shapes: ReadonlyArray<{
      id: string;
      vertices: Float32Array;
      indices: Uint32Array;
    }>,
  ) {
    const bodies = shapes.map((shape) => {
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased(),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.trimesh(shape.vertices, shape.indices)
          .setFriction(DYNAMIC_DEFAULTS.friction)
          .setCollisionGroups(groups(MOVER_BIT, 0xffff & ~MOVER_BIT)),
        body,
      );
      return { id: shape.id, body };
    });
    this.kinematic.set(rigId, bodies);
  }
  syncKinematicRig(
    rigId: string,
    frames: Record<string, Transform>,
    immediate = false,
  ) {
    for (const { id, body } of this.kinematic.get(rigId) ?? []) {
      const frame = frames[id];
      if (!frame) continue;
      const t = toPhysics(frame.position),
        r = frameRotation(frame);
      const q = { x: r.x, y: r.y, z: r.z, w: r.w };
      if (immediate) {
        body.setTranslation(t, true);
        body.setRotation(q, true);
      } else {
        body.setNextKinematicTranslation(t);
        body.setNextKinematicRotation(q);
      }
    }
  }
  /** One fixed tick. `feet` is the explorer's standing position in LDU. */
  step(feet: Vec3, actorSolid: boolean, supportHandle?: number) {
    this.playerCollider.setEnabled(actorSolid);
    const next = toPhysics([feet[0], feet[1] - P.height / 2, feet[2]]),
      now = this.player.translation();
    // Teleports and respawns relocate the actor instead of sweeping it
    // through every body in between.
    if (Math.hypot(next.x - now.x, next.y - now.y, next.z - now.z) > 1)
      this.player.setTranslation(next, false);
    else this.player.setNextKinematicTranslation(next);
    for (const id of this.rigIds()) this.rigs.get(id)!.beforeStep();
    const supportingBody =
      supportHandle === undefined
        ? undefined
        : this.mirrorBodies.get(supportHandle)?.handle;
    this.world.step(this.events, {
      filterContactPair: (a, b, bodyA, bodyB) => {
        if (
          supportingBody !== undefined &&
          ((bodyA === this.player.handle && bodyB === supportingBody) ||
            (bodyB === this.player.handle && bodyA === supportingBody))
        )
          return null;
        for (const rig of this.rigs.values())
          if (!rig.contactAllowed(a, b)) return null;
        return RAPIER.SolverFlags.COMPUTE_IMPULSE;
      },
      filterIntersectionPair: () => true,
    });
    for (const id of this.rigIds()) this.rigs.get(id)!.afterStep();
  }
  supportFrame(handle: number) {
    for (const rig of this.rigs.values()) {
      const support = rig.supportFrame(handle);
      if (support) return support;
    }
    return undefined;
  }
  supportNextFrame(handle: number) {
    for (const rig of this.rigs.values()) {
      const frame = rig.supportNextFrame(handle);
      if (frame) return frame;
    }
    return undefined;
  }
  /** Walking collisions against mirrored dynamic bodies become bounded pushes. */
  push(
    collisions: Array<{
      handle: number;
      point: { x: number; y: number; z: number };
      remaining: { x: number; y: number; z: number };
    }>,
  ) {
    for (const c of collisions) {
      const body = this.mirrorBodies.get(c.handle);
      if (!body) continue;
      const horizontal = Math.hypot(c.remaining.x, c.remaining.z);
      if (horizontal < 1e-6) continue;
      // Momentum of the blocked part of this tick's walk, capped per tick.
      const speed = Math.min(horizontal / DT, 4);
      const scale = (DYNAMIC_DEFAULTS.pushMassKg * speed * 0.1) / horizontal;
      body.applyImpulseAtPoint(
        { x: c.remaining.x * scale, y: 0, z: c.remaining.z * scale },
        c.point,
        true,
      );
    }
  }
  isMirror(handle: number) {
    return this.mirrorBodies.has(handle);
  }
  dispose() {
    for (const rig of this.rigs.values()) rig.dispose();
    this.rigs.clear();
    this.kinematic.clear();
    this.mirrorBodies.clear();
    this.events.free();
    this.world.free();
  }
}
