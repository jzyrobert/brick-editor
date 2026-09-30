/**
 * Standard review cameras framing a compiled build (LDraw axes: −Y up, the
 * front faces −Z). Agents render these after each compile to check the
 * silhouette from several sides, as MineBench judges do.
 */
import type { CameraSpec, Vec3 } from "../core/types";

export const BUILD_VIEWS = [
  "iso",
  "front",
  "back",
  "left",
  "right",
  "top",
  "iso-back",
] as const;
export type BuildView = (typeof BUILD_VIEWS)[number];
const DIRECTIONS: Record<BuildView, Vec3> = {
  iso: [0.75, -0.65, -1],
  front: [0, -0.25, -1],
  back: [0, -0.25, 1],
  left: [-1, -0.25, 0],
  right: [1, -0.25, 0],
  top: [0, -1, -0.3],
  "iso-back": [-0.75, -0.65, 1],
};
export const isBuildView = (v: string): v is BuildView =>
  (BUILD_VIEWS as readonly string[]).includes(v);

/** A perspective camera that frames `bounds` (LDU) from `view`. */
export function viewCamera(
  bounds: { min: Vec3; max: Vec3 },
  view: BuildView = "iso",
  aspect = 4 / 3,
): CameraSpec {
  const fovDeg = 35;
  const center = [0, 1, 2].map((i) => (bounds.min[i] + bounds.max[i]) / 2);
  const radius =
    Math.hypot(
      bounds.max[0] - bounds.min[0],
      bounds.max[1] - bounds.min[1],
      bounds.max[2] - bounds.min[2],
    ) / 2 || 100;
  const half = ((fovDeg / 2) * Math.PI) / 180;
  const d = DIRECTIONS[view];
  const len = Math.hypot(...d);
  const back = d.map((v) => v / len) as Vec3; // centre → camera
  // Camera axes (world up is −Y): right = up × back, up' = back × right.
  const cross = (a: number[], b: number[]) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const norm = (v: number[]) => {
    const l = Math.hypot(...v) || 1;
    return v.map((x) => x / l);
  };
  const right = norm(
    Math.abs(back[1]) > 0.999 ? [1, 0, 0] : cross([0, -1, 0], back),
  );
  const up = cross(back, right);
  // The distance at which every corner of the box is in the frustum (a
  // sphere round the box wastes most of the frame on flat, wide builds).
  const tanV = Math.tan(half),
    tanH = tanV * aspect;
  let distance = 0;
  for (let c = 0; c < 8; c++) {
    const p = [0, 1, 2].map((i) =>
      (c >> i) & 1 ? bounds.max[i] : bounds.min[i],
    );
    const rel = p.map((v, i) => v - center[i]);
    const dot = (a: number[]) => a[0] * rel[0] + a[1] * rel[1] + a[2] * rel[2];
    const along = dot(back);
    distance = Math.max(
      distance,
      along + Math.abs(dot(right)) / tanH,
      along + Math.abs(dot(up)) / tanV,
    );
  }
  distance = Math.max(distance * 1.04, radius * 0.5, 100);
  const position = center.map((c, i) => c + back[i] * distance) as Vec3;
  return {
    space: "ldraw",
    projection: "perspective",
    position,
    target: center as Vec3,
    up: [0, -1, 0],
    fovDeg,
    near: Math.max(1, distance / 100),
    far: distance * 4 + radius * 4,
  };
}
