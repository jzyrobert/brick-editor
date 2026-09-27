import type { Basis, Transform, Vec3 } from "./types";
export const identity = (): Transform => ({
  position: [0, 0, 0],
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
});
export const mv = (m: Basis, v: Vec3): Vec3 =>
  [0, 1, 2].map(
    (i) => m[i * 3] * v[0] + m[i * 3 + 1] * v[1] + m[i * 3 + 2] * v[2],
  ) as Vec3;
export const add = (a: Vec3, b: Vec3): Vec3 =>
  a.map((x, i) => x + b[i]) as Vec3;
export function compose(a: Transform, b: Transform): Transform {
  return {
    position: add(a.position, mv(a.basis, b.position)),
    basis: Array.from({ length: 9 }, (_, i) => {
      const r = Math.floor(i / 3),
        c = i % 3;
      return (
        a.basis[r * 3] * b.basis[c] +
        a.basis[r * 3 + 1] * b.basis[3 + c] +
        a.basis[r * 3 + 2] * b.basis[6 + c]
      );
    }) as Basis,
  };
}
export const determinant = (m: Basis) =>
  m[0] * (m[4] * m[8] - m[5] * m[7]) -
  m[1] * (m[3] * m[8] - m[5] * m[6]) +
  m[2] * (m[3] * m[7] - m[4] * m[6]);
export function inverse(t: Transform): Transform {
  const m = t.basis,
    d = determinant(m);
  if (Math.abs(d) < 1e-12) throw new Error("Singular parent transform");
  const b = [
    m[4] * m[8] - m[5] * m[7],
    m[2] * m[7] - m[1] * m[8],
    m[1] * m[5] - m[2] * m[4],
    m[5] * m[6] - m[3] * m[8],
    m[0] * m[8] - m[2] * m[6],
    m[2] * m[3] - m[0] * m[5],
    m[3] * m[7] - m[4] * m[6],
    m[1] * m[6] - m[0] * m[7],
    m[0] * m[4] - m[1] * m[3],
  ].map((x) => x / d) as Basis;
  return { basis: b, position: mv(b, t.position.map((x) => -x) as Vec3) };
}
export const conversion = (v: Vec3): Vec3 => [v[0], -v[1], -v[2]];
export function physical(t: Transform) {
  const m = t.basis;
  return (
    Math.abs(determinant(m) - 1) < 1e-6 &&
    [0, 1, 2].every((i) =>
      [0, 1, 2].every(
        (j) =>
          Math.abs(
            m[i] * m[j] +
              m[3 + i] * m[3 + j] +
              m[6 + i] * m[6 + j] -
              (i === j ? 1 : 0),
          ) < 1e-6,
      ),
    )
  );
}
export const rotationY = (deg: number): Basis => {
  const a = (deg * Math.PI) / 180;
  return [
    Math.cos(a),
    0,
    Math.sin(a),
    0,
    1,
    0,
    -Math.sin(a) || 0,
    0,
    Math.cos(a),
  ];
};
