import { describe, expect, it } from "vitest";
import {
  AVATAR_MOTION,
  advanceMotion,
  angularJitter,
  bodyTarget,
  followHead,
  initialMotion,
  jitter,
  lerpMotion,
  limbAngles,
  smoothDampAngle,
  swingAngles,
  wrapAngle,
  type AvatarMotionEvidence,
  type AvatarMotionState,
} from "../../src/play/avatar-motion";
import { PlaySession } from "../../src/play/session";
import type { CollisionSnapshot } from "../../src/play/types";

const DT = 1 / 60;
const evidence = (
  patch: Partial<AvatarMotionEvidence> = {},
): AvatarMotionEvidence => ({
  dx: 0,
  dz: 0,
  vy: 0,
  grounded: true,
  flying: false,
  nearGround: false,
  lookYaw: 0,
  dt: DT,
  ...patch,
});
const run = (
  ticks: number,
  patch: Partial<AvatarMotionEvidence>,
  from: AvatarMotionState = initialMotion(),
) => {
  let s = from;
  for (let i = 0; i < ticks; i++) s = advanceMotion(s, evidence(patch));
  return s;
};

describe("Minecraft-style limb swing", () => {
  it("swings legs opposite each other and arms opposite their legs with a smaller amplitude", () => {
    for (const phase of [0, 0.7, 2, Math.PI, 5.5]) {
      const a = swingAngles(phase, 0.8);
      // Minecraft: leg = cos(limbSwing·0.6662)·1.4·amount (phase is that product).
      expect(a.rightHip).toBeCloseTo(Math.cos(phase) * 1.4 * 0.8, 12);
      expect(a.leftHip).toBeCloseTo(-a.rightHip, 12);
      expect(a.rightShoulder).toBeCloseTo(-a.rightHip / 1.4, 12);
      expect(a.leftShoulder).toBeCloseTo(-a.leftHip / 1.4, 12);
    }
    expect(swingAngles(1.2, 0)).toEqual({
      rightHip: 0,
      leftHip: -0,
      rightShoulder: -0,
      leftShoulder: 0,
    });
  });
  it("blends the swing amount toward speed each tick; running swings wider than walking", () => {
    const walk = run(90, { dz: -100 * DT }),
      sprint = run(90, { dz: -170 * DT });
    expect(walk.amount).toBeCloseTo(100 / AVATAR_MOTION.fullSwingSpeed, 3);
    expect(sprint.amount).toBeCloseTo(170 / AVATAR_MOTION.fullSwingSpeed, 3);
    // Gradual, not instant: the first tick moves only part of the way.
    const first = run(1, { dz: -100 * DT });
    expect(first.amount).toBeGreaterThan(0);
    expect(first.amount).toBeLessThan(0.1);
    // Phase advances by distance travelled (one stride = 2π).
    expect(run(39, { dz: -65 / 39 }).phase).toBeCloseTo(0, 6);
    // Stopping decays to neutral.
    const stopped = run(60, {}, sprint);
    expect(stopped.amount).toBeLessThan(0.001);
    const pose = limbAngles(stopped);
    expect(Math.abs(pose.leftHip)).toBeLessThan(0.002);
    expect(Math.abs(pose.rightHip)).toBeLessThan(0.002);
  });
  it("adds subtle idle arm sway that never moves the legs", () => {
    const samples = Array.from({ length: 300 }, (_, i) =>
      limbAngles({ ...initialMotion(), time: i / 60 }),
    );
    const arms = samples.map((p) => p.rightShoulder);
    expect(Math.max(...arms) - Math.min(...arms)).toBeGreaterThan(0.05);
    expect(Math.max(...arms.map(Math.abs))).toBeLessThanOrEqual(
      AVATAR_MOTION.idleSway + 1e-12,
    );
    expect(samples.every((p) => p.leftHip === 0 && p.rightHip === 0)).toBe(
      true,
    );
    expect(samples.every((p) => p.leftShoulder === -p.rightShoulder)).toBe(
      true,
    );
  });
  it("raises the arms when airborne (more when falling) and splits the legs", () => {
    const rising = run(20, { grounded: false, vy: -150 });
    const falling = run(40, { grounded: false, vy: 250 }, rising);
    const up = limbAngles(rising),
      down = limbAngles(falling);
    expect(rising.air).toBeGreaterThan(0.9);
    expect(up.leftShoulder).toBeGreaterThan(0.4);
    expect(down.leftShoulder).toBeGreaterThan(up.leftShoulder);
    expect(up.leftHip).toBeGreaterThan(up.rightHip);
    // A one- or two-tick ground loss (walking off a stud) does not flash the pose.
    expect(run(3, { grounded: false, vy: 20 }).air).toBe(0);
  });
  it("flies with trailing legs and no running stride unless skimming the ground", () => {
    const hover = run(120, { flying: true, dz: -160 * DT });
    const pose = limbAngles(hover);
    expect(hover.amount).toBeLessThan(0.001);
    expect(hover.fly).toBeGreaterThan(0.99);
    expect(pose.leftHip).toBeLessThan(-0.2);
    expect(pose.rightHip).toBeLessThan(-0.2);
    const skim = run(120, { flying: true, nearGround: true, dz: -160 * DT });
    expect(skim.amount).toBeGreaterThan(0.8);
    expect(skim.fly).toBeLessThan(0.01);
  });
});

describe("heading policy", () => {
  it("turns smoothly (critically damped, no overshoot) the short way round", () => {
    let value = 3,
      velocity = 0;
    const seen: number[] = [];
    for (let i = 0; i < 90; i++) {
      [value, velocity] = smoothDampAngle(value, -3, velocity, 0.1, DT);
      seen.push(value);
    }
    // 3 → -3 crosses ±π (0.28 rad), never the long way through 0.
    expect(seen.every((v) => Math.abs(v) > 2.9)).toBe(true);
    expect(wrapAngle(value + 3)).toBeCloseTo(0, 4);
    let a = 0,
      v = 0;
    const path = [];
    for (let i = 0; i < 120; i++) {
      [a, v] = smoothDampAngle(a, 1, v, 0.1, DT);
      path.push(a);
    }
    expect(Math.max(...path)).toBeLessThanOrEqual(1);
    expect(angularJitter(path)).toBeLessThan(0.03);
  });
  it("faces travel, walks backward facing forward, and turns the body with the head beyond 50 degrees", () => {
    expect(bodyTarget(0, 0, 1, -1, 100)).toBeCloseTo(Math.PI / 4, 12);
    // Backward (travel 180° from look): keep facing the look direction.
    expect(bodyTarget(0, 0, 0, 1, 100)).toBeCloseTo(0, 12);
    // Barely moving (contact creep) never turns the body.
    expect(bodyTarget(0.3, 0, 1, 0, 2)).toBe(0.3);
    expect(followHead(0, 0.5)).toEqual({ body: 0, clamped: false });
    const turned = followHead(0, 2);
    expect(turned.clamped).toBe(true);
    expect(wrapAngle(2 - turned.body)).toBeCloseTo(
      AVATAR_MOTION.headYawLimit,
      12,
    );
    // Strafing right: the body turns toward travel but the head keeps within 50°.
    const strafe = run(120, { dx: 100 * DT });
    expect(strafe.body).toBeCloseTo(AVATAR_MOTION.headYawLimit, 6);
  });
  it("interpolates tick states for rendering", () => {
    const a = run(10, { dz: -100 * DT });
    const b = advanceMotion(a, evidence({ dz: -100 * DT }));
    const mid = lerpMotion(a, b, 0.5);
    expect(mid.amount).toBeCloseTo((a.amount + b.amount) / 2, 12);
    expect(mid.time).toBeCloseTo((a.time + b.time) / 2, 12);
    expect(lerpMotion(a, b, 1).phase).toBeCloseTo(b.phase, 12);
    const wrap = lerpMotion({ ...a, body: 3.1 }, { ...b, body: -3.1 }, 0.5);
    expect(Math.abs(wrap.body)).toBeCloseTo(Math.PI, 6);
  });
});

/** A plate made of 20-LDU triangle pairs (many coplanar internal edges, as a
 * real brick floor has) with a wall of 20-LDU panels along z = -60. */
function plateWithWall(): CollisionSnapshot {
  const v: number[] = [],
    idx: number[] = [];
  const size = 800,
    cell = 20,
    n = size / cell;
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= n; j++)
      v.push(-size / 2 + i * cell, -8, -size / 2 + j * cell);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const a = i * (n + 1) + j,
        b = a + 1,
        c = a + n + 1,
        d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  for (let x = -400; x < 400; x += 20) {
    const q = v.length / 3;
    v.push(x, 0, -60, x + 20, 0, -60, x, -120, -60, x + 20, -120, -60);
    idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
  }
  return {
    revision: 1,
    vertices: new Float32Array(v),
    indices: new Uint32Array(idx),
    bounds: { min: [-400, -120, -400], max: [400, 0, 400] },
  };
}

/** A 32 × 32 stud plate: top at y = 0, 16-sided studs 4 LDU tall on a 20 LDU grid. */
function studPlate(): CollisionSnapshot {
  const v: number[] = [],
    idx: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => {
    const o = v.length / 3;
    v.push(...a, ...b, ...c, ...d);
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  quad([-320, 0, -320], [320, 0, -320], [320, 0, 320], [-320, 0, 320]);
  for (let x = -310; x < 320; x += 20)
    for (let z = -310; z < 320; z += 20) {
      const top = v.length / 3;
      v.push(x, -4, z);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2,
          b = ((i + 1) / 16) * Math.PI * 2;
        const p = [x + 6 * Math.cos(a), z + 6 * Math.sin(a)],
          q = [x + 6 * Math.cos(b), z + 6 * Math.sin(b)];
        quad(
          [p[0], 0, p[1]],
          [q[0], 0, q[1]],
          [q[0], -4, q[1]],
          [p[0], -4, p[1]],
        );
        const o = v.length / 3;
        v.push(p[0], -4, p[1], q[0], -4, q[1]);
        idx.push(top, o, o + 1);
      }
    }
  return {
    revision: 1,
    vertices: new Float32Array(v),
    indices: new Uint32Array(idx),
    bounds: { min: [-320, -4, -320], max: [320, 0, 320] },
  };
}
/** Four stairs toward -Z: 40 LDU treads with the given riser height. */
function stairs(riser: number): CollisionSnapshot {
  const vertices: number[] = [],
    indices: number[] = [];
  for (let k = 0; k < 4; k++) {
    const a = [-60, -riser * (k + 1), -40 * (k + 1) - 40],
      b = [60, 0, -40 * (k + 1)];
    const o = vertices.length / 3;
    for (const [x, y, z] of [
      [a[0], a[1], a[2]],
      [b[0], a[1], a[2]],
      [b[0], b[1], a[2]],
      [a[0], b[1], a[2]],
      [a[0], a[1], b[2]],
      [b[0], a[1], b[2]],
      [b[0], b[1], b[2]],
      [a[0], b[1], b[2]],
    ])
      vertices.push(x, y, z);
    indices.push(
      ...[
        0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2,
        0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5,
      ].map((i) => i + o),
    );
  }
  return {
    revision: 1,
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    bounds: { min: [-60, -4 * riser, -200], max: [60, 0, 0] },
  };
}
/** Horizontal (X, Z) components only. */
const ground = (a: number[][]) => a.map((p) => [p[0], p[2]]);
describe("diagonal walking jitter", () => {
  const walk = async (
    start: [number, number, number],
    ticks: number,
    run = false,
  ) => {
    const s = await PlaySession.create(plateWithWall(), {
      position: start,
      cameraMode: "third-person",
      ground: false,
    });
    try {
      s.stepTicks(5);
      s.setInput({ moveX: 1, moveZ: 1, run });
      const feet: number[][] = [],
        camera: number[][] = [],
        heading: number[] = [],
        speed: number[] = [];
      for (let t = 0; t < ticks; t++) {
        const before = s.snapshot().position;
        s.stepTicks(1);
        const r = s.snapshot();
        feet.push(r.position);
        camera.push(s.camera().position);
        heading.push(r.avatar.heading);
        speed.push(
          Math.hypot(r.position[0] - before[0], r.position[2] - before[2]),
        );
      }
      return { feet, camera, heading, speed, report: s.snapshot() };
    } finally {
      s.dispose();
    }
  };
  it("moves at a steady speed across triangle edges with a smooth camera and heading", async () => {
    for (const running of [false, true]) {
      const { feet, camera, heading, speed } = await walk(
        [300, -8.2, 300],
        150,
        running,
      );
      const steady = (a: number[][]) => a.slice(30);
      // Before the fix a one-tick stall on an internal edge scored ~1.6 LDU.
      expect(jitter(ground(steady(feet)))).toBeLessThan(0.02);
      expect(jitter(ground(steady(camera)))).toBeLessThan(0.02);
      // Snap-to-ground may correct height by a tenth of an LDU at an edge.
      expect(jitter(steady(feet))).toBeLessThan(0.25);
      expect(jitter(steady(camera))).toBeLessThan(0.25);
      const expected = ((running ? 170 : 100) * DT) / 1;
      expect(Math.min(...speed.slice(30))).toBeGreaterThan(expected * 0.97);
      expect(angularJitter(heading)).toBeLessThan(0.03);
      expect(angularJitter(heading.slice(40))).toBeLessThan(1e-3);
    }
  });
  it("slides along a wall without stalls or a flickering heading", async () => {
    const { feet, heading, speed } = await walk([300, -8.2, -40], 200);
    // Skip the approach and the single contact (a real change of direction).
    const sliding = speed.findIndex((v, i) => i > 0 && v < speed[0] * 0.8);
    expect(sliding).toBeGreaterThan(0);
    const after = sliding + 3;
    // Before the fix the slide stalled for whole ticks every few steps
    // (jitter ~1.1 LDU, 10 stalls). A panel seam may still catch one tick
    // partially.
    const slide = speed.slice(after);
    expect(slide.filter((v) => v < 1.18 * 0.9).length).toBeLessThanOrEqual(2);
    expect(Math.min(...slide)).toBeGreaterThan(0.6);
    expect(jitter(ground(feet.slice(after)))).toBeLessThan(0.5);
    expect(jitter(feet.slice(after))).toBeLessThan(0.5);
    // Before the fix the heading snapped by up to 0.74 rad per tick here.
    expect(angularJitter(heading)).toBeLessThan(0.08);
    expect(angularJitter(heading.slice(after + 30))).toBeLessThan(1e-3);
  });
  it("glides over studs: the view and figure do not bob with the capsule's contact corrections", async () => {
    for (const [moveX, moveZ] of [
      [1, 1],
      [0, 1],
      [0.4, 1],
    ]) {
      const s = await PlaySession.create(studPlate(), {
        position: [150, -20, 150],
        cameraMode: "third-person",
        ground: false,
      });
      try {
        s.stepTicks(30);
        s.setInput({ moveX, moveZ });
        s.stepTicks(20);
        const exact: number[] = [],
          shown: number[][] = [],
          camera: number[][] = [];
        for (let t = 0; t < 120; t++) {
          s.stepTicks(1);
          exact.push(s.snapshot().position[1]);
          shown.push(s.presentation().position);
          camera.push(s.camera().position);
        }
        const range = (a: number[]) => Math.max(...a) - Math.min(...a);
        const heights = shown.map((p) => p[1]);
        // The collider itself rides stud tops and dips between them...
        if (moveX === 1) expect(range(exact)).toBeGreaterThan(2);
        // ...but what is drawn moves smoothly.
        expect(range(heights)).toBeLessThan(Math.max(1.2, range(exact) / 3));
        const raw = jitter(exact.map((y) => [y]));
        if (moveX === 1) expect(raw).toBeGreaterThan(1);
        expect(jitter(heights.map((y) => [y]))).toBeLessThan(
          Math.max(0.1, Math.min(0.35, raw / 4)),
        );
        expect(jitter(camera.map((p) => [p[1]]))).toBeLessThan(0.35);
        // The figure never drifts more than half a step from its collider.
        expect(
          Math.max(...heights.map((y, i) => Math.abs(y - exact[i]))),
        ).toBeLessThanOrEqual(4 + 1e-9);
      } finally {
        s.dispose();
      }
    }
  });
  it("walks up plate- and brick-high stairs with a smoothly rising camera; taller risers need a jump", async () => {
    for (const riser of [8, 24, 32]) {
      const s = await PlaySession.create(stairs(riser), {
        position: [0, -0.3, 60],
        cameraMode: "third-person",
      });
      try {
        s.stepTicks(3);
        s.setInput({ moveZ: 1 });
        const camera: number[][] = [];
        let top = 0;
        for (let t = 0; t < 170; t++) {
          s.stepTicks(1);
          // The follow target (the arm may shorten legitimately near the steps).
          camera.push(s.camera().target);
          top = Math.min(top, s.snapshot().position[1]);
        }
        if (riser === 32) {
          // Blocked at the first riser: one brick plus a plate is a jump.
          expect(top).toBeGreaterThan(-1);
          expect(s.snapshot().position[2]).toBeGreaterThan(-33);
          s.setInput({ moveZ: 1, jump: true });
          s.stepTicks(40);
          expect(s.snapshot().position[1]).toBeLessThan(-31);
          continue;
        }
        // All four steps climbed without jumping.
        expect(top).toBeLessThan(-4 * riser + 1);
        // The camera rises smoothly: no per-frame jump larger than a
        // fraction of a step, and no sudden acceleration.
        const rise = camera
          .slice(1)
          .map((p, i) => Math.abs(p[1] - camera[i][1]));
        expect(Math.max(...rise)).toBeLessThan(riser === 24 ? 6 : 3);
        expect(jitter(camera.map((p) => [p[1]]))).toBeLessThan(
          riser === 24 ? 1.5 : 0.8,
        );
      } finally {
        s.dispose();
      }
    }
  });
  it("moves the figure and camera together between fixed ticks at uneven frame rates", async () => {
    const s = await PlaySession.create(plateWithWall(), {
      position: [300, -8.2, 300],
      cameraMode: "third-person",
      ground: false,
    });
    try {
      s.stepTicks(5);
      s.setInput({ moveX: 1, moveZ: 1 });
      s.stepTicks(40);
      // Uneven frames: 0, 1 or 2 ticks per frame, as rAF timing varies.
      const frames = [11, 23, 16, 9, 27, 16, 14, 19, 31, 7];
      const offsets: number[][] = [],
        figure: number[][] = [],
        times: number[] = [];
      let time = 0;
      for (let i = 0; i < 120; i++) {
        const dt = frames[i % frames.length] / 1000;
        s.advance(dt);
        time += dt;
        const camera = s.camera(true).position,
          view = s.presentation(true);
        offsets.push(view.position.map((v, k) => v - camera[k]));
        figure.push(view.position);
        times.push(time);
      }
      // The figure stays fixed relative to the chase camera (no judder).
      expect(jitter(offsets)).toBeLessThan(0.01);
      // And its path is linear in wall time, within less than one tick of travel.
      const velocity = figure
        .at(-1)!
        .map((v, k) => (v - figure[0][k]) / (times.at(-1)! - times[0]));
      const residual = Math.max(
        ...figure.map((p, i) =>
          Math.hypot(
            ...p.map(
              (v, k) => v - figure[0][k] - velocity[k] * (times[i] - times[0]),
            ),
          ),
        ),
      );
      expect(residual).toBeLessThan(0.4);
      // Without interpolation the figure snapped whole ticks (1.67 LDU).
      const snapped = s.presentation(false).position,
        smooth = s.presentation(true).position;
      expect(
        Math.hypot(...snapped.map((v, k) => v - smooth[k])),
      ).toBeLessThanOrEqual(1.7);
    } finally {
      s.dispose();
    }
  });
});
