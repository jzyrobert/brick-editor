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
  const fit = Math.min(Math.tan(half), Math.tan(half) * aspect);
  const distance = (radius / fit) * 0.8;
  const d = DIRECTIONS[view];
  const len = Math.hypot(...d);
  const position = center.map((c, i) => c + (d[i] / len) * distance) as Vec3;
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
