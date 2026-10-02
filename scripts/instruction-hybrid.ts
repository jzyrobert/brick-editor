/** Offline refinement of a pinned deterministic instruction programme. */
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyWorkbenchProposal,
  compactProposal,
  formatWorkbenchError,
  prepareWorkbench,
  reviewWorkbench,
  sourceModelHash,
  workbenchAliases,
  workbenchReviewSelection,
  type Aliases,
  type WorkbenchProposal,
} from "./instruction-workbench";
import {
  registerFullLibraryFromDisk,
  registerFullCatalogFromDisk,
} from "./full-library-node";
import { registerInstructionGeometryFromDisk } from "./instruction-geometry-node";
import { decodeNative, encodeNative } from "../src/persistence/native";
import {
  generateInstructions,
  type InstructionPlanningEvidence,
} from "../src/instructions/generate";
import {
  instructionDisplayStates,
  validateInstructionProgramme,
} from "../src/instructions/programme";
import { insertionFingerprint } from "../src/instructions/collision";
import { insertionChecksCurrent } from "../src/instructions/motion";
import { displayProfiles } from "../src/instructions/display-procedures";
import { mechanismProfiles } from "../src/instructions/mechanism-procedures";
import { interfaceProfiles } from "../src/instructions/interface-procedures";
import { decorationProfiles } from "../src/instructions/decoration-procedures";
import { figureProfiles } from "../src/instructions/figures";
import { occurrences, validateDocument } from "../src/core/document";
import { validate } from "../src/core/validate";
import {
  ensure,
  type Project,
  type InstructionPlan,
  type InstructionStepMetadata,
} from "../src/core/types";

const hash = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
const encoded = (value: unknown) => JSON.stringify(value);
const comparable = (value: unknown) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
        )
      : item,
  );
const same = (a: unknown, b: unknown) => comparable(a) === comparable(b);
const sorted = (ids: string[]) => [...ids].sort();
const writeJson = (path: string, value: unknown) =>
  writeFile(path, JSON.stringify(value, null, 2) + "\n");
const ROOT = "@scene";
type ReviewedProcedure = {
  key: string;
  reader: string;
  role: string;
  incomingId: string;
  hostIds: string[];
  notes: string;
};
type ProcedureScan = {
  matched: ReviewedProcedure[];
  unmatched: { incomingId: string; reader: string; role: string }[];
  exhausted: boolean;
};
function reviewedProcedures(
  project: Project,
  plan: InstructionPlan,
  operationKeys: string[],
): ProcedureScan {
  const all = occurrences(project);
  ensure(
    all.length <= 5000,
    "LIMIT_EXCEEDED",
    "Hybrid profile scanning supports at most 5,000 source leaves.",
  );
  const readers = [
    ["display", displayProfiles(project, all, 200000)],
    ["mechanism", mechanismProfiles(project, all, 200000)],
    ["interface", interfaceProfiles(project, all, 200000)],
    ["decoration", decorationProfiles(project, all, 200000)],
    ["figure", { ...figureProfiles(project, all), exhausted: false }],
  ] as const;
  const intro = new Map(
      plan.steps.flatMap((ids, i) => ids.map((id) => [id, i] as const)),
    ),
    matched: ReviewedProcedure[] = [],
    unmatched: ProcedureScan["unmatched"] = [];
  for (const [reader, result] of readers)
    for (const group of result.groups)
      for (const [incomingId, procedure] of group.operations) {
        const index = intro.get(incomingId),
          notes =
            index === undefined ? undefined : plan.stepMetadata?.[index]?.notes;
        // Exact curated text identifies an actually adopted procedure, not an
        // ignored/conflicting source association or an arbitrary caption regex.
        if (index !== undefined && notes?.includes(procedure.notes))
          matched.push({
            key: operationKeys[index],
            reader,
            role: procedure.role,
            incomingId,
            hostIds: [...procedure.hostIds],
            notes: procedure.notes,
          });
        else unmatched.push({ incomingId, reader, role: procedure.role });
      }
  return {
    matched,
    unmatched,
    exhausted: readers.some(([, result]) => result.exhausted),
  };
}
export type HybridBaseline = {
  schemaVersion: 1;
  baselineHash: string;
  sourceHash: string;
  sourceModelHash: string;
  nativeHash?: string;
  planHash: string;
  proposalHash: string;
  aliasesHash: string;
  algorithm: string;
  operationKeys: string[];
  evidence: InstructionPlanningEvidence;
  toolHashes: Record<string, string>;
  /** Optional only for compatibility with the first pinned hybrid snapshots. */
  reviewedProcedureScan?: ProcedureScan;
};
export type HybridSnapshot = {
  baseline: HybridBaseline;
  plan: InstructionPlan;
  proposal: WorkbenchProposal;
  aliases: Aliases;
};
const baselineHash = (baseline: Omit<HybridBaseline, "baselineHash">) =>
  hash(encoded(baseline));

/** Stable keys describe baseline actions; preserve them when refining an action. */
export function createHybridSnapshot(
  project: Project,
  plan: InstructionPlan,
  evidence: InstructionPlanningEvidence,
  sourceHash: string,
  metadata: { nativeHash?: string; toolHashes?: Record<string, string> } = {},
): HybridSnapshot {
  ensure(
    plan.generation,
    "INVALID_INPUT",
    "Hybrid preparation requires a deterministic generated baseline.",
  );
  const aliases = workbenchAliases(project),
    reverse = new Map(
      Object.entries(aliases).map(([alias, id]) => [id, alias]),
    ),
    proposal = compactProposal(project, plan, sourceHash, aliases),
    states = instructionDisplayStates(plan);
  for (const [i, operation] of proposal.operations.entries()) {
    const meta = plan.stepMetadata?.[i];
    if (meta?.camera) operation.camera = structuredClone(meta.camera);
    if (operation.place && meta?.incomingCamera)
      operation.incomingCamera = structuredClone(meta.incomingCamera);
    if (meta?.alternateBeforePlacement && meta.alternateCamera) {
      const prior = new Set(
          states[i].displayIds.filter(
            (id) => !states[i].highlightIds.includes(id),
          ),
        ),
        candidates = meta.alternateDetailIds ?? [
          ...new Set(
            (meta.targets ?? []).flatMap((target) =>
              target.occurrenceId &&
              /^[RP]\d*$/.test(target.label) &&
              prior.has(target.occurrenceId)
                ? [target.occurrenceId]
                : [],
            ),
          ),
        ];
      if (candidates.length && candidates.every((id) => prior.has(id))) {
        operation.receiving = candidates.map((id) => reverse.get(id)!);
        operation.receivingCamera = structuredClone(meta.alternateCamera);
      }
    }
  }
  const payload: Omit<HybridBaseline, "baselineHash"> = {
    schemaVersion: 1,
    sourceHash,
    sourceModelHash: sourceModelHash(project),
    ...(metadata.nativeHash ? { nativeHash: metadata.nativeHash } : {}),
    planHash: hash(encoded(plan)),
    proposalHash: hash(encoded(proposal)),
    aliasesHash: hash(encoded(aliases)),
    algorithm: plan.generation.algorithm,
    operationKeys: proposal.operations.map((op) => op.key),
    evidence: structuredClone(evidence),
    toolHashes: metadata.toolHashes ?? {},
    reviewedProcedureScan: reviewedProcedures(
      project,
      plan,
      proposal.operations.map((op) => op.key),
    ),
  };
  return {
    baseline: { ...payload, baselineHash: baselineHash(payload) },
    plan: structuredClone(plan),
    proposal,
    aliases,
  };
}

function verifySnapshot(
  project: Project,
  snapshot: HybridSnapshot,
  expected: string,
) {
  const { baseline, plan, proposal, aliases } = snapshot,
    { baselineHash: pin, ...payload } = baseline;
  ensure(
    baseline.schemaVersion === 1 &&
      pin === expected &&
      pin === baselineHash(payload),
    "INVALID_INPUT",
    "Hybrid baseline hash does not match the pinned snapshot.",
  );
  ensure(
    sourceModelHash(project) === baseline.sourceModelHash,
    "INVALID_INPUT",
    "Hybrid source project changed.",
  );
  ensure(
    hash(encoded(plan)) === baseline.planHash &&
      hash(encoded(proposal)) === baseline.proposalHash &&
      hash(encoded(aliases)) === baseline.aliasesHash,
    "INVALID_INPUT",
    "Hybrid baseline plan, proposal or aliases changed.",
  );
  ensure(
    plan.generation?.algorithm === baseline.algorithm &&
      same(
        proposal.operations.map((op) => op.key),
        baseline.operationKeys,
      ),
    "INVALID_INPUT",
    "Hybrid baseline algorithm or operation keys changed.",
  );
}

type Availability = {
  key: string;
  kind: "supports" | "hosts" | "access";
  consumer: string[];
  required: string[];
  ancestor: string;
};
/** Replay actual workbench locations, rather than treating introduction as placement. */
function planningAvailability(
  plan: InstructionPlan,
  keys: string[],
  evidence: InstructionPlanningEvidence,
  realIds: Set<string>,
) {
  validateInstructionProgramme(plan);
  const units = new Map(evidence.units.map((unit) => [unit.index, unit]));
  ensure(
    units.size === evidence.units.length && units.size <= 5000,
    "INVALID_INPUT",
    "Invalid planning-unit evidence.",
  );
  const unitOf = new Map<string, number>(),
    introductions = new Map<string, number>();
  for (const [i, ids] of plan.steps.entries())
    for (const id of ids) introductions.set(id, i);
  for (const unit of units.values()) {
    ensure(
      Number.isSafeInteger(unit.index) && unit.ids.length > 0,
      "INVALID_INPUT",
      "Invalid planning unit.",
    );
    for (const id of unit.ids) {
      ensure(
        realIds.has(id) && !unitOf.has(id),
        "INVALID_INPUT",
        "Planning evidence duplicates or invents a source leaf.",
      );
      unitOf.set(id, unit.index);
    }
    ensure(
      new Set(unit.ids.map((id) => introductions.get(id))).size === 1,
      "INVALID_INPUT",
      "A whole planning/drawing unit was split across operations.",
    );
  }
  ensure(
    unitOf.size === realIds.size,
    "INVALID_INPUT",
    "Planning evidence does not cover the source leaves.",
  );
  let edges = 0;
  for (const unit of units.values())
    for (const kind of ["supports", "hosts", "access"] as const)
      for (const index of unit[kind]) {
        ensure(
          units.has(index),
          "INVALID_INPUT",
          "A planning prerequisite refers to an unknown unit.",
        );
        ensure(
          ++edges <= 200000,
          "LIMIT_EXCEEDED",
          "Hybrid planning prerequisites exceed their budget.",
        );
      }
  const locations = new Map<string, Set<string>>([[ROOT, new Set()]]);
  for (const id of Object.keys(plan.modules ?? {}))
    locations.set(id, new Set());
  const contextHashes: string[] = [],
    external: Availability[] = [];
  for (let i = 0; i < plan.steps.length; i++) {
    const action = plan.stepMetadata?.[i]?.assembly,
      module = action ? plan.modules![action.moduleId] : undefined,
      destination =
        action?.type === "build"
          ? action.moduleId
          : (module?.parentModuleId ?? ROOT),
      ancestors = [destination];
    while (ancestors.at(-1) !== ROOT)
      ancestors.push(plan.modules![ancestors.at(-1)!].parentModuleId ?? ROOT);
    contextHashes.push(
      hash(
        encoded(
          ancestors.map((key) => [key, sorted([...locations.get(key)!])]),
        ),
      ),
    );
    const consumers = new Set(plan.steps[i].map((id) => unitOf.get(id)!));
    for (const index of consumers) {
      const consumer = units.get(index)!;
      for (const kind of ["supports", "hosts", "access"] as const)
        for (const requiredIndex of consumer[kind]) {
          if (requiredIndex === index) continue;
          const required = units.get(requiredIndex)!;
          ensure(
            required.ids.every((id) => introductions.get(id)! < i),
            "INVALID_INPUT",
            `Hybrid ${keys[i]} violates a hard ${kind} prerequisite: required leaves must precede this operation (no same-step exception).`,
          );
          const available = ancestors.find((key) =>
            required.ids.every((id) => locations.get(key)!.has(id)),
          );
          ensure(
            available,
            "INVALID_INPUT",
            `Hybrid ${keys[i]} has an unavailable ${kind} prerequisite: a separately built sibling/foreign object must join its actual destination first.`,
          );
          if (available !== destination)
            external.push({
              key: keys[i],
              kind,
              consumer: [...consumer.ids],
              required: [...required.ids],
              ancestor: available,
            });
        }
    }
    for (const id of plan.steps[i]) locations.get(destination)!.add(id);
    if (action?.type === "join") {
      for (const id of module!.occurrenceIds) {
        locations.get(action.moduleId)!.delete(id);
        locations.get(destination)!.add(id);
      }
    }
  }
  return { contextHashes, external, hardEdges: edges };
}

function protectProcedures(
  snapshot: HybridSnapshot,
  proposal: WorkbenchProposal,
  plan: InstructionPlan,
) {
  const operations = new Map(
      proposal.operations.map((op, i) => [op.key, { op, i }]),
    ),
    protectedKeys = new Set<string>();
  for (const [id, module] of Object.entries(snapshot.plan.modules ?? {})) {
    const typed = module.purpose === "wheel" || module.purpose === "joint",
      hosted = !!module.hostIds?.length;
    if (!typed && !hosted) continue;
    const next = plan.modules?.[id];
    ensure(
      next,
      "INVALID_INPUT",
      `Protected module ${id} was removed or renamed.`,
    );
    if (typed)
      ensure(
        same(module, next),
        "INVALID_INPUT",
        `Protected ${module.purpose} module ${id} changed its geometry, members, parent, hosts or receiver.`,
      );
    else {
      ensure(
        module.occurrenceIds.every((leaf) => next.occurrenceIds.includes(leaf)),
        "INVALID_INPUT",
        `Source attachment ${id} lost members of its complete prepared incoming assembly.`,
      );
      ensure(
        same(module.hostIds, next.hostIds) &&
          same(module.receiver, next.receiver) &&
          (module.placement ?? "attachment") ===
            (next.placement ?? "attachment"),
        "INVALID_INPUT",
        `Source attachment ${id} lost its real receiving candidates or receiving feature.`,
      );
    }
    let previous = -1;
    for (const [i, old] of snapshot.proposal.operations.entries()) {
      const meta = snapshot.plan.stepMetadata?.[i];
      if (
        meta?.assembly?.moduleId !== id ||
        (!typed && meta.assembly.type !== "join")
      )
        continue;
      const current = operations.get(old.key);
      ensure(
        current &&
          current.i > previous &&
          same(old.additions, current.op.additions) &&
          old.workbench === current.op.workbench &&
          old.place === current.op.place,
        "INVALID_INPUT",
        `Protected procedure ${old.key} was removed, regrouped or reordered inside ${id}.`,
      );
      previous = current.i;
      ensure(
        !old.notes || (current.op.notes ?? "").startsWith(old.notes),
        "INVALID_INPUT",
        `Protected procedure ${old.key} must retain its baseline handling/fit instructions; append clarifications instead.`,
      );
      if (!typed)
        for (const leaf of meta.completedDetail?.occurrenceIds ?? [])
          if (module.occurrenceIds.includes(leaf))
            ensure(
              next.occurrenceIds.includes(leaf),
              "INVALID_INPUT",
              `Source attachment ${id} lost a reviewed incoming interface leaf.`,
            );
      protectedKeys.add(old.key);
    }
  }
  return protectedKeys;
}

const viewFields = [
  "camera",
  "receivingCamera",
  "incomingCamera",
  "receiving",
] as const;
const narrowFields = [
  "alternateCamera",
  "alternateBeforePlacement",
  "alternateDetailIds",
  "completedDetail",
  "axisReference",
  "targets",
] as const;
/** Pure refinement gate. No renderer, API key, remote model or fresh CAD result. */
export function applyHybridProposal(
  project: Project,
  snapshot: HybridSnapshot,
  proposal: WorkbenchProposal,
  expectedBaselineHash: string,
) {
  verifySnapshot(project, snapshot, expectedBaselineHash);
  const applied = applyWorkbenchProposal(
      project,
      proposal,
      snapshot.aliases,
      snapshot.baseline.sourceHash,
    ),
    plan = applied.plan,
    keys = proposal.operations.map((op) => op.key),
    realIds = new Set(occurrences(project).map((o) => o.id)),
    baselineAvailability = planningAvailability(
      snapshot.plan,
      snapshot.baseline.operationKeys,
      snapshot.baseline.evidence,
      realIds,
    ),
    availability = planningAvailability(
      plan,
      keys,
      snapshot.baseline.evidence,
      realIds,
    ),
    protectedKeys = protectProcedures(snapshot, proposal, plan),
    procedureScan =
      snapshot.baseline.reviewedProcedureScan ??
      reviewedProcedures(
        project,
        snapshot.plan,
        snapshot.baseline.operationKeys,
      ),
    oldStates = instructionDisplayStates(snapshot.plan),
    states = instructionDisplayStates(plan),
    oldIndices = new Map(
      snapshot.baseline.operationKeys.map((key, i) => [key, i]),
    ),
    currentBaselineChecks = insertionChecksCurrent(project, snapshot.plan),
    metadataChanges: {
      key: string;
      retainedMetadata: boolean;
      retainedChecks: number;
      unknownChecks: number;
      changedFields: string[];
    }[] = [];
  let retainedChecks = 0,
    unknownChecks = 0;
  ensure(
    !procedureScan.exhausted,
    "LIMIT_EXCEEDED",
    "Reviewed source-profile scan was incomplete; prepare a bounded baseline instead of claiming protected procedures.",
  );
  const currentOps = new Map(
    proposal.operations.map((op, i) => [op.key, { op, i }]),
  );
  for (const procedure of procedureScan.matched) {
    const current = currentOps.get(procedure.key),
      oldIndex = oldIndices.get(procedure.key)!;
    ensure(
      current &&
        same(plan.steps[current.i], snapshot.plan.steps[oldIndex]) &&
        plan.steps[current.i].includes(procedure.incomingId) &&
        same(
          plan.stepMetadata?.[current.i]?.assembly,
          snapshot.plan.stepMetadata?.[oldIndex]?.assembly,
        ),
      "INVALID_INPUT",
      `Reviewed ${procedure.role} procedure ${procedure.key} lost its incoming source leaf/action.`,
    );
    ensure(
      (current.op.notes ?? "").includes(procedure.notes),
      "INVALID_INPUT",
      `Reviewed ${procedure.role} procedure ${procedure.key} must retain its specific supplied-assembly/receiver/fit instructions; other captions may be rewritten.`,
    );
    const prior = new Set(
      states[current.i].displayIds.filter(
        (id) => !states[current.i].highlightIds.includes(id),
      ),
    );
    ensure(
      procedure.hostIds.every((id) => prior.has(id)),
      "INVALID_INPUT",
      `Reviewed ${procedure.role} procedure ${procedure.key} lost its actual prior displayed receiver.`,
    );
    protectedKeys.add(procedure.key);
  }
  for (const [i, op] of proposal.operations.entries()) {
    const oldIndex = oldIndices.get(op.key),
      oldOp =
        oldIndex === undefined
          ? undefined
          : snapshot.proposal.operations[oldIndex],
      oldMeta =
        oldIndex === undefined
          ? undefined
          : snapshot.plan.stepMetadata?.[oldIndex],
      oldState = oldIndex === undefined ? undefined : oldStates[oldIndex],
      viewUnchanged =
        oldOp && viewFields.every((field) => same(oldOp[field], op[field])),
      contextUnchanged =
        oldIndex !== undefined &&
        baselineAvailability.contextHashes[oldIndex] ===
          availability.contextHashes[i],
      stateUnchanged =
        oldState &&
        same(sorted(oldState.displayIds), sorted(states[i].displayIds)) &&
        same(sorted(oldState.highlightIds), sorted(states[i].highlightIds)) &&
        same(
          sorted(oldState.incomingIds ?? []),
          sorted(states[i].incomingIds ?? []),
        ),
      actionUnchanged =
        oldOp &&
        same(oldOp.additions, op.additions) &&
        oldOp.workbench === op.workbench &&
        oldOp.place === op.place,
      retainMetadata = !!(
        oldMeta &&
        viewUnchanged &&
        contextUnchanged &&
        stateUnchanged &&
        actionUnchanged
      );
    if (retainMetadata) {
      plan.stepMetadata![i] = {
        ...structuredClone(oldMeta!),
        ...(op.notes !== undefined ? { notes: op.notes } : {}),
      };
      if (op.notes === undefined) delete plan.stepMetadata![i].notes;
    } else if (oldMeta && protectedKeys.has(op.key)) {
      // Preserve reviewed finite interface semantics; the agent may alter the
      // framing, but cannot erase the real receiver or completed pair detail.
      const meta = plan.stepMetadata![i];
      for (const field of narrowFields)
        if (oldMeta[field] !== undefined)
          Object.assign(meta, { [field]: structuredClone(oldMeta[field]) });
      if (op.receivingCamera)
        meta.alternateCamera = structuredClone(op.receivingCamera);
      if (op.incomingCamera)
        meta.incomingCamera = structuredClone(op.incomingCamera);
    }
    const meta = plan.stepMetadata![i],
      canKeepChecks = retainMetadata && currentBaselineChecks,
      oldChecks = oldMeta?.insertionChecks;
    if (canKeepChecks && oldChecks?.length) {
      meta.insertionChecks = structuredClone(oldChecks);
      retainedChecks += oldChecks.length;
    } else {
      meta.insertionChecks = [
        {
          occurrenceIds: [...states[i].highlightIds],
          status: "unknown",
          scope: "cad-surface-translation",
          reason:
            "Agent refinement changed or lacks a pinned geometry/state/mask/view match; no new CAD route was checked.",
        },
      ];
      unknownChecks++;
      meta.targets = meta.targets?.filter(
        (target) => !/^B\d*$/.test(target.label),
      );
      if (!meta.targets?.length) delete meta.targets;
    }
    const external = availability.external.filter(
      (entry) => entry.key === op.key,
    );
    if (
      external.length &&
      !/temporary (?:workbench )?support|hold.*separately|support.*unverified|detached.*unverified/i.test(
        meta.notes ?? "",
      )
    )
      meta.notes =
        (meta.notes ? meta.notes + " " : "") +
        "Required source support/host parts remain on an ancestor workbench outside this detached view. Keep them available and supply temporary workbench support; detached stability, handling and physical fit remain unverified.";
    const changedFields = oldMeta
      ? [...new Set([...Object.keys(oldMeta), ...Object.keys(meta)])].filter(
          (field) =>
            !same(
              oldMeta[field as keyof InstructionStepMetadata],
              meta[field as keyof InstructionStepMetadata],
            ),
        )
      : Object.keys(meta);
    metadataChanges.push({
      key: op.key,
      retainedMetadata: retainMetadata,
      retainedChecks: canKeepChecks ? (oldChecks?.length ?? 0) : 0,
      unknownChecks: canKeepChecks && oldChecks?.length ? 0 : 1,
      changedFields,
    });
  }
  delete plan.generation;
  plan.presentation = "pictorial";
  plan.refinement = {
    mode: "agent",
    baselineAlgorithm: snapshot.baseline.algorithm,
    baselinePlanHash: snapshot.baseline.planHash,
    baselineSourceHash: snapshot.baseline.sourceModelHash,
    retainedInsertionChecks: retainedChecks,
    unknownInsertionChecks: unknownChecks,
    insertionFingerprint: insertionFingerprint(project, plan),
  };
  validateInstructionProgramme(plan);
  validateDocument(applied.project);
  validate("project", applied.project);
  ensure(
    sourceModelHash(applied.project) === snapshot.baseline.sourceModelHash,
    "INVALID_INPUT",
    "Hybrid refinement changed source poses or identity.",
  );
  const newIndices = new Map(keys.map((key, i) => [key, i])),
    changedOperations = snapshot.proposal.operations.flatMap((old, i) => {
      const at = newIndices.get(old.key),
        next = at === undefined ? undefined : proposal.operations[at];
      return at === i && same(old, next)
        ? []
        : [
            {
              key: old.key,
              beforeIndex: i + 1,
              afterIndex: at === undefined ? null : at + 1,
              before: old,
              after: next ?? null,
            },
          ];
    }),
    addedOperations = proposal.operations.filter(
      (op) => !oldIndices.has(op.key),
    ),
    oldPartOwner = new Map(
      snapshot.proposal.operations.flatMap((op) =>
        (op.additions ?? []).map((alias) => [alias, op.key] as const),
      ),
    ),
    partMoves = proposal.operations.flatMap((op) =>
      (op.additions ?? []).flatMap((alias) =>
        oldPartOwner.get(alias) === op.key
          ? []
          : [{ alias, before: oldPartOwner.get(alias), after: op.key }],
      ),
    ),
    moduleIds = new Set([
      ...Object.keys(snapshot.plan.modules ?? {}),
      ...Object.keys(plan.modules ?? {}),
    ]),
    moduleChanges = [...moduleIds].flatMap((id) =>
      same(snapshot.plan.modules?.[id], plan.modules?.[id])
        ? []
        : [
            {
              id,
              before: snapshot.plan.modules?.[id] ?? null,
              after: plan.modules?.[id] ?? null,
            },
          ],
    );
  const delta = {
    schemaVersion: 1,
    baselineHash: snapshot.baseline.baselineHash,
    beforePlanHash: snapshot.baseline.planHash,
    afterPlanHash: hash(encoded(plan)),
    changedOperations,
    addedOperations,
    partMoves,
    moduleChanges,
    metadataChanges,
  };
  const hybridAudit = {
    schemaVersion: 1,
    baselineHash: snapshot.baseline.baselineHash,
    sourceHash: snapshot.baseline.sourceHash,
    sourceModelHash: snapshot.baseline.sourceModelHash,
    sourceUnchanged: true,
    exactOnceCoverage: true,
    programmeValid: true,
    hardPrerequisites: availability.hardEdges,
    actualWorkbenchAvailability: true,
    ancestorRequirements: availability.external,
    protectedProcedureKeys: [...protectedKeys],
    reviewedProcedures: procedureScan.matched,
    unmatchedSourceAssociations: procedureScan.unmatched,
    reviewedProfileScanComplete: !procedureScan.exhausted,
    retainedInsertionChecks: retainedChecks,
    unknownInsertionChecks: unknownChecks,
    cadPolicy:
      "Only source/context/mask/view-identical baseline checks retained; affected or new operations UNKNOWN. No fresh CAD checking or physical assembly validation.",
    assemblyValidated: false,
    baselineAlgorithm: snapshot.baseline.algorithm,
    operationKeys: keys,
    planHash: delta.afterPlanHash,
    reviewTasks: proposal.reviewTasks ?? [],
  };
  return {
    ...applied,
    delta,
    hybridAudit,
    audit: {
      ...applied.audit,
      planHash: delta.afterPlanHash,
      baselineHash: snapshot.baseline.baselineHash,
      cadClaims: hybridAudit.cadPolicy,
      retainedInsertionChecks: retainedChecks,
      unknownInsertionChecks: unknownChecks,
    },
  };
}

async function readJson<T>(path: string, max = 32 * 1024 * 1024): Promise<T> {
  ensure(
    (await stat(path)).size <= max,
    "LIMIT_EXCEEDED",
    `Hybrid JSON exceeds its byte budget: ${path}`,
  );
  return JSON.parse(await readFile(path, "utf8")) as T;
}
export async function prepareHybrid(input: string, output: string) {
  await prepareWorkbench(input, output);
  const native = await readFile(join(output, "source.brickproj")),
    project = await decodeNative(native),
    info = await readJson<{ sourceHash: string; sourceModelHash: string }>(
      join(output, "source.json"),
    );
  registerInstructionGeometryFromDisk(project);
  let evidence: InstructionPlanningEvidence | undefined;
  const { plan } = generateInstructions(project, {}, (value) => {
    evidence = value;
  });
  ensure(
    evidence,
    "INVALID_INPUT",
    "Deterministic planner did not provide refinement evidence.",
  );
  project.instructionPlans.baseline = plan;
  const sourceBytes = await encodeNative(project),
    toolHashes: Record<string, string> = {};
  for (const path of [
    fileURLToPath(import.meta.url),
    fileURLToPath(new URL("./instruction-workbench.ts", import.meta.url)),
    fileURLToPath(new URL("../src/instructions/generate.ts", import.meta.url)),
  ])
    toolHashes[path.split("/").at(-1)!] = hash(await readFile(path));
  const snapshot = createHybridSnapshot(
    project,
    plan,
    evidence,
    info.sourceHash,
    { nativeHash: hash(sourceBytes), toolHashes },
  );
  // Baseline violations are shown explicitly; refinement refuses the unresolved
  // hard edge instead of silently deleting it from the saved evidence.
  let baselineDiagnostic: string | null = null;
  try {
    planningAvailability(
      plan,
      snapshot.baseline.operationKeys,
      evidence,
      new Set(occurrences(project).map((o) => o.id)),
    );
  } catch (error) {
    baselineDiagnostic = formatWorkbenchError(error);
  }
  await writeFile(join(output, "source.brickproj"), sourceBytes);
  await writeJson(join(output, "baseline-plan.json"), snapshot.plan);
  await writeJson(join(output, "baseline-proposal.json"), snapshot.proposal);
  await writeJson(join(output, "hybrid-baseline.json"), snapshot.baseline);
  await writeJson(join(output, "hybrid-prepare-audit.json"), {
    baselineHash: snapshot.baseline.baselineHash,
    baselineDiagnostic,
    sourceModelHash: snapshot.baseline.sourceModelHash,
  });
  console.log(
    JSON.stringify({
      output,
      baselineHash: snapshot.baseline.baselineHash,
      algorithm: snapshot.baseline.algorithm,
      operations: plan.steps.length,
      baselineDiagnostic,
    }),
  );
  return snapshot;
}
async function loadSnapshot(workspace: string) {
  const [bytes, baseline, plan, proposal, aliases] = await Promise.all([
    readFile(join(workspace, "source.brickproj")),
    readJson<HybridBaseline>(join(workspace, "hybrid-baseline.json")),
    readJson<InstructionPlan>(join(workspace, "baseline-plan.json")),
    readJson<WorkbenchProposal>(join(workspace, "baseline-proposal.json")),
    readJson<Aliases>(join(workspace, "aliases.json")),
  ]);
  ensure(
    baseline.nativeHash === hash(bytes),
    "INVALID_INPUT",
    "Hybrid workspace native bytes changed.",
  );
  const project = await decodeNative(bytes),
    snapshot = { baseline, plan, proposal, aliases };
  verifySnapshot(project, snapshot, baseline.baselineHash);
  ensure(
    same(project.instructionPlans.baseline, plan),
    "INVALID_INPUT",
    "Native baseline differs from pinned plan.",
  );
  registerInstructionGeometryFromDisk(project);
  return { project, snapshot };
}
export async function refineHybrid(
  workspace: string,
  proposalPath: string,
  output: string,
  expectedBaselineHash: string,
) {
  ensure(
    resolve(output) !== resolve(workspace),
    "INVALID_INPUT",
    "Refine output must preserve the pinned workspace.",
  );
  const { project, snapshot } = await loadSnapshot(workspace),
    proposal = await readJson<WorkbenchProposal>(proposalPath, 8 * 1024 * 1024),
    result = applyHybridProposal(
      project,
      snapshot,
      proposal,
      expectedBaselineHash,
    );
  const currentToolHashes: Record<string, string> = {};
  for (const path of [
    fileURLToPath(import.meta.url),
    fileURLToPath(new URL("./instruction-workbench.ts", import.meta.url)),
    fileURLToPath(new URL("../src/instructions/generate.ts", import.meta.url)),
  ])
    currentToolHashes[path.split("/").at(-1)!] = hash(await readFile(path));
  Object.assign(result.hybridAudit, {
    currentToolHashes,
    baselineToolHashes: snapshot.baseline.toolHashes,
  });
  await mkdir(output, { recursive: true });
  await writeFile(
    join(output, "result.brickproj"),
    await encodeNative(result.project),
  );
  for (const [name, value] of Object.entries({
    "authored-plan.json": result.plan,
    "proposal.json": proposal,
    "audit.json": result.audit,
    "hybrid-delta.json": result.delta,
    "hybrid-audit.json": result.hybridAudit,
  }))
    await writeJson(join(output, name), value);
  console.log(
    JSON.stringify({
      output,
      baselineHash: snapshot.baseline.baselineHash,
      operations: result.plan.steps.length,
      changedOperations: result.delta.changedOperations.length,
      addedOperations: result.delta.addedOperations.length,
      retainedInsertionChecks: result.hybridAudit.retainedInsertionChecks,
      unknownInsertionChecks: result.hybridAudit.unknownInsertionChecks,
    }),
  );
  return result;
}
export async function reviewHybrid(
  input: string,
  output: string,
  selection: {
    steps?: string;
    keys?: string;
    neighbors?: number;
    planId?: string;
  } = {},
) {
  const planId = selection.planId ?? "agent";
  if (planId === "baseline" && selection.keys) {
    const { project, snapshot } = await loadSnapshot(dirname(input));
    ensure(
      resolve(input) === resolve(join(dirname(input), "source.brickproj")),
      "INVALID_INPUT",
      "Pinned baseline key review requires workspace/source.brickproj.",
    );
    const indices = workbenchReviewSelection(
      project.instructionPlans.baseline.steps.length,
      { keys: selection.keys, neighbors: selection.neighbors },
      snapshot.baseline.operationKeys,
    );
    await reviewWorkbench(
      input,
      output,
      indices.map((i) => String(i + 1)).join(","),
      planId,
    );
    await writeJson(join(output, "hybrid-selection.json"), {
      baselineHash: snapshot.baseline.baselineHash,
      operationKeys: indices.map((i) => snapshot.baseline.operationKeys[i]),
      steps: indices.map((i) => i + 1),
    });
  } else
    await reviewWorkbench(input, output, selection.steps, planId, {
      keys: selection.keys,
      neighbors: selection.neighbors,
    });
}
async function main() {
  const [mode, ...args] = process.argv.slice(2);
  if (!mode || mode === "--help") {
    console.log(
      "Offline deterministic-draft refinement:\nprepare --input MPD_OR_NATIVE --output WORKSPACE\nrefine --workspace WORKSPACE --proposal FULL_ALIAS_JSON --baseline-hash HASH --output RESULT\nreview --input NATIVE --output REVIEW [--plan-id agent|baseline] [--keys a,b --neighbors 0..2 | --steps 1-3]\nCopy baseline-proposal.json; retain stable action keys, hard prerequisites and protected wheel/joint/interface procedures. Camera changes invalidate affected CAD routes. Inspect hybrid-delta.json and review actual images before accepting usability.",
    );
    return;
  }
  const allowed =
    mode === "prepare"
      ? ["--input", "--output"]
      : mode === "refine"
        ? ["--workspace", "--proposal", "--baseline-hash", "--output"]
        : mode === "review"
          ? [
              "--input",
              "--output",
              "--plan-id",
              "--keys",
              "--neighbors",
              "--steps",
            ]
          : [];
  const values: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    ensure(
      allowed.includes(args[i]) &&
        args[i + 1] &&
        !args[i + 1].startsWith("--") &&
        !Object.hasOwn(values, args[i]),
      "INVALID_INPUT",
      "Unknown, duplicate or incomplete hybrid CLI flag.",
    );
    values[args[i]] = args[i + 1];
  }
  const required = (flag: string) => {
    ensure(values[flag], "INVALID_INPUT", `${flag} is required.`);
    return values[flag];
  };
  ensure(allowed.length, "INVALID_INPUT", "Unknown hybrid mode.");
  ensure(
    registerFullLibraryFromDisk(),
    "INVALID_INPUT",
    "Pinned complete library is required.",
  );
  registerFullCatalogFromDisk();
  if (mode === "prepare")
    await prepareHybrid(
      resolve(required("--input")),
      resolve(required("--output")),
    );
  else if (mode === "refine")
    await refineHybrid(
      resolve(required("--workspace")),
      resolve(required("--proposal")),
      resolve(required("--output")),
      required("--baseline-hash"),
    );
  else
    await reviewHybrid(
      resolve(required("--input")),
      resolve(required("--output")),
      {
        planId: values["--plan-id"],
        keys: values["--keys"],
        steps: values["--steps"],
        neighbors:
          values["--neighbors"] === undefined
            ? undefined
            : Number(values["--neighbors"]),
      },
    );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(formatWorkbenchError(error));
    process.exitCode = 1;
  });
