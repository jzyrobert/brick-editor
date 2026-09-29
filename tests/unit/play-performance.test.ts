import { describe, expect, it } from "vitest";
import { PlaySession } from "../../src/play/session";
import { compactCollisionMesh } from "../../src/play/collision-mesh";
import type { CollisionSnapshot } from "../../src/play/types";

type Soup = { vertices: number[]; indices: number[] };
/** Axis-aligned quad as a triangle soup, optionally with the loader's reversed twin. */
function quad(soup: Soup, corners: number[][], twin: boolean) {
  const add = (order: number[]) => {
    for (const i of order) {
      soup.indices.push(soup.vertices.length / 3);
      soup.vertices.push(...corners[i]);
    }
  };
  add([0, 1, 2]);
  add([0, 2, 3]);
  if (twin) {
    add([0, 2, 1]);
    add([0, 3, 2]);
  }
}
/** A wall at z = -40 facing the spawn, plus a low step, all non-certified (twinned). */
function wallWorld(twin: boolean): CollisionSnapshot {
  const soup: Soup = { vertices: [], indices: [] };
  quad(
    soup,
    [
      [-200, 0, -40],
      [200, 0, -40],
      [200, -200, -40],
      [-200, -200, -40],
    ],
    twin,
  );
  // 8 LDU step: riser facing -X and its tread.
  quad(
    soup,
    [
      [60, 0, 20],
      [60, 0, -20],
      [60, -8, -20],
      [60, -8, 20],
    ],
    twin,
  );
  quad(
    soup,
    [
      [60, -8, 20],
      [120, -8, 20],
      [120, -8, -20],
      [60, -8, -20],
    ],
    twin,
  );
  return {
    revision: 3,
    vertices: new Float32Array(soup.vertices),
    indices: new Uint32Array(soup.indices),
    bounds: { min: [-200, -200, -40], max: [200, 0, 20] },
  };
}

describe("Play collision compaction", () => {
  it("welds exact corners, drops reversed twins, duplicates and zero-area faces", () => {
    const soup: Soup = { vertices: [], indices: [] };
    const corners = [
      [0, 0, 0],
      [10, 0, 0],
      [10, -10, 0],
      [0, -10, 0],
    ];
    quad(soup, corners, true);
    // An exact duplicate whose zero coordinates are written as -0 must still weld.
    quad(
      soup,
      corners.map((c) => c.map((v) => (v === 0 ? -0 : v))),
      false,
    );
    // Zero-area (collinear) sliver.
    soup.indices.push(0, 1, soup.vertices.length / 3);
    soup.vertices.push(20, 0, 0);
    const compact = compactCollisionMesh(soup.vertices, soup.indices);
    expect(compact.stats).toEqual({
      inputTriangles: 7,
      triangles: 2,
      inputVertices: 19,
      vertices: 5,
      duplicateTriangles: 4,
      degenerateTriangles: 1,
    });
    // Kept faces are the first occurrences, in source winding.
    const corner = (i: number) =>
      [...compact.vertices.subarray(i * 3, i * 3 + 3)].map((v) => v + 0);
    expect([...compact.indices].map(corner)).toEqual([
      corners[0],
      corners[1],
      corners[2],
      corners[0],
      corners[2],
      corners[3],
    ]);
  });

  it("walks, blocks and steps identically with or without reversed twins", async () => {
    const run = async (twin: boolean) => {
      const s = await PlaySession.create(wallWorld(twin), {
        position: [0, -0.3, 60],
      });
      const trace: unknown[] = [];
      s.setInput({ moveZ: 1 });
      for (let i = 0; i < 12; i++) trace.push(s.stepTicks(10).position);
      s.teleport({ position: [20, -0.3, 0], yaw: Math.PI / 2 });
      s.setInput({ moveZ: 1, yaw: Math.PI / 2 });
      for (let i = 0; i < 12; i++) trace.push(s.stepTicks(10).position);
      const stats = s.collisionStats();
      s.dispose();
      return { trace, stats };
    };
    const twinned = await run(true),
      single = await run(false);
    expect(twinned.trace).toEqual(single.trace);
    // The wall stopped the walker before z = -40 + radius.
    expect((twinned.trace[11] as number[])[2]).toBeGreaterThan(-40 + 7);
    // The 8 LDU step was climbed (after 30 ticks at 145 LDU/s the walker is
    // on the tread).
    expect((twinned.trace[14] as number[])[0]).toBeGreaterThan(70);
    expect((twinned.trace[14] as number[])[1]).toBeCloseTo(-8, 0);
    expect(twinned.stats.static).toMatchObject({
      inputTriangles: 12,
      triangles: 6,
      duplicateTriangles: 6,
    });
    expect(single.stats.static?.triangles).toBe(6);
  });

  it("enters a dense many-raw-face world within budget with one static collider", async () => {
    // ~18k small twinned raw faces (72k input triangles), like a detailed facade.
    const soup: Soup = { vertices: [], indices: [] };
    for (let x = 0; x < 120; x++)
      for (let y = 0; y < 150; y++) {
        const z = -40 - (x % 3);
        quad(
          soup,
          [
            [x * 2 - 120, -y * 2, z],
            [x * 2 - 118, -y * 2, z],
            [x * 2 - 118, -y * 2 - 2, z],
            [x * 2 - 120, -y * 2 - 2, z],
          ],
          true,
        );
      }
    const world: CollisionSnapshot = {
      revision: 1,
      vertices: new Float32Array(soup.vertices),
      indices: new Uint32Array(soup.indices),
      bounds: { min: [-120, -300, -42], max: [120, 0, -40] },
    };
    const started = performance.now();
    const s = await PlaySession.create(world, { position: [0, -0.3, 0] });
    const enterMs = performance.now() - started;
    const stats = s.collisionStats();
    // Static world + session ground + character sensor; never one per face.
    expect(stats.colliders).toBe(3);
    expect(stats.static).toMatchObject({
      inputTriangles: 72000,
      triangles: 36000,
    });
    expect(enterMs).toBeLessThan(2000);
    s.setInput({ moveZ: 1 });
    const tickStart = performance.now();
    s.stepTicks(60);
    expect((performance.now() - tickStart) / 60).toBeLessThan(20);
    expect(s.snapshot().position[2]).toBeGreaterThan(-40 + 7);
    s.dispose();
  });
});

describe("Play realtime catch-up", () => {
  it("runs up to six ticks per frame and drops the backlog once over budget", async () => {
    const empty: CollisionSnapshot = {
      revision: 1,
      vertices: new Float32Array(),
      indices: new Uint32Array(),
      bounds: { min: [-10, 0, -10], max: [10, 0, 10] },
    };
    const a = await PlaySession.create(empty, { position: [0, -0.3, 0] });
    expect(a.advance(0.1)).toBe(6);
    const b = await PlaySession.create(empty, { position: [0, -0.3, 0] });
    // Any tick exceeds a vanishing budget: one tick runs and whole-tick debt is dropped.
    expect(b.advance(0.1, Number.MIN_VALUE)).toBe(1);
    expect(b.advance(0, Number.MIN_VALUE)).toBe(0);
    expect(b.snapshot().tick - a.snapshot().tick).toBe(-5);
    expect(() => b.advance(0.01, 0)).toThrow(/budget/);
    a.dispose();
    b.dispose();
  });
});
