import { validateInstructionCamera } from "../instructions/edit";
import {
  type Project,
  type Occurrence,
  type Transform,
  ensure,
  uid,
} from "./types";
import { identity, compose } from "./math";
import { canonical } from "../ldraw/path";
import { installedSource, libraryLock, mappingLock } from "../catalog/catalog";
export const encodePath = (path: string[]) => JSON.stringify(path);
export function createProject(title = "Untitled build"): Project {
  return {
    schemaVersion: 1,
    id: uid(),
    revision: 0,
    title,
    units: "LDU",
    rootModelId: "root",
    library: structuredClone(libraryLock),
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
export function occurrences(p: Project): Occurrence[] {
  const out: Occurrence[] = [];
  let visited = 0;
  const walk = (
    modelId: string,
    path: string[],
    t: Transform,
    color: string,
    ancestors: Set<string>,
  ) => {
    ensure(path.length < 64, "LIMIT_EXCEEDED", "Reference depth exceeds 64");
    ensure(
      !ancestors.has(modelId),
      "REFERENCE_CYCLE",
      "Cyclic model reference",
    );
    const model = p.models[modelId];
    ensure(model, "REFERENCE_MISSING", "Missing submodel " + modelId);
    const next = new Set(ancestors).add(modelId);
    for (const node of model.nodes) {
      ensure(
        ++visited <= 200000,
        "LIMIT_EXCEEDED",
        "Expanded graph exceeds budget",
      );
      const np = [...path, node.id],
        id = encodePath(np),
        world = compose(t, node.transform),
        c = node.colorCode === "16" ? color : node.colorCode;
      if (node.kind === "submodel") {
        walk(node.ref, np, world, c, next);
        continue;
      }
      ensure(
        out.length < 100000,
        "LIMIT_EXCEEDED",
        "Expanded occurrences exceed 100,000",
      );
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
  walk(p.rootModelId, [], identity(), "16", new Set());
  return out;
}
export function validateDocument(p: Project) {
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
  const done = new Set<string>();
  const check = (id: string, stack: Set<string>) => {
    ensure(!stack.has(id), "REFERENCE_CYCLE", "Cyclic definition");
    if (done.has(id)) return;
    ensure(stack.size < 64, "LIMIT_EXCEEDED", "Reference depth exceeds 64");
    const next = new Set(stack).add(id);
    for (const n of p.models[id].nodes)
      if (n.kind !== "geometry" && p.models[n.ref]) check(n.ref, next);
    done.add(id);
  };
  for (const id of Object.keys(p.models)) check(id, new Set());
  const expanded = occurrences(p),
    occurrenceIds = new Set(expanded.map((o) => o.id));
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
          occurrenceIds.has(id) && !introduced.has(id),
          "INVALID_INPUT",
          "Instruction plan contains a missing or repeated occurrence.",
        );
        introduced.add(id);
      }
    for (const metadata of plan.stepMetadata ?? [])
      if (metadata.camera) validateInstructionCamera(metadata.camera);
  }
  return expanded;
}
