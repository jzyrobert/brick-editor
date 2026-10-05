import { add, compose, mv } from "../core/math";
import type { Transform, Vec3 } from "../core/types";
import { axisRotation } from "../mechanisms/kinematic";
import { fromPhysics } from "./physics-frame";

declare const sourceAxisMotionBrand: unique symbol;
/** Complete geometry support only; source and motion ownership remain the
 * caller's responsibility. */
export type SourceAxisMotion = { readonly [sourceAxisMotionBrand]: true };
const envelopes = new WeakMap<
  SourceAxisMotion,
  {
    radius: number;
    fullRadius: number;
    axis: Vec3;
    pivot: Vec3;
  }
>();

export function sourceAxisMotion(
  points: Float32Array,
  pivot: Vec3,
  axis: Vec3,
): SourceAxisMotion | undefined {
  if (
    !points.length ||
    points.length % 3 ||
    ![...pivot, ...axis].every(Number.isFinite) ||
    Math.abs(Math.hypot(...axis) - 1) > 1e-12
  )
    return;
  let radius = 0,
    fullRadius = 0;
  for (let i = 0; i < points.length; i += 3) {
    const p = fromPhysics({ x: points[i], y: points[i + 1], z: points[i + 2] });
    if (!p.every(Number.isFinite)) return;
    const d = p.map((v, k) => v - pivot[k]) as Vec3,
      axial = d.reduce((sum, v, k) => sum + v * axis[k], 0);
    radius = Math.max(
      radius,
      Math.hypot(...d.map((v, k) => v - axial * axis[k])),
    );
    fullRadius = Math.max(fullRadius, Math.hypot(...p));
  }
  const token = Object.freeze({}) as SourceAxisMotion;
  envelopes.set(token, {
    radius,
    fullRadius,
    axis: [...axis],
    pivot: [...pivot],
  });
  return token;
}

/** Bound the complete unwrapped arc of a known fixed-axis rotation. Endpoint
 * residual adds every support point's affine pose error; it never subtracts
 * error or hides translation. Convex source children inherit their vertices'
 * bounds. Moving axes, descendants and coupling require a different proof. */
export function sourceAxisTravel(
  token: SourceAxisMotion,
  before: Transform,
  after: Transform,
  degrees: number,
): number | undefined {
  const e = envelopes.get(token);
  if (
    !e ||
    ![
      ...before.position,
      ...before.basis,
      ...after.position,
      ...after.basis,
      degrees,
    ].every(Number.isFinite)
  )
    return;
  const rotation = axisRotation(e.axis, degrees);
  const expected = compose(before, {
    position: add(e.pivot, mv(rotation, e.pivot.map((v) => -v) as Vec3)),
    basis: rotation,
  });
  // Gershgorin bound on BᵀB: conservative even for rounded authored matrices.
  let operatorSquared = 0;
  for (let i = 0; i < 3; i++) {
    let row = 0;
    for (let j = 0; j < 3; j++)
      row += Math.abs(
        [0, 1, 2].reduce(
          (sum, k) => sum + before.basis[k * 3 + i] * before.basis[k * 3 + j],
          0,
        ),
      );
    operatorSquared = Math.max(operatorSquared, row);
  }
  const residual =
    Math.hypot(...after.position.map((v, k) => v - expected.position[k])) +
    Math.hypot(...after.basis.map((v, k) => v - expected.basis[k])) *
      e.fullRadius;
  const travel =
    ((Math.abs(degrees) * Math.PI) / 180) *
      e.radius *
      Math.sqrt(operatorSquared) +
    residual;
  // Cover numerical frame arithmetic, without expanding the sweep budget.
  return Number.isFinite(travel) ? travel + 1e-6 : undefined;
}
