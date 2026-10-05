import { ensure } from "../core/types";
import type { PneumaticCylinderSurface } from "./pneumatic-cylinder-source";
import { Vector3 } from "three";
/** Source-bound planar bore facets. These are taken from the actual cap and
 * chamber rings, rather than replacing their faceting with a smooth circle. */
export function pneumaticGuidePlanes(
  surface: PneumaticCylinderSurface,
  y: number,
  radius: number,
) {
  const points = new Map<string, [number, number]>();
  for (let i = 0; i < surface.vertices.length; i += 3) {
    const x = surface.vertices[i],
      z = surface.vertices[i + 2];
    if (
      surface.vertices[i + 1] === y &&
      Math.abs(Math.hypot(x, z) - radius) < 0.1
    ) {
      const p: [number, number] = [
        Math.fround(x * 0.02),
        Math.fround(-z * 0.02),
      ];
      points.set(p.join(","), p);
    }
  }
  const ordered = [...points.values()].sort(
    (a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]),
  );
  ensure(
    ordered.length === 16,
    "INVALID_INPUT",
    "The exact faceted pneumatic bore changed",
  );
  return ordered.map((a, i) => {
    const b = ordered[(i + 1) % ordered.length],
      n = new Vector3(b[1] - a[1], 0, a[0] - b[0]).normalize();
    return { x: n.x, z: n.z, d: n.x * a[0] + n.z * a[1] };
  });
}
/** Every actual native shaft input point, plus every edge intersection with
 * both ends of each guide slab, is checked. All point pairs include every true
 * convex-hull edge, so the clipped support vertices cannot be missed. No thin
 * shaft tilt can be admitted merely because two centerline points fit. */
export function pneumaticShaftFits(
  points: readonly Vector3[],
  cap: ReturnType<typeof pneumaticGuidePlanes>,
  chamber: ReturnType<typeof pneumaticGuidePlanes>,
) {
  ensure(
    points.length > 0 && points.length <= 128,
    "LIMIT_EXCEEDED",
    "Pneumatic shaft support exceeds its check budget",
  );
  let minimum = Infinity,
    maximum = -Infinity;
  for (const p of points) {
    if (![p.x, p.y, p.z].every(Number.isFinite)) return false;
    minimum = Math.min(minimum, p.y);
    maximum = Math.max(maximum, p.y);
  }
  if (minimum < 28 * 0.02 || minimum > 176 * 0.02 || maximum < 178 * 0.02)
    return false;
  const slab = (
    lo: number,
    hi: number,
    planes: typeof cap,
    tolerance: number,
  ) => {
    const fits = (p: Vector3) =>
      planes.every((n) => n.x * p.x + n.z * p.z <= n.d + tolerance);
    for (const p of points)
      if (p.y >= lo && p.y <= hi && !fits(p)) return false;
    for (const y of [lo, hi])
      for (let i = 0; i < points.length; i++)
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i],
            b = points[j];
          if ((a.y < y && b.y > y) || (b.y < y && a.y > y)) {
            const p = a.clone().lerp(b, (y - a.y) / (b.y - a.y));
            if (!fits(p)) return false;
          }
        }
    return true;
  };
  // Only the cap's ideal lubricated seal has the observed .002 LDU fit
  // allowance. The much wider chamber has no additional radial allowance.
  return (
    slab(176 * 0.02, 178 * 0.02, cap, 0.002 * 0.02) &&
    slab(28 * 0.02, 176 * 0.02, chamber, 0)
  );
}
