import { expect, it } from "vitest";
import { BoxGeometry, Matrix4, Mesh, PerspectiveCamera, Vector3 } from "three";
import { PlaySession } from "../../src/play/session";
import { BrickAvatar } from "../../src/play/avatar";
import {
  PLAY_CAMERA_DEFAULTS,
  type CollisionSnapshot,
} from "../../src/play/types";
import { avatarGeometryFromDisk } from "../helpers/avatar-pack";

type Bounds = [number, number, number, number, number, number];
function fixture(boxes: Bounds[]): CollisionSnapshot {
  const vertices: number[] = [],
    indices: number[] = [];
  for (const [x0, y0, z0, x1, y1, z1] of boxes) {
    const g = new BoxGeometry(x1 - x0, y1 - y0, z1 - z0).applyMatrix4(
      new Matrix4().makeTranslation(
        (x0 + x1) / 2,
        (y0 + y1) / 2,
        (z0 + z1) / 2,
      ),
    );
    const p = g.getAttribute("position"),
      offset = vertices.length / 3;
    for (let i = 0; i < p.count; i++)
      vertices.push(p.getX(i), p.getY(i), p.getZ(i));
    for (const i of g.index!.array) indices.push(offset + i);
    g.dispose();
  }
  return {
    revision: 7,
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    bounds: { min: [-100, -100, -200], max: [100, 0, 200] },
  };
}
function checkNearPlane(s: PlaySession, aspect: number, boxes: Bounds[]) {
  const spec = s.camera(),
    c = new PerspectiveCamera(spec.fovDeg, aspect, spec.near, spec.far);
  c.position.fromArray(spec.position);
  c.up.fromArray(spec.up);
  c.lookAt(...spec.target);
  c.updateMatrixWorld(true);
  // Sample the complete rectangle, not only the camera origin or a centre ray.
  for (const x of [-1, -0.5, 0, 0.5, 1])
    for (const y of [-1, -0.5, 0, 0.5, 1]) {
      const p = new Vector3(x, y, -1).unproject(c);
      for (const [x0, y0, z0, x1, y1, z1] of boxes)
        expect(
          p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1 && p.z > z0 && p.z < z1,
          `near plane entered solid at ${p.toArray()}`,
        ).toBe(false);
    }
}
it.each([360 / 800, 1080 / 1800, 16 / 9, 4])(
  "keeps the near plane clear while traversing a narrow doorway below a low ceiling, aspect %s",
  async (aspect) => {
    const boxes: Bounds[] = [
      [-100, -78, -200, 100, -76, 200],
      [-100, -76, -32, -10, 0, -28],
      [10, -76, -32, 100, 0, -28],
    ];
    const source = fixture(boxes),
      original = source.vertices.slice();
    const s = await PlaySession.create(source, {
      position: [0, -0.3, 30],
      cameraMode: "third-person",
      pitch: -0.35,
      cameraSettings: { near: 2, fovDeg: 100, followDistance: 120 },
    });
    try {
      s.setViewportAspect(aspect);
      s.setInput({ moveZ: 1 });
      for (let tick = 0; tick < 80; tick++) {
        s.stepTicks(1);
        checkNearPlane(s, aspect, boxes);
      }
      expect(s.snapshot().position[2]).toBeLessThan(-90);
      expect(s.snapshot().sourceRevision).toBe(7);
      expect(source.vertices).toEqual(original);
    } finally {
      s.dispose();
    }
  },
);
it("hides every avatar mesh when the follow arm is squeezed, then restores smoothly without moving the actor", async () => {
  const s = await PlaySession.create(fixture([[-100, -100, 15, 100, 0, 17]]), {
    position: [0, -0.3, 0],
    cameraMode: "third-person",
  });
  const avatar = new BrickAvatar(await avatarGeometryFromDisk());
  try {
    s.stepTicks(3);
    const before = s.snapshot(),
      close = s.camera();
    expect(close.position[2]).toBeGreaterThan(0);
    expect(close.position[2]).toBeLessThan(15);
    expect(before.avatarVisible).toBe(false);
    avatar.update(before);
    let visible = 0;
    avatar.group.traverseVisible((o) => {
      if (o instanceof Mesh) visible++;
    });
    expect(visible).toBe(0);
    s.setInput({ yaw: Math.PI });
    const lengths: number[] = [];
    for (let tick = 0; tick < 90; tick++) {
      s.stepTicks(1);
      const c = s.camera();
      lengths.push(Math.hypot(...c.position.map((v, k) => v - c.target[k])));
    }
    expect(lengths[0]).toBeLessThan(40);
    for (let i = 1; i < lengths.length; i++)
      expect(lengths[i]).toBeGreaterThanOrEqual(lengths[i - 1] - 1e-8);
    expect(lengths.at(-1)).toBeGreaterThan(
      PLAY_CAMERA_DEFAULTS.followDistance - 1,
    );
    const after = s.snapshot();
    expect(after.avatarVisible).toBe(true);
    avatar.update(after);
    visible = 0;
    avatar.group.traverseVisible((o) => {
      if (o instanceof Mesh) visible++;
    });
    expect(visible).toBeGreaterThan(0);
    expect(after.position[0]).toBeCloseTo(before.position[0], 6);
    expect(after.position[2]).toBeCloseTo(before.position[2], 6);
    expect(after.sourceRevision).toBe(before.sourceRevision);
  } finally {
    avatar.dispose();
    s.dispose();
  }
});
