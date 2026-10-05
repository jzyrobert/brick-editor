import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, expect, it } from "vitest";
import { PivotCylinderSketch, WinchSketch } from "../helpers/systems-sketch";

// SYNTHETIC cost/behaviour sketches for
// docs/reviews/EFFICIENT-VEHICLE-AND-SYSTEMS-PHYSICS.md. No source geometry or
// evidence: these do not admit a winch or a mounted cylinder to Play.
beforeAll(() => RAPIER.init());

it("winds a load in, holds it on a one-way ratchet and lets it back-drive when released", () => {
  const winch = new WinchSketch({ loadKg: 5, ropeLdu: 200 });
  for (let i = 0; i < 60; i++) winch.step();
  const rest = winch.loadHeightLdu();
  expect(rest).toBeCloseTo(-200, -1);
  winch.input = 1;
  for (let i = 0; i < 120; i++) winch.step();
  const wound = winch.loadHeightLdu();
  // Two seconds at 2 rad/s on an 8 LDU drum: about 32 LDU of rope.
  expect(wound - rest).toBeGreaterThan(10);
  expect(winch.angle).toBeGreaterThan(1);
  winch.input = 0;
  for (let i = 0; i < 120; i++) winch.step();
  expect(Math.abs(winch.loadHeightLdu() - wound)).toBeLessThan(5);
  winch.ratchet = false;
  for (let i = 0; i < 60; i++) winch.step();
  expect(winch.loadHeightLdu()).toBeLessThan(wound - 20);
  expect(winch.angle).toBeLessThan(1);
});

it("lifts a pinned arm with a pivoting cylinder loop and keeps the loop closed", () => {
  const sketch = new PivotCylinderSketch();
  for (let i = 0; i < 60; i++) sketch.step();
  const slumped = sketch.armAngleDegrees();
  expect(sketch.closureErrorLdu()).toBeLessThan(0.5);
  sketch.force = 4000;
  for (let i = 0; i < 180; i++) sketch.step();
  const lifted = sketch.armAngleDegrees();
  expect(slumped - lifted).toBeGreaterThan(10);
  expect(sketch.closureErrorLdu()).toBeLessThan(1);
  sketch.force = 0;
  for (let i = 0; i < 600; i++) sketch.step();
  expect(sketch.armAngleDegrees()).toBeGreaterThan(lifted + 10);
  expect(sketch.closureErrorLdu()).toBeLessThan(0.5);
});
