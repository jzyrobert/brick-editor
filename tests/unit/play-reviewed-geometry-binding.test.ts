import { expect, it } from "vitest";
import { reviewedGeometryDigest } from "../../src/play/reviewed-geometry-binding";
it("binds actual exact surfaces independently of material order and winding while refusing changed geometry", async () => {
  const vertices = new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
    source = { vertices, indices: new Uint32Array([0, 1, 2, 0, 3, 1]) },
    before = vertices.slice();
  const expected = await reviewedGeometryDigest(source);
  expect(
    await reviewedGeometryDigest({
      vertices,
      indices: new Uint32Array([1, 3, 0, 2, 1, 0]),
    }),
  ).toBe(expected);
  const changed = vertices.slice();
  changed[3] += 1e-12;
  expect(
    await reviewedGeometryDigest({ ...source, vertices: changed }),
  ).not.toBe(expected);
  expect(
    await reviewedGeometryDigest({
      ...source,
      indices: new Uint32Array([0, 1, 2]),
    }),
  ).not.toBe(expected);
  expect(vertices).toEqual(before);
  await expect(
    reviewedGeometryDigest({
      ...source,
      indices: new Uint32Array([0, 1, 100]),
    }),
  ).rejects.toThrow(/source triangles/);
});
