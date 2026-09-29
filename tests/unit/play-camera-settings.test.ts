import { expect, it } from "vitest";
import { BoxGeometry, Matrix4, PerspectiveCamera, Vector3 } from "three";
import { PlaySession } from "../../src/play/session";
import {
  CHARACTER_PROFILE,
  PLAY_CAMERA_DEFAULTS,
  type CollisionSnapshot,
} from "../../src/play/types";
import { validate } from "../../src/core/validate";
const mesh = (
  boxes: Array<[number, number, number, number, number, number]>,
): CollisionSnapshot => {
  const vertices: number[] = [],
    indices: number[] = [];
  for (const [x, y, z, w, h, d] of boxes) {
    const g = new BoxGeometry(w, h, d).applyMatrix4(
        new Matrix4().makeTranslation(x, y, z),
      ),
      p = g.getAttribute("position"),
      offset = vertices.length / 3;
    for (let i = 0; i < p.count; i++)
      vertices.push(p.getX(i), p.getY(i), p.getZ(i));
    for (const i of g.index!.array) indices.push(offset + i);
    g.dispose();
  }
  return {
    revision: 0,
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    bounds: { min: [-100, -100, -100], max: [100, 0, 100] },
  };
};
it("validates camera settings atomically and preserves actor dimensions and position", async () => {
  const s = await PlaySession.create(mesh([]), {
    position: [0, -0.3, 0],
    cameraSettings: {
      eyeHeight: 32,
      fovDeg: 90,
      near: 1,
      followDistance: 180,
      minPitch: -0.6,
      maxPitch: 0.7,
    },
  });
  const actor = s.snapshot().position;
  s.setInput({ pitch: 1.4 });
  expect(s.snapshot().pitch).toBe(0.7);
  expect(s.camera().position[1]).toBeCloseTo(actor[1] - 32);
  expect(s.camera().fovDeg).toBe(90);
  const before = s.snapshot();
  for (const settings of [
    { near: 0 },
    { near: Infinity },
    { eyeHeight: 120 },
    { followDistance: -1 },
    { minPitch: 0, maxPitch: 0 },
    { fovDeg: 110 },
    { bogus: 1 },
  ])
    expect(() => s.configureCamera(settings)).toThrow();
  expect(s.snapshot()).toEqual(before);
  s.configureCamera({ eyeHeight: 64, maxPitch: 0.3 });
  expect(s.snapshot().pitch).toBe(0.3);
  expect(s.snapshot().position).toEqual(actor);
  expect(s.snapshot().profile.height).toBe(CHARACTER_PROFILE.height);
  s.setInput({ pitch: 0 });
  s.setCameraMode("third-person");
  expect(
    Math.hypot(...s.camera().position.map((v, k) => v - s.camera().target[k])),
  ).toBeCloseTo(180, 4);
  validate("playSnapshot", s.snapshot());
  s.dispose();
  await expect(
    PlaySession.create(mesh([]), { cameraSettings: { near: -1 } }),
  ).rejects.toThrow();
});
it("sweeps the full configured near-plane footprint near a ceiling and restores capture aspect without camera drift", async () => {
  const s = await PlaySession.create(
    // A corridor the minifig (104 × 24 LDU) just fits: ceiling at 110 LDU,
    // walls 28 LDU apart.
    mesh([
      [0, -110, 0, 200, 2, 200],
      [15, -55, 0, 2, 110, 200],
      [-15, -55, 0, 2, 110, 200],
      [0, -55, 40, 200, 110, 2],
    ]),
    {
      position: [0, -0.3, 0],
      cameraMode: "third-person",
      pitch: -0.8,
      cameraSettings: { fovDeg: 100, near: 2, followDistance: 300 },
    },
  );
  s.chooseSpawn({ position: [0, -0.3, 0] });
  s.useSpawn();
  s.setViewportAspect(4);
  s.stepTicks(2);
  const spec = s.camera(),
    safety = s.snapshot().cameraSafety;
  expect(safety.collisionRadius).toBeLessThanOrEqual(7.500001);
  expect(safety.collisionRadius).toBeGreaterThan(4);
  const c = new PerspectiveCamera(spec.fovDeg, 4, spec.near, spec.far);
  c.position.fromArray(spec.position);
  c.up.fromArray(spec.up);
  c.lookAt(...spec.target);
  c.updateMatrixWorld(true);
  for (const x of [-1, 1])
    for (const y of [-1, 1]) {
      const corner = new Vector3(x, y, -1).unproject(c);
      expect(corner.y).toBeGreaterThan(-109);
      expect(Math.abs(corner.x)).toBeLessThan(14);
      expect(corner.z).toBeLessThan(39);
    }
  const before = s.camera(),
    report = s.snapshot(),
    restore = s.beginCameraCapture(40);
  expect(s.camera().near).toBeLessThan(before.near);
  expect(s.snapshot().cameraSafety.aspectRatio).toBe(40);
  restore();
  expect(s.camera()).toEqual(before);
  expect(s.snapshot()).toEqual(report);
  s.dispose();
});
it("stores an exact session spawn without movement, refuses unsupported locations and reuses its view in Walk", async () => {
  const s = await PlaySession.create(mesh([[40, -36, 0, 20, 72, 20]]), {
    position: [0, -0.3, 0],
  });
  const before = s.snapshot();
  expect(() => s.useSpawn()).toThrow();
  const saved = s.chooseSpawn({
    position: [-30, -0.3, 20],
    yaw: 1,
    pitch: 0.2,
  });
  expect(saved.position).toEqual(before.position);
  expect(saved.tick).toBe(before.tick);
  for (const position of [
    [40, -0.3, 0],
    [-30, -30, 20],
    [-30, 10, 20],
  ] as [number, number, number][])
    expect(() => s.chooseSpawn({ position })).toThrow();
  expect(s.snapshot().spawn).toEqual(saved.spawn);
  s.teleport({ position: [100, -100, 100], policy: "free-flight" });
  const used = s.useSpawn();
  expect(used.locomotion).toBe("walk");
  expect(used.position).toEqual([-30, -0.3, 20]);
  expect(used.yaw).toBe(1);
  expect(used.pitch).toBe(0.2);
  expect(used.cameraSettings).toEqual(PLAY_CAMERA_DEFAULTS);
  s.dispose();
});
