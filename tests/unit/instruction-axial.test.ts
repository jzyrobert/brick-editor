import { expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { AXIAL_PROFILES, axialPrecedence } from "../../src/instructions/axial";
import { generateInstructions } from "../../src/instructions/generate";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { connectionGraph } from "../../src/core/connectivity";
import { Editor } from "../../src/core/commands";
import { encodeNative, decodeNative } from "../../src/persistence/native";
registerFullLibraryFromDisk();
const axle = (x = 0) => `1 0 ${x} 0 0 1 0 0 0 1 0 0 0 1 3707.dat`;
const bush = (x: number) => `1 7 ${x} 0 0 0 0 1 0 1 0 -1 0 0 3713.dat`;
const items = (text: string) =>
  occurrences(importLDraw(text)).map((o, index) => ({
    o,
    index,
    requires: new Set<number>(),
  }));
it("orders axle, inner collar and outer collar as separate steps irrespective of source STEP", () => {
  const p = importLDraw(
      [bush(50), "0 STEP", bush(30), "0 STEP", axle()].join("\n"),
    ),
    before = exportLDraw(p),
    { plan } = generateInstructions(p, { maxPerStep: 20 }),
    byId = new Map(occurrences(p).map((o) => [o.id, o]));
  expect(plan.steps.map((s) => s.length)).toEqual([1, 1, 1]);
  expect(plan.steps.map((s) => byId.get(s[0])!.transform.position[0])).toEqual([
    0, 30, 50,
  ]);
  expect(
    plan.stepMetadata!.every((m) => m.axisReference?.feasibility === "unknown"),
  ).toBe(true);
  expect(exportLDraw(p)).toBe(before);
});
it("refuses to choose between multiple possible axles", () => {
  const rows = items([axle(), axle(), bush(30)].join("\n")),
    r = axialPrecedence(rows);
  expect(r.ambiguous).toBe(1);
  expect(r.edges.every((e) => !e.size)).toBe(true);
  expect(r.operations.get(2)!.host).toBeUndefined();
  expect(r.operations.get(2)!.unknownReason).toMatch(/Several/);
});
it("retains existing prerequisites rather than force a contradictory or overlapping collar order", () => {
  const rows = items([axle(), bush(30), bush(50)].join("\n"));
  rows[0].requires.add(1);
  const r = axialPrecedence(rows);
  expect(r.conflicts).toBe(1);
  expect(r.edges.every((e) => !e.size)).toBe(true);
  expect(rows[0].requires.has(1)).toBe(true);
  const overlap = axialPrecedence(
    items([axle(), bush(30), bush(31)].join("\n")),
  );
  expect(overlap.conflicts).toBe(1);
  expect(overlap.edges.every((e) => !e.size)).toBe(true);
});
it("excludes mirrored/scaled and file-local shadow parts from sourced profiles", () => {
  const p = importLDraw(
    "0 FILE root.ldr\n" + axle() + "\n0 FILE 3707.dat\n3 4 0 0 0 10 0 0 0 10 0",
  );
  expect(
    axialPrecedence(
      occurrences(p).map((o, index) => ({
        o,
        index,
        requires: new Set<number>(),
      })),
    ).operations.size,
  ).toBe(0);
  for (const m of ["-1 0 0 0 1 0 0 0 1", "2 0 0 0 1 0 0 0 1"])
    expect(
      axialPrecedence(items(`1 0 0 0 0 ${m} 3707.dat`)).operations.size,
    ).toBe(0);
});
it("binds every axial profile to the reviewed pinned official source", () => {
  const sources = fullLibrarySources(Object.keys(AXIAL_PROFILES));
  for (const [ref, p] of Object.entries(AXIAL_PROFILES))
    expect(createHash("sha256").update(sources[ref]).digest("hex"), ref).toBe(
      p.sourceSha256,
    );
});
it("fixes the actual Roadster collar order without upgrading connector coverage or altering poses", async () => {
  const p = importLDraw(
      await readFile(
        new URL("../../fixtures/instructions/omr/8832-1.mpd", import.meta.url),
        "utf8",
      ),
    ),
    before = exportLDraw(p),
    covered = connectionGraph(p).covered.length,
    { plan, report } = generateInstructions(p),
    at = (n: number) =>
      plan.steps.findIndex((s) => s.includes(JSON.stringify(["n" + n])));
  for (const n of [47, 48, 49, 50, 88, 89]) expect(at(45)).toBeLessThan(at(n));
  for (const [a, b] of [
    [47, 48],
    [48, 88],
    [49, 50],
    [50, 89],
  ])
    expect(at(a)).toBeLessThan(at(b));
  expect(new Set(plan.steps.flat()).size).toBe(occurrences(p).length);
  expect(report.connectorCovered).toBe(covered);
  expect(report.axialMatchedBushes).toBeGreaterThanOrEqual(6);
  expect(exportLDraw(p)).toBe(before);
});
it("persists axis references and clears them after structural or camera edits", async () => {
  const p = importLDraw([axle(), bush(30), bush(50)].join("\n"));
  p.instructionPlans.test = generateInstructions(p).plan;
  expect((await decodeNative(await encodeNative(p))).instructionPlans).toEqual(
    p.instructionPlans,
  );
  const e = new Editor(p);
  e.dispatch({
    schemaVersion: 1,
    commandId: "clear-camera",
    expectedRevision: p.revision,
    type: "instructions.step.update",
    payload: { planId: "test", index: 0, camera: null },
  });
  expect(
    e.project.instructionPlans.test.stepMetadata![0].axisReference,
  ).toBeUndefined();
  e.dispatch({
    schemaVersion: 1,
    commandId: "remove",
    expectedRevision: e.project.revision,
    type: "parts.remove",
    payload: { occurrenceIds: [occurrences(p)[0].id] },
  });
  expect(
    e.project.instructionPlans.test.stepMetadata!.every(
      (m) => !m.axisReference,
    ),
  ).toBe(true);
});
it("bounds ambiguous matching and reports remaining evidence as unknown", () => {
  const rows = items(
      [
        ...Array.from({ length: 500 }, () => axle()),
        ...Array.from({ length: 500 }, () => bush(30)),
      ].join("\n"),
    ),
    r = axialPrecedence(rows);
  expect(r.exhausted).toBe(true);
  expect(r.edges.every((e) => !e.size)).toBe(true);
  expect(
    [...r.operations.values()]
      .filter((o) => o.role === "bush")
      .every((o) => o.host === undefined && !!o.unknownReason),
  ).toBe(true);
});
