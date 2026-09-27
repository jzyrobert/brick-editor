import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, expect, it } from "vitest";
import {
  DrivingObstacleSnapshot,
  type DrivingTriangleSource,
} from "../../src/play/vehicle-obstacles";
import type { DrivingBox } from "../../src/play/vehicle-collision";
beforeAll(async () => {
  await RAPIER.init();
});
const box: DrivingBox[] = [
  { center: [0, 0.1, 0], halfExtents: [0.1, 0.1, 0.1] },
];
const pose = { x: 0, y: 0, z: 0, yaw: 0 };
function source(
  vertices: number[],
  indices: number[],
  id = "room",
): DrivingTriangleSource {
  return {
    sourceId: id,
    units: "metres",
    up: "+Y",
    owner: { kind: "static" },
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
  };
}
function room() {
  return source(
    [
      -10, 0, -10, 10, 0, -10, 10, 0, 10, -10, 0, 10, -1, 0, 2, 1, 0, 2, 1, 1,
      2, -1, 1, 2,
    ],
    [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7],
  );
}
it("complete mixed floor/wall mesh allows ground travel then blocks zero-thickness wall with source provenance", () => {
  const original = room();
  const snapshot = new DrivingObstacleSnapshot([original]);
  expect(snapshot.totalTriangles).toBe(4);
  expect(snapshot.sweep("car", box, pose, { ...pose, z: 1 })).toMatchObject({
    accepted: true,
    totalTriangles: 4,
    units: "metres",
  });
  const blocked = snapshot.sweep("car", box, pose, { ...pose, z: 3 });
  expect(blocked).toMatchObject({
    accepted: false,
    reason: "contact",
    obstacle: { sourceId: "room" },
  });
  expect(blocked.obstacle!.triangleIndex).toBeGreaterThanOrEqual(2);
  original.vertices.fill(999);
  expect(snapshot.sweep("car", box, pose, { ...pose, z: 3 }).accepted).toBe(
    false,
  );
});
it("sloped triangle support is conservatively blocked rather than granting a floor exemption", () => {
  const ramp = source(
    [-2, 0, -2, 2, 0, -2, 2, 0.5, 2, -2, 0.5, 2],
    [0, 2, 1, 0, 3, 2],
    "ramp",
  );
  const snapshot = new DrivingObstacleSnapshot([ramp]);
  expect(
    snapshot.sweep("car", box, { ...pose, z: -2.2 }, { ...pose, z: 2 }),
  ).toMatchObject({
    accepted: false,
    reason: "contact",
    obstacle: { sourceId: "ramp" },
  });
});
it("dense overlapping triangles refuse atomically without a truncated successful collision set", () => {
  const dense = source(
    [-1, 0, -1, 1, 0, -1, 0, 0, 1],
    Array.from({ length: 600 }, () => [0, 1, 2]).flat(),
  );
  const snapshot = new DrivingObstacleSnapshot([dense]);
  expect(snapshot.totalTriangles).toBe(600);
  expect(snapshot.sweep("car", box, pose, { ...pose, z: 0.1 })).toMatchObject({
    accepted: false,
    reason: "work-budget",
    queries: 0,
    totalTriangles: 600,
    candidateTriangles: 512,
  });
  expect(() => new DrivingObstacleSnapshot([dense], 599)).toThrow(
    /complete geometry budget/,
  );
});
it("BVH skips remote dense geometry without dropping it, and preserves foreign-rig collisions", () => {
  const vertices: number[] = [],
    indices: number[] = [];
  for (let i = 0; i < 10000; i++) {
    const x = 100 + i * 0.5,
      base = vertices.length / 3;
    vertices.push(x, 0, 0, x + 0.1, 0, 0, x, 1, 0.1);
    indices.push(base, base + 1, base + 2);
  }
  const foreign = room();
  foreign.owner = { kind: "rig", rigId: "other" };
  const snapshot = new DrivingObstacleSnapshot([
    source(vertices, indices, "distant"),
    foreign,
  ]);
  const blocked = snapshot.sweep("car", box, pose, { ...pose, z: 3 });
  expect(blocked).toMatchObject({ accepted: false, totalTriangles: 10004 });
  expect(blocked.visitedBvhNodes).toBeLessThan(100);
  expect(blocked.candidateTriangles).toBeLessThan(10);
  expect(snapshot.sweep("other", box, pose, { ...pose, z: 3 }).accepted).toBe(
    true,
  );
});
it("validates source units, IDs and complete triangle references before snapshot allocation", () => {
  expect(
    () =>
      new DrivingObstacleSnapshot([{ ...room(), units: "LDU" as "metres" }]),
  ).toThrow(/metre/);
  expect(() => new DrivingObstacleSnapshot([room(), room()])).toThrow(
    /distinct/,
  );
  expect(
    () => new DrivingObstacleSnapshot([source([0, 0, 0], [0, 1, 2])]),
  ).toThrow(/vertex\/index/);
});
it("rejects source coordinates outside the bounded Rapier metre domain", () => {
  expect(
    () =>
      new DrivingObstacleSnapshot([
        source([1e40, 0, 0, 0, 0, 0, 1, 0, 0], [0, 1, 2]),
      ]),
  ).toThrow(/vertex\/index/);
  expect(
    () =>
      new DrivingObstacleSnapshot([
        source([10001, 0, 0, 0, 0, 0, 1, 0, 0], [0, 1, 2]),
      ]),
  ).toThrow(/vertex\/index/);
});
it("covers offset-center rotation with simultaneous translation against actor-owned geometry", () => {
  const x = Math.cos(0.5) + 0.1,
    z = -Math.sin(0.5);
  const triangle = source(
    [x - 0.005, 0.1, z, x + 0.005, 0.1, z, x, 0.3, z],
    [0, 1, 2],
    "actor-shape",
  );
  triangle.owner = { kind: "actor" };
  const snapshot = new DrivingObstacleSnapshot([triangle]);
  const offset: DrivingBox[] = [
    { center: [1, 0.2, 0], halfExtents: [0.02, 0.05, 0.02] },
  ];
  const start = { ...pose, yaw: 0.3 },
    end = { ...pose, x: 0.2, yaw: 0.7 };
  expect(snapshot.sweep("car", offset, start, start).accepted).toBe(true);
  expect(snapshot.sweep("car", offset, end, end).accepted).toBe(true);
  expect(snapshot.sweep("car", offset, start, end)).toMatchObject({
    accepted: false,
    reason: "contact",
    obstacle: { sourceId: "actor-shape", triangleIndex: 0 },
  });
});
