import { add, mv } from "../core/math";
import type { Transform } from "../core/types";
import { fromPhysics } from "./physics-frame";

declare const axialEnvelopeBrand: unique symbol;
/** Geometry certificate only. The caller still proves source ownership and
 * contact identity; this token supplies neither. */
export type SourceAxialEnvelope = { readonly [axialEnvelopeBrand]: true };
const envelopes = new WeakMap<
  SourceAxialEnvelope,
  { radius: number; min: number; max: number }
>();

/** Cover every native Float32 support point in a source axis frame, once.
 * The opaque immutable token remains a snapshot of the complete point set. */
export function sourceAxialEnvelope(
  points: Float32Array,
  groupToAxis: Transform,
): SourceAxialEnvelope | undefined {
  if (
    !points.length ||
    points.length % 3 ||
    ![...groupToAxis.position, ...groupToAxis.basis].every(Number.isFinite)
  )
    return;
  let radius = 0,
    min = Infinity,
    max = -Infinity;
  for (let i = 0; i < points.length; i += 3) {
    const p = add(
      groupToAxis.position,
      mv(
        groupToAxis.basis,
        fromPhysics({ x: points[i], y: points[i + 1], z: points[i + 2] }),
      ),
    );
    if (!p.every(Number.isFinite)) return;
    radius = Math.max(radius, Math.hypot(p[0], p[1]));
    min = Math.min(min, p[2]);
    max = Math.max(max, p[2]);
  }
  const token = Object.freeze({}) as SourceAxialEnvelope;
  envelopes.set(token, { radius, min, max });
  return token;
}

/** A conservative positive certificate, never a rejection of exact points.
 * Works for finite affine matrices, including source rounding: the XY block's
 * spectral norm bounds the whole radial disk; Z terms bound the axial interval.
 * Failure means the caller must retain its existing complete point check. */
export function axialEnvelopeInside(
  token: SourceAxialEnvelope,
  axisToCurrentAxis: Transform,
  radius: number,
  min: number,
  max: number,
) {
  const e = envelopes.get(token),
    b = axisToCurrentAxis.basis,
    p = axisToCurrentAxis.position;
  if (
    !e ||
    radius < 0 ||
    min > max ||
    ![...b, ...p, radius, min, max].every(Number.isFinite)
  )
    return false;
  const a = b[0] * b[0] + b[3] * b[3],
    d = b[1] * b[1] + b[4] * b[4],
    c = b[0] * b[1] + b[3] * b[4],
    norm = Math.sqrt(Math.max(0, (a + d + Math.hypot(a - d, 2 * c)) / 2)),
    radial =
      e.radius * norm +
      Math.max(Math.abs(e.min), Math.abs(e.max)) * Math.hypot(b[2], b[5]) +
      Math.hypot(p[0], p[1]),
    z0 = b[8] * e.min,
    z1 = b[8] * e.max,
    spread = e.radius * Math.hypot(b[6], b[7]);
  // This shrinks the positive certificate; it does not expand contact limits.
  const margin = 1e-8;
  return (
    radial + margin <= radius &&
    Math.min(z0, z1) + p[2] - spread - margin >= min &&
    Math.max(z0, z1) + p[2] + spread + margin <= max
  );
}
