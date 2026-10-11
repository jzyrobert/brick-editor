import { add, inverse, mv } from "../core/math";
import type { CameraSpec, Transform, Vec3 } from "../core/types";
import type { MechanismViewGeometry } from "./mechanism-view";

export type VehicleCameraBounds = { center: Vec3; radius: number };
const point = (frame: Transform, p: Vec3) =>
  add(frame.position, mv(frame.basis, p));

/** Cache the whole car in chassis coordinates; turning and wheel rotation must
 * not change the chase distance or shift the camera's target every frame. */
export function vehicleCameraBounds(
  geometry: MechanismViewGeometry,
  frames: Record<string, Transform>,
  chassis: Transform,
): VehicleCameraBounds {
  const local = inverse(chassis);
  const corners = Object.entries(geometry).flatMap(([id, points]) =>
    points.map((p) => point(local, point(frames[id], p))),
  );
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of corners)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p[k]);
      max[k] = Math.max(max[k], p[k]);
    }
  const center = min.map((v, k) => (v + max[k]) / 2) as Vec3;
  return {
    center,
    radius: Math.max(
      1,
      ...corners.map((p) => Math.hypot(...p.map((v, k) => v - center[k]))),
    ),
  };
}

export function vehicleChaseCamera(
  bounds: VehicleCameraBounds,
  chassis: Transform,
  orbit: { yaw: number; pitch: number; zoom: number },
  aspect: number,
  fovDeg: number,
  near: number,
): CameraSpec {
  const tangent = Math.tan((fovDeg * Math.PI) / 360) * Math.min(1, aspect);
  const distance =
    (bounds.radius / Math.sin(Math.atan(tangent))) * 1.08 * orbit.zoom;
  const target = point(chassis, bounds.center);
  const back: Vec3 = [
    -Math.sin(orbit.yaw) * Math.cos(orbit.pitch),
    -Math.sin(orbit.pitch),
    Math.cos(orbit.yaw) * Math.cos(orbit.pitch),
  ];
  return {
    space: "ldraw",
    projection: "perspective",
    target,
    position: target.map((v, k) => v + back[k] * distance) as Vec3,
    up: [0, -1, 0],
    fovDeg,
    near,
    far: Math.max(100000, distance + bounds.radius * 4),
  };
}
