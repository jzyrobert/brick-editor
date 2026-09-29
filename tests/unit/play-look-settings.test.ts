import { describe, expect, it } from "vitest";
import {
  MOUSE_RADIANS_PER_COUNT,
  PLAY_LOOK_DEFAULTS,
  mouseLookRate,
  validatePlayLook,
} from "../../src/play/look-settings";
import { PlaySession } from "../../src/play/session";

describe("desktop mouse look settings", () => {
  it("validates sensitivity and invert-Y with safe defaults", () => {
    expect(validatePlayLook({})).toEqual(PLAY_LOOK_DEFAULTS);
    expect(validatePlayLook({ sensitivity: 2.5, invertY: true })).toEqual({
      sensitivity: 2.5,
      invertY: true,
    });
    for (const bad of [
      { sensitivity: 0 },
      { sensitivity: 9 },
      { sensitivity: Number.NaN },
      { invertY: "yes" },
      { speed: 1 },
      [],
    ])
      expect(() => validatePlayLook(bad)).toThrow();
    expect(mouseLookRate({ sensitivity: 2, invertY: false })).toBeCloseTo(
      2 * MOUSE_RADIANS_PER_COUNT,
      12,
    );
  });
});

describe("collision-unavailable explanations", () => {
  it("says why walking is refused instead of a generic message", async () => {
    const reason =
      "2 part types are missing (a.dat, b.dat), so the world may have gaps and walking is off.";
    const s = await PlaySession.create({
      revision: 1,
      vertices: new Float32Array(),
      indices: new Uint32Array(),
      bounds: { min: [-100, 0, -100], max: [100, 0, 100] },
      unsupported: true,
      warnings: [reason],
    });
    try {
      const report = s.snapshot();
      expect(report.collisionReady).toBe(false);
      expect(report.locomotion).toBe("fly-noclip");
      expect(() => s.setLocomotion("walk")).toThrow(
        "Walking is off for this world, so you stay in Fly. " + reason,
      );
      expect(() =>
        s.chooseSpawn({ position: [0, -0.3, 0], yaw: 0, pitch: 0 }),
      ).toThrow("a.dat, b.dat");
    } finally {
      s.dispose();
    }
  });
});
