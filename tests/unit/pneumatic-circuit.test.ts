import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  NativePneumaticCircuit,
  type NativePneumaticStroke,
} from "../../src/mechanisms/pneumatic-circuit";
const DT = 1 / 60,
  ATM = 101_325;
const worlds: RAPIER.World[] = [];
beforeAll(async () => {
  await RAPIER.init();
});
afterEach(() => {
  worlds.splice(0).forEach((world) => world.free());
});
/** Native kernel bench, deliberately not a certificate of source hardware. */
function bench(fixed = true, initialStroke = 0.03) {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = DT;
  worlds.push(world);
  const body = world.createRigidBody(
    (fixed
      ? RAPIER.RigidBodyDesc.fixed()
      : RAPIER.RigidBodyDesc.dynamic()
    ).setCanSleep(false),
  );
  const rod = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 0, initialStroke)
      .setCanSleep(false),
  );
  for (const b of [body, rod])
    world.createCollider(
      RAPIER.ColliderDesc.ball(0.01).setMass(1).setCollisionGroups(0),
      b,
    );
  const data = RAPIER.JointData.prismatic(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: -initialStroke },
    { x: 0, y: 0, z: 1 },
  );
  data.limitsEnabled = true;
  data.limits = [-initialStroke, 0.1 - initialStroke];
  world.createImpulseJoint(data, body, rod, true);
  const stroke: NativePneumaticStroke = {
    id: "cylinder",
    body,
    rod,
    anchorBody: [0, 0, 0],
    anchorRod: [0, 0, 0],
    axisBody: [0, 0, 1],
    restSeparationM: 0,
    strokeM: 0.1,
    maxForceN: 500,
  };
  return { world, body, rod, stroke };
}
function cylinder(stroke: NativePneumaticStroke, supplyPressure = 400_000) {
  return new NativePneumaticCircuit({
    nodes: [
      { id: "supply", volumeM3: 0.01, initialPressurePa: supplyPressure },
      { id: "base", volumeM3: 0.00001 },
      { id: "cap", volumeM3: 0.00001 },
    ],
    passages: [],
    valves: [{ id: "valve", supply: "supply", workA: "base", workB: "cap" }],
    cylinders: [
      {
        ...stroke,
        base: "base",
        cap: "cap",
        areaBaseM2: 0.0001,
        areaCapM2: 0.00008,
      },
    ],
  });
}
describe("native pneumatic circuit engine", () => {
  it("applies balanced native cylinder forces from routed pressure without changing pose or velocity directly", () => {
    const { body, rod, stroke } = bench(false);
    const circuit = cylinder(stroke),
      initial = circuit.gasAccounting();
    const pose = vi.spyOn(rod, "setTranslation"),
      velocity = vi.spyOn(rod, "setLinvel");
    circuit.setValve("valve", "extend");
    const report = circuit.step(DT);
    expect(report.pressuresPa.base).toBeGreaterThan(399_000);
    expect(report.pressuresPa.cap).toBe(ATM);
    expect(report.forcesN.cylinder).toBeCloseTo(
      (report.pressuresPa.base - ATM) * 0.0001,
      10,
    );
    expect(rod.linvel().z).toBeCloseTo(report.forcesN.cylinder * DT, 6);
    expect(body.linvel().z + rod.linvel().z).toBeCloseTo(0, 7);
    expect(pose).not.toHaveBeenCalled();
    expect(velocity).not.toHaveBeenCalled();
    const accounting = circuit.gasAccounting();
    expect(accounting.storedPaM3).toBeCloseTo(
      initial.storedPaM3 +
        accounting.fromAtmospherePaM3 -
        accounting.toAtmospherePaM3,
      10,
    );
  });
  it("exhausts the opposite chamber on reversal, seals neutral and retains finite gas under native backdrive", () => {
    const { world, rod, stroke } = bench();
    const circuit = cylinder(stroke, 200_000);
    circuit.setValve("valve", "extend");
    const forward = circuit.step(DT);
    expect(forward.forcesN.cylinder).toBeGreaterThan(0);
    world.step();
    circuit.setValve("valve", "retract");
    const reverse = circuit.step(DT);
    expect(reverse.pressuresPa.base).toBe(ATM);
    expect(reverse.forcesN.cylinder).toBeLessThan(0);
    expect(circuit.gasAccounting().toAtmospherePaM3).toBeGreaterThan(0);
    world.step();
    circuit.setValve("valve", "neutral");
    const sealed = circuit.gasAccounting();
    const start = circuit.step(DT);
    rod.applyImpulse({ x: 0, y: 0, z: -0.2 }, true);
    for (let i = 0; i < 3; i++) {
      world.step();
      circuit.step(DT);
    }
    const compressed = circuit.step(DT);
    expect(compressed.strokesM.cylinder).not.toBe(start.strokesM.cylinder);
    expect(compressed.pressuresPa.cap).not.toBe(start.pressuresPa.cap);
    expect(circuit.gasAccounting()).toEqual(sealed);
  });
  it("builds supply only by native pump compression, opposes the driving stroke and refills through its check valve", () => {
    const { world, rod, stroke } = bench(true, 0);
    const circuit = new NativePneumaticCircuit({
      nodes: [
        { id: "pump", volumeM3: 0.000001 },
        { id: "supply", volumeM3: 0.00005 },
      ],
      passages: [],
      pumps: [
        {
          ...stroke,
          id: "pump",
          chamber: "pump",
          outlet: "supply",
          areaM2: 0.0001,
        },
      ],
    });
    const initial = circuit.gasAccounting();
    expect(circuit.step(DT).pressuresPa.supply).toBe(ATM);
    let report = circuit.step(DT);
    for (let i = 0; i < 100; i++) {
      rod.applyImpulse({ x: 0, y: 0, z: 0.06 }, true);
      world.step();
      report = circuit.step(DT);
    }
    expect(report.strokesM.pump).toBeGreaterThan(0.005);
    expect(report.pressuresPa.supply).toBeGreaterThan(ATM + 1_000);
    expect(report.forcesN.pump).toBeLessThan(0);
    const chargedSupply = report.pressuresPa.supply;
    for (let i = 0; i < 100; i++) {
      rod.applyImpulse({ x: 0, y: 0, z: -0.06 }, true);
      world.step();
      report = circuit.step(DT);
    }
    expect(report.pressuresPa.supply).toBeCloseTo(chargedSupply, 6);
    expect(report.pressuresPa.pump).toBeCloseTo(ATM, 6);
    const gas = circuit.gasAccounting();
    expect(gas.fromAtmospherePaM3).toBeGreaterThan(0);
    expect(gas.storedPaM3).toBeCloseTo(
      initial.storedPaM3 + gas.fromAtmospherePaM3 - gas.toAtmospherePaM3,
      10,
    );
  });
  it("keeps independent valve outputs isolated and distributes gas through real circuit passages", () => {
    const a = bench(),
      b = bench();
    const circuit = new NativePneumaticCircuit({
      nodes: [
        { id: "supply", volumeM3: 0.01, initialPressurePa: 400_000 },
        ...["line", "aBase", "aCap", "bBase", "bCap"].map((id) => ({
          id,
          volumeM3: 0.00001,
        })),
      ],
      passages: [["supply", "line"]],
      valves: [
        { id: "a", supply: "supply", workA: "aBase", workB: "aCap" },
        { id: "b", supply: "line", workA: "bBase", workB: "bCap" },
      ],
      cylinders: [
        {
          ...a.stroke,
          id: "cA",
          base: "aBase",
          cap: "aCap",
          areaBaseM2: 0.0001,
          areaCapM2: 0.00008,
        },
        {
          ...b.stroke,
          id: "cB",
          base: "bBase",
          cap: "bCap",
          areaBaseM2: 0.0001,
          areaCapM2: 0.00008,
        },
      ],
    });
    circuit.setValve("a", "extend");
    let report = circuit.step(DT);
    expect(report.forcesN.cA).toBeGreaterThan(0);
    expect(report.forcesN.cB).toBe(0);
    circuit.setValve("b", "retract");
    report = circuit.step(DT);
    expect(report.forcesN.cA).toBeGreaterThan(0);
    expect(report.forcesN.cB).toBeLessThan(0);
    expect(report.pressuresPa.supply).toBe(report.pressuresPa.line);
  });
  it("refuses released bodies before mutating gas or applying any earlier cylinder impulse", () => {
    const { world, body, rod, stroke } = bench();
    const circuit = cylinder(stroke),
      gas = circuit.gasAccounting();
    const impulse = vi.spyOn(body, "applyImpulseAtPoint");
    world.removeRigidBody(rod);
    expect(() => circuit.step(DT)).toThrow("no longer available");
    expect(impulse).not.toHaveBeenCalled();
    expect(circuit.gasAccounting()).toEqual(gas);
  });
  it("stalls against a native external obstacle and resumes after the obstacle is removed", () => {
    const { world, rod, stroke } = bench(true, 0.02);
    const collider = world.getCollider(rod.collider(0).handle);
    collider.setCollisionGroups(0x00010001);
    const blocker = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0.065),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.02, 0.02, 0.01).setCollisionGroups(
        0x00010001,
      ),
      blocker,
    );
    const circuit = cylinder(stroke, 160_000);
    circuit.setValve("valve", "extend");
    for (let tick = 0; tick < 100; tick++) {
      circuit.step(DT);
      world.step();
    }
    const blocked = circuit.snapshot();
    expect(blocked.strokesM.cylinder).toBeGreaterThan(0.04);
    expect(blocked.strokesM.cylinder).toBeLessThan(0.047);
    expect(Math.abs(rod.linvel().z)).toBeLessThan(0.01);
    expect(blocked.pressuresPa.base).toBeGreaterThan(150_000);
    world.removeRigidBody(blocker);
    for (let tick = 0; tick < 5; tick++) {
      circuit.step(DT);
      world.step();
    }
    expect(circuit.snapshot().strokesM.cylinder).toBeGreaterThan(
      blocked.strokesM.cylinder + 0.01,
    );
  });
  it("refuses overpressure atomically and retains the circuit configuration independently of its caller", () => {
    const { world, rod, stroke } = bench();
    const configuration = {
      nodes: [
        { id: "base", volumeM3: 1e-10, initialPressurePa: 9_000_000 },
        { id: "cap", volumeM3: 0.00001 },
      ],
      passages: [] as [string, string][],
      cylinders: [
        {
          ...stroke,
          base: "base",
          cap: "cap",
          areaBaseM2: 0.01,
          areaCapM2: 0.005,
        },
      ],
    };
    const circuit = new NativePneumaticCircuit(configuration);
    configuration.cylinders[0].axisBody[0] = 1;
    configuration.nodes[0].initialPressurePa = 0;
    // Move through the native solver to compress the sealed base chamber.
    rod.applyImpulse({ x: 0, y: 0, z: -0.9 }, true);
    world.step();
    const before = circuit.gasAccounting(),
      impulse = vi.spyOn(rod, "applyImpulseAtPoint");
    expect(() => circuit.step(DT)).toThrow("pressure exceeds");
    expect(circuit.gasAccounting()).toEqual(before);
    expect(impulse).not.toHaveBeenCalled();
  });
});
