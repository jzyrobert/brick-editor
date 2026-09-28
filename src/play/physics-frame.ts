import { Matrix4, Quaternion } from "three";
import type { Basis, Transform, Vec3 } from "../core/types";
import { CHARACTER_PROFILE } from "./types";

/**
 * The single Play/physics boundary: public LDraw LDU (negative Y up) to
 * Rapier metres (positive Y up). C = diag(1,-1,-1) is a proper rotation, so
 * handedness and signed joint angles are preserved.
 */
export const METRES_PER_LDU = CHARACTER_PROFILE.scaleMetresPerLdu;
const S = METRES_PER_LDU;
export const toPhysics = ([x, y, z]: Vec3) => ({
  x: x * S,
  y: -y * S,
  z: -z * S,
});
/** Direction (unscaled) from LDraw to physics axes. */
export const toPhysicsDirection = ([x, y, z]: Vec3) => ({ x, y: -y, z: -z });
export const fromPhysics = (v: { x: number; y: number; z: number }): Vec3 => [
  v.x / S,
  -v.y / S,
  -v.z / S,
];
export const fromPhysicsDirection = (v: {
  x: number;
  y: number;
  z: number;
}): Vec3 => [v.x, -v.y, -v.z];
/** Rotation of an LDraw row-major basis in physics axes (C B C). */
export function frameRotation(frame: Transform) {
  const b = frame.basis;
  return new Quaternion().setFromRotationMatrix(
    new Matrix4().set(
      b[0],
      -b[1],
      -b[2],
      0,
      -b[3],
      b[4],
      b[5],
      0,
      -b[6],
      b[7],
      b[8],
      0,
      0,
      0,
      0,
      1,
    ),
  );
}
/** LDraw basis of a physics quaternion, renormalised in double precision. */
export function basisFromRotation(q: {
  x: number;
  y: number;
  z: number;
  w: number;
}): Basis {
  const n = Math.hypot(q.x, q.y, q.z, q.w) || 1,
    x = q.x / n,
    y = q.y / n,
    z = q.z / n,
    w = q.w / n;
  const r = [
    1 - 2 * (y * y + z * z),
    2 * (x * y - z * w),
    2 * (x * z + y * w),
    2 * (x * y + z * w),
    1 - 2 * (x * x + z * z),
    2 * (y * z - x * w),
    2 * (x * z - y * w),
    2 * (y * z + x * w),
    1 - 2 * (x * x + y * y),
  ];
  return [r[0], -r[1], -r[2], -r[3], r[4], r[5], -r[6], r[7], r[8]] as Basis;
}
