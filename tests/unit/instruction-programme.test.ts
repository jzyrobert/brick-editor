import { it, expect } from "vitest";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { occurrences, validateDocument } from "../../src/core/document";
import { generateInstructions } from "../../src/instructions/generate";
import {
  instructionDisplayStates,
  validateInstructionProgramme,
} from "../../src/instructions/programme";
import { prepareInstructionPlan } from "../../src/instructions/publish";
import { editInstructions } from "../../src/instructions/edit";
import { encodeNative, decodeNative } from "../../src/persistence/native";
const line = (ref: string, x = 0, y = 0) =>
  `1 4 ${x} ${y} 0 1 0 0 0 1 0 0 0 1 ${ref}`;
const model = () =>
  importLDraw(
    "0 FILE root.ldr\n" +
      line("section.ldr") +
      "\n" +
      line("section.ldr", 200) +
      "\n" +
      line("3001.dat", 500) +
      "\n0 FILE section.ldr\n" +
      [0, -24, -48, -72].map((y) => line("3001.dat", 0, y)).join("\n"),
  );
it("replays separate workbenches and zero-new-part joins without duplicating inventory or source poses", async () => {
  const p = model(),
    source = exportLDraw(p),
    { plan } = generateInstructions(p),
    states = instructionDisplayStates(plan);
  expect(Object.values(plan.modules!)).toHaveLength(2);
  expect(
    plan.stepMetadata!.filter((m) => m.assembly?.type === "join"),
  ).toHaveLength(2);
  const joined = new Set<string>();
  for (let n = 0; n < plan.steps.length; n++) {
    const action = plan.stepMetadata![n].assembly;
    if (action?.type === "build")
      expect(
        states[n].displayIds.every((id) =>
          plan.modules![action.moduleId].occurrenceIds.includes(id),
        ),
      ).toBe(true);
    if (action?.type === "join") {
      expect(plan.steps[n]).toEqual([]);
      expect(states[n].incomingIds).toEqual(
        plan.modules![action.moduleId].occurrenceIds,
      );
      joined.add(action.moduleId);
    }
  }
  expect(new Set(states.at(-1)!.displayIds)).toEqual(
    new Set(occurrences(p).map((o) => o.id)),
  );
  expect(plan.steps.flat()).toHaveLength(9);
  expect(exportLDraw(p)).toBe(source);
  p.instructionPlans.test = plan;
  validateDocument(p);
  const prepared = prepareInstructionPlan(p, "test");
  expect(prepared.inventory.reduce((n, l) => n + l.quantity, 0)).toBe(9);
  expect(
    prepared.steps
      .filter((s) => s.incomingIds)
      .every((s) => s.partCount === 0 && s.lots.length === 0),
  ).toBe(true);
  expect(prepared.assemblyValidated).toBe(false);
  expect(
    (await decodeNative(await encodeNative(p))).instructionPlans.test,
  ).toEqual(plan);
});
it("rejects premature and duplicated joins, and structural edits flatten the derived programme", () => {
  const p = model(),
    { plan } = generateInstructions(p);
  p.instructionPlans.test = plan;
  const firstJoin = plan.stepMetadata!.findIndex(
    (m) => m.assembly?.type === "join",
  );
  const bad = structuredClone(plan);
  bad.steps.unshift([]);
  bad.stepMetadata!.unshift(structuredClone(bad.stepMetadata![firstJoin]));
  expect(() => validateInstructionProgramme(bad)).toThrow(/completed/);
  const repeat = structuredClone(plan);
  repeat.steps.push([]);
  repeat.stepMetadata!.push(structuredClone(repeat.stepMetadata![firstJoin]));
  expect(() => validateInstructionProgramme(repeat)).toThrow(
    /previously unjoined/,
  );
  editInstructions(p, "instructions.step.reorder", {
    planId: "test",
    indices: plan.steps.map((_, n) => n).reverse(),
  });
  expect(plan.modules).toBeUndefined();
  expect(plan.steps.flat()).toHaveLength(9);
  expect(plan.steps.every((s) => s.length > 0)).toBe(true);
  validateDocument(p);
});
it("keeps broad foundations and scattered source sections out of workbench candidates", () => {
  const p = importLDraw(
    "0 FILE root.ldr\n" +
      line("foundation.ldr") +
      "\n" +
      line("scattered.ldr", 1000) +
      "\n0 FILE foundation.ldr\n" +
      line("3811.dat") +
      "\n" +
      [0, -24, -48].map((y) => line("3001.dat", 0, y)).join("\n") +
      "\n0 FILE scattered.ldr\n" +
      [0, 100, 200, 300].map((x) => line("3001.dat", x)).join("\n"),
  );
  expect(generateInstructions(p).plan.modules).toBeUndefined();
});
it("resolves explicit official moved aliases for pictures without replacing source identity", async () => {
  const { registerFullLibraryFromDisk, registerFullCatalogFromDisk } =
    await import("../../scripts/full-library-node");
  registerFullLibraryFromDisk();
  await registerFullCatalogFromDisk();
  const { instructionLots } = await import("../../src/instructions/lots");
  const p = importLDraw(line("3023.dat")),
    before = exportLDraw(p);
  const lot = instructionLots(
    p,
    occurrences(p).map((o) => o.id),
    { named: true },
  )[0];
  expect(lot).toMatchObject({
    ref: "3023.dat",
    thumbnailRef: "3023b.dat",
    quantity: 1,
  });
  expect(lot.name).toMatch(/Plate 1 [x×] 2/);
  expect(exportLDraw(p)).toBe(before);
});
it("orders external source support tasks before workbench builds and their joins", () => {
  const p = importLDraw(
    "0 FILE root.ldr\n" +
      line("3001.dat", 0, 24) +
      "\n" +
      line("lower.ldr") +
      "\n" +
      line("upper.ldr", 0, -96) +
      "\n0 FILE lower.ldr\n" +
      [0, -24, -48, -72].map((y) => line("3001.dat", 0, y)).join("\n") +
      "\n0 FILE upper.ldr\n" +
      [0, -24, -48, -72].map((y) => line("3001.dat", 0, y)).join("\n"),
  );
  const { plan } = generateInstructions(p),
    keys = Object.keys(plan.modules!);
  expect(keys).toHaveLength(2);
  const lower = keys.find((key) => plan.modules![key].name === "lower.ldr")!,
    upper = keys.find((key) => plan.modules![key].name === "upper.ldr")!;
  const lowerJoin = plan.stepMetadata!.findIndex(
    (m) => m.assembly?.moduleId === lower && m.assembly.type === "join",
  );
  const upperStart = plan.stepMetadata!.findIndex(
    (m) => m.assembly?.moduleId === upper && m.assembly.type === "build",
  );
  expect(lowerJoin).toBeLessThan(upperStart);
  const state = instructionDisplayStates(plan)[lowerJoin];
  expect(state.displayIds).toContain(
    occurrences(p).find((o) => o.path.length === 1)!.id,
  );
});
it("falls back to cumulative construction when module contraction creates a dependency cycle", () => {
  const p = importLDraw(
    "0 FILE root.ldr\n" +
      line("section.ldr") +
      "\n" +
      line("3001.dat", 0, -24) +
      "\n0 FILE section.ldr\n" +
      [0, -24, -48, -72].map((y) => line("3001.dat", 0, y)).join("\n"),
  );
  const { plan, report } = generateInstructions(p);
  expect(plan.modules).toBeUndefined();
  expect(plan.steps.flat()).toHaveLength(5);
  expect(report.warnings.join(" ")).toMatch(/reverted to cumulative/);
});
it("removing source occurrences clears destination references even without workbench candidates", async () => {
  const { Editor } = await import("../../src/core/commands");
  const p = importLDraw(
      "1 47 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n1 47 200 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
    ),
    { plan } = generateInstructions(p);
  p.instructionPlans.test = plan;
  expect(plan.modules).toBeUndefined();
  expect(plan.stepMetadata!.some((m) => m.targets?.length)).toBe(true);
  const editor = new Editor(p),
    id = occurrences(p)[0].id;
  editor.dispatch({
    schemaVersion: 1,
    commandId: "remove-marked",
    expectedRevision: p.revision,
    type: "parts.remove",
    payload: { occurrenceIds: [id] },
  });
  expect(
    editor.project.instructionPlans.test.stepMetadata!.every((m) => !m.targets),
  ).toBe(true);
  validateDocument(editor.project);
});

it("follow-along explicit plans retain zero-part joins and actual workbench visibility", async () => {
  const { deriveGuide, stepView } = await import(
    "../../src/instructions/guide"
  );
  const p = model(),
    { plan } = generateInstructions(p),
    guide = deriveGuide(p, occurrences(p), { plan });
  expect(guide.steps).toHaveLength(plan.steps.length);
  const states = instructionDisplayStates(plan);
  for (let index = 0; index < guide.steps.length; index++)
    expect(stepView(guide, index)).toEqual(states[index].displayIds);
  expect(
    guide.steps
      .filter((s) => s.assemblies.length)
      .every((s) => s.added.length === 0 && s.lots.length === 0),
  ).toBe(true);
});
