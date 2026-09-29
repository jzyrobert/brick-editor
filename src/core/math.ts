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
    // add(a.position, mv(a.basis, b.position)), unrolled.
    position: [
      a.position[0] +
        (a.basis[0] * b.position[0] +
          a.basis[1] * b.position[1] +
          a.basis[2] * b.position[2]),
      a.position[1] +
        (a.basis[3] * b.position[0] +
          a.basis[4] * b.position[1] +
          a.basis[5] * b.position[2]),
      a.position[2] +
        (a.basis[6] * b.position[0] +
          a.basis[7] * b.position[1] +
          a.basis[8] * b.position[2]),
    ],
    // Row r, column c: a[r][0]·b[0][c] + a[r][1]·b[1][c] + a[r][2]·b[2][c]
    // (unrolled: this runs once per occurrence of every expansion).
    basis: [
      a.basis[0] * b.basis[0] +
        a.basis[1] * b.basis[3] +
        a.basis[2] * b.basis[6],
      a.basis[0] * b.basis[1] +
        a.basis[1] * b.basis[4] +
        a.basis[2] * b.basis[7],
      a.basis[0] * b.basis[2] +
        a.basis[1] * b.basis[5] +
        a.basis[2] * b.basis[8],
      a.basis[3] * b.basis[0] +
        a.basis[4] * b.basis[3] +
        a.basis[5] * b.basis[6],
      a.basis[3] * b.basis[1] +
        a.basis[4] * b.basis[4] +
        a.basis[5] * b.basis[7],
      a.basis[3] * b.basis[2] +
        a.basis[4] * b.basis[5] +
        a.basis[5] * b.basis[8],
      a.basis[6] * b.basis[0] +
        a.basis[7] * b.basis[3] +
        a.basis[8] * b.basis[6],
      a.basis[6] * b.basis[1] +
        a.basis[7] * b.basis[4] +
        a.basis[8] * b.basis[7],
      a.basis[6] * b.basis[2] +
        a.basis[7] * b.basis[5] +
        a.basis[8] * b.basis[8],
    ] as Basis,
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
