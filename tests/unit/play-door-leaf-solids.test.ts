import { ConvexHull } from "three/examples/jsm/math/ConvexHull.js";
import { Vector3 } from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, expect, it } from "vitest";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { deriveDoorRigs } from "../../src/play/auto-doors";
import {
  MechanicalContactPolicy,
  mechanicalSolids,
} from "../../src/play/mechanical-solids";
import { doorLeafSolids } from "../../src/play/door-leaf-solids";
import { toPhysics } from "../../src/play/physics-frame";
import { add, inverse, mv } from "../../src/core/math";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "../../scripts/full-library-node";
import { playSources } from "../helpers/play-dynamic-source";
import { PlaySession } from "../../src/play/session";
import type { CollisionSnapshot } from "../../src/play/types";
import type { Vec3 } from "../../src/core/types";

beforeAll(async () => {
  registerFullLibraryFromDisk();
  await RAPIER.init();
});

async function fixture() {
  const project = importLDraw(
    "0 Door support probe\n" +
      "1 15 0 -152 -770 1 0 0 0 1 0 0 0 1 60596.dat\n" +
      "1 4 -32 -152 -765 1 0 0 0 1 0 0 0 1 60616a.dat\n",
    "door-support.ldr",
  );
  const derived = deriveDoorRigs(project, {
    all: occurrences(project),
    reserved: new Set(),
    maxRigs: 32,
    maxGroups: 128,
  });
  expect(derived.doors).toHaveLength(1);
  project.motionRigs = derived.rigs;
  const { sources } = await playSources(
    project,
    Object.keys(derived.rigs),
    fullLibrarySources(["60596.dat", "60616a.dat"]),
  );
  return { project, source: sources[0], derived };
}

it("keeps all actual door surface points while leaving the below-floor pin local to its hinge", async () => {
  const { project, source, derived } = await fixture(),
    before = JSON.stringify(project),
    id = derived.doors[0].occurrenceId,
    original = source.members![id],
    originalBuffer = original.vertices.slice(),
    occurrence = occurrences(project).find((o) => o.id === id)!,
    solids = mechanicalSolids(
      source,
      new MechanicalContactPolicy(project.motionRigs[source.rigId], source),
    ),
    world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  try {
    expect(solids).toHaveLength(5);
    expect(
      solids.every((s) => s.shape instanceof RAPIER.ConvexPolyhedron),
    ).toBe(true);
    expect(solids.every((s) => s.mating.size === 0)).toBe(true);
    const colliders = solids.map((s) =>
        world.createCollider(new RAPIER.ColliderDesc(s.shape)),
      ),
      frame = project.motionRigs[source.rigId].groups.find(
        (g) => g.id === solids[0].groupId,
      )!.frame,
      inv = inverse(frame);
    // Actual source vertices and triangle interiors retain their conservative
    // source cover; this includes broad body-end faces and both real pins.
    const samples: Vec3[] = [];
    for (let i = 0; i < original.vertices.length; i += 3)
      samples.push(Array.from(original.vertices.slice(i, i + 3)) as Vec3);
    for (let i = 0; i < original.indices.length; i += 3)
      samples.push(
        [0, 1, 2].map(
          (k) =>
            (original.vertices[3 * original.indices[i] + k] +
              original.vertices[3 * original.indices[i + 1] + k] +
              original.vertices[3 * original.indices[i + 2] + k]) /
            3,
        ) as Vec3,
      );
    const hulls = solids.map((s) =>
      new ConvexHull().setFromPoints(
        Array.from(
          { length: s.points.length / 3 },
          (_, i) =>
            new Vector3(
              s.points[3 * i],
              s.points[3 * i + 1],
              s.points[3 * i + 2],
            ),
        ),
      ),
    );
    for (const p of samples) {
      const q = toPhysics(add(inv.position, mv(inv.basis, p))),
        point = new Vector3(q.x, q.y, q.z);
      expect(
        Math.min(
          ...hulls.map((h) =>
            Math.max(...h.faces.map((f) => f.normal.dot(point) - f.constant)),
          ),
        ),
      ).toBeLessThan(0.001 * 0.02);
    }
    // Direct native rays check each small pin's retained axial support. A
    // point-projection query at a faceted corner is numerically unreliable
    // in the pinned engine; this uses the actual admitted native shape.
    expect(
      colliders[0].castRay(
        new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }),
        3,
        true,
      ),
    ).toBeCloseTo(3.25 * 0.02, 6);
    expect(
      colliders[4].castRay(
        new RAPIER.Ray({ x: 0, y: -3, z: 0 }, { x: 0, y: 1, z: 0 }),
        1,
        true,
      ),
    ).toBeCloseTo(3 - 136.75 * 0.02, 6);
    const bottomPin = solids.find((s) => s.bounds.max[1] < -136 * 0.02 + 1e-6)!;
    expect(bottomPin).toBeDefined();
    expect(bottomPin.bounds.min[0]).toBeGreaterThanOrEqual(-2 * 0.02 - 1e-6);
    expect(bottomPin.bounds.max[0]).toBeLessThanOrEqual(2 * 0.02 + 1e-6);
    expect(bottomPin.bounds.min[2]).toBeGreaterThanOrEqual(-2 * 0.02 - 1e-6);
    expect(bottomPin.bounds.max[2]).toBeLessThanOrEqual(2 * 0.02 + 1e-6);
    // This was inside the former whole-part wedge. It is below the broad
    // body's real bottom and far from the actual hinge pin.
    expect(
      colliders.some((c) =>
        c.containsPoint({ x: 60 * 0.02, y: -136.3 * 0.02, z: 0 }),
      ),
    ).toBe(false);
    expect(original.vertices).toEqual(originalBuffer);
    expect(JSON.stringify(project)).toBe(before);
    const legacy = { ...source, memberLocals: undefined };
    const withoutLocals = mechanicalSolids(
      legacy,
      new MechanicalContactPolicy(project.motionRigs[source.rigId], legacy),
    );
    expect(withoutLocals.map((s) => [...s.points])).toEqual(
      solids.map((s) => [...s.points]),
    );
  } finally {
    world.free();
  }
}, 15000);

it("refuses excess clipping work and leaves captured door geometry intact", async () => {
  const { project, source, derived } = await fixture(),
    id = derived.doors[0].occurrenceId,
    mesh = source.members![id],
    before = mesh.vertices.slice(),
    occurrence = occurrences(project).find((o) => o.id === id)!;
  expect(() =>
    doorLeafSolids(
      mesh,
      occurrence,
      { value: 0 },
      { clippingWork: 1, sourcePointsPerMember: 16384 },
    ),
  ).toThrow(/fewer moving parts/);
  expect(mesh.vertices).toEqual(before);
  expect(
    doorLeafSolids(
      mesh,
      { ...occurrence, namespace: "project" },
      { value: 0 },
      { clippingWork: 200000, sourcePointsPerMember: 16384 },
    ),
  ).toBeUndefined();
});

function floorAndBlocker(blocked: boolean): CollisionSnapshot {
  const vertices = [
      -200, -16, -760, 200, -16, -760, 200, -16, -600, -200, -16, -600,
    ],
    indices = [0, 2, 1, 0, 3, 2];
  if (blocked) {
    // A genuine thin foreign wall in the opening sweep, well above the floor.
    const base = vertices.length / 3;
    vertices.push(
      -10,
      -140,
      -740,
      50,
      -140,
      -740,
      50,
      -30,
      -740,
      -10,
      -30,
      -740,
    );
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return {
    revision: 0,
    vertices: Float32Array.from(vertices),
    indices: Uint32Array.from(indices),
    bounds: { min: [-200, -200, -800], max: [200, 0, -500] },
  };
}

it.each([false, true])(
  "opens the actual pin-supported door along its floor and still stops at a foreign wall (wall=%s)",
  async (blocked) => {
    const { project, source } = await fixture(),
      before = JSON.stringify(project),
      memberBuffers = Object.values(source.members!).map((m) => [
        ...m.vertices,
      ]),
      session = await PlaySession.create(
        floorAndBlocker(blocked),
        {
          rigIds: [source.rigId],
          position: [150, -16.3, -650],
        },
        [source],
      );
    try {
      session.setJointTarget({
        rigId: source.rigId,
        jointId: "door",
        target: 90,
        speed: 180,
      });
      session.stepTicks(40);
      const snapshot = session.snapshot().mechanisms![source.rigId];
      if (blocked) {
        expect(snapshot.pose.jointPositions.door).toBeGreaterThan(5);
        expect(snapshot.pose.jointPositions.door).toBeLessThan(60);
        expect(snapshot.jointTargets!.door.status).toBe("blocked");
      } else {
        expect(snapshot.pose.jointPositions.door).toBe(90);
        expect(snapshot.jointTargets!.door.status).toBe("complete");
        session.setJointTarget({
          rigId: source.rigId,
          jointId: "door",
          target: 0,
          speed: 180,
        });
        session.stepTicks(40);
        expect(
          session.snapshot().mechanisms![source.rigId].pose.jointPositions.door,
        ).toBe(0);
      }
      expect(JSON.stringify(project)).toBe(before);
      expect(
        Object.values(source.members!).map((m) => [...m.vertices]),
      ).toEqual(memberBuffers);
    } finally {
      session.dispose();
    }
  },
  15000,
);

it("blocks a floor raised above the real body bottom instead of treating it as support", async () => {
  const { project, source } = await fixture(),
    before = JSON.stringify(project),
    geometry = floorAndBlocker(false);
  for (let i = 1; i < geometry.vertices.length; i += 3)
    geometry.vertices[i] = -16.01;
  const session = await PlaySession.create(
    geometry,
    { rigIds: [source.rigId], position: [150, -16.3, -650] },
    [source],
  );
  try {
    session.setJointTarget({
      rigId: source.rigId,
      jointId: "door",
      target: 90,
      speed: 180,
    });
    session.stepTicks(40);
    const snapshot = session.snapshot().mechanisms![source.rigId];
    expect(snapshot.pose.jointPositions.door).toBeLessThan(10);
    expect(snapshot.jointTargets!.door.status).toBe("blocked");
    expect(JSON.stringify(project)).toBe(before);
  } finally {
    session.dispose();
  }
}, 15000);

it("retries after a thin foreign native blocker is removed, retaining its source pose", async () => {
  const { project, source } = await fixture(),
    before = JSON.stringify(project),
    session = await PlaySession.create(
      floorAndBlocker(false),
      { rigIds: [source.rigId], position: [150, -16.3, -650] },
      [source],
    ),
    world = (session as unknown as { world: RAPIER.World }).world,
    p = toPhysics([20, -85, -740]),
    wall = world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        30 * 0.02,
        55 * 0.02,
        0.05 * 0.02,
      ).setTranslation(p.x, p.y, p.z),
    );
  try {
    session.setJointTarget({
      rigId: source.rigId,
      jointId: "door",
      target: 90,
      speed: 180,
    });
    session.stepTicks(40);
    const stopped = session.snapshot().mechanisms![source.rigId];
    expect(stopped.pose.jointPositions.door).toBeGreaterThan(5);
    expect(stopped.pose.jointPositions.door).toBeLessThan(60);
    expect(stopped.jointTargets!.door.status).toBe("blocked");
    world.removeCollider(wall, false);
    session.setJointTarget({
      rigId: source.rigId,
      jointId: "door",
      target: 90,
      speed: 180,
    });
    session.stepTicks(40);
    const retried = session.snapshot().mechanisms![source.rigId];
    expect(retried.pose.jointPositions.door).toBe(90);
    expect(retried.jointTargets!.door.status).toBe("complete");
    session.setJointTarget({
      rigId: source.rigId,
      jointId: "door",
      target: 0,
      speed: 180,
    });
    session.stepTicks(40);
    expect(
      session.snapshot().mechanisms![source.rigId].groupFrames["leaf-1"],
    ).toEqual(project.motionRigs[source.rigId].groups[1].frame);
    expect(JSON.stringify(project)).toBe(before);
  } finally {
    session.dispose();
  }
}, 15000);
