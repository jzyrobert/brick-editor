import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { occurrences, validateDocument } from "../../src/core/document";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import {
  decorationProfiles,
  DECORATION_SOURCE_SHA256,
} from "../../src/instructions/decoration-procedures";
import { generateInstructions } from "../../src/instructions/generate";
import {
  instructionAlternateIds,
  instructionDisplayStates,
  instructionReceivingIds,
} from "../../src/instructions/programme";
import { sourcePrecedence } from "../../src/instructions/source-procedures";
import { encodeNative, decodeNative } from "../../src/persistence/native";

registerFullLibraryFromDisk();
const row = (ref: string, x = 0, y = 0, z = 0, basis = "1 0 0 0 1 0 0 0 1") =>
  `1 16 ${x} ${y} ${z} ${basis} ${ref}`;
const sticker = (x = 0, y = 36, z = 10) =>
  row("195075b.dat", x, y, z, "1 0 0 0 0 1 0 -1 0");
const pair = () => [row("2362a.dat", -20), row("2362a.dat", 20), sticker()];
const model = (
  rows: string[],
  transform = "0 0 0 1 0 0 0 1 0 0 0 1",
  outside = "",
) =>
  importLDraw(
    [
      "0 FILE main.ldr",
      `1 16 ${transform} panels.ldr`,
      outside,
      "0 FILE panels.ldr",
      ...rows,
    ].join("\n"),
  );

it("pins the actual sticker and finite outer panel quads, including their winding", () => {
  const sources = fullLibrarySources(Object.keys(DECORATION_SOURCE_SHA256));
  for (const [ref, hash] of Object.entries(DECORATION_SOURCE_SHA256))
    expect(createHash("sha256").update(sources[ref]).digest("hex"), ref).toBe(
      hash,
    );
  expect(sources["2362a.dat"]).toContain(
    "4 16 20 72 10 -20 72 10 -20 0 10 20 0 10",
  );
  expect(sources["4215a.dat"]).toContain(
    "4 16 40 72 10 -40 72 10 -40 0 10 40 0 10",
  );
  expect(sources["195075b.dat"]).toContain(
    "28 0 0 0 0.25 0 0 0 19 box5-12.dat",
  );
});
it("requires every contributing panel of a complete nonoverlapping footprint under world rotation", () => {
  for (const transform of [
    "0 0 0 1 0 0 0 1 0 0 0 1",
    "100 200 300 0 0 1 0 1 0 -1 0 0",
    "100 200 300 1 0 0 0 0 -1 0 1 0",
  ]) {
    const p = model(pair(), transform),
      all = occurrences(p),
      g = decorationProfiles(p, all).groups[0];
    expect(g.edges).toEqual([
      [all[2].id, all[0].id],
      [all[2].id, all[1].id],
    ]);
    const op = g.operations.get(all[2].id)!;
    expect(op.detailIds).toEqual(all.slice(0, 2).map((o) => o.id));
    expect(op.notes).toMatch(/crosses their seam/);
    expect(op.notes).toMatch(/does not verify adhesion/);
  }
  const p = model([row("4215a.dat"), sticker()]),
    all = occurrences(p);
  expect(
    decorationProfiles(p, all).groups[0].operations.get(all[1].id)!.hostIds,
  ).toEqual([all[0].id]);
});
it("rejects incomplete, gapped, overlapping, reversed, tilted, distorted and off-plane faces", () => {
  for (const rows of [
    [pair()[0], sticker()],
    [row("2362a.dat", -20.5), row("2362a.dat", 20.5), sticker()],
    [...pair(), pair()[0]],
    [row("4215a.dat"), sticker(0, 10)],
    [row("4215a.dat"), sticker(0, 36, 10.2)],
    [row("4215a.dat"), row("195075b.dat", 0, 36, 10, "1 0 0 0 0 -1 0 1 0")],
    [
      row("4215a.dat"),
      row("195075b.dat", 0, 36, 10, "0.99995 -0.01 0 0 0 1 -0.01 -0.99995 0"),
    ],
    [row("4215a.dat"), row("195075b.dat", 0, 36, 10, "1.03 0 0 0 0 1 0 -1 0")],
  ]) {
    const p = model(rows);
    expect(
      decorationProfiles(p, occurrences(p)).groups,
      rows.join("\n"),
    ).toHaveLength(0);
  }
});
it("rejects competing sticker footprints while permitting disjoint decorations", () => {
  const p = model([...pair(), sticker(1)]);
  expect(decorationProfiles(p, occurrences(p)).groups).toHaveLength(0);
  const disjoint = model([
    row("4215a.dat", -50),
    row("4215a.dat", 50),
    sticker(-50),
    sticker(50),
  ]);
  expect(
    decorationProfiles(disjoint, occurrences(disjoint)).groups,
  ).toHaveLength(2);
});
it("projects the receiving landmark onto the reviewed face within a numerical display tolerance", () => {
  const p = model([row("4215a.dat"), sticker(0, 36, 10.03)]),
    all = occurrences(p);
  const op = decorationProfiles(p, all).groups[0].operations.get(all[1].id)!;
  expect(op.feature).toEqual([0, 36, 10]);
  expect(all[1].transform.position[2]).toBe(10.03);
  const outside = model([row("4215a.dat"), sticker(0, 36, 10.06)]);
  expect(decorationProfiles(outside, occurrences(outside)).groups).toHaveLength(
    0,
  );
});
it("rejects source shadowing, foreign parent faces and changed library locks", () => {
  const p = model(pair()),
    all = occurrences(p);
  all[0].namespace = "project";
  expect(decorationProfiles(p, all).groups).toHaveLength(0);
  const foreign = model([sticker()], undefined, row("4215a.dat"));
  expect(decorationProfiles(foreign, occurrences(foreign)).groups).toHaveLength(
    0,
  );
  p.library.full!.manifestSha256 = "changed";
  expect(decorationProfiles(p, occurrences(p)).groups).toHaveLength(0);
});
it("discards earlier matches when a later duplicate or the complete uniqueness scan exceeds budget", () => {
  const p = model([...pair(), row("4215a.dat", 500), sticker(500)]),
    all = occurrences(p);
  for (const budget of [0, 1, 4, 6, -1, 200001, 1.5]) {
    const r = decorationProfiles(p, all, budget);
    expect(r.exhausted).toBe(true);
    expect(r.groups).toEqual([]);
  }
});
it("retains both original panel prerequisites atomically when a decoration would create a cycle", () => {
  const p = model(pair()),
    all = occurrences(p),
    groups = decorationProfiles(p, all).groups;
  const items = all.map((o, index) => ({
    index,
    ids: [o.id],
    box: null,
    broad: false,
    adjacent: new Set<number>(),
    supports: new Set<number>(),
    hosts: new Set<number>(),
    access: new Set<number>(),
  }));
  items[1].supports.add(2);
  const before = items.map((i) => [...i.access]);
  const r = sourcePrecedence(groups, items);
  expect(r.conflicts).toBe(1);
  expect(r.operations.size).toBe(0);
  expect(items.map((i) => [...i.access])).toEqual(before);
});
it("keeps both official seam receivers present, source identity exact and assembly unknown", async () => {
  const p = importLDraw(
      await readFile("fixtures/instructions/omr/6361-1.mpd", "utf8"),
    ),
    before = exportLDraw(p),
    all = occurrences(p),
    profiles = decorationProfiles(p, all),
    plan = generateInstructions(p).plan;
  expect(profiles.groups).toHaveLength(2);
  for (const g of profiles.groups)
    for (const [id, op] of g.operations) {
      const n = plan.steps.findIndex((s) => s.includes(id));
      expect(plan.steps[n]).toEqual([id]);
      expect(op.hostIds).toHaveLength(2);
      expect(all.find((o) => o.id === op.hostIds[0])!.node.ref).toBe(
        "4215a.dat",
      );
      expect(new Set(instructionAlternateIds(plan, n))).toEqual(
        new Set(op.detailIds),
      );
      expect(
        op.hostIds.every((h) => instructionReceivingIds(plan, n).includes(h)),
      ).toBe(true);
      expect(
        plan.stepMetadata![n].insertionChecks!.every(
          (c) => c.status === "unknown" && !c.from,
        ),
      ).toBe(true);
      expect(plan.stepMetadata![n].notes).toContain(op.notes);
      expect(
        plan.stepMetadata![n].targets!.find((t) => t.label === "P")!.caption,
      ).toContain("4215a.dat");
    }
  const container = Object.entries(plan.modules!).find(([, m]) =>
    m.name.includes("container"),
  )!;
  expect(container[1].occurrenceIds).toHaveLength(23);
  const scene = plan.stepMetadata!.find(
    (m) => m.assembly?.type === "join" && m.assembly.moduleId === container[0],
  )!;
  expect(scene.camera!.position[1]).toBeLessThan(scene.camera!.target[1]);
  const states = instructionDisplayStates(plan),
    member = new Set(container[1].occurrenceIds);
  for (let n = 0; n < plan.steps.length; n++)
    if (
      plan.stepMetadata![n].assembly?.moduleId === container[0] &&
      plan.stepMetadata![n].assembly?.type === "build"
    )
      expect(states[n].displayIds.every((id) => member.has(id))).toBe(true);
  expect(plan.steps.flat()).toHaveLength(170);
  expect(new Set(plan.steps.flat()).size).toBe(170);
  expect(exportLDraw(p)).toBe(before);
  p.instructionPlans.heuristic = plan;
  validateDocument(p);
  expect(
    (await decodeNative(await encodeNative(p))).instructionPlans.heuristic,
  ).toEqual(JSON.parse(JSON.stringify(plan)));
});
