import { expect, it } from "vitest";
import { Editor } from "../../src/core/commands";
import { occurrences } from "../../src/core/document";
import { template } from "../../src/catalog/templates";
import { uid, type CameraSpec } from "../../src/core/types";
import { copyFragment } from "../../src/core/fragments";
import { decodeNative, encodeNative } from "../../src/persistence/native";
import { instructionCoverage } from "../../src/instructions/edit";
const command = (
  e: Editor,
  type: string,
  payload: Record<string, unknown> = {},
) =>
  e.dispatch({
    schemaVersion: 1,
    commandId: uid(),
    expectedRevision: e.project.revision,
    type,
    payload,
  });
const camera: CameraSpec = {
  space: "ldraw",
  projection: "perspective",
  position: [100, -200, 300],
  target: [0, 0, 0],
  up: [0, -1, 0],
  fovDeg: 45,
  near: 0.5,
  far: 10000,
};
it("splits, reorders, merges and reassigns additions atomically with aligned notes/cameras and exact undo", () => {
  const e = new Editor(template("wall")),
    ids = occurrences(e.project)
      .slice(0, 4)
      .map((o) => o.id),
    planId = command(e, "instructions.create", {
      name: "Editable",
      occurrenceIds: ids,
    }).addedPlanIds[0];
  command(e, "instructions.step.update", {
    planId,
    index: 0,
    notes: "Original step",
    camera,
  });
  const before = e.project;
  command(e, "instructions.step.split", {
    planId,
    index: 0,
    occurrenceIds: ids.slice(2),
  });
  expect(e.project.instructionPlans[planId].steps).toEqual([
    ids.slice(0, 2),
    ids.slice(2),
  ]);
  expect(e.project.instructionPlans[planId].stepMetadata![1]).toEqual({
    camera,
  });
  command(e, "history.undo");
  expect({ ...e.project, revision: before.revision }).toEqual(before);
  command(e, "history.redo");
  command(e, "instructions.step.update", {
    planId,
    index: 1,
    notes: "Split step",
    camera: { ...camera, position: [300, -200, 100] },
  });
  command(e, "instructions.step.reorder", { planId, indices: [1, 0] });
  expect(e.project.instructionPlans[planId].stepMetadata![0].notes).toBe(
    "Split step",
  );
  command(e, "instructions.step.merge", { planId, index: 0 });
  expect(e.project.instructionPlans[planId].steps).toEqual([
    [...ids.slice(2), ...ids.slice(0, 2)],
  ]);
  expect(e.project.instructionPlans[planId].stepMetadata![0].notes).toBe(
    "Split step\n\nOriginal step",
  );
  expect(
    e.project.instructionPlans[planId].stepMetadata![0].camera!.position,
  ).toEqual([300, -200, 100]);
  command(e, "instructions.step.add", { planId });
  command(e, "instructions.step.assign", {
    planId,
    index: 1,
    occurrenceIds: [ids[0]],
  });
  expect(e.project.instructionPlans[planId].steps[0]).not.toContain(ids[0]);
  expect(e.project.instructionPlans[planId].steps[1]).toEqual([ids[0]]);
  expect(
    instructionCoverage(e.project, e.project.instructionPlans[planId])
      .introduced,
  ).toBe(4);
});
it("rejects invalid membership, permutations, camera ranges and ambiguous removals without partial mutations", () => {
  const e = new Editor(template("wall")),
    ids = occurrences(e.project)
      .slice(0, 2)
      .map((o) => o.id),
    planId = command(e, "instructions.create", {
      name: "Plan",
      occurrenceIds: ids,
    }).addedPlanIds[0],
    before = e.project;
  for (const [type, payload] of [
    [
      "instructions.step.assign",
      { planId, index: 0, occurrenceIds: ["missing"] },
    ],
    ["instructions.step.split", { planId, index: 0, occurrenceIds: ids }],
    ["instructions.step.reorder", { planId, indices: [0, 0] }],
    [
      "instructions.step.update",
      { planId, index: 0, camera: { ...camera, target: camera.position } },
    ],
    ["instructions.step.remove", { planId, index: 0 }],
  ] as const) {
    expect(() => command(e, type, payload)).toThrow();
    expect(e.project).toEqual(before);
  }
  command(e, "instructions.step.remove", {
    planId,
    index: 0,
    disposition: "unassign",
  });
  expect(e.project.instructionPlans[planId].steps).toEqual([]);
  expect(occurrences(e.project)).toEqual(occurrences(before));
  command(e, "history.undo");
  expect({ ...e.project, revision: before.revision }).toEqual(before);
});
it("keeps metadata aligned through clipboard filtering/remapping, structural model changes, part removal and native persistence", async () => {
  const e = new Editor(template("wall")),
    ids = occurrences(e.project)
      .slice(0, 3)
      .map((o) => o.id),
    planId = command(e, "instructions.create", {
      name: "Portable",
      occurrenceIds: ids,
    }).addedPlanIds[0];
  command(e, "instructions.step.split", {
    planId,
    index: 0,
    occurrenceIds: [ids[2]],
  });
  command(e, "instructions.step.update", { planId, index: 0, notes: "First" });
  command(e, "instructions.step.update", {
    planId,
    index: 1,
    notes: "Second",
    camera,
  });
  const fragment = copyFragment(e.project, { occurrenceIds: [ids[2]] });
  const sourcePlan = Object.values(fragment.project.instructionPlans).find(
    (p) => p.name === "Portable",
  )!;
  expect(sourcePlan.steps).toHaveLength(1);
  expect(sourcePlan.stepMetadata).toEqual([{ notes: "Second", camera }]);
  const pasted = new Editor();
  command(pasted, "clipboard.paste", { fragment });
  const copied = Object.values(pasted.project.instructionPlans).find(
    (p) => p.name === "Portable (pasted)",
  )!;
  expect(copied.stepMetadata).toEqual(sourcePlan.stepMetadata);
  expect(copied.steps[0]).not.toEqual(sourcePlan.steps[0]);
  command(e, "models.makeSubmodel", {
    occurrenceIds: ids.slice(0, 2),
    name: "Assembly",
    pivot: [0, 0, 0],
  });
  expect(e.project.instructionPlans[planId].stepMetadata![1].notes).toBe(
    "Second",
  );
  const current = e.project.instructionPlans[planId].steps[1][0];
  command(e, "parts.remove", { occurrenceIds: [current] });
  expect(e.project.instructionPlans[planId].steps[1]).toEqual([]);
  expect(e.project.instructionPlans[planId].stepMetadata![1].notes).toBe(
    "Second",
  );
  expect(await decodeNative(await encodeNative(e.project))).toEqual(e.project);
});

it("clears the derived context locator when the user changes a step camera", () => {
  const p = template("wall"),
    id = occurrences(p)[0].id;
  p.instructionPlans.detail = {
    name: "Detail",
    steps: [[id]],
    stepMetadata: [{ camera, contextCamera: camera }],
  };
  const e = new Editor(p);
  command(e, "instructions.step.update", {
    planId: "detail",
    index: 0,
    camera: { ...camera, position: [400, -300, 200] },
  });
  expect(
    e.project.instructionPlans.detail.stepMetadata![0].contextCamera,
  ).toBeUndefined();
  command(e, "history.undo");
  expect(
    e.project.instructionPlans.detail.stepMetadata![0].contextCamera,
  ).toEqual(camera);
});
