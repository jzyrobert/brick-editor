import { Vector3 } from "three";
import { ensure } from "../core/types";
import { pneumaticGuidePlanes } from "./pneumatic-cylinder-guide";
import type { PneumaticCylinderSurface } from "./pneumatic-cylinder-source";
import { PNEUMATIC_PUMP_LIMITS } from "./pneumatic-pump-source";
export function sourcePumpGuide(
  barrel: PneumaticCylinderSurface,
  cap: PneumaticCylinderSurface,
  barrelPosition: Vector3,
  capPosition: Vector3,
) {
  return {
    chamber: pneumaticGuidePlanes(barrel, 68, 8),
    cap: pneumaticGuidePlanes(cap, 0, 4),
    barrelPosition,
    capPosition,
  };
}
/** Check the complete actual shaft support clipped to both source guide bands.
 * Only the R4 cap permits the explicitly reviewed author-rounding seal fit.
 * The R8 chamber, visible gasket, head and foreign objects retain contact. */
export function sourcePumpShaftFits(
  points: readonly Vector3[],
  guide: ReturnType<typeof sourcePumpGuide>,
) {
  ensure(
    points.length > 0 && points.length <= 128,
    "LIMIT_EXCEEDED",
    "Pump support exceeds its check budget",
  );
  const bounds = points.reduce(
    (b, p) => [Math.min(b[0], p.y), Math.max(b[1], p.y)],
    [Infinity, -Infinity],
  );
  if (
    points.some((p) => !p.toArray().every(Number.isFinite)) ||
    bounds[0] < guide.barrelPosition.y - 68 * 0.02 ||
    bounds[0] > guide.barrelPosition.y ||
    bounds[1] < guide.capPosition.y
  )
    return false;
  const slab = (
    position: Vector3,
    lo: number,
    hi: number,
    planes: typeof guide.cap,
    fit: number,
  ) => {
    const contains = (p: Vector3) =>
      planes.every(
        (n) => n.x * (p.x - position.x) + n.z * (p.z - position.z) <= n.d + fit,
      );
    for (const p of points)
      if (p.y >= lo && p.y <= hi && !contains(p)) return false;
    for (const y of [lo, hi])
      for (let i = 0; i < points.length; i++)
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i],
            b = points[j];
          if ((a.y < y && b.y > y) || (b.y < y && a.y > y))
            if (!contains(a.clone().lerp(b, (y - a.y) / (b.y - a.y))))
              return false;
        }
    return true;
  };
  return (
    slab(
      guide.capPosition,
      guide.capPosition.y - 2 * 0.02,
      guide.capPosition.y,
      guide.cap,
      PNEUMATIC_PUMP_LIMITS.capSealFitLdu * 0.02,
    ) &&
    slab(
      guide.barrelPosition,
      guide.barrelPosition.y - 68 * 0.02,
      guide.barrelPosition.y,
      guide.chamber,
      0,
    )
  );
}
