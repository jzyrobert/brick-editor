import { expect, it } from "vitest";
import {
  defaultWorkplane,
  defineWorkplane,
  worldWorkplane,
  placementOnPlane,
  planeFromTriangle,
  planeOrigin,
  planeV,
  placeBasis,
  validateWorkplane,
} from "../../src/edit/workplane";
import { mv, physical, rotationY } from "../../src/core/math";
import type { Vec3 } from "../../src/core/types";
const near = (a: number[], b: number[]) =>
  a.forEach((n, i) => expect(n).toBeCloseTo(b[i], 7));
const dot = (a: Vec3, b: Vec3) => a.reduce((s, n, i) => s + n * b[i], 0);
it("preserves default LDraw grid placement and rotation with negative Y upward", () => {
  const p = defaultWorkplane();
  p.elevation = -8;
  const t = placementOnPlane([31, -8, -9], p, 24, 90);
  near(t.position, [40, -32, 0]);
  near(t.basis, rotationY(90));
  expect(physical(t)).toBe(true);
});
it("places on three world-aligned planes with local offsets and a right-handed orthonormal part basis", () => {
  for (const axis of ["XZ", "XY", "YZ"] as const) {
    const p = worldWorkplane(axis),
      t = placementOnPlane([31, 49, 71], p, 8, 37);
    expect(physical(t)).toBe(true);
    near(mv(placeBasis(p, 0), [0, -1, 0]), p.normal);
    expect(dot(t.position, p.normal)).toBeCloseTo(8);
    expect(dot(t.position, p.u) / 20).toBeCloseTo(
      Math.round(dot(t.position, p.u) / 20),
    );
    expect(dot(t.position, planeV(p)) / 20).toBeCloseTo(
      Math.round(dot(t.position, planeV(p)) / 20),
    );
  }
});
it("supports fractional free placement and arbitrary numeric planes without quantizing source coordinates", () => {
  const p = defineWorkplane([12.3, -8, 55], [0.4, -1, 0.3], 27, {
    ...defaultWorkplane(),
    grid: 0.25,
    elevation: -8,
    free: true,
  });
  const o = planeOrigin(p),
    v = planeV(p),
    hit = o.map((n, i) => n + p.u[i] * 1.234 + v[i] * 9.876) as Vec3;
  const t = placementOnPlane(hit, p, 24, 12.7);
  near(
    t.position,
    hit.map((n, i) => n + p.normal[i] * 24),
  );
  expect(physical(t)).toBe(true);
  expect(dot(t.position.map((n, i) => n - o[i]) as Vec3, p.normal)).toBeCloseTo(
    24,
  );
  const grid = placementOnPlane(hit, { ...p, free: false }, 24, 12.7);
  expect(dot(grid.position.map((n, i) => n - o[i]) as Vec3, p.u)).toBeCloseTo(
    1.25,
  );
  expect(dot(grid.position.map((n, i) => n - o[i]) as Vec3, v)).toBeCloseTo(10);
});
it("derives an actual affine-transformed triangle plane, faces the viewer, and rejects degenerate geometry", () => {
  const transform = (v: Vec3) =>
    mv([-1, 0.3, 0, 0, 1, 0.2, 0, 0.5, 2], v).map(
      (n, i) => n + [20, -30, 9][i],
    ) as Vec3;
  const a = transform([0, 0, 0]),
    b = transform([20, 0, 0]),
    c = transform([0, -10, 0]);
  const p = planeFromTriangle(a, b, c, [200, -300, 200]);
  for (const vertex of [a, b, c])
    expect(dot(vertex.map((n, i) => n - a[i]) as Vec3, p.normal)).toBeCloseTo(
      0,
    );
  expect(dot([200 - a[0], -300 - a[1], 200 - a[2]], p.normal)).toBeGreaterThan(
    0,
  );
  expect(p.origin).toEqual(a);
  expect(p.elevation).toBe(0);
  expect(() => planeFromTriangle(a, a, c, [0, 0, 0])).toThrow(/nonzero/);
});
it("rejects unsafe or singular numeric settings without changing the provided plane", () => {
  const p = defaultWorkplane(),
    before = structuredClone(p);
  expect(() => defineWorkplane([0, 0, 0], [0, 0, 0], 0, p)).toThrow();
  expect(() => defineWorkplane([Infinity, 0, 0], [0, -1, 0], 0, p)).toThrow();
  for (const patch of [
    { grid: 0 },
    { grid: 10001 },
    { rotationIncrement: 0 },
    { elevation: Infinity },
    { u: [0, -1, 0] as Vec3 },
  ])
    expect(() => validateWorkplane({ ...p, ...patch })).toThrow();
  expect(p).toEqual(before);
});
