import { readFile } from "node:fs/promises";
import { encodeNative, decodeNative } from "../../src/persistence/native";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { describe, expect, it } from "vitest";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { Editor } from "../../src/core/commands";
import { generateInstructions } from "../../src/instructions/generate";
import { validateInstructionCamera } from "../../src/instructions/edit";
import { prepareInstructionPlan } from "../../src/instructions/publish";
const brick = (x: number, y: number, color = 4) =>
  `1 ${color} ${x} ${y} 0 1 0 0 0 1 0 0 0 1 3001.dat`;
const stack = () =>
  importLDraw(
    [
      "0 Stack in deliberately reversed source order",
      brick(0, -48),
      brick(0, 0),
      brick(0, -24),
    ].join("\n"),
  );
describe("heuristic instruction generation", () => {
  it("introduces supports first, irrespective of source order or STEP hints", () => {
    const p = stack(),
      before = exportLDraw(p),
      { plan, report } = generateInstructions(p);
    const byId = new Map(occurrences(p).map((o) => [o.id, o]));
    expect(
      plan.steps.flat().map((id) => byId.get(id)!.transform.position[1]),
    ).toEqual([0, -24, -48]);
    expect(report.connectorCovered).toBe(3);
    expect(report.unanchored).toBe(0);
    expect(exportLDraw(p)).toBe(before);
    expect(p.instructionPlans).toEqual({});
    for (const m of plan.stepMetadata!) validateInstructionCamera(m.camera!);
  });
  it("is repeatable and covers repeated submodel instances exactly once", () => {
    const p = importLDraw(
      "0 FILE main.ldr\n1 4 -100 0 0 1 0 0 0 1 0 0 0 1 sub.ldr\n1 1 100 0 0 1 0 0 0 1 0 0 0 1 sub.ldr\n0 FILE sub.ldr\n" +
        brick(0, -24, 16) +
        "\n" +
        brick(0, 0, 16),
    );
    const a = generateInstructions(p),
      b = generateInstructions(p);
    expect(a).toEqual(b);
    expect(new Set(a.plan.steps.flat())).toEqual(
      new Set(occurrences(p).map((o) => o.id)),
    );
    expect(a.plan.steps.flat()).toHaveLength(4);
  });
  it("groups nearby peers, caps lots and additions, and keeps remote regions separate", () => {
    const p = importLDraw(
      [0, 100, 200, 1000].map((x) => brick(x, 0)).join("\n"),
    );
    const { plan } = generateInstructions(p, { maxPerStep: 2 });
    expect(Math.max(...plan.steps.map((s) => s.length))).toBe(2);
    const byId = new Map(occurrences(p).map((o) => [o.id, o]));
    for (const step of plan.steps) {
      const xs = step.map((id) => byId.get(id)!.transform.position[0]);
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(120);
    }
  });
  it("reports unknown parts, non-rigid placement and loose drawing geometry without inventing connectors", () => {
    const p = importLDraw(
      "1 4 0 0 0 1 0 0 0 1 0 0 0 1 unavailable.dat\n1 1 120 -24 0 -1 0 0 0 1 0 0 0 1 3001.dat\n3 4 0 0 0 20 0 0 0 -20 0",
    );
    const { plan, report } = generateInstructions(p);
    expect(report.connectorCovered).toBe(0);
    expect(report.boundsUnknown).toBe(1);
    expect(plan.steps.flat()).toHaveLength(3);
    expect(report.warnings.join(" ")).toMatch(/unknown connector/);
    expect(plan.stepMetadata!.map((s) => s.notes).join(" ")).toMatch(
      /drawing geometry/,
    );
  });
  it("preserves imported plans and source, persists provenance, and supports undo/redo", () => {
    const p = stack();
    p.instructionPlans.original = {
      name: "Authored",
      steps: [occurrences(p).map((o) => o.id)],
    };
    const before = exportLDraw(p),
      editor = new Editor(p);
    const result = editor.dispatch({
      schemaVersion: 1,
      commandId: "generate",
      expectedRevision: p.revision,
      type: "instructions.generate",
      payload: { maxPerStep: 3 },
    });
    const id = result.addedPlanIds[0];
    expect(editor.project.instructionPlans.original).toEqual(
      p.instructionPlans.original,
    );
    expect(exportLDraw(editor.project)).toBe(before);
    const prepared = prepareInstructionPlan(editor.project, id);
    expect(prepared.coverage.complete).toBe(true);
    expect(prepared.assemblyValidated).toBe(false);
    expect(prepared.generation!.sourceRevision).toBe(p.revision);
    expect(prepared.warnings).toContain(prepared.generation!.warnings.at(-1));
    editor.dispatch({
      schemaVersion: 1,
      commandId: "undo",
      expectedRevision: editor.project.revision,
      type: "history.undo",
      payload: {},
    });
    expect(editor.project.instructionPlans[id]).toBeUndefined();
    editor.dispatch({
      schemaVersion: 1,
      commandId: "redo",
      expectedRevision: editor.project.revision,
      type: "history.redo",
      payload: {},
    });
    expect(editor.project.instructionPlans[id].steps).toHaveLength(3);
  });
  it("round-trips a generated plan and generation-time findings through native storage", async () => {
    const p = stack();
    p.instructionPlans.generated = generateInstructions(p).plan;
    const recovered = await decodeNative(await encodeNative(p));
    expect(recovered.instructionPlans).toEqual(p.instructionPlans);
  });
  for (const name of ["6350-1", "31088-1"])
    it(`covers the unmodified OMR ${name} with unique physical/drawing occurrences`, async () => {
      registerFullLibraryFromDisk();
      const raw = await readFile(
        new URL(`../../fixtures/instructions/omr/${name}.mpd`, import.meta.url),
        "utf8",
      );
      const p = importLDraw(raw, name + ".mpd"),
        before = exportLDraw(p),
        { plan, report } = generateInstructions(p);
      expect(plan.steps.flat().length).toBe(name === "6350-1" ? 166 : 230);
      expect(new Set(plan.steps.flat())).toEqual(
        new Set(occurrences(p).map((o) => o.id)),
      );
      expect(exportLDraw(p)).toBe(before);
      if (name === "31088-1") expect(report.connectorCovered).toBe(0); // preserve rounded, non-rigid poses
    });
  it("rejects unsupported sizes, empty models and unknown command options atomically", () => {
    for (const n of [0, 21, 1.5, NaN])
      expect(() => generateInstructions(stack(), { maxPerStep: n })).toThrow(
        /1–20/,
      );
    expect(() => generateInstructions(importLDraw("0 Empty"))).toThrow(
      /1–5,000/,
    );
    const editor = new Editor(stack()),
      before = editor.project;
    expect(() =>
      editor.dispatch({
        schemaVersion: 1,
        commandId: "bad",
        expectedRevision: before.revision,
        type: "instructions.generate",
        payload: { unsafe: true },
      }),
    ).toThrow();
    expect(editor.project).toEqual(before);
  });
});

it("provides local close-ups with a whole-assembly context for distant small additions", () => {
  const p = importLDraw(
    [brick(0, 0), brick(1200, 0), brick(0, -24)].join("\n"),
  );
  const { plan } = generateInstructions(p, { maxPerStep: 1 });
  expect(
    plan.stepMetadata!.some(
      (m) => m.contextCamera && m.camera!.span! < m.contextCamera.span!,
    ),
  ).toBe(true);
  for (const m of plan.stepMetadata!)
    if (m.contextCamera) validateInstructionCamera(m.contextCamera);
});

it("keeps dependent plate courses in separate unordered pictures", () => {
  const p = importLDraw(
    [0, -8, -16]
      .map((y) => `1 4 0 ${y} 0 1 0 0 0 1 0 0 0 1 3020.dat`)
      .join("\n"),
  );
  const { plan } = generateInstructions(p);
  expect(plan.steps.map((s) => s.length)).toEqual([1, 1, 1]);
});
it("finishes a ready authored region before alternating unrelated modules", () => {
  const p = importLDraw(
    "0 FILE root.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 a.ldr\n1 1 1000 0 0 1 0 0 0 1 0 0 0 1 b.ldr\n0 FILE a.ldr\n" +
      [0, -24, -48].map((y) => brick(0, y)).join("\n") +
      "\n0 FILE b.ldr\n" +
      [0, -24, -48].map((y) => brick(0, y)).join("\n"),
  );
  const { plan } = generateInstructions(p),
    byId = new Map(occurrences(p).map((o) => [o.id, o]));
  const regions = plan.steps.map(
    (s) => new Set(s.map((id) => byId.get(id)!.path[0])),
  );
  expect(regions.every((s) => s.size === 1)).toBe(true);
  const first = byId.get(plan.steps[0][0])!.path[0];
  expect(
    plan.steps.slice(0, 3).every((s) => byId.get(s[0])!.path[0] === first),
  ).toBe(true);
});
