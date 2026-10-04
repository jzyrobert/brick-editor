import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, expect, it } from "vitest";
import {
  prepareReviewedConvexRegions,
  type ReviewedConvexRegion,
} from "../../src/play/reviewed-convex-packet";

beforeAll(async () => {
  await RAPIER.init();
});
const rank3 = (): ReviewedConvexRegion => ({
  id: 0,
  rank: 3,
  position: [0, 0, 0],
  vertices: [
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    Math.fround(1e-6),
    0,
    0,
    Math.fround(1e-6),
  ],
  triangles: [0, 2, 1, 0, 1, 4, 0, 4, 2, 1, 2, 4],
  extremes: [],
  planeClass: 0,
});
it("keeps explicit thin support, deduplicates exact IDs and counts every rank-two fan leaf", () => {
  const regions: ReviewedConvexRegion[] = [
    rank3(),
    {
      id: 1,
      rank: 2,
      position: [0, 0, 0],
      vertices: [2, 0, 0, 3, 0, 0, 3, 1, 0, 2, 1, 0],
      triangles: [0, 1, 2, 0, 2, 3],
      extremes: [],
      planeClass: 1,
    },
    {
      id: 2,
      rank: 1,
      position: [0, 0, 0],
      vertices: [4, 0, 0, 4, 1, 0],
      triangles: [],
      extremes: [0, 1],
      planeClass: -1,
    },
  ];
  const prepared = prepareReviewedConvexRegions(regions),
    world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  try {
    expect(prepared.childCount).toBe(4);
    expect(prepared.children.map((c) => c.sourceRegionId)).toEqual([
      0, 1, 1, 2,
    ]);
    const compound = new RAPIER.Compound(
        prepared.children.map((c) => c.shape),
        prepared.children.map((c) => c.position),
        prepared.children.map(() => ({ x: 0, y: 0, z: 0, w: 1 })),
      ),
      collider = world.createCollider(new RAPIER.ColliderDesc(compound));
    expect(
      collider.containsPoint({ x: 0.1, y: 0.1, z: Math.fround(1e-7) }),
    ).toBe(true);
    // Direct native support queries, rather than convexMeshData's re-hull export.
    const ray = new RAPIER.Ray({ x: 0.1, y: 0.1, z: 1 }, { x: 0, y: 0, z: -1 });
    expect(collider.castRay(ray, 2, false)).toBeLessThan(1);
    const ball = world.createCollider(
      RAPIER.ColliderDesc.ball(0.001).setTranslation(2.5, 0.5, 0.0005),
    );
    expect(collider.contactCollider(ball, 0)).not.toBeNull();
    ball.setTranslation({ x: 4, y: 0.5, z: 0.0005 });
    expect(collider.contactCollider(ball, 0)).not.toBeNull();
  } finally {
    world.free();
  }
});
it("refuses expanded fan budgets and invalid source lattice before preparing any world geometry", () => {
  const fan: ReviewedConvexRegion = {
    id: 0,
    rank: 2,
    position: [0, 0, 0],
    vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    triangles: Array.from({ length: 1536 }, (_, i) => i % 3),
    extremes: [],
    planeClass: 0,
  };
  const regions = Array.from({ length: 9 }, (_, id) => ({ ...fan, id }));
  expect(() => prepareReviewedConvexRegions(regions)).toThrow(/too complex/);
  expect(() =>
    prepareReviewedConvexRegions([{ ...rank3(), position: [0.1, 0, 0] }]),
  ).toThrow(/Float32/);
  expect(() =>
    prepareReviewedConvexRegions([{ ...rank3(), triangles: [0, 1, 99] }]),
  ).toThrow(/facets/);
});
