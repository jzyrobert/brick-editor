/**
 * Build checks for the template builds (used by scripts/build-templates.ts and
 * the unit tests; not part of the app bundle).
 *
 * - Overlaps: every pair of parts is compared by derived occupancy boxes
 *   (docs/CONNECTORS.md) when both have them, else by source bounds without
 *   the stud row. Window glass in its own frame and a door leaf on its
 *   frame's hinge pins share space by design and are exempt.
 * - Grid: every upright part sits at a whole plate level and on the stud
 *   grid (or half a stud off it for round parts centred between studs).
 * - Connectivity: verified stud/hinge connections, as the health check.
 */
import installedBounds from "../bounds.json";
import { occurrences } from "../../core/document";
import { connectedGroups, connectionGraph } from "../../core/connectivity";
import { modelHealth, withoutLooseObjects } from "../../core/health";
import { transformBounds, type Bounds } from "../../core/spatial";
import { compose, inverse } from "../../core/math";
import { localOccupancy } from "../../edit/snap";
import { hingeData } from "../connectors";
import { FULL_LIBRARY_BOUNDS } from "./kit";
import { TRAIN_TRACK_PARTS, onRails, trainPartKey } from "../train-parts";
import { deriveTrains, occurrenceBounds } from "../../play/trains";
import type { Occurrence, Project } from "../../core/types";

// Derived occupancy widens thin faces to 0.6 LDU; ignore overlaps up to that.
const MARGIN = 0.65;
const GLASS: Record<string, string> = {
  "60601.dat": "60592.dat",
  "60602.dat": "60593.dat",
  "60603.dat": "60594.dat",
};
const DOORS: Record<string, string[]> = {
  "60616a.dat": ["60596.dat", "60599.dat", "30179.dat"],
  "60616b.dat": ["60596.dat", "60599.dat", "30179.dat"],
  "60623.dat": ["60596.dat", "60599.dat", "30179.dat"],
};
/** Wheels and tyres turn on wheel pins, off the stud grid. */
const AXLED = new Set(["4624.dat", "3641.dat", "6014b.dat", "56890.dat"]);
/**
 * Parts that nest by design: a flag's clips close round its bar; a wheel rim
 * sits on its holder's pin, a tyre on its rim, and both turn under the car
 * mudguard's arch (the standard official combination 4600 + 4624 + 3641 +
 * 3788, whose round clearances are finer than the 4 × 20 LDU occupancy cells).
 */
const CLIPPED: Record<string, string[]> = {
  "2335.dat": ["3957a.dat"],
  "4624.dat": ["4600.dat", "3641.dat", "3788.dat"],
  "3641.dat": ["4600.dat", "3788.dat"],
  // The jeep: Wheel Rim 12 × 11 (6014b) on the same wheel holder, its
  // balloon tyre (56890) on the rim, both under Car Mudguard 50745's arch.
  "6014b.dat": ["4600.dat", "56890.dat", "50745.dat"],
  "56890.dat": ["4600.dat", "50745.dat"],
};
const overlaps = (a: Bounds, b: Bounds) =>
  [0, 1, 2].every(
    (i) => Math.min(a.max[i], b.max[i]) - Math.max(a.min[i], b.min[i]) > MARGIN,
  );
const bounds = installedBounds.bounds as unknown as Record<
  string,
  Bounds | null
>;
/** Door frames' hinge collars (parts with derived hinge sockets) stand a stud
 * high above the top face and sit in the underside cavity of the part above,
 * like studs. */
function body(ref: string, extra: Record<string, Bounds[]>): Bounds[] | null {
  if (Object.hasOwn(extra, ref)) return extra[ref];
  const own = localOccupancy(ref);
  if (own)
    return hingeData(ref)?.sockets ? own.filter((b) => b.max[1] > 0) : own;
  const b = FULL_LIBRARY_BOUNDS[ref];
  return b ? [{ min: [b.min[0], b.min[1] + 4, b.min[2]], max: b.max }] : null;
}
const exempt = (a: Occurrence, b: Occurrence) => {
  const pair = (x: Occurrence, y: Occurrence) =>
    (GLASS[x.node.ref] === y.node.ref ||
      DOORS[x.node.ref]?.includes(y.node.ref) ||
      CLIPPED[x.node.ref]?.includes(y.node.ref)) &&
    Math.hypot(
      x.transform.position[0] - y.transform.position[0],
      x.transform.position[2] - y.transform.position[2],
    ) < 40;
  return pair(a, b) || pair(b, a) || onRails(a.node.ref, b.node.ref);
};

export type BuildReport = {
  parts: number;
  refs: Record<string, number>;
  overlaps: [string, string][];
  offGrid: string[];
  unmeasured: string[];
  groups: number;
  /** Occurrence IDs of each verified connection group. */
  groupMembers: string[][];
  covered: number;
  uncovered: number;
  studContacts: number;
  hingeContacts: number;
  health: ReturnType<typeof modelHealth>;
};

/**
 * `baseY`: the build's reference plane (a car's chassis floats above y = 0).
 * `occupancy`: derived occupancy boxes for parts outside the catalogue pack
 * (scripts/full-library-node.ts derives them from the complete library).
 */
export function checkBuild(
  project: Project,
  options: {
    baseY?: number;
    occupancy?: Record<string, Bounds[]>;
    /** The project's occurrences, when the caller already has them. */
    occurrences?: Occurrence[];
  } = {},
): BuildReport {
  const baseY = options.baseY ?? 0,
    extra = options.occupancy ?? {};
  const all = options.occurrences ?? occurrences(project);
  const refs: Record<string, number> = {};
  for (const o of all) refs[o.node.ref] = (refs[o.node.ref] ?? 0) + 1;
  const measured: { o: Occurrence; boxes: Bounds[]; world: Bounds }[] = [];
  const unmeasured: string[] = [];
  for (const o of all) {
    const boxes = body(o.node.ref, extra);
    if (!boxes) {
      unmeasured.push(o.node.ref);
      continue;
    }
    const world = boxes
      .map((b) => transformBounds(b, o.transform))
      .reduce((u, b) => ({
        min: u.min.map((v, i) => Math.min(v, b.min[i])) as Bounds["min"],
        max: u.max.map((v, i) => Math.max(v, b.max[i])) as Bounds["max"],
      }));
    measured.push({ o, boxes, world });
  }
  const found: [string, string][] = [];
  // Sweep along x: only parts whose x ranges meet are compared (pairs in
  // the same order as a full pairwise scan, so reports are unchanged).
  const order = measured
    .map((m, i) => ({ m, i }))
    .sort((a, b) => a.m.world.min[0] - b.m.world.min[0] || a.i - b.i);
  const pairs: [number, number][] = [];
  for (let s = 0; s < order.length; s++)
    for (let t = s + 1; t < order.length; t++) {
      if (order[t].m.world.min[0] >= order[s].m.world.max[0] - MARGIN) break;
      const i = Math.min(order[s].i, order[t].i),
        j = Math.max(order[s].i, order[t].i);
      pairs.push([i, j]);
    }
  pairs.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  for (const [i, j] of pairs) {
    const a = measured[i],
      b = measured[j];
    if (!overlaps(a.world, b.world) || exempt(a.o, b.o)) continue;
    const rel = compose(inverse(b.o.transform), a.o.transform);
    const clash = a.boxes.some((box) => {
      const t = transformBounds(box, rel);
      return b.boxes.some((other) => overlaps(t, other));
    });
    if (clash) found.push([a.o.id, b.o.id]);
  }
  // Track follows its own curves and rail vehicles stand on their wheels
  // on the rails, off the stud grid by design.
  const rolling = new Set(
    deriveTrains({
      all,
      reserved: new Set(),
      bounds: occurrenceBounds(project),
    }).occurrenceIds,
  );
  const offGrid = all
    .filter((o) => {
      const [x, y, z] = o.transform.position;
      // Door leaves hang on their frame's hinge pins, off the stud grid, and
      // parts turned onto side studs follow those studs.
      if (
        !bounds[o.node.ref] ||
        DOORS[o.node.ref] ||
        AXLED.has(o.node.ref) ||
        rolling.has(o.id) ||
        TRAIN_TRACK_PARTS.has(trainPartKey(o.node.ref))
      )
        return false;
      if (Math.abs(o.transform.basis[4] - 1) > 1e-6) return false;
      const onGrid = (v: number) =>
        Math.abs(v / 10 - Math.round(v / 10)) < 1e-6;
      const h = (y - baseY) / 4;
      return !onGrid(x) || !onGrid(z) || Math.abs(h - Math.round(h)) > 1e-6;
    })
    .map((o) => o.id);
  const graph = connectionGraph(project, all);
  const health = modelHealth(project);
  const groupMembers = withoutLooseObjects(
    project,
    connectedGroups(graph),
    all,
  ).groups;
  return {
    parts: all.length,
    refs,
    overlaps: found,
    offGrid,
    unmeasured: [...new Set(unmeasured)],
    groups: groupMembers.length,
    groupMembers,
    covered: graph.covered.length,
    uncovered: graph.uncovered.length,
    studContacts: graph.contacts - graph.hingeContacts,
    hingeContacts: graph.hingeContacts,
    health,
  };
}
