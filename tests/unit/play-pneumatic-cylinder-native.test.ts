import { Quaternion, Vector3 } from "three";
import { readFileSync } from "node:fs";
import { beforeAll, expect, it, vi } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { exportLDraw, importLDraw } from "../../src/ldraw/io";
import { directReferences } from "../../src/catalog/full-pack";
import { fullLibrarySources } from "../../scripts/full-library-node";
import { NativePneumaticCircuit } from "../../src/mechanisms/pneumatic-circuit";
import {
  bindPneumaticSources,
  sourcePneumaticTopology,
} from "../../src/mechanisms/pneumatic-sources";
import routingManifest from "../../src/mechanisms/pneumatic-sources.json";
import { sourceHardwareIndex } from "../../src/mechanisms/source-hardware-index";
import {
  prepareSourcePneumaticCylinder,
  readPreparedPneumaticCylinder,
} from "../../src/play/pneumatic-cylinder-source";
import { createSourcePneumaticCylinder } from "../../src/play/pneumatic-cylinder-native";
import { createSourcePneumaticCylinderCircuit } from "../../src/play/pneumatic-cylinder-routing";
import {
  pneumaticCylinderFixture,
  CYLINDER_FIXTURE,
} from "../helpers/pneumatic-cylinder-source";
const DT = 1 / 60;
let f: Awaited<ReturnType<typeof pneumaticCylinderFixture>>;
beforeAll(async () => {
  await RAPIER.init();
  f = await pneumaticCylinderFixture();
});
async function prepare() {
  const h = f.index.hardware.filter(
    (h) => h.reference.includes("19466c01") || h.reference.includes("19467c01"),
  );
  return prepareSourcePneumaticCylinder(f.project, f.sources, {
    bodyOccurrenceId: h[0].id,
    rodOccurrenceId: h[1].id,
    body: f.members[0],
    rod: f.members[1],
  });
}
function circuit(native: ReturnType<typeof createSourcePneumaticCylinder>) {
  return new NativePneumaticCircuit({
    nodes: [
      { id: "supply", volumeM3: 1, initialPressurePa: 1000000 },
      { id: "base", volumeM3: 0.005 },
      { id: "cap", volumeM3: 0.005 },
    ],
    passages: [],
    valves: [{ id: "valve", supply: "supply", workA: "base", workB: "cap" }],
    cylinders: [native.cylinder("cylinder", "base", "cap")],
  });
}
it("moves the actual separate cylinder and rod through finite retained travel using pressure impulses and real responding foreign contacts", async () => {
  const p = await prepare(),
    original = JSON.stringify(f.project),
    exported = exportLDraw(f.project),
    world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = DT;
  const n = createSourcePneumaticCylinder(p, world),
    gas = circuit(n),
    pose = vi.spyOn(n.rod, "setTranslation"),
    vel = vi.spyOn(n.rod, "setLinvel");
  try {
    expect(p.triangles).toBe(2263);
    expect([
      world.bodies.len(),
      world.colliders.len(),
      world.impulseJoints.len(),
    ]).toEqual([2, 3, 1]);
    gas.setValve("valve", "extend");
    for (let i = 0; i < 120; i++) {
      gas.step(DT);
      n.stepWorld(DT);
    }
    expect(gas.snapshot().strokesM.cylinder).toBeGreaterThan(2.58);
    expect(gas.snapshot().strokesM.cylinder).toBeLessThan(2.6);
    gas.setValve("valve", "retract");
    for (let i = 0; i < 120; i++) {
      gas.step(DT);
      n.stepWorld(DT);
    }
    expect(gas.snapshot().strokesM.cylinder).toBeLessThan(0.02);
    const start = n.rod.translation(),
      axis = {
        x: 0.024 / Math.hypot(0.024, 1),
        y: 1 / Math.hypot(0.024, 1),
        z: 0,
      },
      blocker = world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.5, 0.04, 0.5).setTranslation(
          start.x + axis.x * 0.8,
          start.y + axis.y * 0.8,
          start.z,
        ),
      );
    gas.setValve("valve", "extend");
    for (let i = 0; i < 120; i++) {
      gas.step(DT);
      n.stepWorld(DT);
    }
    expect(gas.snapshot().strokesM.cylinder).toBeLessThan(0.8);
    expect(gas.snapshot().strokesM.cylinder).toBeGreaterThan(0.1);
    world.removeCollider(blocker, true);
    for (let i = 0; i < 120; i++) {
      gas.step(DT);
      n.stepWorld(DT);
    }
    expect(gas.snapshot().strokesM.cylinder).toBeGreaterThan(2.58);
    expect(pose).not.toHaveBeenCalled();
    expect(vel).not.toHaveBeenCalled();
    expect(JSON.stringify(f.project)).toBe(original);
    expect(exportLDraw(f.project)).toBe(exported);
  } finally {
    n.dispose();
    world.free();
  }
}, 30000);
it("reacts pressure on a mobile body with conserved momentum and refuses duplicate or copied source owners before mutation", async () => {
  const p = await prepare(),
    world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = DT;
  const n = createSourcePneumaticCylinder(p, world, { bodyAnchored: false }),
    gas = circuit(n);
  try {
    expect(() => createSourcePneumaticCylinder({ ...p }, world)).toThrow(
      /exact pneumatic source/,
    );
    expect(() => createSourcePneumaticCylinder(p, world)).toThrow(
      /native owner/,
    );
    expect([world.bodies.len(), world.colliders.len()]).toEqual([2, 3]);
    gas.setValve("valve", "extend");
    const report = gas.step(DT);
    expect(report.forcesN.cylinder).toBe(25);
    const a = n.body.linvel(),
      b = n.rod.linvel();
    expect(
      Math.hypot(
        a.x * n.body.mass() + b.x * n.rod.mass(),
        a.y * n.body.mass() + b.y * n.rod.mass(),
        a.z * n.body.mass() + b.z * n.rod.mass(),
      ),
    ).toBeLessThan(1e-6);
    for (let i = 0; i < 120; i++) {
      n.stepWorld(DT);
      gas.step(DT);
    }
    expect(gas.snapshot().strokesM.cylinder).toBeGreaterThan(2.58);
  } finally {
    n.dispose();
    world.free();
  }
}, 30000);
it("rejects changed canonical surfaces, altered embedded closures and stale source before any native actors", async () => {
  const h = f.index.hardware.filter(
      (h) =>
        h.reference.includes("19466c01") || h.reference.includes("19467c01"),
    ),
    input = {
      bodyOccurrenceId: h[0].id,
      rodOccurrenceId: h[1].id,
      body: f.members[0],
      rod: f.members[1],
    },
    bad = {
      vertices: f.members[1].vertices.slice(),
      indices: f.members[1].indices,
    };
  bad.vertices[0] += 0.1;
  await expect(
    prepareSourcePneumaticCylinder(f.project, f.sources, {
      ...input,
      rod: bad,
    }),
  ).rejects.toThrow(/surface changed/);
  const changed = importLDraw(readFileSync(CYLINDER_FIXTURE, "utf8"));
  changed.models["42043 - u9113.dat"].records.find((r) =>
    r.raw.startsWith("1 "),
  )!.raw += " ";
  const source = f.sources; // whitespace normalization is deliberately equivalent
  changed.models["42043 - u9113.dat"].records.find((r) =>
    r.raw.startsWith("1 "),
  )!.raw = changed.models["42043 - u9113.dat"].records
    .find((r) => r.raw.startsWith("1 "))!
    .raw.replace("150", "151");
  await expect(
    prepareSourcePneumaticCylinder(changed, source, input),
  ).rejects.toThrow(/source changed/);
  const p = await prepare();
  f.project.revision++;
  try {
    const w = new RAPIER.World({ x: 0, y: 0, z: 0 });
    try {
      expect(() => createSourcePneumaticCylinder(p, w)).toThrow(/Reload/);
      expect(w.bodies.len()).toBe(0);
    } finally {
      w.free();
    }
  } finally {
    f.project.revision--;
  }
}, 30000);
it("connects one real cylinder to its sealed actual valve routes without fabricating a pressure command or changing source", async () => {
  const routing = readFileSync(
      "fixtures/play/mechanical-systems/42043-pneumatic-routing.mpd",
      "utf8",
    ),
    definitions = readFileSync(CYLINDER_FIXTURE, "utf8")
      .split("\n0 FILE ")
      .slice(1)
      .map((s) => "0 FILE " + s)
      .filter((s) => /^(?:0 FILE )(?:42043 - 19467|42043 - u9113)/.test(s))
      .join("\n");
  const project = importLDraw(
      routing.replace(
        "\n0 FILE 42043 - 2943-v2.dat",
        "\n1 0 0 -683.436 6.324 1 0 0 0 1 0.024 0 -0.024 1 42043 - 19467c01.dat\n0 FILE 42043 - 2943-v2.dat",
      ) +
        "\n" +
        definitions,
    ),
    need = new Set<string>();
  for (const m of Object.values(project.models))
    for (const r of directReferences(m.records.map((r) => r.raw).join("\n")))
      if (!project.models[r]) need.add(r);
  const sources = fullLibrarySources([...need, "165.dat", "166.dat"]),
    binding = await bindPneumaticSources(
      project,
      sources,
      Object.keys(routingManifest),
    ),
    topology = sourcePneumaticTopology(project, binding),
    h = sourceHardwareIndex(project).hardware,
    body = h.find((h) => h.reference === "42043 - 19466c01.dat")!,
    rod = h.find((h) => h.reference === "42043 - 19467c01.dat")!,
    p = await prepareSourcePneumaticCylinder(project, sources, {
      bodyOccurrenceId: body.id,
      rodOccurrenceId: rod.id,
      body: f.members[0],
      rod: f.members[1],
    }),
    original = JSON.stringify(project),
    world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = DT;
  const n = createSourcePneumaticCylinder(p, world);
  try {
    expect(() =>
      createSourcePneumaticCylinderCircuit(p, structuredClone(topology), n, {
        initialSupplyPressurePa: 2000000,
      }),
    ).toThrow(/exact sealed/);
    const gas = createSourcePneumaticCylinderCircuit(p, topology, n, {
      initialSupplyPressurePa: 2000000,
    });
    const initial = gas.snapshot().strokesM[body.id];
    gas.setValve("extend");
    let report = gas.step(DT);
    const sign = Math.sign(report.forcesN[body.id]);
    expect(Math.abs(report.forcesN[body.id])).toBe(25);
    for (let i = 0; i < 60; i++) {
      n.stepWorld(DT);
      report = gas.step(DT);
    }
    expect((gas.snapshot().strokesM[body.id] - initial) * sign).toBeGreaterThan(
      0.1,
    );
    gas.setValve("retract");
    expect(Math.sign(gas.step(DT).forcesN[body.id])).toBe(-sign);
    const accounting = gas.gasAccounting();
    project.revision++;
    expect(() => gas.step(DT)).toThrow(/Reload/);
    expect(gas.gasAccounting()).toEqual(accounting);
    project.revision--;
    expect(JSON.stringify(project)).toBe(original);
    expect(readPreparedPneumaticCylinder(p).project).toBe(project);
  } finally {
    n.dispose();
    world.free();
  }
}, 30000);

it("preserves actual source pin bores and their solid rims without inventing a chassis attachment", async () => {
  const p = await prepare(),
    world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    n = createSourcePneumaticCylinder(p, world);
  try {
    for (const [body, col] of [
      [n.body, n.colliders[0]],
      [n.rod, n.colliders[1]],
    ] as const) {
      const q = new Quaternion().copy(body.rotation()),
        center = new Vector3().copy(body.translation()),
        axis = new Vector3(1, 0, 0).applyQuaternion(q),
        start = center.clone().addScaledVector(axis, -1);
      expect(
        col.castRayAndGetNormal(new RAPIER.Ray(start, axis), 2, true),
      ).toBeNull();
      const offset = new Vector3(0, -7 * 0.02, 0).applyQuaternion(q),
        hit = col.castRayAndGetNormal(
          new RAPIER.Ray(start.add(offset), axis),
          2,
          true,
        );
      expect(hit).not.toBeNull();
      expect(hit!.timeOfImpact).toBeGreaterThan(0.75);
      expect(hit!.timeOfImpact).toBeLessThan(1.25);
    }
    expect(world.impulseJoints.len()).toBe(1); // axial guide only, no fabricated mount joint
  } finally {
    n.dispose();
    world.free();
  }
}, 30000);
it("checks the complete predicted shaft envelope, keeps all other classes responding, and refuses removed bodies before stepping", async () => {
  const p = await prepare(),
    world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    n = createSourcePneumaticCylinder(p, world);
  try {
    n.beforeStep(DT);
    expect(n.contactAllowed(n.colliders[0].handle, n.colliders[2].handle)).toBe(
      false,
    );
    expect(n.contactAllowed(n.colliders[0].handle, n.colliders[1].handle)).toBe(
      true,
    );
    const foreign = world.createCollider(
      RAPIER.ColliderDesc.ball(0.05).setTranslation(100, 100, 100),
    );
    expect(n.contactAllowed(foreign.handle, n.colliders[2].handle)).toBe(true);
    n.rod.applyTorqueImpulse({ x: 0, y: 0, z: 0.2 }, true);
    n.beforeStep(DT);
    expect(n.contactAllowed(n.colliders[0].handle, n.colliders[2].handle)).toBe(
      true,
    );
    world.removeRigidBody(n.rod);
    expect(() => n.stepWorld(DT)).toThrow(/no longer available/);
    expect(() => n.assertLive(p)).toThrow(/no longer available/);
  } finally {
    n.dispose();
    world.free();
  }
}, 30000);
it("refuses native body budget exhaustion before allocating cylinder actors", async () => {
  const p = await prepare(),
    world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  try {
    for (let i = 0; i < 63; i++)
      world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    expect(() => createSourcePneumaticCylinder(p, world)).toThrow(/budget/);
    expect(world.bodies.len()).toBe(63);
    expect(world.colliders.len()).toBe(0);
    expect(world.impulseJoints.len()).toBe(0);
  } finally {
    world.free();
  }
}, 30000);
