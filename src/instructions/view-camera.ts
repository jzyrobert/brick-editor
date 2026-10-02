import { Vector3 } from "three";
import type { CameraSpec, Vec3 } from "../core/types";

/** Keep a saved 4:3 placement view inside the viewer's unobstructed rectangle.
 * This changes presentation only; the saved plan and source poses stay intact.
 */
export function fitInstructionView(
  camera: CameraSpec,
  viewport: { width: number; height: number },
  insets: { top: number; right: number; bottom: number; left: number },
): CameraSpec {
  const width = Math.max(1, viewport.width),
    height = Math.max(1, viewport.height),
    freeWidth = Math.max(8, width - insets.left - insets.right),
    freeHeight = Math.max(8, height - insets.top - insets.bottom),
    scale = Math.max(height / freeHeight, ((4 / 3) * height) / freeWidth),
    back = new Vector3(...camera.position).sub(new Vector3(...camera.target)),
    distance = back.length(),
    right = back
      .clone()
      .negate()
      .cross(new Vector3(...camera.up))
      .normalize(),
    up = right.clone().cross(back.clone().negate()).normalize(),
    span =
      camera.projection === "orthographic"
        ? (camera.span ?? 600) * scale
        : 2 *
          distance *
          scale *
          Math.tan(((camera.fovDeg ?? 45) * Math.PI) / 360),
    target = new Vector3(...camera.target)
      .addScaledVector(
        right,
        ((insets.right - insets.left) * span) / (2 * height),
      )
      .addScaledVector(
        up,
        ((insets.top - insets.bottom) * span) / (2 * height),
      ),
    position = target
      .clone()
      .add(
        back.multiplyScalar(camera.projection === "orthographic" ? 1 : scale),
      );
  return {
    ...camera,
    position: position.toArray() as Vec3,
    target: target.toArray() as Vec3,
    ...(camera.projection === "orthographic" ? { span } : {}),
    far: Math.max(camera.far, distance * scale * 6),
  };
}
