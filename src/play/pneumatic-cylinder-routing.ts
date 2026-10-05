import { ensure } from "../core/types";
import {
  NativePneumaticCircuit,
  type PneumaticValveState,
} from "../mechanisms/pneumatic-circuit";
import {
  isPreparedPneumaticTopology,
  type SourcePneumaticTopology,
} from "../mechanisms/pneumatic-sources";
import {
  readPreparedPneumaticCylinder,
  type PreparedPneumaticCylinder,
} from "./pneumatic-cylinder-source";
import type { createSourcePneumaticCylinder } from "./pneumatic-cylinder-native";
/** One actual routed actuator bench. Unmodeled cylinder/pump actors are NOT
 * admitted: initial supply gas is explicitly declared, never a command that
 * fabricates pressure. The full four-cylinder truck requires its real pump. */
export function createSourcePneumaticCylinderCircuit(
  prepared: PreparedPneumaticCylinder,
  topology: SourcePneumaticTopology,
  native: ReturnType<typeof createSourcePneumaticCylinder>,
  options: { initialSupplyPressurePa: number; lineVolumeM3?: number },
) {
  const seal = readPreparedPneumaticCylinder(prepared);
  ensure(
    isPreparedPneumaticTopology(seal.project, topology),
    "INVALID_INPUT",
    "Use the exact sealed pneumatic routing for these source actors",
  );
  const cylinder = topology.cylinders.find(
    (c) => c.id === prepared.bodyOccurrenceId,
  );
  ensure(
    cylinder,
    "INVALID_INPUT",
    "The native body does not own a routed source cylinder",
  );
  const connected = (start: string) => {
    const found = new Set([start]);
    for (let previous = -1; previous !== found.size; ) {
      previous = found.size;
      for (const [a, b] of topology.passages)
        if (found.has(a) || found.has(b)) {
          found.add(a);
          found.add(b);
        }
    }
    return found;
  };
  const valves = topology.valves.filter((v) => {
    const a = connected(v.workA),
      b = connected(v.workB);
    return (
      (a.has(cylinder.base) && b.has(cylinder.cap)) ||
      (a.has(cylinder.cap) && b.has(cylinder.base))
    );
  });
  ensure(
    valves.length === 1,
    "INVALID_INPUT",
    "A source cylinder must have exactly one real opposing valve route",
  );
  const valve = valves[0],
    supply = connected(valve.supply),
    lineVolume = options.lineVolumeM3 ?? 0.005;
  ensure(
    Number.isFinite(lineVolume) && lineVolume > 0 && lineVolume <= 0.01,
    "INVALID_INPUT",
    "Choose a bounded pneumatic bench line volume",
  );
  const engine = new NativePneumaticCircuit({
    nodes: topology.ports.map((p) => ({
      id: p.id,
      volumeM3: lineVolume,
      initialPressurePa: supply.has(p.id)
        ? options.initialSupplyPressurePa
        : 101325,
    })),
    passages: topology.passages,
    valves: [valve],
    cylinders: [native.cylinder(cylinder.id, cylinder.base, cylinder.cap)],
  });
  const validate = () => {
    readPreparedPneumaticCylinder(prepared);
    ensure(
      isPreparedPneumaticTopology(seal.project, topology),
      "REVISION_CONFLICT",
      "Reload the exact pneumatic routing after changing its source",
    );
    native.assertLive(prepared);
  };
  return {
    valveId: valve.id,
    cylinderId: cylinder.id,
    setValve(state: PneumaticValveState) {
      validate();
      engine.setValve(valve.id, state);
    },
    step(dt: number) {
      validate();
      return engine.step(dt);
    },
    snapshot() {
      validate();
      return engine.snapshot();
    },
    gasAccounting() {
      return engine.gasAccounting();
    },
  };
}
