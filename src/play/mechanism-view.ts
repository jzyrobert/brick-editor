import type { CameraSpec, Transform, Vec3 } from "../core/types";
import { add, inverse, mv } from "../core/math";
import type { MechanismSnapshot, MotionRig } from "../mechanisms/types";
import type { PlayMechanismReport, CollisionSnapshot } from "./types";

export type ViewRect = { x: number; y: number; width: number; height: number };
export type MechanismViewGeometry = Record<string, Vec3[]>;
const point = (frame: Transform, p: Vec3) =>
  add(frame.position, mv(frame.basis, p));

/** Eight conservative corners per group, cached in its local rest frame. */
export function mechanismViewGeometry(
  rig: MotionRig,
  meshes: Record<string, Pick<CollisionSnapshot, "bounds">>,
): MechanismViewGeometry {
  return Object.fromEntries(
    rig.groups.map((group) => {
      const { min, max } = meshes[group.id].bounds;
      const local = inverse(group.frame);
      return [
        group.id,
        Array.from({ length: 8 }, (_, i) =>
          point(
            local,
            [0, 1, 2].map((k) => (i & (1 << k) ? max[k] : min[k])) as Vec3,
          ),
        ),
      ];
    }),
  );
}

/** Extend a selected mechanism only with the loose groups it currently holds.
 * Cached source corners and live frames remain bounded by native body admission.
 * Release removes the payload automatically; unrelated loose groups stay out. */
export function mechanismHeldView(
  rigId: string,
  geometries: Record<string, MechanismViewGeometry>,
  reports: Record<string, PlayMechanismReport>,
) {
  const report = reports[rigId],
    geometry: MechanismViewGeometry = {},
    groupFrames: Record<string, Transform> = {};
  const include = (id: string, groupId: string) => {
    const corners = geometries[id]?.[groupId],
      frame = reports[id]?.groupFrames[groupId];
    if (!corners || !frame) return;
    const key = JSON.stringify([id, groupId]);
    geometry[key] = corners;
    groupFrames[key] = frame;
  };
  for (const groupId of Object.keys(geometries[rigId] ?? {}))
    include(rigId, groupId);
  for (const grip of Object.values(report.grippers ?? {}))
    if (grip.held) include(grip.held.rigId, grip.held.groupId);
  return { geometry, groupFrames };
}
/** Orbit the complete live rig, including fixed frame and passive outputs.
 * Fit every conservative group corner to the clear frustum at the current pose.
 * The offset centres the rig in the unobscured rectangle. */
export function mechanismOverviewCamera(
  geometry: MechanismViewGeometry,
  snapshot: Pick<MechanismSnapshot, "groupFrames">,
  viewport: { width: number; height: number },
  usable: ViewRect,
  orbit: { yaw: number; pitch: number; zoom: number },
  fovDeg: number,
): CameraSpec {
  const corners = Object.entries(geometry).flatMap(([id, points]) =>
    points.map((p) => point(snapshot.groupFrames[id], p)),
  );
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (const p of corners)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p[k]);
      max[k] = Math.max(max[k], p[k]);
    }
  const center = min.map((v, k) => (v + max[k]) / 2) as Vec3;
  const radius = Math.max(
    1,
    Math.hypot(...max.map((v, k) => (v - min[k]) / 2)),
  );
  const tangent = Math.tan((fovDeg * Math.PI) / 360);
  const aspect = viewport.width / viewport.height;
  const { yaw, pitch } = orbit;
  // LDraw has -Y up; yaw zero views the model from its +Z side.
  const back: Vec3 = [
    Math.sin(yaw) * Math.cos(pitch),
    -Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch),
  ];
  const right: Vec3 = [-Math.cos(yaw), 0, Math.sin(yaw)];
  const up: Vec3 = [
    -Math.sin(yaw) * Math.sin(pitch),
    -Math.cos(pitch),
    -Math.cos(yaw) * Math.sin(pitch),
  ];
  const left = (2 * usable.x) / viewport.width - 1,
    rightEdge = (2 * (usable.x + usable.width)) / viewport.width - 1,
    bottom = 1 - (2 * (usable.y + usable.height)) / viewport.height,
    top = 1 - (2 * usable.y) / viewport.height,
    centerX = (left + rightEdge) / 2,
    centerY = (bottom + top) / 2;
  const dot = (a: Vec3, b: Vec3) => a.reduce((sum, v, k) => sum + v * b[k], 0);
  let fitDistance = 1;
  for (const corner of corners) {
    const offset = corner.map((v, k) => v - center[k]) as Vec3,
      depth = dot(offset, back),
      x = dot(offset, right) / (tangent * aspect),
      y = dot(offset, up) / tangent;
    // Solve all four shifted perspective planes, including each corner's
    // depth. The camera stays ahead of every group bound. Recompute as the
    // mechanism moves, so a long narrow rig needs no enclosing-sphere padding.
    fitDistance = Math.max(
      fitDistance,
      depth + 1,
      (-left * depth - x) / (centerX - left),
      (x + rightEdge * depth) / (rightEdge - centerX),
      (-bottom * depth - y) / (centerY - bottom),
      (y + top * depth) / (top - centerY),
    );
  }
  const distance = fitDistance * 1.08 * orbit.zoom;
  const shiftX =
    (1 - (2 * (usable.x + usable.width / 2)) / viewport.width) *
    distance *
    tangent *
    aspect;
  const shiftY =
    ((2 * (usable.y + usable.height / 2)) / viewport.height - 1) *
    distance *
    tangent;
  const target = center.map(
    (v, k) => v + right[k] * shiftX + up[k] * shiftY,
  ) as Vec3;
  return {
    space: "ldraw",
    projection: "perspective",
    target,
    position: target.map((v, k) => v + back[k] * distance) as Vec3,
    up: [0, -1, 0],
    fovDeg,
    near: Math.max(0.01, radius / 10000),
    far: Math.max(100000, distance + radius * 4),
  };
}

/** Choose the largest clear region beside or above a control sheet. */
export function mechanismUsableRect(
  width: number,
  height: number,
  panel?: ViewRect,
  topInset = 0,
): ViewRect {
  const y = Math.max(0, Math.min(height - 1, topInset));
  if (!panel) return { x: 0, y, width, height: height - y };
  const left = Math.max(0, Math.min(width, panel.x - 12));
  const above = Math.max(0, Math.min(height, panel.y - 12) - y);
  return left * (height - y) > width * above
    ? { x: 0, y, width: Math.max(1, left), height: height - y }
    : { x: 0, y, width, height: Math.max(1, above) };
}
