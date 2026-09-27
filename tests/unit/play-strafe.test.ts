import { expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { PlaySession } from "../../src/play/session";
import { conversion } from "../../src/core/math";
import type { CollisionSnapshot } from "../../src/play/types";
const world: CollisionSnapshot = {
  revision: 0,
  vertices: new Float32Array(),
  indices: new Uint32Array(),
  bounds: { min: [-100, 0, -100], max: [100, 0, 100] },
};
for (const locomotion of ["walk", "fly-noclip"] as const)
  for (const cameraMode of ["first-person", "third-person"] as const)
    it(`${locomotion}/${cameraMode} strafe follows rendered camera right at multiple headings`, async () => {
      for (const yaw of [0, Math.PI / 2, Math.PI, 4.1])
        for (const direction of [-1, 1]) {
          const session = await PlaySession.create(world, {
            locomotion,
            cameraMode,
            position: [0, -0.3, 0],
            yaw,
            pitch: 0.3,
          });
          try {
            const view = session.camera(),
              camera = new PerspectiveCamera(
                view.fovDeg,
                1,
                view.near,
                view.far,
              );
            camera.position.fromArray(conversion(view.position));
            camera.up.fromArray(conversion(view.up));
            camera.lookAt(new Vector3(...conversion(view.target)));
            camera.updateMatrixWorld(true);
            const renderedRight = new Vector3().setFromMatrixColumn(
              camera.matrixWorld,
              0,
            );
            const before = new Vector3(
              ...conversion(session.snapshot().position),
            );
            session.setInput({ moveX: direction });
            session.stepTicks(6);
            const displacement = new Vector3(
              ...conversion(session.snapshot().position),
            ).sub(before);
            expect(displacement.dot(renderedRight) * direction).toBeGreaterThan(
              9,
            );
            // Pure strafe must not change the camera-relative forward position.
            const forward = camera.getWorldDirection(new Vector3());
            forward.y = 0;
            forward.normalize();
            expect(Math.abs(displacement.dot(forward))).toBeLessThan(0.01);
          } finally {
            session.dispose();
          }
        }
    });
