/**
 * Voxel massing and its packing into real bricks, plates and tiles.
 *
 * A cell is one stud square by one plate high. Build-script massing ops write
 * cells (material + section + source op); the packer then turns every level
 * into rectangles of the largest pieces that fit, bricks where three plates
 * of the same material stand on each other, plates elsewhere and tiles on
 * smooth, exposed tops. Each rectangle is scored so its edges avoid the
 * joints of the level below (running bond / staggered joints) and so it
 * bridges several pieces below, which keeps the result connected.
 */
import { catalog } from "../catalog/catalog";
import { madeIn } from "../catalog/color-availability";

const OFF = 4096,
  SPAN = 8192,
  YOFF = 1024,
  YSPAN = 4096;
export const cellKey = (x: number, y: number, z: number) =>
  ((x + OFF) * SPAN + (z + OFF)) * YSPAN + (y + YOFF);
export function cellOf(key: number): [number, number, number] {
  const y = (key % YSPAN) - YOFF;
  const xz = Math.floor(key / YSPAN);
  return [Math.floor(xz / SPAN) - OFF, y, (xz % SPAN) - OFF];
}
export const inRange = (x: number, y: number, z: number) =>
  x >= -OFF &&
  x < OFF &&
  z >= -OFF &&
  z < OFF &&
  y >= -YOFF &&
  y < YSPAN - YOFF;
const colKey = (x: number, z: number) => (x + OFF) * SPAN + (z + OFF);

export type Material = {
  /** LDraw colour codes; several: a deterministic per-piece mix. */
  colours: string[];
  mode: "auto" | "plate";
};
/** A packed piece: part, colour and placement on the stud grid. */
export type Piece = {
  ref: string;
  colour: string;
  x: number;
  z: number;
  y: number;
  turn: 0 | 90;
  section: number;
  op: number;
};

/** Cell value: material, section and a smooth-top flag. */
export type Cell = { mat: number; section: number; op: number; tile: boolean };

type Size = { ref: string; w: number; d: number; turn: 0 | 90 };
function sizes(kind: "brick" | "plate" | "tile") {
  const out: Size[] = [];
  const TILES = [
    "3070b.dat",
    "3069b.dat",
    "63864.dat",
    "2431.dat",
    "6636.dat",
    "4162.dat",
    "3068b.dat",
    "26603.dat",
    "87079.dat",
  ];
  const refs =
    kind === "tile"
      ? TILES
      : Object.values(catalog)
          .filter(
            (p) =>
              p.fillable &&
              p.category === (kind === "brick" ? "Bricks" : "Plates") &&
              p.height === (kind === "brick" ? 24 : 8),
          )
          .map((p) => p.id);
  for (const ref of refs) {
    const p = catalog[ref];
    const w = p.width / 20,
      d = p.depth / 20;
    out.push({ ref, w, d, turn: 0 });
    if (w !== d) out.push({ ref, w: d, d: w, turn: 90 });
  }
  // Largest first; equal areas: the catalogue's order (stable).
  return out.sort((a, b) => b.w * b.d - a.w * a.d);
}
let SIZES: Record<"brick" | "plate" | "tile", Size[]> | undefined;
const sizeTable = () =>
  (SIZES ??= {
    brick: sizes("brick"),
    plate: sizes("plate"),
    tile: sizes("tile"),
  });

/** Pieces of a kind that exist in every colour of a mix (1 × 1 always). */
const available = new Map<string, Size[]>();
function piecesFor(kind: "brick" | "plate" | "tile", colours: string[]) {
  const key = kind + "|" + colours.join(",");
  let list = available.get(key);
  if (!list) {
    list = sizeTable()[kind].filter(
      (s) => (s.w === 1 && s.d === 1) || colours.every((c) => madeIn(s.ref, c)),
    );
    available.set(key, list);
  }
  return list;
}
/** Deterministic hash in [0, 1). */
export function hash01(...n: number[]) {
  let h = 2166136261;
  for (const v of n) {
    h ^= v | 0;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
}

export class Grid {
  cells = new Map<number, Cell>();
  set(x: number, y: number, z: number, cell: Cell) {
    if (!inRange(x, y, z)) throw new Error(`Cell ${x},${y},${z} out of range`);
    this.cells.set(cellKey(x, y, z), cell);
  }
  get(x: number, y: number, z: number) {
    return this.cells.get(cellKey(x, y, z));
  }
  delete(x: number, y: number, z: number) {
    this.cells.delete(cellKey(x, y, z));
  }
  /** Highest filled level of each column. */
  /** Highest filled level of each column (cells, plus `extra` cell keys
   * such as the cells parts hold). */
  tops(extra: Iterable<number> = []) {
    const tops = new Map<number, number>();
    for (const key of [...this.cells.keys(), ...extra]) {
      const [x, y, z] = cellOf(key);
      const k = colKey(x, z);
      if ((tops.get(k) ?? -Infinity) < y) tops.set(k, y);
    }
    return tops;
  }
  top(tops: Map<number, number>, x: number, z: number) {
    return tops.get(colKey(x, z));
  }
}

type Rect = {
  x: number;
  z: number;
  w: number;
  d: number;
  ref: string;
  turn: 0 | 90;
};
/**
 * Covers `free` (x,z cell keys) with rectangles from `pieces`. `below` maps a
 * cell to the piece under it (for joint staggering); `parity` alternates the
 * scan direction and preferred orientation from level to level.
 */
function pack2d(
  free: Set<number>,
  pieces: Size[],
  below: Map<number, number> | undefined,
  belowRects: Map<number, Rect>,
  parity: number,
): Rect[] {
  const cells = [...free].map((k) => [
    Math.floor(k / SPAN) - OFF,
    (k % SPAN) - OFF,
  ]);
  cells.sort((a, b) =>
    parity ? a[0] - b[0] || a[1] - b[1] : a[1] - b[1] || a[0] - b[0],
  );
  const covered = new Set<number>();
  const out: Rect[] = [];
  const ok = (x: number, z: number) => {
    const k = colKey(x, z);
    return free.has(k) && !covered.has(k);
  };
  const under = (x: number, z: number) => below?.get(colKey(x, z));
  for (const [x, z] of cells) {
    if (covered.has(colKey(x, z))) continue;
    let best: { s: Size; score: number } | undefined;
    for (const s of pieces) {
      let fits = true;
      for (let i = 0; i < s.w && fits; i++)
        for (let j = 0; j < s.d && fits; j++) fits = ok(x + i, z + j);
      if (!fits) continue;
      let score = s.w * s.d * 4;
      if (below) {
        const ids = new Set<number>();
        for (let i = 0; i < s.w; i++)
          for (let j = 0; j < s.d; j++) {
            const id = under(x + i, z + j);
            if (id !== undefined) ids.add(id);
          }
        // Bridging pieces below ties the structure together; a piece over
        // nothing (a ledge's outer row) should reach back over a support.
        score += Math.min(ids.size - 1, 4) * 2;
        if (!ids.size) score -= 30;
        if (ids.size === 1) {
          const r = belowRects.get([...ids][0]);
          if (r && r.x === x && r.z === z && r.w === s.w && r.d === s.d)
            score -= 40;
        }
        // Edges over joints below (stacked joints) are weak.
        const seam = (ax: number, az: number, bx: number, bz: number) => {
          const a = under(ax, az),
            b = under(bx, bz);
          return a !== undefined && b !== undefined && a !== b ? 3 : 0;
        };
        for (let j = 0; j < s.d; j++)
          score -=
            seam(x - 1, z + j, x, z + j) +
            seam(x + s.w - 1, z + j, x + s.w, z + j);
        for (let i = 0; i < s.w; i++)
          score -=
            seam(x + i, z - 1, x + i, z) +
            seam(x + i, z + s.d - 1, x + i, z + s.d);
      }
      if (s.w !== s.d && s.w > s.d === (parity === 0)) score += 1;
      if (!best || score > best.score) best = { s, score };
    }
    if (!best) throw new Error("No piece fits a cell"); // 1 × 1 always fits
    const s = best.s;
    for (let i = 0; i < s.w; i++)
      for (let j = 0; j < s.d; j++) covered.add(colKey(x + i, z + j));
    out.push({ x, z, w: s.w, d: s.d, ref: s.ref, turn: s.turn });
  }
  return out;
}

/**
 * pack2d, and when that leaves pieces with nothing under them (a ledge on
 * the far side of its support: the scan anchors pieces at their minimum
 * corner, so the last row or column gets pieces of its own), pack2d again
 * scanning from the other corner; the result with fewer unsupported pieces
 * wins (then fewer pieces, then the first).
 */
function packSupported(
  free: Set<number>,
  pieces: Size[],
  below: Map<number, number> | undefined,
  belowRects: Map<number, Rect>,
  parity: number,
  held: (k: number) => boolean,
): Rect[] {
  const first = pack2d(free, pieces, below, belowRects, parity);
  if (!below?.size) return first;
  // Support: a piece packed below, or a part (a window or door frame's
  // studded top).
  const supported = (k: number) => below.has(k) || held(k);
  const unsupported = (rects: Rect[]) =>
    rects.filter((r) => {
      for (let i = 0; i < r.w; i++)
        for (let j = 0; j < r.d; j++)
          if (supported(colKey(r.x + i, r.z + j))) return false;
      return true;
    }).length;
  let best = first,
    fewest = unsupported(first);
  // Mirror x, z or both, pack, mirror back.
  for (const [fx, fz] of [
    [-1, 1],
    [1, -1],
    [-1, -1],
  ]) {
    if (!fewest) break;
    const cx = (x: number, w = 1) => (fx < 0 ? -(x + w) : x),
      cz = (z: number, d = 1) => (fz < 0 ? -(z + d) : z);
    const flip = (k: number) =>
      colKey(cx(Math.floor(k / SPAN) - OFF), cz((k % SPAN) - OFF));
    const mFree = new Set([...free].map(flip));
    const mBelow = new Map([...below].map(([k, id]) => [flip(k), id]));
    const mRects = new Map(
      [...belowRects].map(([id, r]) => [
        id,
        { ...r, x: cx(r.x, r.w), z: cz(r.z, r.d) },
      ]),
    );
    const rects = pack2d(mFree, pieces, mBelow, mRects, parity).map((r) => ({
      ...r,
      x: cx(r.x, r.w),
      z: cz(r.z, r.d),
    }));
    const n = unsupported(rects);
    if (n < fewest || (n === fewest && rects.length < best.length))
      (best = rects), (fewest = n);
  }
  if (fewest) {
    // A ledge round all four sides (a tower's cornice): every scan leaves a
    // far side. Cover the rim first (unsupported cells next to supported
    // ones) with pieces placed any way round that reach back over support,
    // then pack the rest.
    // Unsupported cells up to three studs from support, farthest first, so
    // a two-stud ledge's outer row takes a piece that spans the inner row.
    const distance = new Map<number, number>();
    let frontier = [...free].filter(supported);
    for (const k of frontier) distance.set(k, 0);
    for (let step = 1; step <= 3 && frontier.length; step++) {
      const next: number[] = [];
      for (const k of frontier) {
        const x = Math.floor(k / SPAN) - OFF,
          z = (k % SPAN) - OFF;
        for (const [dx, dz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const n = colKey(x + dx, z + dz);
          if (free.has(n) && !distance.has(n)) {
            distance.set(n, step);
            next.push(n);
          }
        }
      }
      frontier = next;
    }
    // Farthest first suits a two-stud ledge (its outer row needs a piece
    // spanning the inner one); nearest first suits a ledge round a hollow
    // (the ring's pieces must reach the wall before the middle takes it).
    for (const far of [true, false]) {
      if (!fewest) break;
      const rim = [...distance]
        .filter(([, d]) => d > 0)
        .sort((a, b) => (far ? b[1] - a[1] : a[1] - b[1]) || a[0] - b[0])
        .map(([k]) => k);
      const covered = new Set<number>();
      const rects: Rect[] = [];
      for (const k of rim) {
        if (covered.has(k)) continue;
        const x = Math.floor(k / SPAN) - OFF,
          z = (k % SPAN) - OFF;
        let pick: { r: Rect; score: number } | undefined;
        for (const s of pieces)
          for (let i = 0; i < s.w; i++)
            for (let j = 0; j < s.d; j++) {
              const ax = x - i,
                az = z - j;
              let fits = true,
                reaches = false;
              for (let a = 0; a < s.w && fits; a++)
                for (let b = 0; b < s.d && fits; b++) {
                  const c = colKey(ax + a, az + b);
                  fits = free.has(c) && !covered.has(c);
                  reaches ||= supported(c);
                }
              if (!fits || !reaches) continue;
              // Taking the last support next to another loose cell (the
              // inner row of a ledge on both sides of a wall) orphans it.
              const inside = (cx: number, cz: number) =>
                cx >= ax && cx < ax + s.w && cz >= az && cz < az + s.d;
              let orphans = 0;
              for (let a = 0; a < s.w; a++)
                for (let b = 0; b < s.d; b++) {
                  const c = colKey(ax + a, az + b);
                  if (!supported(c)) continue;
                  for (const [dx, dz] of STEPS) {
                    const nx = ax + a + dx,
                      nz = az + b + dz,
                      n = colKey(nx, nz);
                    if (
                      inside(nx, nz) ||
                      !free.has(n) ||
                      covered.has(n) ||
                      supported(n)
                    )
                      continue;
                    const other = STEPS.some(([ex, ez]) => {
                      const m = colKey(nx + ex, nz + ez);
                      return (
                        !inside(nx + ex, nz + ez) &&
                        free.has(m) &&
                        !covered.has(m) &&
                        supported(m)
                      );
                    });
                    if (!other) orphans++;
                  }
                }
              const score = s.w * s.d - 40 * orphans;
              if (!pick || score > pick.score)
                pick = {
                  r: { x: ax, z: az, w: s.w, d: s.d, ref: s.ref, turn: s.turn },
                  score,
                };
            }
        if (!pick) continue;
        const r = pick.r;
        for (let a = 0; a < r.w; a++)
          for (let b = 0; b < r.d; b++) covered.add(colKey(r.x + a, r.z + b));
        rects.push(r);
      }
      const rest = new Set([...free].filter((k) => !covered.has(k)));
      const all = [
        ...rects,
        ...(rest.size ? pack2d(rest, pieces, below, belowRects, parity) : []),
      ];
      const n = unsupported(all);
      if (n < fewest || (n === fewest && all.length < best.length))
        (best = all), (fewest = n);
    }
  }
  return best;
}

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
export type PackResult = { pieces: Piece[]; unavailable: Map<string, number> };
/**
 * Packs every cell of the grid. `blocked(x, y, z)` reports cells above that
 * hold a part (so a smooth top under them keeps its studs).
 */
export function packGrid(
  grid: Grid,
  materials: Material[],
  seed: number,
  blocked: (x: number, y: number, z: number) => boolean,
  /** A part in this cell holds a piece on top (a frame's studded top). */
  holds: (x: number, y: number, z: number) => boolean = blocked,
): PackResult {
  const levels = new Map<number, number[]>();
  for (const key of grid.cells.keys()) {
    const y = (key % YSPAN) - YOFF;
    let list = levels.get(y);
    if (!list) levels.set(y, (list = []));
    list.push(key);
  }
  const claimed = new Set<number>();
  const pieces: Piece[] = [];
  const occupancy = new Map<number, Map<number, number>>();
  const rects = new Map<number, Rect>();
  const unavailable = new Map<string, number>();
  const occ = (y: number) => {
    let m = occupancy.get(y);
    if (!m) occupancy.set(y, (m = new Map()));
    return m;
  };
  const sameAbove = (x: number, y: number, z: number, c: Cell) => {
    const a = grid.get(x, y, z);
    return (
      !!a &&
      a.mat === c.mat &&
      a.section === c.section &&
      !claimed.has(cellKey(x, y, z)) &&
      !(a.tile && isSmooth(x, y, z))
    );
  };
  const isSmooth = (x: number, y: number, z: number) =>
    !grid.get(x, y + 1, z) && !blocked(x, y + 1, z);
  for (const y of [...levels.keys()].sort((a, b) => a - b)) {
    occupancy.delete(y - 2);
    const below = occupancy.get(y - 1);
    const groups = new Map<
      string,
      {
        cell: Cell;
        kind: "brick" | "plate" | "tile";
        cells: Set<number>;
        eligible: Set<number>;
      }
    >();
    for (const key of levels.get(y)!) {
      if (claimed.has(key)) continue;
      const [x, , z] = cellOf(key);
      const c = grid.cells.get(key)!;
      const tile = c.tile && isSmooth(x, y, z);
      const kind = tile ? "tile" : "brick";
      const gk = `${c.mat}|${c.section}|${kind}`;
      let g = groups.get(gk);
      if (!g)
        groups.set(
          gk,
          (g = { cell: c, kind, cells: new Set(), eligible: new Set() }),
        );
      const ck = colKey(x, z);
      g.cells.add(ck);
      if (
        !tile &&
        materials[c.mat].mode === "auto" &&
        sameAbove(x, y + 1, z, c) &&
        sameAbove(x, y + 2, z, c)
      )
        g.eligible.add(ck);
    }
    // Deterministic group order.
    for (const gk of [...groups.keys()].sort()) {
      const g = groups.get(gk)!;
      const mat = materials[g.cell.mat];
      const emit = (r: Rect, height: number, kind: string) => {
        const id = pieces.length;
        const colour =
          mat.colours.length === 1
            ? mat.colours[0]
            : mat.colours[
                Math.floor(hash01(seed, r.x, y, r.z, r.w) * mat.colours.length)
              ];
        if (r.w * r.d === 1)
          for (const c of mat.colours)
            if (!madeIn(r.ref, c)) {
              const k = `${r.ref}|${c}`;
              unavailable.set(k, (unavailable.get(k) ?? 0) + 1);
            }
        const anchor = grid.get(r.x, y, r.z)!;
        pieces.push({
          ref: r.ref,
          colour,
          x: r.x,
          z: r.z,
          y,
          turn: r.turn,
          section: g.cell.section,
          op: anchor.op,
        });
        rects.set(id, r);
        for (let h = 0; h < height; h++) {
          const m = occ(y + h);
          for (let i = 0; i < r.w; i++)
            for (let j = 0; j < r.d; j++) {
              m.set(colKey(r.x + i, r.z + j), id);
              if (h) claimed.add(cellKey(r.x + i, y + h, r.z + j));
            }
        }
        void kind;
      };
      const parity = Math.floor(y / (g.kind === "brick" ? 3 : 1)) % 2;
      const partBelow = (k: number) =>
        holds(Math.floor(k / SPAN) - OFF, y - 1, (k % SPAN) - OFF);
      if (g.kind === "brick" && g.eligible.size) {
        for (const r of packSupported(
          g.eligible,
          piecesFor("brick", mat.colours),
          below,
          rects,
          parity,
          partBelow,
        ))
          emit(r, 3, "brick");
      }
      const rest = new Set([...g.cells].filter((k) => !g.eligible.has(k)));
      if (rest.size)
        for (const r of packSupported(
          rest,
          piecesFor(g.kind === "tile" ? "tile" : "plate", mat.colours),
          below,
          rects,
          y % 2,
          partBelow,
        ))
          emit(r, 1, g.kind);
    }
  }
  return { pieces, unavailable };
}
