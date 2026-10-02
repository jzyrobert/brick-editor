import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import {
  generateInstructions,
  type InstructionPlanningEvidence,
} from "../../src/instructions/generate";
import { insertionFingerprint } from "../../src/instructions/collision";
import { effectiveInsertionChecks } from "../../src/instructions/motion";
import { encodeNative, decodeNative } from "../../src/persistence/native";
import { registerInstructionGeometryFromDisk } from "../../scripts/instruction-geometry-node";
import {
  registerFullLibraryFromDisk,
  registerFullCatalogFromDisk,
} from "../../scripts/full-library-node";
import {
  applyWorkbenchProposal,
  sourceModelHash,
  workbenchAliases,
  type WorkbenchProposal,
} from "../../scripts/instruction-workbench";
import {
  createHybridSnapshot,
  applyHybridProposal,
} from "../../scripts/instruction-hybrid";
import type { InstructionPlan } from "../../src/core/types";

const line = (x = 0) => `1 4 ${x} 0 0 1 0 0 0 1 0 0 0 1 3001.dat`;
registerFullLibraryFromDisk();
registerFullCatalogFromDisk();

it.each([
  "fixtures/ldraw/templates/roadster.mpd",
  "fixtures/instructions/omr/6450-1.mpd",
])(
  "accepts an unchanged proposal from the actual latest deterministic %s baseline",
  (path) => {
    const project = importLDraw(readFileSync(path, "utf8")),
      before = exportLDraw(project);
    registerInstructionGeometryFromDisk(project);
    let evidence: InstructionPlanningEvidence | undefined;
    const { plan } = generateInstructions(project, {}, (value) => {
      evidence = value;
    });
    const snapshot = createHybridSnapshot(
        project,
        plan,
        evidence!,
        "fixture-source",
      ),
      result = applyHybridProposal(
        project,
        snapshot,
        structuredClone(snapshot.proposal),
        snapshot.baseline.baselineHash,
      );
    expect(result.plan.modules).toEqual(plan.modules);
    expect(result.plan.steps).toEqual(plan.steps);
    expect(result.delta.changedOperations).toHaveLength(0);
    expect(
      result.delta.metadataChanges.every((change) => change.retainedMetadata),
    ).toBe(true);
    expect(exportLDraw(result.project)).toBe(before);
    expect(result.hybridAudit.protectedProcedureKeys.length).toBeGreaterThan(0);
  },
);
function generated() {
  const project = importLDraw([0, 400, 800].map(line).join("\n"));
  registerInstructionGeometryFromDisk(project);
  let evidence: InstructionPlanningEvidence | undefined;
  const { plan } = generateInstructions(project, { maxPerStep: 1 }, (value) => {
    evidence = value;
  });
  return {
    project,
    snapshot: createHybridSnapshot(project, plan, evidence!, "input-hash"),
  };
}
it("protects actual flat Truck control/figure semantics while allowing receiving-camera repairs", () => {
  const project = importLDraw(
    readFileSync("fixtures/instructions/omr/6450-1.mpd", "utf8"),
  );
  registerInstructionGeometryFromDisk(project);
  let evidence: InstructionPlanningEvidence | undefined;
  const { plan } = generateInstructions(project, {}, (value) => {
    evidence = value;
  });
  const snapshot = createHybridSnapshot(
      project,
      plan,
      evidence!,
      "truck-source",
    ),
    scan = snapshot.baseline.reviewedProcedureScan!,
    control = scan.matched.find((entry) => entry.role === "control-stick")!;
  expect(control).toBeDefined();
  expect(scan.matched.some((entry) => entry.role === "hand")).toBe(true);
  const index = snapshot.baseline.operationKeys.indexOf(control.key),
    input = structuredClone(snapshot.proposal),
    old = plan.stepMetadata![index];
  input.operations[index].notes +=
    " Check the slot in this close view before proceeding.";
  input.operations[index].receivingCamera = structuredClone(
    old.alternateCamera!,
  );
  input.operations[index].receivingCamera!.span =
    (old.alternateCamera!.span ?? 100) + 10;
  const result = applyHybridProposal(
      project,
      snapshot,
      input,
      snapshot.baseline.baselineHash,
    ),
    meta = result.plan.stepMetadata![index];
  expect(meta.alternateDetailIds).toEqual(old.alternateDetailIds);
  expect(meta.axisReference).toEqual(old.axisReference);
  expect(meta.targets?.filter((target) => target.label !== "B1")).toEqual(
    old.targets?.filter((target) => target.label !== "B1"),
  );
  expect(meta.alternateCamera).toEqual(input.operations[index].receivingCamera);
  expect(
    meta.insertionChecks?.every((check) => check.status === "unknown"),
  ).toBe(true);
  expect(
    result.hybridAudit.reviewedProcedures.some(
      (entry) => entry.key === control.key,
    ),
  ).toBe(true);
  const unsafe = structuredClone(input);
  unsafe.operations[index].notes = unsafe.operations[index].notes!.replace(
    "Keep a supplied complete lever assembled;",
    "",
  );
  expect(() =>
    applyHybridProposal(
      project,
      snapshot,
      unsafe,
      snapshot.baseline.baselineHash,
    ),
  ).toThrow(/specific supplied-assembly/);
  // A source association whose procedure was not adopted must not be promoted
  // into a reviewed role merely because its parts are present.
  const plain = structuredClone(plan);
  plain.stepMetadata![index].notes =
    "Generic caption unrelated to this source procedure.";
  const unadopted = createHybridSnapshot(
    project,
    plain,
    evidence!,
    "truck-source",
  );
  expect(
    unadopted.baseline.reviewedProcedureScan!.matched.some(
      (entry) => entry.key === control.key && entry.role === control.role,
    ),
  ).toBe(false);
  expect(
    unadopted.baseline.reviewedProcedureScan!.unmatched.some(
      (entry) => entry.incomingId === control.incomingId,
    ),
  ).toBe(true);
  const wrongLock = structuredClone(project);
  wrongLock.library.full!.manifestSha256 = "unreviewed-library";
  expect(
    createHybridSnapshot(wrongLock, plan, evidence!, "truck-source").baseline
      .reviewedProcedureScan!.matched,
  ).toHaveLength(0);
});
function nested() {
  const project = importLDraw([0, 400, 800].map(line).join("\n")),
    aliases = workbenchAliases(project);
  const proposal: WorkbenchProposal = {
    sourceHash: "input-hash",
    modules: [
      { id: "parent", name: "Parent", members: ["p0001", "p0002"] },
      {
        id: "child",
        name: "Child",
        members: ["p0002"],
        parentId: "parent",
        receivers: ["p0001"],
      },
    ],
    operations: [
      { key: "root", additions: ["p0003"] },
      { key: "parent", additions: ["p0001"], workbench: "parent" },
      {
        key: "child",
        additions: ["p0002"],
        workbench: "child",
        notes: "Hold separately; physical fit unverified.",
      },
      { key: "child-place", additions: [], place: "child" },
      { key: "parent-place", additions: [], place: "parent" },
    ],
  };
  const plan = applyWorkbenchProposal(
    project,
    proposal,
    aliases,
    "input-hash",
  ).plan;
  plan.generation = {
    algorithm: "connected-bottom-up-v16",
    sourceRevision: project.revision,
    maxPerStep: 1,
    total: 3,
    connectorCovered: 0,
    boundsUnknown: 0,
    inferredSupportPairs: 0,
    unanchored: 0,
    lowVisibilitySteps: 0,
    warnings: [],
    insertionFingerprint: insertionFingerprint(project, plan),
  };
  const ids = Object.values(aliases),
    evidence: InstructionPlanningEvidence = {
      units: ids.map((id, index) => ({
        index,
        ids: [id],
        supports: index === 1 ? [0] : [],
        hosts: [],
        access: [],
        adjacent: [],
        wholeDrawing: false,
      })),
      connectorCovered: [],
    };
  return {
    project,
    snapshot: createHybridSnapshot(project, plan, evidence, "input-hash"),
  };
}

it("refines the actual pinned deterministic draft without changing source, retaining context-identical metadata and truthful native provenance", async () => {
  const { project, snapshot } = generated(),
    input = structuredClone(snapshot.proposal),
    before = exportLDraw(project);
  input.operations[0].notes =
    (input.operations[0].notes ?? "") + " Check the pictured colour.";
  const result = applyHybridProposal(
    project,
    snapshot,
    input,
    snapshot.baseline.baselineHash,
  );
  expect(exportLDraw(result.project)).toBe(before);
  expect(sourceModelHash(result.project)).toBe(sourceModelHash(project));
  expect(result.plan.generation).toBeUndefined();
  expect(result.plan.refinement?.baselinePlanHash).toBe(
    snapshot.baseline.planHash,
  );
  expect(result.plan.refinement?.retainedInsertionChecks).toBeGreaterThan(0);
  expect(result.delta.changedOperations.map((op) => op.key)).toEqual([
    input.operations[0].key,
  ]);
  expect(result.delta.metadataChanges.every((op) => op.retainedMetadata)).toBe(
    true,
  );
  expect(result.plan.stepMetadata![1]).toEqual(snapshot.plan.stepMetadata![1]);
  const restored = await decodeNative(await encodeNative(result.project));
  expect(restored.instructionPlans.agent.refinement).toEqual(
    result.plan.refinement,
  );
  expect(
    effectiveInsertionChecks(
      restored,
      restored.instructionPlans.agent,
      restored.instructionPlans.agent.stepMetadata![0],
    ),
  ).toEqual(snapshot.plan.stepMetadata![0].insertionChecks);
});

it("invalidates camera-altered CAD and removes stale blocker markers without discarding unaffected checks", () => {
  const { project, snapshot } = generated(),
    input = structuredClone(snapshot.proposal);
  input.operations[0].camera!.span =
    (input.operations[0].camera!.span ?? 100) + 10;
  const result = applyHybridProposal(
    project,
    snapshot,
    input,
    snapshot.baseline.baselineHash,
  );
  expect(
    result.plan.stepMetadata![0].insertionChecks?.every(
      (check) => check.status === "unknown",
    ),
  ).toBe(true);
  expect(result.delta.metadataChanges[0].retainedMetadata).toBe(false);
  expect(result.delta.metadataChanges[1].retainedMetadata).toBe(true);
  expect(result.hybridAudit.unknownInsertionChecks).toBe(1);
});

it("rejects changed source, baseline hash and mutated baseline proposal/evidence", () => {
  const { project, snapshot } = generated();
  expect(() =>
    applyHybridProposal(project, snapshot, snapshot.proposal, "wrong"),
  ).toThrow(/baseline hash/);
  const edited = structuredClone(snapshot);
  edited.baseline.evidence.units[0].supports.push(1);
  expect(() =>
    applyHybridProposal(
      project,
      edited,
      snapshot.proposal,
      edited.baseline.baselineHash,
    ),
  ).toThrow(/baseline hash/);
  const changed = structuredClone(project);
  changed.models[changed.rootModelId].nodes[0].transform.position[0] += 1;
  expect(() =>
    applyHybridProposal(
      changed,
      snapshot,
      snapshot.proposal,
      snapshot.baseline.baselineHash,
    ),
  ).toThrow(/source project changed/);
});

it("enforces hard support/access precedence and forbids hiding required leaves in the same addition batch", () => {
  const { project, snapshot } = generated(),
    ids = Object.values(snapshot.aliases),
    evidence = structuredClone(snapshot.baseline.evidence);
  evidence.units[1].supports = [0];
  evidence.units[2].access = [1];
  const pin = createHybridSnapshot(
      project,
      snapshot.plan,
      evidence,
      "input-hash",
    ),
    reversed = structuredClone(pin.proposal);
  reversed.operations.reverse();
  expect(() =>
    applyHybridProposal(project, pin, reversed, pin.baseline.baselineHash),
  ).toThrow(/hard .* prerequisite/);
  const grouped = structuredClone(pin.proposal);
  grouped.operations[0].additions = [
    Object.keys(pin.aliases)[ids.indexOf(ids[0])],
    Object.keys(pin.aliases)[ids.indexOf(ids[1])],
  ];
  grouped.operations.splice(1, 1);
  expect(() =>
    applyHybridProposal(project, pin, grouped, pin.baseline.baselineHash),
  ).toThrow(/no same-step exception/);
});

it("allows an acknowledged ancestor receiver during held child building, but a root consumer waits for the whole parent join", () => {
  const { project, snapshot } = nested();
  const result = applyHybridProposal(
    project,
    snapshot,
    snapshot.proposal,
    snapshot.baseline.baselineHash,
  );
  expect(result.hybridAudit.ancestorRequirements).toContainEqual(
    expect.objectContaining({ kind: "supports", ancestor: "parent" }),
  );
  const evidence = structuredClone(snapshot.baseline.evidence);
  evidence.units[2].hosts = [1];
  // Baseline also needs the host assembled: its unresolved exception is refused,
  // rather than erased to make the agent's proposal pass.
  const invalidBaseline = createHybridSnapshot(
    project,
    snapshot.plan,
    evidence,
    "input-hash",
  );
  expect(() =>
    applyHybridProposal(
      project,
      invalidBaseline,
      invalidBaseline.proposal,
      invalidBaseline.baseline.baselineHash,
    ),
  ).toThrow(/hard hosts/);
});

it("does not treat a completed sibling workbench as joined availability", () => {
  const { project, snapshot } = generated(),
    aliases = snapshot.aliases,
    proposal: WorkbenchProposal = {
      sourceHash: "input-hash",
      modules: [
        { id: "a", name: "A", members: ["p0001"] },
        { id: "b", name: "B", members: ["p0002"] },
      ],
      operations: [
        { key: "a", additions: ["p0001"], workbench: "a" },
        { key: "a-place", additions: [], place: "a" },
        { key: "b", additions: ["p0002"], workbench: "b" },
        { key: "b-place", additions: [], place: "b" },
        { key: "root", additions: ["p0003"] },
      ],
    };
  const plan = applyWorkbenchProposal(
    project,
    proposal,
    aliases,
    "input-hash",
  ).plan;
  plan.generation = structuredClone(snapshot.plan.generation!);
  plan.generation.insertionFingerprint = insertionFingerprint(project, plan);
  const evidence = structuredClone(snapshot.baseline.evidence);
  evidence.units[1].supports = [0];
  const pin = createHybridSnapshot(project, plan, evidence, "input-hash"),
    input = structuredClone(pin.proposal);
  [input.operations[1], input.operations[2]] = [
    input.operations[2],
    input.operations[1],
  ];
  expect(() =>
    applyHybridProposal(project, pin, input, pin.baseline.baselineHash),
  ).toThrow(/unavailable supports/);
});

it("keeps reviewed wheel membership, receiver and procedural action lineage locked", () => {
  const { project, snapshot } = nested();
  const plan: InstructionPlan = structuredClone(snapshot.plan);
  plan.modules!.child.purpose = "wheel";
  const pin = createHybridSnapshot(
      project,
      plan,
      snapshot.baseline.evidence,
      "input-hash",
    ),
    input = structuredClone(pin.proposal);
  input.modules!.find((module) => module.id === "child")!.receivers = [];
  expect(() =>
    applyHybridProposal(project, pin, input, pin.baseline.baselineHash),
  ).toThrow(/Protected wheel module/);
  const notes = structuredClone(pin.proposal);
  notes.operations.find((op) => op.workbench === "child")!.notes = "Push hard.";
  expect(() =>
    applyHybridProposal(project, pin, notes, pin.baseline.baselineHash),
  ).toThrow(/baseline handling\/fit instructions/);
});

it("records a genuine independent reorder as a baseline delta and restores checks only after contexts converge", () => {
  const { project, snapshot } = generated(),
    input = structuredClone(snapshot.proposal);
  [input.operations[0], input.operations[1]] = [
    input.operations[1],
    input.operations[0],
  ];
  const result = applyHybridProposal(
    project,
    snapshot,
    input,
    snapshot.baseline.baselineHash,
  );
  expect(result.delta.changedOperations).toHaveLength(2);
  expect(result.delta.metadataChanges.map((op) => op.retainedMetadata)).toEqual(
    [false, false, true],
  );
  expect(result.hybridAudit.unknownInsertionChecks).toBe(2);
});
