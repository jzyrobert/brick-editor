import { ensure, type Vec3 } from "../core/types";
import { mv } from "../core/math";
import type { PlayMechanismSource } from "./mechanism";
import { CHARACTER_PROFILE } from "./types";
import {
  sweepDrivingBoxes,
  type DrivingBox,
  type DrivingPose,
} from "./vehicle-collision";
import type { MechanismSnapshot } from "../mechanisms/types";
const S = CHARACTER_PROFILE.scaleMetresPerLdu;
const metres = ([x, y, z]: Vec3): Vec3 => [x * S, -y * S, -z * S];
export type DrivingProfile = { boxes: DrivingBox[]; originLdu: Vec3 };
/** Certifies enclosing boxes from every compiled vertex. Mechanics (groups,
 * axes, steering) are authored; no part-name or mesh-based mechanism inference. */
export function certifyDrivingProfile(
  source: PlayMechanismSource,
): DrivingProfile {
  const rig = source.project.motionRigs[source.rigId],
    vehicle = rig.vehicle;
  ensure(
    vehicle &&
      !rig.joints.length &&
      rig.groups.length === vehicle.wheels.length + 1,
    "INVALID_INPUT",
    "Protected driving supports only a chassis and declared unjointed wheels; articulated/extra groups are unsupported",
  );
  const chassis = rig.groups.find((g) => g.id === vehicle.chassisGroup)!;
  const boxes: DrivingBox[] = [];
  for (const group of rig.groups) {
    const geometry = source.groups[group.id];
    ensure(
      geometry && !geometry.unsupported && geometry.indices.length > 0,
      "INVALID_INPUT",
      "Protected driving requires complete nonempty compiled geometry for every group",
    );
    const wheel = vehicle.wheels.find((w) => w.groupId === group.id);
    const origin = wheel ? group.frame.position : chassis.frame.position;
    const center = metres(
      group.frame.position.map((v, i) => v - chassis.frame.position[i]) as Vec3,
    );
    const axis = wheel ? mv(group.frame.basis, wheel.axis) : undefined;
    if (axis)
      ensure(
        Math.abs(axis[1]) <= 1e-7 && Math.abs(Math.hypot(...axis) - 1) <= 1e-5,
        "INVALID_INPUT",
        "Protected driving requires world-horizontal wheel axles",
      );
    const low = [Infinity, Infinity, Infinity],
      high = [-Infinity, -Infinity, -Infinity];
    let radius = 0,
      radialHeight = 0;
    for (let i = 0; i < geometry.vertices.length; i += 3) {
      const local = [0, 1, 2].map(
        (k) => geometry.vertices[i + k] - origin[k],
      ) as Vec3;
      ensure(
        local.every(Number.isFinite),
        "INVALID_INPUT",
        "Invalid compiled driving geometry",
      );
      if (axis) {
        // Divide by measured axle length so tolerated authored normalization error
        // cannot under-estimate a wheel's radial envelope.
        const along =
          local.reduce((sum, v, k) => sum + v * axis[k], 0) /
          Math.hypot(...axis);
        radius = Math.max(radius, Math.hypot(...local));
        radialHeight = Math.max(
          radialHeight,
          Math.abs((along * axis[1]) / Math.hypot(...axis)) +
            Math.sqrt(
              Math.max(
                0,
                local.reduce((sum, v) => sum + v * v, 0) - along * along,
              ),
            ),
        );
      } else {
        const p = metres(local);
        for (let k = 0; k < 3; k++) {
          low[k] = Math.min(low[k], p[k]);
          high[k] = Math.max(high[k], p[k]);
        }
      }
    }
    if (wheel)
      boxes.push({
        center,
        halfExtents: [radius * S, radialHeight * S, radius * S],
      });
    else
      boxes.push({
        center: low.map((v, k) => (v + high[k]) / 2) as Vec3,
        halfExtents: low.map((v, k) => (high[k] - v) / 2) as Vec3,
      });
  }
  const profile = { boxes, originLdu: [...chassis.frame.position] as Vec3 };
  const rest = {
    x: chassis.frame.position[0] * S,
    y: -chassis.frame.position[1] * S,
    z: -chassis.frame.position[2] * S,
    yaw: 0,
  };
  sweepDrivingBoxes(source.rigId, boxes, rest, rest, []);
  return profile;
}
export function drivingPose(
  profile: DrivingProfile,
  snapshot: MechanismSnapshot,
): DrivingPose {
  const vehicle = snapshot.pose.vehicle!;
  const position = metres(
    profile.originLdu.map((v, i) => v + vehicle.position[i]) as Vec3,
  );
  return {
    x: position[0],
    y: position[1],
    z: position[2],
    yaw: (vehicle.headingDegrees * Math.PI) / 180,
  };
}
