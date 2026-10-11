import { expect, it } from "vitest";
import { PlaySession } from "../../src/play/session";
import { BoxGeometry } from "three";
import type { CollisionSnapshot } from "../../src/play/types";

const open: CollisionSnapshot = {
  revision: 1,
  vertices: new Float32Array(),
  indices: new Uint32Array(),
  bounds: { min: [-1000, 0, -1000], max: [1000, 0, 1000] },
};
const bob = (play: PlaySession) => {
  const camera = play.camera();
  const feet = play.presentation().position;
  return [
    camera.position[0] - feet[0],
    camera.position[1] - feet[1] + play.snapshot().cameraSettings.eyeHeight,
  ];
};
it("adds a small distance-driven first-person walking bob, settles on release, and leaves fly and third person steady", async () => {
  const play = await PlaySession.create(open, { position: [0, -0.3, 0] });
  try {
    expect(bob(play)).toEqual([0, 0]);
    play.setInput({ moveZ: 1 });
    const offsets: number[][] = [];
    for (let tick = 0; tick < 90; tick++) {
      play.stepTicks(1);
      offsets.push(bob(play));
      const camera = play.camera();
      expect(camera.target[0] - camera.position[0]).toBeCloseTo(0, 8);
      expect(camera.target[2] - camera.position[2]).toBeCloseTo(-100, 8);
      expect(play.camera()).toEqual(camera);
    }
    expect(
      Math.max(...offsets.map((p) => p[0])) -
        Math.min(...offsets.map((p) => p[0])),
    ).toBeGreaterThan(0.5);
    expect(Math.max(...offsets.map((p) => p[1]))).toBeGreaterThan(0.5);
    expect(
      offsets.every(([x, y]) => Math.abs(x) <= 0.8 && Math.abs(y) <= 1.4),
    ).toBe(true);
    play.clearInput();
    play.stepTicks(90);
    expect(Math.hypot(...bob(play))).toBeLessThan(1e-4);
    play.setCameraMode("third-person");
    play.setInput({ moveZ: 1 });
    play.stepTicks(20);
    const camera = play.camera();
    expect(camera.target[0]).toBeCloseTo(play.presentation().position[0], 8);
    play.setCameraMode("first-person");
    play.setLocomotion("fly-noclip");
    play.setInput({ moveZ: 1 });
    play.stepTicks(30);
    expect(bob(play)).toEqual([0, 0]);
  } finally {
    play.dispose();
  }
});

it("replays the same bob deterministically and interpolates between ticks", async () => {
  const a = await PlaySession.create(open, { position: [0, -0.3, 0] });
  const b = await PlaySession.create(open, { position: [0, -0.3, 0] });
  try {
    a.setInput({ moveZ: 1, run: true });
    b.setInput({ moveZ: 1, run: true });
    a.stepTicks(40);
    b.stepTicks(40);
    expect(a.camera()).toEqual(b.camera());
    const before = a.camera().position;
    a.advance(1.5 / 60);
    const after = a.camera().position;
    const between = a.camera(true).position;
    between.forEach((v, i) => {
      expect(v).toBeGreaterThanOrEqual(Math.min(before[i], after[i]) - 1e-6);
      expect(v).toBeLessThanOrEqual(Math.max(before[i], after[i]) + 1e-6);
    });
  } finally {
    a.dispose();
    b.dispose();
  }
});

it("settles when holding movement against a wall", async () => {
  const geometry = new BoxGeometry(200, 200, 4).toNonIndexed();
  geometry.translate(0, -100, -60);
  const vertices = geometry.getAttribute("position").array;
  const play = await PlaySession.create(
    {
      ...open,
      vertices: new Float32Array(vertices),
      indices: Uint32Array.from({ length: vertices.length / 3 }, (_, i) => i),
    },
    { position: [0, -0.3, 0] },
  );
  try {
    play.setInput({ moveZ: 1 });
    play.stepTicks(180);
    const feet = play.snapshot().position;
    expect(feet[2]).toBeGreaterThan(-58);
    expect(feet[2]).toBeLessThan(-30);
    expect(Math.hypot(...bob(play))).toBeLessThan(1e-4);
  } finally {
    play.dispose();
    geometry.dispose();
  }
});
