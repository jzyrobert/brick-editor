import type { Vec3 } from "../core/types";
import type { HiddenParts, ShellBox, StudAxis } from "./hidden-geometry";

/**
 * Which studs and cavities of each placed part are hidden by its neighbours
 * (docs/PERFORMANCE-MINEBENCH.md). The decisions use only the placements and
 * each part's connector and shell data, never the camera, so they are exact
 * for every view in which all parts are drawn opaque, in place and uncut:
 *
 * - A **stud** is hidden when an anti-stud of another opaque part receives it
 *   (same lattice point, opposed axis). Both parts must be opaque: a
 *   transparent part shows its own studs from inside, and a transparent
 *   receiver shows the stud inside it.
 * - A **closed-shell** part (hidden-geometry.ts: plain bricks, plates, tiles)
 *   placed on the model's stud lattice occupies grid cells of 20 × 8 × 20 LDU.
 *   Its studs are hidden when every cell above it is occupied by opaque
 *   closed-shell parts, its cavity when every cell below is, and the whole
 *   part when every cell around all six faces is (Minebench's blocks with no
 *   visible face).
 *
 * Lookups use sorted typed arrays of packed lattice keys, not maps of strings,
 * so a 150,000-part model needs a few megabytes.
 */
export type OcclusionItem = {
  id: string;
  /** Row-major 3 × 3 basis and position (LDraw space). */
  basis: readonly number[];
  position: Vec3;
  /** Every material of the placed part is opaque. */
  opaque: boolean;
  /** Stud and anti-stud connectors in the part's own space. */
  studs: readonly StudAxis[];
  antistuds: readonly StudAxis[];
  /** Closed-shell box in the part's own space, or null. */
  box: ShellBox | null;
};

export type OcclusionResult = HiddenParts & {
  /** Every face is covered: nothing of the part can be seen. */
  enclosed: boolean;
};

export type OcclusionStats = {
  items: number;
  gridded: number;
  studs: number;
  hiddenStuds: number;
  cavities: number;
  enclosed: number;
  ms: number;
};

export const LATTICE = Object.freeze({ pitch: 20, plate: 8, snap: 0.05 });

/** Lattice coordinates are packed as 16-bit fields: ±32,766 LDU (1,638
 * studs) for connector points; parts beyond simply hide nothing. */
const OFFSET = 2 ** 15;
/** Packs an integer lattice point and a direction code into one exact double
 * (below 2^51). */
function pack(x: number, y: number, z: number, code: number) {
  return (
    (((x + OFFSET) * 2 ** 16 + (y + OFFSET)) * 2 ** 16 + (z + OFFSET)) * 8 +
    code
  );
}
const inRange = (v: number) => Math.abs(v) < OFFSET - 2;

/** Axis-aligned unit direction → 0..5, else −1. */
function directionCode(x: number, y: number, z: number) {
  const e = 1e-6;
  const ax = Math.abs(x),
    ay = Math.abs(y),
    az = Math.abs(z);
  if (Math.abs(ax - 1) < e && ay < e && az < e) return x > 0 ? 0 : 1;
  if (Math.abs(ay - 1) < e && ax < e && az < e) return y > 0 ? 2 : 3;
  if (Math.abs(az - 1) < e && ax < e && ay < e) return z > 0 ? 4 : 5;
  return -1;
}
const opposite = (code: number) => code ^ 1;

function world(item: OcclusionItem, p: Vec3): Vec3 {
  const b = item.basis,
    t = item.position;
  return [
    t[0] + b[0] * p[0] + b[1] * p[1] + b[2] * p[2],
    t[1] + b[3] * p[0] + b[4] * p[1] + b[5] * p[2],
    t[2] + b[6] * p[0] + b[7] * p[1] + b[8] * p[2],
  ];
}
/** A rigid, unmirrored placement whose axes are the world axes. */
function axisAligned(basis: readonly number[]) {
  for (const v of basis)
    if (Math.abs(v) > 1e-6 && Math.abs(Math.abs(v) - 1) > 1e-6) return false;
  const [a, b, c, d, e, f, g, h, i] = basis;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  return Math.abs(det - 1) < 1e-6;
}
function rigid(basis: readonly number[]) {
  const [a, b, c, d, e, f, g, h, i] = basis;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det - 1) > 1e-4) return false;
  for (let r = 0; r < 3; r++)
    for (let s = 0; s < 3; s++) {
      const dot =
        basis[r] * basis[s] +
        basis[3 + r] * basis[3 + s] +
        basis[6 + r] * basis[6 + s];
      if (Math.abs(dot - (r === s ? 1 : 0)) > 1e-4) return false;
    }
  return true;
}

/** A set of packed keys: appended, then sealed into an open-addressing
 * hash table of doubles (no per-key objects). */
class KeySet {
  private keys: Float64Array;
  private size = 0;
  private table = new Float64Array(0);
  private mask = 0;
  constructor(capacity: number) {
    this.keys = new Float64Array(Math.max(16, capacity));
  }
  add(key: number) {
    if (this.size === this.keys.length) {
      const next = new Float64Array(this.keys.length * 2);
      next.set(this.keys);
      this.keys = next;
    }
    this.keys[this.size++] = key;
  }
  private static hash(key: number) {
    const high = Math.floor(key / 4294967296);
    const low = key - high * 4294967296;
    // murmur3 finalizer over both halves: every key bit reaches the low bits.
    let h = (low | 0) ^ Math.imul(high | 0, 0x9e3779b1);
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    return h ^ (h >>> 16);
  }
  seal() {
    let capacity = 16;
    while (capacity < this.size * 2) capacity *= 2;
    this.mask = capacity - 1;
    this.table = new Float64Array(capacity).fill(-1);
    for (let i = 0; i < this.size; i++) {
      const key = this.keys[i];
      let slot = KeySet.hash(key) & this.mask;
      while (this.table[slot] !== -1 && this.table[slot] !== key)
        slot = (slot + 1) & this.mask;
      this.table[slot] = key;
    }
    this.keys = new Float64Array(0);
  }
  has(key: number) {
    const table = this.table;
    let slot = KeySet.hash(key) & this.mask;
    for (;;) {
      const v = table[slot];
      if (v === key) return true;
      if (v === -1) return false;
      slot = (slot + 1) & this.mask;
    }
  }
}

type Cells = { lo: Vec3; hi: Vec3 };

/** Most models fit a dense bit grid (a 150,000-part city: 5.8 million cells,
 * 730 KB); larger extents fall back to a hash set of packed cells. */
const DENSE_GRID_CELLS = 2 ** 26;

function occupancyGrid(
  cells: ReadonlyArray<Cells | undefined>,
  min: Vec3,
  max: Vec3,
): { has(x: number, y: number, z: number): boolean } {
  const nx = max[0] - min[0],
    ny = max[1] - min[1],
    nz = max[2] - min[2];
  if (!(nx > 0) || !(ny > 0) || !(nz > 0)) return { has: () => false };
  if (nx * ny * nz <= DENSE_GRID_CELLS) {
    const bits = new Uint32Array(Math.ceil((nx * ny * nz) / 32));
    for (const c of cells) {
      if (!c) continue;
      for (let x = c.lo[0]; x < c.hi[0]; x++)
        for (let y = c.lo[1]; y < c.hi[1]; y++)
          for (let z = c.lo[2]; z < c.hi[2]; z++) {
            const i = ((x - min[0]) * ny + (y - min[1])) * nz + (z - min[2]);
            bits[i >>> 5] |= 1 << (i & 31);
          }
    }
    return {
      has(x, y, z) {
        if (
          x < min[0] ||
          y < min[1] ||
          z < min[2] ||
          x >= max[0] ||
          y >= max[1] ||
          z >= max[2]
        )
          return false;
        const i = ((x - min[0]) * ny + (y - min[1])) * nz + (z - min[2]);
        return (bits[i >>> 5] & (1 << (i & 31))) !== 0;
      },
    };
  }
  const set = new KeySet(cells.length * 8);
  for (const c of cells) {
    if (!c) continue;
    for (let x = c.lo[0]; x < c.hi[0]; x++)
      for (let y = c.lo[1]; y < c.hi[1]; y++)
        for (let z = c.lo[2]; z < c.hi[2]; z++) set.add(pack(x, y, z, 0));
  }
  set.seal();
  return { has: (x, y, z) => set.has(pack(x, y, z, 0)) };
}

const indexLists: number[][] = [];
/** [0 … n − 1], shared (most parts hide all their studs or none). */
function everyIndex(n: number) {
  return (indexLists[n] ??= Array.from({ length: n }, (_, i) => i));
}

/** Packed key of a connector's lattice point and axis direction (the
 * opposite direction when `mate`), or −1 when off the lattice. */
function connectorKey(item: OcclusionItem, c: StudAxis, mate: boolean) {
  const b = item.basis,
    t = item.position,
    p = c.p,
    v = c.axis;
  const x = t[0] + b[0] * p[0] + b[1] * p[1] + b[2] * p[2],
    y = t[1] + b[3] * p[0] + b[4] * p[1] + b[5] * p[2],
    z = t[2] + b[6] * p[0] + b[7] * p[1] + b[8] * p[2];
  const rx = Math.round(x),
    ry = Math.round(y),
    rz = Math.round(z);
  if (
    Math.abs(x - rx) > LATTICE.snap ||
    Math.abs(y - ry) > LATTICE.snap ||
    Math.abs(z - rz) > LATTICE.snap ||
    !inRange(rx) ||
    !inRange(ry) ||
    !inRange(rz)
  )
    return -1;
  const code = directionCode(
    b[0] * v[0] + b[1] * v[1] + b[2] * v[2],
    b[3] * v[0] + b[4] * v[1] + b[5] * v[2],
    b[6] * v[0] + b[7] * v[1] + b[8] * v[2],
  );
  if (code < 0) return -1;
  return pack(rx, ry, rz, mate ? opposite(code) : code);
}

/**
 * Hidden studs, cavities and enclosed parts of every item. Items missing
 * from the result hide nothing.
 */
export function computeOcclusion(items: readonly OcclusionItem[]): {
  hidden: Map<string, OcclusionResult>;
  stats: OcclusionStats;
} {
  const start = performance.now();
  const stats: OcclusionStats = {
    items: items.length,
    gridded: 0,
    studs: 0,
    hiddenStuds: 0,
    cavities: 0,
    enclosed: 0,
    ms: 0,
  };
  const eligible = items.map((item) => item.opaque && rigid(item.basis));
  // 1. Every opaque part's anti-studs, keyed by lattice point and axis.
  const receivers = new KeySet(items.length * 4);
  items.forEach((item, n) => {
    if (!eligible[n]) return;
    for (const a of item.antistuds) {
      const key = connectorKey(item, a, false);
      if (key >= 0) receivers.add(key);
    }
  });
  receivers.seal();
  // 2. Closed-shell parts on the model's lattice occupy grid cells.
  const cells: Array<Cells | undefined> = new Array(items.length);
  let phase: Vec3 | undefined;
  const cellMin: Vec3 = [Infinity, Infinity, Infinity],
    cellMax: Vec3 = [-Infinity, -Infinity, -Infinity];
  items.forEach((item, n) => {
    if (!eligible[n] || !item.box || !axisAligned(item.basis)) return;
    const a = world(item, item.box.min),
      b = world(item, item.box.max);
    const min: Vec3 = [
      Math.min(a[0], b[0]),
      Math.min(a[1], b[1]),
      Math.min(a[2], b[2]),
    ];
    const max: Vec3 = [
      Math.max(a[0], b[0]),
      Math.max(a[1], b[1]),
      Math.max(a[2], b[2]),
    ];
    const size = [LATTICE.pitch, LATTICE.plate, LATTICE.pitch];
    phase ??= [0, 1, 2].map(
      (k) => ((min[k] % size[k]) + size[k]) % size[k],
    ) as Vec3;
    const lo = [0, 0, 0] as Vec3,
      hi = [0, 0, 0] as Vec3;
    for (let k = 0; k < 3; k++) {
      const l = (min[k] - phase[k]) / size[k],
        h = (max[k] - phase[k]) / size[k];
      if (
        Math.abs(l - Math.round(l)) > LATTICE.snap / size[k] ||
        Math.abs(h - Math.round(h)) > LATTICE.snap / size[k] ||
        !inRange(l) ||
        !inRange(h)
      )
        return;
      lo[k] = Math.round(l);
      hi[k] = Math.round(h);
    }
    if (hi[0] <= lo[0] || hi[1] <= lo[1] || hi[2] <= lo[2]) return;
    cells[n] = { lo, hi };
    stats.gridded++;
    for (let k = 0; k < 3; k++) {
      cellMin[k] = Math.min(cellMin[k], lo[k]);
      cellMax[k] = Math.max(cellMax[k], hi[k]);
    }
  });
  const occupied = occupancyGrid(cells, cellMin, cellMax);
  const full = (
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    z0: number,
    z1: number,
  ) => {
    for (let x = x0; x < x1; x++)
      for (let y = y0; y < y1; y++)
        for (let z = z0; z < z1; z++) if (!occupied.has(x, y, z)) return false;
    return true;
  };
  // 3. Decisions per item.
  const hidden = new Map<string, OcclusionResult>();
  items.forEach((item, n) => {
    if (!eligible[n]) return;
    stats.studs += item.studs.length;
    const c = cells[n];
    let top = false,
      bottom = false,
      enclosed = false;
    if (c) {
      const { lo, hi } = c;
      // LDraw −Y is up: the band above has the smaller y index.
      top = full(lo[0], hi[0], lo[1] - 1, lo[1], lo[2], hi[2]);
      bottom = full(lo[0], hi[0], hi[1], hi[1] + 1, lo[2], hi[2]);
      enclosed =
        top &&
        bottom &&
        full(lo[0] - 1, lo[0], lo[1], hi[1], lo[2], hi[2]) &&
        full(hi[0], hi[0] + 1, lo[1], hi[1], lo[2], hi[2]) &&
        full(lo[0], hi[0], lo[1], hi[1], lo[2] - 1, lo[2]) &&
        full(lo[0], hi[0], lo[1], hi[1], hi[2], hi[2] + 1);
    }
    let studs: number[] = [];
    if (top) studs = everyIndex(item.studs.length);
    else
      item.studs.forEach((s, i) => {
        const key = connectorKey(item, s, true);
        if (key >= 0 && receivers.has(key)) studs.push(i);
      });
    if (studs.length === item.studs.length && studs.length)
      studs = everyIndex(studs.length);
    const cavity = !!(c && bottom);
    if (!studs.length && !cavity && !enclosed) return;
    stats.hiddenStuds += studs.length;
    if (cavity) stats.cavities++;
    if (enclosed) stats.enclosed++;
    hidden.set(item.id, { studs, cavity, enclosed });
  });
  stats.ms = Math.round((performance.now() - start) * 10) / 10;
  return { hidden, stats };
}
