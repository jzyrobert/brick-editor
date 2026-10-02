/** Transfer only already verified, loaded library data; workers never fetch or crawl. */
import { occurrences } from "../core/document";
import { ensure, type Project } from "../core/types";
import { directReferences } from "../catalog/full-pack";
import {
  curatedGeometrySource,
  registerCuratedGeometrySources,
} from "../catalog/geometry-sources";
import {
  registeredFullLibrary,
  fullCatalog,
  fullSource,
  registerFullLibrary,
  registerFullCatalog,
  addFullSources,
} from "../catalog/full-library";
import {
  fullConnectorEntry,
  fullConnectorManifest,
  registerFullConnectorManifest,
  setFullConnectorProvider,
} from "../catalog/full-connectors";
import type { FullConnectorEntry } from "../catalog/full-connector-pack";
import { canonical } from "../ldraw/path";
import type { Model } from "../core/types";

export const INSTRUCTION_SOURCE_TRANSFER_LIMITS = Object.freeze({
  characters: 20_000_000,
  references: 100_000,
  records: 2_000_000,
  depth: 32,
});

/**
 * Collect available official texts through embedded definitions as well as
 * ordinary part roots. Embedded definitions shadow library names at every
 * level; they travel in the project, never as fabricated official source text.
 * A truncated/missing closure remains unknown to the strict bounds resolver.
 */
export function collectInstructionGeometrySources(
  project: Project,
  roots: Iterable<string>,
  readSource: (ref: string) => string | undefined = (ref) =>
    curatedGeometrySource(ref) ?? fullSource(ref),
  requested: Partial<
    Record<keyof typeof INSTRUCTION_SOURCE_TRANSFER_LIMITS, number>
  > = {},
) {
  const limits: Record<
    keyof typeof INSTRUCTION_SOURCE_TRANSFER_LIMITS,
    number
  > = {
    ...INSTRUCTION_SOURCE_TRANSFER_LIMITS,
  };
  for (const key of Object.keys(limits) as (keyof typeof limits)[]) {
    const value = requested[key];
    if (value !== undefined)
      limits[key] =
        Number.isSafeInteger(value) && value >= 0
          ? Math.min(limits[key], value)
          : 0;
  }
  const sources = new Map<string, string>(),
    models = new Map<string, Model>(),
    seen = new Set<string>(),
    queue: { ref: string; depth: number }[] = [];
  let characters = 0,
    records = 0,
    exhausted = false;
  const enqueue = (
    input: string,
    depth: number,
    parent?: string,
    currentNode = false,
  ) => {
    try {
      let ref = canonical(input);
      if (parent?.includes("/") && !(currentNode && models.has(ref))) {
        const relative = canonical(
          parent.slice(0, parent.lastIndexOf("/") + 1) + input,
        );
        if (models.has(relative)) ref = relative;
      }
      // Mark on enqueue to bound duplicate edges, including local cycles.
      if (seen.has(ref)) return;
      if (depth > limits.depth || queue.length >= limits.references) {
        exhausted = true;
        return;
      }
      seen.add(ref);
      queue.push({ ref, depth });
    } catch {
      exhausted = true;
    }
  };
  if (Object.keys(project.models).length > limits.references)
    return {
      sources,
      exhausted: true,
      stats: { characters, records, references: 0 },
    };
  for (const [key, model] of Object.entries(project.models))
    for (const alias of [key, model.id, model.name])
      try {
        models.set(canonical(alias), model);
      } catch {
        exhausted = true;
      }
  let rootCount = 0;
  for (const ref of roots) {
    if (++rootCount > limits.references) {
      exhausted = true;
      break;
    }
    enqueue(ref, 0);
  }
  for (let n = 0; n < queue.length; n++) {
    const { ref, depth } = queue[n],
      model = models.get(ref);
    if (model) {
      // Avoid stale type-1 records: current nodes are the native source of truth.
      for (const node of model.nodes) {
        if (++records > limits.records) {
          exhausted = true;
          break;
        }
        if (node.kind !== "geometry") enqueue(node.ref, depth + 1, ref, true);
      }
      for (const record of model.records) {
        if (++records > limits.records) {
          exhausted = true;
          break;
        }
        if (record.nodeId) continue;
        characters += record.raw.length;
        if (characters > limits.characters) {
          exhausted = true;
          break;
        }
        for (const child of directReferences(record.raw))
          enqueue(child, depth + 1, ref);
      }
      if (records > limits.records || characters > limits.characters) break;
    } else {
      const source = readSource(ref);
      if (source === undefined) continue;
      if (characters + source.length > limits.characters) {
        exhausted = true;
        continue;
      }
      characters += source.length;
      sources.set(ref, source);
      for (const child of directReferences(source)) {
        if (++records > limits.records) {
          exhausted = true;
          break;
        }
        enqueue(child, depth + 1);
      }
      if (records > limits.records) break;
    }
  }
  return {
    sources,
    exhausted,
    stats: { characters, records, references: queue.length },
  };
}

export function instructionWorkerData(project: Project) {
  const all = occurrences(project);
  ensure(
    all.length > 0 && all.length <= 5000,
    "LIMIT_EXCEEDED",
    "Heuristic generation supports 1–5,000 occurrences.",
  );
  const { sources } = collectInstructionGeometrySources(
    project,
    all.map((o) => o.node.ref),
  );
  const connectorEntries: Record<string, FullConnectorEntry> = {};
  for (const ref of new Set(
    all.filter((o) => o.namespace === "official").map((o) => o.node.ref),
  )) {
    const entry = fullConnectorEntry(ref);
    if (entry) connectorEntries[ref] = entry;
  }
  const library = registeredFullLibrary();
  // The index retains original pinned metadata. No altered index is presented
  // as a newly hash-verified pack; this is a trusted same-origin worker handoff.
  return {
    project: {
      ...project,
      instructionPlans: {},
      assets: {},
      motionRigs: {},
      metadata: {},
    },
    sources,
    connectorEntries,
    connectorManifest: fullConnectorManifest(),
    library: library
      ? { manifest: library.manifest, index: library.index }
      : undefined,
    catalog: fullCatalog(),
  };
}
export function restoreInstructionWorkerData(
  data: ReturnType<typeof instructionWorkerData>,
) {
  if (data.library)
    registerFullLibrary(data.library.manifest, data.library.index);
  if (data.catalog) registerFullCatalog(data.catalog);
  if (data.connectorManifest) {
    registerFullConnectorManifest(data.connectorManifest);
    setFullConnectorProvider(() => data.connectorEntries);
  }
  // Definitions resolve through the pinned index/curated namespaces. Register
  // the exact loaded strings in both readers to cover curated dependencies.
  registerCuratedGeometrySources(data.sources);
  addFullSources(data.sources);
}
