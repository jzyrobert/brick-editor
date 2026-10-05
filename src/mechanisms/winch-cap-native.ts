import RAPIER from "@dimforge/rapier3d-compat";
import { Quaternion, Vector3 } from "three";
import { ensure, type Vec3 } from "../core/types";
import { toPhysics, toPhysicsDirection } from "../play/physics-frame";
import {
  isSourceBoundWinchCollision,
  type SourceBoundWinchCollision,
} from "./winch-collision";

type V = { x: number; y: number; z: number };
const vec = (v: V): Vec3 => [v.x, v.y, v.z];
const obj = (v: Vec3): V => ({ x: v[0], y: v[1], z: v[2] });
const add = (a: Vec3, b: Vec3) => a.map((n, i) => n + b[i]) as Vec3;
const sub = (a: Vec3, b: Vec3) => a.map((n, i) => n - b[i]) as Vec3;
const scale = (a: Vec3, k: number) => a.map((n) => n * k) as Vec3;
const dot = (a: Vec3, b: Vec3) => a.reduce((s, n, i) => s + n * b[i], 0);
const rotate = (q: Quaternion, v: Vec3) =>
  new Vector3(...v).applyQuaternion(q).toArray() as Vec3;
type Pose = { position: Vec3; rotation: Quaternion };
function pose(b: RAPIER.RigidBody, dt: number): Pose {
  const rotation = new Quaternion().copy(b.rotation()),
    omega = vec(b.angvel()),
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
    position: add(vec(b.translation()), scale(vec(b.linvel()), dt)),
    rotation,
  };
}
const worldPoint = (p: Pose, v: Vec3) => add(p.position, rotate(p.rotation, v));
export const WINCH_CAP_ENVELOPE = Object.freeze({
  separationLdu: 0.05,
  radialLdu: 0.05,
  axis: 0.002,
});
export type WinchCapState = Readonly<{
  radialErrorLdu: number;
  axisError: number;
  halfspaceErrorLdu: number;
}>;
type Cap = {
  rotorId: string;
  supportId: string;
  rotor: RAPIER.RigidBody;
  support: RAPIER.RigidBody;
  center: Vec3;
  rotorAnchor: Vec3;
  supportAnchor: Vec3;
  axis: Vec3;
  span: readonly [number, number];
  side: 0 | 1;
  rotorPoints: Vec3[];
  supportPoints: Vec3[];
  joint?: RAPIER.ImpulseJoint;
  current?: WinchCapState;
  predicted?: WinchCapState;
};

/** Four unilateral source shoulder reactions, separate from shaft bearings.
 * No radial or angular axis is locked, no axial shaft grip is introduced and
 * no contact hook is installed. Ordinary admission still needs the caller's
 * actual collider binding and the remaining fit/contact policies. */
export class NativeWinchCapConstraints {
  private caps: Cap[];
  private disposed = false;
  private work = 0;
  constructor(
    readonly world: RAPIER.World,
    readonly packet: SourceBoundWinchCollision,
    bodies: ReadonlyMap<string, RAPIER.RigidBody>,
  ) {
    ensure(
      isSourceBoundWinchCollision(packet) && bodies.size === 29,
      "INVALID_INPUT",
      "Use the sealed actual-source winch collision packet and its 29 owners.",
    );
    const owners = new Map(packet.owners.map((o) => [o.occurrenceId, o])),
      handles = new Set<number>();
    for (const owner of packet.owners) {
      const body = bodies.get(owner.occurrenceId),
        expected = toPhysics(owner.frame.position);
      ensure(
        body &&
          body.isValid() &&
          world.bodies.get(body.handle) === body &&
          !handles.has(body.handle),
        "INVALID_INPUT",
        "Each winch source owner needs a distinct valid native body.",
      );
      const p = body.translation(),
        q = body.rotation();
      ensure(
        p.x === Math.fround(expected.x) &&
          p.y === Math.fround(expected.y) &&
          p.z === Math.fround(expected.z) &&
          q.x === 0 &&
          q.y === 0 &&
          q.z === 0 &&
          q.w === 1,
        "INVALID_INPUT",
        "Winch caps must bind the exact source-relative native rest.",
      );
      handles.add(body.handle);
    }
    this.caps = packet.rotorCaps.flatMap((source) => {
      const rotor = owners.get(source.occurrenceId)!;
      return source.supportIds.map((supportId, i): Cap => {
        const support = owners.get(supportId)!,
          side = i as 0 | 1,
          anchor = add(
            source.center as Vec3,
            scale(source.axis as Vec3, source.spanLdu[side]),
          );
        const points = (id: string) =>
          owners
            .get(id)!
            .regions.flatMap((r) =>
              r.points.map((p) => vec(toPhysics(p as Vec3))),
            );
        return {
          rotorId: source.occurrenceId,
          supportId,
          rotor: bodies.get(source.occurrenceId)!,
          support: bodies.get(supportId)!,
          center: vec(
            toPhysics(sub(source.center as Vec3, rotor.frame.position)),
          ),
          rotorAnchor: vec(toPhysics(sub(anchor, rotor.frame.position))),
          supportAnchor: vec(toPhysics(sub(anchor, support.frame.position))),
          axis: vec(toPhysicsDirection(source.axis as Vec3)),
          span: source.spanLdu,
          side,
          rotorPoints: points(source.occurrenceId),
          supportPoints: points(supportId),
        };
      });
    });
  }
  private state(c: Cap, dt: number): WinchCapState {
    const rotor = pose(c.rotor, dt),
      support = pose(c.support, dt),
      axis = rotate(rotor.rotation, c.axis),
      supportAxis = rotate(support.rotation, c.axis),
      center = worldPoint(rotor, c.center),
      delta = sub(
        worldPoint(support, c.supportAnchor),
        worldPoint(rotor, c.rotorAnchor),
      );
    let error = 0;
    for (const [points, p, isRotor] of [
      [c.rotorPoints, rotor, true],
      [c.supportPoints, support, false],
    ] as const) {
      for (const point of points) {
        const station = dot(sub(worldPoint(p, point), center), axis) / 0.02;
        error = Math.max(
          error,
          isRotor
            ? Math.max(c.span[0] - station, station - c.span[1])
            : c.side === 0
              ? station - c.span[0]
              : c.span[1] - station,
        );
      }
    }
    return Object.freeze({
      radialErrorLdu:
        Math.hypot(...sub(delta, scale(axis, dot(delta, axis)))) / 0.02,
      axisError: Math.hypot(...sub(axis, supportAxis)),
      halfspaceErrorLdu: error,
    });
  }
  private within(s: WinchCapState) {
    return (
      s.radialErrorLdu <= WINCH_CAP_ENVELOPE.radialLdu &&
      s.axisError <= WINCH_CAP_ENVELOPE.axis &&
      s.halfspaceErrorLdu <= WINCH_CAP_ENVELOPE.separationLdu
    );
  }
  /** Charge all complete current/predicted geometry scans to the caller's
   * existing enumeration budget before doing them. Failure removes every cap
   * certificate and limit; responding source/foreign contacts remain intact.
   * Call again after impulses if the shared solver changed predicted motion. */
  beginStep(dt: number, charge: (points: number) => void) {
    ensure(
      !this.disposed && Number.isFinite(dt) && dt > 0 && dt <= 0.1,
      "INVALID_INPUT",
      "Use an active cap graph and bounded fixed step.",
    );
    this.work =
      2 *
      this.caps.reduce(
        (s, c) => s + c.rotorPoints.length + c.supportPoints.length,
        0,
      );
    try {
      charge(this.work);
      ensure(
        this.caps.every((c) => c.rotor.isValid() && c.support.isValid()),
        "INVALID_INPUT",
        "A source cap owner was removed.",
      );
    } catch (error) {
      this.release();
      throw error;
    }
    for (const c of this.caps) {
      c.current = this.state(c, 0);
      c.predicted = this.state(c, dt);
      const active = this.within(c.current) && this.within(c.predicted);
      if (!active && c.joint) {
        this.world.removeImpulseJoint(c.joint, true);
        c.joint = undefined;
      }
      if (active && !c.joint) {
        c.joint = this.world.createImpulseJoint(
          RAPIER.JointData.generic(
            obj(c.supportAnchor),
            obj(c.rotorAnchor),
            obj(c.axis),
            // No locked axes. Rapier's bitmask enum lacks a named zero member.
            0 as RAPIER.JointAxesMask,
          ),
          c.support,
          c.rotor,
          true,
        );
        c.joint.setContactsEnabled(true);
        const limit = new RAPIER.PrismaticImpulseJoint(
          this.world.impulseJoints.raw,
          this.world.bodies,
          c.joint.handle,
        );
        // ±1e6 m is a numerical domain, never a source stop on the free side.
        limit.setLimits(
          c.side === 0 ? 0 : -1_000_000,
          c.side === 0 ? 1_000_000 : 0,
        );
      }
    }
  }
  snapshot() {
    return {
      ordinaryAdmission: false as const,
      enumeratedPoints: this.work,
      caps: this.caps.map((c) => ({
        rotorId: c.rotorId,
        supportId: c.supportId,
        side: c.side,
        active: !!c.joint,
        current: c.current,
        predicted: c.predicted,
      })),
    };
  }
  private release() {
    for (const c of this.caps) {
      if (c.joint?.isValid()) this.world.removeImpulseJoint(c.joint, true);
      c.joint = undefined;
      c.current = undefined;
      c.predicted = undefined;
    }
  }
  dispose() {
    if (this.disposed) return;
    this.release();
    this.disposed = true;
  }
}
