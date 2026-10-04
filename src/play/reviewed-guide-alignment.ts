import { compose, inverse } from "../core/math";
import type { Transform, Vec3 } from "../core/types";

export const REVIEWED_GUIDE_ALIGNMENT = Object.freeze({
  capAllowanceLdu: 0.05,
  rotationBasisError: 0.002,
});

/** Alignment for an already source-bound, reviewed Z-plane bearing class.
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
    maximum = minimum;
  for (let k = 0; k < 3; k++) {
    const coefficient = relative.basis[6 + k];
    minimum +=
      coefficient * (coefficient < 0 ? rackBounds.max[k] : rackBounds.min[k]);
    maximum +=
      coefficient * (coefficient < 0 ? rackBounds.min[k] : rackBounds.max[k]);
  }
  const capExcessLdu = Math.max(maximum - 10, -10 - minimum),
    rotationError = Math.max(
      ...relative.basis.map((v, k) => Math.abs(v - restRelativeBasis[k])),
    );
  return {
    allowed:
      capExcessLdu <= REVIEWED_GUIDE_ALIGNMENT.capAllowanceLdu &&
      rotationError <= REVIEWED_GUIDE_ALIGNMENT.rotationBasisError,
    capExcessLdu,
    rotationError,
  };
}
