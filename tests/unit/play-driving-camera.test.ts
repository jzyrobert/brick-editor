import { expect, it } from "vitest";
import { BoxGeometry } from "three";
import { PlaySession } from "../../src/play/session";
import { openBenchFixture } from "../../src/mechanisms/fixtures";
import { movingSource } from "../helpers/play-moving-source";
import { wrapAngle } from "../../src/play/avatar-motion";
import type { CameraSpec } from "../../src/core/types";

const arm = (camera: CameraSpec) =>
  Math.hypot(...camera.position.map((v, i) => v - camera.target[i]));
const yaw = (camera: CameraSpec) =>
  Math.atan2(
    camera.target[0] - camera.position[0],
    camera.position[2] - camera.target[2],
  );
async function car(wall = false, possession = false) {
  const source = await movingSource("vehicle", openBenchFixture());
  if (wall) {
    const geometry = new BoxGeometry(400, 240, 4).toNonIndexed();
    geometry.translate(0, -120, -120);
    const vertices = geometry.getAttribute("position").array;
    const offset = source.geometry.vertices.length / 3;
    source.geometry.vertices = new Float32Array([
      ...source.geometry.vertices,
      ...vertices,
    ]);
    source.geometry.indices = new Uint32Array([
      ...source.geometry.indices,
      ...Array.from({ length: vertices.length / 3 }, (_, i) => i + offset),
    ]);
    geometry.dispose();
  }
  const play = await PlaySession.create(
    source.geometry,
    {
      rigId: "vehicle",
      position: [80, -0.3, -188],
      cameraMode: "third-person",
    },
    source.mechanism,
  );
  if (possession) play.controlVehicle("vehicle");
  else play.enterVehicle({ rigId: "vehicle", seatId: "driver" });
  return play;
}

it.each([false, true])(
  "keeps the follow distance through full steering circles and follows heading across the angle seam (possession %s)",
  async (possession) => {
    const play = await car(false, possession);
    const distance = arm(play.camera());
    try {
      play.setInput({ moveZ: 1, moveX: -1 });
      let previousYaw = yaw(play.camera());
      for (let tick = 0; tick < 300; tick++) {
        const state = play.stepTicks(1);
        expect(state.mechanism!.vehicleCollision!.status).toBe("ready");
        const camera = play.camera();
        expect(arm(camera)).toBeCloseTo(distance, 6);
        expect(camera.near).toBeCloseTo(state.cameraSafety.effectiveNear);
        const heading =
          (state.mechanism!.pose.vehicle!.headingDegrees * Math.PI) / 180;
        expect(Math.abs(wrapAngle(yaw(camera) - heading))).toBeLessThan(0.35);
        expect(Math.abs(wrapAngle(yaw(camera) - previousYaw))).toBeLessThan(
          0.04,
        );
        previousYaw = yaw(camera);
        // Reading/capturing the camera never advances the spring.
        expect(play.camera()).toEqual(camera);
      }
      expect(
        play.snapshot().mechanism!.pose.vehicle!.headingDegrees,
      ).toBeGreaterThan(360);
    } finally {
      play.dispose();
    }
  },
);

it.each([false, true])(
  "keeps a manual parked orbit, then eases behind the car when driving; reverse keeps the rear view (possession %s)",
  async (possession) => {
    const play = await car(false, possession);
    try {
      play.setInput({ yaw: 1.5 });
      const orbit = play.camera();
      play.stepTicks(120);
      expect(play.camera()).toEqual(orbit);
      play.setInput({ moveZ: 1 });
      play.stepTicks(90);
      expect(Math.abs(yaw(play.camera()))).toBeLessThan(0.05);
      play.setInput({ moveZ: -1 });
      play.stepTicks(30);
      expect(Math.abs(yaw(play.camera()))).toBeLessThan(0.05);
    } finally {
      play.dispose();
    }
  },
);

it.each([360 / 600, 1080 / 1800, 686 / 411, 1440 / 1000])(
  "still retracts before a foreign wall and recovers while driving away, aspect %s",
  async (aspect) => {
    const play = await car(true);
    try {
      play.setViewportAspect(aspect);
      const blocked = play.camera();
      expect(arm(blocked)).toBeLessThan(110);
      expect(blocked.position[2]).toBeLessThan(-122 - 4);
      play.setInput({ moveZ: 1 });
      let previous = arm(blocked);
      for (let tick = 0; tick < 120; tick++) {
        play.stepTicks(1);
        const camera = play.camera();
        expect(camera.position[2]).toBeLessThan(-122 - 4);
        expect(arm(camera)).toBeGreaterThanOrEqual(previous - 1e-5);
        previous = arm(camera);
      }
      expect(previous).toBeCloseTo(
        play.snapshot().cameraSettings.followDistance,
        3,
      );
    } finally {
      play.dispose();
    }
  },
);
