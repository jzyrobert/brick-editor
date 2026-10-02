import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { fullLibrarySources } from "../../scripts/full-library-node";
import { getLocalInstructionBounds } from "../../src/instructions/source-geometry";
import type { SourceGeometryOptions } from "../../src/instructions/source-geometry";
import type { Project } from "../../src/core/types";

const triangle = "3 16 0 0 0 10 0 0 0 10 0";
const reference = (ref: string, x = 0) =>
  `1 16 ${x} 0 0 1 0 0 0 1 0 0 0 1 ${ref}`;
const part = (name: string, source: string) =>
  `0 FILE ${name}\n0 !LDRAW_ORG Part\n${source}\n`;
function local(source: string, definitions = "") {
  return importLDraw(part("local.dat", source) + definitions);
}
function available(sources: Record<string, string>): SourceGeometryOptions {
  return { readSource: (ref) => sources[ref] };
}
const empty = () => importLDraw("0 Empty");

it("resolves the actual embedded Shark towball closure, including all studs, without changing source or identity", () => {
  const project = importLDraw(
      readFileSync("fixtures/instructions/omr/31088-1.mpd", "utf8"),
    ),
    ref = "31088 - 15456.dat",
    dependencies = [ref, "31088 - 4-4cyl19sph40.dat"].flatMap((name) =>
      project.models[name].nodes
        .filter((node) => node.kind !== "geometry")
        .map((node) => node.ref),
    ),
    sources = fullLibrarySources(dependencies),
    before = exportLDraw(project),
    nativeBefore = JSON.stringify(project),
    result = getLocalInstructionBounds(project, ref, available(sources));
  expect(result.diagnostic).toBeNull();
  expect(result.bounds).toEqual({ min: [-20, -4, -48], max: [20, 12, 20] });
  expect(result.stats.triangles).toBe(648);
  expect(exportLDraw(project)).toBe(before);
  expect(JSON.stringify(project)).toBe(nativeBefore);
  expect(project.models[ref].classification).toBe("custom");
});

it("honors project shadowing at an official dependency level and renamed definitions", () => {
  const project = local(
    reference("official.dat"),
    part("shadow.dat", "3 16 -3 0 0 7 0 0 0 9 0"),
  );
  project.models["shadow.dat"].name = "renamed.dat";
  const sources = {
    "official.dat": reference("renamed.dat", 20),
    "renamed.dat": "3 16 -100 0 0 100 0 0 0 100 0",
  };
  expect(
    getLocalInstructionBounds(project, "local.dat", available(sources)).bounds,
  ).toEqual({ min: [17, 0, 0], max: [27, 9, 0] });
});

it("uses current native reference and geometry transforms, retaining exact vertices under nested rotations", () => {
  const project = local(reference("child.dat"), part("child.dat", triangle)),
    parent = project.models["local.dat"].nodes[0],
    geometry = project.models["child.dat"].nodes[0],
    c = Math.SQRT1_2;
  parent.transform = {
    position: [30, 2, 4],
    basis: [c, -c, 0, c, c, 0, 0, 0, 1],
  };
  geometry.transform = {
    position: [0, 0, 0],
    basis: [c, c, 0, -c, c, 0, 0, 0, 1],
  };
  const snapshot = JSON.stringify(project),
    before = exportLDraw(project),
    result = getLocalInstructionBounds(project, "local.dat");
  expect(result.bounds!.min).toEqual([30, 2, 4]);
  expect(result.bounds!.max[0]).toBeCloseTo(40, 12);
  expect(result.bounds!.max[1]).toBeCloseTo(12, 12);
  expect(result.bounds!.max[2]).toBe(4);
  expect(JSON.stringify(project)).toBe(snapshot);
  expect(exportLDraw(project)).toBe(before);
});

it("keeps already resolved node references ahead of misleading directory-relative aliases", () => {
  const project = importLDraw(
    part("dir/root.dat", reference("child.dat")) +
      part("dir/child.dat", triangle) +
      part("dir/dir/child.dat", "3 16 100 0 0 110 0 0 100 10 0"),
  );
  expect(project.models["dir/root.dat"].nodes[0].ref).toBe("dir/child.dat");
  expect(getLocalInstructionBounds(project, "dir/root.dat").bounds).toEqual({
    min: [0, 0, 0],
    max: [10, 10, 0],
  });
});

it("includes edge endpoints but excludes conditional-line visibility control points", () => {
  const project = local(
    "2 24 -4 0 0 3 0 0\n5 24 0 -2 0 0 5 0 100 100 100 -100 -100 -100",
  );
  expect(getLocalInstructionBounds(project, "local.dat").bounds).toEqual({
    min: [-4, -2, 0],
    max: [3, 5, 0],
  });
});

it("returns UNKNOWN for a missing primitive after valid polygons, never a partial box", () => {
  const project = local(triangle + "\n" + reference("missing.dat"));
  expect(
    getLocalInstructionBounds(project, "local.dat", available({})),
  ).toMatchObject({
    bounds: null,
    diagnostic: { code: "missing-source", ref: "missing.dat" },
  });
});

it.each([
  ["TEXMAP", "0 !TEXMAP START PLANAR 0 0 0 1 0 0 0 1 0 x.png"],
  ["LSynth", "0 SYNTH BEGIN 1 -1"],
  ["embedded texture", "0 !DATA image.png"],
  ["hidden TEXMAP geometry", "0 !: 3 16 0 0 0 1 0 0 0 1 0"],
])(
  "rejects unsupported %s even after complete-looking geometry",
  (_name, meta) => {
    expect(
      getLocalInstructionBounds(
        empty(),
        "source.dat",
        available({
          "source.dat": triangle + "\n" + meta,
        }),
      ),
    ).toMatchObject({
      bounds: null,
      diagnostic: { code: "unsupported-source" },
    });
  },
);

it("rejects recursive closures and alias-induced project cycles", () => {
  expect(
    getLocalInstructionBounds(
      empty(),
      "a.dat",
      available({
        "a.dat": triangle + "\n" + reference("b.dat"),
        "b.dat": reference("a.dat"),
      }),
    ),
  ).toMatchObject({ bounds: null, diagnostic: { code: "cycle" } });
  const project = local(triangle);
  project.models["local.dat"].name = "alias.dat";
  project.models["local.dat"].records.push({
    id: "recursive",
    raw: reference("alias.dat"),
  });
  expect(getLocalInstructionBounds(project, "local.dat")).toMatchObject({
    bounds: null,
    diagnostic: { code: "cycle" },
  });
});

it.each([
  "4 16 0 0 0 1 0 0 0 1 0", // Truncated quad.
  "1 16 0 0 0 1 0 0 0 1 0 0 0 missing.dat", // Truncated matrix.
  "3 16 0 0 0 NaN 0 0 0 1 0",
  "6 16 0 0 0",
])("does not accept malformed closure records: %s", (raw) => {
  expect(
    getLocalInstructionBounds(
      empty(),
      "bad.dat",
      available({
        "bad.dat": triangle + "\n" + raw,
      }),
    ),
  ).toMatchObject({ bounds: null, diagnostic: { code: "malformed-source" } });
});

it.each([
  ["records", 1],
  ["sourceCharacters", 20],
  ["recordCharacters", 20],
  ["instances", 1],
  ["depth", 0],
  ["triangles", 0],
  ["coordinate", 5],
] as const)(
  "does not return a partial box when the %s budget expires",
  (resource, value) => {
    const project = local(
      triangle + "\n" + reference("child.dat"),
      part("child.dat", triangle),
    );
    expect(
      getLocalInstructionBounds(project, "local.dat", {
        limits: { [resource]: value },
      }),
    ).toMatchObject({ bounds: null, diagnostic: { code: "budget", resource } });
  },
);

it("checks composed coordinates, not only finite source tokens", () => {
  const project = local(reference("child.dat", 8), part("child.dat", triangle));
  expect(
    getLocalInstructionBounds(project, "local.dat", {
      limits: { coordinate: 12 },
    }),
  ).toMatchObject({
    bounds: null,
    diagnostic: { code: "budget", resource: "coordinate" },
  });
});

it("refuses linked nodes whose source records have become comments and malformed colour tokens", () => {
  const project = local(triangle);
  project.models["local.dat"].records.find((record) => record.nodeId)!.raw =
    "0 Lost geometry";
  expect(getLocalInstructionBounds(project, "local.dat")).toMatchObject({
    bounds: null,
    diagnostic: { code: "malformed-source" },
  });
  expect(
    getLocalInstructionBounds(
      empty(),
      "bad.dat",
      available({ "bad.dat": "3 nonsense 0 0 0 1 0 0 0 1 0" }),
    ),
  ).toMatchObject({ bounds: null, diagnostic: { code: "malformed-source" } });
});

it("returns UNKNOWN for empty, ambiguous or unbound geometry definitions", () => {
  expect(getLocalInstructionBounds(empty(), "main.ldr")).toMatchObject({
    bounds: null,
    diagnostic: { code: "empty-geometry" },
  });
  const project = local(triangle, part("other.dat", triangle));
  project.models["other.dat"].name = "local.dat";
  expect(getLocalInstructionBounds(project, "local.dat")).toMatchObject({
    bounds: null,
    diagnostic: { code: "ambiguous-source" },
  });
  const unbound: Project = local(triangle);
  unbound.models["local.dat"].records = [];
  expect(getLocalInstructionBounds(unbound, "local.dat")).toMatchObject({
    bounds: null,
    diagnostic: { code: "malformed-source" },
  });
});
