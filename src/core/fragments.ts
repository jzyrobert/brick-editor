import { flattenInstructionProgramme } from "../instructions/programme";
import { assertRequestBudget } from "./request-budget";
import { encodePath, occurrences, validateDocument } from "./document";
import { identity } from "./math";
import {
  ensure,
  uid,
  type Model,
  type Project,
  type Transform,
  type Vec3,
} from "./types";
import { validate } from "./validate";
import { stable } from "./hash";
/** The geometry part of a library lock (connector pack fields left out). */
const geometryLock = (l: Project["library"]) => ({
  releaseId: l.releaseId,
  manifestSha256: l.manifestSha256,
  colorConfigSha256: l.colorConfigSha256,
});
export type ClipboardFragment = { schemaVersion: 1; project: Project };
export type CopyRequest = { occurrenceIds: string[]; includeHidden?: boolean };
const MAX_BYTES = 16 * 1024 * 1024;
function sourceSafe(p: Project) {
  ensure(
    Object.keys(p.motionRigs).length === 0,
    "INVALID_INPUT",
    "Clipboard and arrays cannot remap motion rigs yet. Export a native project to preserve the rig.",
  );
  ensure(
    Object.keys(p.metadata).every((k) => k === "preamble"),
    "INVALID_INPUT",
    "Clipboard cannot interpret this project metadata. Export a native project instead.",
  );
  for (const m of Object.values(p.models))
    for (const r of m.records) {
      const directive = r.raw
        .trim()
        .match(
          /^0\s+(!\S+|BFC|STEP|ROTSTEP|BUFEXCHG|GHOST|SYNTH|MLCAD|LPUB)/i,
        )?.[1]
        .toUpperCase();
      ensure(
        !directive ||
          [
            "!COLOUR",
            "!LICENSE",
            "!LDRAW_ORG",
            "!CATEGORY",
            "!KEYWORDS",
            "!HISTORY",
            "BFC",
            "STEP",
            "ROTSTEP",
          ].includes(directive),
        "INVALID_INPUT",
        `Clipboard cannot safely remap source directive ${directive}. Export the complete native project instead.`,
      );
    }
  const preamble = p.metadata.preamble ?? [];
  ensure(
    Array.isArray(preamble) &&
      preamble.every(
        (raw) =>
          typeof raw === "string" &&
          !/[\r\n]/.test(raw) &&
          (!raw.trim() || /^0(?:\s|$)/.test(raw.trim())),
      ),
    "INVALID_INPUT",
    "Clipboard preamble must contain single comment lines.",
  );
  for (const raw of preamble)
    ensure(
      !/^0\s+(?:!|BFC|STEP|ROTSTEP|FILE|NOFILE|BUFEXCHG|GHOST|SYNTH|MLCAD|LPUB)(?:\s|$)?/i.test(
        raw.trim(),
      ),
      "INVALID_INPUT",
      "Clipboard cannot remap directives in the project preamble.",
    );
}
function retainRecords(model: Model) {
  const kept = new Set(model.nodes.map((n) => n.id));
  model.records = model.records.filter((r, i, all) => {
    if (r.nodeId) return kept.has(r.nodeId);
    if (/^0\s+BFC\s+INVERTNEXT\s*$/i.test(r.raw.trim())) {
      const next = all.slice(i + 1).find((r) => r.nodeId);
      return !!next?.nodeId && kept.has(next.nodeId);
    }
    return true;
  });
}
/** Copy keeps each selected occurrence's hierarchy and source context, never flattening primitives. */
export function copyFragment(
  project: Project,
  request: CopyRequest,
): ClipboardFragment {
  assertRequestBudget(request);
  validate("project", project);
  validateDocument(project);
  ensure(
    request &&
      Object.keys(request).every((k) =>
        ["occurrenceIds", "includeHidden"].includes(k),
      ),
    "INVALID_INPUT",
    "Unknown copy option.",
  );
  ensure(
    Array.isArray(request.occurrenceIds) &&
      request.occurrenceIds.length > 0 &&
      request.occurrenceIds.length <= 10000,
    "LIMIT_EXCEEDED",
    "Copy selects 1–10,000 occurrences.",
  );
  const all = occurrences(project),
    selected = new Set(request.occurrenceIds),
    chosen = all.filter((o) => selected.has(o.id));
  ensure(
    chosen.length === selected.size,
    "INVALID_INPUT",
    "Unknown occurrence in copy selection.",
  );
  ensure(
    request.includeHidden === true || chosen.every((o) => o.visible),
    "INVALID_INPUT",
    "Hidden copy targets require includeHidden.",
  );
  const p = structuredClone(project);
  p.id = uid();
  p.revision = 0;
  p.title = "Clipboard fragment";
  p.models = {};
  const full = new Map<string, string>();
  function cloneFull(id: string): string {
    if (full.has(id)) return full.get(id)!;
    const model = structuredClone(project.models[id]);
    const key = uid();
    full.set(id, key);
    model.id = key;
    model.name = `fragment-${key}.${model.classification === "custom" ? "dat" : "ldr"}`;
    p.models[key] = model;
    for (const n of model.nodes) {
      if (n.kind === "geometry") n.ref = key;
      else if (project.models[n.ref]) n.ref = cloneFull(n.ref);
    }
    return key;
  }
  const selectedPrefixes = new Set(
    chosen.flatMap((o) =>
      o.path.map((_, i) => encodePath(o.path.slice(0, i + 1))),
    ),
  );
  function prune(id: string, path: string[]): string {
    const model = structuredClone(project.models[id]);
    const key = uid();
    model.id = key;
    model.name = `fragment-${key}.ldr`;
    model.nodes = model.nodes.filter((n) =>
      selectedPrefixes.has(encodePath([...path, n.id])),
    );
    p.models[key] = model;
    for (const n of model.nodes) {
      if (n.kind === "submodel") n.ref = prune(n.ref, [...path, n.id]);
      else if (n.kind === "geometry") n.ref = key;
      else if (project.models[n.ref]) n.ref = cloneFull(n.ref);
    }
    retainRecords(model);
    return key;
  }
  p.rootModelId = prune(project.rootModelId, []);
  p.layerAssignments = Object.fromEntries(chosen.map((o) => [o.id, o.layerId]));
  p.marketplace.overrides = Object.fromEntries(
    Object.entries(p.marketplace.overrides).filter(([id]) => selected.has(id)),
  );
  p.groups = Object.fromEntries(
    Object.entries(p.groups)
      .map(([name, ids]) => [name, ids.filter((id) => selected.has(id))])
      .filter(([, ids]) => ids.length),
  );
  for (const plan of Object.values(p.instructionPlans)) {
    flattenInstructionProgramme(plan);
    const retained = plan.steps
      .map((step, index) => ({
        ids: step.filter((id) => selected.has(id)),
        metadata: plan.stepMetadata?.[index],
      }))
      .filter((step) => step.ids.length);
    plan.steps = retained.map((step) => step.ids);
    if (plan.stepMetadata)
      plan.stepMetadata = retained.map((step) => step.metadata ?? {});
  }
  p.cameraBookmarks = {};
  // Floor guides and room labels are whole-project authoring aids, not fragment content.
  delete p.architecture;
  delete p.scene;
  p.diagnostics = p.diagnostics.filter(
    (d) =>
      d.occurrenceIds.length === 0 ||
      d.occurrenceIds.some((id) => selected.has(id)),
  );
  p.diagnostics = p.diagnostics.map((d) => ({
    ...d,
    occurrenceIds: d.occurrenceIds.filter((id) => selected.has(id)),
  }));
  sourceSafe(p);
  validateDocument(p);
  const fragment: ClipboardFragment = { schemaVersion: 1, project: p };
  assertRequestBudget(fragment, MAX_BYTES);
  return fragment;
}
/** Add a validated self-contained fragment under one wrapper per world transform. */
export function pasteFragment(
  target: Project,
  fragment: ClipboardFragment,
  transforms: Transform[],
  options: { layerId?: string; maxAdditions?: number } = {},
) {
  assertRequestBudget(fragment, MAX_BYTES);
  ensure(
    fragment &&
      fragment.schemaVersion === 1 &&
      Object.keys(fragment).every((k) =>
        ["schemaVersion", "project"].includes(k),
      ),
    "INVALID_INPUT",
    "Unsupported clipboard fragment.",
  );

  const source = fragment.project;
  validate("project", source);
  validateDocument(source);
  sourceSafe(source);
  ensure(
    // Geometry locks must agree; the derived connector pack does not change
    // any definition, so a fragment from before it was recorded still pastes.
    stable(geometryLock(source.library)) ===
      stable(geometryLock(target.library)),
    "INVALID_INPUT",
    "Clipboard library snapshot differs; import its native project instead.",
  );
  ensure(
    source.marketplace.mappingPackId === target.marketplace.mappingPackId &&
      source.marketplace.mappingPackSha256 ===
        target.marketplace.mappingPackSha256,
    "INVALID_INPUT",
    "Clipboard marketplace mapping snapshot differs.",
  );
  const sourceOccurrences = occurrences(source),
    sourceIds = new Set(sourceOccurrences.map((o) => o.id));
  ensure(
    Object.keys(source.cameraBookmarks).length === 0,
    "INVALID_INPUT",
    "Clipboard fragments do not contain photo bookmarks. Use a native project to preserve them.",
  );
  ensure(
    source.architecture === undefined,
    "INVALID_INPUT",
    "Clipboard fragments do not contain floor guides or room labels. Use a native project to preserve them.",
  );
  const metadataIds = [
    ...Object.keys(source.layerAssignments),
    ...Object.keys(source.marketplace.overrides),
    ...Object.values(source.groups).flat(),
    ...Object.values(source.instructionPlans).flatMap((plan) =>
      plan.steps.flat(),
    ),
    ...source.diagnostics.flatMap((d) => d.occurrenceIds),
  ];
  ensure(
    metadataIds.every((id) => sourceIds.has(id)),
    "INVALID_INPUT",
    "Clipboard metadata references an occurrence outside the fragment.",
  );
  ensure(
    transforms.length > 0 &&
      sourceOccurrences.length * transforms.length <=
        Math.min(options.maxAdditions ?? 10000, 10000),
    "LIMIT_EXCEEDED",
    "Paste exceeds additions budget.",
  );
  if (options.layerId)
    ensure(
      target.layers[options.layerId] && !target.layers[options.layerId].locked,
      "LAYER_LOCKED",
      "Paste target layer is missing or locked.",
    );
  for (const [name, bytes] of Object.entries(source.assets)) {
    ensure(
      target.assets[name] === undefined || target.assets[name] === bytes,
      "INVALID_INPUT",
      `Clipboard asset name conflicts: ${name}`,
    );
    target.assets[name] = bytes;
  }
  const colors = new Map<string, string>();
  for (const m of [
    ...Object.values(target.models),
    ...Object.values(source.models),
  ])
    for (const r of m.records) {
      const code = r.raw.match(/^0\s+!COLOUR\s+.*?\s+CODE\s+(\S+)/i)?.[1];
      if (code) {
        ensure(
          !colors.has(code) || colors.get(code) === r.raw,
          "INVALID_INPUT",
          `Clipboard custom colour ${code} conflicts with the destination.`,
        );
        colors.set(code, r.raw);
      }
    }
  const models = new Map(Object.keys(source.models).map((id) => [id, uid()]));
  for (const [id, m] of Object.entries(source.models)) {
    const clone = structuredClone(m);
    clone.id = models.get(id)!;
    clone.name = `pasted-${clone.id}.${m.classification === "custom" ? "dat" : "ldr"}`;
    for (const n of clone.nodes)
      if (models.has(n.ref)) n.ref = models.get(n.ref)!;
    if (id === source.rootModelId)
      clone.records.unshift(
        ...((source.metadata.preamble ?? []) as string[]).map((raw) => ({
          id: uid(),
          raw,
        })),
      );
    target.models[clone.id] = clone;
  }
  const folderCopies = new Map<string, string>();
  const copyFolder = (id: string): string => {
    if (folderCopies.has(id)) return folderCopies.get(id)!;
    const original = source.layerFolders?.[id];
    ensure(original, "INVALID_INPUT", "Clipboard layer folder is missing.");
    const key = uid();
    folderCopies.set(id, key);
    target.layerFolders ??= {};
    target.layerFolders[key] = {
      ...structuredClone(original),
      id: key,
      order: Object.keys(target.layerFolders).length,
    };
    if (original.parentFolderId)
      target.layerFolders[key].parentFolderId = copyFolder(
        original.parentFolderId,
      );
    return key;
  };
  const layers = new Map<string, string>();
  for (const o of sourceOccurrences) {
    if (layers.has(o.layerId)) continue;
    if (options.layerId) {
      layers.set(o.layerId, options.layerId);
      continue;
    }
    const old = source.layers[o.layerId],
      existing = target.layers[o.layerId];
    if (existing && existing.name === old.name) {
      ensure(
        !existing.locked,
        "LAYER_LOCKED",
        "Clipboard destination layer is locked.",
      );
      layers.set(o.layerId, o.layerId);
    } else {
      const id = uid();
      target.layers[id] = {
        ...structuredClone(old),
        id,
        locked: false,
        order: Object.keys(target.layers).length,
      };
      if (old.parentFolderId)
        target.layers[id].parentFolderId = copyFolder(old.parentFolderId);
      layers.set(o.layerId, id);
    }
  }
  const mappings: Record<string, string[]> = {};
  for (const transform of transforms) {
    const wrapper = uid();
    target.models[target.rootModelId].nodes.push({
      id: wrapper,
      kind: "submodel",
      ref: models.get(source.rootModelId)!,
      colorCode: "16",
      transform: structuredClone(transform),
    });
    const map = (old: string) => encodePath([wrapper, ...JSON.parse(old)]);
    for (const o of sourceOccurrences) {
      const id = map(o.id);
      (mappings[o.id] ??= []).push(id);
      target.layerAssignments[id] = layers.get(o.layerId)!;
      if (source.marketplace.overrides[o.id])
        target.marketplace.overrides[id] = structuredClone(
          source.marketplace.overrides[o.id],
        );
    }
    for (const [name, ids] of Object.entries(source.groups))
      target.groups[`${name} copy ${wrapper.slice(0, 8)}`] = ids.map(map);
    for (const sourcePlan of Object.values(source.instructionPlans)) {
      const plan = structuredClone(sourcePlan);
      flattenInstructionProgramme(plan);
      target.instructionPlans[uid()] = {
        ...structuredClone(plan),
        name: `${plan.name} (pasted)`,
        steps: plan.steps.map((step) => step.map(map)),
      };
    }
    target.diagnostics.push(
      ...source.diagnostics.map((d) => ({
        ...structuredClone(d),
        occurrenceIds: d.occurrenceIds.filter((id) => mappings[id]).map(map),
      })),
    );
  }
  return mappings;
}
export const translation = (delta: Vec3): Transform => ({
  ...identity(),
  position: delta,
});
