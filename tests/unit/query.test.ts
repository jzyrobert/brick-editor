import { expect, it } from "vitest";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { queryProject } from "../../src/automation/query";
import { primitiveBounds, sourceBounds } from "../../src/core/spatial";
import { validate } from "../../src/core/validate";
const brick = (x: number, ref = "3001.dat") =>
  `1 4 ${x} 0 0 1 0 0 0 1 0 0 0 1 ${ref}`;
it("spatial queries include studs, return candidate IDs and respect region containment", () => {
  const p = importLDraw([brick(0), brick(70), brick(500)].join("\n"));
  const q = queryProject(p, { spatial: true, intersectingCandidates: true });
  expect(q.spatial!.bounds).toEqual({
    min: [-40, -4, -20],
    max: [540, 24, 20],
  });
  expect(q.spatial!.intersectingCandidates).toEqual([
    [q.occurrences[0].id, q.occurrences[1].id],
  ]);
  expect(
    queryProject(p, {
      bounds: { min: [-1, -4, -1], max: [1, -3, 1], mode: "intersects" },
    }).count,
  ).toBe(1);
  expect(
    queryProject(p, {
      bounds: { min: [-1, -4, -1], max: [1, -3, 1], mode: "contained" },
    }).count,
  ).toBe(0);
  expect(q.connectivity.missingConnectorCoverageIds).toHaveLength(3);
  expect(queryProject(p, { connectivity: "verified" }).count).toBe(0);
});
it("scopes distinguish repeated submodel instances and explicit/current selections", () => {
  const p = importLDraw(
      `0 FILE root.ldr\n${brick(0, "child.ldr")}\n${brick(100, "child.ldr")}\n0 FILE child.ldr\n${brick(5)}`,
    ),
    all = occurrences(p);
  const instance = JSON.stringify(all[0].path.slice(0, -1));
  expect(
    queryProject(p, {
      scope: { kind: "submodel", occurrenceId: instance },
    }).occurrences.map((o) => o.id),
  ).toEqual([all[0].id]);
  expect(
    queryProject(p, { selection: true }, [all[1].id]).occurrences.map(
      (o) => o.id,
    ),
  ).toEqual([all[1].id]);
  expect(() => queryProject(p, { selection: true })).toThrow(
    /selection is unavailable/,
  );
  expect(
    queryProject(p, {
      scope: { kind: "selection", occurrenceIds: [all[0].id] },
    }).count,
  ).toBe(1);
});
it("unknown geometry stays explicit and custom overrides do not borrow official boxes", () => {
  const p = importLDraw(
    `0 FILE main.ldr\n${brick(0, "3001.dat")}\n${brick(200, "missing.dat")}\n0 FILE 3001.dat\n3 16 1 2 3 4 5 6 7 8 9`,
  );
  const q = queryProject(p, { spatial: true });
  expect(q.spatial!.bounds).toEqual({ min: [1, 2, 3], max: [7, 8, 9] });
  expect(q.spatial!.complete).toBe(false);
  expect(q.spatial!.unknownBoundsIds).toEqual(q.unresolvedReferenceIds);
  const region = queryProject(p, {
    bounds: {
      min: [-1000, -1000, -1000],
      max: [1000, 1000, 1000],
      mode: "contained",
    },
  });
  expect(region.count).toBe(1);
  expect(region.spatial!.unknownBoundsIds).toHaveLength(1);
  const nested = importLDraw(
    `0 FILE main.ldr\n${brick(0, "custom.dat")}\n0 FILE custom.dat\n0 !LDRAW_ORG Unofficial_Part\n${brick(0, "missing.dat")}`,
  );
  const nestedQuery = queryProject(nested);
  expect(nestedQuery.unresolvedReferences).toEqual([
    {
      occurrenceId: nestedQuery.occurrences[0].id,
      references: ["missing.dat"],
    },
  ]);
});
it("bounds preserve affine transforms while physical diagnostics identify them", () => {
  const p = importLDraw("1 4 10 20 30 -2 .5 0 0 1 0 0 0 1 3001.dat");
  const q = queryProject(p, { spatial: true });
  expect(q.spatial!.bounds).toEqual({ min: [-72, 16, 10], max: [102, 44, 50] });
  expect(q.unsupportedPhysicalTransformIds).toEqual([q.occurrences[0].id]);
});
it("source bounds exclude conditional controls, include transformed dependencies and reject cycles", () => {
  expect(
    primitiveBounds("5 24 0 0 0 10 0 0 999 999 999 -999 -999 -999"),
  ).toEqual({ min: [0, 0, 0], max: [10, 0, 0] });
  expect(
    sourceBounds(
      { "a.dat": brick(10, "b.dat"), "b.dat": "3 16 0 0 0 1 2 3 -1 -2 -3" },
      "a.dat",
    ),
  ).toEqual({ min: [9, -2, -3], max: [11, 2, 3] });
  expect(() => sourceBounds({ "a.dat": brick(0, "a.dat") }, "a.dat")).toThrow(
    /Cyclic/,
  );
});
it("region validation and dense intersection budgets reject invalid/unbounded requests", () => {
  expect(() =>
    validate("query", {
      bounds: { min: [0, 0, 0], max: [1, 1, 1], mode: "guess" },
    }),
  ).toThrow();
  const p = importLDraw(brick(0));
  expect(() =>
    queryProject(p, {
      bounds: { min: [1, 0, 0], max: [0, 1, 1], mode: "intersects" },
    }),
  ).toThrow(/minimum/);
  const dense = importLDraw(
    Array.from({ length: 143 }, () => brick(0)).join("\n"),
  );
  expect(() => queryProject(dense, { intersectingCandidates: true })).toThrow(
    /10,000 candidates/,
  );
  expect(dense.revision).toBe(0);
  const longIds = importLDraw(
    Array.from({ length: 100 }, () => brick(0)).join("\n"),
  );
  longIds.models[longIds.rootModelId].nodes.forEach((node, i) => {
    node.id = "x".repeat(1000) + i;
  });
  expect(() => queryProject(longIds, { intersectingCandidates: true })).toThrow(
    /text budget/,
  );
});
