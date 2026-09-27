import { expect, it } from "vitest";
import { createProject } from "../../src/core/document";
import { fillPreview, type FillRequest } from "../../src/edit/fill";
import { worldWorkplane, placeBasis } from "../../src/edit/workplane";
import { Editor } from "../../src/core/commands";
import { identity } from "../../src/core/math";
const request = (p: ReturnType<typeof createProject>): FillRequest => ({
  ref: "3003.dat",
  colorCode: "4",
  columns: 2,
  rows: 2,
  origin: [3, 5, 7],
  layerId: p.defaultLayerId,
  maxAdditions: 4,
});
it("tiles rigid workplane columns and rows in its local frame and keeps all generated bases", () => {
  const p = createProject(),
    r = request(p),
    basis = placeBasis(worldWorkplane("XY"), 0);
  const result = fillPreview(p, { ...r, basis });
  expect(result.parts.map((x) => x.transform.position)).toEqual([
    [3, 5, 7],
    [43, 5, 7],
    [3, 45, 7],
    [43, 45, 7],
  ]);
  expect(
    result.parts.every(
      (x) => JSON.stringify(x.transform.basis) === JSON.stringify(basis),
    ),
  ).toBe(true);
  expect(p.revision).toBe(0);
  expect(() =>
    fillPreview(p, { ...r, basis: [1, 1, 0, 0, 1, 0, 0, 0, 1] }),
  ).toThrow(/rigid/);
});
it("includes full affine Y-height contributions when rejecting overlap and treats unknown geometry conservatively", () => {
  const e = new Editor(),
    r = {
      ...request(e.project),
      columns: 1,
      rows: 1,
      origin: [80, 0, 0] as [number, number, number],
    };
  e.dispatch({
    schemaVersion: 1,
    commandId: "sheared-obstacle",
    expectedRevision: 0,
    type: "parts.add",
    payload: {
      parts: [
        {
          ref: "3003.dat",
          colorCode: "4",
          transform: {
            position: [0, 0, 0],
            basis: [1, 3, 0, 0, 1, 0, 0, 0, 1],
          },
        },
      ],
    },
  });
  expect(fillPreview(e.project, r).parts).toHaveLength(0);
  expect(
    fillPreview(e.project, { ...r, origin: [140, 0, 0] }).parts,
  ).toHaveLength(1);
  e.dispatch({
    schemaVersion: 1,
    commandId: "unknown-obstacle",
    expectedRevision: e.project.revision,
    type: "parts.add",
    payload: {
      parts: [{ ref: "unknown.dat", colorCode: "4", transform: identity() }],
    },
  });
  expect(
    fillPreview(e.project, { ...r, origin: [1000, 0, 0] }).parts,
  ).toHaveLength(0);
});
