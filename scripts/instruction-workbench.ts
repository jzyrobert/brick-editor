/** Offline MPD inspection and atomic authored instruction programmes. */
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { importLDraw, nodeLine, geometryLine } from "../src/ldraw/io";
import { occurrences, validateDocument } from "../src/core/document";
import { queryProject } from "../src/automation/query";
import { connectionGraph, worldConnectors } from "../src/core/connectivity";
import { partSpec } from "../src/catalog/extended";
import { instructionComponents } from "../src/instructions/components";
import { instructionLots } from "../src/instructions/lots";
import {
  generateInstructions,
  instructionPlacementCamera,
} from "../src/instructions/generate";
import {
  instructionDisplayStates,
  validateInstructionProgramme,
} from "../src/instructions/programme";
import { validateInstructionCamera } from "../src/instructions/edit";
import { encodeNative, decodeNative } from "../src/persistence/native";
import {
  registerFullLibraryFromDisk,
  registerFullCatalogFromDisk,
  fullLibrarySources,
} from "./full-library-node";
import { registerInstructionGeometryFromDisk } from "./instruction-geometry-node";
import { withHeadlessPage } from "./headless";
import { insertionCheckReader } from "../src/instructions/motion";
import {
  illustrationHtml,
  illustrationCss,
  type IllustratedStep,
} from "../src/instructions/illustrate";
import type { PreparedPlan } from "../src/instructions/publish";
import {
  ensure,
  AppError,
  type Project,
  type InstructionPlan,
  type CameraSpec,
} from "../src/core/types";
import { transformBounds, type Bounds } from "../src/core/spatial";
import { validate } from "../src/core/validate";
import { collisionProxy } from "../src/play/collision-proxy";
import { curatedGeometrySource } from "../src/catalog/geometry-sources";
import { fullSource } from "../src/catalog/full-library";

/** Conservative camera boxes only. Local sources retain their custom namespace. */
export function workbenchOccurrenceBounds(
  p: Project,
): Record<string, Bounds | null> {
  const boxes = {
      ...queryProject(p, { spatial: true }).spatial!.occurrenceBounds,
    },
    cache = new Map<string, Bounds | null>(),
    sourceCache = new Map<string, string>(),
    officialCache = new Map<string, string>();
  let sourceCharacters = 0,
    cachedOfficialCharacters = 0;
  const read = (name: string): string | undefined => {
    let value = sourceCache.get(name);
    if (value === undefined) {
      const model = p.models[name];
      if (model) {
        const records = new Map(model.records.map((r) => [r.id, r.raw]));
        value = model.nodes
          .map((node) =>
            node.kind === "geometry"
              ? geometryLine(node, records.get(node.sourceRecordId ?? "") ?? "")
              : nodeLine(node, p),
          )
          .join("\n");
      } else {
        value =
          curatedGeometrySource(name) ??
          fullSource(name) ??
          officialCache.get(name);
        if (value === undefined) {
          const closure = fullLibrarySources([name]);
          for (const [ref, raw] of Object.entries(closure)) {
            if (officialCache.has(ref)) continue;
            cachedOfficialCharacters += raw.length;
            if (cachedOfficialCharacters > 20000000) return undefined;
            officialCache.set(ref, raw);
          }
          value = officialCache.get(name);
        }
      }
      if (value !== undefined) sourceCache.set(name, value);
    }
    sourceCharacters += value?.length ?? 0;
    return sourceCharacters <= 20000000 ? value : undefined;
  };
  for (const o of occurrences(p)) {
    if (boxes[o.id] || !Object.hasOwn(p.models, o.node.ref)) continue;
    if (!cache.has(o.node.ref)) {
      const triangles = collisionProxy(read, o.node.ref, () => false);
      let local: Bounds | null = null;
      if (
        triangles?.length &&
        triangles.every((v) => Number.isFinite(v) && Math.abs(v) <= 50000)
      ) {
        local = {
          min: [Infinity, Infinity, Infinity],
          max: [-Infinity, -Infinity, -Infinity],
        };
        for (let i = 0; i < triangles.length; i++) {
          const axis = i % 3;
          local.min[axis] = Math.min(local.min[axis], triangles[i]);
          local.max[axis] = Math.max(local.max[axis], triangles[i]);
        }
        // Expand Float32 surface extrema outwards; camera boxes remain estimates.
        local.min = local.min.map((v) => v - 0.05) as [number, number, number];
        local.max = local.max.map((v) => v + 0.05) as [number, number, number];
      }
      cache.set(o.node.ref, local);
    }
    const local = cache.get(o.node.ref)!;
    if (local) {
      const world = transformBounds(local, o.transform);
      if ([...world.min, ...world.max].every((v) => Math.abs(v) <= 1000000))
        boxes[o.id] = world;
    }
  }
  return boxes;
}
const displayName = (p: Project, ref: string) => {
  const local = p.models[ref];
  if (local)
    return (
      local.records
        .find((r) => /^0\s+(?!FILE\b|Name:|Author:|!|BFC\b)\S/i.test(r.raw))
        ?.raw.replace(/^0\s+/, "") ?? local.name
    );
  return partSpec(ref)?.name ?? ref;
};

export type Aliases = Record<string, string>;
export type WorkbenchProposal = {
  schemaVersion?: 1;
  sourceHash: string;
  name?: string;
  modules?: {
    id: string;
    name: string;
    members: string[];
    parentId?: string;
    placement?: "scene" | "attachment";
    purpose?: "wheel" | "joint" | "source";
    receivers?: string[];
    receiver?: {
      position: [number, number, number];
      axis: [number, number, number];
    };
  }[];
  operations: {
    key: string;
    additions?: string[];
    workbench?: string;
    place?: string;
    notes?: string;
    camera?: CameraSpec;
    receivingCamera?: CameraSpec;
    incomingCamera?: CameraSpec;
    receiving?: string[];
  }[];
  reviewTasks?: string[];
  before?: [string, string][];
};
const sha = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
export const sourceModelHash = (p: Project) =>
  sha(JSON.stringify([p.rootModelId, p.models, p.library, p.assets]));
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
/** Keep CLI failures actionable without dumping an unbounded schema error array. */
export function formatWorkbenchError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (!(error instanceof AppError) || !Array.isArray(error.details))
    return message.slice(0, 2048);
  const details = error.details.slice(0, 12).map((detail: unknown) => {
    if (!detail || typeof detail !== "object")
      return "  Schema validation failed.";
    const value = detail as Record<string, unknown>;
    const path =
      typeof value.instancePath === "string" ? value.instancePath : "";
    const reason =
      typeof value.message === "string" ? value.message : "is invalid";
    const params = value.params as Record<string, unknown> | undefined;
    const property =
      params && typeof params.additionalProperty === "string"
        ? ` (${params.additionalProperty.slice(0, 100)})`
        : "";
    return `  ${path.slice(0, 512) || "/"}: ${reason.slice(0, 256)}${property}`;
  });
  if (error.details.length > details.length)
    details.push(
      `  ${error.details.length - details.length} additional schema errors omitted.`,
    );
  return [message.slice(0, 2048), ...details].join("\n");
}
function validateWorkbenchCamera(camera: CameraSpec, label: string) {
  try {
    validate("camera", camera);
    validateInstructionCamera(camera);
  } catch (error) {
    if (error instanceof AppError)
      throw new AppError(
        error.code,
        `${label}: ${error.message}`,
        error.details,
      );
    throw error;
  }
}
const text = (value: unknown, label: string, max = 200): string => {
  ensure(
    typeof value === "string" && value.trim().length > 0 && value.length <= max,
    "INVALID_INPUT",
    `${label} must contain 1–${max} characters.`,
  );
  return value;
};
const keys = (value: unknown, allowed: string[], label: string) => {
  ensure(
    value !== null && typeof value === "object" && !Array.isArray(value),
    "INVALID_INPUT",
    `${label} must be an object.`,
  );
  ensure(
    Object.keys(value).every((key) => allowed.includes(key)),
    "INVALID_INPUT",
    `${label} contains unsupported fields.`,
  );
};
export function workbenchAliases(p: Project): Aliases {
  return Object.fromEntries(
    occurrences(p).map((o, i) => ["p" + String(i + 1).padStart(4, "0"), o.id]),
  );
}
function boundedProject(p: Project) {
  const all = validateDocument(p);
  ensure(
    all.length > 0 && all.length <= 5000,
    "LIMIT_EXCEEDED",
    "Instruction workbench supports 1–5,000 source leaves.",
  );
  return all;
}
export function compactProposal(
  p: Project,
  plan: InstructionPlan,
  sourceHash: string,
  aliases = workbenchAliases(p),
): WorkbenchProposal {
  const reverse = new Map(
    Object.entries(aliases).map(([alias, id]) => [id, alias]),
  );
  const aliased = (ids: string[]) =>
    ids.map((id) => {
      const value = reverse.get(id);
      ensure(value, "INVALID_INPUT", "Unknown compact-plan occurrence.");
      return value;
    });
  return {
    schemaVersion: 1,
    sourceHash,
    name: plan.name,
    modules: Object.entries(plan.modules ?? {}).map(([id, m]) => ({
      id,
      name: m.name,
      members: aliased(m.occurrenceIds),
      ...(m.parentModuleId ? { parentId: m.parentModuleId } : {}),
      ...(m.placement ? { placement: m.placement } : {}),
      ...(m.purpose ? { purpose: m.purpose } : {}),
      ...(m.hostIds ? { receivers: aliased(m.hostIds) } : {}),
      ...(m.receiver ? { receiver: structuredClone(m.receiver) } : {}),
    })),
    operations: plan.steps.map((ids, i) => {
      const meta = plan.stepMetadata?.[i];
      return {
        key: "op" + String(i + 1).padStart(4, "0"),
        additions: aliased(ids),
        ...(meta?.assembly?.type === "build"
          ? { workbench: meta.assembly.moduleId }
          : {}),
        ...(meta?.assembly?.type === "join"
          ? { place: meta.assembly.moduleId }
          : {}),
        ...(meta?.notes ? { notes: meta.notes } : {}),
      };
    }),
    reviewTasks: [],
  };
}
/** Pure authoring boundary: source data never changes and no saved CAD claims survive. */
export function applyWorkbenchProposal(
  source: Project,
  proposal: WorkbenchProposal,
  aliases: Aliases,
  expectedSourceHash: string,
) {
  const all = boundedProject(source),
    originalHash = sourceModelHash(source);
  keys(
    proposal,
    [
      "schemaVersion",
      "sourceHash",
      "name",
      "modules",
      "operations",
      "reviewTasks",
      "before",
    ],
    "Proposal",
  );
  ensure(
    proposal.schemaVersion === undefined || proposal.schemaVersion === 1,
    "INVALID_INPUT",
    "Unsupported proposal version.",
  );
  ensure(
    proposal.sourceHash === expectedSourceHash,
    "INVALID_INPUT",
    "Proposal source hash does not match this workspace.",
  );
  ensure(
    Array.isArray(proposal.operations) &&
      proposal.operations.length > 0 &&
      proposal.operations.length <= 2000,
    "LIMIT_EXCEEDED",
    "Provide 1–2,000 operations.",
  );
  ensure(
    !proposal.modules ||
      (Array.isArray(proposal.modules) && proposal.modules.length <= 2000),
    "LIMIT_EXCEEDED",
    "Too many modules.",
  );
  const realIds = new Set(all.map((o) => o.id));
  ensure(
    Object.values(aliases).length === realIds.size &&
      new Set(Object.values(aliases)).size === realIds.size &&
      Object.values(aliases).every((id) => realIds.has(id)),
    "INVALID_INPUT",
    "Alias map does not match source occurrences.",
  );
  const ids = (values: string[], label: string) => {
    ensure(
      Array.isArray(values) && values.length <= 5000,
      "INVALID_INPUT",
      `${label} must be a bounded alias array.`,
    );
    return values.map((alias) => {
      ensure(
        typeof alias === "string" && Object.hasOwn(aliases, alias),
        "INVALID_INPUT",
        `${label}: unknown alias ${String(alias)}.`,
      );
      return aliases[alias];
    });
  };
  const plan: InstructionPlan = {
    name: text(proposal.name ?? "Agent-authored hobbyist draft", "Plan name"),
    presentation: "pictorial",
    steps: [],
    stepMetadata: [],
  };
  const moduleIds = new Set<string>();
  for (const m of proposal.modules ?? []) {
    keys(
      m,
      [
        "id",
        "name",
        "members",
        "parentId",
        "placement",
        "purpose",
        "receivers",
        "receiver",
      ],
      "Module",
    );
    text(m.id, "Module ID", 100);
    ensure(
      /^[a-zA-Z0-9_-]+$/.test(m.id) && !moduleIds.has(m.id),
      "INVALID_INPUT",
      "Module IDs must be unique letters, numbers, underscores or hyphens.",
    );
    ensure(
      !["__proto__", "prototype", "constructor"].includes(m.id),
      "INVALID_INPUT",
      "Reserved module ID.",
    );
    moduleIds.add(m.id);
    ensure(
      m.placement === undefined ||
        m.placement === "scene" ||
        m.placement === "attachment",
      "INVALID_INPUT",
      "Unknown placement kind.",
    );
    ensure(
      m.purpose === undefined ||
        m.purpose === "wheel" ||
        m.purpose === "joint" ||
        m.purpose === "source",
      "INVALID_INPUT",
      "Unknown module purpose.",
    );
    if (m.receiver) {
      keys(m.receiver, ["position", "axis"], "Receiving feature");
      ensure(
        [m.receiver.position, m.receiver.axis].every(
          (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite),
        ) && Math.hypot(...m.receiver.axis) > 1e-9,
        "INVALID_INPUT",
        "Receiving feature needs finite position and nonzero axis.",
      );
    }
    plan.modules ??= Object.create(null);
    plan.modules![m.id] = {
      name: text(m.name, "Module name"),
      occurrenceIds: ids(m.members, "Module members"),
      feasibility: "unknown",
      ...(m.parentId
        ? { parentModuleId: text(m.parentId, "Parent ID", 100) }
        : {}),
      ...(m.placement ? { placement: m.placement } : {}),
      ...(m.purpose ? { purpose: m.purpose } : {}),
      ...(m.receivers ? { hostIds: ids(m.receivers, "Module receivers") } : {}),
      ...(m.receiver ? { receiver: structuredClone(m.receiver) } : {}),
    };
  }
  const operationKeys = new Set<string>(),
    receiving = new Map<number, string[]>();
  for (const [i, op] of proposal.operations.entries()) {
    keys(
      op,
      [
        "key",
        "additions",
        "workbench",
        "place",
        "notes",
        "camera",
        "receivingCamera",
        "incomingCamera",
        "receiving",
      ],
      "Operation",
    );
    text(op.key, "Operation key", 100);
    ensure(
      !operationKeys.has(op.key),
      "INVALID_INPUT",
      "Operation keys must be unique.",
    );
    operationKeys.add(op.key);
    ensure(
      !(op.workbench && op.place),
      "INVALID_INPUT",
      "An operation cannot build and place at once.",
    );
    const added = ids(op.additions ?? [], "Operation additions");
    ensure(
      added.length > 0 || !!op.place,
      "INVALID_INPUT",
      "Only a placement may have no new parts.",
    );
    const cameraLabel = `Operation ${i + 1} (${op.key})`;
    if (op.camera !== undefined)
      validateWorkbenchCamera(op.camera, `${cameraLabel}.camera`);
    if (op.receivingCamera !== undefined)
      validateWorkbenchCamera(
        op.receivingCamera,
        `${cameraLabel}.receivingCamera`,
      );
    if (op.incomingCamera !== undefined) {
      ensure(
        !!op.place,
        "INVALID_INPUT",
        `${cameraLabel}.incomingCamera requires place: a completed-module join or scene placement; use camera for ordinary additions or workbench building.`,
      );
      validateWorkbenchCamera(
        op.incomingCamera,
        `${cameraLabel}.incomingCamera`,
      );
    }
    plan.steps.push(added);
    plan.stepMetadata!.push({
      ...(op.notes ? { notes: text(op.notes, "Operation notes", 4096) } : {}),
      ...(op.camera ? { camera: structuredClone(op.camera) } : {}),
      ...(op.workbench
        ? {
            assembly: {
              type: "build",
              moduleId: text(op.workbench, "Workbench ID", 100),
            } as const,
          }
        : {}),
      ...(op.place
        ? {
            assembly: {
              type: "join",
              moduleId: text(op.place, "Placement ID", 100),
            } as const,
          }
        : {}),
    });
    if (op.receiving)
      receiving.set(i, ids(op.receiving, "Operation receiving candidates"));
  }
  const flat = plan.steps.flat(),
    seen = new Set(flat);
  ensure(
    flat.length === all.length &&
      seen.size === all.length &&
      all.every((o) => seen.has(o.id)),
    "INVALID_INPUT",
    "Every source leaf must be introduced exactly once; additions are missing or duplicated.",
  );
  const stepOf = new Map(
    plan.steps.flatMap((step, i) => step.map((id) => [id, i] as const)),
  );
  for (const component of instructionComponents(source, all))
    ensure(
      new Set(component.occurrenceIds.map((id) => stepOf.get(id))).size === 1,
      "INVALID_INPUT",
      "A generated drawing owner must be introduced atomically.",
    );
  validateInstructionProgramme(plan);
  if (proposal.before) {
    ensure(
      Array.isArray(proposal.before) && proposal.before.length <= 10000,
      "LIMIT_EXCEEDED",
      "Too many explicit ordering constraints.",
    );
    for (const pair of proposal.before) {
      ensure(
        Array.isArray(pair) && pair.length === 2,
        "INVALID_INPUT",
        "Ordering constraints must be alias pairs.",
      );
      const [a, b] = ids(pair, "Ordering constraint");
      ensure(
        stepOf.get(a)! < stepOf.get(b)!,
        "INVALID_INPUT",
        "An explicit ordering constraint is not satisfied before the operation starts.",
      );
    }
  }
  ensure(
    !proposal.reviewTasks ||
      (Array.isArray(proposal.reviewTasks) &&
        proposal.reviewTasks.length <= 500),
    "LIMIT_EXCEEDED",
    "Too many review tasks.",
  );
  proposal.reviewTasks?.forEach((task) => text(task, "Review task", 4096));
  const p = structuredClone(source),
    states = instructionDisplayStates(plan);
  const boxes = workbenchOccurrenceBounds(p);
  const byId = new Map(all.map((o) => [o.id, o]));
  const boundsFor = (values: string[]) =>
    values.flatMap((id) => (boxes[id] ? [boxes[id]!] : []));
  let previous = 0;
  for (const [i, state] of states.entries()) {
    const meta = plan.stepMetadata![i],
      display = boundsFor(state.displayIds),
      additions = boundsFor(state.highlightIds);
    const hosts =
      receiving.get(i) ??
      (meta.assembly?.type === "join"
        ? (plan.modules![meta.assembly.moduleId].hostIds ?? [])
        : []);
    const prior = new Set(
      state.displayIds.filter((id) => !state.highlightIds.includes(id)),
    );
    ensure(
      hosts.every((id) => prior.has(id)),
      "INVALID_INPUT",
      "An operation receiving candidate must exist in its displayed prior assembly.",
    );
    if (display.length && additions.length) {
      const view = instructionPlacementCamera(
        display,
        additions,
        previous,
        additions.concat(boundsFor(hosts)),
        true,
      );
      previous = view.view;
      if (!meta.camera) {
        meta.camera = view.camera;
        if (view.contextCamera) meta.contextCamera = view.contextCamera;
      }
      if (state.incomingIds?.length)
        meta.incomingCamera = instructionPlacementCamera(
          additions,
          additions,
          previous,
        ).camera;
    }
    // A completed module is one placement action; its leaves retain full coverage.
    // Individual addition operations reserve native markers for receivers/features.
    const featureMarks =
      meta.assembly?.type === "join" &&
      plan.modules![meta.assembly.moduleId].receiver
        ? 1
        : 0;
    const incomingMarks = 20 - Math.min(hosts.length, 4) - featureMarks;
    meta.targets = state.highlightIds.slice(0, incomingMarks).map((id, n) => ({
      position: byId.get(id)!.transform.position,
      label: String(n + 1),
      occurrenceId: id,
    }));
    if (meta.assembly?.type === "join") {
      const module = plan.modules![meta.assembly.moduleId],
        memberBoxes = boundsFor(module.occurrenceIds);
      const position = memberBoxes.length
        ? ([0, 1, 2].map(
            (axis) =>
              (Math.min(...memberBoxes.map((b) => b.min[axis])) +
                Math.max(...memberBoxes.map((b) => b.max[axis]))) /
              2,
          ) as [number, number, number])
        : byId.get(module.occurrenceIds[0])!.transform.position;
      meta.targets = [
        {
          position,
          label: module.placement === "scene" ? "S" : "J",
          caption:
            module.placement === "scene"
              ? `Place completed object ${module.name} in the scene; no mating connection inferred.`
              : `Place completed module ${module.name}; receiving fit and handling unverified.`,
        },
      ];
    }
    hosts.slice(0, 4).forEach((id, n) =>
      meta.targets!.push({
        position: byId.get(id)!.transform.position,
        label: hosts.length === 1 ? "R" : `R${n + 1}`,
        occurrenceId: id,
        caption: `Receiving candidate: ${displayName(p, byId.get(id)!.node.ref)}; interface and fit unverified.`,
      }),
    );
    if (hosts.length) {
      const hostBoxes = boundsFor(hosts);
      if (hostBoxes.length) {
        meta.alternateCamera = instructionPlacementCamera(
          hostBoxes,
          hostBoxes,
          previous,
        ).camera;
        meta.alternateBeforePlacement = true;
      }
    }
    const authored = proposal.operations[i];
    if (meta.assembly?.type === "join") {
      const module = plan.modules![meta.assembly.moduleId];
      if (module.receiver) {
        const feature = module.receiver,
          length = Math.hypot(...feature.axis),
          direction = feature.axis.map((v) => v / length) as [
            number,
            number,
            number,
          ];
        const base = meta.camera;
        if (base && !authored.receivingCamera) {
          const offset = direction.map(
            (v, a) => v * 250 + (a === 1 ? -100 : 0),
          );
          const upLength = Math.hypot(...base.up);
          const up = base.up.map((v) => v / upLength);
          const dot = offset.reduce((sum, v, a) => sum + v * up[a], 0);
          const lateralLength = Math.hypot(
            ...offset.map((v, a) => v - dot * up[a]),
          );
          if (lateralLength < Math.hypot(...offset) * 0.1) {
            // Keep a feature-facing view valid even when its axis follows camera up.
            const axis = up.reduce(
              (best, v, a) => (Math.abs(v) < Math.abs(up[best]) ? a : best),
              0,
            );
            const lateral = up.map(
              (v, a) => (a === axis ? 1 : 0) - up[axis] * v,
            );
            const scale = 100 / Math.hypot(...lateral);
            offset.forEach((v, a) => {
              offset[a] = v + lateral[a] * scale;
            });
          }
          meta.alternateCamera = {
            ...base,
            target: feature.position,
            position: feature.position.map((v, a) => v + offset[a]) as [
              number,
              number,
              number,
            ],
            span: 100,
          };
          validateInstructionCamera(meta.alternateCamera);
          meta.alternateBeforePlacement = true;
        }
        meta.targets.push({
          position: feature.position,
          label: "P",
          caption: "Candidate receiving feature; fit and fastening unverified.",
        });
      }
    }
    if (authored.receivingCamera) {
      ensure(
        hosts.length > 0,
        "INVALID_INPUT",
        "A receiving camera requires named candidates in the displayed prior assembly.",
      );
      meta.alternateCamera = structuredClone(authored.receivingCamera);
      meta.alternateBeforePlacement = true;
    }
    if (authored.incomingCamera)
      meta.incomingCamera = structuredClone(authored.incomingCamera);
  }
  p.instructionPlans = {
    agent: plan,
    ...Object.fromEntries(
      Object.entries(p.instructionPlans).filter(([id]) => id !== "agent"),
    ),
  };
  validateDocument(p);
  validate("project", p);
  ensure(
    sourceModelHash(p) === originalHash,
    "INVALID_INPUT",
    "Source models, poses, assets or library changed.",
  );
  return {
    project: p,
    plan,
    audit: {
      schemaVersion: 1,
      sourceHash: expectedSourceHash,
      sourceModelHash: originalHash,
      sourceUnchanged: true,
      exactOnceCoverage: true,
      programmeValid: true,
      atomicDrawingOwners: true,
      operations: plan.steps.length,
      occurrences: all.length,
      modules: Object.keys(plan.modules ?? {}).length,
      cadClaims: "none; agent-authored operations are unverified",
      assemblyValidated: false,
      operationKeys: proposal.operations.map((op) => op.key),
      planHash: sha(JSON.stringify(plan)),
      reviewTasks: proposal.reviewTasks ?? [],
    },
  };
}

async function loadProject(path: string) {
  ensure(
    (await stat(path)).size <= 25 * 1024 * 1024,
    "LIMIT_EXCEEDED",
    "Workbench input exceeds 25 MiB.",
  );
  const bytes = await readFile(path);
  const p = path.endsWith(".brickproj")
    ? await decodeNative(bytes)
    : importLDraw(bytes.toString("utf8"), basename(path), {
        profile: "desktop",
      });
  boundedProject(p);
  registerInstructionGeometryFromDisk(p);
  return { p, bytes };
}
async function writeJson(path: string, value: unknown) {
  await writeFile(path, json(value));
}
type InspectionDossier = {
  sourceHash: string;
  inputName: string;
  occurrenceCount: number;
  groups: { path: string[]; name: string; members: string[] }[];
  parts: {
    alias: string;
    occurrenceId: string;
    sourcePath: string[];
    model: string;
    ref: string;
    name: string;
    namespace: string;
    colorCode: string;
    kind: string;
    transform: { position: number[]; basis: number[] };
    bounds: Bounds | null;
    verifiedConnectors: unknown[] | null;
  }[];
  strictContacts: {
    covered: string[];
    uncovered: string[];
    contacts: number;
    edges: [string, string][];
  };
  components: unknown[];
};
export function inspectWorkbenchDossier(
  dossier: InspectionDossier,
  options: { parts?: string; group?: string; detail?: boolean } = {},
) {
  const known = new Set(dossier.parts.map((part) => part.alias)),
    covered = new Set(dossier.strictContacts.covered);
  const requested =
    options.parts === undefined
      ? undefined
      : options.parts.split(",").map((alias) => alias.trim());
  ensure(
    !requested ||
      (requested.length > 0 &&
        requested.length <= 100 &&
        requested.every((alias) => known.has(alias))),
    "INVALID_INPUT",
    "Choose at most 100 existing part aliases.",
  );
  const matchedGroups = options.group
    ? dossier.groups.filter(
        (group) =>
          group.name.toLowerCase().includes(options.group!.toLowerCase()) ||
          JSON.stringify(group.path) === options.group ||
          group.path.join("/") === options.group,
      )
    : dossier.groups;
  ensure(
    !options.group || matchedGroups.length > 0,
    "INVALID_INPUT",
    "No source group matches the requested name or path.",
  );
  const members = options.group
    ? new Set(matchedGroups.flatMap((group) => group.members))
    : known;
  ensure(
    !requested || requested.every((alias) => members.has(alias)),
    "INVALID_INPUT",
    "A requested part is outside the selected source group.",
  );
  const chosen = new Set(requested ?? members),
    matchedParts = dossier.parts.filter((part) => chosen.has(part.alias)),
    limit = options.detail ? 100 : 50;
  ensure(
    !requested || matchedParts.length <= limit,
    "LIMIT_EXCEEDED",
    `Explicit selection exceeds ${limit} parts; narrow it or use --detail.`,
  );
  const displayed = matchedParts.slice(0, limit),
    displayedIds = new Set(displayed.map((part) => part.alias)),
    edges = dossier.strictContacts.edges.filter(
      ([a, b]) => displayedIds.has(a) || displayedIds.has(b),
    );
  return {
    schemaVersion: 1,
    sourceHash: dossier.sourceHash,
    inputName: dossier.inputName,
    occurrenceCount: dossier.occurrenceCount,
    fullDetails: "inspection.json",
    connectorScope:
      "strict supported source geometry only; uncovered means unknown",
    matchedPartCount: matchedParts.length,
    returnedPartCount: displayed.length,
    partsTruncated: displayed.length < matchedParts.length,
    groupCount: matchedGroups.length,
    groupsTruncated: matchedGroups.length > 100,
    groups: matchedGroups.slice(0, 100).map((group) => ({
      path: group.path,
      name: group.name,
      count: group.members.length,
    })),
    parts: displayed.map((part) =>
      options.detail
        ? { ...part, connectorCovered: covered.has(part.alias) }
        : {
            alias: part.alias,
            name: part.name,
            ref: part.ref,
            colorCode: part.colorCode,
            namespace: part.namespace,
            sourcePath: part.sourcePath,
            position: part.transform.position,
            bounds: part.bounds,
            connectorCovered: covered.has(part.alias),
            verifiedConnectorCount: part.verifiedConnectors?.length ?? 0,
          },
    ),
    strictContacts: {
      count: dossier.strictContacts.contacts,
      selectedEdges: edges.slice(0, 1000),
      selectedEdgeCount: edges.length,
      edgesTruncated: edges.length > 1000,
    },
    drawingOwnerCount: dossier.components.length,
  };
}
export async function inspectWorkbench(
  workspace: string,
  options: { parts?: string; group?: string; detail?: boolean } = {},
) {
  const path = join(workspace, "inspection.json");
  ensure(
    (await stat(path)).size <= 25 * 1024 * 1024,
    "LIMIT_EXCEEDED",
    "Inspection dossier exceeds 25 MiB.",
  );
  const dossier = JSON.parse(await readFile(path, "utf8")) as InspectionDossier;
  console.log(json(inspectWorkbenchDossier(dossier, options)));
}
export async function prepareWorkbench(input: string, output: string) {
  const sourceOutput = join(output, "source.brickproj");
  ensure(
    resolve(input) !== resolve(sourceOutput),
    "INVALID_INPUT",
    "Prepare must not overwrite its input source.",
  );
  const [inputStat, outputStat] = await Promise.all([
    stat(input),
    stat(sourceOutput).catch(() => undefined),
  ]);
  ensure(
    !outputStat ||
      inputStat.dev !== outputStat.dev ||
      inputStat.ino !== outputStat.ino,
    "INVALID_INPUT",
    "Prepare must not overwrite its input source.",
  );
  const { p, bytes } = await loadProject(input),
    all = occurrences(p),
    aliases = workbenchAliases(p),
    reverse = new Map(Object.entries(aliases).map(([a, id]) => [id, a]));
  const sourceHash = sha(bytes),
    modelHash = sourceModelHash(p),
    bounds = workbenchOccurrenceBounds(p),
    graph = connectionGraph(p, all),
    components = instructionComponents(p, all);
  const groups = new Map<
    string,
    { path: string[]; name: string; members: string[] }
  >();
  for (const o of all) {
    let model = p.models[p.rootModelId];
    for (let depth = 0; depth < o.path.length - 1; depth++) {
      const node = model.nodes.find((n) => n.id === o.path[depth]);
      if (!node || node.kind !== "submodel") break;
      model = p.models[node.ref];
      const path = o.path.slice(0, depth + 1),
        key = JSON.stringify(path),
        group = groups.get(key) ?? { path, name: model.name, members: [] };
      group.members.push(reverse.get(o.id)!);
      groups.set(key, group);
    }
  }
  const sourceInfo = {
    schemaVersion: 1,
    inputName: basename(input),
    sourceHash,
    sourceModelHash: modelHash,
    library: p.library,
    attribution: [
      ...new Set(
        Object.values(p.models).flatMap((m) =>
          m.records
            .filter((r) => /^0\s+(?:Author:|!LICENSE)/i.test(r.raw))
            .map((r) => r.raw),
        ),
      ),
    ],
  };
  const dossier = {
    ...sourceInfo,
    occurrenceCount: all.length,
    coordinateSystem:
      "LDraw units: 20/stud, 8/plate, negative Y up. Preserve exact source matrices.",
    groups: [...groups.values()],
    components: components.map((c) => ({
      ...c,
      members: c.occurrenceIds.map((id) => reverse.get(id)),
      occurrenceIds: undefined,
    })),
    strictContacts: {
      covered: graph.covered.map((id) => reverse.get(id)),
      uncovered: graph.uncovered.map((id) => reverse.get(id)),
      contacts: graph.contacts,
      edges: [...graph.edges].flatMap(([id, others]) =>
        [...others]
          .filter((other) => id < other)
          .map(
            (other) =>
              [reverse.get(id)!, reverse.get(other)!] as [string, string],
          ),
      ),
    },
    parts: all.map((o) => ({
      alias: reverse.get(o.id)!,
      occurrenceId: o.id,
      sourcePath: o.path,
      model: o.modelId,
      ref: o.node.ref,
      name: displayName(p, o.node.ref),
      namespace: o.namespace,
      colorCode: o.colorCode,
      kind: o.node.kind,
      transform: o.transform,
      bounds: bounds[o.id],
      verifiedConnectors: worldConnectors(o) ?? null,
    })),
  };
  const { plan } = generateInstructions(p);
  p.instructionPlans.baseline = plan;
  ensure(
    sourceModelHash(p) === modelHash,
    "INVALID_INPUT",
    "Generation changed source.",
  );
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "source.brickproj"), await encodeNative(p));
  await writeJson(join(output, "source.json"), sourceInfo);
  await writeJson(join(output, "aliases.json"), aliases);
  await writeJson(join(output, "inspection.json"), dossier);
  await writeJson(
    join(output, "inspection-summary.json"),
    inspectWorkbenchDossier(dossier as InspectionDossier),
  );
  await writeJson(join(output, "baseline-plan.json"), plan);
  await writeJson(
    join(output, "baseline-proposal.json"),
    compactProposal(p, plan, sourceHash, aliases),
  );
  console.log(
    json({
      output,
      sourceHash,
      occurrences: all.length,
      operations: plan.steps.length,
      groups: groups.size,
      files: [
        "source.brickproj",
        "source.json",
        "aliases.json",
        "inspection.json",
        "inspection-summary.json",
        "baseline-plan.json",
        "baseline-proposal.json",
      ],
    }),
  );
}
export async function applyWorkbench(
  workspace: string,
  proposalPath: string,
  output: string,
) {
  const { p } = await loadProject(join(workspace, "source.brickproj")),
    info = JSON.parse(await readFile(join(workspace, "source.json"), "utf8")),
    aliases = JSON.parse(
      await readFile(join(workspace, "aliases.json"), "utf8"),
    ) as Aliases;
  ensure(
    sourceModelHash(p) === info.sourceModelHash,
    "INVALID_INPUT",
    "Workspace native source has changed.",
  );
  ensure(
    (await stat(proposalPath)).size <= 8 * 1024 * 1024,
    "LIMIT_EXCEEDED",
    "Proposal exceeds 8 MiB.",
  );
  const proposal = JSON.parse(
      await readFile(proposalPath, "utf8"),
    ) as WorkbenchProposal,
    result = applyWorkbenchProposal(p, proposal, aliases, info.sourceHash);
  await mkdir(output, { recursive: true });
  await writeFile(
    join(output, "result.brickproj"),
    await encodeNative(result.project),
  );
  await writeJson(join(output, "authored-plan.json"), result.plan);
  await writeJson(join(output, "proposal.json"), proposal);
  await writeJson(join(output, "audit.json"), result.audit);
  console.log(
    json({
      output,
      sourceHash: result.audit.sourceHash,
      sourceUnchanged: true,
      exactOnceCoverage: true,
      programmeValid: true,
      operations: result.audit.operations,
      occurrences: result.audit.occurrences,
      modules: result.audit.modules,
      reviewTaskCount: result.audit.reviewTasks.length,
      assemblyValidated: false,
      files: [
        "result.brickproj",
        "authored-plan.json",
        "proposal.json",
        "audit.json",
      ],
    }),
  );
}
export function workbenchReviewIndices(
  value: string | undefined,
  count: number,
) {
  ensure(
    count > 0 && count <= 2000,
    "LIMIT_EXCEEDED",
    "Review requires 1–2,000 operations.",
  );
  if (!value) {
    ensure(
      count <= 60,
      "LIMIT_EXCEEDED",
      "Choose --steps for plans over 60 operations.",
    );
    return Array.from({ length: count }, (_, i) => i);
  }
  const indices = new Set<number>();
  for (const token of value.split(",")) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(token.trim());
    ensure(
      match,
      "INVALID_INPUT",
      "Steps must be one-based numbers or ranges, such as 1,3-5.",
    );
    const first = Number(match[1]),
      last = Number(match[2] ?? match[1]);
    ensure(
      Number.isSafeInteger(first) &&
        Number.isSafeInteger(last) &&
        first >= 1 &&
        last >= first &&
        last <= count,
      "INVALID_INPUT",
      "Review step is outside this plan.",
    );
    ensure(
      last - first < 60,
      "LIMIT_EXCEEDED",
      "One review captures at most 60 operation states.",
    );
    for (let step = first; step <= last; step++) indices.add(step - 1);
    ensure(
      indices.size <= 60,
      "LIMIT_EXCEEDED",
      "One review captures at most 60 operation states.",
    );
  }
  return [...indices].sort((a, b) => a - b);
}
export function workbenchReviewSelection(
  count: number,
  options: { steps?: string; keys?: string; neighbors?: number } = {},
  operationKeys?: string[],
) {
  ensure(
    !(options.steps && options.keys),
    "INVALID_INPUT",
    "Choose --steps or --keys, not both.",
  );
  const neighbors = options.neighbors ?? 0;
  ensure(
    Number.isInteger(neighbors) && neighbors >= 0 && neighbors <= 2,
    "INVALID_INPUT",
    "Neighbors must be 0, 1 or 2.",
  );
  let selected: number[];
  if (options.keys !== undefined) {
    ensure(
      operationKeys?.length === count && new Set(operationKeys).size === count,
      "INVALID_INPUT",
      "Stable key selection requires the matching authored audit.",
    );
    const lookup = new Map(operationKeys!.map((key, i) => [key, i])),
      requested = options.keys.split(",").map((key) => key.trim());
    ensure(
      requested.length > 0 &&
        requested.length <= 60 &&
        requested.every((key) => lookup.has(key)),
      "INVALID_INPUT",
      "One or more requested operation keys are missing from this plan.",
    );
    selected = [...new Set(requested.map((key) => lookup.get(key)!))];
  } else selected = workbenchReviewIndices(options.steps, count);
  const indices = new Set<number>();
  for (const i of selected)
    for (let delta = -neighbors; delta <= neighbors; delta++)
      if (i + delta >= 0 && i + delta < count) indices.add(i + delta);
  ensure(
    indices.size <= 60,
    "LIMIT_EXCEEDED",
    "Selected operations and neighbors exceed 60 states; narrow the selection.",
  );
  return [...indices].sort((a, b) => a - b);
}
export function workbenchReviewPixels(
  steps: Pick<
    PreparedPlan["steps"][number],
    "contextCamera" | "alternateCamera" | "incomingIds" | "completedDetail"
  >[],
) {
  return steps.reduce(
    (total, step) =>
      total +
      640 * 480 +
      (Number(!!step.contextCamera) +
        Number(!!step.alternateCamera) +
        Number(!!step.incomingIds) +
        Number(!!step.completedDetail)) *
        240 *
        180,
    0,
  );
}
const htmlEscape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export async function reviewWorkbench(
  input: string,
  output: string,
  selected?: string,
  planId = "agent",
  selection: { keys?: string; neighbors?: number } = {},
) {
  const reviewStarted = performance.now(),
    startedAt = new Date().toISOString(),
    toolHash = sha(await readFile(fileURLToPath(import.meta.url)));
  const { p } = await loadProject(input),
    plan = p.instructionPlans[planId];
  ensure(plan, "INVALID_INPUT", `Unknown plan ${planId}.`);
  validateInstructionProgramme(plan);
  const all = occurrences(p),
    flat = plan.steps.flat();
  ensure(
    flat.length === all.length &&
      new Set(flat).size === all.length &&
      all.every((o) => flat.includes(o.id)),
    "INVALID_INPUT",
    "Review requires exact complete coverage.",
  );
  let operationKeys: string[] | undefined;
  if (planId === "agent") {
    try {
      const audit = JSON.parse(
        await readFile(join(dirname(input), "audit.json"), "utf8"),
      );
      if (
        Array.isArray(audit.operationKeys) &&
        audit.operationKeys.length === plan.steps.length
      ) {
        ensure(
          !audit.planHash || audit.planHash === sha(JSON.stringify(plan)),
          "INVALID_INPUT",
          "Authored plan no longer matches its operation-key audit.",
        );
        operationKeys = audit.operationKeys;
      }
    } catch (error) {
      if ((error as { code?: string }).code !== "ENOENT") throw error;
    }
  }
  const indices = workbenchReviewSelection(
      plan.steps.length,
      { steps: selected, ...selection },
      operationKeys,
    ),
    states = instructionDisplayStates(plan),
    components = instructionComponents(p, all),
    checks = insertionCheckReader(p, plan),
    cumulative: string[] = [],
    steps = new Map<number, PreparedPlan["steps"][number]>();
  for (let i = 0; i < plan.steps.length; i++) {
    cumulative.push(...plan.steps[i]);
    if (!indices.includes(i)) continue;
    const lots = instructionLots(p, plan.steps[i], {
      named: true,
      physical: true,
      components,
    });
    steps.set(i, {
      number: i + 1,
      addedIds: plan.steps[i],
      cumulativeIds: [...cumulative],
      partCount: lots.reduce((sum, lot) => sum + lot.quantity, 0),
      lots,
      ...plan.stepMetadata?.[i],
      ...states[i],
      insertionChecks: checks(plan.stepMetadata?.[i] ?? {}),
      ...(states[i].incomingIds
        ? {
            incomingCamera:
              plan.stepMetadata?.[i]?.incomingCamera ??
              plan.stepMetadata?.[i]?.camera,
          }
        : {}),
    });
  }
  const requestedPixels = workbenchReviewPixels([...steps.values()]);
  ensure(
    requestedPixels <= 64000000,
    "LIMIT_EXCEEDED",
    "Selected main/supporting captures exceed the 64 megapixel budget.",
  );
  await mkdir(output, { recursive: true });
  const records: {
      step: number;
      operationKey?: string;
      captureHash: string;
      images: Record<string, string>;
      displayIds: string[];
      addedIds: string[];
      incomingIds?: string[];
    }[] = [],
    tiles: string[] = [];
  let capturedBytes = 0;
  await withHeadlessPage(p, async (page) => {
    // tsx preserves function names inside serialized Playwright callbacks.
    await page.evaluate("globalThis.__name = (fn) => fn");
    for (const i of indices) {
      const step = steps.get(i)!;
      const packed = await page.evaluate(async (step) => {
        const api = window.brickEditor!,
          path = "/src/instructions/illustrate.ts",
          { captureInstructionIllustration } = await import(path),
          q = await api.query();
        const result = await captureInstructionIllustration(
          q.revision,
          step,
          {
            setCamera: (camera: any) => api.camera.set(camera),
            image: (request: any) => api.render.image(request),
          },
          { width: 640, height: 480, dimPrevious: true, pictorial: true },
        );
        return {
          main: Array.from(result.main),
          context: result.context ? Array.from(result.context) : undefined,
          alternate: result.alternate
            ? Array.from(result.alternate)
            : undefined,
          incoming: result.incoming ? Array.from(result.incoming) : undefined,
          completed: result.completed
            ? Array.from(result.completed)
            : undefined,
          tray: result.tray.map((t: any) => ({
            lot: t.lot,
            png: t.png ? Array.from(t.png) : undefined,
          })),
        };
      }, step);
      const illustrated: IllustratedStep = {
        main: new Uint8Array(packed.main as number[]),
        ...(packed.context
          ? { context: new Uint8Array(packed.context as number[]) }
          : {}),
        ...(packed.alternate
          ? { alternate: new Uint8Array(packed.alternate as number[]) }
          : {}),
        ...(packed.incoming
          ? { incoming: new Uint8Array(packed.incoming as number[]) }
          : {}),
        ...(packed.completed
          ? { completed: new Uint8Array(packed.completed as number[]) }
          : {}),
        tray: packed.tray.map(
          (t: {
            lot: IllustratedStep["tray"][number]["lot"];
            png?: number[];
          }) => ({
            lot: t.lot,
            ...(t.png ? { png: new Uint8Array(t.png) } : {}),
          }),
        ),
      };
      const images: Record<string, string> = {};
      for (const kind of [
        "main",
        "context",
        "alternate",
        "incoming",
        "completed",
      ] as const) {
        const bytes = illustrated[kind];
        if (!bytes) continue;
        capturedBytes += bytes.length;
        ensure(
          capturedBytes <= 100 * 1024 * 1024,
          "LIMIT_EXCEEDED",
          "Review images exceed 100 MiB.",
        );
        images[kind] = `step-${i + 1}-${kind}.png`;
        await writeFile(join(output, images[kind]), bytes);
      }
      records.push({
        step: i + 1,
        ...(operationKeys?.[i] ? { operationKey: operationKeys[i] } : {}),
        captureHash: sha(
          JSON.stringify([
            p.models,
            p.library,
            step,
            "instruction-workbench-review-v1",
          ]),
        ),
        images,
        displayIds: step.displayIds ?? step.cumulativeIds,
        addedIds: step.addedIds,
        ...(step.incomingIds ? { incomingIds: step.incomingIds } : {}),
      });
      tiles.push(
        `<article><h2>Operation ${i + 1} / ${plan.steps.length}${operationKeys?.[i] ? " · " + htmlEscape(operationKeys[i]) : ""}</h2>${illustrationHtml(step, illustrated)}<p>${htmlEscape(step.notes ?? "")}</p></article>`,
      );
      console.log(`Captured operation ${i + 1}/${plan.steps.length}`);
    }
    const gallery = (items: string[]) =>
      `<!doctype html><html><head><meta charset="utf-8"><title>${htmlEscape(p.title)}</title><style>body{font:16px system-ui;background:#f3f4f5;margin:20px}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}article{background:white;padding:10px;border:1px solid #aaa;min-width:0}h2{font-size:16px;margin:0}p{font-size:12px;line-height:1.4;overflow-wrap:anywhere}img{max-width:100%}${illustrationCss}@media(max-width:600px){main{grid-template-columns:1fr}}</style></head><body><h1>${htmlEscape(p.title)} — ${htmlEscape(plan.name)}</h1><p>Selected actual instruction states; not a complete booklet or physical validation.</p><main>${items.join("\n")}</main></body></html>`;
    const full = gallery(tiles);
    ensure(
      Buffer.byteLength(full) <= 100 * 1024 * 1024,
      "LIMIT_EXCEEDED",
      "Review gallery exceeds 100 MiB.",
    );
    await writeFile(join(output, "index.html"), full);
    for (let start = 0; start < tiles.length; start += 9) {
      const number = Math.floor(start / 9) + 1,
        path = join(output, `page-${number}.html`);
      await writeFile(path, gallery(tiles.slice(start, start + 9)));
      await page.setViewportSize({ width: 1500, height: 1100 });
      await page.setContent(gallery(tiles.slice(start, start + 9)));
      await page.evaluate(() =>
        Promise.all(
          [...document.images].map((img) => img.decode().catch(() => {})),
        ),
      );
      const galleryHeight = await page.evaluate(
        () => document.documentElement.scrollHeight,
      );
      ensure(
        galleryHeight <= 12000,
        "LIMIT_EXCEEDED",
        "Gallery page exceeds 12,000 pixels; select a smaller operation window.",
      );
      await page.screenshot({
        path: join(output, `page-${number}.jpg`),
        fullPage: true,
        quality: 85,
      });
    }
  });
  await writeJson(join(output, "manifest.json"), {
    schemaVersion: 1,
    toolHash,
    startedAt,
    durationMs: Math.round(performance.now() - reviewStarted),
    planId,
    sourceModelHash: sourceModelHash(p),
    planHash: sha(JSON.stringify(plan)),
    assemblyValidated: false,
    selectedOperations: indices.map((i) => i + 1),
    selection: { steps: selected, ...selection },
    totalOperations: plan.steps.length,
    captureCount: records.reduce((n, r) => n + Object.keys(r.images).length, 0),
    requestedMainPixels: indices.length * 640 * 480,
    requestedPixels,
    records,
  });
  console.log(
    json({
      output,
      selectedOperations: indices.map((i) => i + 1),
      captures: records.length,
    }),
  );
}
async function main() {
  const args = process.argv.slice(2),
    mode = args.shift();
  if (!mode || mode === "help" || mode === "--help") {
    console.log(
      "instruction-workbench prepare --input MODEL.mpd --output DIR\ninstruction-workbench inspect --workspace DIR [--parts p0001,p0002] [--group NAME-OR-PATH] [--detail]\ninstruction-workbench apply --workspace DIR --proposal proposal.json --output RESULT\ninstruction-workbench review --input RESULT/result.brickproj --output REVIEW [--steps 1,2,5-8 | --keys wheel-place,roof-place] [--neighbors 0|1|2] [--plan-id agent]\nProposal operations accept camera, receivingCamera and incomingCamera view overrides. incomingCamera requires place (completed-module join or scene placement); use camera for ordinary additions and workbench builds. receivingCamera requires receiving aliases already present in the displayed prior assembly, or module receivers.\nEach camera uses the camera schema in schemas/camera.v1.json: space:'ldraw', projection:'perspective'|'orthographic', finite three-number position/target/up vectors, fovDeg >0 and <180, near >0, far >near; orthographic also needs span >0. Include fovDeg for both projections. Position and target must differ; up must be nonzero and not parallel to the view. No extra camera fields.\nView changes are not physical flips or proof of connection. Leave camera overrides absent to use derived framing, then inspect the rendered states. Validation errors report operation/field context and bounded schema paths.",
    );
    return;
  }
  const values: Record<string, string> = Object.create(null);
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    ensure(
      /^--[a-z-]+$/.test(key) && !Object.hasOwn(values, key),
      "INVALID_INPUT",
      "Use unique --flag value arguments.",
    );
    if (key === "--detail") values[key] = "true";
    else {
      ensure(
        typeof args[i + 1] === "string" && !args[i + 1].startsWith("--"),
        "INVALID_INPUT",
        "A flag value is missing.",
      );
      values[key] = args[++i];
    }
  }
  const required = (name: string) => {
    ensure(values[name], "INVALID_INPUT", `${name} is required.`);
    return resolve(values[name]);
  };
  const allowed =
    mode === "prepare"
      ? ["--input", "--output"]
      : mode === "apply"
        ? ["--workspace", "--proposal", "--output"]
        : mode === "review"
          ? [
              "--input",
              "--output",
              "--steps",
              "--keys",
              "--neighbors",
              "--plan-id",
            ]
          : mode === "inspect"
            ? ["--workspace", "--parts", "--group", "--detail"]
            : [];
  ensure(
    allowed.length > 0 &&
      Object.keys(values).every((key) => allowed.includes(key)),
    "INVALID_INPUT",
    "Unknown mode or flag.",
  );
  if (mode === "inspect") {
    await inspectWorkbench(required("--workspace"), {
      parts: values["--parts"],
      group: values["--group"],
      detail: values["--detail"] === "true",
    });
    return;
  }
  ensure(
    registerFullLibraryFromDisk(),
    "INVALID_INPUT",
    "Pinned complete library is required.",
  );
  registerFullCatalogFromDisk();
  if (mode === "prepare")
    await prepareWorkbench(required("--input"), required("--output"));
  else if (mode === "apply")
    await applyWorkbench(
      required("--workspace"),
      required("--proposal"),
      required("--output"),
    );
  else
    await reviewWorkbench(
      required("--input"),
      required("--output"),
      values["--steps"],
      values["--plan-id"] ?? "agent",
      {
        keys: values["--keys"],
        neighbors:
          values["--neighbors"] === undefined
            ? 0
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
