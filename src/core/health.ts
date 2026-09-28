import installedBounds from "../catalog/bounds.json";
import { catalog } from "../catalog/catalog";
import { occurrences } from "./document";
import { transformBounds, type Bounds } from "./spatial";
import type { Occurrence, Project } from "./types";

/** Model-health report (spec §20.3). Each check says how certain it is. */
export type HealthStatus = "ok" | "warning" | "unknown";
export type HealthCheck = {
  id:
    | "missing-definitions"
    | "unsupported-rendering"
    | "connectivity"
    | "collisions"
    | "assemblies"
    | "instruction-omissions";
  status: HealthStatus;
  title: string;
  detail: string;
  /** How the result was obtained; "approximate" and "not-verified" are never exact claims. */
  basis: "exact" | "approximate" | "not-verified";
  occurrenceIds: string[];
  count: number;
};
export type HealthReport = {
  schemaVersion: 1;
  revision: number;
  parts: number;
  checks: HealthCheck[];
};

const STUD = 4; // LDU a stud row rises above a brick or plate top.
const TOLERANCE = 0.5; // LDU of overlap ignored as numeric noise.
const MAX_BOX_PARTS = 20000;

function isUprightAxisAligned(o: Occurrence) {
  const b = o.transform.basis;
  const offDiagonal = [b[1], b[3], b[5], b[7]];
  // Rotations by multiples of 90° about the vertical axis keep boxes axis aligned.
  return (
    Math.abs(b[4] - 1) < 1e-6 &&
    offDiagonal.every((v) => Math.abs(v) < 1e-6) &&
    ((Math.abs(Math.abs(b[0]) - 1) < 1e-6 && Math.abs(b[2]) < 1e-6) ||
      (Math.abs(b[0]) < 1e-6 && Math.abs(Math.abs(b[2]) - 1) < 1e-6))
  );
}

/** Body box: the part's box without its top stud row (LDraw −Y is up). */
function bodyBox(o: Occurrence): Bounds | null {
  const local = (
    installedBounds.bounds as unknown as Record<string, Bounds | null>
  )[o.node.ref];
  if (!local) return null;
  const body: Bounds = {
    min: [local.min[0], local.min[1] + STUD, local.min[2]],
    max: [...local.max],
  };
  return transformBounds(body, o.transform);
}
function fullBox(o: Occurrence): Bounds | null {
  const local = (
    installedBounds.bounds as unknown as Record<string, Bounds | null>
  )[o.node.ref];
  return local ? transformBounds(local, o.transform) : null;
}
const overlaps = (a: Bounds, b: Bounds, margin: number) =>
  [0, 1, 2].every(
    (i) => Math.min(a.max[i], b.max[i]) - Math.max(a.min[i], b.min[i]) > margin,
  );

/** Uniform-grid broad phase over boxes; returns candidate index pairs. */
function candidatePairs(boxes: Bounds[], cell = 80) {
  const grid = new Map<string, number[]>();
  const pairs = new Set<string>();
  boxes.forEach((b, i) => {
    const lo = b.min.map((v) => Math.floor(v / cell)),
      hi = b.max.map((v) => Math.floor(v / cell));
    for (let x = lo[0]; x <= hi[0]; x++)
      for (let y = lo[1]; y <= hi[1]; y++)
        for (let z = lo[2]; z <= hi[2]; z++) {
          const key = x + "," + y + "," + z;
          const list = grid.get(key) ?? [];
          for (const j of list) pairs.add(j < i ? j + ":" + i : i + ":" + j);
          list.push(i);
          grid.set(key, list);
        }
  });
  return [...pairs].map((p) => p.split(":").map(Number) as [number, number]);
}

export function modelHealth(project: Project): HealthReport {
  const all = occurrences(project);
  const checks: HealthCheck[] = [];

  const missing = all.filter((o) => o.namespace === "missing");
  const refs = [...new Set(missing.map((o) => o.node.ref))];
  checks.push({
    id: "missing-definitions",
    status: missing.length ? "warning" : "ok",
    title: "Part definitions",
    detail: missing.length
      ? `${missing.length} part${missing.length === 1 ? "" : "s"} use ${refs.length} definition${refs.length === 1 ? "" : "s"} not in the library or project (${refs.slice(0, 5).join(", ")}${refs.length > 5 ? "…" : ""}).`
      : "Every part has a definition.",
    basis: "exact",
    occurrenceIds: missing.map((o) => o.id),
    count: missing.length,
  });

  const unsupported = project.diagnostics.filter(
    (d) => d.code === "UNSUPPORTED_RENDER_FEATURE",
  );
  checks.push({
    id: "unsupported-rendering",
    status: unsupported.length ? "warning" : "ok",
    title: "Rendering features",
    detail: unsupported.length
      ? unsupported
          .slice(0, 3)
          .map((d) => d.message)
          .join(" ")
      : "No unsupported rendering features were found in the source.",
    basis: "exact",
    occurrenceIds: [...new Set(unsupported.flatMap((d) => d.occurrenceIds))],
    count: unsupported.length,
  });

  checks.push({
    id: "connectivity",
    status: "unknown",
    title: "Connections",
    detail: Object.values(catalog).some((p) => p.snapVerified)
      ? "Only some parts have verified connector data; connections are not checked."
      : "No part has verified connector data yet, so whether parts are actually connected is not checked.",
    basis: "not-verified",
    occurrenceIds: [],
    count: 0,
  });

  // Collisions and loose groups use catalogue boxes for upright parts only.
  const boxed = all
    .filter(
      (o) =>
        o.namespace === "official" &&
        o.node.kind === "part" &&
        isUprightAxisAligned(o) &&
        fullBox(o),
    )
    .slice(0, MAX_BOX_PARTS);
  const skipped = all.length - boxed.length;
  // Nothing measurable is not the same as nothing wrong.
  const noneChecked = boxed.length === 0 && all.length > 0;
  const bodies = boxed.map((o) => bodyBox(o)!);
  const full = boxed.map((o) => fullBox(o)!);
  const colliding = new Set<number>();
  const parent = boxed.map((_, i) => i);
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i]));
  let collisionPairs = 0;
  for (const [i, j] of candidatePairs(full)) {
    if (overlaps(bodies[i], bodies[j], TOLERANCE)) {
      collisionPairs++;
      colliding.add(i).add(j);
    }
    // Touching (including a stud row resting in the part above) joins a group.
    if (overlaps(full[i], full[j], -TOLERANCE)) parent[find(i)] = find(j);
  }
  const scope =
    skipped > 0
      ? ` ${skipped} raw, custom, tilted or unmapped part${skipped === 1 ? " was" : "s were"} not checked.`
      : "";
  checks.push({
    id: "collisions",
    status: collisionPairs ? "warning" : noneChecked ? "unknown" : "ok",
    title: "Overlapping parts",
    detail:
      (collisionPairs
        ? `${colliding.size} parts overlap in ${collisionPairs} place${collisionPairs === 1 ? "" : "s"} (part bodies intersect; studs sitting in the part above are allowed).`
        : noneChecked
          ? "Not checked."
          : "No overlapping part bodies.") + scope,
    basis: "approximate",
    occurrenceIds: [...colliding].map((i) => boxed[i].id),
    count: collisionPairs,
  });
  const groups = new Map<number, string[]>();
  boxed.forEach((o, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), o.id]);
  });
  const sorted = [...groups.values()].sort((a, b) => b.length - a.length);
  const loose = sorted.slice(1).flat();
  checks.push({
    id: "assemblies",
    status: sorted.length > 1 ? "warning" : noneChecked ? "unknown" : "ok",
    title: "Separate groups",
    detail:
      (sorted.length > 1
        ? `${sorted.length} separate groups of touching parts; ${loose.length} part${loose.length === 1 ? "" : "s"} are not touching the largest group.`
        : boxed.length
          ? "All checked parts touch one group."
          : noneChecked
            ? "Not checked."
            : "No parts to check.") +
      " Based on touching part boxes, not verified connections." +
      scope,
    basis: "approximate",
    occurrenceIds: loose,
    count: Math.max(0, sorted.length - 1),
  });

  const ids = new Set(all.map((o) => o.id));
  const omitted: string[] = [];
  const stale: string[] = [];
  const plans = Object.values(project.instructionPlans);
  for (const plan of plans) {
    const placed = new Set(plan.steps.flat());
    for (const id of placed) if (!ids.has(id)) stale.push(id);
    for (const o of all) if (!placed.has(o.id)) omitted.push(o.id);
  }
  const uniqueOmitted = [...new Set(omitted)];
  checks.push({
    id: "instruction-omissions",
    status:
      plans.length && (uniqueOmitted.length || stale.length) ? "warning" : "ok",
    title: "Instruction plans",
    detail: !plans.length
      ? "No instruction plan yet."
      : uniqueOmitted.length || stale.length
        ? `${uniqueOmitted.length} part${uniqueOmitted.length === 1 ? " is" : "s are"} missing from ${plans.length === 1 ? "the plan" : "at least one plan"}${stale.length ? `; ${stale.length} step entr${stale.length === 1 ? "y points" : "ies point"} at parts that no longer exist` : ""}.`
        : `Every part appears in ${plans.length === 1 ? "the plan" : "every plan"}.`,
    basis: "exact",
    occurrenceIds: uniqueOmitted,
    count: uniqueOmitted.length + stale.length,
  });

  return {
    schemaVersion: 1,
    revision: project.revision,
    parts: all.length,
    checks,
  };
}
