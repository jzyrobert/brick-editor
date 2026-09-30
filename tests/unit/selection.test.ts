import { scanlineSpans } from "../../src/render/region-selection";
import { describe, it, expect } from "vitest";
import { Vector4 } from "three";
import {
  insidePolygon,
  polygonsIntersect,
  clipTriangle,
} from "../../src/render/region-selection";
import { combineSelection } from "../../src/edit/selection";
describe("region geometry", () => {
  it("selects crossing triangles with no vertices inside and includes boundaries", () => {
    const box: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    expect(
      polygonsIntersect(
        [
          [-2, 4],
          [12, 4],
          [12, 6],
        ],
        box,
      ),
    ).toBe(true);
    expect(
      polygonsIntersect(
        [
          [-4, -4],
          [-1, -4],
          [-1, -1],
        ],
        box,
      ),
    ).toBe(false);
    expect(insidePolygon([0, 5], box)).toBe(true);
    expect(
      insidePolygon(
        [5, 5],
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [6, 10],
          [6, 3],
          [4, 3],
          [4, 10],
          [0, 10],
        ],
      ),
    ).toBe(false);
  });
  it("clips near-plane crossings and rejects triangles entirely behind camera", () => {
    const clipped = clipTriangle([
      new Vector4(-0.5, -0.5, 0, 1),
      new Vector4(0.5, -0.5, 0, 1),
      new Vector4(0, 0.5, -2, 1),
    ]);
    expect(clipped).toHaveLength(4);
    expect(clipped.every((p) => p.z >= -p.w && p.w > 0)).toBe(true);
    expect(
      clipTriangle([
        new Vector4(0, 0, 0, -1),
        new Vector4(1, 0, 0, -1),
        new Vector4(0, 1, 0, -1),
      ]),
    ).toEqual([]);
  });
  it("makes touch add/remove/toggle explicit and preserves stable order", () => {
    expect(combineSelection(["a", "b"], ["b", "c"], "add")).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(combineSelection(["a", "b"], ["b", "c"], "remove")).toEqual(["a"]);
    expect(combineSelection(["a", "b"], ["b", "c"], "toggle")).toEqual([
      "a",
      "c",
    ]);
    expect(combineSelection(["a"], ["b", "b"], "replace")).toEqual(["b"]);
  });
});

it("scanline spans preserve concave lasso gaps without per-pixel polygon walks", () => {
  expect(
    scanlineSpans(5, [
      [0, 0],
      [10, 0],
      [10, 10],
      [6, 10],
      [6, 3],
      [4, 3],
      [4, 10],
      [0, 10],
    ]),
  ).toEqual([
    [0, 4],
    [6, 10],
  ]);
  expect(
    scanlineSpans(2, [
      [0, 0],
      [10, 0],
      [10, 10],
      [6, 10],
      [6, 3],
      [4, 3],
      [4, 10],
      [0, 10],
    ]),
  ).toEqual([[0, 10]]);
});
