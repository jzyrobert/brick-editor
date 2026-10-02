import { expect, it } from "vitest";
import { Editor } from "../../src/core/commands";
import { generateInstructions } from "../../src/instructions/generate";
import {
  instructionWorkerData,
  restoreInstructionWorkerData,
} from "../../src/instructions/worker-data";
import { registerInstructionGeometryFromDisk } from "../../scripts/instruction-geometry-node";
import {
  registerFullLibraryFromDisk,
  registerFullCatalogFromDisk,
} from "../../scripts/full-library-node";
import { template } from "../../src/catalog/templates";
import { importLDraw } from "../../src/ldraw/io";
registerFullLibraryFromDisk();
registerFullCatalogFromDisk();
it("hands off loaded source closures and installs an undoable complete programme without regenerating", () => {
  const p = template("car");
  registerInstructionGeometryFromDisk(p);
  const expected = generateInstructions(p).plan;
  p.assets.unrelated = "irrelevant asset";
  p.instructionPlans.old = { name: "Existing", steps: [] };
  const data = structuredClone(instructionWorkerData(p));
  expect(data.project.assets).toEqual({});
  expect(data.project.instructionPlans).toEqual({});
  expect(data.sources.has("4624.dat")).toBe(true);
  restoreInstructionWorkerData(data);
  const generated = generateInstructions(data.project).plan;
  expect(generated).toEqual(expected);
  const editor = new Editor(p);
  const result = editor.dispatch({
    schemaVersion: 1,
    commandId: "install",
    expectedRevision: p.revision,
    type: "instructions.installGenerated",
    payload: { plan: generated },
  });
  expect(result.addedPlanIds).toHaveLength(1);
  expect(editor.project.instructionPlans.old).toEqual(p.instructionPlans.old);
  editor.dispatch({
    schemaVersion: 1,
    commandId: "undo",
    expectedRevision: editor.revision,
    type: "history.undo",
    payload: {},
  });
  expect(editor.project.instructionPlans).toEqual(p.instructionPlans);
  editor.dispatch({
    schemaVersion: 1,
    commandId: "redo",
    expectedRevision: editor.revision,
    type: "history.redo",
    payload: {},
  });
  expect(Object.keys(editor.project.instructionPlans)).toHaveLength(2);
});
it("rejects stale or changed generated programmes atomically", () => {
  const p = importLDraw("1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat");
  const plan = generateInstructions(p).plan,
    editor = new Editor(p);
  const changed = structuredClone(plan);
  changed.steps = [[]];
  expect(() =>
    editor.dispatch({
      schemaVersion: 1,
      commandId: "changed",
      expectedRevision: editor.revision,
      type: "instructions.installGenerated",
      payload: { plan: changed },
    }),
  ).toThrow(/match this model/);
  const stale = structuredClone(plan);
  stale.generation!.sourceRevision++;
  expect(() =>
    editor.dispatch({
      schemaVersion: 1,
      commandId: "stale",
      expectedRevision: editor.revision,
      type: "instructions.installGenerated",
      payload: { plan: stale },
    }),
  ).toThrow(/Model changed/);
  expect(editor.project.instructionPlans).toEqual({});
  expect(editor.canUndo).toBe(false);
});
