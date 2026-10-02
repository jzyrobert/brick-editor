import { beforeAll, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import {
  registerFullCatalogFromDisk,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { registerInstructionGeometryFromDisk } from "../../scripts/instruction-geometry-node";
import { Editor } from "../../src/core/commands";
import { occurrences } from "../../src/core/document";
import { connectionGraph } from "../../src/core/connectivity";
import { validate } from "../../src/core/validate";
import type { Command, InstructionPlan, Project } from "../../src/core/types";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { generateInstructions } from "../../src/instructions/generate";
import { articulatedJawProfiles } from "../../src/instructions/articulated-procedures";
import {
  instructionAlternateIds,
  instructionDisplayStates,
  instructionReceivingIds,
  validateInstructionProgramme,
} from "../../src/instructions/programme";
import { insertionChecksCurrent } from "../../src/instructions/motion";
import { getLocalInstructionBounds } from "../../src/instructions/source-geometry";
import { instructionWorkerData } from "../../src/instructions/worker-data";
import { prepareInstructionPlan } from "../../src/instructions/publish";
import { decodeNative, encodeNative } from "../../src/persistence/native";

let project: Project;
let plan: InstructionPlan;
let baseline: InstructionPlan;
let originalSource: string;
let originalDocument: string;
const inventory = (p: Project) =>
  occurrences(p).map((o) => ({
    id: o.id,
    path: o.path,
    namespace: o.namespace,
    ref: o.node.ref,
    colorCode: o.colorCode,
    transform: o.transform,
  }));
const sourceModules = () => {
  const entries = Object.entries(plan.modules ?? {}).filter(
    ([, module]) => module.purpose === "source",
  );
  const child = entries.find(([, module]) => module.parentModuleId)!;
  const parent = entries.find(([id]) => id === child[1].parentModuleId)!;
  return { entries, child, parent };
};
const jawJoin = () => {
  const { child } = sourceModules();
  return plan.stepMetadata!.findIndex(
    (meta) =>
      meta.assembly?.type === "join" && meta.assembly.moduleId === child[0],
  );
};

beforeAll(async () => {
  registerFullLibraryFromDisk();
  registerFullCatalogFromDisk();
  project = importLDraw(
    await readFile("fixtures/instructions/omr/31088-1.mpd", "utf8"),
  );
  registerInstructionGeometryFromDisk(project);
  originalSource = exportLDraw(project);
  originalDocument = JSON.stringify(project);
  plan = generateInstructions(project).plan;
  baseline = generateInstructions(project, { useSourceSteps: false }).plan;
});

it("discloses source guidance while preserving all 230 exact source occurrences and strict unknown connectivity", () => {
  const all = occurrences(project),
    report = plan.generation!,
    { entries, child, parent } = sourceModules(),
    profile = articulatedJawProfiles(project, all).matches[0];
  expect(report.algorithm).toBe("connected-bottom-up-v16");
  expect(report.sourceGuidance).toBe("hierarchy-and-step-prior");
  expect(report.sourceCandidates).toBe(2);
  expect(report.total).toBe(230);
  expect(report.connectorCovered).toBe(0);
  expect(report.boundsUnknown).toBe(4);
  expect(all).toHaveLength(230);
  expect(all.filter((o) => o.namespace === "project")).toHaveLength(4);
  expect(plan.steps.flat()).toHaveLength(230);
  expect(new Set(plan.steps.flat())).toEqual(new Set(all.map((o) => o.id)));
  expect(connectionGraph(project).covered).toEqual([]);
  expect(connectionGraph(project).contacts).toBe(0);
  expect(entries).toHaveLength(2);
  expect(child[1].occurrenceIds).toHaveLength(15);
  expect(parent[1].occurrenceIds).toHaveLength(81);
  const exactSourceJaw = all.filter(
    (o) =>
      o.path.length === profile.sourcePath.length + 1 &&
      profile.sourcePath.every((id, i) => o.path[i] === id),
  );
  expect(new Set(child[1].occurrenceIds)).toEqual(
    new Set(exactSourceJaw.map((o) => o.id)),
  );
  const direct = parent[1].occurrenceIds.filter(
    (id) => !child[1].occurrenceIds.includes(id),
  );
  expect(direct).toHaveLength(66);
  expect(direct).toContain(profile.receiverId);
  expect(new Set(parent[1].occurrenceIds)).toEqual(
    new Set([...direct, ...exactSourceJaw.map((o) => o.id)]),
  );
  expect(
    all.filter((o) => !parent[1].occurrenceIds.includes(o.id)),
  ).toHaveLength(149);
  expect(JSON.stringify(project)).toBe(originalDocument);
  expect(exportLDraw(project)).toBe(originalSource);
  validateInstructionProgramme(plan);
});

it("shows the bare handle, all 15 incoming jaw parts and the completed pair without certifying a CAD route", () => {
  const { entries, child, parent } = sourceModules(),
    index = jawJoin(),
    meta = plan.stepMetadata![index],
    states = instructionDisplayStates(plan),
    match = articulatedJawProfiles(project, occurrences(project)).matches[0],
    receivers = instructionReceivingIds(plan, index);
  expect(index).toBeGreaterThan(0);
  expect(plan.steps[index]).toEqual([]);
  expect(new Set(states[index].incomingIds)).toEqual(
    new Set(child[1].occurrenceIds),
  );
  expect(new Set(receivers)).toEqual(
    new Set(
      parent[1].occurrenceIds.filter(
        (id) => !child[1].occurrenceIds.includes(id),
      ),
    ),
  );
  expect(receivers.some((id) => child[1].occurrenceIds.includes(id))).toBe(
    false,
  );
  expect(meta.alternateBeforePlacement).toBe(true);
  expect(instructionAlternateIds(plan, index)).toEqual([match.receiverId]);
  expect(meta.alternateCamera).toEqual(match.receivingCamera);
  expect(meta.camera).toEqual(match.camera);
  expect(meta.contextCamera).toBeDefined();
  expect(meta.completedDetail).toEqual(match.completedDetail);
  expect(meta.completedDetail!.occurrenceIds).toHaveLength(2);
  expect(new Set(meta.completedDetail!.occurrenceIds)).toEqual(
    new Set([match.receiverId, match.incomingId]),
  );
  expect(
    meta.targets?.filter((t) => t.occurrenceId === match.receiverId),
  ).toHaveLength(2);
  for (const [id, module] of entries) {
    expect(module.feasibility).toBe("unknown");
    const operations = plan.stepMetadata!.filter(
      (m) => m.assembly?.moduleId === id,
    );
    expect(operations.some((m) => m.assembly?.type === "build")).toBe(true);
    expect(operations.some((m) => m.assembly?.type === "join")).toBe(true);
    for (const operation of operations) {
      expect(operation.insertionChecks?.length).toBeGreaterThan(0);
      for (const check of operation.insertionChecks!) {
        expect(check.status).toBe("unknown");
        expect(check.scope).toBe("cad-surface-translation");
        expect(check).not.toHaveProperty("from");
        expect(check).not.toHaveProperty("to");
        expect(check.reason).toMatch(/unverified|not an attachment/i);
      }
    }
  }
  expect(parent[1].placement).toBe("scene");
  expect(parent[1].hostIds).toEqual([]);
  expect(new Set(states.at(-1)!.displayIds)).toEqual(
    new Set(occurrences(project).map((o) => o.id)),
  );
  expect(insertionChecksCurrent(project, plan)).toBe(true);
});

it("round-trips native source poses and publishes the full 230-piece programme with honest unknown outcomes", async () => {
  const p = structuredClone(project);
  p.instructionPlans.generated = structuredClone(plan);
  const restored = await decodeNative(await encodeNative(p));
  expect(restored.instructionPlans.generated).toEqual(plan);
  expect(restored.models).toEqual(project.models);
  expect(restored.library).toEqual(project.library);
  expect(inventory(restored)).toEqual(inventory(project));
  expect(exportLDraw(restored)).toBe(originalSource);
  expect(
    insertionChecksCurrent(restored, restored.instructionPlans.generated),
  ).toBe(true);
  const prepared = prepareInstructionPlan(restored, "generated");
  expect(prepared.steps.length).toBeLessThanOrEqual(200);
  expect(prepared.coverage).toEqual({
    intended: 230,
    introduced: 230,
    complete: true,
  });
  expect(prepared.inventory.reduce((sum, lot) => sum + lot.quantity, 0)).toBe(
    230,
  );
  expect(prepared.assemblyValidated).toBe(false);
  expect(prepared.generation?.sourceGuidance).toBe("hierarchy-and-step-prior");
  expect(prepared.modules).toEqual(plan.modules);
  const join = prepared.steps[jawJoin()];
  expect(join.addedIds).toEqual([]);
  expect(join.incomingIds).toHaveLength(15);
  expect(join.alternateDetailIds).toHaveLength(1);
  expect(join.completedDetail?.occurrenceIds).toHaveLength(2);
  expect(join.contextCamera).toEqual(
    plan.stepMetadata![jawJoin()].contextCamera,
  );
});

it("opts out of authored source guidance without changing source or dropping the 149 unadmitted leaves", () => {
  expect(baseline.generation?.sourceGuidance).toBeUndefined();
  expect(baseline.generation?.sourceCandidates).toBeUndefined();
  expect(
    Object.values(baseline.modules ?? {}).some((m) => m.purpose === "source"),
  ).toBe(false);
  expect(new Set(baseline.steps.flat())).toEqual(new Set(plan.steps.flat()));
  const owned = new Set(sourceModules().parent[1].occurrenceIds);
  const outside = (p: InstructionPlan) =>
    p.steps.flat().filter((id) => !owned.has(id));
  expect(outside(plan)).toHaveLength(149);
  expect(outside(plan)).toEqual(outside(baseline));
  expect(JSON.stringify(project)).toBe(originalDocument);
  expect(exportLDraw(project)).toBe(originalSource);
});

it("generates the same structural memberships after renaming the project, authored sections and node paths", () => {
  const renamed = structuredClone(project),
    names = new Map(
      Object.values(renamed.models)
        .filter((model) => model.classification === "model")
        .map((model, index) => [model.id, `opaque-section-${index}.ldr`]),
    );
  renamed.id = "unrelated-project";
  renamed.rootModelId = names.get(renamed.rootModelId)!;
  for (const model of Object.values(renamed.models)) {
    const replacement = names.get(model.id);
    if (replacement) {
      delete renamed.models[model.id];
      model.id = replacement;
      model.name = "Unnamed source section";
      renamed.models[model.id] = model;
    }
    for (const node of model.nodes) {
      const previous = node.id;
      node.id = "opaque-" + previous;
      node.ref = names.get(node.ref) ?? node.ref;
      for (const record of model.records)
        if (record.nodeId === previous) record.nodeId = node.id;
    }
  }
  const before = JSON.stringify(renamed),
    regenerated = generateInstructions(renamed).plan,
    modules = Object.values(regenerated.modules ?? {});
  expect(regenerated.generation?.sourceGuidance).toBe(
    "hierarchy-and-step-prior",
  );
  expect(
    modules.map((module) => module.occurrenceIds.length).sort((a, b) => a - b),
  ).toEqual([15, 81]);
  expect(modules.every((module) => module.purpose === "source")).toBe(true);
  expect(new Set(regenerated.steps.flat())).toEqual(
    new Set(occurrences(renamed).map((o) => o.id)),
  );
  expect(
    inventory(renamed).map(({ namespace, ref, colorCode, transform }) => ({
      namespace,
      ref,
      colorCode,
      transform,
    })),
  ).toEqual(
    inventory(project).map(({ namespace, ref, colorCode, transform }) => ({
      namespace,
      ref,
      colorCode,
      transform,
    })),
  );
  expect(JSON.stringify(renamed)).toBe(before);
});

it("accepts only a boolean source-step option at both schema and generator boundaries", () => {
  const command = (value: unknown): Command => ({
    schemaVersion: 1,
    commandId: "source-guidance-option",
    expectedRevision: project.revision,
    type: "instructions.generate",
    payload: { useSourceSteps: value },
  });
  for (const valid of [true, false])
    expect(() => validate("command", command(valid))).not.toThrow();
  const editor = new Editor(structuredClone(project));
  for (const invalid of ["false", 0, null, {}]) {
    expect(() => validate("command", command(invalid))).toThrow(
      /Invalid command/,
    );
    expect(() => editor.dispatch(command(invalid))).toThrow(/Invalid command/);
    expect(() =>
      generateInstructions(project, {
        useSourceSteps: invalid as boolean,
      }),
    ).toThrow(/must be a boolean/);
  }
  expect(editor.project.instructionPlans).toEqual(project.instructionPlans);
  expect(editor.canUndo).toBe(false);
});

it("restores a fresh worker's pinned source closure, generates identically and installs an undoable programme", async () => {
  const p = structuredClone(project);
  p.assets.unrelated = "not transferred";
  p.instructionPlans.old = { name: "Existing", steps: [] };
  const data = structuredClone(instructionWorkerData(p)),
    customRef = "31088 - 15456.dat",
    expectedBounds = getLocalInstructionBounds(project, customRef);
  expect(data.project.assets).toEqual({});
  expect(data.project.instructionPlans).toEqual({});
  expect(data.project.models).toEqual(project.models);
  expect(data.sources.has(customRef)).toBe(false);
  for (const primitive of ["4-4cyli.dat", "8-8sphe.dat", "stug-2x2.dat"])
    expect(data.sources.has(primitive)).toBe(true);
  expect(expectedBounds.diagnostic).toBeNull();
  expect(expectedBounds.stats.triangles).toBe(648);
  vi.resetModules();
  const freshGeometry = await import("../../src/instructions/source-geometry"),
    worker = await import("../../src/instructions/worker-data"),
    freshGenerator = await import("../../src/instructions/generate");
  // A worker starts without the parent's registered source strings. Requiring
  // missing before transfer prevents this test passing through a shared cache.
  expect(
    freshGeometry.getLocalInstructionBounds(data.project, customRef).bounds,
  ).toBeNull();
  worker.restoreInstructionWorkerData(data);
  expect(
    freshGeometry.getLocalInstructionBounds(data.project, customRef),
  ).toEqual(expectedBounds);
  const generated = freshGenerator.generateInstructions(data.project).plan;
  expect(generated).toEqual(plan);
  const editor = new Editor(p),
    installed = editor.dispatch({
      schemaVersion: 1,
      commandId: "install-source-programme",
      expectedRevision: editor.revision,
      type: "instructions.installGenerated",
      payload: { plan: generated },
    });
  expect(installed.addedPlanIds).toHaveLength(1);
  expect(editor.project.instructionPlans[installed.addedPlanIds![0]]).toEqual(
    plan,
  );
  expect(editor.project.instructionPlans.old).toEqual(p.instructionPlans.old);
  expect(inventory(editor.project)).toEqual(inventory(project));
  expect(exportLDraw(editor.project)).toBe(originalSource);
  editor.dispatch({
    schemaVersion: 1,
    commandId: "undo-source-programme",
    expectedRevision: editor.revision,
    type: "history.undo",
    payload: {},
  });
  expect(editor.project.instructionPlans).toEqual(p.instructionPlans);
  editor.dispatch({
    schemaVersion: 1,
    commandId: "redo-source-programme",
    expectedRevision: editor.revision,
    type: "history.redo",
    payload: {},
  });
  expect(editor.project.instructionPlans[installed.addedPlanIds![0]]).toEqual(
    plan,
  );
});
