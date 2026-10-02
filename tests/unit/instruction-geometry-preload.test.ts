import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { getLocalInstructionBounds } from "../../src/instructions/source-geometry";
import {
  collectInstructionGeometrySources,
  instructionWorkerData,
  restoreInstructionWorkerData,
} from "../../src/instructions/worker-data";
import { registerInstructionGeometryFromDisk } from "../../scripts/instruction-geometry-node";

const triangle = "3 16 0 0 0 10 0 0 0 10 0";
const reference = (ref: string) => `1 16 0 0 0 1 0 0 0 1 0 0 0 1 ${ref}`;
const part = (name: string, text: string) =>
  `0 FILE ${name}\n0 !LDRAW_ORG Part\n${text}\n`;

it("preloads the actual embedded Shark primitive closure and transfers exact source geometry to the worker", () => {
  const project = importLDraw(
      readFileSync("fixtures/instructions/omr/31088-1.mpd", "utf8"),
    ),
    before = JSON.stringify(project),
    exportedBefore = exportLDraw(project),
    ref = "31088 - 15456.dat";
  registerInstructionGeometryFromDisk(project);
  const result = getLocalInstructionBounds(project, ref);
  expect(result.diagnostic).toBeNull();
  expect(result.stats.triangles).toBe(648);
  expect(result.bounds).toEqual({ min: [-20, -4, -48], max: [20, 12, 20] });
  const data = structuredClone(instructionWorkerData(project));
  // Embedded definitions stay project-local, rather than travelling as
  // substitute official parts. Only pinned dependency strings are transferred.
  expect(data.sources.has(ref)).toBe(false);
  expect(data.sources.has("31088 - 4-4cyl19sph40.dat")).toBe(false);
  expect(data.sources.has("4-4cyli.dat")).toBe(true);
  expect(data.sources.has("8-8sphe.dat")).toBe(true);
  expect(data.sources.has("stug-2x2.dat")).toBe(true);
  const workerResult = getLocalInstructionBounds(data.project, ref, {
    readSource: (name) => data.sources.get(name),
  });
  expect(workerResult).toEqual(result);
  restoreInstructionWorkerData(data);
  expect(getLocalInstructionBounds(data.project, ref)).toEqual(result);
  expect(JSON.stringify(project)).toBe(before);
  expect(exportLDraw(project)).toBe(exportedBefore);
});

it("follows project definitions shadowing official dependencies and current references instead of stale raw records", () => {
  const project = importLDraw(
    part("custom.dat", reference("library.dat")) +
      part("shadow.dat", reference("real-primitive.dat")),
  );
  const sources: Record<string, string> = {
    "library.dat": reference("shadow.dat"),
    "shadow.dat": reference("wrong-primitive.dat"),
    "real-primitive.dat": triangle,
    "wrong-primitive.dat": "3 16 100 0 0 110 0 0 100 10 0",
    "edited-primitive.dat": "3 16 -5 0 0 2 0 0 0 3 0",
  };
  project.models["shadow.dat"].nodes[0].ref = "edited-primitive.dat";
  const snapshot = JSON.stringify(project);
  const collected = collectInstructionGeometrySources(
    project,
    ["custom.dat"],
    (ref) => sources[ref],
  );
  expect([...collected.sources.keys()]).toEqual([
    "library.dat",
    "edited-primitive.dat",
  ]);
  expect(collected.exhausted).toBe(false);
  expect(
    getLocalInstructionBounds(project, "custom.dat", {
      readSource: (ref) => collected.sources.get(ref),
    }).bounds,
  ).toEqual({ min: [-5, 0, 0], max: [2, 3, 0] });
  expect(JSON.stringify(project)).toBe(snapshot);
});

it("follows an unlinked retained raw reference and excludes deleted linked references", () => {
  const project = importLDraw(part("custom.dat", reference("deleted.dat")));
  project.models["custom.dat"].nodes = [];
  project.models["custom.dat"].records.push({
    id: "retained",
    raw: reference("retained.dat"),
  });
  const collected = collectInstructionGeometrySources(
    project,
    ["custom.dat"],
    () => triangle,
  );
  expect([...collected.sources.keys()]).toEqual(["retained.dat"]);
});

it("leaves an unavailable browser primitive unknown without replacing the local part", () => {
  const project = importLDraw(
      part(
        "custom.dat",
        triangle + "\n" + reference("unavailable-primitive.dat"),
      ),
    ),
    collected = collectInstructionGeometrySources(
      project,
      ["custom.dat"],
      () => undefined,
    );
  expect(collected.sources.size).toBe(0);
  expect(
    getLocalInstructionBounds(project, "custom.dat", {
      readSource: (ref) => collected.sources.get(ref),
    }),
  ).toMatchObject({
    bounds: null,
    diagnostic: { code: "missing-source", ref: "unavailable-primitive.dat" },
  });
});

it.each([
  ["characters", 10],
  ["references", 1],
  ["records", 0],
  ["depth", 0],
] as const)(
  "bounds local dependency collection by its %s budget",
  (resource, value) => {
    const project = importLDraw(part("custom.dat", reference("primitive.dat"))),
      collected = collectInstructionGeometrySources(
        project,
        ["custom.dat"],
        () => triangle,
        { [resource]: value },
      );
    expect(collected.exhausted).toBe(true);
    expect(
      getLocalInstructionBounds(project, "custom.dat", {
        readSource: (ref) => collected.sources.get(ref),
      }).bounds,
    ).toBeNull();
  },
);

it("bounds duplicate/cyclic references without recursively reading the same source", () => {
  const project = importLDraw("0 Empty"),
    calls: string[] = [];
  const collected = collectInstructionGeometrySources(
    project,
    ["a.dat", "a.dat"],
    (ref) => {
      calls.push(ref);
      return reference(ref === "a.dat" ? "b.dat" : "a.dat");
    },
  );
  expect(calls).toEqual(["a.dat", "b.dat"]);
  expect(collected.exhausted).toBe(false);
  expect(
    getLocalInstructionBounds(project, "a.dat", {
      readSource: (ref) => collected.sources.get(ref),
    }),
  ).toMatchObject({ bounds: null, diagnostic: { code: "cycle" } });
});
