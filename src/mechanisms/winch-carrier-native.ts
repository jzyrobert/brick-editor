import RAPIER from "@dimforge/rapier3d-compat";
import { Quaternion, Vector3 } from "three";
import { add, mv, orthonormalized } from "../core/math";
import { ensure, type Vec3 } from "../core/types";
import { toPhysics, toPhysicsDirection } from "../play/physics-frame";
import { AngularEquationSolver } from "./angular-equations";
import {
  isWinchCarrierPlan,
  type WinchCarrierPlan,
  type WinchSourceBearing,
} from "./winch-carrier";

const SCALE = 0.02;
export const WINCH_BEARING_ENVELOPE = Object.freeze({
  radialLdu: 0.05,
  axis: 0.002,
  phaseRadians: 0.002,
});
type V = { x: number; y: number; z: number };
const vec = (v: V): Vec3 => [v.x, v.y, v.z];
const sub = (a: Vec3, b: Vec3) => a.map((n, i) => n - b[i]) as Vec3;
const scale = (a: Vec3, k: number) => a.map((n) => n * k) as Vec3;
const dot = (a: Vec3, b: Vec3) => a.reduce((s, n, i) => s + n * b[i], 0);
const rotate = (q: Quaternion, p: Vec3) =>
  new Vector3(...p).applyQuaternion(q).toArray() as Vec3;
const wrap = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));
const quarterPhase = (x: number) => wrap(4 * x) / 4;
const native = (p: Vec3): V => ({ x: p[0], y: p[1], z: p[2] });
type Pose = { position: Vec3; rotation: Quaternion };
function pose(body: RAPIER.RigidBody, dt: number): Pose {
  const rotation = new Quaternion().copy(body.rotation()),
    omega = vec(body.angvel()),
    speed = Math.hypot(...omega);
  if (dt && speed)
    rotation
      .premultiply(
        new Quaternion().setFromAxisAngle(
          new Vector3(...scale(omega, 1 / speed)),
          speed * dt,
        ),
      )
      .normalize();
  return {
    position: add(vec(body.translation()), scale(vec(body.linvel()), dt)),
    rotation,
  };
}
type Port = { point: Vec3; axis: Vec3; span: readonly [number, number] };
export type NativeWinchBearingState = Readonly<{
  overlapLdu: number;
  radialErrorLdu: number;
  axisError: number;
  phaseErrorRadians: number;
}>;
type Bearing = {
  source: WinchSourceBearing;
  shaft: RAPIER.RigidBody;
  bore: RAPIER.RigidBody;
  shaftPort: Port;
  borePort: Port;
  anchorA: Vec3;
  anchorB: Vec3;
  axis: Vec3;
  keyId?: string;
  keyActive: boolean;
  joint?: RAPIER.ImpulseJoint;
  current?: NativeWinchBearingState;
  predicted?: NativeWinchBearingState;
  head: boolean;
};

/** Supplemental native graph for the actual separate source bodies. The caller
 * must independently bind their collision geometry and ordinary admission.
 * This helper never changes source, poses, velocities, colliders or contact
 * hooks. Friction fits and source pin catch deformation are not fabricated. */
export class NativeWinchCarrierConstraints {
  readonly solver: AngularEquationSolver;
  private bearings: Bearing[];
  private disposed = false;
  constructor(
    readonly world: RAPIER.World,
    readonly plan: WinchCarrierPlan,
    bodies: ReadonlyMap<string, RAPIER.RigidBody>,
  ) {
    ensure(
      isWinchCarrierPlan(plan) &&
        plan.bodies.length === 29 &&
        plan.bearings.length === 38 &&
        bodies.size === 29,
      "INVALID_INPUT",
      "Use the sealed separate-body winch source plan.",
    );
    const frames = new Map(
      plan.bodies.map((o) => [o.occurrenceId, orthonormalized(o.frame)]),
    );
    const handles = new Set<number>();
    for (const { occurrenceId, frame } of plan.bodies) {
      const b = bodies.get(occurrenceId),
        expected = toPhysics(frame.position);
      ensure(
        b &&
          b.isValid() &&
          world.bodies.get(b.handle) === b &&
          !handles.has(b.handle),
        "INVALID_INPUT",
        "Every winch occurrence needs its own valid native body.",
      );
      handles.add(b.handle);
      const p = b.translation(),
        q = b.rotation();
      // DynamicRig stores the authored source basis in member-local geometry;
      // its native rest rotation is identity. Bind this convention explicitly.
      ensure(
        p.x === Math.fround(expected.x) &&
          p.y === Math.fround(expected.y) &&
          p.z === Math.fround(expected.z) &&
          q.x === 0 &&
          q.y === 0 &&
          q.z === 0 &&
          q.w === 1,
        "INVALID_INPUT",
        "Winch native rest must match the exact source-relative convention.",
      );
    }
    const port = (p: WinchSourceBearing["shaft"]): Port => ({
      point: vec(
        toPhysics(sub(p.center, frames.get(p.occurrenceId)!.position)),
      ),
      axis: vec(toPhysicsDirection(p.axis)),
      span: p.spanLdu,
    });
    this.bearings = plan.bearings.map((source, i) => {
      const a = frames.get(source.native.bodyA)!,
        b = frames.get(source.native.bodyB)!;
      return {
        source,
        shaft: bodies.get(source.shaft.occurrenceId)!,
        bore: bodies.get(source.bore.occurrenceId)!,
        shaftPort: port(source.shaft),
        borePort: port(source.bore),
        anchorA: vec(toPhysics(mv(a.basis, source.native.anchorA))),
        anchorB: vec(toPhysics(mv(b.basis, source.native.anchorB))),
        axis: vec(toPhysicsDirection(source.shaft.axis)),
        keyId: source.kind === "keyed" ? "key-" + i : undefined,
        keyActive: false,
        head: plan.heads.some(
          (h) =>
            h.shaftId === source.shaft.occurrenceId &&
            h.supportId === source.bore.occurrenceId,
        ),
      };
    });
    const keyed = this.bearings.filter((b) => b.keyId);
    this.solver = new AngularEquationSolver(
      keyed.map((b) => ({
        id: b.keyId!,
        body: b.shaft,
        carrier: b.bore,
        axisLocal: b.axis,
      })),
      keyed.map((b) => ({
        id: b.keyId!,
        terms: [{ portId: b.keyId!, coefficient: 1 }],
        maxTorqueNm: 10,
        enabled: false,
      })),
    );
  }
  private state(b: Bearing, dt: number): NativeWinchBearingState {
    const s = pose(b.shaft, dt),
      h = pose(b.bore, dt),
      sp = add(s.position, rotate(s.rotation, b.shaftPort.point)),
      hp = add(h.position, rotate(h.rotation, b.borePort.point)),
      sa = rotate(s.rotation, b.shaftPort.axis),
      ha = rotate(h.rotation, b.borePort.axis),
      delta = sub(hp, sp),
      station = dot(delta, sa) / SCALE,
      sign = dot(sa, ha),
      interval = b.borePort.span
        .map((n) => station + sign * n)
        .sort((a, b) => a - b);
    const relative = h.rotation.clone().conjugate().multiply(s.rotation),
      radians =
        2 *
        Math.atan2(
          dot([relative.x, relative.y, relative.z], b.axis),
          relative.w,
        );
    return Object.freeze({
      overlapLdu:
        Math.min(b.shaftPort.span[1], interval[1]) -
        Math.max(b.shaftPort.span[0], interval[0]),
      radialErrorLdu:
        Math.hypot(...sub(delta, scale(sa, station * SCALE))) / SCALE,
      axisError: Math.hypot(...sub(sa, scale(ha, sign < 0 ? -1 : 1))),
      phaseErrorRadians: Math.abs(quarterPhase(radians)),
    });
  }
  private seated(s: NativeWinchBearingState) {
    return (
      s.overlapLdu > 0 &&
      s.radialErrorLdu <= WINCH_BEARING_ENVELOPE.radialLdu &&
      s.axisError <= WINCH_BEARING_ENVELOPE.axis
    );
  }
  /** Call before the shared eight mixed transmission passes. Bearings and key
   * rows close on predicted withdrawal, not merely after an already escaped
   * shaft. Re-entry never rebases source anchors or invents an axial weld. */
  beginStep(dt: number) {
    ensure(
      !this.disposed && Number.isFinite(dt) && dt > 0 && dt <= 0.1,
      "INVALID_INPUT",
      "Use an active winch graph and bounded fixed step.",
    );
    for (const b of this.bearings) {
      ensure(
        b.shaft.isValid() && b.bore.isValid(),
        "INVALID_INPUT",
        "Winch native source owner was removed.",
      );
      b.current = this.state(b, 0);
      b.predicted = this.state(b, dt);
      const active = this.seated(b.current) && this.seated(b.predicted);
      if (!active && b.joint) {
        this.world.removeImpulseJoint(b.joint, true);
        b.joint = undefined;
      }
      if (active && !b.joint) {
        b.joint = this.world.createImpulseJoint(
          RAPIER.JointData.generic(
            native(b.anchorA),
            native(b.anchorB),
            native(b.axis),
            RAPIER.JointAxesMask.LinY |
              RAPIER.JointAxesMask.LinZ |
              RAPIER.JointAxesMask.AngY |
              RAPIER.JointAxesMask.AngZ,
          ),
          b.bore,
          b.shaft,
          true,
        );
        b.joint.setContactsEnabled(true);
        if (b.head) {
          const stop = new RAPIER.PrismaticImpulseJoint(
            this.world.impulseJoints.raw,
            this.world.bodies,
            b.joint.handle,
          );
          // The positive value is a numerical domain, never a source collar.
          stop.setLimits(0, 1_000_000);
        }
      }
      if (b.keyId) {
        const enabled =
          active &&
          b.current.phaseErrorRadians <= WINCH_BEARING_ENVELOPE.phaseRadians;
        let phase: number | undefined;
        if (enabled && !b.keyActive) {
          const h = new Quaternion().copy(b.bore.rotation()).conjugate(),
            relative = h.multiply(new Quaternion().copy(b.shaft.rotation())),
            raw = wrap(
              2 *
                Math.atan2(
                  dot([relative.x, relative.y, relative.z], b.axis),
                  relative.w,
                ),
            ),
            previous = this.solver.snapshot().ports[b.keyId].radians;
          phase =
            Math.round(
              (previous + wrap(raw - wrap(previous))) / (Math.PI / 2),
            ) *
            (Math.PI / 2);
        }
        this.solver.setEnabled(b.keyId, enabled, phase);
        b.keyActive = enabled;
      }
    }
    this.solver.beginStep(dt);
  }
  solvePass() {
    ensure(!this.disposed, "INVALID_INPUT", "Winch graph was disposed.");
    this.solver.solvePass();
  }
  snapshot() {
    return {
      ordinaryAdmission: false as const,
      frictionModel: "not-applied" as const,
      activeBearings: this.bearings.filter((b) => b.joint).length,
      activeKeys: this.bearings.filter((b) => b.keyActive).length,
      bearings: this.bearings.map((b, index) => ({
        index,
        shaftId: b.source.shaft.occurrenceId,
        boreId: b.source.bore.occurrenceId,
        jointActive: !!b.joint,
        keyActive: b.keyActive,
        current: b.current,
        predicted: b.predicted,
      })),
    };
  }
  dispose() {
    if (this.disposed) return;
    for (const b of this.bearings) {
      if (b.joint?.isValid()) this.world.removeImpulseJoint(b.joint, true);
      b.joint = undefined;
      if (b.keyId) this.solver.setEnabled(b.keyId, false);
      b.keyActive = false;
    }
    this.disposed = true;
  }
}
