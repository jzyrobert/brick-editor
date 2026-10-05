import type RAPIER from "@dimforge/rapier3d-compat";
import { ensure, type Vec3 } from "../core/types";
import { TRANSMISSION_MAX_SPEED } from "./transmissions";

export const ANGULAR_EQUATION_LIMITS = Object.freeze({
  ports: 300,
  equations: 100,
  passes: 8,
  maxTorqueNm: 10_000,
});
export type AngularPort = {
  id: string;
  body: RAPIER.RigidBody;
  carrier: RAPIER.RigidBody;
  /** Unit axis in the native carrier's local frame, including LDraw->native conversion. */
  axisLocal: Vec3;
};
export type AngularEquation = {
  id: string;
  terms: readonly { portId: string; coefficient: number }[];
  /** One to three carrier-relative ports. A one-port row locks only the
   * shaft/bore relative twist and reacts on BOTH bodies; it is not a fixed
   * world angle or an axial attachment. Source admission belongs to caller.
   * Sum(coefficients * measured relative radians) = phaseRadians. */
  phaseRadians?: number;
  enabled?: boolean;
  /** Ideal constraint reaction cap, separate from motor torque and friction. */
  maxTorqueNm?: number;
};
type Q = { x: number; y: number; z: number; w: number };
type V = { x: number; y: number; z: number };
const dot = (a: V, b: V) => a.x * b.x + a.y * b.y + a.z * b.z;
const scale = (a: V, k: number): V => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const add = (a: V, b: V): V => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const negative = (q: Q): Q => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
const product = (a: Q, b: Q): Q => ({
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
});
const rotate = (q: Q, v: V): V =>
  product(product(q, { ...v, w: 0 }), negative(q));
const vector = (v: Vec3): V => ({ x: v[0], y: v[1], z: v[2] });
const clamp = (x: number, m: number) => Math.max(-m, Math.min(m, x));
const wrap = (x: number) =>
  ((((x + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
const validId = (id: string) =>
  typeof id === "string" &&
  id.length > 0 &&
  id.length <= 128 &&
  !["__proto__", "prototype", "constructor"].includes(id);
type PortState = AngularPort & {
  axis: V;
  restInverse: Q;
  raw: number;
  radians: number;
  worldAxis: V;
};
type PreparedEquation = {
  e: EquationState;
  j: { body: RAPIER.RigidBody; axis: V }[];
  error: number;
  calls: number;
};
type EquationState = {
  id: string;
  terms: { port: PortState; coefficient: number }[];
  phase: number;
  enabled: boolean;
  maxTorque: number;
  impulse: number;
  limited: boolean;
};

/** Native ideal angular constraint kernel. Source/connection admission belongs to
 * the caller's reviewed graph: this class cannot authorize an arbitrary joint.
 * Measures true carrier-relative twist and velocity; merged body Jacobians return
 * torque to every shaft AND carrier. Never poses, teleports or sets velocities.
 * Neutral equations apply nothing. Worm self-locking/friction is not invented.
 * Invoke once per fixed step at the same stage as existing transmission solving. */
export class AngularEquationSolver {
  private ports = new Map<string, PortState>();
  private equations = new Map<string, EquationState>();
  private prepared = new Map<string, PreparedEquation>();
  private timestep = 0;
  constructor(
    ports: readonly AngularPort[],
    equations: readonly AngularEquation[],
  ) {
    ensure(
      ports.length <= ANGULAR_EQUATION_LIMITS.ports &&
        equations.length <= ANGULAR_EQUATION_LIMITS.equations,
      "LIMIT_EXCEEDED",
      "Angular equation budget exceeded.",
    );
    for (const port of ports) {
      ensure(
        validId(port.id) &&
          !this.ports.has(port.id) &&
          port.body !== port.carrier &&
          port.body.isValid() &&
          port.carrier.isValid() &&
          port.axisLocal.length === 3 &&
          port.axisLocal.every(Number.isFinite) &&
          Math.abs(Math.hypot(...port.axisLocal) - 1) < 1e-8,
        "INVALID_INPUT",
        "Invalid angular port or native axis.",
      );
      const axis = vector(port.axisLocal),
        relative = product(
          negative(port.carrier.rotation()),
          port.body.rotation(),
        );
      this.ports.set(port.id, {
        ...port,
        axisLocal: [...port.axisLocal],
        axis,
        restInverse: negative(relative),
        raw: 0,
        radians: 0,
        worldAxis: rotate(port.carrier.rotation(), axis),
      });
    }
    for (const equation of equations) {
      ensure(
        validId(equation.id) &&
          !this.equations.has(equation.id) &&
          equation.terms.length >= 1 &&
          equation.terms.length <= 3 &&
          new Set(equation.terms.map((t) => t.portId)).size ===
            equation.terms.length &&
          equation.terms.every(
            (t) =>
              this.ports.has(t.portId) &&
              Number.isFinite(t.coefficient) &&
              Math.abs(t.coefficient) >= 1e-6 &&
              Math.abs(t.coefficient) <= 256,
          ),
        "INVALID_INPUT",
        "Invalid signed angular equation.",
      );
      const phase = equation.phaseRadians ?? 0,
        maxTorque = equation.maxTorqueNm ?? ANGULAR_EQUATION_LIMITS.maxTorqueNm;
      ensure(
        Number.isFinite(phase) &&
          Math.abs(phase) <= 1e9 &&
          Number.isFinite(maxTorque) &&
          maxTorque > 0 &&
          maxTorque <= ANGULAR_EQUATION_LIMITS.maxTorqueNm &&
          (equation.enabled === undefined ||
            typeof equation.enabled === "boolean"),
        "INVALID_INPUT",
        "Invalid angular equation phase or reaction cap.",
      );
      this.equations.set(equation.id, {
        id: equation.id,
        terms: equation.terms.map((t) => ({
          port: this.ports.get(t.portId)!,
          coefficient: t.coefficient,
        })),
        phase,
        enabled: equation.enabled ?? true,
        maxTorque,
        impulse: 0,
        limited: false,
      });
    }
  }
  /** Caller supplies a newly reviewed indexed phase when a clutch engages.
   * Retain it while engaged; disabling neutral never freezes either shaft. */
  setEnabled(id: string, enabled: boolean, phaseRadians?: number) {
    const equation = this.equations.get(id);
    ensure(
      equation &&
        typeof enabled === "boolean" &&
        (phaseRadians === undefined ||
          (Number.isFinite(phaseRadians) && Math.abs(phaseRadians) <= 1e9)),
      "INVALID_INPUT",
      "Invalid conditional angular equation.",
    );
    equation.enabled = enabled;
    if (phaseRadians !== undefined) equation.phase = phaseRadians;
    // An engagement change cannot reuse a previous phase/Jacobian snapshot.
    this.prepared.clear();
    this.timestep = 0;
  }
  private measure() {
    for (const port of this.ports.values()) {
      ensure(
        port.body.isValid() && port.carrier.isValid(),
        "INVALID_INPUT",
        "Angular port native body was removed.",
      );
      const relative = product(
          negative(port.carrier.rotation()),
          port.body.rotation(),
        ),
        delta = product(relative, port.restInverse);
      const projection = dot(delta, port.axis);
      ensure(
        Math.hypot(projection, delta.w) > 1e-8,
        "INVALID_INPUT",
        "Angular coordinate has an unsupported swing singularity.",
      );
      const raw = wrap(2 * Math.atan2(projection, delta.w)),
        change = wrap(raw - port.raw);
      ensure(
        Math.abs(change) <= Math.PI / 3 + 1e-5,
        "LIMIT_EXCEEDED",
        "Angular coordinate exceeded the existing 60 degree fixed-step limit.",
      );
      port.radians += change;
      port.raw = raw;
      port.worldAxis = rotate(port.carrier.rotation(), port.axis);
    }
  }
  private jacobians(equation: EquationState) {
    const result = new Map<number, { body: RAPIER.RigidBody; axis: V }>();
    const merge = (body: RAPIER.RigidBody, axis: V) => {
      const previous = result.get(body.handle);
      result.set(body.handle, {
        body,
        axis: previous ? add(previous.axis, axis) : axis,
      });
    };
    for (const term of equation.terms) {
      const axis = scale(term.port.worldAxis, term.coefficient);
      merge(term.port.body, axis);
      merge(term.port.carrier, scale(axis, -1));
    }
    return [...result.values()];
  }
  /** Begin once per fixed tick. solveEquation permits the caller to retain the
   * existing mixed angular/rack equation ordering inside each of eight passes. */
  beginStep(dt: number) {
    ensure(
      Number.isFinite(dt) && dt > 0 && dt <= 0.1,
      "INVALID_INPUT",
      "Use a bounded fixed timestep for angular equations.",
    );
    this.measure();
    this.timestep = dt;
    this.prepared.clear();
    for (const e of this.equations.values()) {
      e.impulse = 0;
      e.limited = false;
      this.prepared.set(e.id, {
        e,
        j: e.enabled ? this.jacobians(e) : [],
        error:
          e.terms.reduce((sum, t) => sum + t.coefficient * t.port.radians, 0) -
          e.phase,
        calls: 0,
      });
    }
  }
  solveEquation(id: string) {
    const prepared = this.prepared.get(id);
    ensure(
      prepared && this.timestep > 0,
      "INVALID_INPUT",
      "Begin the angular equation step first.",
    );
    ensure(
      prepared.calls++ < ANGULAR_EQUATION_LIMITS.passes,
      "LIMIT_EXCEEDED",
      "Angular equation pass budget exceeded.",
    );
    const { e, j, error } = prepared;
    if (!e.enabled) return;
    let inverseMass = 0,
      speed = 0,
      maxJacobian = 0;
    for (const { body, axis } of j) {
      const m = body.effectiveWorldInvInertia();
      inverseMass += dot(axis, {
        x: m.m11 * axis.x + m.m12 * axis.y + m.m13 * axis.z,
        y: m.m21 * axis.x + m.m22 * axis.y + m.m23 * axis.z,
        z: m.m31 * axis.x + m.m32 * axis.y + m.m33 * axis.z,
      });
      speed += dot(body.angvel(), axis);
      maxJacobian = Math.max(maxJacobian, Math.hypot(axis.x, axis.y, axis.z));
    }
    ensure(
      [inverseMass, speed, error].every(Number.isFinite),
      "INVALID_INPUT",
      "Angular equation native state is non-finite.",
    );
    if (inverseMass <= 1e-12 || maxJacobian === 0) return;
    const correction = clamp(
      (0.8 * error) / this.timestep,
      (TRANSMISSION_MAX_SPEED * Math.PI) / 180,
    );
    const wanted = -(speed + correction) / inverseMass,
      limit = (e.maxTorque * this.timestep) / maxJacobian;
    const next = clamp(e.impulse + wanted, limit),
      impulse = next - e.impulse;
    e.limited ||= Math.abs(next - (e.impulse + wanted)) > 1e-12;
    e.impulse = next;
    if (Math.abs(impulse) < 1e-10) return;
    for (const { body, axis } of j)
      body.applyTorqueImpulse(scale(axis, impulse), true);
  }
  solvePass() {
    ensure(
      this.timestep > 0,
      "INVALID_INPUT",
      "Begin the angular equation step first.",
    );
    for (const id of this.prepared.keys()) this.solveEquation(id);
  }
  solve(dt: number) {
    this.beginStep(dt);
    for (let pass = 0; pass < ANGULAR_EQUATION_LIMITS.passes; pass++)
      this.solvePass();
  }
  /** Read-only diagnostics; does not advance the coordinate tracker. */
  snapshot() {
    return {
      ports: Object.fromEntries(
        [...this.ports].map(([id, p]) => [
          id,
          {
            radians: p.radians,
            speedRadiansPerSecond:
              dot(p.body.angvel(), p.worldAxis) -
              dot(p.carrier.angvel(), p.worldAxis),
          },
        ]),
      ),
      equations: Object.fromEntries(
        [...this.equations].map(([id, e]) => [
          id,
          {
            enabled: e.enabled,
            phaseRadians: e.phase,
            currentPhaseRadians: e.terms.reduce(
              (s, t) => s + t.coefficient * t.port.radians,
              0,
            ),
            impulseNmSeconds: e.impulse,
            reactionLimited: e.limited,
          },
        ]),
      ),
    };
  }
}
