import type RAPIER from "@dimforge/rapier3d-compat";
import { ensure, type Vec3 } from "../core/types";

/** Ideal isothermal, instantaneous open-line equalization. This native engine
 * primitive supplies neither source-part admission nor measured LEGO ratings.
 * All geometry is SI at the native boundary; source capture owns conversion. */
export const PNEUMATIC_LIMITS = Object.freeze({
  nodes: 128,
  passages: 256,
  valves: 16,
  cylinders: 16,
  pumps: 8,
  pressurePa: 10_000_000,
  forceN: 100_000,
  alignmentMetres: 0.001,
});
export type PneumaticNode = {
  id: string;
  /** Line/dead volume. Native chamber volume is added to this every tick. */
  volumeM3: number;
  initialPressurePa?: number;
};
export type PneumaticValve = {
  id: string;
  supply: string;
  workA: string;
  workB: string;
};
export type PneumaticValveState = "neutral" | "extend" | "retract";
export type NativePneumaticStroke = {
  id: string;
  body: RAPIER.RigidBody;
  rod: RAPIER.RigidBody;
  anchorBody: Vec3;
  anchorRod: Vec3;
  axisBody: Vec3;
  /** Anchor separation at the zero-stroke stop, in metres. */
  restSeparationM: number;
  strokeM: number;
  maxForceN: number;
};
export type NativePneumaticCylinder = NativePneumaticStroke & {
  base: string;
  cap: string;
  areaBaseM2: number;
  areaCapM2: number;
};
export type NativePneumaticPump = NativePneumaticStroke & {
  chamber: string;
  outlet: string;
  areaM2: number;
  /** Source pump admission can require actual pressure reaction to remain
   * inside its native effort envelope, rather than clip resistance while
   * silently continuing chamber compression. Engineering callers default off. */
  requireUnclippedReaction?: boolean;
};
type Sample = {
  stroke: number;
  axis: RAPIER.Vector;
  bodyAnchor: RAPIER.Vector;
  rodAnchor: RAPIER.Vector;
};
function rotate(body: RAPIER.RigidBody, p: Vec3): RAPIER.Vector {
  const q = body.rotation(),
    t = {
      x: 2 * (q.y * p[2] - q.z * p[1]),
      y: 2 * (q.z * p[0] - q.x * p[2]),
      z: 2 * (q.x * p[1] - q.y * p[0]),
    };
  return {
    x: p[0] + q.w * t.x + q.y * t.z - q.z * t.y,
    y: p[1] + q.w * t.y + q.z * t.x - q.x * t.z,
    z: p[2] + q.w * t.z + q.x * t.y - q.y * t.x,
  };
}
function worldPoint(body: RAPIER.RigidBody, local: Vec3) {
  const r = rotate(body, local),
    p = body.translation();
  return { x: p.x + r.x, y: p.y + r.y, z: p.z + r.z };
}
function sample(port: NativePneumaticStroke): Sample {
  ensure(
    port.body.isValid() && port.rod.isValid(),
    "INVALID_INPUT",
    "Pneumatic bodies are no longer available",
  );
  const axis = rotate(port.body, port.axisBody),
    a = worldPoint(port.body, port.anchorBody),
    b = worldPoint(port.rod, port.anchorRod),
    d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z },
    along = d.x * axis.x + d.y * axis.y + d.z * axis.z,
    raw = along - port.restSeparationM;
  ensure(
    Number.isFinite(raw) &&
      Math.hypot(
        d.x - along * axis.x,
        d.y - along * axis.y,
        d.z - along * axis.z,
      ) <= PNEUMATIC_LIMITS.alignmentMetres &&
      raw >= -PNEUMATIC_LIMITS.alignmentMetres &&
      raw <= port.strokeM + PNEUMATIC_LIMITS.alignmentMetres,
    "INVALID_INPUT",
    "The pneumatic rod left its admitted guide or travel stops",
  );
  return {
    stroke: Math.max(0, Math.min(port.strokeM, raw)),
    axis,
    bodyAnchor: a,
    rodAnchor: b,
  };
}
const positive = (n: number, max: number) =>
  Number.isFinite(n) && n > 0 && n <= max;
const vector = (p: Vec3) =>
  Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const identifier = (id: string) =>
  typeof id === "string" && id.length > 0 && id.length <= 256;

/** A closed-center, double-acting circuit coupled to actual native coordinates.
 * Pumps have ideal inlet/outlet check valves; their chamber compression, not a
 * commanded pressure, supplies gas. Neutral closes each valve's three ports.
 * No position/velocity is set and no guide, attachment or travel stop is invented. */
export class NativePneumaticCircuit {
  private readonly nodes = new Map<string, PneumaticNode>();
  private readonly charge = new Map<string, number>();
  private readonly states = new Map<string, PneumaticValveState>();
  private readonly passages: readonly (readonly [string, string])[];
  private readonly valves: readonly PneumaticValve[];
  private readonly cylinders: readonly NativePneumaticCylinder[];
  private readonly pumps: readonly NativePneumaticPump[];
  private gasFromAtmosphere = 0;
  private gasToAtmosphere = 0;
  constructor(config: {
    nodes: readonly PneumaticNode[];
    passages: readonly (readonly [string, string])[];
    valves?: readonly PneumaticValve[];
    cylinders?: readonly NativePneumaticCylinder[];
    pumps?: readonly NativePneumaticPump[];
    atmospherePa?: number;
  }) {
    this.atmospherePa = config.atmospherePa ?? 101_325;
    ensure(
      positive(this.atmospherePa, 1_000_000),
      "INVALID_INPUT",
      "Choose a bounded positive atmospheric pressure",
    );
    ensure(
      config.nodes.length > 0 &&
        config.nodes.length <= PNEUMATIC_LIMITS.nodes &&
        config.passages.length <= PNEUMATIC_LIMITS.passages &&
        (config.valves?.length ?? 0) <= PNEUMATIC_LIMITS.valves &&
        (config.cylinders?.length ?? 0) <= PNEUMATIC_LIMITS.cylinders &&
        (config.pumps?.length ?? 0) <= PNEUMATIC_LIMITS.pumps,
      "LIMIT_EXCEEDED",
      "The pneumatic circuit exceeds its bounded work budget",
    );
    for (const node of config.nodes) {
      ensure(
        identifier(node.id) &&
          !this.nodes.has(node.id) &&
          positive(node.volumeM3, 1) &&
          node.volumeM3 >= 1e-12 &&
          positive(
            node.initialPressurePa ?? this.atmospherePa,
            PNEUMATIC_LIMITS.pressurePa,
          ),
        "INVALID_INPUT",
        "Pneumatic nodes need unique IDs and bounded gas volumes/pressures",
      );
      this.nodes.set(node.id, { ...node });
    }
    this.passages = config.passages.map((p) => [...p] as [string, string]);
    this.valves = (config.valves ?? []).map((p) => ({ ...p }));
    const clone = <T extends NativePneumaticStroke>(p: T): T => ({
      ...p,
      anchorBody: [...p.anchorBody],
      anchorRod: [...p.anchorRod],
      axisBody: [...p.axisBody],
    });
    this.cylinders = (config.cylinders ?? []).map(clone);
    this.pumps = (config.pumps ?? []).map(clone);
    const have = (...ids: string[]) =>
      ids.every((id) => this.nodes.has(id)) && new Set(ids).size === ids.length;
    for (const p of this.passages)
      ensure(
        p.length === 2 && have(...p),
        "INVALID_INPUT",
        "Passages need two distinct gas nodes",
      );
    const ids = new Set<string>(),
      owned = new Set<string>();
    for (const valve of this.valves) {
      ensure(
        identifier(valve.id) &&
          !ids.has(valve.id) &&
          have(valve.supply, valve.workA, valve.workB),
        "INVALID_INPUT",
        "Valves need unique IDs and three distinct gas nodes",
      );
      ids.add(valve.id);
      this.states.set(valve.id, "neutral");
    }
    const own = (id: string) => {
      ensure(
        this.nodes.has(id) && !owned.has(id),
        "INVALID_INPUT",
        "Each pneumatic chamber must have one native owner",
      );
      owned.add(id);
    };
    for (const p of [...this.cylinders, ...this.pumps]) {
      ensure(
        identifier(p.id) &&
          !ids.has(p.id) &&
          p.body !== p.rod &&
          vector(p.anchorBody) &&
          vector(p.anchorRod) &&
          vector(p.axisBody) &&
          Math.abs(Math.hypot(...p.axisBody) - 1) <= 1e-8 &&
          Number.isFinite(p.restSeparationM) &&
          p.restSeparationM >= 0 &&
          p.restSeparationM <= 200 &&
          positive(p.strokeM, 200) &&
          positive(p.maxForceN, PNEUMATIC_LIMITS.forceN),
        "INVALID_INPUT",
        "Pneumatic strokes need distinct native bodies, bounded stops and a unit axis",
      );
      ids.add(p.id);
      sample(p);
    }
    for (const p of this.cylinders) {
      ensure(
        have(p.base, p.cap) &&
          positive(p.areaBaseM2, 1) &&
          positive(p.areaCapM2, p.areaBaseM2),
        "INVALID_INPUT",
        "Cylinder chambers need bounded areas and distinct nodes",
      );
      own(p.base);
      own(p.cap);
    }
    for (const p of this.pumps) {
      ensure(
        have(p.chamber, p.outlet) &&
          positive(p.areaM2, 1) &&
          (p.requireUnclippedReaction === undefined ||
            typeof p.requireUnclippedReaction === "boolean"),
        "INVALID_INPUT",
        "Pumps need a chamber, separate outlet and bounded area",
      );
      own(p.chamber);
      ensure(
        !this.passages.some((line) => line.includes(p.chamber)) &&
          !this.valves.some((valve) =>
            [valve.supply, valve.workA, valve.workB].includes(p.chamber),
          ),
        "INVALID_INPUT",
        "A pump chamber must route only through its inlet/outlet checks",
      );
    }
    const pumpChambers = new Set(this.pumps.map((p) => p.chamber));
    ensure(
      this.pumps.every((p) => !pumpChambers.has(p.outlet)),
      "INVALID_INPUT",
      "Pump outlets cannot bypass another chamber's check valves",
    );
    const volumes = this.volumes();
    for (const [id, node] of this.nodes)
      this.charge.set(
        id,
        (node.initialPressurePa ?? this.atmospherePa) * volumes.get(id)!,
      );
  }
  readonly atmospherePa: number;
  setValve(id: string, state: PneumaticValveState) {
    ensure(
      this.states.has(id) && ["neutral", "extend", "retract"].includes(state),
      "INVALID_INPUT",
      "Choose an available valve and a valid direction",
    );
    this.states.set(id, state);
  }
  private volumes(samples?: Map<string, Sample>) {
    const volumes = new Map(
      [...this.nodes].map(([id, node]) => [id, node.volumeM3]),
    );
    for (const p of this.cylinders) {
      const x = (samples?.get(p.id) ?? sample(p)).stroke;
      volumes.set(p.base, volumes.get(p.base)! + p.areaBaseM2 * x);
      volumes.set(p.cap, volumes.get(p.cap)! + p.areaCapM2 * (p.strokeM - x));
    }
    for (const p of this.pumps) {
      const x = (samples?.get(p.id) ?? sample(p)).stroke;
      volumes.set(
        p.chamber,
        volumes.get(p.chamber)! + p.areaM2 * (p.strokeM - x),
      );
    }
    return volumes;
  }
  step(dt: number) {
    ensure(
      Number.isFinite(dt) && dt >= 1 / 240 && dt <= 1 / 30,
      "INVALID_INPUT",
      "Pneumatic steps need the bounded native fixed timestep",
    );
    // Validate every live body before touching gas state or applying impulses.
    const samples = new Map(
        [...this.cylinders, ...this.pumps].map((p) => [p.id, sample(p)]),
      ),
      volumes = this.volumes(samples),
      charge = new Map(this.charge);
    const parent = new Map([...this.nodes.keys()].map((id) => [id, id]));
    const root = (id: string): string => {
      let r = id;
      while (parent.get(r) !== r) r = parent.get(r)!;
      while (id !== r) {
        const next = parent.get(id)!;
        parent.set(id, r);
        id = next;
      }
      return r;
    };
    const join = (a: string, b: string) => parent.set(root(a), root(b));
    for (const [a, b] of this.passages) join(a, b);
    const exhaust: string[] = [];
    for (const valve of this.valves) {
      const state = this.states.get(valve.id);
      if (state === "neutral") continue;
      join(valve.supply, state === "extend" ? valve.workA : valve.workB);
      exhaust.push(state === "extend" ? valve.workB : valve.workA);
    }
    const vented = new Set(exhaust.map(root)),
      islands = new Map<string, string[]>();
    for (const id of this.nodes.keys()) {
      const key = root(id);
      const group = islands.get(key) ?? [];
      group.push(id);
      islands.set(key, group);
    }
    let intake = 0,
      released = 0;
    const equalize = (ids: string[], ambient: boolean) => {
      const volume = ids.reduce((s, id) => s + volumes.get(id)!, 0),
        total = ids.reduce((s, id) => s + charge.get(id)!, 0);
      const pressure = ambient ? this.atmospherePa : total / volume;
      if (ambient) {
        const delta = pressure * volume - total;
        if (delta > 0) intake += delta;
        else released -= delta;
      }
      for (const id of ids) charge.set(id, pressure * volumes.get(id)!);
    };
    for (const [id, nodes] of islands) equalize(nodes, vented.has(id));
    for (const pump of this.pumps) {
      const volume = volumes.get(pump.chamber)!;
      if (charge.get(pump.chamber)! < this.atmospherePa * volume) {
        intake += this.atmospherePa * volume - charge.get(pump.chamber)!;
        charge.set(pump.chamber, this.atmospherePa * volume);
      }
      const outletRoot = root(pump.outlet),
        outlet = islands.get(outletRoot)!,
        pressure = charge.get(pump.chamber)! / volume;
      if (pressure > charge.get(pump.outlet)! / volumes.get(pump.outlet)!) {
        equalize([pump.chamber, ...outlet], vented.has(outletRoot));
      }
    }
    const pressures = new Map(
      [...charge].map(([id, gas]) => [id, gas / volumes.get(id)!]),
    );
    ensure(
      [...pressures.values()].every((p) =>
        positive(p, PNEUMATIC_LIMITS.pressurePa),
      ),
      "LIMIT_EXCEEDED",
      "Pneumatic pressure exceeds the simulation range",
    );
    const impulses: Array<{
      port: NativePneumaticStroke;
      sample: Sample;
      force: number;
    }> = [];
    for (const p of this.cylinders)
      impulses.push({
        port: p,
        sample: samples.get(p.id)!,
        force:
          (pressures.get(p.base)! - this.atmospherePa) * p.areaBaseM2 -
          (pressures.get(p.cap)! - this.atmospherePa) * p.areaCapM2,
      });
    for (const p of this.pumps) {
      const force = -(pressures.get(p.chamber)! - this.atmospherePa) * p.areaM2;
      ensure(
        !p.requireUnclippedReaction || Math.abs(force) <= p.maxForceN,
        "LIMIT_EXCEEDED",
        "The pump pressure exceeds its supported native reaction. Release pressure before pumping again.",
      );
      impulses.push({ port: p, sample: samples.get(p.id)!, force });
    }
    for (const [id, gas] of charge) this.charge.set(id, gas);
    this.gasFromAtmosphere += intake;
    this.gasToAtmosphere += released;
    for (const { port, sample: s, force } of impulses) {
      const impulse =
        Math.max(-port.maxForceN, Math.min(port.maxForceN, force)) * dt;
      const value = {
        x: s.axis.x * impulse,
        y: s.axis.y * impulse,
        z: s.axis.z * impulse,
      };
      port.rod.applyImpulseAtPoint(value, s.rodAnchor, true);
      port.body.applyImpulseAtPoint(
        { x: -value.x, y: -value.y, z: -value.z },
        s.bodyAnchor,
        true,
      );
    }
    return {
      pressuresPa: Object.fromEntries(pressures),
      strokesM: Object.fromEntries(
        [...samples].map(([id, s]) => [id, s.stroke]),
      ),
      forcesN: Object.fromEntries(
        impulses.map(({ port, force }) => [
          port.id,
          Math.max(-port.maxForceN, Math.min(port.maxForceN, force)),
        ]),
      ),
    };
  }
  gasAccounting() {
    return {
      storedPaM3: [...this.charge.values()].reduce(
        (sum, value) => sum + value,
        0,
      ),
      fromAtmospherePaM3: this.gasFromAtmosphere,
      toAtmospherePaM3: this.gasToAtmosphere,
    };
  }
  /** Read native state without submitting another simulation impulse. */
  snapshot() {
    const samples = new Map(
      [...this.cylinders, ...this.pumps].map((p) => [p.id, sample(p)]),
    );
    const volumes = this.volumes(samples);
    return {
      pressuresPa: Object.fromEntries(
        [...this.charge].map(([id, gas]) => [id, gas / volumes.get(id)!]),
      ),
      strokesM: Object.fromEntries(
        [...samples].map(([id, value]) => [id, value.stroke]),
      ),
      valves: Object.fromEntries(this.states),
    };
  }
}
