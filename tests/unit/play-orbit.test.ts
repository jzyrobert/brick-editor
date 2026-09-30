import { describe, expect, it } from "vitest";
import {
  AVATAR_MOTION,
  ORBIT_HEAD_FADE,
  angularJitter,
  orbitBodyTarget,
  orbitHead,
  wrapAngle,
} from "../../src/play/avatar-motion";
import { PlaySession } from "../../src/play/session";
import { openBenchFixture } from "../../src/mechanisms/fixtures";
import { movingSource } from "../helpers/play-moving-source";
import type { CollisionSnapshot } from "../../src/play/types";
import type { Vec3 } from "../../src/core/types";

const open: CollisionSnapshot = {
  revision: 1,
  vertices: new Float32Array(),
  indices: new Uint32Array(),
  bounds: { min: [-100, 0, -100], max: [100, 0, 100] },
};
const third = () =>
  PlaySession.create(open, {
    position: [0, -0.3, 0],
    cameraMode: "third-person",
  });
/** Unit horizontal direction (LDraw X, Z) of a yaw: forward is −Z at 0. */
const along = (yaw: number) => [Math.sin(yaw), -Math.cos(yaw)];

describe("orbit camera maths", () => {
  it("faces the intended travel and holds its heading without input", () => {
    expect(orbitBodyTarget(1, 0, -1)).toBeCloseTo(0, 12);
    expect(orbitBodyTarget(1, 0, 1)).toBeCloseTo(Math.PI, 12);
    expect(orbitBodyTarget(1, 1, 0)).toBeCloseTo(Math.PI / 2, 12);
    expect(orbitBodyTarget(1, 0, 0)).toBe(1);
  });
  it("follows the look within the neck limit, then eases back continuously to straight ahead", () => {
    const limit = AVATAR_MOTION.headYawLimit,
      pitches = AVATAR_MOTION.headPitchLimits;
    const near = orbitHead(0.3, 0.2, limit, pitches);
    expect(near.headYaw).toBeCloseTo(0.3, 12);
    expect(near.headPitch).toBeCloseTo(0.2, 12);
    expect(orbitHead(-1.5, 1, limit, pitches).headYaw).toBeCloseTo(
      -limit * (1 - (1.5 - limit) / ORBIT_HEAD_FADE),
      12,
    );
    // Camera in front: the face is square to it.
    const front = orbitHead(Math.PI, 0.4, limit, pitches);
    expect(front.headYaw).toBeCloseTo(0, 12);
    expect(front.headPitch).toBeCloseTo(0, 12);
    // No jump anywhere round the circle.
    let previous = orbitHead(-Math.PI, 0, limit, pitches).headYaw;
    for (let a = -Math.PI; a <= Math.PI; a += 0.001) {
      const next = orbitHead(a, 0, limit, pitches).headYaw;
      expect(Math.abs(next - previous)).toBeLessThan(0.002);
      previous = next;
    }
  });
});

describe("third-person orbit", () => {
  it("moves relative to the camera at every camera yaw and turns the figure to face the travel", async () => {
    const play = await third();
    try {
      for (const cameraYaw of [0, 1, 2.5, -2]) {
        for (const [moveX, moveZ, offset] of [
          [0, 1, 0], // W: away from the camera
          [0, -1, Math.PI], // S: towards the camera
          [1, 0, -Math.PI / 2], // D: camera right (LDraw −X at yaw 0)
          [-1, 0, Math.PI / 2], // A: camera left
        ]) {
          play.setInput({ moveX, moveZ, yaw: cameraYaw });
          const before = play.snapshot().position;
          const after = play.stepTicks(40);
          const moved = [
            after.position[0] - before[0],
            after.position[2] - before[2],
          ];
          const length = Math.hypot(...moved),
            want = along(cameraYaw + offset);
          expect(length).toBeGreaterThan(60);
          expect(moved[0] / length).toBeCloseTo(want[0], 3);
          expect(moved[1] / length).toBeCloseTo(want[1], 3);
          // The camera yaw is the player's; only the body turned.
          expect(after.yaw).toBeCloseTo(
            ((cameraYaw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI),
            12,
          );
          expect(
            Math.abs(wrapAngle(after.avatar.heading - (cameraYaw + offset))),
          ).toBeLessThan(1e-3);
        }
      }
    } finally {
      play.dispose();
    }
  });
  it("walking back towards the camera turns the figure round smoothly, without jitter or overshoot", async () => {
    const play = await third();
    try {
      play.setInput({ moveZ: 1, yaw: 0 });
      play.stepTicks(30);
      play.setInput({ moveZ: -1, yaw: 0 });
      const headings: number[] = [];
      for (let t = 0; t < 40; t++)
        headings.push(play.stepTicks(1).avatar.heading);
      expect(Math.abs(wrapAngle(headings.at(-1)! - Math.PI))).toBeLessThan(
        1e-3,
      );
      expect(angularJitter(headings)).toBeLessThan(0.3);
      // One way round, never back: the turn is monotonic.
      const steps = headings
        .slice(1)
        .map((h, i) => wrapAngle(h - headings[i]))
        .filter((d) => Math.abs(d) > 1e-9);
      expect(steps.every((d) => Math.sign(d) === Math.sign(steps[0]))).toBe(
        true,
      );
    } finally {
      play.dispose();
    }
  });
  it("orbits the camera 360 degrees round a standing figure, which keeps its heading so the face can be seen", async () => {
    const play = await third();
    try {
      const heading = play.snapshot().avatar.heading;
      const figure = play.snapshot().position;
      const distances: number[] = [];
      for (let k = 0; k <= 16; k++) {
        const yaw = (k / 16) * 2 * Math.PI;
        play.setInput({ yaw, pitch: 0.2 });
        const s = play.stepTicks(2);
        expect(s.avatar.heading).toBeCloseTo(heading, 12);
        const camera = play.camera();
        // The camera sits behind its look direction, round the figure.
        const dx = camera.position[0] - figure[0],
          dz = camera.position[2] - figure[2];
        distances.push(Math.hypot(dx, dz));
        const back = along(yaw);
        expect(-dx / Math.hypot(dx, dz)).toBeCloseTo(back[0], 6);
        expect(-dz / Math.hypot(dx, dz)).toBeCloseTo(back[1], 6);
      }
      expect(Math.max(...distances) - Math.min(...distances)).toBeLessThan(
        1e-6,
      );
      // Camera in front of the figure, looking back at it: the head is
      // straight, so the face is seen.
      play.setInput({ yaw: heading + Math.PI });
      const front = play.stepTicks(1).avatar;
      expect(front.headYaw).toBeCloseTo(0, 12);
      expect(front.headPitch).toBeCloseTo(0, 12);
      const camera = play.camera().position;
      const facing = along(heading);
      expect(
        (camera[0] - figure[0]) * facing[0] +
          (camera[2] - figure[2]) * facing[1],
      ).toBeGreaterThan(50);
    } finally {
      play.dispose();
    }
  });
  it("first person keeps the body with the camera (walks backward facing forward)", async () => {
    const play = await PlaySession.create(open, { position: [0, -0.3, 0] });
    try {
      play.setInput({ moveZ: -1, yaw: 0.5 });
      const s = play.stepTicks(40);
      expect(s.avatar.heading).toBeCloseTo(0.5, 4);
    } finally {
      play.dispose();
    }
  });
});

describe("seated head", () => {
  it("follows the look in yaw, nods forward but never tips back, and the chase camera orbits the vehicle", async () => {
    const source = await movingSource("vehicle", openBenchFixture());
    const play = await PlaySession.create(
      source.geometry,
      { rigId: "vehicle", position: [80, -0.3, -188] },
      source.mechanism,
    );
    try {
      const seated = play.enterVehicle({
        rigId: "vehicle",
        seatId:
          source.mechanism.project.motionRigs.vehicle.vehicle!.driverSeat!.id,
      });
      play.setCameraMode("third-person");
      const heading = seated.avatar.heading;
      play.setInput({ yaw: heading + 0.5, pitch: -0.3 });
      let avatar = play.snapshot().avatar;
      expect(avatar.headYaw).toBeCloseTo(0.5, 8);
      expect(avatar.headPitch).toBeCloseTo(-0.3, 8);
      play.setInput({ yaw: heading - 0.4, pitch: 0.5 });
      avatar = play.snapshot().avatar;
      expect(avatar.headYaw).toBeCloseTo(-0.4, 8);
      expect(avatar.headPitch).toBeCloseTo(0, 12);
      // Beyond the seated limit the head holds it, then eases back.
      play.setInput({ yaw: heading + 1.2 });
      expect(play.snapshot().avatar.headYaw).toBeGreaterThan(0.2);
      expect(play.snapshot().avatar.headYaw).toBeLessThanOrEqual(0.7);
      play.setInput({ yaw: heading + Math.PI });
      expect(play.snapshot().avatar.headYaw).toBeCloseTo(0, 12);
      // Round the whole vehicle: the camera's bearing from the seat turns
      // with the look through a full circle.
      const pelvis = play.snapshot().occupancy!.pelvisWorldLdu;
      const bearings: number[] = [];
      for (let k = 0; k < 12; k++) {
        play.setInput({ yaw: heading + (k / 12) * 2 * Math.PI, pitch: 0.3 });
        const c: Vec3 = play.camera().position;
        bearings.push(Math.atan2(c[0] - pelvis[0], c[2] - pelvis[2]));
      }
      const turned = bearings
        .slice(1)
        .reduce((sum, b, i) => sum + wrapAngle(b - bearings[i]), 0);
      expect(Math.abs(turned)).toBeGreaterThan(1.6 * Math.PI);
    } finally {
      play.dispose();
    }
  });
});
