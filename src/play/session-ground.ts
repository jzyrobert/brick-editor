import type { CollisionSnapshot } from "./types";
import type { PlayMechanismSource } from "./mechanism";
import { certifyDrivingProfile } from "./vehicle-profile";
import { CHARACTER_PROFILE } from "./types";
import { drivingCoordinate } from "./vehicle-collision";

/** LDraw Y increases downwards. Only a supported vehicle session can lower
 * the temporary plane; ordinary worlds retain their existing Y=0 ground.
 * Complete included vertex data and certified wheel envelopes are authoritative,
 * never diagnostic bounds or a part-name inference. Authored geometry stays put. */
export function sessionGroundY(
  snapshot: CollisionSnapshot,
  sources: readonly PlayMechanismSource[],
) {
  let groundY = 0;
  let supportedVehicle = false;
  for (const source of sources) {
    const rig = source.project.motionRigs[source.rigId];
    if (!rig.vehicle) continue;
    try {
      const profile = certifyDrivingProfile(source);
      supportedVehicle = true;
      for (const box of profile.boxes)
        groundY = Math.max(
          groundY,
          profile.originLdu[1] +
            (box.halfExtents[1] - box.center[1]) /
              CHARACTER_PROFILE.scaleMetresPerLdu,
        );
      // Native tyre rays use the reviewed declared radius, which may enclose
      // the compiled radial boundary by a tiny existing source-review margin.
      for (const wheel of rig.vehicle.wheels) {
        const frame = rig.groups.find((g) => g.id === wheel.groupId)!;
        groundY = Math.max(groundY, frame.frame.position[1] + wheel.radius);
      }
    } catch {
      // A refused driving profile cannot choose a new support plane or become
      // supported merely because the temporary floor was moved beneath it.
    }
  }
  if (!supportedVehicle) return 0;
  const include = (mesh: CollisionSnapshot) => {
    if (mesh.unsupported) return;
    for (let i = 1; i < mesh.vertices.length; i += 3)
      groundY = Math.max(groundY, mesh.vertices[i]);
  };
  include(snapshot);
  for (const source of sources)
    for (const mesh of Object.values(source.groups)) include(mesh);
  // A world outside the existing driving query domain remains unsupported;
  // it cannot request an unbounded new native plane through source geometry.
  return drivingCoordinate(-groundY * CHARACTER_PROFILE.scaleMetresPerLdu)
    ? groundY
    : 0;
}
