// Build-time connector derivation from pinned LDraw geometry (no runtime use).
//
// Studs are recognised as the official stud primitives and carried through the
// subfile tree with their full transforms. Anti-studs (the receptors under a
// part that accept a stud) are not a primitive of their own: tubes, pins and
// walls only bound them. They are found by testing each stud-lattice cell of
// the part's bottom plane against the actual flattened triangles: a stud-sized
// cylinder must fit, the part must close over it, and walls or tubes must
// surround it. The method and its checks are documented in docs/CONNECTORS.md.
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
  kind: "stud" | "antistud";
  /** Local position in LDU: the stud base or the receptor opening centre. */
  p: Vec3;
  /** Unit direction the stud points, or the direction the receptor opens. */
  axis: Vec3;
  /** Primitive or test that produced the record. */
  source: string;
};
export type Cell = {
  x: number;
  z: number;
  /** receptor: a stud fits; blocked: geometry occupies the stud's space;
   * open: nothing of the part above (outside a shaped body); unenclosed: a
   * roof but no surrounding walls. */
  state: "receptor" | "blocked" | "open" | "unenclosed";
};
export type Extraction = {
  connectors: RawConnector[];
  /** Every stud-lattice cell of the base plane and its test result. */
  cells: Cell[];
  tubes: number;
  triangles: number;
  bottom: number;
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
/** Rounds away floating noise from the source's 4–5 decimal matrices. */
export const clean = (n: number) => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
};

type Tri = [Vec3, Vec3, Vec3];

/** Flattens a part: stud primitive frames, tube count and all polygons in part space. */
export function flatten(sources: Record<string, string>, ref: string) {
  const studs: { frame: Frame; name: string }[] = [];
  const tris: Tri[] = [];
  const warnings: string[] = [];
  let tubes = 0,
    work = 0;
  const visit = (
    name: string,
    frame: Frame,
    depth: number,
    inPrimitive: boolean,
  ) => {
    if (depth > 32) throw new Error("Connector extraction too deep: " + ref);
    const text = sources[name];
    if (text === undefined) throw new Error("Missing source " + name);
    for (const raw of text.split(/\r?\n/)) {
      if (++work > 5_000_000) throw new Error("Extraction budget: " + ref);
      const t = raw.trim().split(/\s+/);
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
          warnings.push(
            "Stud-sized cylinder outside stud primitives at " +
              next.p.map(clean).join(" "),
          );
        if (STUD_PRIMITIVES.has(child)) {
          // Its surfaces still count: a stud top can close a cavity below it.
          studs.push({ frame: next, name: child });
        }
        if (TUBE_PRIMITIVES.has(child)) tubes++;
        visit(
          child,
          next,
          depth + 1,
          inPrimitive ||
            STUD_PRIMITIVES.has(child) ||
            TUBE_PRIMITIVES.has(child),
        );
      } else if (t[0] === "3" || t[0] === "4") {
        const n = t[0] === "3" ? 3 : 4;
        const pts = Array.from({ length: n }, (_, i) =>
          apply(frame, t.slice(2 + i * 3, 5 + i * 3).map(Number) as Vec3),
        );
        tris.push([pts[0], pts[1], pts[2]]);
        if (n === 4) tris.push([pts[0], pts[2], pts[3]]);
      }
    }
  };
  visit(ref, { p: [0, 0, 0], m: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, 0, false);
  return { studs, tris, tubes, warnings };
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

/**
 * Derives the connectors of one part. `bounds` is the part's source box (LDraw
 * axes); receptors are sought on its lowest plane.
 */
export function extractConnectors(
  sources: Record<string, string>,
  ref: string,
  bounds: { min: number[]; max: number[] },
  /** Catalogue origin phase (0 or 10 LDU); stud-cell centres sit at phase + 10. */
  align: readonly number[],
): Extraction {
  const flat = flatten(sources, ref);
  const connectors: RawConnector[] = flat.studs.map((s) => ({
    kind: "stud" as const,
    p: s.frame.p.map(clean) as Vec3,
    axis: unit(mv(s.frame.m, [0, -1, 0])),
    source: s.name,
  }));
  const warnings = [...flat.warnings];
  const bottom = bounds.max[1];
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
  for (const x of cells(bounds.min[0], bounds.max[0], px))
    for (const z of cells(bounds.min[2], bounds.max[2], pz)) {
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
  return {
    connectors,
    cells: lattice,
    tubes: flat.tubes,
    triangles: flat.tris.length,
    bottom,
    warnings,
  };
}

export type Verification = {
  verified: boolean;
  /** Rule that verified the part, or the reasons it was not. */
  rule?: "full-underside" | "matched-outline" | "solid-base";
  reasons: string[];
};
const key = (x: number, z: number) => clean(x) + "," + clean(z);
/**
 * Independent cross-checks between the two derivations (stud primitives on top,
 * cavity tests underneath) and the catalogue's own footprint and name. A part
 * is verified only when one whole-part rule holds; see docs/CONNECTORS.md.
 */
export function verifyConnectors(
  part: { name: string; width: number; depth: number; category?: string },
  e: Extraction,
): Verification {
  const reasons: string[] = [];
  const studs = e.connectors.filter((c) => c.kind === "stud");
  const receptors = e.connectors.filter((c) => c.kind === "antistud");
  if (e.warnings.length) reasons.push(...e.warnings);
  if (part.category === "Brackets & hinges")
    reasons.push(
      "Its principal connection (bracket or hinge) is not a stud connection",
    );
  const sideways = studs.filter(
    (c) => !(c.axis[0] === 0 && c.axis[1] === -1 && c.axis[2] === 0),
  );
  if (sideways.length)
    reasons.push(
      `${sideways.length} stud(s) not pointing up; side connections are not validated`,
    );
  const tops = [...new Set(studs.map((c) => c.p[1]))];
  if (tops.length > 1) reasons.push("Studs on more than one level");
  if (tops.length === 1 && receptors.length) {
    const rise = e.bottom - tops[0];
    if (rise <= 0 || Math.abs(rise / 8 - Math.round(rise / 8)) > 1e-6)
      reasons.push(
        "Stud level is not a whole number of plate heights (8 LDU) above the base",
      );
  }
  if (Math.abs(e.bottom / 4 - Math.round(e.bottom / 4)) > 1e-6)
    reasons.push("Base plane is off the 4 LDU grid");
  const cells = new Map(e.cells.map((c) => [key(c.x, c.z), c.state]));
  const studCells = studs.map((c) => key(c.p[0], c.p[2]));
  if (studCells.some((k) => !cells.has(k)))
    reasons.push("A stud lies off the part's stud lattice");
  if (new Set(studCells).size !== studCells.length)
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
  // Rule 1: a whole rectangular underside, studs only above receptors.
  if (
    footprintMatches &&
    e.cells.length === expected &&
    states.every((s) => s === "receptor") &&
    studCells.every((k) => receptorCells.has(k))
  )
    return { verified: true, rule: "full-underside", reasons: [] };
  // Rule 2: a shaped outline (round, wedge): every cell is a receptor or lies
  // outside the body, and receptors sit exactly under the studs.
  if (
    studs.length > 0 &&
    receptors.length === studs.length &&
    studCells.every((k) => receptorCells.has(k)) &&
    states.every((s) => s !== "blocked")
  )
    return { verified: true, rule: "matched-outline", reasons: [] };
  // Rule 3: a solid base (baseplates): no cavity anywhere, a full stud grid on top.
  if (
    footprintMatches &&
    receptors.length === 0 &&
    states.every((s) => s === "blocked") &&
    studs.length === expected &&
    e.cells.length === expected
  )
    return { verified: true, rule: "solid-base", reasons: [] };
  const counts = (s: Cell["state"]) => states.filter((v) => v === s).length;
  return {
    verified: false,
    reasons: [
      `No whole-part rule holds (${studs.length} studs; underside cells: ${counts("receptor")} receptor, ${counts("open")} open, ${counts("blocked")} blocked, ${counts("unenclosed")} unenclosed)`,
    ],
  };
}
