import { compose, identity, rotationY } from "../core/math";
import { ensure, type Basis, type Transform, type Vec3 } from "../core/types";
export type Workplane = {
  origin: Vec3;
  normal: Vec3;
  u: Vec3;
  elevation: number;
  grid: number;
  rotationIncrement: number;
  free: boolean;
};
const dot = (a: Vec3, b: Vec3) => a.reduce((s, n, i) => s + n * b[i], 0);
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const scale = (a: Vec3, s: number) => a.map((n) => n * s) as Vec3;
const plus = (a: Vec3, b: Vec3) => a.map((n, i) => n + b[i]) as Vec3;
const normalize = (a: Vec3): Vec3 => {
  ensure(
    a.every(Number.isFinite) && Math.hypot(...a) > 1e-9,
    "INVALID_INPUT",
    "Workplane direction must be finite and nonzero.",
  );
  return scale(a, 1 / Math.hypot(...a));
};
export const defaultWorkplane = (): Workplane => ({
  origin: [0, 0, 0],
  normal: [0, -1, 0],
  u: [1, 0, 0],
  elevation: 0,
  grid: 20,
  rotationIncrement: 90,
  free: false,
});
export function validateWorkplane(p: Workplane) {
  ensure(
    p.origin.every((n) => Number.isFinite(n) && Math.abs(n) <= 1e7),
    "INVALID_INPUT",
    "Workplane origin exceeds coordinate limits.",
  );
  ensure(
    Number.isFinite(p.elevation) && Math.abs(p.elevation) <= 1e7,
    "INVALID_INPUT",
    "Workplane elevation exceeds coordinate limits.",
  );
  ensure(
    Number.isFinite(p.grid) && p.grid >= 0.01 && p.grid <= 10000,
    "INVALID_INPUT",
    "Grid increment must be 0.01–10000 LDU.",
  );
  ensure(
    Number.isFinite(p.rotationIncrement) &&
      p.rotationIncrement >= 0.1 &&
      p.rotationIncrement <= 360,
    "INVALID_INPUT",
    "Rotation increment must be 0.1–360 degrees.",
  );
  ensure(
    Math.abs(Math.hypot(...p.normal) - 1) < 1e-6 &&
      Math.abs(Math.hypot(...p.u) - 1) < 1e-6 &&
      Math.abs(dot(p.normal, p.u)) < 1e-6,
    "INVALID_INPUT",
    "Workplane axes must be orthonormal.",
  );
}
export const planeV = (p: Workplane) => cross(p.normal, p.u);
export const planeOrigin = (p: Workplane) =>
  plus(p.origin, scale(p.normal, -p.elevation));
export function defineWorkplane(
  origin: Vec3,
  normal: Vec3,
  rollDeg = 0,
  settings = defaultWorkplane(),
): Workplane {
  ensure(
    Number.isFinite(rollDeg),
    "INVALID_INPUT",
    "Workplane rotation must be finite.",
  );
  const n = normalize(normal),
    reference: Vec3 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
  const u = normalize(plus(reference, scale(n, -dot(reference, n)))),
    v = cross(n, u),
    a = (rollDeg * Math.PI) / 180;
  const p = {
    ...settings,
    origin: [...origin] as Vec3,
    normal: n,
    u: plus(scale(u, Math.cos(a)), scale(v, Math.sin(a))),
  };
  validateWorkplane(p);
  return p;
}
export function planeRoll(p: Workplane) {
  const base = defineWorkplane(p.origin, p.normal, 0, p);
  return (Math.atan2(dot(p.u, planeV(base)), dot(p.u, base.u)) * 180) / Math.PI;
}
export function worldWorkplane(
  axis: "XZ" | "XY" | "YZ",
  settings = defaultWorkplane(),
) {
  return defineWorkplane(
    [0, 0, 0],
    axis === "XZ" ? [0, -1, 0] : axis === "XY" ? [0, 0, 1] : [1, 0, 0],
    0,
    settings,
  );
}
export function planeFromTriangle(
  a: Vec3,
  b: Vec3,
  c: Vec3,
  toward: Vec3,
  settings = defaultWorkplane(),
) {
  let normal = normalize(cross(plus(b, scale(a, -1)), plus(c, scale(a, -1))));
  if (dot(normal, plus(toward, scale(a, -1))) < 0) normal = scale(normal, -1);
  return defineWorkplane(a, normal, 0, { ...settings, elevation: 0 });
}
export function placeBasis(p: Workplane, angle: number): Basis {
  validateWorkplane(p);
  ensure(
    Number.isFinite(angle),
    "INVALID_INPUT",
    "Placement rotation must be finite.",
  );
  const u = p.u,
    v = planeV(p),
    n = p.normal;
  const basis: Basis = [
    u[0],
    -n[0],
    v[0],
    u[1],
    -n[1],
    v[1],
    u[2],
    -n[2],
    v[2],
  ];
  return compose(
    { position: [0, 0, 0], basis },
    { ...identity(), basis: rotationY(angle) },
  ).basis;
}
export function placementOnPlane(
  hit: Vec3,
  p: Workplane,
  height: number,
  angle: number,
  /** Local x/z origin phase in LDU (catalogue `align`); 0 keeps plain grid snapping. */
  align?: readonly number[],
): Transform {
  validateWorkplane(p);
  ensure(
    hit.every(Number.isFinite) && Number.isFinite(height),
    "INVALID_INPUT",
    "Placement coordinates must be finite.",
  );
  const origin = planeOrigin(p),
    d = plus(hit, scale(origin, -1)),
    v = planeV(p),
    // A part's origin may sit on a stud centre (odd stud counts) rather than a
    // cell corner: its local x/z phase, turned with the part, shifts the grid.
    a = ((angle % 360) + 360) % 360,
    turned = Math.abs(a - 90) < 1e-6 || Math.abs(a - 270) < 1e-6,
    studGrid = align && Math.abs(p.grid / 20 - Math.round(p.grid / 20)) < 1e-9,
    phaseU = studGrid ? (turned ? align[1] : align[0]) : 0,
    phaseV = studGrid ? (turned ? align[0] : align[1]) : 0,
    snap = (n: number, phase: number) =>
      p.free ? n : Math.round((n - phase) / p.grid) * p.grid + phase;
  return {
    position: plus(
      plus(
        plus(origin, scale(p.u, snap(dot(d, p.u), phaseU))),
        scale(v, snap(dot(d, v), phaseV)),
      ),
      scale(p.normal, height),
    ),
    basis: placeBasis(p, angle),
  };
}
