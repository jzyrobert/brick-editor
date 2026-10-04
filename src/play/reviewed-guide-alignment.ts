import { compose, inverse } from "../core/math";
import type { Transform, Vec3 } from "../core/types";
import type { ReviewedConvexRegion } from "./reviewed-convex-packet";

export const REVIEWED_GUIDE_ALIGNMENT = Object.freeze({
  capAllowanceLdu: 0.05,
  rotationBasisError: 0.002,
});
/** Caller must first bind the official reviewed housing packet. This exact
 * native-coordinate predicate partitions its already reviewed support; it
 * neither rounds sums nor changes vertices/facets. Class 2 is separate from
 * the original source Z classes. The reviewed packet has 414 such regions. */
export function reviewedHousingGuideClass(
  region: ReviewedConvexRegion,
): -1 | 0 | 1 | 2 {
  return region.planeClass === 0 &&
    region.vertices.every(
      (v, k) => k % 3 !== 1 || region.position[1] + v <= Math.fround(11 * 0.02),
    )
    ? 2
    : region.planeClass;
}

/** Alignment for an already source-bound, reviewed floor and Z-cap bearing classes.
 * Check the whole rack envelope in the current carrier part frame so a small
 * rotation cannot hide a large endpoint displacement. It does not establish
 * a guide match, grant arbitrary prismatic mating, or suppress core contacts.
 * Call outside native hooks, and cache only the result for the next step. */
export function reviewedGuideAlignment(
  carrierPart: Transform,
  rackPart: Transform,
  rackBounds: { min: Vec3; max: Vec3 },
  restRelativeBasis: Transform["basis"],
) {
  const relative = compose(inverse(carrierPart), rackPart);
  if (
    ![
      ...relative.position,
      ...relative.basis,
      ...rackBounds.min,
      ...rackBounds.max,
      ...restRelativeBasis,
    ].every(Number.isFinite) ||
    rackBounds.min.some((v, k) => v > rackBounds.max[k])
  )
    return { allowed: false, capExcessLdu: Infinity, rotationError: Infinity };
  let minimum = relative.position[2],
    maximum = minimum,
    minimumY = relative.position[1],
    maximumY = minimumY;
  for (let k = 0; k < 3; k++) {
    const coefficient = relative.basis[6 + k];
    minimum +=
      coefficient * (coefficient < 0 ? rackBounds.max[k] : rackBounds.min[k]);
    maximum +=
      coefficient * (coefficient < 0 ? rackBounds.min[k] : rackBounds.max[k]);
    const y = relative.basis[3 + k];
    minimumY += y * (y < 0 ? rackBounds.max[k] : rackBounds.min[k]);
    maximumY += y * (y < 0 ? rackBounds.min[k] : rackBounds.max[k]);
  }
  const capExcessLdu = Math.max(maximum - 10, -10 - minimum),
    yExcessLdu = Math.max(maximumY + 11, -49 - minimumY),
    rotationError = Math.max(
      ...relative.basis.map((v, k) => Math.abs(v - restRelativeBasis[k])),
    );
  return {
    allowed:
      capExcessLdu <= REVIEWED_GUIDE_ALIGNMENT.capAllowanceLdu &&
      yExcessLdu <= REVIEWED_GUIDE_ALIGNMENT.capAllowanceLdu &&
      rotationError <= REVIEWED_GUIDE_ALIGNMENT.rotationBasisError,
    capExcessLdu,
    yExcessLdu,
    rotationError,
  };
}
