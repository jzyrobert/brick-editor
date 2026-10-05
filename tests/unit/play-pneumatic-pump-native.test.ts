import { beforeAll, it, expect, vi } from "vitest";
import R from "@dimforge/rapier3d-compat";
import { Quaternion, Vector3 } from "three";
import { exportLDraw } from "../../src/ldraw/io";
import { NativePneumaticCircuit } from "../../src/mechanisms/pneumatic-circuit";
import { createSourcePneumaticPump } from "../../src/play/pneumatic-pump-native";
import {
  prepareSourcePneumaticPump,
  readPreparedPneumaticPump,
} from "../../src/play/pneumatic-pump-source";
import { pneumaticPumpFixture } from "../helpers/pneumatic-pump-source";
import {
  prepareSourcePneumaticPumpMount,
  requireSourcePneumaticPumpMount,
} from "../../src/play/pneumatic-pump-mount";
import { partsList } from "../../src/inventory/parts-list";
import { occurrences } from "../../src/core/document";
let f: Awaited<ReturnType<typeof pneumaticPumpFixture>>;
let project: typeof f.project,
  sources: typeof f.sources,
  surfaces: typeof f.surfaces,
  ids: typeof f.ids,
  token: typeof f.token;
const DT = 1 / 60;
beforeAll(async () => {
  await R.init();
  f = await pneumaticPumpFixture();
  ({ project, sources, surfaces, ids, token } = f);
});
const gas = (n: ReturnType<typeof createSourcePneumaticPump>) =>
  new NativePneumaticCircuit({
    nodes: [
      { id: "out", volumeM3: 0.01 },
      { id: "chamber", volumeM3: 0.002 },
    ],
    passages: [],
    pumps: [n.pump("pump", "chamber", "out")],
  });
it("pumps finite atmospheric gas using manual native force and genuinely stalls under uncapped opposing pressure", () => {
  const original = JSON.stringify(project),
    exp = exportLDraw(project),
    w = new R.World({ x: 0, y: 0, z: 0 }),
    n = createSourcePneumaticPump(token, w),
    g = gas(n),
    pose = vi.spyOn(n.rod, "setTranslation"),
    vel = vi.spyOn(n.rod, "setLinvel");
  try {
    expect([w.bodies.len(), w.colliders.len(), w.impulseJoints.len()]).toEqual([
      2, 4, 1,
    ]);
    expect(token.triangles).toBe(1533);
    n.setManualInput(-1);
    for (let i = 0; i < 120; i++) {
      n.assertPressureEnvelope(g.snapshot().pressuresPa.chamber);
      g.step(DT);
      n.applyManualForce(DT);
      n.stepWorld(DT);
    }
    expect(g.snapshot().strokesM.pump).toBeLessThan(0.02);
    n.setManualInput(1);
    let max = 0;
    for (let i = 0; i < 180; i++) {
      n.assertPressureEnvelope(g.snapshot().pressuresPa.chamber);
      const report = g.step(DT);
      max = Math.max(max, Math.abs(report.forcesN.pump));
      n.applyManualForce(DT);
      n.stepWorld(DT);
    }
    expect(max).toBeGreaterThan(25);
    expect(max).toBeLessThan(1000);
    expect(g.snapshot().strokesM.pump).toBeLessThan(0.03);
    expect(g.snapshot().pressuresPa.out).toBeGreaterThan(101325);
    expect(g.snapshot().pressuresPa.out).toBeLessThan(103000);
    expect(g.gasAccounting().fromAtmospherePaM3).toBeGreaterThan(0);
    expect(pose).not.toHaveBeenCalled();
    expect(vel).not.toHaveBeenCalled();
    expect(JSON.stringify(project)).toBe(original);
    expect(exportLDraw(project)).toBe(exp);
  } finally {
    n.dispose();
    w.free();
  }
});
it("retains two actual mobile actors and equal opposite manual/gas momentum without copying source owners", () => {
  const w = new R.World({ x: 0, y: 0, z: 0 }),
    n = createSourcePneumaticPump(token, w, { bodyAnchored: false }),
    g = gas(n);
  try {
    n.setManualInput(1);
    n.assertPressureEnvelope(g.snapshot().pressuresPa.chamber);
    g.step(DT);
    n.applyManualForce(DT);
    const a = n.body.linvel(),
      b = n.rod.linvel();
    expect(Math.hypot(a.x, a.y, a.z)).toBeGreaterThan(0.3);
    expect(a.x * n.body.mass() + b.x * n.rod.mass()).toBeCloseTo(0, 6);
    expect(a.y * n.body.mass() + b.y * n.rod.mass()).toBeCloseTo(0, 6);
    n.stepWorld(DT);
    expect(() => createSourcePneumaticPump(token, w)).toThrow("owner");
    expect(() => createSourcePneumaticPump({ ...token }, w)).toThrow("exact");
    expect(w.bodies.len()).toBe(2);
  } finally {
    n.dispose();
    w.free();
  }
});
it("blocks an actual foreign head obstruction then retries, while cap/gasket/foreign contacts and predicted misalignment respond", () => {
  const w = new R.World({ x: 0, y: 0, z: 0 }),
    n = createSourcePneumaticPump(token, w),
    start = new Vector3().copy(n.rod.translation()),
    q = new Quaternion().copy(n.body.rotation()),
    axis = new Vector3(0, 1, 0).applyQuaternion(q),
    p = start.clone().addScaledVector(axis, 0.5),
    block = w.createCollider(
      R.ColliderDesc.cuboid(0.45, 0.01, 0.45)
        .setTranslation(p.x, p.y, p.z)
        .setRotation(q),
    );
  try {
    n.setManualInput(-1);
    for (let i = 0; i < 120; i++) {
      n.applyManualForce(DT);
      n.stepWorld(DT);
    }
    expect(
      new Vector3().copy(n.rod.translation()).sub(start).dot(axis),
    ).toBeLessThan(0.45);
    expect(n.contactAllowed(n.colliders[0].handle, n.colliders[2].handle)).toBe(
      false,
    );
    expect(n.contactAllowed(n.colliders[0].handle, n.colliders[3].handle)).toBe(
      true,
    );
    expect(n.contactAllowed(n.colliders[0].handle, n.colliders[1].handle)).toBe(
      true,
    );
    expect(n.contactAllowed(n.colliders[2].handle, block.handle)).toBe(true);
    w.removeCollider(block, true);
    for (let i = 0; i < 120; i++) {
      n.applyManualForce(DT);
      n.stepWorld(DT);
    }
    expect(
      new Vector3().copy(n.rod.translation()).sub(start).dot(axis),
    ).toBeGreaterThan(0.55);
    n.rod.applyTorqueImpulse({ x: 20, y: 0, z: 0 }, true);
    n.beforeStep(DT);
    expect(n.contactAllowed(n.colliders[0].handle, n.colliders[2].handle)).toBe(
      true,
    );
  } finally {
    n.dispose();
    w.free();
  }
});
it("refuses excessive pressure before a pumping step and stale source before allocation", async () => {
  const w = new R.World({ x: 0, y: 0, z: 0 }),
    n = createSourcePneumaticPump(token, w),
    g = gas(n);
  try {
    const before = g.gasAccounting(),
      v = n.rod.linvel();
    expect(() => n.assertPressureEnvelope(1000000)).toThrow(
      "supported native reaction",
    );
    expect(g.gasAccounting()).toEqual(before);
    expect(n.rod.linvel()).toEqual(v);
    const clone = structuredClone(project);
    const stale = await prepareSourcePneumaticPump(clone, sources, {
      occurrenceIds: ids,
      surfaces,
    });
    clone.models[clone.rootModelId].records.push({ raw: "0 changed" } as any);
    expect(() => createSourcePneumaticPump(stale, w)).toThrow(
      "exact pump source",
    );
    expect(w.bodies.len()).toBe(2);
    expect(() => readPreparedPneumaticPump({ ...token })).toThrow("exact");
    await expect(
      prepareSourcePneumaticPump(
        project,
        { ...sources, "4-4cyli.dat": sources["4-4cyli.dat"] + "\n0 changed" },
        { occurrenceIds: ids as any, surfaces: surfaces as any },
      ),
    ).rejects.toThrow("changed");
    expect(w.bodies.len()).toBe(2);
  } finally {
    n.dispose();
    w.free();
  }
});

it("refuses uncapped source pressure atomically before gas accounting and both native impulses, preserving default engineering caps", () => {
  const w = new R.World({ x: 0, y: 0, z: 0 }),
    n = createSourcePneumaticPump(token, w);
  try {
    const port = n.pump("pump", "chamber", "out");
    const make = (strict: boolean) =>
      new NativePneumaticCircuit({
        nodes: [
          { id: "out", volumeM3: 0.01 },
          { id: "chamber", volumeM3: 0.002, initialPressurePa: 1000000 },
        ],
        passages: [],
        pumps: [{ ...port, requireUnclippedReaction: strict }],
      });
    const g = make(true),
      before = g.gasAccounting(),
      snapshot = g.snapshot(),
      a = vi.spyOn(n.body, "applyImpulseAtPoint"),
      b = vi.spyOn(n.rod, "applyImpulseAtPoint");
    expect(() => g.step(DT)).toThrow("supported native reaction");
    expect(g.gasAccounting()).toEqual(before);
    expect(g.snapshot()).toEqual(snapshot);
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
    const engineering = make(false);
    expect(engineering.step(DT).forcesN.pump).toBe(-1000);
  } finally {
    n.dispose();
    w.free();
  }
});

it("recognizes the actual stopped axle and two collar face capture without inventing a fixed collar weld or accepting nearby hardware", async () => {
  const before = JSON.stringify(project),
    inventory = partsList(project, occurrences(project)),
    shaft = f.index.hardware.find((h) => h.reference === "87083.dat")!,
    collars = f.index.hardware.filter((h) => h.reference === "32123a.dat");
  const input = {
    shaftOccurrenceId: shaft.id,
    collarOccurrenceIds: collars.map((h) => h.id) as [string, string],
  };
  const mount = await prepareSourcePneumaticPumpMount(token, sources, input);
  expect(mount.pivot).toEqual([20, -60, 70]);
  expect(mount.axis).toEqual([0, 0, -1]);
  expect(mount.freedom).toEqual({
    pumpRotation: "free",
    pumpAxial: "two-collar-capture",
    collarRotation: "keyed",
    collarAxial: "ideal-grip-not-a-weld",
  });
  requireSourcePneumaticPumpMount(token, mount);
  expect(() => requireSourcePneumaticPumpMount(token, { ...mount })).toThrow(
    "exact",
  );
  const changed = structuredClone(project),
    node = changed.models[changed.rootModelId].nodes.find(
      (n) => n.id === collars[0].sourceNodeId,
    )!;
  node.transform.position[2] += 1;
  const newToken = await prepareSourcePneumaticPump(changed, sources, {
    occurrenceIds: ids,
    surfaces,
  });
  await expect(
    prepareSourcePneumaticPumpMount(newToken, sources, input),
  ).rejects.toThrow("inside faces");
  expect(JSON.stringify(project)).toBe(before);
  expect(partsList(project, occurrences(project))).toEqual(inventory);
});
