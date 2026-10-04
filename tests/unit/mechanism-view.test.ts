import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import {
  mechanismOverviewCamera,
  mechanismUsableRect,
  mechanismViewGeometry,
} from "../../src/play/mechanism-view";
import { identity } from "../../src/core/math";
import { axisRotation } from "../../src/mechanisms/kinematic";
import type { MotionRig } from "../../src/mechanisms/types";
import type { Transform } from "../../src/core/types";

const rest = identity();
const rig: MotionRig = {
  schemaVersion: 1,
  id: "view",
  name: "Large drive",
  mode: "kinematic",
  joints: [],
  groups: [
    { id: "frame", occurrenceIds: [], frame: rest, restTransforms: {} },
    {
      id: "arm",
      occurrenceIds: [],
      frame: { ...rest, position: [400, -300, 100] },
      restTransforms: {},
    },
  ],
};
const geometry = mechanismViewGeometry(rig, {
  frame: { bounds: { min: [-600, -400, -200], max: [600, 0, 200] } },
  arm: { bounds: { min: [400, -300, 100], max: [1300, -200, 200] } },
});
describe("whole-mechanism presentation camera", () => {
  it.each([
    [1440, 1000],
    [360, 600],
    [411, 685],
    [390, 844],
    [1080, 1800],
    [686, 411],
  ])(
    "fits every live group corner outside controls at %s×%s through orbit and motion",
    (width, height) => {
      const panel =
        width <= 600 && height > 500
          ? {
              x: 16,
              y: height * 0.52,
              width: width - 32,
              height: height * 0.45,
            }
          : { x: width - 356, y: 80, width: 340, height: height - 100 };
      const usable = mechanismUsableRect(width, height, panel, 76);
      expect(usable.y).toBe(76);
      expect(usable.width * usable.height).toBeGreaterThan(
        width * height * 0.35,
      );
      for (const yaw of [0, 0.7, 2.3, 4.8])
        for (const angle of [0, 45, 110]) {
          const frame: Transform = {
            position: [400, -300, 100],
            basis: axisRotation([0, 0, 1], angle),
          };
          const groupFrames = { frame: rest, arm: frame };
          const spec = mechanismOverviewCamera(
            geometry,
            { groupFrames },
            { width, height },
            usable,
            { yaw, pitch: 0.45, zoom: 1 },
            60,
          );
          const camera = new PerspectiveCamera(
            spec.fovDeg,
            width / height,
            spec.near,
            spec.far,
          );
          camera.position.set(...spec.position);
          camera.up.set(...spec.up);
          camera.lookAt(new Vector3(...spec.target));
          camera.updateMatrixWorld();
          for (const [id, points] of Object.entries(geometry))
            for (const p of points) {
              const frame = groupFrames[id as keyof typeof groupFrames];
              const b = frame.basis;
              const v = new Vector3(
                frame.position[0] + b[0] * p[0] + b[1] * p[1] + b[2] * p[2],
                frame.position[1] + b[3] * p[0] + b[4] * p[1] + b[5] * p[2],
                frame.position[2] + b[6] * p[0] + b[7] * p[1] + b[8] * p[2],
              ).project(camera);
              const x = ((v.x + 1) * width) / 2,
                y = ((1 - v.y) * height) / 2;
              expect(x).toBeGreaterThanOrEqual(usable.x);
              expect(x).toBeLessThanOrEqual(usable.x + usable.width);
              expect(y).toBeGreaterThanOrEqual(usable.y);
              expect(y).toBeLessThanOrEqual(usable.y + usable.height);
              expect(v.z).toBeGreaterThan(-1);
              expect(v.z).toBeLessThan(1);
            }
        }
    },
  );
});
