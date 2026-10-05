import type { CollisionSnapshot } from "./types";
import type { PlayMechanismSource } from "./mechanism";
import { certifyDrivingProfile } from "./vehicle-profile";
import { CHARACTER_PROFILE } from "./types";
import { drivingCoordinate } from "./vehicle-collision";

/** LDraw Y increases downwards. Only a supported vehicle session can lower
 * the temporary plane; ordinary worlds retain their existing Y=0 ground.
 * Complete admitted vehicle vertices and certified wheel envelopes choose it,
 * never scenery, diagnostic bounds or part names. Authored geometry stays put. */
export function sessionGroundY(
  _snapshot: CollisionSnapshot,
  sources: readonly PlayMechanismSource[],
) {
  let groundY = 0;
  for (const source of sources) {
    const rig = source.project.motionRigs[source.rigId];
    if (!rig.vehicle) continue;
    try {
      const profile = certifyDrivingProfile(source);
      let vehicleGroundY = 0;
      for (const box of profile.boxes)
        vehicleGroundY = Math.max(
          vehicleGroundY,
          profile.originLdu[1] +
            (box.halfExtents[1] - box.center[1]) /
              CHARACTER_PROFILE.scaleMetresPerLdu,
        );
      // Native tyre rays use the reviewed declared radius, which may enclose
      // the compiled radial boundary by a tiny existing source-review margin.
      for (const wheel of rig.vehicle.wheels) {
        const frame = rig.groups.find((g) => g.id === wheel.groupId)!;
        vehicleGroundY = Math.max(
          vehicleGroundY,
          frame.frame.position[1] + wheel.radius,
        );
      }
      // Scenery and nonvehicle groups cannot move the support plane beneath a
      // seated approach. They retain their own actual collision surfaces.
      for (const group of rig.groups) {
        const mesh = source.groups[group.id];
        for (let i = 1; i < mesh.vertices.length; i += 3)
          vehicleGroundY = Math.max(vehicleGroundY, mesh.vertices[i]);
      }
      groundY = Math.max(groundY, vehicleGroundY);
    } catch {
      // A refused driving profile cannot choose a new support plane or become
      // supported merely because the temporary floor was moved beneath it.
    }
  }
  // A world outside the existing driving query domain remains unsupported;
  // it cannot request an unbounded new native plane through source geometry.
  return drivingCoordinate(-groundY * CHARACTER_PROFILE.scaleMetresPerLdu)
    ? groundY
    : 0;
}
