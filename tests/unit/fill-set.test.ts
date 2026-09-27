import { expect, it } from "vitest";
import { createProject, occurrences } from "../../src/core/document";
import { fillPreview, type FillRequest } from "../../src/edit/fill";
import { catalog } from "../../src/catalog/catalog";
import { inverse, compose, identity, physical } from "../../src/core/math";
import { worldWorkplane, placeBasis } from "../../src/edit/workplane";
import { Editor } from "../../src/core/commands";
import { importLDraw } from "../../src/ldraw/io";
import { uid, type Vec3 } from "../../src/core/types";
const request = (
  p: ReturnType<typeof createProject>,
): Extract<FillRequest, { allowedRefs: string[] }> => ({
  allowedRefs: ["3001.dat", "3003.dat", "3004.dat", "3005.dat"],
  orientations: [0, 90],
  columns: 6,
  rows: 4,
  origin: [0, -24, 0],
  colorCode: "4",
  layerId: p.defaultLayerId,
  maxAdditions: 100,
});
function coverage(
  r: FillRequest,
  parts: ReturnType<typeof fillPreview>["parts"],
) {
  const occupied = new Set<number>(),
    base = { position: r.origin, basis: r.basis ?? identity().basis };
  for (const part of parts) {
    const t = compose(inverse(base), part.transform),
      def = catalog[part.ref];
    const width = Math.round(
        (Math.abs(t.basis[0]) * def.width + Math.abs(t.basis[2]) * def.depth) /
          20,
      ),
      depth = Math.round(
        (Math.abs(t.basis[6]) * def.width + Math.abs(t.basis[8]) * def.depth) /
          20,
      );
    const x = Math.round(t.position[0] / 20 - (width - 1) / 2),
      z = Math.round(t.position[2] / 20 - (depth - 1) / 2);
    expect(physical(t)).toBe(true);
    for (let dz = 0; dz < depth; dz++)
      for (let dx = 0; dx < width; dx++) {
        expect(x + dx).toBeGreaterThanOrEqual(0);
        expect(x + dx).toBeLessThan(r.columns);
        expect(z + dz).toBeGreaterThanOrEqual(0);
        expect(z + dz).toBeLessThan(r.rows);
        const cell = (z + dz) * r.columns + x + dx;
        expect(r.mask?.[cell] ?? true).toBe(true);
        expect(occupied.has(cell)).toBe(false);
        occupied.add(cell);
      }
  }
  return occupied;
}
it("greedy allowed-set fills mix quarter turns deterministically and preserve one undo step", () => {
  const p = createProject(),
    r = request(p),
    preview = fillPreview(p, r);
  expect(preview.parts.map((p) => p.ref)).toEqual([
    "3001.dat",
    "3001.dat",
    "3001.dat",
  ]);
  expect(preview.unresolvedCells).toEqual([]);
  expect(coverage(r, preview.parts).size).toBe(24);
  expect(p.revision).toBe(0);
  expect(
    fillPreview(p, {
      ...r,
      allowedRefs: [...r.allowedRefs!].reverse(),
      orientations: [90, 0],
    }),
  ).toEqual(preview);
  const e = new Editor(p);
  e.dispatch({
    schemaVersion: 1,
    commandId: uid(),
    expectedRevision: 0,
    type: "parts.add",
    payload: {
      layerId: preview.layerId,
      parts: preview.parts,
      maxAdditions: 100,
    },
  });
  expect(occurrences(e.project)).toHaveLength(3);
  e.dispatch({
    schemaVersion: 1,
    commandId: uid(),
    expectedRevision: 1,
    type: "history.undo",
    payload: {},
  });
  expect(occurrences(e.project)).toHaveLength(0);
});
it("masked rotated-workplane fill preserves holes and reports impossible cells", () => {
  const p = createProject(),
    r = {
      ...request(p),
      columns: 5,
      rows: 3,
      origin: [10, 20, 30] as Vec3,
      basis: placeBasis(worldWorkplane("XY"), 90),
      mask: [
        true,
        true,
        true,
        true,
        true,
        true,
        false,
        false,
        false,
        true,
        true,
        true,
        true,
        true,
        true,
      ],
    };
  const preview = fillPreview(p, r),
    covered = coverage(r, preview.parts);
  expect(covered.size).toBe(12);
  expect(preview.unresolvedCells).toEqual([]);
  const impossible = fillPreview(p, { ...r, allowedRefs: ["3003.dat"] });
  expect(impossible.parts).toEqual([]);
  expect(impossible.unresolvedCells).toHaveLength(12);
});
it("hidden authored obstacles participate and generated parts never exceed budgets", () => {
  const e = new Editor(),
    r = request(e.project);
  e.dispatch({
    schemaVersion: 1,
    commandId: uid(),
    expectedRevision: 0,
    type: "parts.add",
    payload: {
      parts: [
        {
          ref: "3005.dat",
          colorCode: "4",
          transform: { position: [0, -24, 0], basis: identity().basis },
        },
      ],
    },
  });
  e.project.layers[e.project.defaultLayerId].visible = false;
  const preview = fillPreview(e.project, r),
    covered = coverage(r, preview.parts);
  expect(covered.has(0)).toBe(false);
  expect(preview.unresolvedCells).toContainEqual([0, -24, 0]);
  const capped = fillPreview(createProject(), { ...r, maxAdditions: 1 });
  expect(capped.parts).toHaveLength(1);
  expect(capped.unresolvedCells.length).toBeGreaterThan(0);
  expect(capped.diagnostics.join(" ")).toContain("budget");
});
it("rejects mixed heights, unknown/overridden footprints, bad masks and invalid orientations", () => {
  const p = createProject(),
    r = request(p);
  for (const change of [
    { allowedRefs: ["3001.dat", "3020.dat"] },
    { allowedRefs: ["fake.dat"] },
    { allowedRefs: ["3001.dat", "3001.dat"] },
    { orientations: [45] },
    { orientations: [] },
    { mask: [true] },
    { columns: 10001 },
  ])
    expect(() => fillPreview(p, { ...r, ...change })).toThrow();
  const embedded = importLDraw(
    "0 FILE root.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n0 FILE 3001.dat\n0 !LDRAW_ORG Unofficial_Part\n3 16 0 0 0 100 0 0 0 100 0",
  );
  expect(() =>
    fillPreview(embedded, { ...r, layerId: embedded.defaultLayerId }),
  ).toThrow("audited");
  expect(
    fillPreview(embedded, {
      ...r,
      layerId: embedded.defaultLayerId,
      allowedRefs: ["3005.dat"],
    }).parts,
  ).toEqual([]);
});
