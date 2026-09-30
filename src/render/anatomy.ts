/**
 * Anatomy: an exploded view along the model's own structure (docs/ANATOMY.md).
 *
 * The model is split into groups — its top-level submodels, else its layers,
 * else clusters of touching parts. The largest group (the anchor) stays put.
 * Every other group slides out along one of five directions (±X, ±Z or up;
 * never down, through the floor) — the one where it has to travel least to
 * clear the parts in its way. Mirrored left/right (or front/back) pairs move
 * as mirror images, the same distance. Groups leave one after another,
 * easiest to free first, and return in reverse order.
 *
 * Everything here is pure: it plans offsets from part boxes (LDraw space,
 * −Y up). The renderer applies them to occurrence handle matrices only.
 */
import installedBounds from "../catalog/bounds.json";
import { projectBounds, transformBounds, type Bounds } from "../core/spatial";
import type { Occurrence, Project } from "../core/types";

export type Vec3 = [number, number, number];
/** Where the groups came from. */
export type AnatomyBasis = "submodels" | "layers" | "clusters";

/** A group of occurrences that moves as one. */
export type AnatomySource = { key: string; name: string; ids: string[] };

/** Part boxes: six numbers per part (min x, y, z, max x, y, z), LDraw space. */
export type AnatomyInput = AnatomySource & { boxes: Float64Array };

export type AnatomyDirection = "+x" | "-x" | "+z" | "-z" | "up";
export const ANATOMY_DIRECTIONS: Record<AnatomyDirection, Vec3> = {
  "+x": [1, 0, 0],
  "-x": [-1, 0, 0],
  "+z": [0, 0, 1],
  "-z": [0, 0, -1],
  up: [0, -1, 0],
};

export type AnatomyGroup = {
  key: string;
  name: string;
  parts: number;
  /** Home bounds (LDraw). */
  box: { min: Vec3; max: Vec3 };
  role: "anchor" | "mover" | "stays";
  /** Travel direction (movers only). */
  direction: AnatomyDirection | null;
  /** Full-spread travel in LDU (0 unless a mover). */
  distance: number;
  /** Start of its move on the 0–1 timeline. */
  delay: number;
  /** The mirror partner's key, when it moves as one of a symmetric pair. */
  mirror: string | null;
};

export type AnatomyPlan = {
  basis: AnatomyBasis;
  groups: AnatomyGroup[];
  /** Movers (groups that travel). */
  movers: number;
  box: { min: Vec3; max: Vec3 };
};

export const ANATOMY = Object.freeze({
  /** Free space left between a group and what it clears, LDU (one brick). */
  gap: 24,
  /** Most groups that move; smaller ones stay with the anchor. */
  maxMovers: 16,
  /** Groups with fewer parts stay put on large models (see minParts). */
  minParts: 6,
  /** Share of the timeline over which departures are spread. */
  stagger: 0.5,
  /** Extra travel cost per group already using a direction (load balance). */
  balance: 0.2,
});

/** Parts a group needs to move: 1 on small models, up to ANATOMY.minParts. */
export function minParts(total: number) {
  return Math.max(1, Math.min(ANATOMY.minParts, Math.ceil(total / 150)));
}

/** Display name of a submodel reference ("jeep-body.ldr" → "jeep-body"). */
function displayName(name: string) {
  return name.replace(/\.(ldr|mpd|dat)$/i, "") || name;
}

/**
 * The groups of an anatomy view. Top-level submodels of the root (descending
 * through a root that wraps a single submodel); parts placed directly in the
 * root form one "Loose parts" group. Without two such groups: the layers, if
 * at least two hold parts. Otherwise clusters of touching parts (from
 * `boxOf`), if at least two are found. Null when nothing can be separated.
 */
export function anatomyGroups(
  project: Project,
  all: readonly Occurrence[],
  boxOf?: (o: Occurrence, index: number) => ArrayLike<number> | null,
): { basis: AnatomyBasis; groups: AnatomySource[] } | null {
  const least = minParts(all.length);
  const significant = (groups: AnatomySource[]) =>
    groups.filter((g) => g.ids.length >= least).length;
  // Submodels, one level at a time while a single group wraps nearly everything.
  let depth = 0,
    scope: readonly Occurrence[] = all;
  let modelId = project.rootModelId;
  for (; depth < 6; depth++) {
    const nodes = new Map(
      (project.models[modelId]?.nodes ?? []).map((n) => [n.id, n]),
    );
    const byNode = new Map<string, AnatomySource>();
    const names = new Map<string, number>();
    for (const o of scope) {
      const inside = o.path.length > depth + 1;
      const key = !inside
        ? "loose"
        : depth === 0
          ? o.path[0]
          : o.path.slice(0, depth + 1).join("/");
      let group = byNode.get(key);
      if (!group) {
        let name = "Loose parts";
        if (inside) {
          const node = nodes.get(o.path[depth]);
          const model = node && project.models[node.ref];
          name = displayName(model?.name ?? node?.ref ?? "Submodel");
        }
        const seen = (names.get(name) ?? 0) + 1;
        names.set(name, seen);
        group = { key, name: seen > 1 ? `${name} ${seen}` : name, ids: [] };
        byNode.set(key, group);
      }
      group.ids.push(o.id);
    }
    const groups = [...byNode.values()];
    if (significant(groups) >= 2) return { basis: "submodels", groups };
    // One submodel instance holding (nearly) everything: look inside it.
    const only = groups.find((g) => g.key !== "loose");
    if (!only || only.ids.length < all.length * 0.9) break;
    const first = scope.find((o) => o.path.length > depth + 1)!;
    const node = nodes.get(first.path[depth]);
    if (!node || !project.models[node.ref]) break;
    modelId = node.ref;
    const ids = new Set(only.ids);
    scope = scope.filter((o) => ids.has(o.id));
  }
  const byLayer = new Map<string, AnatomySource>();
  for (const o of all) {
    let group = byLayer.get(o.layerId);
    if (!group) {
      group = {
        key: "layer:" + o.layerId,
        name: project.layers[o.layerId]?.name ?? o.layerId,
        ids: [],
      };
      byLayer.set(o.layerId, group);
    }
    group.ids.push(o.id);
  }
  if (significant([...byLayer.values()]) >= 2)
    return { basis: "layers", groups: [...byLayer.values()] };
  if (!boxOf) return null;
  const clusters = contactClusters(all, boxOf);
  if (significant(clusters) >= 2)
    return { basis: "clusters", groups: clusters };
  return null;
}

/**
 * Clusters of parts whose boxes touch or overlap (within 1 LDU): a flat model's
 * separate objects. A spatial hash keeps it near-linear; named by size.
 */
export function contactClusters(
  all: readonly Occurrence[],
  boxOf: (o: Occurrence, index: number) => ArrayLike<number> | null,
): AnatomySource[] {
  const n = all.length,
    boxes = new Float64Array(n * 6),
    parent = new Int32Array(n);
  let known = 0,
    extent = 0;
  for (let i = 0; i < n; i++) {
    parent[i] = i;
    const b = boxOf(all[i], i);
    if (!b) {
      boxes.fill(NaN, i * 6, i * 6 + 6);
      continue;
    }
    for (let k = 0; k < 6; k++) boxes[i * 6 + k] = b[k];
    extent += b[3] - b[0] + (b[5] - b[2]);
    known++;
  }
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  // Cells about twice the average part footprint.
  const cell = Math.max(40, known ? extent / known : 40);
  const grid = new Map<string, number[]>();
  const touch = 1;
  let work = 0;
  for (let i = 0; i < n && work < 5e7; i++) {
    const o = i * 6;
    if (Number.isNaN(boxes[o])) continue;
    const x0 = Math.floor((boxes[o] - touch) / cell),
      x1 = Math.floor((boxes[o + 3] + touch) / cell),
      z0 = Math.floor((boxes[o + 2] - touch) / cell),
      z1 = Math.floor((boxes[o + 5] + touch) / cell),
      y0 = Math.floor((boxes[o + 1] - touch) / cell),
      y1 = Math.floor((boxes[o + 4] + touch) / cell);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) {
          const key = x + "," + y + "," + z;
          let list = grid.get(key);
          if (!list) grid.set(key, (list = []));
          for (const j of list) {
            work++;
            const p = j * 6;
            if (
              boxes[o] - touch <= boxes[p + 3] &&
              boxes[p] - touch <= boxes[o + 3] &&
              boxes[o + 1] - touch <= boxes[p + 4] &&
              boxes[p + 1] - touch <= boxes[o + 4] &&
              boxes[o + 2] - touch <= boxes[p + 5] &&
              boxes[p + 2] - touch <= boxes[o + 5]
            ) {
              const a = find(i),
                b = find(j);
              if (a !== b) parent[a] = b;
            }
          }
          list.push(i);
        }
  }
  const byRoot = new Map<number, string[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    let list = byRoot.get(r);
    if (!list) byRoot.set(r, (list = []));
    list.push(all[i].id);
  }
  return [...byRoot.values()]
    .sort((a, b) => b.length - a.length)
    .map((ids, i) => ({ key: "cluster:" + i, name: `Section ${i + 1}`, ids }));
}

type Box = { min: Vec3; max: Vec3 };
const emptyBox = (): Box => ({
  min: [Infinity, Infinity, Infinity],
  max: [-Infinity, -Infinity, -Infinity],
});
function boxOfParts(boxes: Float64Array): Box {
  const box = emptyBox();
  for (let i = 0; i < boxes.length; i += 6)
    for (let k = 0; k < 3; k++) {
      if (boxes[i + k] < box.min[k]) box.min[k] = boxes[i + k];
      if (boxes[i + 3 + k] > box.max[k]) box.max[k] = boxes[i + 3 + k];
    }
  return box;
}
const centre = (b: Box, k: number) => (b.min[k] + b.max[k]) / 2;
const size = (b: Box, k: number) => b.max[k] - b.min[k];

/**
 * How far `box` must travel along `direction` to clear every part box of
 * `others` that lies in its path (overlapping its cross-section and not wholly
 * behind it), plus the gap. Group bounds prune whole groups first.
 */
export function clearance(
  box: Box,
  direction: AnatomyDirection,
  others: ReadonlyArray<{ box: Box; boxes: Float64Array; offset?: Vec3 }>,
  gap: number = ANATOMY.gap,
) {
  const d = ANATOMY_DIRECTIONS[direction];
  const k = d[0] ? 0 : d[1] ? 1 : 2,
    s = d[k],
    a = (k + 1) % 3,
    b = (k + 2) % 3;
  const eps = 0.01;
  // Travel to clear a box [lo, hi] on the axis (0 when it is behind).
  const need = (lo: number, hi: number) =>
    s > 0
      ? hi > box.min[k] + eps
        ? hi - box.min[k]
        : 0
      : lo < box.max[k] - eps
        ? box.max[k] - lo
        : 0;
  const crosses = (p: ArrayLike<number>, o: number) =>
    p[o + a] < box.max[a] - eps &&
    p[o + 3 + a] > box.min[a] + eps &&
    p[o + b] < box.max[b] - eps &&
    p[o + 3 + b] > box.min[b] + eps;
  let travel = 0;
  const shifted = new Float64Array(6);
  for (const other of others) {
    const g = other.box,
      off = other.offset;
    const groupBounds = off
      ? [0, 1, 2, 3, 4, 5].map(
          (i) => (i < 3 ? g.min[i] : g.max[i - 3]) + off[i % 3],
        )
      : [...g.min, ...g.max];
    if (!crosses(groupBounds, 0)) continue;
    if (need(groupBounds[k], groupBounds[3 + k]) <= travel) continue;
    const parts = other.boxes;
    for (let o = 0; o < parts.length; o += 6) {
      let p: ArrayLike<number> = parts,
        at = o;
      if (off) {
        for (let i = 0; i < 6; i++) shifted[i] = parts[o + i] + off[i % 3];
        p = shifted;
        at = 0;
      }
      if (!crosses(p, at)) continue;
      const t = need(p[at + k], p[at + 3 + k]);
      if (t > travel) travel = t;
    }
  }
  return travel + gap;
}

/** An order-free, rotation-free footprint signature of a group's parts (mirror
 * images of a group have the same one): a hash of each part's sorted box sizes,
 * summed. */
function inventory(boxes: Float64Array) {
  let sum = 0,
    mix = 0;
  for (let o = 0; o < boxes.length; o += 6) {
    let a = Math.round(boxes[o + 3] - boxes[o]),
      b = Math.round(boxes[o + 4] - boxes[o + 1]),
      c = Math.round(boxes[o + 5] - boxes[o + 2]);
    if (a > b) [a, b] = [b, a];
    if (b > c) [b, c] = [c, b];
    if (a > b) [a, b] = [b, a];
    const h =
      Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791);
    sum = (sum + h) | 0;
    mix = (mix + Math.imul(h, h | 1)) | 0;
  }
  return sum + ":" + mix;
}

/**
 * Mirror pairs among `candidates` (indices into `boxes`): groups with the same
 * part count and footprint inventory whose bounds are mirror images about the
 * model's centre plane x = cx (axis 0) or z = cz (axis 2).
 */
export function mirrorPairs(
  groups: ReadonlyArray<{ box: Box; boxes: Float64Array }>,
  candidates: readonly number[],
  model: Box,
): Array<{ a: number; b: number; axis: 0 | 2 }> {
  const extent = Math.max(size(model, 0), size(model, 1), size(model, 2));
  const tol = Math.max(2, extent * 0.02);
  const signature = new Map<number, string>();
  const sig = (i: number) => {
    let s = signature.get(i);
    if (s === undefined) signature.set(i, (s = inventory(groups[i].boxes)));
    return s;
  };
  const used = new Set<number>();
  const pairs: Array<{ a: number; b: number; axis: 0 | 2 }> = [];
  for (const axis of [0, 2] as const) {
    const plane = centre(model, axis),
      other = axis === 0 ? 2 : 0;
    for (const i of candidates) {
      if (used.has(i)) continue;
      const A = groups[i].box;
      if (Math.abs(centre(A, axis) - plane) <= tol) continue;
      let best = -1,
        bestError = Infinity;
      for (const j of candidates) {
        if (j === i || used.has(j)) continue;
        const B = groups[j].box;
        if (groups[i].boxes.length !== groups[j].boxes.length) continue;
        const error = Math.max(
          Math.abs(centre(A, axis) - plane + (centre(B, axis) - plane)),
          Math.abs(centre(A, 1) - centre(B, 1)),
          Math.abs(centre(A, other) - centre(B, other)),
          Math.abs(size(A, 0) - size(B, 0)),
          Math.abs(size(A, 1) - size(B, 1)),
          Math.abs(size(A, 2) - size(B, 2)),
        );
        if (error <= tol && error < bestError && sig(i) === sig(j)) {
          best = j;
          bestError = error;
        }
      }
      if (best >= 0) {
        used.add(i).add(best);
        pairs.push({ a: i, b: best, axis });
      }
    }
  }
  return pairs;
}

const boxesOverlap = (p: Box, q: Box, margin: number) =>
  p.min[0] < q.max[0] + margin &&
  q.min[0] < p.max[0] + margin &&
  p.min[1] < q.max[1] + margin &&
  q.min[1] < p.max[1] + margin &&
  p.min[2] < q.max[2] + margin &&
  q.min[2] < p.max[2] + margin;
const moved = (b: Box, dir: Vec3, t: number): Box => ({
  min: b.min.map((v, k) => v + dir[k] * t) as Vec3,
  max: b.max.map((v, k) => v + dir[k] * t) as Vec3,
});

/** Plan the anatomy view of `groups` (see the module comment). */
export function planAnatomy(
  basis: AnatomyBasis,
  input: readonly AnatomyInput[],
): AnatomyPlan {
  const total = input.reduce((n, g) => n + g.ids.length, 0);
  const least = minParts(total);
  const groups = input.map((g) => ({ ...g, box: boxOfParts(g.boxes) }));
  const model = emptyBox();
  for (const g of groups)
    for (let k = 0; k < 3; k++) {
      model.min[k] = Math.min(model.min[k], g.box.min[k]);
      model.max[k] = Math.max(model.max[k], g.box.max[k]);
    }
  const volume = (b: Box) =>
    Number.isFinite(b.min[0])
      ? (size(b, 0) + 1) * (size(b, 1) + 1) * (size(b, 2) + 1)
      : 0;
  const order = groups
    .map((_, i) => i)
    .filter((i) => groups[i].boxes.length > 0)
    .sort(
      (i, j) =>
        groups[j].ids.length - groups[i].ids.length ||
        volume(groups[j].box) - volume(groups[i].box) ||
        groups[i].key.localeCompare(groups[j].key),
    );
  // The anchor is the model's base — a group resting on the model's bottom
  // whose footprint covers at least 40 % of the model's — else the largest.
  const footprint = (b: Box) => (size(b, 0) + 1) * (size(b, 2) + 1);
  let anchor = order[0] ?? -1;
  let base = -1;
  for (const i of order)
    if (
      model.max[1] - groups[i].box.max[1] <= 8 &&
      (base < 0 || footprint(groups[i].box) > footprint(groups[base].box))
    )
      base = i;
  if (base >= 0 && footprint(groups[base].box) >= 0.4 * footprint(model))
    anchor = base;
  const minTravel = (i: number, dir: AnatomyDirection) => {
    const d = ANATOMY_DIRECTIONS[dir];
    const k = d[0] ? 0 : d[1] ? 1 : 2;
    return 2 * ANATOMY.gap + 0.25 * size(groups[i].box, k);
  };
  const movers = order
    .filter((i) => i !== anchor)
    .filter((i) => groups[i].ids.length >= least)
    .slice(0, ANATOMY.maxMovers);
  const direction = new Map<number, AnatomyDirection>(),
    distance = new Map<number, number>(),
    mirror = new Map<number, number>();
  const usage = new Map<AnatomyDirection, number>();
  const outwardOf = (i: number, dir: AnatomyDirection) => {
    const d = ANATOMY_DIRECTIONS[dir];
    const half = (k: number) => Math.max(1, size(model, k) / 2);
    return (
      (d[0] * (centre(groups[i].box, 0) - centre(model, 0))) / half(0) +
      (d[1] * (centre(groups[i].box, 1) - centre(model, 1))) / half(1) +
      (d[2] * (centre(groups[i].box, 2) - centre(model, 2))) / half(2)
    );
  };
  // Travel is the cost; a direction already used by others costs a little
  // more (spreading the groups around), and ties go outward.
  const cost = (dir: AnatomyDirection, travel: number, outward: number) =>
    travel * (1 + ANATOMY.balance * (usage.get(dir) ?? 0)) - 2 * outward;
  const flip = (d: AnatomyDirection): AnatomyDirection =>
    d === "+x" ? "-x" : d === "-x" ? "+x" : d === "+z" ? "-z" : "+z";
  // Units: single movers, or mirror pairs that move as mirror images.
  type Unit = { members: number[]; options: AnatomyDirection[][] };
  const pairs = mirrorPairs(groups, movers, model);
  const inPair = new Set<number>();
  const units: Unit[] = [];
  for (const { a, b, axis } of pairs) {
    inPair.add(a).add(b);
    mirror.set(a, b).set(b, a);
    const outA: AnatomyDirection =
      axis === 0
        ? centre(groups[a].box, 0) > centre(model, 0)
          ? "+x"
          : "-x"
        : centre(groups[a].box, 2) > centre(model, 2)
          ? "+z"
          : "-z";
    const across: AnatomyDirection[] = axis === 0 ? ["+z", "-z"] : ["+x", "-x"];
    units.push({
      members: [a, b],
      // Apart along the mirror axis first: it wins ties.
      options: [
        [outA, flip(outA)],
        ["up", "up"],
        [across[0], across[0]],
        [across[1], across[1]],
      ],
    });
  }
  const all5 = Object.keys(ANATOMY_DIRECTIONS) as AnatomyDirection[];
  for (const i of movers)
    if (!inPair.has(i))
      units.push({ members: [i], options: all5.map((d) => [d]) });
  // Disassembly order: repeatedly take out the unit that comes free with the
  // least travel past the groups still in place. Groups taken out before stay
  // further out (see settle below), so crowding one costs its extra travel.
  const removed = new Set<number>();
  // Travel of one member along one direction past the groups still in place,
  // kept until the group taken out could change it (see below).
  const travelCache = new Map<string, number>();
  const travelOf = (m: number, dir: AnatomyDirection, unit: Unit) => {
    const key = m + dir;
    let travel = travelCache.get(key);
    if (travel === undefined) {
      const blockers = [];
      for (let k = 0; k < groups.length; k++)
        if (!removed.has(k) && !unit.members.includes(k))
          blockers.push(groups[k]);
      travel = Math.max(
        clearance(groups[m].box, dir, blockers),
        minTravel(m, dir),
      );
      travelCache.set(key, travel);
    }
    return travel;
  };
  const inPath = (box: Box, dir: AnatomyDirection, other: Box) => {
    const d = ANATOMY_DIRECTIONS[dir];
    const k = d[0] ? 0 : d[1] ? 1 : 2;
    for (const a of [(k + 1) % 3, (k + 2) % 3])
      if (other.min[a] >= box.max[a] || other.max[a] <= box.min[a])
        return false;
    return true;
  };
  const placed = (m: number) =>
    moved(
      groups[m].box,
      ANATOMY_DIRECTIONS[direction.get(m)!],
      distance.get(m)!,
    );
  /** How much further group `j` (taken out already) must go to clear `box`. */
  const pushFor = (j: number, box: Box) => {
    const there = placed(j);
    if (!boxesOverlap(box, there, ANATOMY.gap)) return 0;
    const d = ANATOMY_DIRECTIONS[direction.get(j)!];
    const k = d[0] ? 0 : d[1] ? 1 : 2;
    return (
      (d[k] > 0 ? box.max[k] - there.min[k] : there.max[k] - box.min[k]) +
      ANATOMY.gap
    );
  };
  const sequence: Unit[] = [];
  const remaining = new Set(units);
  while (remaining.size) {
    let best: {
      unit: Unit;
      dirs: AnatomyDirection[];
      travel: number;
      score: number;
    } | null = null;
    for (const unit of remaining) {
      for (const dirs of unit.options) {
        let travel = 0,
          score = 0;
        unit.members.forEach((m, n) => {
          travel = Math.max(travel, travelOf(m, dirs[n], unit));
        });
        unit.members.forEach((m, n) => {
          score += cost(dirs[n], travel, outwardOf(m, dirs[n]));
          const lands = moved(
            groups[m].box,
            ANATOMY_DIRECTIONS[dirs[n]],
            travel,
          );
          for (const j of removed) score += pushFor(j, lands);
        });
        score /= unit.members.length;
        // Mirror images prefer to part along their mirror axis.
        if (unit.members.length > 1 && dirs[0] !== dirs[1]) score -= 4;
        if (!best || score < best.score - 1e-6)
          best = { unit, dirs, travel, score };
      }
    }
    const { unit, dirs, travel } = best!;
    unit.members.forEach((m, n) => {
      direction.set(m, dirs[n]);
      distance.set(m, travel);
      usage.set(dirs[n], (usage.get(dirs[n]) ?? 0) + 1);
      removed.add(m);
    });
    remaining.delete(unit);
    // Only travel whose path crosses where the unit was can change.
    for (const m of unit.members) {
      const home = groups[m].box;
      for (const key of [...travelCache.keys()]) {
        const other = parseInt(key, 10),
          dir = key.slice(String(other).length) as AnatomyDirection;
        if (inPath(groups[other].box, dir, home)) travelCache.delete(key);
      }
    }
    sequence.push(unit);
  }
  // Settle: a unit taken out earlier ends further out than any later one it
  // would overlap (with the gap): it is pushed on along its own direction,
  // pairs together, until no two moved groups overlap.
  const unitOf = new Map<number, number>();
  sequence.forEach(({ members }, n) =>
    members.forEach((m) => unitOf.set(m, n)),
  );
  for (let pass = 0; pass < 64; pass++) {
    let pushed = false;
    for (let later = sequence.length - 1; later > 0; later--)
      for (const m of sequence[later].members) {
        const here = placed(m);
        for (let earlier = 0; earlier < later; earlier++) {
          let push = 0;
          for (const j of sequence[earlier].members)
            push = Math.max(push, pushFor(j, here));
          if (push <= 0) continue;
          for (const j of sequence[earlier].members)
            distance.set(j, distance.get(j)! + push);
          pushed = true;
        }
      }
    if (!pushed) break;
  }
  // Stagger: units leave in disassembly order; pairs share a start.
  const delay = new Map<number, number>();
  sequence.forEach(({ members }, n) => {
    const t =
      sequence.length > 1 ? (n / (sequence.length - 1)) * ANATOMY.stagger : 0;
    for (const m of members) delay.set(m, t);
  });
  const moverSet = new Set(movers);
  const out: AnatomyGroup[] = groups.map((g, i) => ({
    key: g.key,
    name: g.name,
    parts: g.ids.length,
    box: g.box,
    role: i === anchor ? "anchor" : moverSet.has(i) ? "mover" : "stays",
    direction: direction.get(i) ?? null,
    distance: Math.round((distance.get(i) ?? 0) * 100) / 100,
    delay: delay.get(i) ?? 0,
    mirror: mirror.has(i) ? groups[mirror.get(i)!].key : null,
  }));
  return { basis, groups: out, movers: movers.length, box: model };
}

const smooth = (t: number) => t * t * (3 - 2 * t);
/** A group's eased share of its travel at timeline position `progress` (0–1). */
export function anatomyEase(group: AnatomyGroup, progress: number) {
  if (!group.direction) return 0;
  const span = 1 - ANATOMY.stagger;
  const t = Math.min(1, Math.max(0, (progress - group.delay) / span));
  return smooth(t);
}
/** A group's offset (LDraw) at `progress` with the travel scaled by `spread`. */
export function anatomyOffset(
  group: AnatomyGroup,
  progress: number,
  spread: number,
): Vec3 {
  if (!group.direction) return [0, 0, 0];
  const d = ANATOMY_DIRECTIONS[group.direction];
  const t = anatomyEase(group, progress) * group.distance * spread;
  return [d[0] * t + 0, d[1] * t + 0, d[2] * t + 0];
}

/**
 * Conservative LDraw boxes of occurrences from the installed source bounds (as
 * floors use): six numbers per occurrence, NaN when a box is unknown. The
 * renderer measures its drawn geometry instead; this serves tools and tests.
 */
export function projectPartBoxes(
  project: Project,
  all: readonly Occurrence[],
): Float64Array {
  const out = new Float64Array(all.length * 6).fill(NaN);
  const sources = projectBounds(
    project,
    installedBounds.bounds as unknown as Record<string, Bounds | null>,
    installedBounds.dependencies.transitive,
  );
  all.forEach((o, i) => {
    let local: Bounds | null = null;
    try {
      if (o.node.kind !== "geometry") local = sources.model(o.node.ref);
    } catch {
      local = null;
    }
    const b = local
      ? transformBounds(local, o.transform)
      : { min: o.transform.position, max: o.transform.position };
    out.set([...b.min, ...b.max], i * 6);
  });
  return out;
}

/** Plan straight from a project (source bounds): grouping plus planning. */
export function planProjectAnatomy(
  project: Project,
  all: readonly Occurrence[],
): AnatomyPlan | null {
  const boxes = projectPartBoxes(project, all);
  const found = anatomyGroups(project, all, (_, i) =>
    boxes.subarray(i * 6, i * 6 + 6),
  );
  if (!found) return null;
  const index = new Map(all.map((o, i) => [o.id, i]));
  return planAnatomy(
    found.basis,
    found.groups.map((g) => {
      const own = new Float64Array(g.ids.length * 6);
      g.ids.forEach((id, n) => {
        const i = index.get(id)!;
        own.set(boxes.subarray(i * 6, i * 6 + 6), n * 6);
      });
      return { ...g, boxes: own };
    }),
  );
}
