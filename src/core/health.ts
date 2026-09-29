import installedBounds from "../catalog/bounds.json";
import { connectedGroups, connectionGraph } from "./connectivity";
import { occurrences } from "./document";
import { transformBounds, type Bounds } from "./spatial";
import { compose, inverse } from "./math";
import { partOccupancy } from "../catalog/connectors";
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
// Derived occupancy widens faces thinner than 0.6 LDU to 0.6 (CONNECTORS.md).
const OCCUPANCY_TOLERANCE = 0.65;
/** Window glass sits in its frame's groove, sharing the frame's origin. */
const GLAZING: Record<string, string> = {
  "60601.dat": "60592.dat",
  "60602.dat": "60593.dat",
  "60603.dat": "60594.dat",
};
/** Door frames' hinge collars stand a stud high above the top face and sit
 * in the underside of the part above, as studs do. */
const COLLARS = new Set(["60596.dat", "60599.dat"]);
/** Derived occupancy boxes of a catalogue part, when the pack has them. */
function occupancy(ref: string) {
  const boxes = partOccupancy(ref);
  return boxes && COLLARS.has(ref) ? boxes.filter((b) => b.max[1] > 0) : boxes;
}
const glazed = (a: Occurrence, b: Occurrence) => {
  const pair = (x: Occurrence, y: Occurrence) =>
    GLAZING[x.node.ref] === y.node.ref &&
    x.transform.position.every(
      (v, i) => Math.abs(v - y.transform.position[i]) < 1e-3,
    );
  return pair(a, b) || pair(b, a);
};
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

  // Connections from verified stud and hinge data (docs/CONNECTORS.md).
  const graph = connectionGraph(project, all);
  const covered = graph.covered.length,
    uncovered = graph.uncovered.length;
  const connected = connectedGroups(graph);
  const floating = graph.covered.filter((id) => !graph.edges.get(id)!.size);
  const studs = graph.contacts - graph.hingeContacts;
  const unverifiedNote = uncovered
    ? ` ${uncovered} part${uncovered === 1 ? " has" : "s have"} no verified connector data (custom, tilted or not yet verified); ${uncovered === 1 ? "it" : "they"} may join these groups.`
    : "";
  checks.push(
    covered === 0
      ? {
          id: "connectivity",
          status: "unknown",
          title: "Connections",
          detail: all.length
            ? "No part in this model has verified connector data, so whether parts are actually connected is not checked."
            : "No parts to check.",
          basis: "not-verified",
          occurrenceIds: [],
          count: 0,
        }
      : {
          id: "connectivity",
          status: connected.length > 1 ? "warning" : "ok",
          title: "Connections",
          detail:
            (connected.length > 1
              ? `${covered} part${covered === 1 ? "" : "s"} with verified connectors form ${connected.length} separately connected groups; ${floating.length} part${floating.length === 1 ? " is" : "s are"} not connected to anything.`
              : covered === 1
                ? "One part with verified connectors."
                : `All ${covered} parts with verified connectors are connected (${studs} stud connection${studs === 1 ? "" : "s"}${graph.hingeContacts ? `, ${graph.hingeContacts} hinge pin${graph.hingeContacts === 1 ? "" : "s"}` : ""}).`) +
            unverifiedNote,
          // Uncovered parts can bridge groups, so only full coverage is exact.
          basis: uncovered ? "approximate" : "exact",
          occurrenceIds: connected.slice(1).flat(),
          count: Math.max(0, connected.length - 1),
        },
  );

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
  const shapes = boxed.map((o) => occupancy(o.node.ref));
  /** Bodies meet: by derived occupancy when both parts have it (exact for
   * these quarter-turn placements), else by their boxes. */
  const clash = (i: number, j: number) => {
    if (!overlaps(bodies[i], bodies[j], TOLERANCE)) return false;
    if (glazed(boxed[i], boxed[j])) return false;
    // Parts joined by a verified connection (a door's pins in its frame's
    // sockets, a stud in its receptor) are seated, not intersecting.
    if (graph.edges.get(boxed[i].id)?.has(boxed[j].id)) return false;
    const a = shapes[i],
      b = shapes[j];
    if (!a || !b) return true;
    const rel = compose(inverse(boxed[j].transform), boxed[i].transform);
    return a.some((box) => {
      const t = transformBounds(box, rel);
      return b.some((other) => overlaps(t, other, OCCUPANCY_TOLERANCE));
    });
  };
  const colliding = new Set<number>();
  const parent = boxed.map((_, i) => i);
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i]));
  let collisionPairs = 0,
    boxedPairs = 0;
  for (const [i, j] of candidatePairs(full)) {
    if (clash(i, j)) {
      collisionPairs++;
      if (!shapes[i] || !shapes[j]) boxedPairs++;
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
        ? `${colliding.size} parts overlap in ${collisionPairs} place${collisionPairs === 1 ? "" : "s"} (part bodies intersect; studs sitting in the part above are allowed).` +
          (boxedPairs
            ? ` ${boxedPairs === collisionPairs ? "All" : boxedPairs} of these involve parts without derived shape data, compared by their outer boxes; parts that nest by design, such as wheels under a mudguard or a flag on its pole, show up this way.`
            : "")
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
