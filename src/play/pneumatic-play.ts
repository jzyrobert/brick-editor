import RAPIER from "@dimforge/rapier3d-compat";
import { compose, inverse } from "../core/math";
import { AppError, ensure, type Transform } from "../core/types";
import {
  NativePneumaticCircuit,
  type PneumaticValveState,
} from "../mechanisms/pneumatic-circuit";
import { createSourcePneumaticCylinder } from "./pneumatic-cylinder-native";
import { createSourcePneumaticPump } from "./pneumatic-pump-native";
import {
  PNEUMATIC_PLAY_PROFILE,
  type PreparedPneumaticPlay,
} from "./pneumatic-play-source";
import { basisFromRotation, fromPhysics } from "./physics-frame";
import type {
  PlayMechanismReport,
  PlayPneumaticReport,
  PlayPneumaticRequest,
} from "./types";

/**
 * Declared simulation settings of ordinary pneumatic Play (gameplay scale,
 * 0.02 m/LDU). They are not measured LEGO ratings. Rod masses are heavier
 * than real plastic so that the ideal isothermal gas spring stays stable at
 * the fixed 60 Hz step (ω·dt < 1 for the stiffest trapped chamber); the
 * hidden seal is modelled as a small Coulomb friction plus light damping.
 */
export const PNEUMATIC_PLAY_SETTINGS = Object.freeze({
  pumpRodMassKg: 5,
  cylinderRodMassKg: 20,
  /** Most a hand pushes or pulls on the pump rod, simulation newtons. */
  handForceN: 150,
  /** Comfortable stroke speed of that hand, metres/second (100 LDU/s). */
  handPaceMetresPerSecond: 2,
  /** Hand speed-tracking gain, N per (m/s). */
  handGain: 150,
  /** How quickly the hand presses harder against resisting air, N per m. */
  handGrip: 600,
  /** Seal friction on every rod guide, simulation newtons. */
  sealFrictionN: 5,
  /** Linear damping of each moving rod, 1/second. */
  rodDampingPerSecond: 1,
  /** Gas held by each port's tube and fitting, cubic metres. */
  lineVolumeM3: 0.01,
  /** Gas left in a pump chamber at the end of its stroke, cubic metres. */
  pumpDeadVolumeM3: 0.004,
  /** Most pressure force a cylinder transmits, simulation newtons. */
  cylinderForceLimitN: 1000,
});
const S = PNEUMATIC_PLAY_SETTINGS;
const DT = 1 / 60;
/** Reviewed pump stroke coordinate: 0 pulled out .. 0.8 m pushed in. */
const PUMP_STROKE = { out: 0.01, in: 0.79, turnIn: 0.75, turnOut: 0.05 };
const STALL_TICKS = 30;
type Pump = {
  id: string;
  rigGroup: string;
  native: ReturnType<typeof createSourcePneumaticPump>;
  pumping: boolean;
  direction: 1 | -1;
  strokes: number;
  stalledTicks: number;
  /** Extra push the hand adds while the air resists, fraction of its limit. */
  effort: number;
  stalled: boolean;
  previous: number;
};
type Cylinder = {
  id: string;
  rigGroup: string;
  native: ReturnType<typeof createSourcePneumaticCylinder>;
};
type Moving = {
  groupId: string;
  body: RAPIER.RigidBody;
  rest: Transform;
  /** Group frame and leaves relative to the rod's native rest pose. */
  frame: Transform;
  leaves: Array<[string, Transform]>;
};

/** Native actors, gas circuit and hand/valve inputs of one admitted circuit. */
export class PlayPneumaticSystem {
  readonly rigId: string;
  private readonly circuit: NativePneumaticCircuit;
  private readonly pumps: Pump[] = [];
  private readonly cylinders: Cylinder[] = [];
  private readonly valves: PreparedPneumaticPlay["valves"];
  private readonly states = new Map<string, PneumaticValveState>();
  private readonly moving: Moving[] = [];
  private readonly frames: Record<string, Transform> = {};
  private readonly supplyPorts: string[];
  private tick = 0;
  private fault?: string;
  private last?: ReturnType<NativePneumaticCircuit["snapshot"]>;
  private disposed = false;
  constructor(
    world: RAPIER.World,
    private readonly prepared: PreparedPneumaticPlay,
    private readonly revision: number,
  ) {
    const { candidate, topology } = prepared;
    this.rigId = candidate.rig.id;
    this.valves = prepared.valves.map((v) => ({ ...v }));
    for (const group of candidate.rig.groups)
      this.frames[group.id] = structuredClone(group.frame);
    try {
      for (const [i, p] of prepared.pumps.entries()) {
        const native = createSourcePneumaticPump(p.token, world, {
          massKg: S.pumpRodMassKg,
          maxForceN: S.handForceN,
        });
        this.pumps.push({
          id: candidate.pumps[i].owners[0],
          rigGroup: candidate.pumps[i].rodGroup,
          native,
          pumping: false,
          direction: 1,
          strokes: 0,
          stalledTicks: 0,
          effort: 0,
          stalled: false,
          previous: 0,
        });
      }
      for (const [i, c] of prepared.cylinders.entries())
        this.cylinders.push({
          id: c.id,
          rigGroup: candidate.cylinders[i].rodGroup,
          native: createSourcePneumaticCylinder(c.token, world, {
            massKg: S.cylinderRodMassKg,
            maxForceN: S.cylinderForceLimitN,
          }),
        });
      for (const actor of [...this.pumps, ...this.cylinders]) {
        const { rod } = actor.native,
          joint = actor.native.joint as RAPIER.PrismaticImpulseJoint;
        joint.configureMotorModel(RAPIER.MotorModel.ForceBased);
        joint.setMotorMaxForce(S.sealFrictionN);
        joint.configureMotorVelocity(0, 1);
        rod.setLinearDamping(S.rodDampingPerSecond);
      }
      const chamber = (id: string) => `${id}:chamber`;
      this.circuit = new NativePneumaticCircuit({
        nodes: [
          ...topology.ports.map((p) => ({
            id: p.id,
            volumeM3: S.lineVolumeM3,
          })),
          ...this.pumps.map((p) => ({
            id: chamber(p.id),
            volumeM3: S.pumpDeadVolumeM3,
          })),
        ],
        passages: topology.passages,
        valves: topology.valves,
        cylinders: this.cylinders.map((c) => {
          const t = topology.cylinders.find((t) => t.id === c.id)!;
          return c.native.cylinder(c.id, t.base, t.cap);
        }),
        pumps: this.pumps.map((p, i) =>
          p.native.pump(p.id, chamber(p.id), prepared.pumps[i].portId),
        ),
      });
      this.supplyPorts = prepared.pumps.map((p) => p.portId);
      for (const v of topology.valves) this.states.set(v.id, "neutral");
      const snapshot = this.circuit.snapshot();
      for (const p of this.pumps) p.previous = snapshot.strokesM[p.id];
      this.last = snapshot;
      const groups = new Map(candidate.rig.groups.map((g) => [g.id, g]));
      for (const actor of [...this.pumps, ...this.cylinders]) {
        const group = groups.get(actor.rigGroup)!,
          rest = this.pose(actor.native.rod);
        this.moving.push({
          groupId: group.id,
          body: actor.native.rod,
          rest,
          frame: compose(inverse(rest), group.frame),
          leaves: Object.entries(group.restTransforms).map(([id, t]) => [
            id,
            compose(inverse(rest), t),
          ]),
        });
      }
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
  /** LDraw frame of a native body (rest rotation is the source basis). */
  private pose(body: RAPIER.RigidBody): Transform {
    return {
      position: fromPhysics(body.translation()),
      basis: basisFromRotation(body.rotation()),
    };
  }
  /** Session controls: hold the pump and set valves by rod effect. */
  control(request: PlayPneumaticRequest) {
    ensure(!this.disposed, "INVALID_INPUT", "The air circuit has stopped");
    ensure(
      request && typeof request === "object",
      "INVALID_INPUT",
      "Choose a pump or valve setting",
    );
    if (request.pumping !== undefined) {
      ensure(
        typeof request.pumping === "boolean",
        "INVALID_INPUT",
        "pumping must be true or false",
      );
      const pumps = request.pumpId
        ? this.pumps.filter((p) => p.id === request.pumpId)
        : this.pumps;
      ensure(pumps.length, "INVALID_INPUT", "Unknown pump");
      for (const p of pumps) {
        if (request.pumping && !p.pumping) {
          p.stalled = false;
          p.stalledTicks = 0;
        }
        p.pumping = request.pumping;
      }
    }
    for (const [id, position] of Object.entries(request.valves ?? {})) {
      const valve = this.valves.find((v) => v.id === id);
      ensure(valve, "INVALID_INPUT", "Unknown valve");
      ensure(
        ["out", "hold", "in"].includes(position),
        "INVALID_INPUT",
        "Valve positions are out, hold or in",
      );
      ensure(
        position === "hold" || valve.out,
        "INVALID_INPUT",
        "This valve does not drive a cylinder",
      );
      const state: PneumaticValveState =
        position === "hold"
          ? "neutral"
          : position === "out"
            ? valve.out!
            : valve.out === "extend"
              ? "retract"
              : "extend";
      this.circuit.setValve(id, state);
      this.states.set(id, state);
    }
  }
  /** Releases every hand and closes every valve (pause, close, exit). */
  release() {
    for (const p of this.pumps) p.pumping = false;
  }
  /** Hand input, gas step and seal checks, before one native world step. */
  beforeStep() {
    ensure(!this.disposed, "INVALID_INPUT", "The air circuit has stopped");
    let snapshot: ReturnType<NativePneumaticCircuit["snapshot"]>;
    try {
      snapshot = this.circuit.snapshot();
    } catch (error) {
      // A rod knocked out of its reviewed guide (beyond the kernel's 1 mm
      // alignment band) holds its air and gets no hand force until the
      // native joint brings it back; contacts keep responding meanwhile.
      this.fault = this.faultText(error);
      for (const p of this.pumps) p.native.setManualInput(0);
      for (const p of this.pumps) p.native.beforeStep(DT);
      for (const c of this.cylinders) c.native.beforeStep(DT);
      return;
    }
    for (const p of this.pumps) {
      const x = snapshot.strokesM[p.id],
        velocity = (x - p.previous) / DT;
      p.previous = x;
      if (!p.pumping) {
        p.native.setManualInput(0);
        p.effort = 0;
        continue;
      }
      if (p.direction > 0 && x > PUMP_STROKE.turnIn) {
        p.direction = -1;
        p.strokes++;
        p.stalled = false;
        p.effort = 0;
      } else if (p.direction < 0 && x < PUMP_STROKE.turnOut) {
        p.direction = 1;
        p.effort = 0;
      }
      // The hand aims for a comfortable pace, easing off near each end, and
      // presses harder (up to its limit) while the air resists.
      const room = p.direction > 0 ? PUMP_STROKE.in - x : x - PUMP_STROKE.out,
        target =
          p.direction *
          Math.min(S.handPaceMetresPerSecond, 3 * Math.max(0, room)),
        error = target - velocity;
      p.effort = Math.max(
        -1,
        Math.min(1, p.effort + (S.handGrip * error * DT) / S.handForceN),
      );
      const input = Math.max(
        -1,
        Math.min(1, (S.handGain * error) / S.handForceN + p.effort),
      );
      // A hand pressing as hard as it can without progress turns round:
      // pushing, it has met the circuit's pressure (a stall); pulling, the
      // rod's own gasket has reached the cap.
      if (p.direction * input >= 0.999 && p.direction * velocity < 0.05) {
        if (++p.stalledTicks >= STALL_TICKS) {
          if (p.direction > 0) p.stalled = true;
          p.stalledTicks = 0;
          p.direction = p.direction > 0 ? -1 : 1;
          p.effort = 0;
        }
      } else p.stalledTicks = 0;
      p.native.setManualInput(input);
    }
    try {
      this.circuit.step(DT);
      this.fault = undefined;
      for (const p of this.pumps) p.native.applyManualForce(DT);
    } catch (error) {
      // The kernel refuses atomically: no gas or impulse changed this tick.
      this.fault = this.faultText(error);
    }
    for (const p of this.pumps) p.native.beforeStep(DT);
    for (const c of this.cylinders) c.native.beforeStep(DT);
  }
  private faultText(error: unknown) {
    const message = error instanceof AppError ? error.message : "";
    if (/left its admitted guide/.test(message))
      return "A rod was knocked out of line. The air waits until it settles.";
    return message || "The air circuit paused for a moment.";
  }
  /** Only the exact sealed shaft/body pairs may pass; all else responds. */
  contactAllowed(a: number, b: number) {
    for (const p of this.pumps)
      if (!p.native.contactAllowed(a, b)) return false;
    for (const c of this.cylinders)
      if (!c.native.contactAllowed(a, b)) return false;
    return true;
  }
  afterStep() {
    this.tick++;
    try {
      this.last = this.circuit.snapshot();
    } catch (error) {
      this.fault = this.faultText(error);
    }
    for (const m of this.moving) this.frames[m.groupId] = this.movingFrame(m);
  }
  private movingFrame(m: Moving) {
    return compose(this.pose(m.body), m.frame);
  }
  /** Rod poses relative to their rest pose, for walking-world mirrors. */
  movingPoses() {
    return Object.fromEntries(
      this.moving.map((m) => [m.groupId, this.pose(m.body)]),
    );
  }
  restPoses() {
    return Object.fromEntries(this.moving.map((m) => [m.groupId, m.rest]));
  }
  /** Native rod bodies by group, for bounded walking pushes. */
  movingBodies() {
    return new Map(this.moving.map((m) => [m.groupId, m.body]));
  }
  private pneumaticReport(): PlayPneumaticReport {
    const snap = this.last!;
    const gauge = (id: string) =>
      Math.max(0, (snap.pressuresPa[id] ?? 101325) - this.circuit.atmospherePa);
    const handLimitPa =
      S.handForceN / (8 * 8 ** 2 * Math.sin(Math.PI / 8) * 0.02 ** 2);
    const supply = Math.max(...this.supplyPorts.map(gauge));
    return {
      profile: PNEUMATIC_PLAY_PROFILE,
      pumps: this.pumps.map((p) => ({
        id: p.id,
        pumping: p.pumping,
        strokes: p.strokes,
        status: !p.pumping ? "idle" : p.stalled ? "stalled" : "pumping",
        pushedIn: Math.max(0, Math.min(1, snap.strokesM[p.id] / 0.8)),
      })),
      pressure: {
        supplyGaugePa: supply,
        level: Math.max(0, Math.min(1, supply / handLimitPa)),
      },
      valves: this.valves.map((v) => {
        const state = this.states.get(v.id)!;
        return {
          id: v.id,
          ...(v.cylinderId ? { cylinderId: v.cylinderId } : {}),
          position:
            state === "neutral" ? "hold" : state === v.out ? "out" : "in",
        };
      }),
      cylinders: this.cylinders.map((c) => {
        const x = snap.strokesM[c.id],
          v = c.native.rod.linvel();
        return {
          id: c.id,
          extension: Math.max(0, Math.min(1, x / 2.6)),
          extensionLdu: x / 0.02,
          strokeLdu: 130,
          moving: Math.hypot(v.x, v.y, v.z) / 0.02 > 1,
        };
      }),
    };
  }
  snapshot(): PlayMechanismReport {
    const transforms: Record<string, Transform> = {};
    for (const m of this.moving) {
      const pose = this.pose(m.body);
      for (const [id, relative] of m.leaves)
        transforms[id] = compose(pose, relative);
    }
    const bodies: NonNullable<PlayMechanismReport["dynamics"]>["bodies"] = {};
    for (const m of this.moving) {
      const v = m.body.linvel(),
        w = m.body.angvel();
      bodies[m.groupId] = {
        anchored: false,
        massKg: m.body.mass(),
        colliders: m.body.numColliders(),
        sleeping: m.body.isSleeping(),
        linearVelocity: fromPhysics(v),
        angularSpeed: (Math.hypot(w.x, w.y, w.z) * 180) / Math.PI,
      };
    }
    return {
      sourceRevision: this.revision,
      rigId: this.rigId,
      tick: this.tick,
      simulationHz: 60,
      mode: "dynamic",
      units: "LDU",
      scaleMetresPerLdu: 0.02,
      pose: { jointPositions: {} },
      groupFrames: structuredClone(this.frames),
      transforms,
      jointTargets: {},
      dynamics: {
        engine: "rapier3d-compat 0.21.0",
        gravity: 9.81,
        bodies,
      },
      pneumatic: this.pneumaticReport(),
      blocked: !!this.fault,
      ...(this.fault ? { blockedReason: this.fault } : {}),
      warnings: [
        "Pneumatics: only the pump and cylinder rods move, inside their reviewed source guides. Pump cases, cylinder bodies, valves and tubes stay where the build puts them; no pivot, tube flex or chassis attachment is simulated.",
        "Ideal isothermal air with instant flow through open lines and check valves. Rod masses, hand force, seal friction and line volumes are declared simulation settings, not measured LEGO ratings.",
      ],
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const p of this.pumps) p.native.dispose();
    for (const c of this.cylinders) c.native.dispose();
  }
}
