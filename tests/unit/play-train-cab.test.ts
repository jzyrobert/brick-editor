import { describe, expect, it } from "vitest";
import { alightPoints, trainCab } from "../../src/play/train-cab";

type Box = [number, number, number, number, number, number];
/** Axis-aligned boxes as triangle soup (LDraw, +Y down). */
function boxes(list: Box[]) {
  const vertices: number[] = [],
    indices: number[] = [];
  for (const [x0, y0, z0, x1, y1, z1] of list) {
    const base = vertices.length / 3;
    for (const x of [x0, x1])
      for (const y of [y0, y1])
        for (const z of [z0, z1]) vertices.push(x, y, z);
    const v = (x: number, y: number, z: number) => base + x * 4 + y * 2 + z;
    const quad = (a: number, b: number, c: number, d: number) =>
      indices.push(a, b, c, a, c, d);
    quad(v(0, 0, 0), v(1, 0, 0), v(1, 0, 1), v(0, 0, 1)); // top
    quad(v(0, 1, 0), v(1, 1, 0), v(1, 1, 1), v(0, 1, 1)); // bottom
    quad(v(0, 0, 0), v(1, 0, 0), v(1, 1, 0), v(0, 1, 0));
    quad(v(0, 0, 1), v(1, 0, 1), v(1, 1, 1), v(0, 1, 1));
    quad(v(0, 0, 0), v(0, 1, 0), v(0, 1, 1), v(0, 0, 1));
    quad(v(1, 0, 0), v(1, 1, 0), v(1, 1, 1), v(1, 0, 1));
  }
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
  };
}

describe("locomotive cab", () => {
  it("stands on the floor under the cab roof, near the front", () => {
    // A 6 × 24 base on two bogies, a hood at the back two bricks high and
    // a cab at the front with its roof five bricks up.
    const loco = boxes([
      [-240, -71, -60, 240, -63, 60], // base (rail tops at y = 0)
      [-200, -63, -40, -140, 0, 40], // rear bogie
      [140, -63, -40, 200, 0, 40], // front bogie
      [-230, -119, -40, 20, -71, 40], // hood
      [40, -199, -60, 220, -191, 60], // cab roof
    ]);
    const cab = trainCab(loco.vertices, loco.indices);
    expect(cab.enclosed).toBe(true);
    expect(cab.feet[1]).toBe(-71);
    expect(cab.feet[0]).toBeGreaterThan(40);
    expect(cab.feet[0]).toBeLessThan(220);
    expect(cab.feet[2]).toBe(0);
    expect(cab.extent).toEqual({ minX: -240, maxX: 240, halfWidth: 60 });
    // Getting off: beside the car, clear of its sides, the cab first.
    const points = alightPoints(cab);
    expect(points[0][0]).toBe(cab.feet[0]);
    for (const p of points) expect(Math.abs(p[2])).toBeGreaterThan(60 + 12);
  });
  it("stands on an open deck without a cab, and on a default without a mesh", () => {
    const flat = boxes([[-240, -71, -60, 240, -63, 60]]);
    const deck = trainCab(flat.vertices, flat.indices);
    expect(deck.enclosed).toBe(false);
    expect(deck.feet[1]).toBe(-71);
    const none = trainCab(new Float32Array(), new Uint32Array());
    expect(none.feet).toEqual([120, -71, 0]);
    expect(none.enclosed).toBe(false);
  });
});
