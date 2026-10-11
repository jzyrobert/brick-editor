import { expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { add, identity, mv } from "../../src/core/math";
import { axisRotation } from "../../src/mechanisms/kinematic";
import type { Transform, Vec3 } from "../../src/core/types";
import {
  vehicleCameraBounds,
  vehicleChaseCamera,
} from "../../src/play/vehicle-camera";

const corners = Array.from(
  { length: 8 },
  (_, i) => [i & 1 ? 50 : -50, i & 2 ? 0 : -60, i & 4 ? 100 : -100] as Vec3,
);
it.each([
  [1080, 1800],
  [360, 600],
  [411, 685],
  [390, 844],
  [686, 411],
  [1440, 1000],
])(
  "fits the whole vehicle with constant distance through steering and manual orbit at %s×%s",
  (width, height) => {
    const rest = identity();
    const bounds = vehicleCameraBounds(
      { chassis: corners },
      { chassis: rest },
      rest,
    );
    let distance: number | undefined;
    for (let angle = -Math.PI; angle <= Math.PI; angle += Math.PI / 12) {
      const frame: Transform = {
        position: [400, -20, -300],
        basis: axisRotation([0, -1, 0], angle),
      };
      for (const orbit of [0, 1.1, Math.PI]) {
        const spec = vehicleChaseCamera(
          bounds,
          frame,
          { yaw: angle + orbit, pitch: Math.PI / 7, zoom: 1 },
          width / height,
          60,
          0.5,
        );
        const arm = Math.hypot(
          ...spec.position.map((v, k) => v - spec.target[k]),
        );
        distance ??= arm;
        expect(arm).toBeCloseTo(distance, 8);
        expect(spec.near).toBe(0.5);
        const camera = new PerspectiveCamera(
          60,
          width / height,
          spec.near,
          spec.far,
        );
        camera.position.fromArray(spec.position);
        camera.up.fromArray(spec.up);
        camera.lookAt(new Vector3(...spec.target));
        camera.updateMatrixWorld();
        for (const p of corners) {
          const projected = new Vector3(
            ...add(frame.position, mv(frame.basis, p)),
          ).project(camera);
          expect(Math.abs(projected.x)).toBeLessThan(1);
          expect(Math.abs(projected.y)).toBeLessThan(1);
          expect(projected.z).toBeGreaterThan(-1);
          expect(projected.z).toBeLessThan(1);
        }
      }
    }
  },
);
