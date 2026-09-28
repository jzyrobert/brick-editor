import { validateArchitecture } from "./architecture";
import { validateInstructionCamera } from "../instructions/edit";
import {
  type Project,
  type Occurrence,
  type Transform,
  ensure,
  uid,
} from "./types";
import { identity, compose } from "./math";
import { estimateExpansion } from "./expansion";
import { isOccurrenceId } from "./occurrence-id";
import { canonical } from "../ldraw/path";
import {
  installedSource,
  mappingLock,
  projectLibraryLock,
} from "../catalog/catalog";
import {
  expansionLimits,
  preflightExpansion,
  assertExpansionResource,
  type ExpansionOptions,
} from "./expansion-policy";
export const encodePath = (path: string[]) => JSON.stringify(path);
export function createProject(title = "Untitled build"): Project {
  return {
    schemaVersion: 1,
    id: uid(),
    revision: 0,
    title,
    units: "LDU",
    rootModelId: "root",
    library: structuredClone(projectLibraryLock),
    marketplace: { ...mappingLock, overrides: {} },
    models: {
      root: {
        id: "root",
        name: "main.ldr",
        nodes: [],
        records: [],
        classification: "model",
      },
    },
    layers: {
      base: {
        id: "base",
        name: "Main build",
        visible: true,
        locked: false,
        order: 0,
      },
    },
    defaultLayerId: "base",
    layerAssignments: {},
    groups: {},
    instructionPlans: {},
    cameraBookmarks: {},
    motionRigs: {},
    metadata: {},
    assets: {},
    diagnostics: [],
  };
}
/** Materializes a bounded derived view. Source-only validation and persistence
 * use validateSourceDocument; scene consumers must satisfy these budgets. */
export function occurrences(
  p: Project,
  options: ExpansionOptions = {},
): Occurrence[] {
  const limits = expansionLimits(options);
  preflightExpansion(p, limits);
  const out: Occurrence[] = [];
  let visited = 0,
    retainedCharacters = 0,
    generatedCharacters = 0,
    pathSlots = 0;
  const segmentWeights = new Map<string, number>();
  const segmentWeight = (id: string) => {
    let weight = segmentWeights.get(id);
    if (weight === undefined) {
      weight = JSON.stringify(id).length + 1;
      segmentWeights.set(id, weight);
    }
    return weight;
  };
  const walk = (
    modelId: string,
    path: string[],
    t: Transform,
    color: string,
    ancestors: Set<string>,
    pathWeight: number,
  ) => {
    assertExpansionResource(
      "referenceDepth",
      path.length + 1,
      limits,
      "traversal",
    );
    ensure(
      !ancestors.has(modelId),
      "REFERENCE_CYCLE",
      "Cyclic model reference",
    );
    const model = p.models[modelId];
    ensure(model, "REFERENCE_MISSING", "Missing submodel " + modelId);
    const next = new Set(ancestors).add(modelId);
    for (const node of model.nodes) {
      assertExpansionResource("visitedNodes", ++visited, limits, "traversal");
      const nextWeight = pathWeight + segmentWeight(node.id);
      assertExpansionResource("maxDepth", path.length + 1, limits, "traversal");
      generatedCharacters += nextWeight + 1;
      assertExpansionResource(
        "generatedIdCharacters",
        generatedCharacters,
        limits,
        "traversal",
      );
      if (node.kind !== "submodel") {
        assertExpansionResource(
          "leafCount",
          out.length + 1,
          limits,
          "traversal",
        );
        retainedCharacters += nextWeight + 1;
        pathSlots += path.length + 1;
        assertExpansionResource(
          "retainedIdCharacters",
          retainedCharacters,
          limits,
          "traversal",
        );
        assertExpansionResource("pathSlots", pathSlots, limits, "traversal");
      }
      const np = [...path, node.id],
        id = encodePath(np),
        world = compose(t, node.transform),
        c = node.colorCode === "16" ? color : node.colorCode;
      if (node.kind === "submodel") {
        walk(node.ref, np, world, c, next, nextWeight);
        continue;
      }
      const layerId = p.layerAssignments[id] || p.defaultLayerId;
      ensure(p.layers[layerId], "INVALID_INPUT", "Unknown layer assignment");
      out.push({
        id,
        path: np,
        node,
        modelId,
        transform: world,
        colorCode: c,
        layerId,
        namespace:
          node.kind === "geometry" || p.models[node.ref]
            ? "project"
            : installedSource(node.ref)
              ? "official"
              : "missing",
        visible: p.layers[layerId].visible,
      });
    }
  };
  walk(p.rootModelId, [], identity(), "16", new Set(), 0);
  return out;
}
/** Validate authoritative source without allocating its expanded scene. */
export function validateSourceDocument(p: Project): void {
  validateArchitecture(p);
  if (p.metadata.preamble !== undefined) {
    ensure(
      Array.isArray(p.metadata.preamble) &&
        p.metadata.preamble.length <= 100000 &&
        p.metadata.preamble.every(
          (line) =>
            typeof line === "string" &&
            line.length <= 4096 &&
            !/[\r\n\0]/.test(line) &&
            (!line.trim() || /^0(?:\s|$)/.test(line.trim())) &&
            !/^0\s+(?:FILE|NOFILE)(?:\s|$)/i.test(line.trim()),
        ),
      "INVALID_INPUT",
      "MPD preamble must contain only bounded, single-line comments without file boundaries",
    );
  }
  ensure(p.schemaVersion === 1, "INVALID_INPUT", "Unsupported project version");
  ensure(
    p.units === "LDU" && Number.isSafeInteger(p.revision) && p.revision >= 0,
    "INVALID_INPUT",
    "Invalid project revision or units",
  );
  ensure(
    Object.keys(p.models).length <= 10000,
    "LIMIT_EXCEEDED",
    "Too many definitions",
  );
  ensure(p.layers[p.defaultLayerId], "INVALID_INPUT", "Missing default layer");
  const folders = p.layerFolders ?? {};
  for (const [id, folder] of Object.entries(folders)) {
    ensure(
      folder.id === id,
      "INVALID_INPUT",
      "Folder ID does not match its key",
    );
    const ancestors = new Set<string>();
    let current: typeof folder | undefined = folder;
    while (current) {
      ensure(
        !ancestors.has(current.id),
        "INVALID_INPUT",
        "Folder hierarchy contains a cycle",
      );
      ensure(
        ancestors.size < 32,
        "LIMIT_EXCEEDED",
        "Folder nesting exceeds 32 levels",
      );
      ancestors.add(current.id);
      if (!current.parentFolderId) break;
      ensure(
        folders[current.parentFolderId],
        "INVALID_INPUT",
        "Unknown parent folder",
      );
      current = folders[current.parentFolderId];
    }
  }
  for (const [id, layer] of Object.entries(p.layers)) {
    ensure(layer.id === id, "INVALID_INPUT", "Layer ID does not match its key");
    ensure(
      !layer.parentFolderId || folders[layer.parentFolderId],
      "INVALID_INPUT",
      "Layer references an unknown folder",
    );
  }
  const names = new Set<string>();
  for (const m of Object.values(p.models)) {
    const name = canonical(m.name);
    ensure(!names.has(name), "INVALID_INPUT", "Duplicate model filename");
    names.add(name);
    const recordIds = new Set<string>(),
      anchors = new Set<string>();
    for (const record of m.records) {
      ensure(
        !recordIds.has(record.id),
        "INVALID_INPUT",
        "Duplicate source record ID",
      );
      recordIds.add(record.id);
      ensure(
        !/[\r\n]/.test(record.raw) &&
          !/^0\s+(?:FILE|NOFILE)(?:\s|$)/i.test(record.raw.trim()),
        "INVALID_INPUT",
        "Source records must be individual non-boundary lines",
      );
      if (record.nodeId) {
        ensure(
          !anchors.has(record.nodeId),
          "INVALID_INPUT",
          "Duplicate source anchor",
        );
        anchors.add(record.nodeId);
      }
    }
    const recordsById = new Map(m.records.map((record) => [record.id, record]));
    const ids = new Set<string>();
    for (const n of m.nodes) {
      ensure(!ids.has(n.id), "INVALID_INPUT", "Duplicate node ID");
      ids.add(n.id);
      if (n.sourceRecordId)
        ensure(
          recordsById.get(n.sourceRecordId)?.nodeId === n.id,
          "INVALID_INPUT",
          "Invalid source anchor",
        );
      ensure(
        /^(?:\d+|0x2[\da-f]{6})$/i.test(n.colorCode),
        "INVALID_INPUT",
        "Invalid colour identifier",
      );
      if (n.kind !== "geometry" && !p.models[n.ref]) canonical(n.ref);
      if (n.kind === "geometry") {
        const record = n.sourceRecordId
          ? recordsById.get(n.sourceRecordId)
          : undefined;
        ensure(
          record && /^[2-5]\s/.test(record.raw.trim()),
          "INVALID_INPUT",
          "Geometry must have a source record",
        );
        const tokens = record.raw.trim().split(/\s+/);
        ensure(
          tokens.length ===
            ({ 2: 8, 3: 11, 4: 14, 5: 14 } as Record<string, number>)[
              tokens[0]
            ] && tokens.slice(2).every((t) => Number.isFinite(Number(t))),
          "INVALID_INPUT",
          "Invalid source geometry",
        );
      }
      ensure(
        n.transform.position.length === 3 &&
          n.transform.basis.length === 9 &&
          [...n.transform.position, ...n.transform.basis].every(
            Number.isFinite,
          ),
        "INVALID_TRANSFORM",
        "Transforms must be finite",
      );
    }
  }
  // Cache subtree height, not only visitation: a shared suffix reached later
  // through a deeper prefix must still obey the reference-depth limit.
  const heights = new Map<string, number>();
  const active = new Set<string>();
  const check = (id: string): number => {
    ensure(!active.has(id), "REFERENCE_CYCLE", "Cyclic definition");
    ensure(active.size < 64, "LIMIT_EXCEEDED", "Reference depth exceeds 64");
    const cached = heights.get(id);
    if (cached !== undefined) {
      ensure(
        active.size + cached <= 64,
        "LIMIT_EXCEEDED",
        "Reference depth exceeds 64",
      );
      return cached;
    }
    active.add(id);
    let height = 1;
    for (const n of p.models[id].nodes)
      if (n.kind !== "geometry" && Object.hasOwn(p.models, n.ref))
        height = Math.max(height, 1 + check(n.ref));
    active.delete(id);
    heights.set(id, height);
    return height;
  };
  for (const id of Object.keys(p.models)) check(id);
  const estimate = estimateExpansion(p, {
    ceilings: { leafCount: 100000, visitedNodes: 200000 },
  });
  ensure(
    !estimate.saturated.leafCount,
    "LIMIT_EXCEEDED",
    "Expanded occurrences exceed 100,000",
  );
  ensure(
    !estimate.saturated.visitedNodes,
    "LIMIT_EXCEEDED",
    "Expanded graph exceeds budget",
  );
  // Resolve only supplied metadata paths, stopping at physical-part boundaries.
  // Shared definitions are indexed once; no expanded ID set is required.
  const indexes = new Map(
    Object.entries(p.models).map(
      ([id, model]) =>
        [id, new Map(model.nodes.map((node) => [node.id, node]))] as const,
    ),
  );
  const isLeaf = (id: string): boolean => {
    if (!isOccurrenceId(id)) return false;
    const path = JSON.parse(id) as string[];
    let modelId = p.rootModelId;
    for (let i = 0; i < path.length; i++) {
      const node = indexes.get(modelId)?.get(path[i]);
      if (!node) return false;
      if (i === path.length - 1) return node.kind !== "submodel";
      if (node.kind !== "submodel") return false;
      modelId = node.ref;
    }
    return false;
  };
  for (const [id, layerId] of Object.entries(p.layerAssignments))
    if (isLeaf(id))
      ensure(p.layers[layerId], "INVALID_INPUT", "Unknown layer assignment");
  for (const plan of Object.values(p.instructionPlans)) {
    ensure(
      !plan.stepMetadata || plan.stepMetadata.length === plan.steps.length,
      "INVALID_INPUT",
      "Instruction step metadata is misaligned.",
    );
    const introduced = new Set<string>();
    for (const step of plan.steps)
      for (const id of step) {
        ensure(
          isLeaf(id) && !introduced.has(id),
          "INVALID_INPUT",
          "Instruction plan contains a missing or repeated occurrence.",
        );
        introduced.add(id);
      }
    for (const metadata of plan.stepMetadata ?? [])
      if (metadata.camera) validateInstructionCamera(metadata.camera);
  }
}
/** Compatibility entry point for callers requiring a materializable scene. */
export function validateDocument(p: Project): Occurrence[] {
  validateSourceDocument(p);
  return occurrences(p);
}
