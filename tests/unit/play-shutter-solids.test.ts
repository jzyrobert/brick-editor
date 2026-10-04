import RAPIER from "@dimforge/rapier3d-compat";
import { ConvexHull } from "three/examples/jsm/math/ConvexHull.js";
import { Vector3 } from "three";
import { readFileSync } from "node:fs";
import { beforeAll, expect, it } from "vitest";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { add, inverse, mv } from "../../src/core/math";
import type { Vec3 } from "../../src/core/types";
import { deriveDoorRigs } from "../../src/play/auto-doors";
import { PlaySession } from "../../src/play/session";
import { toPhysics } from "../../src/play/physics-frame";
import {
  MechanicalContactPolicy,
  mechanicalSolids,
} from "../../src/play/mechanical-solids";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { playSources } from "../helpers/play-dynamic-source";

beforeAll(async () => {
  registerFullLibraryFromDisk();
  await RAPIER.init();
});

async function fixture(reverse = false, rotated = false) {
  const source = rotated
    ? "0 FILE root.mpd\n1 16 120 -70 -150 0 0 -1 0 1 0 1 0 0 house.ldr\n0 FILE house.ldr\n"
    : "0 Shutter source probe\n";
  const project = importLDraw(
    source +
      "1 14 0 -48 30 1 0 0 0 1 0 0 0 1 3581.dat\n" +
      `1 4 0 -48 17 ${reverse ? "0 0 1 0 1 0 -1 0 0" : "0 0 -1 0 1 0 1 0 0"} 3582.dat\n`,
    "shutter.mpd",
  );
  const derived = deriveDoorRigs(project, {
    all: occurrences(project),
    reserved: new Set(),
    maxRigs: 32,
    maxGroups: 128,
  });
  expect(derived.doors).toHaveLength(1);
  project.motionRigs = derived.rigs;
  const result = await playSources(
    project,
    Object.keys(derived.rigs),
    fullLibrarySources(["3581.dat", "3582.dat"]),
  );
  return { project, derived, ...result };
}

it("retains every shutter surface point and native end support without convex-filling its axial relief", async () => {
  const { project, sources, derived } = await fixture(),
    source = sources[0],
    before = JSON.stringify(project),
    member = source.members![derived.doors[0].occurrenceId],
    buffer = member.vertices.slice(),
    solids = mechanicalSolids(
      source,
      new MechanicalContactPolicy(project.motionRigs[source.rigId], source),
    ),
    frame = project.motionRigs[source.rigId].groups.find(
      (g) => g.id === "leaf-1",
    )!.frame,
    inv = inverse(frame),
    world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  try {
    expect(solids).toHaveLength(3);
    expect(solids.every((s) => s.shutterCover && s.mating.size === 0)).toBe(
      true,
    );
    const hulls = solids.map((s) =>
      new ConvexHull().setFromPoints(
        Array.from(
          { length: s.points.length / 3 },
          (_, i) =>
            new Vector3(
              ...(Array.from(s.points.slice(3 * i, 3 * i + 3)) as Vec3),
            ),
        ),
      ),
    );
    const samples: Vec3[] = [];
    for (let i = 0; i < member.vertices.length; i += 3)
      samples.push(Array.from(member.vertices.slice(i, i + 3)) as Vec3);
    for (let i = 0; i < member.indices.length; i += 3)
      samples.push(
        [0, 1, 2].map(
          (k) =>
            (member.vertices[3 * member.indices[i] + k] +
              member.vertices[3 * member.indices[i + 1] + k] +
              member.vertices[3 * member.indices[i + 2] + k]) /
            3,
        ) as Vec3,
      );
    for (const p of samples) {
      const q = toPhysics(add(inv.position, mv(inv.basis, p))),
        v = new Vector3(q.x, q.y, q.z);
      expect(
        Math.min(
          ...hulls.map((h) =>
            Math.max(...h.faces.map((f) => f.normal.dot(v) - f.constant)),
          ),
        ),
      ).toBeLessThan(0.001 * 0.02);
    }
    const colliders = solids.map((s) =>
      world.createCollider(new RAPIER.ColliderDesc(s.shape)),
    );
    // The two end bands retain the actual panel but not the middle spine loft.
    expect(
      colliders.some((c) => c.containsPoint({ x: 0, y: -2 * 0.02, z: 0 })),
    ).toBe(false);
    expect(
      colliders.some((c) => c.containsPoint({ x: 0, y: -46 * 0.02, z: 0 })),
    ).toBe(false);
    expect(
      colliders[0].castRay(
        new RAPIER.Ray({ x: 0, y: -2 * 0.02, z: 0 }, { x: 0, y: 0, z: 1 }),
        1,
        true,
      ),
    ).toBeCloseTo(4 * 0.02, 6);
    expect(
      colliders[2].castRay(
        new RAPIER.Ray({ x: 0, y: -46 * 0.02, z: 0 }, { x: 0, y: 0, z: 1 }),
        1,
        true,
      ),
    ).toBeCloseTo(4 * 0.02, 6);
    const legacy = { ...source, memberLocals: undefined };
    expect(
      mechanicalSolids(
        legacy,
        new MechanicalContactPolicy(project.motionRigs[source.rigId], legacy),
      ).map((s) => [...s.points]),
    ).toEqual(solids.map((s) => [...s.points]));
    expect(member.vertices).toEqual(buffer);
    expect(JSON.stringify(project)).toBe(before);
  } finally {
    world.free();
  }
});

it.each([
  [false, false],
  [true, false],
  [false, true],
])(
  "chooses the real free side from source covers (reverse=%s, rotated=%s)",
  async (reverse, rotated) => {
    const { project, derived, geometry, sources } = await fixture(
        reverse,
        rotated,
      ),
      before = JSON.stringify(project),
      buffers = sources.map((s) =>
        Object.values(s.members!).map((m) => [...m.vertices]),
      ),
      session = await PlaySession.create(
        geometry,
        { rigIds: Object.keys(derived.rigs), position: [-300, -0.3, 200] },
        sources,
        derived,
      );
    try {
      const door = session.snapshot().autoDoors!.doors[0],
        target = reverse ? 60 : -60;
      expect(door.swing).toBe(reverse ? "positive" : "negative");
      expect(
        session.snapshot().mechanisms![door.rigId].pose.jointPositions.door,
      ).toBe(0);
      session.setJointTarget({
        rigId: door.rigId,
        jointId: door.jointId,
        target,
        speed: 90,
      });
      session.stepTicks(60);
      expect(
        session.snapshot().mechanisms![door.rigId].pose.jointPositions.door,
      ).toBe(target);
      expect(
        session.snapshot().mechanisms![door.rigId].jointTargets!.door.status,
      ).toBe("complete");
      session.setJointTarget({
        rigId: door.rigId,
        jointId: door.jointId,
        target: 0,
        speed: 90,
      });
      session.stepTicks(60);
      const closing = session.snapshot().mechanisms![door.rigId];
      // Near the source end-panel/holder tangent, bounded predictive checks
      // conservatively stop short. This does not certify physical obstruction
      // at that angle or exact zero closing; the holder remains responding.
      expect(Math.abs(closing.pose.jointPositions.door)).toBeLessThan(3);
      expect(closing.jointTargets!.door.status).toBe("blocked");
      session.setJointTarget({
        rigId: door.rigId,
        jointId: door.jointId,
        target,
        speed: 90,
      });
      session.stepTicks(60);
      expect(
        session.snapshot().mechanisms![door.rigId].pose.jointPositions.door,
      ).toBe(target);
      expect(JSON.stringify(project)).toBe(before);
      expect(
        sources.map((s) =>
          Object.values(s.members!).map((m) => [...m.vertices]),
        ),
      ).toEqual(buffers);
    } finally {
      session.dispose();
    }
  },
  20000,
);

it("keeps the real positive holder stop and a thin foreign wall, then retries after the wall is removed", async () => {
  const { project, derived, geometry, sources } = await fixture(),
    before = JSON.stringify(project),
    door = derived.doors[0],
    session = await PlaySession.create(
      geometry,
      { rigIds: [door.rigId], position: [-300, -0.3, 200] },
      sources,
    );
  try {
    session.setJointTarget({
      rigId: door.rigId,
      jointId: door.jointId,
      target: 3,
      speed: 90,
    });
    session.stepTicks(10);
    expect(
      session.snapshot().mechanisms![door.rigId].pose.jointPositions.door,
    ).toBeLessThan(1);
    expect(
      session.snapshot().mechanisms![door.rigId].jointTargets!.door.status,
    ).toBe("blocked");
    const world = (session as unknown as { world: RAPIER.World }).world,
      wall = world.createCollider(
        RAPIER.ColliderDesc.cuboid(
          40 * 0.02,
          30 * 0.02,
          0.05 * 0.02,
        ).setTranslation(20 * 0.02, 24 * 0.02, 0),
      );
    session.setJointTarget({
      rigId: door.rigId,
      jointId: door.jointId,
      target: -60,
      speed: 90,
    });
    session.stepTicks(60);
    const stopped = session.snapshot().mechanisms![door.rigId];
    expect(stopped.pose.jointPositions.door).toBeLessThan(-5);
    expect(stopped.pose.jointPositions.door).toBeGreaterThan(-60);
    expect(stopped.jointTargets!.door.status).toBe("blocked");
    world.removeCollider(wall, true);
    session.setJointTarget({
      rigId: door.rigId,
      jointId: door.jointId,
      target: -60,
      speed: 90,
    });
    session.stepTicks(60);
    expect(
      session.snapshot().mechanisms![door.rigId].pose.jointPositions.door,
    ).toBe(-60);
    expect(
      session.snapshot().mechanisms![door.rigId].jointTargets!.door.status,
    ).toBe("complete");
    expect(JSON.stringify(project)).toBe(before);
  } finally {
    session.dispose();
  }
}, 20000);

it("classifies both unchanged shutters in the original nested official-model study without offering their blocked side", async () => {
  const project = importLDraw(
      readFileSync("fixtures/ldraw/omr-doors.mpd", "utf8"),
      "door-study.mpd",
    ),
    all = occurrences(project),
    derived = deriveDoorRigs(project, {
      all,
      reserved: new Set(),
      maxRigs: 32,
      maxGroups: 128,
    });
  project.motionRigs = derived.rigs;
  const { geometry, sources } = await playSources(
      project,
      Object.keys(derived.rigs),
      fullLibrarySources(
        all.filter((o) => o.namespace === "official").map((o) => o.node.ref),
      ),
    ),
    before = JSON.stringify(project),
    session = await PlaySession.create(
      geometry,
      { rigIds: Object.keys(derived.rigs), position: [0, -0.3, 300] },
      sources,
      derived,
    );
  try {
    const shutters = session
      .snapshot()
      .autoDoors!.doors.filter((d) => d.part === "3582");
    expect(shutters).toHaveLength(2);
    for (const door of shutters) {
      expect(door.swing).toBe("negative");
      session.setJointTarget({
        rigId: door.rigId,
        jointId: door.jointId,
        target: -60,
        speed: 90,
      });
    }
    session.stepTicks(60);
    for (const door of shutters)
      expect(
        session.snapshot().mechanisms![door.rigId].pose.jointPositions.door,
      ).toBe(-60);
    expect(JSON.stringify(project)).toBe(before);
  } finally {
    session.dispose();
  }
}, 30000);
