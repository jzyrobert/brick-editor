import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { occurrences, validateDocument } from "../../src/core/document";
import {
  interfaceProfiles,
  INTERFACE_SOURCE_SHA256,
} from "../../src/instructions/interface-procedures";
import { generateInstructions } from "../../src/instructions/generate";
import {
  instructionAlternateIds,
  instructionReceivingIds,
} from "../../src/instructions/programme";
import { encodeNative, decodeNative } from "../../src/persistence/native";
registerFullLibraryFromDisk();
const row = (ref: string, x = 0, y = 0, z = 0, basis = "1 0 0 0 1 0 0 0 1") =>
  `1 16 ${x} ${y} ${z} ${basis} ${ref}`;
const p = (
  rows: string[],
  transform = "0 0 0 1 0 0 0 1 0 0 0 1",
  outside = "",
) =>
  importLDraw(
    [
      "0 FILE root.ldr",
      `1 16 ${transform} section.ldr`,
      outside,
      "0 FILE section.ldr",
      ...rows,
    ].join("\n"),
  );
const control = () => [row("4592.dat"), row("4593.dat")];
const radio = () => [row("3820.dat"), row("3962b.dat", 0, -0.8229, -9.8948)];
const cup = () => [row("3820.dat"), row("3899.dat", 0, -11.8229, -29.8948)];

it("binds all nine reviewed parts, subparts and grip/pivot primitives to actual pinned bytes", () => {
  const sources = fullLibrarySources(Object.keys(INTERFACE_SOURCE_SHA256));
  expect(Object.keys(INTERFACE_SOURCE_SHA256)).toHaveLength(9);
  for (const [ref, hash] of Object.entries(INTERFACE_SOURCE_SHA256))
    expect(createHash("sha256").update(sources[ref]).digest("hex"), ref).toBe(
      hash,
    );
  const model = p(control());
  expect(interfaceProfiles(model, occurrences(model)).groups).toHaveLength(1);
  model.library.full!.manifestSha256 = "changed";
  expect(interfaceProfiles(model, occurrences(model)).groups).toHaveLength(0);
});
it("marks actual control-base bumps and preserves source pivot offsets under world rotation", () => {
  for (const transform of [
    "0 0 0 1 0 0 0 1 0 0 0 1",
    "100 200 300 0 0 1 0 1 0 -1 0 0",
    "100 200 300 1 0 0 0 0 -1 0 1 0",
  ]) {
    const model = p(control(), transform),
      all = occurrences(model),
      g = interfaceProfiles(model, all).groups[0];
    expect(g.edges).toEqual([[all[1].id, all[0].id]]);
    const base = g.operations.get(all[0].id)!,
      stick = g.operations.get(all[1].id)!;
    expect(base.notes).toMatch(/supplied already assembled, keep/);
    expect(stick.detailIds).toEqual([all[0].id]);
    expect(stick.notes).toContain("2.0 LDU");
    expect(stick.notes).toContain("not a coaxial fit");
    expect(stick.landmarks![0].position).toEqual(stick.feature);
    expect(stick.feature).not.toEqual(all[0].transform.position);
  }
});
it("refuses shadowed, foreign, distorted, ambiguous and competing control interfaces", () => {
  for (const rows of [
    [row("4592.dat"), row("4593.dat", 0, 0, 1)],
    [row("4592.dat"), row("4593.dat", 0, 0, 0, "-1 0 0 0 1 0 0 0 -1")],
    [row("4592.dat"), row("4593.dat", 0, 0, 0, "1.03 0 0 0 1 0 0 0 1")],
    [...control(), row("4592.dat")],
    [...control(), row("4593.dat")],
  ]) {
    const model = p(rows);
    expect(interfaceProfiles(model, occurrences(model)).groups).toHaveLength(0);
  }
  const foreign = p([row("4593.dat")], undefined, row("4592.dat"));
  expect(interfaceProfiles(foreign, occurrences(foreign)).groups).toHaveLength(
    0,
  );
  const model = p(control()),
    all = occurrences(model);
  all[0].namespace = "project";
  expect(interfaceProfiles(model, all).groups).toHaveLength(0);
});
it("associates finite cup/radio handles with the actual grip axis, never their body origins", () => {
  for (const rows of [radio(), cup()]) {
    const model = p(rows),
      all = occurrences(model),
      g = interfaceProfiles(model, all).groups[0];
    const op = g.operations.get(all[1].id)!;
    expect(op.hostIds).toEqual([all[0].id]);
    expect(op.feature).toEqual([0, -0.8229, -9.8948]);
    expect(op.notes).toContain("14.5 degrees");
    expect(op.notes).toContain("0.0 LDU");
    expect(op.notes).toContain("Physical fit and retention remain unverified");
  }
});
it("rejects infinite-ray, body-origin, wrong-axis, foreign and ambiguous hand-grip matches", () => {
  for (const rows of [
    [row("3820.dat"), row("3962b.dat", 0, -30, -9.8948)],
    [row("3820.dat"), row("3899.dat", 0, -0.8229, -9.8948)],
    [
      row("3820.dat"),
      row("3962b.dat", 0, -0.8229, -9.8948, "0 -1 0 1 0 0 0 0 1"),
    ],
    [row("3820.dat"), row("3962b.dat", 2, -0.8229, -9.8948)],
    [...radio(), row("3820.dat")],
    [...radio(), radio()[1]],
  ]) {
    const model = p(rows);
    expect(interfaceProfiles(model, occurrences(model)).groups).toHaveLength(0);
  }
  const model = p([radio()[1]], undefined, radio()[0]);
  expect(interfaceProfiles(model, occurrences(model)).groups).toHaveLength(0);
});
it("rejects a partial candidate when its receiver scan exhausts the work budget", () => {
  for (const rows of [
    [...control(), row("4592.dat", 200)],
    [...radio(), row("3820.dat", 200)],
    [...control(), row("4593.dat")],
    [...radio(), radio()[1]],
  ]) {
    const model = p(rows),
      result = interfaceProfiles(model, occurrences(model), 1);
    expect(result.exhausted).toBe(true);
    expect(result.groups).toHaveLength(0);
  }
});
it("preserves complete source/native inventory and true prior receivers for all three affected official models", async () => {
  for (const name of ["6450-1", "6361-1", "6350-1"]) {
    const model = importLDraw(
        await readFile(`fixtures/instructions/omr/${name}.mpd`, "utf8"),
      ),
      source = exportLDraw(model),
      all = occurrences(model),
      profiles = interfaceProfiles(model, all),
      plan = generateInstructions(model).plan;
    expect(profiles.groups).toHaveLength(name === "6450-1" ? 1 : 2);
    for (const g of profiles.groups)
      for (const [id, op] of g.operations) {
        const n = plan.steps.findIndex((s) => s.includes(id));
        expect(plan.steps[n]).toEqual([id]);
        expect(plan.stepMetadata![n].notes).toContain(op.notes);
        if (op.feature) {
          expect(instructionAlternateIds(plan, n)).toEqual(op.detailIds);
          expect(
            op.hostIds.every((h) =>
              instructionReceivingIds(plan, n).includes(h),
            ),
          ).toBe(true);
          expect(
            plan.stepMetadata![n].targets!.some(
              (t) => JSON.stringify(t.position) === JSON.stringify(op.feature),
            ),
          ).toBe(true);
        }
        expect(
          plan.stepMetadata![n].insertionChecks!.every(
            (c) => c.status === "unknown" && !c.from,
          ),
        ).toBe(true);
      }
    expect(plan.steps.flat()).toHaveLength(all.length);
    expect(new Set(plan.steps.flat()).size).toBe(all.length);
    expect(exportLDraw(model)).toBe(source);
    model.instructionPlans.heuristic = plan;
    validateDocument(model);
    expect(
      (await decodeNative(await encodeNative(model))).instructionPlans
        .heuristic,
    ).toEqual(JSON.parse(JSON.stringify(plan)));
  }
});
