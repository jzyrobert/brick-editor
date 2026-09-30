import * as THREE from "three";
import { describe, it, expect } from "vitest";
import {
  boxFootprint,
  convexHull,
  coverageFromIds,
  coverageMatches,
  DEFAULT_CONTAINMENT,
  footprintMatches,
  polygonInside,
  region,
  snapshotSelect,
  type Point2,
} from "../../src/render/region-selection";
import { modifierOperation, regionLabel } from "../../src/edit/region-gesture";

const square = (x0: number, y0: number, x1: number, y1: number): Point2[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];
// A 0–10 square with a notch cut up into it from the bottom (x 4–6, y 3–10).
const notched: Point2[] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [6, 10],
  [6, 3],
  [4, 3],
  [4, 10],
  [0, 10],
];

describe("through-mode outlines", () => {
  // Orthographic, looking down −Z: world x, y in [−10, 10] fill a 100 px view.
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
  camera.position.z = 10;
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  const viewProjection = new THREE.Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse,
  );
  const footprint = (id: string, min: number[], max: number[]) =>
    boxFootprint(
      id,
      new THREE.Box3(
        new THREE.Vector3(min[0], min[1], -1),
        new THREE.Vector3(max[0], max[1], 1),
      ),
      viewProjection,
      100,
      100,
    )!;
  // Screen: x → (wx + 10) * 5, y → (10 − wy) * 5.
  const small = footprint("small", [-1, -1], [1, 1]); // 45–55 px
  const long = footprint("long", [-9, -1], [9, 1]); // 5–95 px wide

  it("projects a box to its hull and centre", () => {
    expect(small.hull).toHaveLength(4);
    expect(small.centre![0]).toBeCloseTo(50);
    expect(small.centre![1]).toBeCloseTo(50);
    expect(small.minX).toBeCloseTo(45);
    expect(small.maxX).toBeCloseTo(55);
    expect(small.clipped).toBe(false);
  });
  it("applies touching, centre-inside and fully-inside rules", () => {
    const r = region(square(40, 40, 60, 60));
    for (const rule of ["touching", "centre", "inside"] as const)
      expect(footprintMatches(small, r, rule)).toBe(true);
    // The long part crosses the region: touching and centre, not fully inside.
    expect(footprintMatches(long, r, "touching")).toBe(true);
    expect(footprintMatches(long, r, "centre")).toBe(true);
    expect(footprintMatches(long, r, "inside")).toBe(false);
    // A region over the long part's end: touching only.
    const end = region(square(80, 40, 99, 60));
    expect(footprintMatches(long, end, "touching")).toBe(true);
    expect(footprintMatches(long, end, "centre")).toBe(false);
    expect(footprintMatches(small, end, "touching")).toBe(false);
  });
  it("catches outlines crossing a region with no corner or centre inside", () => {
    const r = region(square(20, 0, 22, 100));
    expect(footprintMatches(long, r, "touching")).toBe(true);
    expect(footprintMatches(long, r, "centre")).toBe(false);
  });
  it("defaults to touching for Visible and centre-inside for Through", () => {
    expect(DEFAULT_CONTAINMENT).toEqual({
      visible: "touching",
      through: "centre",
    });
    const snapshot = { mode: "through" as const, footprints: [small, long] };
    expect(snapshotSelect(snapshot, square(80, 40, 99, 60), "centre")).toEqual(
      [],
    );
    expect(
      snapshotSelect(snapshot, square(80, 40, 99, 60), "touching"),
    ).toEqual(["long"]);
    expect(snapshotSelect(snapshot, square(0, 0, 100, 100), "inside")).toEqual([
      "small",
      "long",
    ]);
  });
  it("clips parts crossing the camera plane instead of wrapping them", () => {
    const perspective = new THREE.PerspectiveCamera(90, 1, 1, 100);
    perspective.updateMatrixWorld();
    const vp = new THREE.Matrix4().multiplyMatrices(
      perspective.projectionMatrix,
      perspective.matrixWorldInverse,
    );
    // From behind the camera to just in front of it, on the left of the view.
    const wall = boxFootprint(
      "wall",
      new THREE.Box3(
        new THREE.Vector3(-4, -1, -6),
        new THREE.Vector3(-2, 1, 5),
      ),
      vp,
      100,
      100,
    )!;
    expect(wall.clipped).toBe(true);
    expect(wall.centre).toBeNull();
    expect(
      wall.hull.every(
        ([x, y]) => x >= -1e-6 && x <= 50 && y >= -1e-6 && y <= 100 + 1e-6,
      ),
    ).toBe(true);
    // A clipped outline may continue off screen: never "fully inside".
    expect(
      footprintMatches(wall, region(square(0, 0, 100, 100)), "inside"),
    ).toBe(false);
    // Wholly behind the camera: no outline at all.
    expect(
      boxFootprint(
        "behind",
        new THREE.Box3(
          new THREE.Vector3(-1, -1, 2),
          new THREE.Vector3(1, 1, 4),
        ),
        vp,
        100,
        100,
      ),
    ).toBeNull();
  });
});

describe("visible-mode coverage", () => {
  // 10 × 10 view: "a" fills columns 0–4 (touching the view's edge), "b" is a
  // 2 × 2 block at 6–7, "c" a single pixel at (9, 9).
  const pixels = new Int32Array(100).fill(-1);
  for (let y = 0; y < 10; y++)
    for (let x = 0; x < 5; x++) pixels[y * 10 + x] = 0;
  for (const [x, y] of [
    [6, 6],
    [7, 6],
    [6, 7],
    [7, 7],
  ])
    pixels[y * 10 + x] = 1;
  pixels[99] = 2;
  const coverage = coverageFromIds(10, 10, ["a", "b", "c"], pixels);
  it("counts seen pixels and edge contact", () => {
    expect([...coverage.totals]).toEqual([50, 4, 1]);
    expect([...coverage.edge]).toEqual([1, 0, 1]);
  });
  it("touching needs a few seen pixels, or all of a small part", () => {
    // Two pixels of "a" (a grazing edge) do not count; four do.
    expect(coverageMatches(coverage, square(3, 0, 8, 1), "touching")).toEqual(
      [],
    );
    expect(coverageMatches(coverage, square(3, 0, 8, 2), "touching")).toEqual([
      "a",
    ]);
    expect(coverageMatches(coverage, square(6, 6, 8, 8), "touching")).toEqual([
      "b",
    ]);
    // A one-pixel part counts once its only pixel is inside.
    expect(coverageMatches(coverage, square(9, 9, 10, 10), "touching")).toEqual(
      ["c"],
    );
  });
  it("fully inside needs every seen pixel, and nothing at the view's edge", () => {
    expect(coverageMatches(coverage, square(5, 5, 9, 9), "inside")).toEqual([
      "b",
    ]);
    expect(coverageMatches(coverage, square(0, 0, 10, 10), "inside")).toEqual([
      "b",
    ]);
  });
  it("centre inside uses the projected centre of parts seen in the region", () => {
    const centres: Record<string, Point2> = { a: [2.5, 5], b: [7, 7] };
    const centre = (id: string) => centres[id] ?? null;
    expect(
      coverageMatches(coverage, square(0, 4, 8, 8), "centre", centre),
    ).toEqual(["a", "b"]);
    expect(
      coverageMatches(coverage, square(3, 0, 8, 8), "centre", centre),
    ).toEqual(["b"]);
  });
  it("respects concave lasso gaps", () => {
    // A notch (x 5.5–8.5, y 3–10) around "b": "a" and "c" stay inside.
    const lasso: Point2[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [8.5, 10],
      [8.5, 3],
      [5.5, 3],
      [5.5, 10],
      [0, 10],
    ];
    expect(coverageMatches(coverage, lasso, "touching")).toEqual(["a", "c"]);
  });
});

describe("hulls and containment", () => {
  it("builds convex hulls without interior points", () => {
    expect(
      convexHull([
        [0, 0],
        [10, 0],
        [5, 5],
        [10, 10],
        [0, 10],
      ]),
    ).toHaveLength(4);
  });
  it("rejects outlines a concave lasso cuts across", () => {
    // Corners inside the notched square, but the notch cuts through the middle.
    expect(polygonInside(square(1, 5, 9, 6), notched)).toBe(false);
    expect(polygonInside(square(1, 1, 9, 2), notched)).toBe(true);
    expect(polygonInside(square(1, 1, 9, 2), square(0, 0, 10, 10))).toBe(true);
  });
});

describe("modifiers", () => {
  const keys = {
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  };
  it("Shift adds, Alt or Ctrl/Cmd removes, otherwise the chosen action", () => {
    expect(modifierOperation(keys, "replace")).toBe("replace");
    expect(modifierOperation({ ...keys, shiftKey: true }, "replace")).toBe(
      "add",
    );
    expect(modifierOperation({ ...keys, altKey: true }, "replace")).toBe(
      "remove",
    );
    expect(modifierOperation({ ...keys, ctrlKey: true }, "add")).toBe("remove");
    expect(modifierOperation({ ...keys, metaKey: true }, "add")).toBe("remove");
    expect(modifierOperation(keys, "add")).toBe("add");
  });
  it("labels the live count by action", () => {
    expect(regionLabel(1, "replace")).toBe("1 part");
    expect(regionLabel(1200, "add")).toBe("+ 1,200 parts");
    expect(regionLabel(3, "remove")).toBe("− 3 parts");
  });
});
