/**
 * Small builder for the original template builds (house, castle, car).
 *
 * Parts are placed on the stud grid: horizontal positions in studs (1 stud =
 * 20 LDU), heights in plates (1 plate = 8 LDU, a brick is 3 plates). LDraw
 * axes: negative Y is up, the baseplate top is y = 0. A part is placed by the
 * minimum corner of its footprint and the plate level its underside rests on;
 * the kit derives the LDraw origin from the part's catalogue bounds, so every
 * part lands exactly on the grid whatever its own origin.
 *
 * The output is a deterministic multi-part MPD: one submodel per section,
 * placed at the identity so that section coordinates are world coordinates.
 */
import installedBounds from "../bounds.json";
import pack from "../connectors.json";
import { catalog } from "../catalog";
import { rotationY } from "../../core/math";
import type { Basis, Vec3 } from "../../core/types";

export type Turn = 0 | 90 | 180 | 270;
type Box = { min: Vec3; max: Vec3 };

/**
 * Local bounds of the few non-catalogue official parts the builds use
 * (read from the pinned complete library pack's index; LDraw axes).
 */
export const FULL_LIBRARY_BOUNDS: Record<string, Box> = {
  "2335.dat": { min: [-6.561, 0, -4.05], max: [6.561, 40, 50] },
  "4600.dat": { min: [-34, -4, -20], max: [34, 12.06, 20] },
  "4624.dat": { min: [-10, -10, -8], max: [10, 10, 8] },
  "3641.dat": { min: [-18, -18, -8], max: [18, 18, 8] },
  "3788.dat": { min: [-40, -4, -20], max: [40, 16, 20] },
  "3823.dat": { min: [-40, -4, -30], max: [40, 48, 10] },
  "4079.dat": { min: [-20, -40, -20], max: [20, 8, 25] },
  "3829c01.dat": { min: [-20, -38.72, -13.44], max: [20, 8, 10] },
};

const bounds = installedBounds.bounds as unknown as Record<string, Box | null>;
type PackPart = { runs: [string, number, number, number, number][] };
const packParts = pack.parts as unknown as Record<string, PackPart>;

export function localBounds(ref: string): Box {
  const box = bounds[ref] ?? FULL_LIBRARY_BOUNDS[ref];
  if (!box) throw new Error("No bounds for " + ref);
  return box;
}
/** The plane a part rests on: its lowest anti-stud row, else its bounds. */
export function underside(ref: string) {
  const anti = packParts[ref]?.runs.filter((r) => r[0] === "a") ?? [];
  return anti.length
    ? Math.max(...anti.map((r) => r[1]))
    : localBounds(ref).max[1];
}
export const basis = (turn: Turn): Basis =>
  rotationY(turn).map((v) => Math.round(v) || 0) as Basis;
const apply = (b: Basis, v: Vec3): Vec3 => [
  b[0] * v[0] + b[1] * v[1] + b[2] * v[2],
  b[3] * v[0] + b[4] * v[1] + b[5] * v[2],
  b[6] * v[0] + b[7] * v[1] + b[8] * v[2],
];
/** Footprint (min corner and size, LDU) of a part turned about Y. */
export function footprint(ref: string, turn: Turn) {
  let { min, max } = localBounds(ref);
  const part = Object.hasOwn(catalog, ref) ? catalog[ref] : undefined;
  if (part) {
    // The catalogue's stud footprint and origin phase: the footprint's corner
    // lies on a grid line, nearest the centre of the part's bounds.
    const corner = (lo: number, hi: number, size: number, phase: number) => {
      const target = (lo + hi) / 2 - size / 2;
      return Math.round((target + phase) / 20) * 20 - phase;
    };
    const x = corner(min[0], max[0], part.width, part.align[0]),
      z = corner(min[2], max[2], part.depth, part.align[1]);
    min = [x, min[1], z];
    max = [x + part.width, max[1], z + part.depth];
  }
  const b = basis(turn);
  const xs: number[] = [],
    zs: number[] = [];
  for (const x of [min[0], max[0]])
    for (const z of [min[2], max[2]]) {
      const p = apply(b, [x, 0, z]);
      xs.push(p[0]);
      zs.push(p[2]);
    }
  // Round/curved parts reach a few LDU past their stud cells: snap to cells.
  const snap = (v: number) => Math.round(v / 10) * 10;
  return {
    minX: snap(Math.min(...xs)),
    minZ: snap(Math.min(...zs)),
    width: snap(Math.max(...xs)) - snap(Math.min(...xs)),
    depth: snap(Math.max(...zs)) - snap(Math.min(...zs)),
  };
}

const fmt = (n: number) => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? "0" : String(r);
};

export class Model {
  lines: string[] = [];
  constructor(
    public name: string,
    public title: string,
  ) {}
  /** A part at an explicit LDraw origin and basis. */
  raw(ref: string, color: number, position: Vec3, b: Basis = basis(0)) {
    this.lines.push(
      `1 ${color} ${position.map(fmt).join(" ")} ${b.map(fmt).join(" ")} ${ref}`,
    );
    return this;
  }
  /**
   * A part whose footprint's minimum corner is at stud cell (x, z) and whose
   * underside rests on plate level `level` (y = −8 × level).
   */
  put(
    ref: string,
    color: number,
    x: number,
    z: number,
    level: number,
    turn: Turn = 0,
  ) {
    const f = footprint(ref, turn);
    return this.raw(
      ref,
      color,
      [x * 20 - f.minX, -8 * level - underside(ref), z * 20 - f.minZ],
      basis(turn),
    );
  }
  comment(text: string) {
    this.lines.push("0 // " + text);
    return this;
  }
}

/** Straight 1-wide and 2-wide bricks, plates and tiles by length in studs. */
export const BRICK_1: Record<number, string> = {
  1: "3005.dat",
  2: "3004.dat",
  3: "3622.dat",
  4: "3010.dat",
  6: "3009.dat",
  8: "3008.dat",
};
export const BRICK_2: Record<number, string> = {
  2: "3003.dat",
  3: "3002.dat",
  4: "3001.dat",
  6: "2456.dat",
  8: "3007.dat",
  10: "3006.dat",
};
export const PLATE_1: Record<number, string> = {
  1: "3024.dat",
  2: "3023b.dat",
  3: "3623.dat",
  4: "3710.dat",
  6: "3666.dat",
  8: "3460.dat",
  10: "4477.dat",
  12: "60479.dat",
};
export const PLATE_2: Record<number, string> = {
  2: "3022.dat",
  3: "3021.dat",
  4: "3020.dat",
  6: "3795.dat",
  8: "3034.dat",
  10: "3832.dat",
  12: "2445.dat",
  16: "4282.dat",
};
export const TILE_1: Record<number, string> = {
  1: "3070b.dat",
  2: "3069b.dat",
  3: "63864.dat",
  4: "2431.dat",
  6: "6636.dat",
  8: "4162.dat",
};
export const TILE_2: Record<number, string> = {
  2: "3068b.dat",
  3: "26603.dat",
  4: "87079.dat",
};

/**
 * Splits a run of `length` studs into available piece lengths so that no
 * joint lines up with a joint in `below` (positions measured from the run's
 * start): running bond. Fewer, longer pieces are preferred.
 */
export function bond(
  length: number,
  pieces: readonly number[],
  below: ReadonlySet<number> = new Set(),
): number[] {
  const best: { cost: number; next: number }[] = Array(length + 1);
  best[length] = { cost: 0, next: 0 };
  for (let at = length - 1; at >= 0; at--) {
    let choice = { cost: Infinity, next: 0 };
    for (const piece of pieces) {
      const end = at + piece;
      if (end > length || !best[end]) continue;
      const joint = end < length && below.has(end) ? 20 : 0;
      const cost =
        best[end].cost +
        1 +
        joint +
        (piece === 1 ? 1.5 : piece === 2 ? 0.5 : piece === 3 ? 0.3 : 0);
      if (cost < choice.cost) choice = { cost, next: piece };
    }
    if (choice.cost < Infinity) best[at] = choice;
  }
  if (!best[0]) throw new Error(`Cannot fill a run of ${length} studs`);
  const out: number[] = [];
  for (let at = 0; at < length; at += best[at].next) out.push(best[at].next);
  return out;
}

/** Joints (positions strictly inside a run) produced by a list of pieces. */
export function joints(pieces: readonly number[], offset = 0) {
  const set = new Set<number>();
  let at = offset;
  for (const p of pieces.slice(0, -1)) set.add((at += p));
  return set;
}

export type Side = "front" | "back" | "left" | "right";
/** Cells along a side, half-open [from, to), for courses [c0, c1). */
export type Opening = {
  side: Side;
  from: number;
  to: number;
  c0: number;
  c1: number;
};
const SIDES: Side[] = ["front", "back", "left", "right"];
/**
 * A 1-stud-thick rectangular wall ring on cells x0..x1 × z0..z1 (inclusive),
 * `courses` bricks high from plate level `level`. Corners interlock: even
 * courses run the front (−Z) and back walls through the corners, odd courses
 * the side walls. Each run is split in running bond against the course below.
 */
export function ringWall(
  m: Model,
  o: {
    x0: number;
    x1: number;
    z0: number;
    z1: number;
    level: number;
    courses: number;
    color: (course: number, side: Side) => number;
    openings?: Opening[];
    pieces?: Record<number, string>;
  },
) {
  const pieces = o.pieces ?? BRICK_1;
  const lengths = Object.keys(pieces).map(Number);
  const prev: Record<Side, Set<number>> = {
    front: new Set(),
    back: new Set(),
    left: new Set(),
    right: new Set(),
  };
  for (let c = 0; c < o.courses; c++) {
    for (const side of SIDES) {
      const alongX = side === "front" || side === "back";
      const full = alongX === (c % 2 === 0);
      const lo = alongX ? o.x0 : o.z0,
        hi = alongX ? o.x1 : o.z1;
      const a = full ? lo : lo + 1,
        b = full ? hi + 1 : hi;
      const open = (i: number) =>
        (o.openings ?? []).some(
          (op) =>
            op.side === side &&
            c >= op.c0 &&
            c < op.c1 &&
            i >= op.from &&
            i < op.to,
        );
      const runs: [number, number][] = [];
      for (let i = a; i < b; i++) {
        if (open(i)) continue;
        const last = runs[runs.length - 1];
        if (last && last[1] === i) last[1] = i + 1;
        else runs.push([i, i + 1]);
      }
      const boundaries = new Set<number>();
      for (const [s, e] of runs) {
        const below = new Set(
          [...prev[side]].filter((p) => p > s && p < e).map((p) => p - s),
        );
        let at = s;
        boundaries.add(s);
        for (const len of bond(e - s, lengths, below)) {
          const x = alongX ? at : side === "left" ? o.x0 : o.x1,
            z = alongX ? (side === "front" ? o.z0 : o.z1) : at;
          m.put(
            pieces[len],
            o.color(c, side),
            x,
            z,
            o.level + 3 * c,
            alongX ? 0 : 90,
          );
          at += len;
          boundaries.add(at);
        }
      }
      prev[side] = boundaries;
    }
  }
}

/**
 * A straight wall `thickness` studs thick (1 or 2) along X or Z, cells
 * [from, to) along it and `at` (the lowest cell) across it, in running bond.
 * `color(course, piece)` picks each brick's colour.
 */
export function straightWall(
  m: Model,
  o: {
    alongX: boolean;
    at: number;
    from: number;
    to: number;
    level: number;
    courses: number;
    thickness: 1 | 2;
    openings?: { from: number; to: number; c0: number; c1: number }[];
    color: (course: number, piece: number) => number;
  },
) {
  const pieces = o.thickness === 2 ? BRICK_2 : BRICK_1;
  const lengths = Object.keys(pieces).map(Number);
  let prev = new Set<number>();
  let n = 0;
  for (let c = 0; c < o.courses; c++) {
    const runs: [number, number][] = [];
    for (let i = o.from; i < o.to; i++) {
      if (
        (o.openings ?? []).some(
          (op) => c >= op.c0 && c < op.c1 && i >= op.from && i < op.to,
        )
      )
        continue;
      const last = runs[runs.length - 1];
      if (last && last[1] === i) last[1] = i + 1;
      else runs.push([i, i + 1]);
    }
    const next = new Set<number>();
    for (const [s, e] of runs) {
      const below = new Set(
        [...prev].filter((p) => p > s && p < e).map((p) => p - s),
      );
      // Stagger the first course of long runs too.
      if (c % 2 && e - s > 6) below.add(4);
      let at = s;
      next.add(s);
      for (const len of bond(e - s, lengths, below)) {
        m.put(
          pieces[len],
          o.color(c, n++),
          o.alongX ? at : o.at,
          o.alongX ? o.at : at,
          o.level + 3 * c,
          o.alongX ? 0 : 90,
        );
        at += len;
        next.add(at);
      }
    }
    prev = next;
  }
}

/** Deterministic multi-part document: root lists the submodels. */
export function mpd(
  file: string,
  title: string,
  header: string[],
  sections: Model[],
) {
  const out = [
    `0 FILE ${file}`,
    `0 ${title}`,
    `0 Name: ${file}`,
    "0 Author: Brick Editor contributors",
    "0 !LICENSE Licensed under CC0 1.0 : see fixtures/PROVENANCE.md",
    ...header.map((h) => "0 // " + h),
    ...sections.map((s) => `1 16 0 0 0 1 0 0 0 1 0 0 0 1 ${s.name}`),
  ];
  for (const s of sections)
    out.push(
      "",
      `0 FILE ${s.name}`,
      `0 ${s.title}`,
      `0 Name: ${s.name}`,
      "0 Author: Brick Editor contributors",
      "0 !LICENSE Licensed under CC0 1.0 : see fixtures/PROVENANCE.md",
      ...s.lines,
    );
  return out.join("\n") + "\n";
}
