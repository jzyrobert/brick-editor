import { validateRequest } from "../core/validate-request";
import { occurrences } from "../core/document";
import { physical } from "../core/math";
import { ensure, type Project, type Scope } from "../core/types";
import {
  type Bounds,
  projectBounds,
  transformBounds,
  unionBounds,
} from "../core/spatial";
import { resolveScope } from "../inventory/service";
import { libraryLock, installedSource } from "../catalog/catalog";
import installedBounds from "../catalog/bounds.json";
import { worldConnectors } from "../core/connectivity";
export type QueryRequest = {
  colorCode?: string;
  ref?: string;
  layerId?: string;
  occurrenceIds?: string[];
  scope?: Scope;
  selection?: boolean;
  connectivity?: "unverified" | "verified";
  spatial?: boolean;
  bounds?: Bounds & { mode: "intersects" | "contained" };
  intersectingCandidates?: boolean;
};
const overlaps = (a: Bounds, b: Bounds) =>
  [0, 1, 2].every((i) => a.min[i] <= b.max[i] && a.max[i] >= b.min[i]);
export function queryProject(
  project: Project,
  input: QueryRequest = {},
  selected?: string[],
) {
  validateRequest("query", input);
  const missingCache = new Map<string, string[]>();
  let dependencyWork = 0;
  const chargeDependency = () =>
    ensure(
      ++dependencyWork <= 2000000,
      "LIMIT_EXCEEDED",
      "Query dependency diagnostics exceed work budget",
    );
  const missing = (
    ref: string,
    projectContext: boolean,
    ancestors = new Set<string>(),
  ): string[] => {
    const key = `${projectContext}:${ref}`;
    ensure(
      ancestors.size < 64 && !ancestors.has(key),
      "REFERENCE_CYCLE",
      "Cyclic/deep query reference",
    );
    if (missingCache.has(key)) return missingCache.get(key)!;
    const next = new Set(ancestors).add(key),
      unresolved = new Set<string>();
    const inspect = (child: string) => {
      chargeDependency();
      for (const dependency of missing(child, projectContext, next)) {
        chargeDependency();
        unresolved.add(dependency);
      }
    };
    if (projectContext && Object.hasOwn(project.models, ref)) {
      for (const node of project.models[ref].nodes) {
        chargeDependency();
        if (node.kind !== "geometry") inspect(node.ref);
      }
    } else if (installedSource(ref)) {
      if (projectContext)
        for (const dependency of (
          installedBounds.dependencies.direct as Record<string, string[]>
        )[ref] ?? [])
          inspect(dependency);
    } else unresolved.add(ref);
    const refs = [...unresolved];
    missingCache.set(key, refs);
    return refs;
  };
  const all = occurrences(project),
    selectedIds = new Set(selected),
    requestedIds = input.occurrenceIds && new Set(input.occurrenceIds);
  if (input.selection)
    ensure(
      selected !== undefined,
      "INVALID_INPUT",
      "Current selection is unavailable in this host; supply an explicit selection scope",
    );
  const scoped = input.scope ? resolveScope(project, input.scope) : all;
  // Verified stud/anti-stud connector coverage (rigid official catalogue parts).
  const covered = (o: (typeof all)[number]) => worldConnectors(o) !== null;
  let result = scoped.filter(
    (o) =>
      (!input.colorCode || o.colorCode === input.colorCode) &&
      (!input.ref || o.node.ref === input.ref) &&
      (!input.layerId || o.layerId === input.layerId) &&
      (!requestedIds || requestedIds.has(o.id)) &&
      (!input.selection || selectedIds.has(o.id)) &&
      (!input.connectivity ||
        (input.connectivity === "verified") === covered(o)),
  );
  const spatial = input.spatial || input.bounds || input.intersectingCandidates;
  const boxes: Record<string, Bounds | null> = {};
  if (input.bounds)
    ensure(
      [0, 1, 2].every((i) => input.bounds!.min[i] <= input.bounds!.max[i]),
      "INVALID_INPUT",
      "Bounding region minimum exceeds maximum",
    );
  if (spatial) {
    ensure(
      installedBounds.manifestSha256 === libraryLock.manifestSha256 &&
        project.library.manifestSha256 === libraryLock.manifestSha256,
      "INVALID_INPUT",
      "Installed geometry bounds do not match the pinned library",
    );
    const source = projectBounds(
      project,
      installedBounds.bounds as unknown as Record<string, Bounds | null>,
      installedBounds.dependencies.transitive,
    );
    const records = new Map(
      Object.entries(project.models).map(([id, m]) => [
        id,
        new Map(m.records.map((r) => [r.id, r.raw])),
      ]),
    );
    for (const o of result) {
      const local =
        o.node.kind === "geometry"
          ? source.primitive(
              records.get(o.modelId)?.get(o.node.sourceRecordId ?? "") ?? "",
            )
          : source.model(o.node.ref);
      boxes[o.id] = local ? transformBounds(local, o.transform) : null;
    }
  }
  const unknownBoundsIds = spatial
    ? result.filter((o) => !boxes[o.id]).map((o) => o.id)
    : [];
  if (input.bounds) {
    const region = input.bounds;
    result = result.filter((o) => {
      const b = boxes[o.id];
      return (
        b &&
        (region.mode === "intersects"
          ? overlaps(b, region)
          : [0, 1, 2].every(
              (i) => b.min[i] >= region.min[i] && b.max[i] <= region.max[i],
            ))
      );
    });
  }
  let bounds: Bounds | null = null;
  const occurrenceBounds: Record<string, Bounds | null> = {},
    countsByRef: Record<string, number> = Object.create(null);
  for (const o of result) {
    countsByRef[o.node.ref] = (countsByRef[o.node.ref] ?? 0) + 1;
    if (spatial) {
      occurrenceBounds[o.id] = boxes[o.id];
      bounds = unionBounds(bounds, boxes[o.id]);
    }
  }
  const intersectingCandidates: [string, string][] = [];
  if (input.intersectingCandidates) {
    const sorted = result
      .filter((o) => boxes[o.id])
      .sort((a, b) => boxes[a.id]!.min[0] - boxes[b.id]!.min[0]);
    let comparisons = 0,
      pairTextCost = 0;
    for (let i = 0; i < sorted.length; i++)
      for (let j = i + 1; j < sorted.length; j++) {
        const a = boxes[sorted[i].id]!,
          b = boxes[sorted[j].id]!;
        if (b.min[0] > a.max[0]) break;
        ensure(
          ++comparisons <= 2000000,
          "LIMIT_EXCEEDED",
          "Intersection query exceeds comparison budget; narrow its scope",
        );
        if (overlaps(a, b)) {
          ensure(
            intersectingCandidates.length < 10000,
            "LIMIT_EXCEEDED",
            "Intersection query exceeds 10,000 candidates; narrow its scope",
          );
          pairTextCost += 6 * (sorted[i].id.length + sorted[j].id.length) + 16;
          ensure(
            pairTextCost <= 8 * 1024 * 1024,
            "LIMIT_EXCEEDED",
            "Intersection query output exceeds text budget; narrow its scope",
          );
          intersectingCandidates.push([sorted[i].id, sorted[j].id]);
        }
      }
  }
  let diagnosticItems = 0,
    diagnosticTextCost = 0;
  const referenceCosts = new Map<string, number>();
  const unresolvedReferences = result.flatMap((o) => {
    const references =
      o.node.kind === "geometry"
        ? []
        : missing(o.node.ref, o.namespace !== "official");
    if (!references.length) return [];
    // Shared cached arrays still expand once per occurrence when JSON is serialized.
    // Six bytes per code unit bounds JSON escaping and UTF-8 encoding.
    if (!referenceCosts.has(o.namespace + o.node.ref))
      referenceCosts.set(
        o.namespace + o.node.ref,
        references.reduce((sum, ref) => sum + 6 * ref.length + 3, 0),
      );
    diagnosticItems += references.length;
    diagnosticTextCost +=
      referenceCosts.get(o.namespace + o.node.ref)! + 12 * o.id.length + 128;
    ensure(
      diagnosticItems <= 2000000 && diagnosticTextCost <= 8 * 1024 * 1024,
      "LIMIT_EXCEEDED",
      "Query diagnostic output exceeds budget; narrow its scope",
    );
    return [{ occurrenceId: o.id, references }];
  });
  return {
    revision: project.revision,
    occurrences: result,
    diagnostics: project.diagnostics,
    count: result.length,
    projectOccurrenceCount: all.length,
    countsByRef,
    unresolvedReferenceIds: unresolvedReferences.map((o) => o.occurrenceId),
    unresolvedReferences,
    unsupportedPhysicalTransformIds: result
      .filter((o) => !physical(o.transform))
      .map((o) => o.id),
    connectivity: (() => {
      const coveredIds = result.filter(covered).map((o) => o.id);
      const coveredSet = new Set(coveredIds);
      return {
        status: !result.length
          ? ("unverified" as const)
          : coveredIds.length === result.length
            ? ("verified" as const)
            : coveredIds.length
              ? ("partial" as const)
              : ("unverified" as const),
        coveredIds,
        missingConnectorCoverageIds: result
          .filter((o) => !coveredSet.has(o.id))
          .map((o) => o.id),
      };
    })(),
    ...(spatial
      ? {
          spatial: {
            bounds,
            occurrenceBounds,
            unknownBoundsIds,
            complete: unknownBoundsIds.length === 0,
            policy:
              "Conservative transformed source boxes, including studs and line endpoints; candidate overlaps are not proven collisions or connections",
            ...(input.intersectingCandidates ? { intersectingCandidates } : {}),
          },
        }
      : {}),
  };
}
