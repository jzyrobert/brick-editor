import { readFileSync } from "node:fs";
import RAPIER from "@dimforge/rapier3d-compat";
import { Quaternion, Vector3 } from "three";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { occurrences } from "../../src/core/document";
import { mv } from "../../src/core/math";
import type { Vec3, Project, Occurrence } from "../../src/core/types";
import { importLDraw } from "../../src/ldraw/io";
import { toPhysics, toPhysicsDirection } from "../../src/play/physics-frame";
import {
  bindWinchCarrierSources,
  winchCarrierPlan,
  type WinchCarrierPlan,
} from "../../src/mechanisms/winch-carrier";
import { NativeWinchCarrierConstraints } from "../../src/mechanisms/winch-carrier-native";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { memberLocalOf } from "../helpers/play-dynamic-source";
import type { PlayMemberLocalGeometry } from "../../src/play/types";

const DT = 1 / 60,
  worlds: RAPIER.World[] = [],
  captures = new Map<string, PlayMemberLocalGeometry>();
let project: Project, unchanged: string, all: Occurrence[];
let plan: WinchCarrierPlan;
beforeAll(async () => {
  registerFullLibraryFromDisk();
  await RAPIER.init();
  project = importLDraw(
    readFileSync("fixtures/ldraw/technic/42042-mounted-winch.ldr", "utf8"),
  );
  unchanged = JSON.stringify(project);
  all = occurrences(project);
  const sources = fullLibrarySources(all.map((o) => o.node.ref)),
    binding = await bindWinchCarrierSources(sources, project);
  plan = winchCarrierPlan(
    all.find((o) => o.node.ref === "4716.dat")!,
    all,
    binding,
  );
  for (const ref of new Set(all.map((o) => o.node.ref))) {
    const o = all.find((o) => o.node.ref === ref)!;
    captures.set(ref, await memberLocalOf(project, o.id, sources));
  }
}, 30_000);
afterEach(() => worlds.splice(0).forEach((w) => w.free()));
function native() {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = DT;
  worlds.push(world);
  const bodies = new Map<string, RAPIER.RigidBody>(),
    inertia = new Map<string, Vec3>();
  let triangles = 0;
  for (const o of all) {
    const g = captures.get(o.node.ref)!,
      points: Vec3[] = [];
    for (let i = 0; i < g.vertices.length; i += 3)
      points.push(
        mv(o.transform.basis, Array.from(g.vertices.slice(i, i + 3)) as Vec3),
      );
    const verts = Float32Array.from(
        points.flatMap((p) => Object.values(toPhysics(p))),
      ),
      extent = [0, 1, 2].map(
        (i) =>
          (Math.max(...points.map((p) => p[i])) -
            Math.min(...points.map((p) => p[i]))) *
          0.02,
      ),
      mass = 0.05,
      I: Vec3 = [
        (mass * (extent[1] ** 2 + extent[2] ** 2)) / 12,
        (mass * (extent[0] ** 2 + extent[2] ** 2)) / 12,
        (mass * (extent[0] ** 2 + extent[1] ** 2)) / 12,
      ],
      pos = toPhysics(o.transform.position);
    const b = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(pos.x, pos.y, pos.z)
        .setCanSleep(false),
    );
    b.setAdditionalMassProperties(
      mass,
      { x: 0, y: 0, z: 0 },
      { x: I[0], y: I[1], z: I[2] },
      { x: 0, y: 0, z: 0, w: 1 },
      true,
    );
    world.createCollider(
      RAPIER.ColliderDesc.trimesh(verts, g.indices).setMass(0),
      b,
    );
    b.recomputeMassPropertiesFromColliders();
    bodies.set(o.id, b);
    inertia.set(o.id, I);
    triangles += g.indices.length / 3;
  }
  return {
    world,
    bodies,
    inertia,
    triangles,
    graph: new NativeWinchCarrierConstraints(world, plan, bodies),
  };
}
const shaft = () => all.find((o) => o.node.ref === "3737.dat")!;
const shaftAxis = () =>
  toPhysicsDirection(
    plan.bearings.find((b) => b.shaft.occurrenceId === shaft().id)!.shaft.axis,
  );

it("allocates all 38 source bearings across 29 independent actual-geometry owners without suppressing contacts", () => {
  const { world, graph, triangles, bodies } = native();
  expect(triangles).toBe(34_729);
  expect(world.colliders.len()).toBe(29);
  expect(world.bodies.len()).toBe(29);
  expect(world.impulseJoints.len()).toBe(0);
  graph.beginStep(DT);
  expect(graph.snapshot().activeBearings).toBe(38);
  expect(graph.snapshot().activeKeys).toBe(20);
  expect(world.impulseJoints.len()).toBe(38);
  let heads = 0;
  world.impulseJoints.forEach((j) => {
    expect(j.contactsEnabled()).toBe(true);
    const isHead = plan.heads.some(
      (h) =>
        bodies.get(h.shaftId) === j.body2() &&
        bodies.get(h.supportId) === j.body1(),
    );
    const axial = new RAPIER.PrismaticImpulseJoint(
      world.impulseJoints.raw,
      world.bodies,
      j.handle,
    );
    expect(axial.limitsEnabled()).toBe(isHead);
    if (isHead) {
      heads++;
      expect(axial.limitsMin()).toBe(0);
      expect(axial.limitsMax()).toBe(1_000_000);
    }
  });
  expect(heads).toBe(3);
  expect(graph.snapshot().frictionModel).toBe("not-applied");
  expect(graph.snapshot().ordinaryAdmission).toBe(false);
  expect(
    () =>
      new NativeWinchCarrierConstraints(world, structuredClone(plan), bodies),
  ).toThrow();
  expect(world.impulseJoints.len()).toBe(38);
  expect(JSON.stringify(project)).toBe(unchanged);
  graph.dispose();
  expect(world.impulseJoints.len()).toBe(0);
  expect(world.colliders.len()).toBe(29);
});

it("removes every plain-axle radial/key constraint on predicted withdrawal and restores only the real seated source ports", () => {
  const { world, bodies, graph } = native(),
    b = bodies.get(shaft().id)!,
    axis = shaftAxis(),
    original = { ...b.translation() };
  graph.beginStep(DT);
  b.setLinvel({ x: axis.x * 600, y: axis.y * 600, z: axis.z * 600 }, true);
  graph.beginStep(DT);
  const released = graph
    .snapshot()
    .bearings.filter((s) => s.shaftId === shaft().id);
  expect(released).toHaveLength(13);
  expect(
    released.every(
      (s) =>
        s.current!.overlapLdu > 0 &&
        s.predicted!.overlapLdu < 0 &&
        !s.jointActive &&
        !s.keyActive,
    ),
  ).toBe(true);
  expect(graph.snapshot().activeBearings).toBe(25);
  expect(graph.snapshot().activeKeys).toBe(13);
  expect(world.impulseJoints.len()).toBe(25);
  expect(b.translation()).toEqual(original);
  expect(world.colliders.len()).toBe(29);
  b.setLinvel({ x: 0, y: 0, z: 0 }, true);
  graph.beginStep(DT);
  expect(graph.snapshot().activeBearings).toBe(38);
  expect(graph.snapshot().activeKeys).toBe(20);
  b.setTranslation(
    {
      x: original.x + axis.x * 10,
      y: original.y + axis.y * 10,
      z: original.z + axis.z * 10,
    },
    true,
  );
  graph.beginStep(DT);
  expect(graph.snapshot().activeBearings).toBe(25);
  expect(graph.snapshot().activeKeys).toBe(13);
});

it("restores responding keyed geometry on real phase mismatch and keeps predicted mismatch separate from seated reaction", () => {
  const { bodies, graph, world } = native(),
    b = bodies.get(shaft().id)!,
    axis = shaftAxis();
  b.setRotation(
    new Quaternion().setFromAxisAngle(
      new Vector3(axis.x, axis.y, axis.z),
      0.003,
    ),
    true,
  );
  graph.beginStep(DT);
  expect(graph.snapshot().activeBearings).toBe(38);
  expect(graph.snapshot().activeKeys).toBe(13);
  expect(
    graph
      .snapshot()
      .bearings.filter(
        (s) =>
          s.shaftId === shaft().id && plan.bearings[s.index].kind === "keyed",
      )
      .every((s) => !s.keyActive && s.current!.phaseErrorRadians > 0.002),
  ).toBe(true);
  b.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  b.setAngvel(
    {
      x: (axis.x * 0.005) / DT,
      y: (axis.y * 0.005) / DT,
      z: (axis.z * 0.005) / DT,
    },
    true,
  );
  graph.beginStep(DT);
  expect(graph.snapshot().activeKeys).toBe(20);
  expect(
    graph
      .snapshot()
      .bearings.filter(
        (s) =>
          s.shaftId === shaft().id && plan.bearings[s.index].kind === "keyed",
      )
      .every((s) => s.keyActive && s.predicted!.phaseErrorRadians > 0.002),
  ).toBe(true);
  // This helper never installs a contact exemption, including during an ideal
  // seated angular reaction. The actual source collider remains responding.
  world.colliders.forEach((c) => expect(c.activeHooks()).toBe(0));
});

it("returns keyed torque to actual mobile bore bodies with independent angular momentum and no source posing", () => {
  const { bodies, inertia, graph } = native(),
    input = all.find((o) => o.node.ref === "15462.dat")!,
    b = bodies.get(input.id)!,
    axis = toPhysicsDirection(
      plan.bearings.find((p) => p.shaft.occurrenceId === input.id)!.shaft.axis,
    );
  const rotation = vi.spyOn(b, "setRotation"),
    translation = vi.spyOn(b, "setTranslation"),
    impulse = 0.0001;
  b.applyTorqueImpulse(
    { x: axis.x * impulse, y: axis.y * impulse, z: axis.z * impulse },
    true,
  );
  graph.beginStep(DT);
  for (let pass = 0; pass < 8; pass++) graph.solvePass();
  const total = [0, 0, 0];
  for (const [id, b] of bodies) {
    const w = b.angvel(),
      I = inertia.get(id)!;
    total[0] += I[0] * w.x;
    total[1] += I[1] * w.y;
    total[2] += I[2] * w.z;
  }
  for (const [i, a] of [axis.x, axis.y, axis.z].entries())
    expect(total[i]).toBeCloseTo(a * impulse, 8);
  const boreOwners = plan.bearings
    .filter((p) => p.kind === "keyed" && p.shaft.occurrenceId === input.id)
    .map((p) => p.bore.occurrenceId);
  expect(
    boreOwners.some(
      (id) => Math.hypot(...Object.values(bodies.get(id)!.angvel())) > 1e-4,
    ),
  ).toBe(true);
  expect(rotation).not.toHaveBeenCalled();
  expect(translation).not.toHaveBeenCalled();
  expect(JSON.stringify(project)).toBe(unchanged);
});
