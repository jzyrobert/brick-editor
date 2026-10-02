import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { add, mv, rotationY } from "../../src/core/math";
import { connectionGraph } from "../../src/core/connectivity";
import type { Project, Transform, Vec3 } from "../../src/core/types";
import {
  articulatedJawProfiles,
  articulatedDisplayFrames,
  articulatedEndpointError,
  ARTICULATED_SOURCE_SHA256,
} from "../../src/instructions/articulated-procedures";
registerFullLibraryFromDisk();
const row = (ref: string, x = 0, y = 0, z = 0, basis = "1 0 0 0 1 0 0 0 1") =>
  `1 16 ${x} ${y} ${z} ${basis} ${ref}`;
const handle = () => row("48336.dat");
const clip = (x = 0, y = 0, z = -40, basis = "-1 0 0 0 1 0 0 0 -1") =>
  row("60470b.dat", x, y, z, basis);
const source = (
  rows = [handle(), clip()],
  transform = "0 0 0 1 0 0 0 1 0 0 0 1",
) =>
  importLDraw(
    [
      "0 FILE root.ldr",
      `1 16 ${transform} arbitrary.ldr`,
      "0 FILE arbitrary.ldr",
      ...rows,
    ].join("\n"),
  );
const match = (p: Project) => articulatedJawProfiles(p, occurrences(p));

it("pins the entire actual official handle and paired-clip dependency closure", () => {
  const sources = fullLibrarySources(["48336.dat", "60470b.dat"]);
  expect(Object.keys(ARTICULATED_SOURCE_SHA256).sort()).toEqual(
    Object.keys(sources).sort(),
  );
  for (const [ref, hash] of Object.entries(ARTICULATED_SOURCE_SHA256))
    expect(createHash("sha256").update(sources[ref]).digest("hex"), ref).toBe(
      hash,
    );
  expect(sources["48336.dat"]).toContain(
    "14 2 -20 0 -28 0 4 0 0 0 0 4 4-4cylo.dat",
  );
  expect(sources["60470b.dat"]).toContain(
    "-10 0 -20 1 0 0 0 1 0 0 0 1 clip6.dat",
  );
  expect(sources["clip6.dat"]).toContain("4 2 0 0 -8 0");
});
it("matches both finite clip cylinders to one handle and supplies distinct receiver/completed illustrations", () => {
  const p = source(),
    before = JSON.stringify(p),
    all = occurrences(p),
    result = match(p);
  expect(result.exhausted).toBe(false);
  expect(result.matches).toHaveLength(1);
  const m = result.matches[0];
  expect(m.incomingId).toBe(all[1].id);
  expect(m.receiverId).toBe(all[0].id);
  expect(m.feature).toEqual([0, 2, -20]);
  expect(m.landmarks.map((l) => l.position)).toEqual([
    [-10, 2, -20],
    [10, 2, -20],
  ]);
  expect(m.landmarks.every((l) => l.occurrenceId === all[0].id)).toBe(true);
  expect(m.completedDetail.occurrenceIds).toEqual([all[0].id, all[1].id]);
  expect(m.residuals.finiteParameters.every((t) => t >= 0 && t <= 1)).toBe(
    true,
  );
  expect(m.residuals.signedAxisDot).toBe(-1);
  expect(m.errorBoundLDU).toBe(0);
  expect(m.sourcePath).toEqual(all[1].path.slice(0, -1));
  expect(m.provenance.physicalFit).toBe("unknown");
  expect(JSON.stringify(p)).toBe(before);
});
it("recovers the actual rounded official jaw without changing source poses or strict coverage", async () => {
  const p = importLDraw(
      await readFile("fixtures/instructions/omr/31088-1.mpd", "utf8"),
    ),
    before = exportLDraw(p),
    all = occurrences(p),
    strict = connectionGraph(p, all),
    m = match(p).matches;
  expect(m).toHaveLength(1);
  expect(all.find((o) => o.id === m[0].incomingId)!.node.ref).toBe(
    "60470b.dat",
  );
  expect(all.find((o) => o.id === m[0].receiverId)!.node.ref).toBe("48336.dat");
  expect(m[0].residuals.radialLDU).toBeLessThan(0.04);
  expect(m[0].errorBoundLDU).toBeLessThan(0.1);
  expect(m[0].sourcePath).toHaveLength(1);
  expect(strict.covered).toHaveLength(0);
  expect(connectionGraph(p, occurrences(p)).covered).toEqual(strict.covered);
  expect(exportLDraw(p)).toBe(before);
});
it("keeps source-derived points and cameras equivariant under arbitrary rigid world rotations", () => {
  const p = source(),
    original = match(p).matches[0],
    world: Transform = { position: [123, -89, 345], basis: rotationY(37) };
  const rotated = structuredClone(p);
  rotated.models[rotated.rootModelId].nodes[0].transform = world;
  const m = match(rotated).matches[0];
  expect(m).toBeTruthy();
  const expected = add(world.position, mv(world.basis, original.feature));
  m.feature.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 9));
  const expectedCamera = add(
    world.position,
    mv(world.basis, original.receivingCamera.position),
  );
  m.receivingCamera.position.forEach((v, i) =>
    expect(v).toBeCloseTo(expectedCamera[i], 9),
  );
  expect(m.residuals.radialLDU).toBeLessThan(1e-10);
});
it("does not infer membership from model names, node IDs or set identity", () => {
  const p = source(),
    section = p.models["arbitrary.ldr"];
  delete p.models["arbitrary.ldr"];
  section.id = "renamed.ldr";
  section.name = "unrelated work";
  p.models[section.id] = section;
  p.models[p.rootModelId].nodes[0].ref = section.id;
  for (const model of Object.values(p.models))
    for (const node of model.nodes) node.id = "opaque-" + node.id;
  expect(match(p).matches).toHaveLength(1);
});
it("refuses missing, competing and ambiguous reciprocal pairs", () => {
  for (const rows of [
    [handle()],
    [clip()],
    [handle(), handle(), clip()],
    [handle(), clip(), clip()],
  ])
    expect(match(source(rows)).matches).toHaveLength(0);
});
it("checks complete finite widths, signed axes and raw radial residuals", () => {
  for (const c of [
    clip(1),
    clip(0, 0.251),
    clip(0, 0, -39.749),
    clip(0, 0, -40, "1 0 0 0 -1 0 0 0 -1"),
    clip(0, 0, -40, "0 0 1 0 1 0 -1 0 0"),
  ])
    expect(match(source([handle(), c])).matches).toHaveLength(0);
  expect(match(source([handle(), clip(0, 0.249)])).matches).toHaveLength(1);
});
it("rejects foreign namespace and shadowed files anywhere in the pinned official closure", () => {
  const p = source(),
    all = occurrences(p);
  all[1].namespace = "project";
  expect(articulatedJawProfiles(p, all).matches).toHaveLength(0);
  for (const ref of Object.keys(ARTICULATED_SOURCE_SHA256)) {
    const q = source();
    q.models[ref] = {
      id: ref,
      name: ref,
      classification: "custom",
      nodes: [],
      records: [],
    };
    expect(match(q).matches, ref).toHaveLength(0);
    for (const alias of ["id", "name"] as const) {
      const renamed = source();
      renamed.models["unrelated-local.dat"] = {
        id: "unrelated-local.dat",
        name: "unrelated-local.dat",
        classification: "custom",
        nodes: [],
        records: [],
        [alias]: ref.toUpperCase(),
      };
      expect(match(renamed).matches, `${alias}: ${ref}`).toHaveLength(0);
    }
  }
});
it("refuses changed library releases and manifests", () => {
  for (const key of ["releaseId", "manifestSha256"] as const) {
    const p = source();
    p.library[key] = "changed";
    expect(match(p).matches).toHaveLength(0);
    const q = source();
    q.library.full![key] = "changed";
    expect(match(q).matches).toHaveLength(0);
  }
});
it("rejects mirrored, scaled and sheared frames rather than repairing their geometry", () => {
  for (const basis of [
    "-1 0 0 0 1 0 0 0 1",
    "1.02 0 0 0 1 0 0 0 1",
    "1 0.03 0 0 1 0 0 0 1",
  ])
    expect(match(source(undefined, `0 0 0 ${basis}`)).matches).toHaveLength(0);
  const p = source(undefined, "0 0 0 1.01 0 0 0 1 0 0 0 1");
  for (const n of p.models["arbitrary.ldr"].nodes) n.transform.basis[0] /= 1.01;
  // Opposing distortions can cancel at the leaf; original parent is still invalid.
  expect(match(p).matches).toHaveLength(0);
});
it("bounds displacement over translated rounded paths even when final feature alignment is exact", () => {
  const p = importLDraw(
      [
        "0 FILE root.ldr",
        row("middle.ldr", 0, 0, 0, "0.707 -0.707 0 0.707 0.707 0 0 0 1"),
        "0 FILE middle.ldr",
        row("leaf.ldr", 10000, 0, 0),
        "0 FILE leaf.ldr",
        handle(),
        clip(),
      ].join("\n"),
    ),
    all = occurrences(p),
    frames = articulatedDisplayFrames(p, all);
  expect(frames.exhausted).toBe(false);
  expect(frames.frames.size).toBe(2);
  const f = frames.frames.get(all[0].id)!,
    local: Vec3 = [14, 2, -20],
    raw = add(f.rawTransform.position, mv(f.rawTransform.basis, local)),
    q = add(
      f.normalizedTransform.position,
      mv(f.normalizedTransform.basis, local),
    ),
    bound = articulatedEndpointError(f, local);
  raw.forEach((v, i) =>
    expect(Math.abs(v - q[i])).toBeLessThanOrEqual(bound[i] + 1e-9),
  );
  expect(Math.hypot(...bound)).toBeGreaterThan(0.25);
  expect(match(p).matches).toHaveLength(0);
});
it("enforces display tolerance ceiling, path integrity and complete search budgets", () => {
  const p = source(),
    all = occurrences(p);
  for (const tolerance of [0, -1, 0.02001, NaN, Infinity])
    expect(
      articulatedDisplayFrames(p, all, 200000, tolerance).frames.size,
    ).toBe(0);
  for (const budget of [0, 1, 2, 5, NaN, -1, 200001]) {
    const r = articulatedJawProfiles(p, all, budget);
    expect(r.matches).toHaveLength(0);
    expect(r.exhausted).toBe(true);
  }
  const invalid = structuredClone(all);
  invalid[1].path[0] = "absent";
  invalid[1].id = JSON.stringify(invalid[1].path);
  expect(articulatedJawProfiles(p, invalid).matches).toHaveLength(0);
  const stale = structuredClone(all);
  stale[1].transform.position[0] += 0.1;
  expect(articulatedJawProfiles(p, stale).matches).toHaveLength(0);
  const wrongModel = structuredClone(all);
  wrongModel[1].modelId = p.rootModelId;
  expect(articulatedJawProfiles(p, wrongModel).matches).toHaveLength(0);
  expect(articulatedDisplayFrames(p, all, 1).frames.size).toBe(0);
});
