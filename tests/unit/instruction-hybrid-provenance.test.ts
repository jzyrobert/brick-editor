import { expect, it } from "vitest";
import { importLDraw } from "../../src/ldraw/io";
import { Editor } from "../../src/core/commands";
import { validateDocument } from "../../src/core/document";
import {
  generateInstructions,
  type InstructionPlanningEvidence,
} from "../../src/instructions/generate";
import {
  insertionChecksCurrent,
  effectiveInsertionChecks,
} from "../../src/instructions/motion";
import { insertionFingerprint } from "../../src/instructions/collision";
import { encodeNative, decodeNative } from "../../src/persistence/native";
import { prepareInstructionPlan } from "../../src/instructions/publish";

const source = () =>
  importLDraw(
    "1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat",
  );
it("captures immutable planning evidence without exposing graph sets to the maintainer", () => {
  const p = source(),
    baseline = generateInstructions(p).plan;
  let captured: InstructionPlanningEvidence | undefined;
  const plan = generateInstructions(p, {}, (e) => {
    captured = structuredClone(e);
    for (const unit of e.units) {
      unit.supports.length = 0;
      unit.ids.length = 0;
    }
    e.connectorCovered.length = 0;
  }).plan;
  expect(captured!.units.flatMap((u) => u.ids)).toHaveLength(2);
  expect(captured!.units.some((u) => u.supports.length || u.hosts.length)).toBe(
    true,
  );
  expect(plan).toEqual(baseline);
});
it("persists explicit agent provenance and binds retained checks to the current source/programme", async () => {
  const p = source(),
    { plan } = generateInstructions(p);
  delete plan.generation;
  plan.presentation = "pictorial";
  plan.refinement = {
    mode: "agent",
    baselineAlgorithm: "connected-bottom-up-v16",
    baselinePlanHash: "pinned-plan",
    baselineSourceHash: "pinned-source",
    retainedInsertionChecks: 1,
    unknownInsertionChecks: 1,
    insertionFingerprint: insertionFingerprint(p, plan),
  };
  plan.stepMetadata![0].insertionChecks = [
    {
      occurrenceIds: plan.steps[0],
      status: "clear",
      scope: "cad-surface-translation",
      from: [0, 40, 0],
      to: [0, 0, 0],
    },
  ];
  p.instructionPlans.hybrid = plan;
  validateDocument(p);
  expect(insertionChecksCurrent(p, plan)).toBe(true);
  const restored = await decodeNative(await encodeNative(p));
  expect(restored.instructionPlans.hybrid.refinement).toEqual(plan.refinement);
  const prepared = prepareInstructionPlan(restored, "hybrid");
  expect(prepared.refinement).toEqual(plan.refinement);
  expect(prepared.generation).toBeUndefined();
  expect(prepared.refinement).not.toBe(
    restored.instructionPlans.hybrid.refinement,
  );
  expect(
    effectiveInsertionChecks(
      restored,
      restored.instructionPlans.hybrid,
      restored.instructionPlans.hybrid.stepMetadata![0],
    )![0].status,
  ).toBe("clear");
  restored.models[restored.rootModelId].nodes[0].transform.position[0] += 1;
  expect(
    insertionChecksCurrent(restored, restored.instructionPlans.hybrid),
  ).toBe(false);
  expect(
    effectiveInsertionChecks(
      restored,
      restored.instructionPlans.hybrid,
      restored.instructionPlans.hybrid.stepMetadata![0],
    )![0].status,
  ).toBe("unknown");
  const stalePublication = prepareInstructionPlan(restored, "hybrid");
  expect(stalePublication.warnings).toContain(
    "Geometry or step order changed after agent refinement. Retained baseline approach results are unknown for this publication.",
  );
  expect(stalePublication.steps[0].insertionChecks![0].status).toBe("unknown");
});
it.each(["camera", "structural"] as const)(
  "invalidates agent refinement provenance on a %s edit but retains it for notes",
  (kind) => {
    const p = source(),
      { plan } = generateInstructions(p);
    delete plan.generation;
    plan.refinement = {
      mode: "agent",
      baselineAlgorithm: "connected-bottom-up-v16",
      baselinePlanHash: "plan",
      baselineSourceHash: "source",
      retainedInsertionChecks: 0,
      unknownInsertionChecks: 2,
      insertionFingerprint: insertionFingerprint(p, plan),
    };
    p.instructionPlans.hybrid = plan;
    const editor = new Editor(p);
    editor.dispatch({
      schemaVersion: 1,
      commandId: "notes",
      expectedRevision: editor.revision,
      type: "instructions.step.update",
      payload: { planId: "hybrid", index: 0, notes: "Hold the base." },
    });
    expect(editor.project.instructionPlans.hybrid.refinement).toEqual(
      plan.refinement,
    );
    editor.dispatch(
      kind === "camera"
        ? {
            schemaVersion: 1,
            commandId: "camera",
            expectedRevision: editor.revision,
            type: "instructions.step.update",
            payload: { planId: "hybrid", index: 0, camera: null },
          }
        : {
            schemaVersion: 1,
            commandId: "order",
            expectedRevision: editor.revision,
            type: "instructions.step.reorder",
            payload: {
              planId: "hybrid",
              indices: plan.steps.map((_, i) => i).reverse(),
            },
          },
    );
    expect(editor.project.instructionPlans.hybrid.refinement).toBeUndefined();
  },
);
