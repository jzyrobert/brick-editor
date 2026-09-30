import * as THREE from "three";
import type { Vec3 } from "../core/types";

/**
 * Hidden-geometry culling for compiled part geometry (docs/PERFORMANCE-MINEBENCH.md).
 *
 * Minebench draws 150,000–200,000 voxels on a phone by never emitting a face
 * between two touching opaque blocks. LDraw parts are far heavier than cubes:
 * a 2 × 4 brick is 700 triangles, most of them in its eight studs and three
 * underside tubes, and in a wall or a floor almost every one of those studs sits
 * inside the part above it, and every underside rests on the part below. This
 * module classifies each triangle and line segment of a part's geometry once:
 *
 * - **Stud geometry**: everything inside the cylinder a stud occupies above its
 *   verified stud connector (radius 6, height 4 LDU, plus a small margin for
 *   logos). When an opaque part's anti-stud receives that stud, the cylinder is
 *   inside the receiving part, so nothing in it can be seen.
 * - **Cavity geometry** of a closed-shell part: a part whose four sides and top
 *   are completely closed planes of its bounding box (plain bricks, plates and
 *   tiles, including tiles' bottom groove). Everything strictly inside that shell
 *   (underside tubes, inner walls, the underside of the top) can only be seen
 *   through the open bottom; when opaque closed-shell parts below cover the whole
 *   footprint, it is hidden.
 *
 * Variants of a geometry that leave hidden primitives out share the original's
 * vertex attributes (and so its GPU buffers) and differ only in their index.
 */

/** Stud cylinder (LDU): radius 6 and height 4, with margins for logos and rounding. */
export const STUD_CULL = Object.freeze({
  radius: 6.25,
  height: 4.75,
  below: 0.1,
});
/** Closed-shell test: planes within `inset` LDU of a box face count as that face
 * (a tile's bottom groove is inset 1 LDU); cavity primitives lie deeper inside. */
export const SHELL = Object.freeze({ inset: 1.5, sample: 1, missing: 0.02 });

export type StudAxis = { p: Vec3; axis: Vec3 };
/** A closed-shell part's box (part space, LDraw: −Y is up). */
export type ShellBox = { min: Vec3; max: Vec3 };

/** Per primitive (triangle, or line segment) classification of one geometry. */
export type GeometryClasses = {
  primitives: number;
  /** Stud index + 1 whose cylinder holds the primitive; 0 = none. */
  stud: Uint16Array;
  /** 1 = strictly inside the part's closed shell (seen only from below). */
  cavity: Uint8Array;
};

type Positions = { array: ArrayLike<number>; index: ArrayLike<number> | null };

function positions(geometry: THREE.BufferGeometry): Positions {
  return {
    array: geometry.getAttribute("position").array,
    index: geometry.index ? geometry.index.array : null,
  };
}
function primitiveCount(geometry: THREE.BufferGeometry, corners: number) {
  const n = geometry.index
    ? geometry.index.count
    : geometry.getAttribute("position").count;
  return Math.floor(n / corners);
}

/**
 * Stud cylinders bucketed on a coarse grid, so a primitive is tested only
 * against the studs near its first corner (a 32 × 32 baseplate has 1,024).
 */
class StudLookup {
  private static readonly CELL = 16;
  private cells = new Map<string, number[]>();
  constructor(readonly studs: readonly StudAxis[]) {
    const reach = STUD_CULL.radius + STUD_CULL.height + STUD_CULL.below;
    studs.forEach(({ p }, s) => {
      const lo = p.map((v) => Math.floor((v - reach) / StudLookup.CELL));
      const hi = p.map((v) => Math.floor((v + reach) / StudLookup.CELL));
      for (let x = lo[0]; x <= hi[0]; x++)
        for (let y = lo[1]; y <= hi[1]; y++)
          for (let z = lo[2]; z <= hi[2]; z++) {
            const key = x + "," + y + "," + z;
            const list = this.cells.get(key);
            if (list) list.push(s);
            else this.cells.set(key, [s]);
          }
    });
  }
  /** Which stud cylinder (index + 1) holds every corner of a primitive, else 0. */
  of(pos: Positions, first: number, corners: number) {
    if (!this.studs.length) return 0;
    const v0 = pos.index ? pos.index[first] : first;
    const c = StudLookup.CELL;
    const candidates = this.cells.get(
      Math.floor(pos.array[v0 * 3] / c) +
        "," +
        Math.floor(pos.array[v0 * 3 + 1] / c) +
        "," +
        Math.floor(pos.array[v0 * 3 + 2] / c),
    );
    if (!candidates) return 0;
    outer: for (const s of candidates) {
      const { p, axis } = this.studs[s];
      for (let k = 0; k < corners; k++) {
        const v = pos.index ? pos.index[first + k] : first + k;
        const dx = pos.array[v * 3] - p[0],
          dy = pos.array[v * 3 + 1] - p[1],
          dz = pos.array[v * 3 + 2] - p[2];
        const h = dx * axis[0] + dy * axis[1] + dz * axis[2];
        if (h < -STUD_CULL.below || h > STUD_CULL.height) continue outer;
        const rx = dx - h * axis[0],
          ry = dy - h * axis[1],
          rz = dz - h * axis[2];
        if (rx * rx + ry * ry + rz * rz > STUD_CULL.radius * STUD_CULL.radius)
          continue outer;
      }
      return s + 1;
    }
    return 0;
  }
}

function inCavity(
  pos: Positions,
  first: number,
  corners: number,
  box: ShellBox,
) {
  const e = SHELL.inset;
  for (let c = 0; c < corners; c++) {
    const v = pos.index ? pos.index[first + c] : first + c;
    const x = pos.array[v * 3],
      y = pos.array[v * 3 + 1],
      z = pos.array[v * 3 + 2];
    if (
      x <= box.min[0] + e ||
      x >= box.max[0] - e ||
      z <= box.min[2] + e ||
      z >= box.max[2] - e ||
      y <= box.min[1] + e ||
      y > box.max[1] + 1e-6
    )
      return false;
  }
  return true;
}

/** Classify the primitives of one drawable geometry (triangles for meshes,
 * segments for lines and conditional lines). */
export function classifyGeometry(
  geometry: THREE.BufferGeometry,
  lines: boolean,
  studs: readonly StudAxis[],
  box: ShellBox | null,
): GeometryClasses {
  const corners = lines ? 2 : 3;
  const primitives = primitiveCount(geometry, corners);
  const stud = new Uint16Array(primitives);
  const cavity = new Uint8Array(primitives);
  const pos = positions(geometry);
  const lookup = new StudLookup(studs);
  for (let i = 0; i < primitives; i++) {
    const first = i * corners;
    stud[i] = lookup.of(pos, first, corners);
    if (!stud[i] && box && inCavity(pos, first, corners, box)) cavity[i] = 1;
  }
  return { primitives, stud, cavity };
}

/**
 * The closed-shell box of a part's triangle geometry, or null. The box is the
 * bounds of every triangle outside the stud cylinders; each of its four sides
 * and its top must be covered completely (sampled every SHELL.sample LDU) by
 * triangles lying within SHELL.inset of that face and parallel to it.
 */
export function shellBox(
  meshes: readonly THREE.BufferGeometry[],
  studs: readonly StudAxis[],
): ShellBox | null {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  type Tri = { a: Vec3; b: Vec3; c: Vec3 };
  const body: Tri[] = [];
  const lookup = new StudLookup(studs);
  for (const geometry of meshes) {
    const pos = positions(geometry);
    const n = primitiveCount(geometry, 3);
    for (let i = 0; i < n; i++) {
      if (lookup.of(pos, i * 3, 3)) continue;
      const corner = (c: number): Vec3 => {
        const v = pos.index ? pos.index[i * 3 + c] : i * 3 + c;
        return [pos.array[v * 3], pos.array[v * 3 + 1], pos.array[v * 3 + 2]];
      };
      const t = { a: corner(0), b: corner(1), c: corner(2) };
      for (const p of [t.a, t.b, t.c])
        for (let k = 0; k < 3; k++) {
          if (p[k] < min[k]) min[k] = p[k];
          if (p[k] > max[k]) max[k] = p[k];
        }
      body.push(t);
    }
  }
  if (!body.length) return null;
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  if (size.some((s) => !(s > 2 * SHELL.inset + 1) || s > 4000)) return null;
  // Faces: [axis, plane value, inward sign]; LDraw's top is min Y.
  const faces: Array<[number, number, number]> = [
    [0, min[0], 1],
    [0, max[0], -1],
    [2, min[2], 1],
    [2, max[2], -1],
    [1, min[1], 1],
  ];
  for (const [axis, plane, inward] of faces) {
    const u = axis === 0 ? 2 : 0,
      w = axis === 1 ? 2 : 1;
    const onFace = body.filter((t) =>
      [t.a, t.b, t.c].every((p) => {
        const d = (p[axis] - plane) * inward;
        return d >= -1e-4 && d <= SHELL.inset;
      }),
    );
    const step = SHELL.sample;
    let samples = 0,
      missing = 0;
    for (let su = min[u] + step / 2; su < max[u]; su += step)
      for (let sw = min[w] + step / 2; sw < max[w]; sw += step) {
        samples++;
        if (!onFace.some((t) => covers(t, u, w, su, sw))) missing++;
      }
    if (missing > samples * SHELL.missing) return null;
  }
  return { min, max };
}

/** Whether a triangle, projected onto the (u, w) plane, covers the point. */
function covers(
  t: { a: Vec3; b: Vec3; c: Vec3 },
  u: number,
  w: number,
  pu: number,
  pw: number,
) {
  const s1 = edge(t.a, t.b, u, w, pu, pw),
    s2 = edge(t.b, t.c, u, w, pu, pw),
    s3 = edge(t.c, t.a, u, w, pu, pw);
  const area = edge(t.a, t.b, u, w, t.c[u], t.c[w]);
  if (Math.abs(area) < 1e-9) return false;
  const e = -1e-6 * Math.abs(area);
  return area > 0
    ? s1 >= e && s2 >= e && s3 >= e
    : s1 <= -e && s2 <= -e && s3 <= -e;
}
function edge(a: Vec3, b: Vec3, u: number, w: number, pu: number, pw: number) {
  return (b[u] - a[u]) * (pw - a[w]) - (b[w] - a[w]) * (pu - a[u]);
}

/** What an occurrence hides: studs by index, and its shell cavity. */
export type HiddenParts = {
  /** Hidden stud indices (sorted), as a stable key fragment. */
  studs: readonly number[];
  cavity: boolean;
};
export const hiddenKey = (h: HiddenParts) =>
  (h.cavity ? "c" : "") + h.studs.join(",");

const variants = new WeakMap<
  THREE.BufferGeometry,
  Map<string, THREE.BufferGeometry>
>();

/**
 * The geometry without the hidden primitives, sharing the original's
 * attributes (and GPU buffers); the original itself when nothing is hidden.
 * Groups are renumbered for the new index. Cached per geometry and key.
 */
export function cullGeometry(
  geometry: THREE.BufferGeometry,
  lines: boolean,
  classes: GeometryClasses,
  hidden: HiddenParts,
): THREE.BufferGeometry {
  const key = hiddenKey(hidden);
  if (!key) return geometry;
  let cache = variants.get(geometry);
  const cached = cache?.get(key);
  if (cached) return cached;
  const corners = lines ? 2 : 3;
  const hiddenStuds = new Set(hidden.studs.map((s) => s + 1));
  const drop = (i: number) =>
    (classes.stud[i] !== 0 && hiddenStuds.has(classes.stud[i])) ||
    (hidden.cavity && classes.cavity[i] === 1);
  const source = geometry.index?.array;
  const vertices = geometry.getAttribute("position").count;
  const groups = geometry.groups.length
    ? geometry.groups
    : [{ start: 0, count: classes.primitives * corners, materialIndex: 0 }];
  const kept: number[] = [];
  const nextGroups: Array<{
    start: number;
    count: number;
    materialIndex: number;
  }> = [];
  for (const group of groups) {
    const start = kept.length;
    const first = Math.floor(group.start / corners);
    const end = Math.min(
      classes.primitives,
      first +
        Math.floor(
          (Number.isFinite(group.count)
            ? group.count
            : classes.primitives * corners - group.start) / corners,
        ),
    );
    for (let i = first; i < end; i++) {
      if (drop(i)) continue;
      for (let c = 0; c < corners; c++) {
        const k = i * corners + c;
        kept.push(source ? source[k] : k);
      }
    }
    nextGroups.push({
      start,
      count: kept.length - start,
      materialIndex: group.materialIndex ?? 0,
    });
  }
  const variant = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(geometry.attributes))
    variant.setAttribute(name, attribute);
  const Index = vertices > 65535 ? Uint32Array : Uint16Array;
  variant.setIndex(new THREE.BufferAttribute(new Index(kept), 1));
  if (geometry.groups.length)
    for (const g of nextGroups)
      variant.addGroup(g.start, g.count, g.materialIndex);
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  variant.boundingSphere = geometry.boundingSphere!.clone();
  variant.boundingBox = geometry.boundingBox!.clone();
  variant.name = geometry.name;
  variant.userData = {
    ...geometry.userData,
    culledFrom: geometry.uuid,
    hidden: key,
  };
  if (!cache) variants.set(geometry, (cache = new Map()));
  cache.set(key, variant);
  return variant;
}

/** Primitives a variant keeps (for budgets and diagnostics). */
export function keptPrimitives(
  classes: GeometryClasses,
  hidden: HiddenParts,
): number {
  if (!hidden.cavity && !hidden.studs.length) return classes.primitives;
  const studs = new Set(hidden.studs.map((s) => s + 1));
  let kept = 0;
  for (let i = 0; i < classes.primitives; i++)
    if (
      !(
        (classes.stud[i] !== 0 && studs.has(classes.stud[i])) ||
        (hidden.cavity && classes.cavity[i] === 1)
      )
    )
      kept++;
  return kept;
}

/** Dispose every cached variant of a geometry (its attributes stay with it). */
export function disposeVariants(geometry: THREE.BufferGeometry) {
  const cache = variants.get(geometry);
  if (!cache) return;
  for (const variant of cache.values()) {
    // The attributes belong to the original: only the index is the variant's.
    variant.dispatchEvent({ type: "dispose" });
  }
  variants.delete(geometry);
}
