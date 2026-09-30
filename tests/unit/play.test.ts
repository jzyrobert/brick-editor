import { describe, expect, it } from "vitest";
import { PlaySession } from "../../src/play/session";
import {
  CHARACTER_PROFILE,
  type CollisionSnapshot,
} from "../../src/play/types";
const empty: CollisionSnapshot = {
  revision: 12,
  vertices: new Float32Array(),
  indices: new Uint32Array(),
  bounds: { min: [-100, 0, -100], max: [100, 0, 100] },
};
const create = (position: [number, number, number] = [0, -0.3, 0]) =>
  PlaySession.create(empty, { position });
describe("isolated fixed-tick play", () => {
  it("walks camera-relative, normalizes diagonals, and repeats exact ticks", async () => {
    const a = await create(),
      b = await create(),
      c = await create();
    a.stepTicks(2);
    b.stepTicks(2);
    c.stepTicks(2);
    a.setInput({ moveZ: 1 });
    b.setInput({ moveZ: 1 });
    c.setInput({ moveZ: 1, moveX: 1 });
    a.stepTicks(60);
    b.stepTicks(60);
    c.stepTicks(60);
    expect(a.snapshot()).toEqual(b.snapshot());
    expect(a.snapshot().grounded).toBe(true);
    // One second at walking speed, straight or diagonal.
    const walked = CHARACTER_PROFILE.walkSpeed;
    expect(Math.abs(a.snapshot().position[2])).toBeCloseTo(walked, 0);
    expect(
      Math.hypot(c.snapshot().position[0], c.snapshot().position[2]),
    ).toBeCloseTo(walked, 0);
    expect(a.snapshot().sourceRevision).toBe(12);
    a.dispose();
    b.dispose();
    c.dispose();
  });
  it("jumps once per press, lands, and caps catch-up debt", async () => {
    const s = await create();
    s.stepTicks(3);
    s.setInput({ jump: true });
    s.stepTicks(10);
    expect(s.snapshot().position[1]).toBeLessThan(-10);
    s.stepTicks(100);
    expect(s.snapshot().grounded).toBe(true);
    expect(s.snapshot().position[1]).toBeGreaterThan(-1);
    const t = s.snapshot().tick;
    s.advance(1000);
    expect(s.snapshot().tick - t).toBeLessThanOrEqual(6);
    s.dispose();
  });
  it("fly bypasses collision and walk recovers safely, cameras do not teleport actor", async () => {
    const s = await create();
    const p = s.snapshot().position;
    s.setCameraMode("third-person");
    s.camera();
    expect(s.snapshot().position).toEqual(p);
    s.teleport({ position: [0, 20, 0], policy: "free-flight" });
    expect(s.snapshot().locomotion).toBe("fly-noclip");
    s.setLocomotion("walk");
    expect(s.snapshot().position[1]).toBeLessThan(0);
    expect(() => s.teleport({ position: [0, 5, 0] })).toThrow();
    s.dispose();
    expect(() => s.stepTicks(1)).toThrow();
  });
  it("unsupported collision falls back to flight and rejects unsafe mode transitions", async () => {
    const s = await PlaySession.create({ ...empty, unsupported: true });
    expect(s.snapshot().locomotion).toBe("fly-noclip");
    expect(() => s.setLocomotion("walk")).toThrow();
    expect(() => s.setInput({ moveZ: 2 })).toThrow();
    expect(() => s.stepTicks(999999)).toThrow();
    s.dispose();
  });
});
function boxes(
  bounds: Array<[[number, number, number], [number, number, number]]>,
): CollisionSnapshot {
  const vertices: number[] = [],
    indices: number[] = [];
  for (const [a, b] of bounds) {
    const o = vertices.length / 3;
    vertices.push(
      a[0],
      a[1],
      a[2],
      b[0],
      a[1],
      a[2],
      b[0],
      b[1],
      a[2],
      a[0],
      b[1],
      a[2],
      a[0],
      a[1],
      b[2],
      b[0],
      a[1],
      b[2],
      b[0],
      b[1],
      b[2],
      a[0],
      b[1],
      b[2],
    );
    indices.push(
      ...[
        0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2,
        0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5,
      ].map((i) => i + o),
    );
  }
  return {
    ...empty,
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
  };
}
describe("default spawn", () => {
  it("stands in front of a build taller than 2,000 LDU, walking", async () => {
    // A 2,500 LDU tower (the cathedral's spires reach 2,008): the spawn
    // search starts over its top and must still reach the ground.
    const s = await PlaySession.create({
      ...boxes([
        [
          [-100, -2500, -100],
          [100, 0, 100],
        ],
      ]),
      bounds: { min: [-100, -2500, -100], max: [100, 0, 100] },
    });
    const snap = s.snapshot();
    expect(snap.locomotion).toBe("walk");
    expect(snap.position[2]).toBeLessThan(-100);
    expect(Math.abs(snap.position[1])).toBeLessThan(1);
    s.dispose();
  });
});
describe("static triangle world collisions", () => {
  it("sweeps thin walls at run speed and slides parallel without tunnelling", async () => {
    const s = await PlaySession.create(
      boxes([
        [
          [-200, -120, -42],
          [200, 0, -40],
        ],
      ]),
      { position: [0, -0.3, 0] },
    );
    s.stepTicks(3);
    s.setInput({ moveZ: 1, moveX: 0.3, run: true });
    s.stepTicks(120);
    expect(s.snapshot().position[2]).toBeGreaterThan(-33);
    // At yaw zero, camera-right is negative LDraw X.
    expect(s.snapshot().position[0]).toBeLessThan(-20);
    s.dispose();
  });
  it("stops upward jumps at a ceiling and keeps door openings traversable", async () => {
    const s = await PlaySession.create(
      boxes([
        [
          [-100, -122, -100],
          [100, -120, 100],
        ],
        [
          [-100, -120, -42],
          [-20, 0, -40],
        ],
        [
          [20, -120, -42],
          [100, 0, -40],
        ],
      ]),
      { position: [0, -0.3, 0] },
    );
    s.stepTicks(3);
    s.setInput({ jump: true });
    s.stepTicks(10);
    expect(s.snapshot().position[1]).toBeGreaterThan(-19);
    s.stepTicks(80);
    s.setInput({ moveZ: 1 });
    s.stepTicks(60);
    expect(s.snapshot().position[2]).toBeLessThan(-90);
    s.dispose();
  });
  it("climbs a plate-height step and shortens camera arm using a swept volume", async () => {
    const s = await PlaySession.create(
      boxes([
        [
          [-100, -8, -200],
          [100, 0, -30],
        ],
        [
          [-100, -100, 30],
          [100, 0, 32],
        ],
      ]),
      { position: [0, -0.3, 0], cameraMode: "third-person" },
    );
    s.stepTicks(3);
    const p = s.camera().position;
    expect(p[2]).toBeLessThan(27);
    expect(p[2]).toBeGreaterThan(0);
    const before = s.snapshot();
    s.camera();
    s.camera();
    expect(s.snapshot()).toEqual(before);
    s.setInput({ moveZ: 1 });
    s.stepTicks(60);
    expect(s.snapshot().position[1]).toBeLessThan(-7);
    expect(s.snapshot().position[2]).toBeLessThan(-90);
    s.dispose();
  });
});
describe("slope policy and validation", () => {
  it("climbs a shallow ramp but cannot climb a steep surface", async () => {
    const ramp = (rise: number): CollisionSnapshot => ({
      ...empty,
      vertices: new Float32Array([
        -100,
        0,
        -25,
        100,
        0,
        -25,
        -100,
        -rise,
        -125,
        100,
        -rise,
        -125,
      ]),
      indices: new Uint32Array([0, 1, 2, 2, 1, 3]),
    });
    const low = await PlaySession.create(ramp(40), { position: [0, -0.3, 0] }),
      high = await PlaySession.create(ramp(180), { position: [0, -0.3, 0] });
    low.stepTicks(3);
    high.stepTicks(3);
    low.setInput({ moveZ: 1 });
    high.setInput({ moveZ: 1 });
    low.stepTicks(55);
    high.stepTicks(55);
    expect(low.snapshot().position[1]).toBeLessThan(-15);
    expect(high.snapshot().position[2]).toBeGreaterThan(-40);
    low.dispose();
    high.dispose();
  });
  it("rejects unknown fields and malformed collision geometry before initialization", async () => {
    await expect(
      PlaySession.create(empty, { unsafe: true } as never),
    ).rejects.toThrow();
    await expect(
      PlaySession.create({
        ...empty,
        vertices: new Float32Array([0, 1, 2]),
        indices: new Uint32Array([0, 1, 2]),
      }),
    ).rejects.toThrow();
  });
});
it("uses a true session ground plane with accurate capsule clearance away from the origin", async () => {
  const s = await create();
  for (const [x, z] of [
    [0, 125],
    [1000, -2000],
    [-5000, 6000],
  ]) {
    expect(() => s.teleport({ position: [x, -0.3, z] })).not.toThrow();
    s.stepTicks(3);
    expect(s.snapshot().grounded).toBe(true);
    expect(s.snapshot().position[1]).toBeLessThan(0);
  }
  expect(() => s.teleport({ position: [0, 2, 125] })).toThrow();
  s.dispose();
});
