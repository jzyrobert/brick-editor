import { expect, it } from "vitest";
import { BoxGeometry, Matrix4 } from "three";
import { PlaySession } from "../../src/play/session";
import { PLAY_ZOOM_LIMITS, type CollisionSnapshot } from "../../src/play/types";
import { pinchZoomFactor, wheelZoomFactor } from "../../src/play/zoom-input";

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
    bounds: { min: [-400, -100, -400], max: [400, 0, 400] },
  };
};
const arm = (s: PlaySession) => {
  const c = s.camera();
  return Math.hypot(...c.position.map((v, k) => v - c.target[k]));
};

it("maps wheel, line, page and pinch deltas to bounded zoom factors", () => {
  expect(wheelZoomFactor({ deltaY: 0, deltaMode: 0, ctrlKey: false })).toBe(1);
  // One notch out (100 px or 3 lines) is about 16%; in is the inverse.
  const out = wheelZoomFactor({ deltaY: 100, deltaMode: 0, ctrlKey: false });
  expect(out).toBeCloseTo(1.162, 3);
  expect(
    wheelZoomFactor({ deltaY: -100, deltaMode: 0, ctrlKey: false }),
  ).toBeCloseTo(1 / out, 6);
  expect(
    wheelZoomFactor({ deltaY: 3, deltaMode: 1, ctrlKey: false }),
  ).toBeCloseTo(1.16, 2);
  // Pages and huge deltas are capped.
  expect(wheelZoomFactor({ deltaY: 5, deltaMode: 2, ctrlKey: false })).toBe(
    Math.exp(0.5),
  );
  // Trackpad pinch (ctrl+wheel): small deltas, spread fingers zoom in.
  expect(
    wheelZoomFactor({ deltaY: -10, deltaMode: 0, ctrlKey: true }),
  ).toBeCloseTo(Math.exp(-0.1), 6);
  expect(pinchZoomFactor(100, 200)).toBe(0.6);
  expect(pinchZoomFactor(100, 110)).toBeCloseTo(100 / 110, 6);
  expect(pinchZoomFactor(0, 110)).toBe(1);
});

it("zooms the third-person camera smoothly within limits and hands over to first person", async () => {
  const s = await PlaySession.create(mesh([[0, 1, 0, 800, 2, 800]]), {
    position: [0, -0.3, 0],
    cameraMode: "third-person",
  });
  s.stepTicks(30);
  expect(arm(s)).toBeCloseTo(160, 3);
  // Zooming in eases the camera in over a few ticks instead of jumping.
  s.zoomCamera(0.5);
  expect(s.snapshot().cameraSettings.followDistance).toBe(80);
  expect(arm(s)).toBeCloseTo(160, 3);
  s.stepTicks(2);
  const easing = arm(s);
  expect(easing).toBeLessThan(160);
  expect(easing).toBeGreaterThan(80);
  s.stepTicks(90);
  expect(arm(s)).toBeCloseTo(80, 1);
  // Out, clamped at the far limit.
  for (let i = 0; i < 20; i++) s.zoomCamera(1.5);
  expect(s.snapshot().cameraSettings.followDistance).toBe(PLAY_ZOOM_LIMITS.max);
  s.stepTicks(120);
  expect(arm(s)).toBeCloseTo(PLAY_ZOOM_LIMITS.max, 0);
  // In to the closest distance: the first notch past it is absorbed…
  while (s.snapshot().cameraSettings.followDistance > PLAY_ZOOM_LIMITS.min)
    s.zoomCamera(0.7);
  expect(s.snapshot()).toMatchObject({
    cameraMode: "third-person",
    cameraSettings: { followDistance: PLAY_ZOOM_LIMITS.min },
  });
  // …(trackpads send many small steps: they add up)…
  s.zoomCamera(0.95);
  expect(s.snapshot().cameraMode).toBe("third-person");
  // …and a further notch switches to first person.
  s.zoomCamera(0.86);
  expect(s.snapshot().cameraMode).toBe("first-person");
  expect(arm(s)).toBeCloseTo(100, 3);
  // More zoom-in stays in first person; zooming out returns to third
  // person at the closest distance, pulling back smoothly from the figure.
  s.zoomCamera(0.5);
  expect(s.snapshot().cameraMode).toBe("first-person");
  s.zoomCamera(1.2);
  expect(s.snapshot()).toMatchObject({
    cameraMode: "third-person",
    cameraSettings: { followDistance: PLAY_ZOOM_LIMITS.min },
  });
  s.stepTicks(1);
  expect(arm(s)).toBeLessThan(PLAY_ZOOM_LIMITS.min);
  s.stepTicks(90);
  expect(arm(s)).toBeCloseTo(PLAY_ZOOM_LIMITS.min, 1);
  expect(() => s.zoomCamera(0)).toThrow(/positive/);
  expect(() => s.zoomCamera(Number.NaN)).toThrow(/positive/);
  s.dispose();
});

it("never zooms the camera through a wall", async () => {
  // A wall 60 LDU behind the explorer (who faces −Z).
  const s = await PlaySession.create(
    mesh([
      [0, 1, 0, 800, 2, 800],
      [0, -100, 60, 400, 200, 4],
    ]),
    { position: [0, -0.3, 0], cameraMode: "third-person", yaw: 0 },
  );
  s.stepTicks(10);
  const blocked = arm(s);
  expect(blocked).toBeLessThan(60);
  s.zoomCamera(2);
  s.stepTicks(60);
  expect(arm(s)).toBeCloseTo(blocked, 3);
  s.dispose();
});
