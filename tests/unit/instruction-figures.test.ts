import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "../../scripts/full-library-node";
import {
  FIGURE_SOURCE_SHA256,
  figureProfiles,
  figurePrecedence,
  figureWorkbenchCandidates,
  type FigureGraphItem,
} from "../../src/instructions/figures";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { occurrences, validateDocument } from "../../src/core/document";
import { generateInstructions } from "../../src/instructions/generate";
import {
  instructionDisplayStates,
  instructionReceivingIds,
  instructionAlternateIds,
  validateInstructionProgramme,
} from "../../src/instructions/programme";
import { encodeNative, decodeNative } from "../../src/persistence/native";
import { validateInstructionCamera } from "../../src/instructions/edit";
registerFullLibraryFromDisk();
const graph = () => {
  const p = project(),
    all = occurrences(p),
    profiles = figureProfiles(p, all),
    seen = new Set<string>();
  const items: FigureGraphItem[] = [];
  for (const o of all) {
    if (seen.has(o.id)) continue;
    const ids = profiles.units.get(o.id)?.ids ?? [o.id];
    ids.forEach((id) => seen.add(id));
    items.push({
      index: items.length,
      ids,
      box: { min: [0, 0, 0], max: [20, 60, 20] },
      broad: false,
      supports: new Set(),
      hosts: new Set(),
      access: new Set(),
      adjacent: new Set(),
    });
  }
  return { profiles, items };
};
const row = (
  ref: string,
  x: number,
  y: number,
  z: number,
  basis = "1 0 0 0 1 0 0 0 1",
) => `1 16 ${x} ${y} ${z} ${basis} ${ref}`;
const right = "0.985435 -0.170055 0 0.170055 0.985435 0 0 0 1",
  left = "0.985435 0.170055 0 -0.170055 0.985435 0 0 0 1";
const figure = [
  row("3817.dat", 0, 44, 0),
  row(
    "3820.dat",
    23.71022,
    26.87299,
    -10,
    "0.985435 0.120247 -0.120247 -0.170055 0.696808 -0.696808 0 0.707107 0.707107",
  ),
  row("3624.dat", 0, -24, 0),
  row("3816.dat", 0, 44, 0),
  row(
    "3820.dat",
    -23.71022,
    26.87299,
    -10,
    "0.985435 -0.120247 0.120247 0.170055 0.696808 -0.696808 0 0.707107 0.707107",
  ),
  row("3626bp01.dat", 0, -24, 0),
  row("3819.dat", 15.552, 9, 0, left),
  row("973.dat", 0, 0, 0),
  row("3818.dat", -15.552, 9, 0, right),
  row("3815.dat", 0, 32, 0),
];
const project = (rows = figure, rotation = "1 0 0 0 1 0 0 0 1") =>
  importLDraw(
    [
      "0 FILE main.ldr",
      row("figure.ldr", 0, 0, 0, rotation),
      "0 FILE figure.ldr",
      ...rows,
    ].join("\n"),
  );
it("binds figure display profiles to pinned source bytes and refuses another library", () => {
  const sources = fullLibrarySources(Object.keys(FIGURE_SOURCE_SHA256));
  for (const [ref, hash] of Object.entries(FIGURE_SOURCE_SHA256))
    expect(createHash("sha256").update(sources[ref]).digest("hex"), ref).toBe(
      hash,
    );
  const p = project();
  expect(figureProfiles(p, occurrences(p)).groups).toHaveLength(1);
  p.library.full!.manifestSha256 = "changed";
  expect(figureProfiles(p, occurrences(p)).groups).toEqual([]);
});
it("builds an intact lower source group, prepares receiver before hand/headgear and places the complete figure without new parts", async () => {
  const p = project(),
    before = exportLDraw(p),
    all = occurrences(p),
    byId = new Map(all.map((o) => [o.id, o])),
    { plan } = generateInstructions(p);
  const group = figureProfiles(p, all).groups[0],
    metadata = plan.stepMetadata!,
    states = instructionDisplayStates(plan);
  const build = (ref: string) =>
    plan.steps.findIndex((s) => s.some((id) => byId.get(id)!.node.ref === ref));
  expect(
    plan.steps[build("3815.dat")].map((id) => byId.get(id)!.node.ref).sort(),
  ).toEqual(["3815.dat", "3816.dat", "3817.dat"]);
  expect(metadata[build("3815.dat")].notes).toMatch(/do not separate/i);
  for (const [id, operation] of group.operations) {
    const n = plan.steps.findIndex((s) => s.includes(id));
    for (const host of operation.hostIds)
      expect(plan.steps.findIndex((s) => s.includes(host))).toBeLessThan(n);
    expect(
      metadata[n].insertionChecks!.every(
        (c) => c.status === "unknown" && !c.from,
      ),
    ).toBe(true);
    if (operation.feature) {
      expect(metadata[n].alternateBeforePlacement).toBe(true);
      expect(instructionReceivingIds(plan, n)).not.toContain(id);
      for (const host of operation.hostIds)
        expect(instructionReceivingIds(plan, n)).toContain(host);
    }
    if (operation.role === "hand") {
      expect(metadata[n].notes).toMatch(/keep it assembled/);
      expect(metadata[n].notes).not.toMatch(/candidate R|point P/);
    }
  }
  const module = Object.entries(plan.modules!).find(([key]) =>
    key.startsWith("figure-"),
  )!;
  expect(new Set(module[1].occurrenceIds)).toEqual(
    new Set(all.map((o) => o.id)),
  );
  const join = metadata.findIndex(
    (m) => m.assembly?.type === "join" && m.assembly.moduleId === module[0],
  );
  expect(plan.steps[join]).toEqual([]);
  expect(states[join].incomingIds).toHaveLength(all.length);
  expect(module[1].placement).toBe("scene");
  expect(metadata[join].notes).toMatch(/no.*mating connection/i);
  expect(exportLDraw(p)).toBe(before);
  expect(new Set(plan.steps.flat()).size).toBe(all.length);
  p.instructionPlans.heuristic = plan;
  validateDocument(p);
  const restored = await decodeNative(await encodeNative(p));
  expect(
    JSON.parse(JSON.stringify(restored.instructionPlans.heuristic)),
  ).toEqual(JSON.parse(JSON.stringify(plan)));
});
it("does not infer a figure procedure from mixed ownership, ambiguous hands, wrong post direction or materially distorted poses", () => {
  const variants = [
    [...figure, row("3001.dat", 0, 60, 0)],
    [...figure, row("3820.dat", -23.71022, 26.87299, -10)],
    figure.map((s) =>
      s.endsWith("3820.dat") ? s.replace(/3820.dat$/, "3001.dat") : s,
    ),
    figure.map((s) =>
      s.endsWith("3818.dat")
        ? row("3818.dat", -15.552, 9, 0, "1.2 0 0 0 1 0 0 0 1")
        : s,
    ),
    figure.map((s) =>
      s.endsWith("3820.dat")
        ? s
            .split(" ")
            .map((v, n) => ([5, 8, 11].includes(n) ? String(-Number(v)) : v))
            .join(" ")
        : s,
    ),
  ];
  for (const rows of variants) {
    const p = project(rows);
    expect(figureProfiles(p, occurrences(p)).groups).toEqual([]);
    const plan = generateInstructions(p).plan;
    expect(
      Object.keys(plan.modules ?? {}).filter((k) => k.startsWith("figure-")),
    ).toEqual([]);
    expect(new Set(plan.steps.flat()).size).toBe(occurrences(p).length);
  }
});
it("keeps local files with official-looking figure names out of pinned profiles", () => {
  const p = importLDraw(
    [
      "0 FILE main.ldr",
      row("figure.ldr", 0, 0, 0),
      "0 FILE figure.ldr",
      ...figure,
      "0 FILE 3818.dat",
      "0 Local arm",
      "3 16 0 0 0 1 0 0 0 1 0",
    ].join("\n"),
  );
  expect(figureProfiles(p, occurrences(p)).groups).toEqual([]);
});
it("uses finite non-parallel receiving cameras for figures in rotated world frames", () => {
  for (const rotation of [
    "1 0 0 0 1 0 0 0 1",
    "0 0 1 0 1 0 -1 0 0",
    "0 -1 0 1 0 0 0 0 1",
  ]) {
    const p = project(figure, rotation),
      { plan } = generateInstructions(p);
    for (const m of plan.stepMetadata!) {
      if (m.camera) validateInstructionCamera(m.camera);
      if (m.alternateCamera) validateInstructionCamera(m.alternateCamera);
    }
  }
});
it("corrects all twelve actual OMR wrist introductions without altering source records", async () => {
  for (const name of ["6350-1", "6361-1", "6450-1", "31025-1"]) {
    const raw = await readFile(
        new URL(`../../fixtures/instructions/omr/${name}.mpd`, import.meta.url),
        "utf8",
      ),
      p = importLDraw(raw),
      before = exportLDraw(p),
      all = occurrences(p),
      profiles = figureProfiles(p, all),
      { plan } = generateInstructions(p);
    expect(
      Object.keys(plan.modules ?? {}).filter((k) => k.startsWith("figure-"))
        .length,
    ).toBe(name === "31025-1" ? 0 : name === "6350-1" ? 3 : 1);
    expect(profiles.groups.length).toBe(name === "6350-1" ? 3 : 1);
    for (const g of profiles.groups)
      for (const [id, op] of g.operations)
        if (op.role === "hand") {
          const n = plan.steps.findIndex((s) => s.includes(id));
          expect(
            plan.steps.findIndex((s) => s.includes(op.hostIds[0])),
          ).toBeLessThan(n);
          expect(instructionReceivingIds(plan, n)).toContain(op.hostIds[0]);
          expect(plan.stepMetadata![n].alternateBeforePlacement).toBe(true);
          const detail = instructionAlternateIds(plan, n);
          expect(detail).toContain(op.hostIds[0]);
          expect(detail).not.toContain(id);
          if (name === "31025-1") {
            expect(plan.stepMetadata![n].alternateDetailIds).toBeDefined();
            expect(detail.every((id) => g.ids.includes(id))).toBe(true);
            expect(plan.stepMetadata![n].notes).toMatch(
              /omits the surrounding model/,
            );
          }
        }
    expect(exportLDraw(p)).toBe(before);
    expect(new Set(plan.steps.flat()).size).toBe(all.length);
    p.instructionPlans.heuristic = plan;
    validateDocument(p);
  }
});
it("rejects figure ordering atomically when a known host prerequisite would cycle", () => {
  for (const constraint of ["supports", "hosts", "access"] as const) {
    const { profiles, items } = graph(),
      g = profiles.groups[0];
    const [hand, op] = [...g.operations].find(([, op]) => op.role === "hand")!;
    const child = items.find((i) => i.ids.includes(hand))!,
      host = items.find((i) => i.ids.includes(op.hostIds[0]))!;
    host[constraint].add(child.index);
    const snapshot = items.map((i) => [...i.access]);
    const result = figurePrecedence(profiles.groups, items);
    expect(result.conflicts).toBe(1);
    expect(result.operations.size).toBe(0);
    expect(result.groups).toEqual([]);
    expect(items.map((i) => [...i.access])).toEqual(snapshot);
    expect(host[constraint].has(child.index)).toBe(true);
  }
});
it("rejects figure workbenches for any known relationship crossing the source boundary", () => {
  for (const relation of ["supports", "hosts", "access", "adjacent"] as const)
    for (const reverse of [false, true]) {
      const { profiles, items } = graph();
      const external: FigureGraphItem = {
        ...items[0],
        index: items.length,
        ids: ["outside"],
        supports: new Set(),
        hosts: new Set(),
        access: new Set(),
        adjacent: new Set(),
      };
      items.push(external);
      expect(figureWorkbenchCandidates(profiles.groups, items)).toHaveLength(1);
      (reverse ? external : items[0])[relation].add(
        reverse ? 0 : external.index,
      );
      expect(figureWorkbenchCandidates(profiles.groups, items)).toEqual([]);
      expect((reverse ? external : items[0])[relation].size).toBe(1);
    }
  for (const change of ["box", "broad", "component"] as const) {
    const { profiles, items } = graph();
    if (change === "box") items[0].box = null;
    else if (change === "broad") items[0].broad = true;
    else items[0].component = {};
    expect(figureWorkbenchCandidates(profiles.groups, items)).toEqual([]);
  }
});
it("rejects receiver detail masks that invent, repeat or introduce future members", () => {
  const { plan } = generateInstructions(project()),
    n = plan.stepMetadata!.findIndex((m) => m.alternateBeforePlacement);
  const host = instructionReceivingIds(plan, n)[0];
  for (const ids of [["outside"], plan.steps[n], [host, host], []]) {
    const changed = structuredClone(plan);
    changed.stepMetadata![n].alternateDetailIds = ids;
    expect(() => validateInstructionProgramme(changed)).toThrow(
      /Receiver detail/,
    );
  }
  const changed = structuredClone(plan);
  changed.stepMetadata![n].alternateDetailIds = [host];
  expect(() => validateInstructionProgramme(changed)).not.toThrow();
  changed.stepMetadata![n].alternateBeforePlacement = false;
  expect(() => validateInstructionProgramme(changed)).toThrow(
    /Receiver detail/,
  );
});
