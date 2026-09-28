import installedBounds from "../catalog/bounds.json";
import { projectBounds, transformBounds, type Bounds } from "../core/spatial";
import { occurrences } from "../core/document";
import type { Occurrence, Project } from "../core/types";
import {
  architectureOf,
  floorIndex,
  sortedFloors,
  type FloorFocus,
  type FloorGuide,
} from "../core/architecture";
/** Lowest point (largest LDraw y, since −Y is up) of every occurrence, from conservative
 * source bounds. Raw faces carry their geometry in vertices, so placement positions
 * alone say nothing about height. */
/** Reusable per-occurrence results across edits of one document (see occurrenceBottoms). */
export type BottomCache = Map<string, { key: string; bottom: number }>;
export function occurrenceBottoms(
  project: Project,
  all: Occurrence[] = occurrences(project),
  cache?: BottomCache,
) {
  let sources: ReturnType<typeof projectBounds> | undefined;
  const records = new Map<string, Map<string, string>>();
  const raw = (o: Occurrence) => {
    let map = records.get(o.modelId);
    if (!map) {
      map = new Map(
        project.models[o.modelId]?.records.map((r) => [r.id, r.raw]) ?? [],
      );
      records.set(o.modelId, map);
    }
    return map.get(o.node.sourceRecordId ?? "") ?? "";
  };
  const bottoms = new Map<string, number>();
  const seen = new Set<string>();
  for (const o of all) {
    const line = o.node.kind === "geometry" ? raw(o) : "";
    // Official parts and raw faces depend only on their source and placement; project
    // definitions can change underneath the same reference, so they are not cached.
    const key =
      cache && (line || !Object.hasOwn(project.models, o.node.ref))
        ? `${o.node.kind}|${o.node.ref}|${line}|${o.transform.position}|${o.transform.basis}`
        : "";
    const hit = key ? cache!.get(o.id) : undefined;
    seen.add(o.id);
    if (hit && hit.key === key) {
      bottoms.set(o.id, hit.bottom);
      continue;
    }
    let local: Bounds | null = null;
    try {
      sources ??= projectBounds(
        project,
        installedBounds.bounds as unknown as Record<string, Bounds | null>,
        installedBounds.dependencies.transitive,
      );
      local =
        o.node.kind === "geometry"
          ? sources.primitive(line)
          : sources.model(o.node.ref);
    } catch {
      local = null;
    }
    const bottom = local
      ? transformBounds(local, o.transform).max[1]
      : o.transform.position[1];
    bottoms.set(o.id, bottom);
    if (key) cache!.set(o.id, { key, bottom });
  }
  if (cache) for (const id of cache.keys()) if (!seen.has(id)) cache.delete(id);
  return bottoms;
}
/** Candidate floor groups: the root's top-level submodels, else layers. */
function floorGroups(all: Occurrence[]) {
  const byNode = new Map<string, Occurrence[]>();
  for (const o of all) {
    if (o.path.length < 2) continue;
    byNode.set(o.path[0], [...(byNode.get(o.path[0]) ?? []), o]);
  }
  let groups = [...byNode.values()];
  if (groups.length < 2) {
    const byLayer = new Map<string, Occurrence[]>();
    for (const o of all)
      byLayer.set(o.layerId, [...(byLayer.get(o.layerId) ?? []), o]);
    groups = [...byLayer.values()];
  }
  return groups;
}
const LEVEL_MERGE = 24;
/** Floor levels from the bottoms of significant groups (≥ 2% of parts), merged within a
 * brick, bottom-up. Shared by exploded views and floor detection. */
export function floorLevels(project: Project) {
  const all = occurrences(project);
  const groups = floorGroups(all);
  if (groups.length < 2)
    return { all, groups, levels: [] as number[], bottom: () => 0 };
  const bottoms = occurrenceBottoms(project, all);
  const groupBottom = new Map(
    groups.map((g) => [g, Math.max(...g.map((o) => bottoms.get(o.id)!))]),
  );
  const bottom = (g: Occurrence[]) => groupBottom.get(g)!;
  const significant = Math.max(1, Math.ceil(all.length * 0.02));
  const levels: number[] = [];
  for (const y of groups
    .filter((g) => g.length >= significant)
    .map(bottom)
    .sort((x, y) => y - x))
    if (!levels.length || levels.at(-1)! - y > LEVEL_MERGE) levels.push(y);
  return { all, groups, levels, bottom };
}
/** Group occurrences into floors for an exploded view. Every group is lifted by the index
 * of the highest level it rests on × gap, so walls, windows and furniture travel with
 * their floor. `levels` are the bottom-up LDraw heights the lifts were derived from. */
export function explodeLifts(project: Project, gap: number) {
  const { groups, levels, bottom } = floorLevels(project);
  const lifts = new Map<string, number>();
  if (levels.length < 2) return { lifts, groups: 0, levels: [] as number[] };
  for (const g of groups) {
    const b = bottom(g);
    let floor = 0;
    levels.forEach((level, i) => {
      if (b <= level + LEVEL_MERGE) floor = i;
    });
    if (floor) for (const o of g) lifts.set(o.id, floor * gap);
  }
  return { lifts, groups: levels.length, levels };
}
/** Exploded lift of an arbitrary LDraw height (for guides and labels). */
export function liftAt(y: number, levels: readonly number[], gap: number) {
  let floor = 0;
  levels.forEach((level, i) => {
    if (y <= level + LEVEL_MERGE) floor = i;
  });
  return floor * gap;
}
/** Suggested floors from the same clustering as the exploded view. One detected level
 * is still a useful ground floor. Names run Ground floor, Floor 1, … */
export function detectFloors(project: Project): FloorGuide[] {
  const { levels, all } = floorLevels(project);
  // Without separable floor groups, the model's lowest point is its ground floor.
  const found = levels.length
    ? levels
    : all.length
      ? [Math.max(...occurrenceBottoms(project, all).values())]
      : [];
  return found.map((y, i) => ({
    id: `floor-${i}`,
    name: i === 0 ? "Ground floor" : `Floor ${i}`,
    y: Math.round(y * 1e4) / 1e4,
  }));
}
/** Occurrences per floor: index into the bottom-up floors, −1 below the lowest. */
export function floorAssignments(
  project: Project,
  floors: readonly FloorGuide[] = architectureOf(project).floors,
  bottoms = occurrenceBottoms(project),
) {
  const sorted = sortedFloors(floors);
  const byId = new Map<string, number>();
  for (const [id, y] of bottoms) byId.set(id, floorIndex(y, sorted));
  return { floors: sorted, byId };
}
/** Show one floor: everything resting on higher floors is hidden; lower floors (and parts
 * below the lowest floor) are ghosted when requested. Nothing is deleted or reordered. */
export function floorFocusSets(
  project: Project,
  focus: FloorFocus,
  bottoms?: Map<string, number>,
) {
  const { floors, byId } = floorAssignments(
    project,
    architectureOf(project).floors,
    bottoms,
  );
  const index = floors.findIndex((f) => f.id === focus.floorId);
  const hidden = new Set<string>(),
    ghosted = new Set<string>();
  if (index < 0) return { index, hidden, ghosted };
  for (const [id, floor] of byId) {
    if (floor > index) hidden.add(id);
    else if (floor < index && focus.ghostBelow) ghosted.add(id);
  }
  return { index, hidden, ghosted };
}
/** Summary for automation: floors bottom-up with part counts and room labels. */
export function floorReport(project: Project) {
  const a = architectureOf(project);
  const { floors, byId } = floorAssignments(project);
  const counts = new Map<number, number>();
  for (const i of byId.values()) counts.set(i, (counts.get(i) ?? 0) + 1);
  return {
    floors: floors.map((floor, i) => ({
      ...floor,
      parts: counts.get(i) ?? 0,
      labels: a.labels.filter((l) => l.floorId === floor.id).length,
    })),
    belowLowestFloor: counts.get(-1) ?? 0,
    labels: a.labels,
    views: a.views,
    detected: detectFloors(project),
  };
}
