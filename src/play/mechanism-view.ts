import type { CameraSpec, Transform, Vec3 } from "../core/types";
import { add, inverse, mv } from "../core/math";
import type { MechanismSnapshot, MotionRig } from "../mechanisms/types";
import type { CollisionSnapshot } from "./types";

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

/** Orbit the complete live rig, including fixed frame and passive outputs.
 * Sphere fit remains conservative through motion. The offset centres the rig
 * in the unobscured rectangle, rather than behind the control sheet. */
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
  const vertical = (tangent * usable.height) / viewport.height;
  const horizontal = (tangent * aspect * usable.width) / viewport.width;
  // Off-centre frustum planes are steeper on the sheet's side. Fitting only
  // the smaller field of view misses that perspective skew on narrow screens.
  const edgeX = Math.max(
    Math.abs((2 * usable.x) / viewport.width - 1),
    Math.abs((2 * (usable.x + usable.width)) / viewport.width - 1),
  );
  const edgeY = Math.max(
    Math.abs(1 - (2 * usable.y) / viewport.height),
    Math.abs(1 - (2 * (usable.y + usable.height)) / viewport.height),
  );
  const distance =
    radius *
    1.08 *
    Math.max(
      Math.sqrt(1 + (edgeX * tangent * aspect) ** 2) / horizontal,
      Math.sqrt(1 + (edgeY * tangent) ** 2) / vertical,
    ) *
    orbit.zoom;
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
): ViewRect {
  if (!panel) return { x: 0, y: 0, width, height };
  const left = Math.max(0, Math.min(width, panel.x - 12));
  const above = Math.max(0, Math.min(height, panel.y - 12));
  return left * height > width * above
    ? { x: 0, y: 0, width: Math.max(1, left), height }
    : { x: 0, y: 0, width, height: Math.max(1, above) };
}
