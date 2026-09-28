// Build-time connector derivation from pinned LDraw geometry (no runtime use).
//
// Studs are recognised as the official stud primitives and carried through the
// subfile tree with their full transforms. Anti-studs (the receptors under a
// part that accept a stud) are not a primitive of their own: tubes, pins and
// walls only bound them. They are found by testing each stud-lattice cell of
// the part's bottom plane against the actual flattened triangles: a stud-sized
// cylinder must fit, the part must close over it, and walls or tubes must
// surround it. Every stud is also tested against the geometry: it must stand on
// the part's surface and have room above it for another part. The part's body
// occupancy (per stud cell and 4 LDU slab, studs excluded) is derived from the
// same triangles. The method and its checks are documented in docs/CONNECTORS.md.
import { canonical } from "../ldraw/path";

export type Vec3 = [number, number, number];
type M = number[]; // row-major 3×3
type Frame = { p: Vec3; m: M };

/** Official stud primitives: origin on the base plane, stud rising along local −Y by 4 LDU. */
export const STUD_PRIMITIVES = new Set([
  "stud.dat",
  "stud2.dat",
  "stud2a.dat",
  "stud10.dat",
]);
/** Primitives that form underside tubes/pins; recorded only as corroborating evidence. */
export const TUBE_PRIMITIVES = new Set([
  "stud3.dat",
  "stud3a.dat",
  "stud4.dat",
  "stud4a.dat",
  "stud4o.dat",
  "stud4od.dat",
  "stud4s.dat",
  "stud4s2.dat",
  "stud18a.dat",
]);

export type RawConnector = {
  kind: "stud" | "antistud" | "pin" | "socket";
  /** Local position in LDU: the stud base or the receptor opening centre. */
  p: Vec3;
  /** Unit direction the stud points, or the direction the receptor opens. */
  axis: Vec3;
  /** Primitive or test that produced the record. */
  source: string;
  /** Studs: the part's surface lies under the stud's base. */
  seated?: boolean;
  /** Studs: a stud cell of room (20 × 20 LDU, one plate high) above the base is free of the part's own body. */
  exposed?: boolean;
};
export type Cell = {
  x: number;
  z: number;
  /** receptor: a stud fits; blocked: geometry occupies the stud's space;
   * open: nothing of the part above (outside a shaped body); unenclosed: a
   * roof but no surrounding walls. */
  state: "receptor" | "blocked" | "open" | "unenclosed";
};
export type Box = { min: Vec3; max: Vec3 };
export type Extraction = {
  connectors: RawConnector[];
  /** Every stud-lattice cell of the base plane and its test result. */
  cells: Cell[];
  tubes: number;
  triangles: number;
  bottom: number;
  /** Box of the part's body geometry (stud primitives excluded). */
  body: Box;
  /** Body occupancy boxes (stud primitives excluded), see `occupancyBoxes`. */
  occupancy: Box[];
  /** A door's hinge pins, when its geometry has them. */
  pins: HingePins | null;
  /** A frame's hinge sockets. */
  sockets: HingeSocket[];
  /** Stud-like geometry the extractor did not recognise (lowers verification). */
  warnings: string[];
};

const mul = (a: M, b: M): M =>
  Array.from({ length: 9 }, (_, i) => {
    const r = Math.floor(i / 3),
      c = i % 3;
    return a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  });
const mv = (m: M, v: Vec3): Vec3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];
const apply = (f: Frame, v: Vec3): Vec3 => {
  const r = mv(f.m, v);
  return [r[0] + f.p[0], r[1] + f.p[1], r[2] + f.p[2]];
};
const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(...v) || 1;
  return v.map((n) => clean(n / l)) as Vec3;
};
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
/** Rounds away floating noise from the source's 4–5 decimal matrices. */
export const clean = (n: number) => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
};

type Tri = [Vec3, Vec3, Vec3];
/** Sign that turns a CCW polygon's cross product into its outward normal in
 * LDraw's axes (pinned against a brick's top face in the unit tests). */
const WINDING = 1;

/** A stud primitive found in the subfile tree. */
export type StudFrame = {
  /** Where the stud leaves the surface: its top less one stud height (4 LDU). */
  base: Vec3;
  /** Unit direction the stud points. */
  axis: Vec3;
  name: string;
};

/**
 * Flattens a part: stud primitives, tube count and all polygons in part space.
 * `inStud[i]` marks triangles drawn by a stud primitive: they still close a
 * cavity below a stud but are not part of the body occupancy.
 */
export function flatten(sources: Record<string, string>, ref: string) {
  const studs: StudFrame[] = [];
  const tris: Tri[] = [];
  const inStud: boolean[] = [];
  /** Outward unit normal from BFC winding, or null where a file is not certified. */
  const outward: (Vec3 | null)[] = [];
  const cylinders: Vec3[] = [];
  const round: [number, number][] = [];
  let tubes = 0,
    work = 0;
  const visit = (
    name: string,
    frame: Frame,
    depth: number,
    inPrimitive: boolean,
    stud: boolean,
    /** Inherited BFC inversion; null when an ancestor is not certified. */
    inverted: boolean | null,
  ) => {
    if (depth > 32) throw new Error("Connector extraction too deep: " + ref);
    const text = sources[name];
    if (text === undefined) throw new Error("Missing source " + name);
    let certified: boolean | null = null,
      ccw = true,
      invertNext = false;
    for (const raw of text.split(/\r?\n/)) {
      if (++work > 5_000_000) throw new Error("Extraction budget: " + ref);
      const t = raw.trim().split(/\s+/);
      if (t[0] === "0" && t[1] === "BFC") {
        if (certified === false) continue;
        if (t.includes("NOCERTIFY")) certified = false;
        else {
          certified = true;
          if (t.includes("CW")) ccw = false;
          if (t.includes("CCW")) ccw = true;
          if (t.includes("INVERTNEXT")) invertNext = true;
        }
        continue;
      }
      if (/^[1-5]$/.test(t[0]) && certified === null) certified = false;
      const invertThis = invertNext;
      if (t[0] && t[0] !== "0") invertNext = false;
      const state = certified && inverted !== null ? inverted : null;
      if (t[0] === "1") {
        const v = t.slice(2, 14).map(Number);
        const child = canonical(t.slice(14).join(" "));
        const next: Frame = {
          p: apply(frame, v.slice(0, 3) as Vec3),
          m: mul(frame.m, v.slice(3)),
        };
        // A stud-sized cylinder (radius 6, length 4) outside the stud and tube
        // primitives may be a hand-modelled stud the extractor cannot see.
        const col = (i: number) =>
          Math.hypot(next.m[i], next.m[3 + i], next.m[6 + i]);
        if (
          !inPrimitive &&
          /^4-4cyli\.dat$/.test(child) &&
          Math.abs(col(0) - 6) < 0.01 &&
          Math.abs(col(2) - 6) < 0.01 &&
          Math.abs(col(1) - 4) < 0.01
        )
          cylinders.push(next.p.map(clean) as Vec3);
        // Upright round primitives of pin size (radius 1.8–3.6) mark where a
        // hinge socket may be; the socket itself is then tested geometrically.
        if (
          !inPrimitive &&
          /^\d+-\d+(cyli|cylo|cylc|edge|ndis|disc)\.dat$/.test(child) &&
          Math.abs(next.m[1]) < 1e-6 &&
          Math.abs(next.m[7]) < 1e-6 &&
          Math.abs(col(0) - col(2)) < 0.01 &&
          col(0) >= 1.8 &&
          col(0) <= 3.6
        )
          round.push([clean(next.p[0]), clean(next.p[2])]);
        const isStud = STUD_PRIMITIVES.has(child);
        if (isStud) {
          // A stretched stud primitive (a stud rising out of a sloped or
          // recessed surface) keeps its 4 LDU top: the connection sits one
          // stud height below the top, not at the primitive's origin.
          const axis = unit(mv(next.m, [0, -1, 0]));
          const top = apply(next, [0, -4, 0]);
          studs.push({
            base: top.map((n, i) => clean(n - 4 * axis[i])) as Vec3,
            axis,
            name: child,
          });
        }
        if (TUBE_PRIMITIVES.has(child)) tubes++;
        visit(
          child,
          next,
          depth + 1,
          inPrimitive || isStud || TUBE_PRIMITIVES.has(child),
          stud || isStud,
          state === null ? null : state !== invertThis,
        );
      } else if (t[0] === "3" || t[0] === "4") {
        const n = t[0] === "3" ? 3 : 4;
        const pts = Array.from({ length: n }, (_, i) =>
          apply(frame, t.slice(2 + i * 3, 5 + i * 3).map(Number) as Vec3),
        );
        // The drawn winding, corrected for CW files, INVERTNEXT and mirroring
        // transforms, tells which side of the face the part's material is on.
        let normal: Vec3 | null = null;
        if (state !== null) {
          const g = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
          const l = Math.hypot(...g);
          const m = frame.m;
          const det =
            m[0] * (m[4] * m[8] - m[5] * m[7]) -
            m[1] * (m[3] * m[8] - m[5] * m[6]) +
            m[2] * (m[3] * m[7] - m[4] * m[6]);
          const sign =
            WINDING * (ccw ? 1 : -1) * (state ? -1 : 1) * (det < 0 ? -1 : 1);
          if (l > 1e-12) normal = g.map((v) => (sign * v) / l) as Vec3;
        }
        tris.push([pts[0], pts[1], pts[2]]);
        inStud.push(stud);
        outward.push(normal);
        if (n === 4) {
          tris.push([pts[0], pts[2], pts[3]]);
          inStud.push(stud);
          outward.push(normal);
        }
      }
    }
  };
  visit(
    ref,
    { p: [0, 0, 0], m: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
    0,
    false,
    false,
    false,
  );
  // An open (hollow) stud draws its inner wall as a stud-sized cylinder at the
  // stud's own base; only cylinders away from every recognised stud are suspect.
  const warnings = cylinders
    .filter((c) => !studs.some((s) => Math.hypot(...sub(c, s.base)) < 0.5))
    .map(
      (c) => "Stud-sized cylinder outside stud primitives at " + c.join(" "),
    );
  const axes = [...new Map(round.map((r) => [r.join(","), r])).values()];
  return { studs, tris, inStud, outward, tubes, warnings, roundAxes: axes };
}

/** XZ bucket index of triangles for receptor tests. */
export class TriIndex {
  cell = 10;
  map = new Map<string, number[]>();
  constructor(public tris: Tri[]) {
    tris.forEach((t, i) => {
      const xs = t.map((p) => p[0]),
        zs = t.map((p) => p[2]);
      for (
        let x = Math.floor(Math.min(...xs) / this.cell);
        x <= Math.floor(Math.max(...xs) / this.cell);
        x++
      )
        for (
          let z = Math.floor(Math.min(...zs) / this.cell);
          z <= Math.floor(Math.max(...zs) / this.cell);
          z++
        ) {
          const k = x + "," + z;
          const list = this.map.get(k);
          if (list) list.push(i);
          else this.map.set(k, [i]);
        }
    });
  }
  near(x0: number, z0: number, x1: number, z1: number) {
    const out = new Set<number>();
    for (
      let x = Math.floor(x0 / this.cell);
      x <= Math.floor(x1 / this.cell);
      x++
    )
      for (
        let z = Math.floor(z0 / this.cell);
        z <= Math.floor(z1 / this.cell);
        z++
      )
        for (const i of this.map.get(x + "," + z) ?? []) out.add(i);
    return [...out].map((i) => this.tris[i]);
  }
}

/** Clips a triangle to the slab lo ≤ y ≤ hi; returns the polygon's XZ points. */
function clipSlab(t: Tri, lo: number, hi: number): [number, number][] {
  let poly: Vec3[] = [...t];
  for (const [bound, keepBelow] of [
    [hi, true],
    [lo, false],
  ] as const) {
    const out: Vec3[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length];
      const ina = keepBelow ? a[1] <= bound : a[1] >= bound;
      const inb = keepBelow ? b[1] <= bound : b[1] >= bound;
      if (ina) out.push(a);
      if (ina !== inb) {
        const s = (bound - a[1]) / (b[1] - a[1]);
        out.push([a[0] + s * (b[0] - a[0]), bound, a[2] + s * (b[2] - a[2])]);
      }
    }
    poly = out;
    if (!poly.length) return [];
  }
  return poly.map((p) => [p[0], p[2]]);
}
/** Clips a polygon to an axis-aligned box (inclusive); returns the remaining points. */
export function clipBox(poly: Vec3[], box: Box): Vec3[] {
  for (let axis = 0; axis < 3; axis++)
    for (const [bound, keepBelow] of [
      [box.max[axis], true],
      [box.min[axis], false],
    ] as const) {
      const out: Vec3[] = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i],
          b = poly[(i + 1) % poly.length];
        const ina = keepBelow ? a[axis] <= bound : a[axis] >= bound;
        const inb = keepBelow ? b[axis] <= bound : b[axis] >= bound;
        if (ina) out.push(a);
        if (ina !== inb) {
          const s = (bound - a[axis]) / (b[axis] - a[axis]);
          const p = a.map((v, k) => v + s * (b[k] - v)) as Vec3;
          p[axis] = bound;
          out.push(p);
        }
      }
      poly = out;
      if (!poly.length) return [];
    }
  return poly;
}
function segDist(
  px: number,
  pz: number,
  a: [number, number],
  b: [number, number],
) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const l = dx * dx + dz * dz;
  const s = l
    ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l))
    : 0;
  return Math.hypot(px - a[0] - s * dx, pz - a[1] - s * dz);
}
/** Minimum XZ distance from a point to a convex polygon (0 when inside). */
function polyDist(px: number, pz: number, poly: [number, number][]) {
  if (poly.length === 1) return Math.hypot(px - poly[0][0], pz - poly[0][1]);
  let inside = poly.length >= 3,
    sign = 0,
    best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    best = Math.min(best, segDist(px, pz, a, b));
    const c = (b[0] - a[0]) * (pz - a[1]) - (b[1] - a[1]) * (px - a[0]);
    if (Math.abs(c) > 1e-9) {
      if (sign === 0) sign = Math.sign(c);
      else if (Math.sign(c) !== sign) inside = false;
    }
  }
  return inside && sign !== 0 ? 0 : best;
}
/** Möller–Trumbore; returns hit distance along dir or null. */
function ray(o: Vec3, d: Vec3, t: Tri): number | null {
  const e1 = t[1].map((v, i) => v - t[0][i]) as Vec3,
    e2 = t[2].map((v, i) => v - t[0][i]) as Vec3;
  const p: Vec3 = [
    d[1] * e2[2] - d[2] * e2[1],
    d[2] * e2[0] - d[0] * e2[2],
    d[0] * e2[1] - d[1] * e2[0],
  ];
  const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
  if (Math.abs(det) < 1e-12) return null;
  const s = o.map((v, i) => v - t[0][i]) as Vec3;
  const u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) / det;
  if (u < -1e-9 || u > 1 + 1e-9) return null;
  const q: Vec3 = [
    s[1] * e1[2] - s[2] * e1[1],
    s[2] * e1[0] - s[0] * e1[2],
    s[0] * e1[1] - s[1] * e1[0],
  ];
  const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det;
  if (v < -1e-9 || u + v > 1 + 1e-9) return null;
  const dist = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
  return dist > 1e-6 ? dist : null;
}

/** Stud radius 6 LDU and height 4 LDU, less a small fit allowance. */
export const RECEPTOR = { radius: 5.8, depth: 3.8 };

export type ReceptorTest = {
  clear: boolean;
  ceiling: boolean;
  enclosed: boolean;
};
/** Tests whether a stud standing on the bottom plane at (x, z) fits into the part. */
export function receptorTest(
  index: TriIndex,
  x: number,
  z: number,
  bottom: number,
): ReceptorTest {
  const r = RECEPTOR.radius;
  const lo = bottom - RECEPTOR.depth,
    hi = bottom + 0.01;
  let clear = true;
  for (const t of index.near(x - r, z - r, x + r, z + r)) {
    const poly = clipSlab(t, lo, hi);
    if (poly.length && polyDist(x, z, poly) < r - 1e-6) {
      clear = false;
      break;
    }
  }
  if (!clear) return { clear, ceiling: false, enclosed: false };
  // Something of the part must close the cavity above the stud.
  // Sampled over the stud's top face, so an open (hollow) receptor still counts.
  const samples: [number, number][] = [[0.013, 0.007]];
  for (let k = 0; k < 8; k++)
    samples.push([
      5 * Math.cos((k * Math.PI) / 4 + 0.1),
      5 * Math.sin((k * Math.PI) / 4 + 0.1),
    ]);
  const up = samples.flatMap(([dx, dz]) =>
    index
      .near(x + dx - 0.5, z + dz - 0.5, x + dx + 0.5, z + dz + 0.5)
      .map((t) => ray([x + dx, bottom, z + dz], [0, -1, 0], t))
      .filter((d): d is number => d !== null),
  );
  const ceiling = up.some((d) => d >= RECEPTOR.depth);
  if (!ceiling) return { clear, ceiling, enclosed: false };
  // Walls, tubes or pins must bound the cavity in every horizontal direction.
  const y = bottom - 2;
  const enclosed = (
    [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, 1],
      [0, 0, -1],
    ] as Vec3[]
  ).every((d) =>
    index.tris.some((t) => ray([x + 0.013, y, z + 0.007], d, t) !== null),
  );
  return { clear, ceiling, enclosed };
}

/** Room a stud needs above its base: one stud cell across, one plate high. */
export const STUD_ROOM = { half: 9.5, height: 8, lift: 0.3 };
/** Two unit vectors completing `axis` to an orthonormal frame. */
function perpendiculars(axis: Vec3): [Vec3, Vec3] {
  const ref: Vec3 = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const a = cross(axis, ref);
  const l = Math.hypot(...a);
  const e1 = a.map((v) => v / l) as Vec3;
  return [e1, cross(axis, e1)];
}
/**
 * Geometric checks of one stud against the part's own body (stud primitives
 * excluded): `seated` when rays around the stud (radius 9) meet the
 * body within 1 LDU below its base; `exposed` when a 19 × 19 LDU cell, one
 * plate (8 LDU) high above the base, contains none of the body — room for the
 * part that will sit on it.
 */
export function studChecks(body: Tri[], stud: { p: Vec3; axis: Vec3 }) {
  const [e1, e2] = perpendiculars(stud.axis);
  const { half, height, lift } = STUD_ROOM;
  let hits = 0;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + 0.05;
    const o = stud.p.map(
      (v, i) =>
        v +
        9 * Math.cos(a) * e1[i] +
        9 * Math.sin(a) * e2[i] +
        lift * stud.axis[i],
    ) as Vec3;
    const d = stud.axis.map((v) => -v) as Vec3;
    if (
      body.some((t) => {
        const h = ray(o, d, t);
        return h !== null && h <= lift + 1;
      })
    )
      hits++;
  }
  const seated = hits >= 4;
  // The room above the base, in the stud's own frame (e1, axis, e2).
  const toLocal = (p: Vec3): Vec3 => {
    const d = sub(p, stud.p);
    return [dot(d, e1), dot(d, stud.axis), dot(d, e2)];
  };
  const room: Box = {
    min: [-half, lift, -half],
    max: [half, height, half],
  };
  const exposed = !body.some((t) => {
    const local = t.map(toLocal);
    for (let i = 0; i < 3; i++) {
      if (Math.max(...local.map((p) => p[i])) < room.min[i]) return false;
      if (Math.min(...local.map((p) => p[i])) > room.max[i]) return false;
    }
    return clipBox(local, room).length > 0;
  });
  return { seated, exposed };
}

/**
 * A door's hinge: two pins on one upright axis, leaving the leaf at its top and
 * bottom. Positions are in the part's LDraw space.
 */
export type HingePins = {
  /** Where the upper pin leaves the leaf's top face (on the hinge axis). */
  top: Vec3;
  /** Where the lower pin leaves the leaf's bottom face. */
  bottom: Vec3;
  /** Unit hinge axis (LDraw −Y: pointing up). */
  axis: Vec3;
  /** Longest pin beyond the leaf, LDU. */
  protrusion: number;
  /** Largest pin radius, LDU. */
  radius: number;
};
/** A frame's hinge sockets: two holes on one upright axis, opening towards the door. */
export type HingeSocket = {
  /** Opening of the upper socket (the lintel's underside, on the axis). */
  top: Vec3;
  /** Opening of the lower socket (the sill's top face, on the axis). */
  bottom: Vec3;
  /** Shallower of the two holes, LDU. */
  depth: number;
};
/** Pin tips must lie within this radius of the axis; the leaf starts beyond LEAF. */
export const HINGE = {
  tip: 3,
  leaf: 4.5,
  rim: 3.2,
  core: 1.9,
  minDepth: 0.7,
  /** Sockets closer than this are not a door or window opening. */
  minSpan: 16,
  /** Recorded socket depths are capped here (a through hole). */
  maxDepth: 8,
};

/**
 * Finds a door's hinge pins in its geometry: the part's highest and lowest
 * points must both be narrow tips (within 3 LDU of their centre) on one
 * upright axis, the leaf (anything further than 4.5 LDU from the axis) must
 * start below the upper tip and end above the lower one, and the leaf must
 * reach at least one stud (20 LDU) from the axis.
 */
export function hingePins(body: Tri[]): HingePins | null {
  const pts = body.flat();
  if (!pts.length) return null;
  const ys = pts.map((p) => p[1]);
  const ymin = Math.min(...ys),
    ymax = Math.max(...ys);
  const centre = (list: Vec3[]) =>
    [0, 2].map((i) => list.reduce((s, p) => s + p[i], 0) / list.length);
  const topTips = pts.filter((p) => p[1] <= ymin + 0.5),
    bottomTips = pts.filter((p) => p[1] >= ymax - 0.5);
  const [ax, az] = centre(topTips),
    [bx, bz] = centre(bottomTips);
  if (Math.hypot(ax - bx, az - bz) > 0.1) return null;
  const radial = (p: Vec3) => Math.hypot(p[0] - ax, p[2] - az);
  if ([...topTips, ...bottomTips].some((p) => radial(p) > HINGE.tip))
    return null;
  const leaf = pts.filter((p) => radial(p) > HINGE.leaf);
  if (!leaf.length || Math.max(...leaf.map(radial)) < 20) return null;
  const leafTop = Math.min(...leaf.map((p) => p[1])),
    leafBottom = Math.max(...leaf.map((p) => p[1]));
  const protrusion = Math.max(leafTop - ymin, ymax - leafBottom);
  if (leafTop - ymin < 0.25 || ymax - leafBottom < 0.25 || protrusion > 6)
    return null;
  const pins = pts.filter(
    (p) => p[1] < leafTop - 1e-6 || p[1] > leafBottom + 1e-6,
  );
  return {
    top: [clean(ax), clean(leafTop), clean(az)],
    bottom: [clean(ax), clean(leafBottom), clean(az)],
    axis: [0, -1, 0],
    protrusion: clean(protrusion),
    radius: clean(Math.max(...pins.map(radial))),
  };
}

/**
 * Tests upright hinge-socket candidates (`axes`: x/z of pin-sized round
 * primitives) against a frame's geometry. From the frame's mid-height, rays
 * at 3.2 LDU around the axis must all meet the sill below and the lintel above
 * on one plane each (within 0.5 LDU); rays on the axis and 1.9 LDU around it
 * must pass those planes by at least 0.7 LDU: a hole a pin fits into.
 */
export function hingeSockets(
  body: Tri[],
  axes: readonly [number, number][],
): HingeSocket[] {
  if (!body.length) return [];
  const index = new TriIndex(body);
  const ys = body.flat().map((p) => p[1]);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  const first = (x: number, z: number, dir: 1 | -1) => {
    let best = Infinity;
    for (const t of index.near(x - 0.1, z - 0.1, x + 0.1, z + 0.1)) {
      const d = ray([x, mid, z], [0, dir, 0], t);
      if (d !== null) best = Math.min(best, d);
    }
    return best;
  };
  const ring = (r: number) =>
    Array.from({ length: 8 }, (_, k) => {
      const a = (k * Math.PI) / 4 + 0.07;
      return [r * Math.cos(a), r * Math.sin(a)] as const;
    });
  const out: HingeSocket[] = [];
  for (const [x, z] of axes) {
    const plane = (dir: 1 | -1) => {
      const hits = ring(HINGE.rim).map(([dx, dz]) =>
        first(x + dx, z + dz, dir),
      );
      if (hits.some((h) => !Number.isFinite(h))) return null;
      if (Math.max(...hits) - Math.min(...hits) > 0.5) return null;
      const surface = Math.min(...hits);
      const core = Math.min(
        first(x + 0.013, z + 0.007, dir),
        ...ring(HINGE.core).map(([dx, dz]) => first(x + dx, z + dz, dir)),
      );
      return { at: mid + dir * surface, depth: core - surface };
    };
    const below = plane(1),
      above = plane(-1);
    if (!below || !above) continue;
    const depth = Math.min(below.depth, above.depth);
    if (depth < HINGE.minDepth || below.at - above.at < HINGE.minSpan) continue;
    out.push({
      top: [x, clean(above.at), z],
      bottom: [x, clean(below.at), z],
      depth: clean(Math.min(depth, HINGE.maxDepth)),
    });
  }
  return out;
}

/** Occupancy cell size: one stud cell across, a half plate (4 LDU) high. */
export const OCCUPANCY = { cell: 20, slab: 4, minThickness: 0.6, step: 0.05 };
/**
 * Body occupancy of a part as a short list of boxes in its own space. The body
 * triangles (stud primitives excluded, so a stud entering a receptor is never a
 * clash) are clipped to cells of one stud across (on the part's own lattice)
 * and 4 LDU high; each cell keeps the tight box of what lies in it. A face
 * lying on a cell boundary counts only for the cell its material is on (from
 * the BFC winding; both cells when the file is not certified), and an edge
 * merely touching a cell does not count at all, so a ledge or a recess stays a
 * step rather than filling its whole cell. Faces thinner than 0.6 LDU are
 * widened to 0.6 (within their cell) so a wall split across two cells still
 * stops a part passing through it. Boxes are rounded outward to 0.05 LDU and
 * merged where they tile exactly. Surfaces, not solids: a part wholly inside
 * another's hollow is not detected.
 */
export function occupancyBoxes(
  body: Tri[],
  normals: readonly (Vec3 | null)[],
  align: readonly number[],
): Box[] {
  const { cell, slab, minThickness, step } = OCCUPANCY;
  const origin: Vec3 = [align[0] % cell, 0, align[1] % cell];
  const size: Vec3 = [cell, slab, cell];
  const cells = new Map<string, Box & { cell: Box }>();
  const on = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  for (const [ti, t] of body.entries()) {
    const normal = normals[ti];
    // A face on a cell boundary is offered to both cells it touches.
    const lo = [0, 1, 2].map(
      (i) =>
        Math.ceil((Math.min(...t.map((p) => p[i])) - origin[i]) / size[i]) - 1,
    );
    const hi = [0, 1, 2].map((i) =>
      Math.floor((Math.max(...t.map((p) => p[i])) - origin[i]) / size[i]),
    );
    for (let x = lo[0]; x <= hi[0]; x++)
      for (let y = lo[1]; y <= hi[1]; y++)
        for (let z = lo[2]; z <= hi[2]; z++) {
          const idx = [x, y, z];
          const box: Box = {
            min: idx.map((n, i) => origin[i] + n * size[i]) as Vec3,
            max: idx.map((n, i) => origin[i] + (n + 1) * size[i]) as Vec3,
          };
          const poly = clipBox([...t], box);
          if (!poly.length) continue;
          // What is left lies wholly in one of the cell's boundary planes: keep
          // it only if it is a face of that plane with its material inside.
          const boundary = [0, 1, 2].some((i) => {
            const side = poly.every((p) => on(p[i], box.min[i]))
              ? -1
              : poly.every((p) => on(p[i], box.max[i]))
                ? 1
                : 0;
            if (!side) return false;
            const face = t.every((p) => on(p[i], t[0][i]));
            if (!face) return true;
            return normal !== null && normal[i] * side < 0.5;
          });
          if (boundary) continue;
          const k = idx.join(",");
          const found = cells.get(k) ?? {
            cell: box,
            min: [Infinity, Infinity, Infinity] as Vec3,
            max: [-Infinity, -Infinity, -Infinity] as Vec3,
          };
          for (const p of poly)
            for (let i = 0; i < 3; i++) {
              found.min[i] = Math.min(found.min[i], p[i]);
              found.max[i] = Math.max(found.max[i], p[i]);
            }
          cells.set(k, found);
        }
  }
  const snap = (n: number, up: boolean) => {
    const v = (up ? Math.ceil : Math.floor)(n / step - 1e-6 * (up ? 1 : -1));
    return clean(v * step);
  };
  let boxes: Box[] = [...cells.values()].map((b) => {
    const min = [...b.min] as Vec3,
      max = [...b.max] as Vec3;
    for (let i = 0; i < 3; i++) {
      if (max[i] - min[i] >= minThickness) continue;
      // A face on the cell's own boundary is the neighbouring cell's business
      // (usually the part's outer face): widening it would push it outside.
      if (
        Math.abs(max[i] - b.cell.min[i]) < 1e-6 ||
        Math.abs(min[i] - b.cell.max[i]) < 1e-6
      )
        continue;
      // Widen within the cell only, so the box never leaves the geometry's cell.
      const c = (min[i] + max[i]) / 2;
      const lo = Math.max(b.cell.min[i], c - minThickness / 2);
      const hi = Math.min(b.cell.max[i], lo + minThickness);
      min[i] = Math.min(min[i], hi - minThickness);
      max[i] = Math.max(max[i], hi);
      min[i] = Math.max(min[i], b.cell.min[i]);
    }
    return {
      min: min.map((n) => snap(n, false)) as Vec3,
      max: max.map((n) => snap(n, true)) as Vec3,
    };
  });
  // A flat box (a face on a cell boundary) can never overlap anything by
  // more than the clash margin; the neighbouring cell carries that face.
  boxes = boxes.filter((b) => [0, 1, 2].every((i) => b.max[i] > b.min[i]));
  // Merge boxes that tile exactly along one axis, until nothing changes.
  for (let changed = true; changed; ) {
    changed = false;
    for (const axis of [0, 2, 1]) {
      const others = [0, 1, 2].filter((i) => i !== axis);
      const groups = new Map<string, Box[]>();
      for (const b of boxes) {
        const k = others.map((i) => b.min[i] + ":" + b.max[i]).join("|");
        const list = groups.get(k);
        if (list) list.push(b);
        else groups.set(k, [b]);
      }
      const next: Box[] = [];
      for (const list of groups.values()) {
        list.sort((a, b) => a.min[axis] - b.min[axis]);
        let run = list[0];
        for (const b of list.slice(1)) {
          if (b.min[axis] <= run.max[axis] + 1e-6) {
            if (b.max[axis] > run.max[axis]) {
              run = {
                min: [...run.min] as Vec3,
                max: [...run.max] as Vec3,
              };
              run.max[axis] = b.max[axis];
            }
            changed = true;
          } else {
            next.push(run);
            run = b;
          }
        }
        next.push(run);
      }
      boxes = next;
    }
  }
  return boxes.sort(
    (a, b) => a.min[1] - b.min[1] || a.min[0] - b.min[0] || a.min[2] - b.min[2],
  );
}

/**
 * Derives the connectors of one part. Receptors are sought on the lowest plane
 * of its body geometry; `bounds` (the catalogue's conservative source box) is
 * used only when the part has no body geometry.
 */
export function extractConnectors(
  sources: Record<string, string>,
  ref: string,
  bounds: { min: number[]; max: number[] },
  /** Catalogue origin phase (0 or 10 LDU); stud-cell centres sit at phase + 10. */
  align: readonly number[],
): Extraction {
  const flat = flatten(sources, ref);
  const bodyTris = flat.tris.filter((_, i) => !flat.inStud[i]);
  const connectors: RawConnector[] = flat.studs.map((s) => ({
    kind: "stud" as const,
    p: s.base,
    axis: s.axis,
    source: s.name,
    ...studChecks(bodyTris, { p: s.base, axis: s.axis }),
  }));
  const warnings = [...flat.warnings];
  // The catalogue box is conservative (it can reach past curved geometry), so
  // the receptor plane and lattice come from the body triangles themselves.
  const points = bodyTris.flat();
  const body: Box = points.length
    ? {
        min: [0, 1, 2].map((i) =>
          clean(Math.min(...points.map((p) => p[i]))),
        ) as Vec3,
        max: [0, 1, 2].map((i) =>
          clean(Math.max(...points.map((p) => p[i]))),
        ) as Vec3,
      }
    : {
        min: bounds.min.map(clean) as Vec3,
        max: bounds.max.map(clean) as Vec3,
      };
  const bottom = body.max[1];
  const index = new TriIndex(flat.tris);
  const px = (align[0] + 10) % 20,
    pz = (align[1] + 10) % 20;
  const cells = (lo: number, hi: number, ph: number) => {
    const out: number[] = [];
    for (let v = Math.ceil((lo + 6 - ph) / 20) * 20 + ph; v <= hi - 6; v += 20)
      out.push(clean(v));
    return out;
  };
  const lattice: Cell[] = [];
  for (const x of cells(body.min[0], body.max[0], px))
    for (const z of cells(body.min[2], body.max[2], pz)) {
      const test = receptorTest(index, x, z, bottom);
      const state: Cell["state"] = !test.clear
        ? "blocked"
        : !test.ceiling
          ? "open"
          : test.enclosed
            ? "receptor"
            : "unenclosed";
      lattice.push({ x, z, state });
      if (state === "receptor")
        connectors.push({
          kind: "antistud",
          p: [x, clean(bottom), z],
          axis: [0, 1, 0],
          source: "cavity-test",
        });
    }
  // Hinge pins (doors) and hinge sockets (frames). A pin entering its socket is
  // no clash, so pin geometry beyond the leaf stays out of the occupancy.
  const pins = hingePins(bodyTris);
  const sockets = hingeSockets(bodyTris, flat.roundAxes);
  if (pins)
    connectors.push(
      { kind: "pin", p: pins.top, axis: [0, -1, 0], source: "hinge-test" },
      { kind: "pin", p: pins.bottom, axis: [0, 1, 0], source: "hinge-test" },
    );
  for (const s of sockets)
    connectors.push(
      { kind: "socket", p: s.top, axis: [0, 1, 0], source: "hinge-test" },
      { kind: "socket", p: s.bottom, axis: [0, -1, 0], source: "hinge-test" },
    );
  const beyondLeaf = (t: Tri) =>
    !!pins &&
    t.every(
      (p) =>
        (p[1] < pins.top[1] + 1e-6 || p[1] > pins.bottom[1] - 1e-6) &&
        Math.hypot(p[0] - pins.top[0], p[2] - pins.top[2]) <= HINGE.leaf,
    );
  const bodyNormals = flat.outward.filter((_, i) => !flat.inStud[i]);
  const occupied = bodyTris.filter((t) => !beyondLeaf(t));
  return {
    connectors,
    cells: lattice,
    tubes: flat.tubes,
    triangles: flat.tris.length,
    bottom,
    body,
    pins,
    sockets,
    occupancy: occupancyBoxes(
      occupied,
      bodyNormals.filter((_, i) => !beyondLeaf(bodyTris[i])),
      align,
    ),
    warnings,
  };
}

export type Rule =
  | "full-underside"
  | "matched-outline"
  | "solid-base"
  | "jumper"
  | "side-studs"
  | "partial-underside"
  | "hinge-leaf";
export type Verification = {
  verified: boolean;
  /** Rule that verified the part, or the reasons it was not. */
  rule?: Rule;
  reasons: string[];
};
const key = (x: number, z: number) => clean(x) + "," + clean(z);
const isUpright = (c: RawConnector) =>
  c.axis[0] === 0 && c.axis[1] === -1 && c.axis[2] === 0;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const plates = (rise: number) =>
  rise > 0 && Math.abs(rise / 8 - Math.round(rise / 8)) < 1e-6;
/** Side studs a part's name promises, or null when the name says nothing. */
function namedSideStuds(name: string, perFace: number): number | null {
  const n = /(\d+) Side Studs/.exec(name);
  if (n) return Number(n[1]);
  if (/Stud on Side|Headlight/.test(name)) return 1;
  if (/with Side Studs/.test(name)) return perFace;
  return null;
}

/**
 * Side studs of a side-stud brick: each points straight out of one face, is
 * centred on a stud cell along it and 10 LDU below the top studs (a SNOT
 * stud's standard height), stands on the body at most 4 LDU inside the face
 * (a headlight brick's recess) and has room for a part. Their number must
 * match the part's name.
 */
function sideStudReasons(
  part: { name: string },
  e: Extraction,
  upright: RawConnector[],
  side: RawConnector[],
): string[] {
  const reasons: string[] = [];
  const xs = [...new Set(e.cells.map((c) => c.x))],
    zs = [...new Set(e.cells.map((c) => c.z))];
  const top = upright.length ? upright[0].p[1] : null;
  const faces = new Set<string>();
  for (const s of side) {
    const along = s.axis.findIndex((v) => Math.abs(v) === 1);
    if (along < 0 || along === 1 || s.axis.some((v, i) => i !== along && v)) {
      reasons.push("A side stud does not point straight out of a side face");
      continue;
    }
    faces.add(s.axis.join(","));
    const sign = s.axis[along];
    const face = sign > 0 ? e.body.max[along] : e.body.min[along];
    const inset = (face - s.p[along]) * sign;
    if (inset < -1e-6 || inset > 4 + 1e-6)
      reasons.push("A side stud does not stand on its face");
    const across = along === 0 ? s.p[2] : s.p[0];
    if (!(along === 0 ? zs : xs).some((v) => near(v, across)))
      reasons.push("A side stud is not centred on a stud cell");
    if (top === null || !near(s.p[1], top + 10))
      reasons.push("A side stud is not 10 LDU below the top studs");
    if (!s.seated || !s.exposed)
      reasons.push(
        "A side stud is not seated on the body with room for a part",
      );
  }
  const perFace = Math.max(xs.length, zs.length);
  const named = namedSideStuds(part.name, perFace);
  if (named === null)
    reasons.push("The part's name does not describe side studs");
  else if (named !== side.length)
    reasons.push(`The name promises ${named} side studs; ${side.length} found`);
  return [...new Set(reasons)];
}

/**
 * Independent cross-checks between the two derivations (stud primitives on top,
 * cavity tests underneath), the geometric stud checks and the catalogue's own
 * footprint and name. A part is verified only when one whole-part rule holds;
 * see docs/CONNECTORS.md.
 */
export function verifyConnectors(
  part: { name: string; width: number; depth: number; category?: string },
  e: Extraction,
): Verification {
  const reasons: string[] = [];
  const studs = e.connectors.filter((c) => c.kind === "stud");
  const receptors = e.connectors.filter((c) => c.kind === "antistud");
  const upright = studs.filter(isUpright);
  const side = studs.filter((c) => !isUpright(c));
  // Rule: a hinged leaf (door or window pane). Its connection is the pair of
  // hinge pins found in its geometry; any studs on it (a handle) are recorded
  // but not part of the verified connection.
  if (e.pins) {
    if (
      part.category === "Windows & doors" &&
      /\b(Door|Pane)\b/.test(part.name) &&
      !/Frame|Glass/.test(part.name)
    )
      return { verified: true, rule: "hinge-leaf", reasons: [] };
    reasons.push("Hinge-like pins on a part that is not a door or window pane");
  }
  if (e.warnings.length) reasons.push(...e.warnings);
  if (part.category === "Brackets & hinges")
    reasons.push(
      "Its principal connection (bracket or hinge) is not a stud connection",
    );
  const sideReasons = side.length
    ? sideStudReasons(part, e, upright, side)
    : [];
  if (sideReasons.length)
    reasons.push(
      `${side.length} stud(s) not pointing up could not be validated as side studs`,
      ...sideReasons,
    );
  const tops = [...new Set(upright.map((c) => c.p[1]))];
  const partialFamily =
    part.category === "Slopes" || part.category === "Arches";
  if (tops.length > 1 && !partialFamily)
    reasons.push("Studs on more than one level");
  if (receptors.length && tops.some((y) => !plates(e.bottom - y)))
    reasons.push(
      "Stud level is not a whole number of plate heights (8 LDU) above the base",
    );
  if (Math.abs(e.bottom / 4 - Math.round(e.bottom / 4)) > 1e-6)
    reasons.push("Base plane is off the 4 LDU grid");
  const cells = new Map(e.cells.map((c) => [key(c.x, c.z), c.state]));
  const studCells = upright.map((c) => key(c.p[0], c.p[2]));
  const offLattice = upright.filter((c) => !cells.has(key(c.p[0], c.p[2])));
  // A jumper's stud sits half a stud off the lattice, between cells.
  const jumper =
    /Jumper/.test(part.name) &&
    offLattice.length > 0 &&
    offLattice.every((c) =>
      e.cells.some(
        (cell) =>
          [cell.x - c.p[0], cell.z - c.p[2]].every(
            (d) => near(Math.abs(d), 10) || near(d, 0),
          ) && !(near(cell.x, c.p[0]) && near(cell.z, c.p[2])),
      ),
    );
  if (offLattice.length && !jumper)
    reasons.push("A stud lies off the part's stud lattice");
  const allStudKeys = studs.map((c) => c.p.join(","));
  if (new Set(allStudKeys).size !== allStudKeys.length)
    reasons.push("Duplicate studs");
  if (reasons.length) return { verified: false, reasons };

  const dims = /(\d+) × (\d+)/.exec(part.name);
  const footprintMatches =
    !!dims &&
    ((Number(dims[1]) * 20 === part.width &&
      Number(dims[2]) * 20 === part.depth) ||
      (Number(dims[1]) * 20 === part.depth &&
        Number(dims[2]) * 20 === part.width));
  const expected = dims ? Number(dims[1]) * Number(dims[2]) : -1;
  const receptorCells = new Set(receptors.map((c) => key(c.p[0], c.p[2])));
  const states = e.cells.map((c) => c.state);
  const fullUnderside =
    footprintMatches &&
    e.cells.length === expected &&
    states.every((s) => s === "receptor");
  const roomy = (list: RawConnector[]) =>
    list.every((c) => c.seated && c.exposed);
  if (jumper) {
    // One stud, centred on the footprint, over a full underside.
    const cx = e.cells.reduce((s, c) => s + c.x, 0) / e.cells.length,
      cz = e.cells.reduce((s, c) => s + c.z, 0) / e.cells.length;
    if (
      fullUnderside &&
      upright.length === 1 &&
      near(upright[0].p[0], cx) &&
      near(upright[0].p[2], cz) &&
      roomy(upright)
    )
      return { verified: true, rule: "jumper", reasons: [] };
    return {
      verified: false,
      reasons: [
        "Jumper stud is not a single seated stud centred over a full underside",
      ],
    };
  }
  const studsOverReceptors = studCells.every((k) => receptorCells.has(k));
  // Rule 1: a whole rectangular underside, studs only above receptors.
  if (fullUnderside && studsOverReceptors && tops.length <= 1)
    return {
      verified: true,
      rule: side.length ? "side-studs" : "full-underside",
      reasons: [],
    };
  if (side.length)
    return {
      verified: false,
      reasons: ["Side-stud part without a full underside under its top studs"],
    };
  // Rule 2: a shaped outline (round, wedge): every cell is a receptor or lies
  // outside the body, and receptors sit exactly under the studs.
  if (
    tops.length === 1 &&
    studs.length > 0 &&
    receptors.length === studs.length &&
    studsOverReceptors &&
    states.every((s) => s !== "blocked")
  )
    return { verified: true, rule: "matched-outline", reasons: [] };
  // Rule 3: a solid base (baseplates): no cavity anywhere, a full stud grid on top.
  if (
    tops.length === 1 &&
    footprintMatches &&
    receptors.length === 0 &&
    states.every((s) => s === "blocked") &&
    studs.length === expected &&
    e.cells.length === expected
  )
    return { verified: true, rule: "solid-base", reasons: [] };
  // Rule 4: slopes and arches whose underside is partly open (an arch's
  // opening, an inverted or curved slope's overhang): the footprint matches
  // the name, nothing obstructs any cell, at least one cell is a receptor and
  // every stud, on whatever level, stands on the body with room above it.
  if (
    partialFamily &&
    footprintMatches &&
    e.cells.length === expected &&
    receptors.length > 0 &&
    states.every((s) => s !== "blocked") &&
    roomy(upright)
  )
    return { verified: true, rule: "partial-underside", reasons: [] };
  const counts = (s: Cell["state"]) => states.filter((v) => v === s).length;
  return {
    verified: false,
    reasons: [
      `No whole-part rule holds (${studs.length} studs; underside cells: ${counts("receptor")} receptor, ${counts("open")} open, ${counts("blocked")} blocked, ${counts("unenclosed")} unenclosed)`,
    ],
  };
}
