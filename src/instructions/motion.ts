import {
  createInsertionEngine,
  insertionFingerprint,
  type SurfacePath,
} from "./collision";
import { AXIAL_PROFILES } from "./axial";
import { worldConnectors } from "../core/connectivity";
import { mv } from "../core/math";
import type {
  InstructionPlan,
  InstructionStepMetadata,
  Occurrence,
  Project,
  Vec3,
} from "../core/types";
type Item = {
  index: number;
  o: Occurrence;
  ids: string[];
  component?: unknown;
  supports: Set<number>;
  hosts: Set<number>;
  access: Set<number>;
};
type Checks = NonNullable<InstructionStepMetadata["insertionChecks"]>;
export function insertionBadge(checks: Checks | undefined) {
  if (!checks?.length) return "";
  const labels = (["clear", "blocked", "unknown"] as const).flatMap(
    (status) => {
      const n = checks.filter((c) => c.status === status).length;
      return n ? [n + " " + (status === "blocked" ? "crossing" : status)] : [];
    },
  );
  return (
    "CAD approach: " +
    labels.join(", ") +
    (checks.every((c) => c.status === "unknown")
      ? ". No checked route; physical fit unverified."
      : ". Contact allowances apply; physical fit unverified.")
  );
}

export function insertionSummary(checks: Checks | undefined) {
  if (!checks?.length) return "";
  const n = (status: Checks[number]["status"]) =>
    checks.filter((c) => c.status === status).length;
  const bits = [];
  if (n("clear"))
    bits.push(
      `${n("clear")} checked straight CAD approach${n("clear") === 1 ? "" : "es"}; contact allowances apply. Physical fit unverified.`,
    );
  if (n("blocked"))
    bits.push(
      `${n("blocked")} CAD surface crossing${n("blocked") === 1 ? "" : "s"}. Keep required receivers/supports; review alignment or another motion. Physical fit undetermined.`,
    );
  if (n("unknown"))
    bits.push(
      `${n("unknown")} approach${n("unknown") === 1 ? "" : "es"} unknown; review this placement.`,
    );
  return bits.join(" ");
}
export const insertionChecksCurrent = (
  project: Project,
  plan: InstructionPlan,
) =>
  (plan.generation?.insertionFingerprint ??
    plan.refinement?.insertionFingerprint) ===
  insertionFingerprint(project, plan);

/** Compute validity once when preparing a whole guide/publication. */
export function insertionCheckReader(project: Project, plan: InstructionPlan) {
  const valid = insertionChecksCurrent(project, plan);
  return (meta?: InstructionStepMetadata): Checks | undefined => {
    const checks = meta?.insertionChecks;
    if (!checks || valid) return checks;
    return checks.map((c) => ({
      occurrenceIds: c.occurrenceIds,
      status: "unknown",
      scope: c.scope,
      reason:
        "Model geometry, programme or its pinned pack changed; regenerate the approach checks.",
    }));
  };
}
export function effectiveInsertionChecks(
  project: Project,
  plan: InstructionPlan,
  meta?: InstructionStepMetadata,
): Checks | undefined {
  if (!meta?.insertionChecks) return;
  return insertionCheckReader(project, plan)(meta);
}
export function insertionPlanning(
  project: Project,
  all: Occurrence[],
  items: Item[],
) {
  const engine = createInsertionEngine(project, all),
    byId = new Map(items.flatMap((i) => i.ids.map((id) => [id, i] as const)));
  const directions = (item: Item): Vec3[] => {
    if (
      item.component ||
      item.o.namespace !== "official" ||
      item.o.node.kind !== "part"
    )
      return [];
    const profile = Object.hasOwn(AXIAL_PROFILES, item.o.node.ref)
      ? AXIAL_PROFILES[item.o.node.ref]
      : undefined;
    if (profile) {
      const a = mv(item.o.transform.basis, profile.axis);
      return [a, a.map((v) => -v) as Vec3];
    }
    const cs = worldConnectors(item.o);
    if (!cs || cs.some((c) => c.kind === "pin" || c.kind === "socket"))
      return [];
    const result: Vec3[] = [];
    for (const c of cs.filter((c) => c.kind === "antistud")) {
      const d = c.axis.map((v) => -v) as Vec3;
      if (!result.some((x) => Math.hypot(...x.map((v, a) => v - d[a])) < 0.01))
        result.push(d);
    }
    return result.slice(0, 2);
  };
  const select = (paths: SurfacePath[]) =>
    [...paths].sort((a, b) => {
      const rank = { clear: 0, unknown: 1, blocked: 2 };
      return (
        rank[a.status] - rank[b.status] || a.blockers.length - b.blockers.length
      );
    })[0];
  const edges = items.map(() => new Set<number>()),
    conflicts = new Set<number>();
  let precedences = 0,
    graphWork = 0;
  const requires = (from: number, on: number) => {
    const q = [from],
      seen = new Set<number>();
    for (let n = 0; n < q.length; n++) {
      if (++graphWork > 200000) return true;
      const i = q[n];
      if (i === on) return true;
      if (seen.has(i)) continue;
      seen.add(i);
      q.push(
        ...items[i].supports,
        ...items[i].hosts,
        ...items[i].access,
        ...edges[i],
      );
    }
    return false;
  };
  const ids = all.map((o) => o.id);
  for (const item of items) {
    const path = select(engine.check(item.ids, ids, directions(item)));
    if (path?.status !== "blocked" || path.uncertain.length) continue;
    const blockers = [
      ...new Set(path.blockers.map((id) => byId.get(id)!.index)),
    ].filter((n) => n !== item.index);
    if (blockers.some((n) => requires(item.index, n))) {
      conflicts.add(item.index);
      continue;
    }
    for (const n of blockers) {
      if (!edges[n].has(item.index)) precedences++;
      edges[n].add(item.index);
    }
  }
  engine.beginReplay();
  const check = (
    movingIds: string[],
    obstacles: string[],
    dir?: Vec3[],
  ): Checks[number] => {
    const item = byId.get(movingIds[0]);
    const path = select(
      engine.check(movingIds, obstacles, dir ?? (item ? directions(item) : [])),
    );
    const result: Checks[number] = {
      occurrenceIds: [...movingIds],
      status: path?.status ?? "unknown",
      scope: "cad-surface-translation",
    };
    if (path && Number.isFinite(path.distance) && path.distance > 0) {
      const to = item!.o.transform.position;
      result.to = [...to];
      result.from = to.map(
        (v, a) => v + path.outward[a] * path.distance,
      ) as Vec3;
      if (path.blockers.length) result.blockerIds = path.blockers.slice(0, 16);
      result.reason =
        path.reason ??
        (path.uncertain.length
          ? "Some nearby geometry could not be checked."
          : undefined);
    } else
      result.reason =
        path?.reason ??
        "This operation requires a motion or part family outside the supported rigid straight approaches.";
    return result;
  };
  const groupDirections = (moving: string[]) => {
    const out: Vec3[] = [];
    for (const id of moving) {
      const item = byId.get(id);
      if (!item || item.component) return [];
      for (const d of directions(item))
        if (!out.some((x) => Math.hypot(...x.map((v, a) => v - d[a])) < 0.01))
          out.push(d);
    }
    // Try at most two connector-derived straight directions for the entire
    // rigid group; these are candidate translations, not inferred rotations.
    return out.slice(0, 2);
  };
  return {
    edges,
    conflicts,
    precedences,
    check,
    groupDirections,
    fingerprint: insertionFingerprint(project),
    stats: engine.stats,
    dispose: engine.dispose,
  };
}
