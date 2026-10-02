import { it, expect } from "vitest";
import { OrthographicCamera, PerspectiveCamera, Vector3 } from "three";
import { fitInstructionView } from "../../src/instructions/view-camera";
import type { CameraSpec } from "../../src/core/types";

it("projects saved placement corners into the unobstructed phone/desktop area without changing the plan camera", () => {
  for (const projection of ["orthographic", "perspective"] as const)
    for (const [width, height, insets] of [
      [360, 600, { top: 64, right: 0, bottom: 280, left: 0 }],
      [686, 411, { top: 64, right: 272, bottom: 0, left: 0 }],
      [1440, 1000, { top: 64, right: 0, bottom: 240, left: 0 }],
    ] as const) {
      const source: CameraSpec = {
          space: "ldraw",
          projection,
          position: [220, -180, 220],
          target: [0, 0, 0],
          up: [0, -1, 0],
          near: 1,
          far: 5000,
          fovDeg: 45,
          span: 160,
        },
        before = structuredClone(source),
        fitted = fitInstructionView(source, { width, height }, insets),
        aspect = width / height,
        camera =
          projection === "orthographic"
            ? new OrthographicCamera(
                (-fitted.span! * aspect) / 2,
                (fitted.span! * aspect) / 2,
                fitted.span! / 2,
                -fitted.span! / 2,
                1,
                fitted.far,
              )
            : new PerspectiveCamera(45, aspect, 1, fitted.far),
        back = new Vector3(...source.position),
        right = back
          .clone()
          .negate()
          .cross(new Vector3(...source.up))
          .normalize(),
        up = right.clone().cross(back.clone().negate()).normalize(),
        halfHeight =
          projection === "orthographic"
            ? source.span! / 2
            : back.length() * Math.tan(Math.PI / 8);
      camera.position.fromArray(fitted.position);
      camera.up.fromArray(fitted.up);
      camera.lookAt(new Vector3(...fitted.target));
      camera.updateMatrixWorld();
      for (const x of [-1, 1])
        for (const y of [-1, 1]) {
          const point = right
              .clone()
              .multiplyScalar((x * halfHeight * 4) / 3)
              .addScaledVector(up, y * halfHeight)
              .project(camera),
            px = ((point.x + 1) * width) / 2,
            py = ((1 - point.y) * height) / 2;
          expect(px).toBeGreaterThanOrEqual(insets.left - 0.001);
          expect(px).toBeLessThanOrEqual(width - insets.right + 0.001);
          expect(py).toBeGreaterThanOrEqual(insets.top - 0.001);
          expect(py).toBeLessThanOrEqual(height - insets.bottom + 0.001);
        }
      expect(source).toEqual(before);
    }
});
