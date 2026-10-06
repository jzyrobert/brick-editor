import { describe, expect, it } from "vitest";
import { PlaySession } from "../../src/play/session";
import {
  CHARACTER_PROFILE,
  type CharacterProfile,
  type CollisionSnapshot,
  type PlaySnapshotReport,
} from "../../src/play/types";
import {
  PLAYER_SCALE_PRESETS,
  PLAYER_SCALE_STEPS,
  nearestPlayerScaleStep,
  playerScaleLabel,
  scaledCharacterProfile,
  suggestPlayerScale,
  validatePlayerScale,
} from "../../src/play/player-scale";
import { playCameraSafety } from "../../src/play/camera-settings";
import { PLAY_CAMERA_DEFAULTS } from "../../src/play/types";
import {
  nearbyTrain,
  promptVisible,
  type PlayInteraction,
} from "../../src/play/interaction";

const empty: CollisionSnapshot = {
  revision: 3,
  vertices: new Float32Array(),
  indices: new Uint32Array(),
  bounds: { min: [-100, 0, -100], max: [100, 0, 100] },
};
type Box = [[number, number, number], [number, number, number]];
function boxes(list: Box[]): CollisionSnapshot {
  const vertices: number[] = [],
    indices: number[] = [];
  for (const [a, b] of list) {
    const o = vertices.length / 3;
    vertices.push(
      ...[a[0], a[1], a[2], b[0], a[1], a[2], b[0], b[1], a[2], a[0], b[1]],
      ...[a[2], a[0], a[1], b[2], b[0], a[1], b[2], b[0], b[1], b[2]],
      ...[a[0], b[1], b[2]],
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

describe("player size maths", () => {
  it("scales every length, speed and the explorer's gravity linearly", () => {
    const P = CHARACTER_PROFILE;
    for (const scale of PLAYER_SCALE_STEPS) {
      const Q = scaledCharacterProfile(scale);
      for (const key of [
        "radius",
        "height",
        "eyeHeight",
        "stepHeight",
        "walkSpeed",
        "runSpeed",
        "flySpeed",
        "jumpSpeed",
        "gravity",
        "strideLength",
      ] as const)
        expect(Q[key]).toBeCloseTo(P[key] * scale, 9);
      // Unchanged: slopes and the world's LDU-to-metre scale.
      expect(Q.maxSlopeDegrees).toBe(P.maxSlopeDegrees);
      expect(Q.scaleMetresPerLdu).toBe(P.scaleMetresPerLdu);
      // Proportions hold: the eye stays at the same fraction of the body,
      // and a jump rises the same fraction of the figure in the same time.
      expect(Q.eyeHeight / Q.height).toBeCloseTo(P.eyeHeight / P.height, 9);
      const apex = (p: CharacterProfile) =>
        (p.jumpSpeed * p.jumpSpeed) / 2 / p.gravity;
      expect(apex(Q) / Q.height).toBeCloseTo(apex(P) / P.height, 9);
      expect(Q.jumpSpeed / Q.gravity).toBeCloseTo(P.jumpSpeed / P.gravity, 9);
      // Strides per second are unchanged (same gait rhythm).
      expect(Q.walkSpeed / Q.strideLength).toBeCloseTo(
        P.walkSpeed / P.strideLength,
        9,
      );
    }
    expect(scaledCharacterProfile(1)).toBe(P);
  });
  it("validates the range and names the presets", () => {
    for (const bad of [0, 0.2, 8.5, NaN, Infinity, "2", null])
      expect(() => validatePlayerScale(bad)).toThrow(/Player size/);
    expect(validatePlayerScale()).toBe(1);
    expect(PLAYER_SCALE_PRESETS.map((p) => p.label)).toEqual([
      "Tiny",
      "Minifigure",
      "Big",
      "Giant",
    ]);
    expect(playerScaleLabel(8)).toBe("Giant");
    expect(playerScaleLabel(1.5)).toBe("1.5×");
    expect(playerScaleLabel(0.5)).toBe("½×");
    expect(PLAYER_SCALE_STEPS[nearestPlayerScaleStep(2.2)]).toBe(2);
    expect(PLAYER_SCALE_STEPS[nearestPlayerScaleStep(0.3)]).toBe(0.25);
  });
  it("scales the camera's near plane and clearance with the explorer", () => {
    const one = playCameraSafety(PLAY_CAMERA_DEFAULTS, 1.5),
      tiny = playCameraSafety(PLAY_CAMERA_DEFAULTS, 1.5, 0.25),
      giant = playCameraSafety(PLAY_CAMERA_DEFAULTS, 1.5, 8);
    expect(tiny.effectiveNear).toBeCloseTo(one.effectiveNear * 0.25, 9);
    expect(giant.effectiveNear).toBeCloseTo(one.effectiveNear * 8, 9);
    expect(giant.collisionRadius).toBeCloseTo(one.collisionRadius * 8, 9);
  });
});

describe("player size suggestion", () => {
  const box = (
    w: number,
    h: number,
    d: number,
  ): { min: [number, number, number]; max: [number, number, number] } => ({
    min: [0, -h, 0],
    max: [w, 0, d],
  });
  it("keeps minifigure size when doors or figures are present", () => {
    expect(
      suggestPlayerScale({
        parts: 400,
        doors: 2,
        minifigParts: 0,
        bounds: box(2000, 120, 2000),
      }),
    ).toMatchObject({ scale: 1, reason: expect.stringMatching(/doors/) });
    expect(
      suggestPlayerScale({
        parts: 40,
        doors: 0,
        minifigParts: 4,
        bounds: box(3000, 9000, 3000),
      })?.scale,
    ).toBe(1);
  });
  it("suggests Tiny for a low, wide micro-scale town", () => {
    const s = suggestPlayerScale({
      parts: 900,
      doors: 0,
      minifigParts: 0,
      bounds: box(1600, 150, 1200),
    });
    expect(s?.scale).toBe(0.25);
    expect(s?.reason).toMatch(/micro-scale/);
  });
  it("suggests a bigger explorer for a tall sculpture without doors", () => {
    expect(
      suggestPlayerScale({
        parts: 3000,
        doors: 0,
        minifigParts: 0,
        bounds: box(1200, 3400, 1200),
      })?.scale,
    ).toBe(4);
    expect(
      suggestPlayerScale({
        parts: 3000,
        doors: 0,
        minifigParts: 0,
        bounds: box(1200, 20000, 1200),
      })?.scale,
    ).toBe(8);
  });
  it("says nothing for ordinary or small models", () => {
    // A minifigure-scale car, a house without doors, an empty project.
    for (const bounds of [
      box(80, 100, 200),
      box(600, 700, 600),
      box(2000, 20, 2000),
    ])
      expect(
        suggestPlayerScale({ parts: 50, doors: 0, minifigParts: 0, bounds }),
      ).toBeUndefined();
    expect(
      suggestPlayerScale({ parts: 0, doors: 0, minifigParts: 0 }),
    ).toBeUndefined();
  });
});

describe("a scaled explorer in a session", () => {
  const create = (playerScale: number, world = empty) =>
    PlaySession.create(world, { position: [0, -0.3, 0], playerScale });

  it("walks, jumps and sees at its own size", async () => {
    for (const scale of [0.25, 1, 4]) {
      const s = await create(scale);
      s.stepTicks(3);
      const report = s.snapshot();
      expect(report.playerScale).toBe(scale);
      expect(report.profile.height).toBeCloseTo(104 * scale, 9);
      // First person: the eye sits at the scaled eye height.
      const eye = s.camera();
      expect(report.position[1] - eye.position[1]).toBeCloseTo(86 * scale, 0);
      expect(eye.near).toBeCloseTo(
        playCameraSafety(report.cameraSettings, 1, scale).effectiveNear,
        9,
      );
      // One second of walking covers the scaled walking speed.
      s.setInput({ moveZ: 1 });
      s.stepTicks(60);
      expect(Math.abs(s.snapshot().position[2])).toBeCloseTo(
        CHARACTER_PROFILE.walkSpeed * scale,
        0,
      );
      // The jump apex is the same fraction of the figure's height.
      s.setInput({});
      s.stepTicks(5);
      s.setInput({ jump: true });
      let apex = 0;
      for (let i = 0; i < 90; i++) {
        s.stepTicks(1);
        apex = Math.max(apex, -s.snapshot().position[1]);
      }
      expect(apex / (104 * scale)).toBeGreaterThan(0.45);
      expect(apex / (104 * scale)).toBeLessThan(0.6);
      expect(s.snapshot().grounded).toBe(true);
      s.dispose();
    }
  });
  it("lets a tiny explorer through a low tunnel a minifigure cannot enter", async () => {
    // A 40 LDU-high slot in a wall: too low for a minifigure (104), roomy
    // for a quarter-size explorer (26).
    const wall = boxes([
      [
        [-200, -300, -62],
        [-20, 0, -60],
      ],
      [
        [20, -300, -62],
        [200, 0, -60],
      ],
      [
        [-20, -300, -62],
        [20, -40, -60],
      ],
    ]);
    const tiny = await create(0.25, wall),
      minifig = await create(1, wall);
    for (const s of [tiny, minifig]) {
      s.stepTicks(3);
      s.setInput({ moveZ: 1 });
      s.stepTicks(240);
    }
    expect(tiny.snapshot().position[2]).toBeLessThan(-80);
    expect(minifig.snapshot().position[2]).toBeGreaterThan(-60);
    tiny.dispose();
    minifig.dispose();
  });
  it("lets a big explorer step over a wall that stops a minifigure", async () => {
    // A two-brick (48 LDU) wall: a minifigure steps one brick (24 LDU),
    // a 3× explorer steps three bricks (72 LDU).
    const wall = boxes([
      [
        [-300, -48, -100],
        [300, 0, -80],
      ],
    ]);
    const big = await create(3, wall),
      minifig = await create(1, wall);
    for (const s of [big, minifig]) {
      s.stepTicks(3);
      s.setInput({ moveZ: 1 });
      s.stepTicks(90);
    }
    expect(big.snapshot().position[2]).toBeLessThan(-120);
    expect(minifig.snapshot().position[2]).toBeGreaterThan(-80);
    big.dispose();
    minifig.dispose();
  });
  it("changes size live, refusing to grow where it does not fit", async () => {
    // A 150 LDU-high room: a minifigure fits, a 2× explorer (208) does not.
    const room = boxes([
      [
        [-400, -152, -400],
        [400, -150, 400],
      ],
    ]);
    const s = await create(1, room);
    s.stepTicks(3);
    expect(() => s.setPlayerScale(2)).toThrow(/room to grow/);
    expect(s.snapshot().playerScale).toBe(1);
    expect(s.snapshot().profile.height).toBe(104);
    const shrunk = s.setPlayerScale(0.5);
    expect(shrunk.profile.radius).toBe(6);
    s.setInput({ moveZ: 1 });
    s.stepTicks(30);
    expect(s.snapshot().grounded).toBe(true);
    expect(() => s.setPlayerScale(0.1)).toThrow(/Player size/);
    s.dispose();
    // In the open, growing works and the third-person camera backs off.
    const open = await PlaySession.create(empty, {
      position: [0, -0.3, 0],
      cameraMode: "third-person",
    });
    open.stepTicks(3);
    const near = open.camera();
    open.setPlayerScale(4);
    open.stepTicks(2);
    const far = open.camera();
    const dist = (c: typeof near) =>
      Math.hypot(...c.position.map((v, k) => v - c.target[k]));
    expect(dist(far) / dist(near)).toBeCloseTo(4, 1);
    expect(open.snapshot().avatarVisible).toBe(true);
    open.dispose();
  });
  it("refuses unknown sizes on entry", async () => {
    await expect(
      PlaySession.create(empty, { playerScale: 20 }),
    ).rejects.toThrow(/Player size/);
  });
});

describe("reach at other sizes", () => {
  const report = (playerScale: number, distance: number) =>
    ({
      position: [0, 0, distance],
      profile: scaledCharacterProfile(playerScale),
      playerScale,
      trains: {
        trains: [
          {
            id: "t",
            name: "Train",
            position: [0, -52 * playerScale, 0],
            heading: [1, 0, 0],
          },
        ],
        switches: [],
      },
    }) as unknown as PlaySnapshotReport;
  it("asks for minifigure size to drive a train, and scales prompt reach", () => {
    const tiny = nearbyTrain(report(0.25, 30)) as PlayInteraction;
    expect(tiny.available).toBe(false);
    expect(tiny.blockedReason).toMatch(/Minifigure/);
    expect(nearbyTrain(report(1, 100))?.available).toBe(true);
    const blocked = { ...tiny, distance: 300 };
    expect(promptVisible(blocked, 1)).toBe(false);
    expect(promptVisible(blocked, 2)).toBe(true);
  });
});
