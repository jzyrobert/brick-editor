import { add, inverse, mv } from "../core/math";
import type { Transform, Vec3 } from "../core/types";
import type { MechanismViewGeometry } from "./mechanism-view";
import { CHARACTER_PROFILE } from "./types";

/** Reach is measured from the nearest live vehicle group, so standing beside
 * the back of a long truck does not require reaching its chassis origin. */
export function vehicleReachDistance(
  geometry: MechanismViewGeometry,
  frames: Record<string, Transform>,
  feet: Vec3,
) {
  const body = [feet[0], feet[1] - CHARACTER_PROFILE.height / 2, feet[2]];
  let nearest = Infinity;
  for (const [id, corners] of Object.entries(geometry)) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const corner of corners) {
      const p = add(frames[id].position, mv(frames[id].basis, corner));
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], p[k]);
        max[k] = Math.max(max[k], p[k]);
      }
    }
    nearest = Math.min(
      nearest,
      Math.hypot(...body.map((v, k) => Math.max(min[k] - v, v - max[k], 0))),
    );
  }
  return nearest;
}

/** Exit points outside every live group, including the wheels and overhangs.
 * The session still checks capsule clearance and nearby standing support. */
export function vehicleExitCandidates(
  geometry: MechanismViewGeometry,
  frames: Record<string, Transform>,
  chassis: Transform,
): Vec3[] {
  const local = inverse(chassis);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const [id, corners] of Object.entries(geometry))
    for (const corner of corners) {
      const world = add(frames[id].position, mv(frames[id].basis, corner));
      const p = add(local.position, mv(local.basis, world));
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], p[k]);
        max[k] = Math.max(max[k], p[k]);
      }
    }
  const x = (min[0] + max[0]) / 2;
  const z = (min[2] + max[2]) / 2;
  const gap = CHARACTER_PROFILE.radius + 4;
  // Try both sides first, then front/rear and corners. Eight candidates bound
  // the work and keep an obstructed exit in the vehicle until it can succeed.
  return [
    [min[0] - gap, max[1], z],
    [max[0] + gap, max[1], z],
    [x, max[1], min[2] - gap],
    [x, max[1], max[2] + gap],
    [min[0] - gap, max[1], min[2] - gap],
    [max[0] + gap, max[1], min[2] - gap],
    [min[0] - gap, max[1], max[2] + gap],
    [max[0] + gap, max[1], max[2] + gap],
  ].map((p) => add(chassis.position, mv(chassis.basis, p as Vec3)));
}
