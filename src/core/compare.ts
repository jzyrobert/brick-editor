import { occurrences } from "./document";
import type { Occurrence, Project } from "./types";

export type ChangeKind =
  | "added"
  | "removed"
  | "moved"
  | "recoloured"
  | "relayered"
  | "replaced";
export type OccurrenceChange = {
  id: string;
  kinds: ChangeKind[];
  ref: string;
  before?: {
    ref: string;
    colorCode: string;
    layerId: string;
    position: number[];
  };
  after?: {
    ref: string;
    colorCode: string;
    layerId: string;
    position: number[];
  };
};
export type ChangeReport = {
  schemaVersion: 1;
  beforeRevision: number;
  afterRevision: number;
  counts: Record<ChangeKind, number> & { unchanged: number; total: number };
  changes: OccurrenceChange[];
  /** Occurrence IDs are source paths: edits that make a shared submodel unique, or
   * regroup parts, change IDs and therefore read as removed + added. */
  identity: "source-path";
};

const EPSILON = 1e-6;
function sameTransform(a: Occurrence, b: Occurrence) {
  const pa = [...a.transform.position, ...a.transform.basis],
    pb = [...b.transform.position, ...b.transform.basis];
  return pa.every((v, i) => Math.abs(v - pb[i]) <= EPSILON);
}
const summary = (o: Occurrence) => ({
  ref: o.node.kind === "geometry" ? "raw geometry" : o.node.ref,
  colorCode: o.colorCode,
  layerId: o.layerId,
  position: o.transform.position.map((v) => Math.round(v * 1e4) / 1e4),
});

/** Occurrence-level comparison between two revisions of a project (spec §20). */
export function compareProjects(
  before: Project,
  after: Project,
  options: { maxChanges?: number } = {},
): ChangeReport {
  const maxChanges = options.maxChanges ?? 10000;
  const was = new Map(occurrences(before).map((o) => [o.id, o]));
  const now = occurrences(after);
  const counts = {
    added: 0,
    removed: 0,
    moved: 0,
    recoloured: 0,
    relayered: 0,
    replaced: 0,
    unchanged: 0,
    total: now.length,
  };
  const changes: OccurrenceChange[] = [];
  const push = (change: OccurrenceChange) => {
    if (changes.length < maxChanges) changes.push(change);
  };
  for (const o of now) {
    const old = was.get(o.id);
    if (!old) {
      counts.added++;
      push({
        id: o.id,
        kinds: ["added"],
        ref: summary(o).ref,
        after: summary(o),
      });
      continue;
    }
    was.delete(o.id);
    const kinds: ChangeKind[] = [];
    if (old.node.ref !== o.node.ref || old.node.kind !== o.node.kind)
      kinds.push("replaced");
    if (!sameTransform(old, o)) kinds.push("moved");
    if (old.colorCode !== o.colorCode) kinds.push("recoloured");
    if (old.layerId !== o.layerId) kinds.push("relayered");
    if (!kinds.length) {
      counts.unchanged++;
      continue;
    }
    for (const k of kinds) counts[k]++;
    push({
      id: o.id,
      kinds,
      ref: summary(o).ref,
      before: summary(old),
      after: summary(o),
    });
  }
  for (const [id, old] of was) {
    counts.removed++;
    push({
      id,
      kinds: ["removed"],
      ref: summary(old).ref,
      before: summary(old),
    });
  }
  return {
    schemaVersion: 1,
    beforeRevision: before.revision,
    afterRevision: after.revision,
    counts,
    changes,
    identity: "source-path",
  };
}

/** Occurrences in `after` worth highlighting: everything that exists and changed. */
export function changedOccurrenceIds(report: ChangeReport) {
  return report.changes
    .filter((c) => !c.kinds.includes("removed"))
    .map((c) => c.id);
}
