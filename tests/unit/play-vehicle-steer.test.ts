import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, expect, it } from "vitest";
import {
  PlayVehicleWorld,
  continuousPoses,
  drivingSubsteps,
} from "../../src/play/vehicle-world";
import type { DrivingBox } from "../../src/play/vehicle-collision";
import { openBenchFixture } from "../../src/mechanisms/fixtures";
import { movingSource } from "../helpers/play-moving-source";
import { PlaySession } from "../../src/play/session";

beforeAll(async () => {
  await RAPIER.init();
});

it("sweeps turns through ±180° as the short rotation and splits fast turns into substeps", () => {
  const [from, to] = continuousPoses(
    { x: 0, y: 0, z: 0, yaw: Math.PI - 0.01 },
    { x: 0.1, y: 0, z: 0, yaw: -Math.PI + 0.01 },
  );
  expect(to.yaw - from.yaw).toBeCloseTo(0.02, 12);
  // Unbounded headings (many laps) reduce to one turn.
  const [lap] = continuousPoses(
    { x: 0, y: 0, z: 0, yaw: 40 * Math.PI + 0.3 },
    { x: 0, y: 0, z: 0, yaw: 40 * Math.PI + 0.3 },
  );
  expect(lap.yaw).toBeCloseTo(0.3, 9);
  const car: DrivingBox[] = [{ center: [0, 0.2, 0], halfExtents: [1, 0.2, 2] }];
  expect(drivingSubsteps(car, 0.01)).toBe(1);
  // 1 rad at a 2.24 m radius needs 448 segments of 5 mm: four queries.
  expect(drivingSubsteps(car, 1)).toBe(4);
});

it("a body move over too much nearby geometry holds for the tick instead of failing with a budget error", () => {
  const vertices: number[] = [],
    indices: number[] = [];
  for (let i = 0; i < 5000; i++) {
    const base = vertices.length / 3;
    vertices.push(0.24, 0.05, 0.24, 0.25, 0.05, 0.24, 0.24, 0.15, 0.25);
    indices.push(base, base + 1, base + 2);
  }
  const world = new PlayVehicleWorld(
    [],
    {
      sourceId: "dense",
      units: "metres",
      up: "+Y",
      owner: { kind: "static" },
      vertices: new Float32Array(vertices),
      indices: new Uint32Array(indices),
    },
    false,
    () => [],
  );
  const box: DrivingBox[] = [
    { center: [0, 0.1, 0], halfExtents: [0.2, 0.1, 0.2] },
  ];
  const pose = { x: 0, y: 0, z: 0, yaw: 0 };
  expect(world.sweepBody(box, pose, { ...pose, z: 0.01 })).toMatchObject({
    accepted: false,
    hold: true,
  });
  world.dispose();
});

it(
  "a seated driver circles through due south without stopping",
  { timeout: 60000 },
  async () => {
    const source = await movingSource("vehicle", openBenchFixture());
    const play = await PlaySession.create(
      source.geometry,
      { rigId: "vehicle", position: [80, -0.3, -188] },
      source.mechanism,
    );
    try {
      play.enterVehicle({
        rigId: "vehicle",
        seatId:
          source.mechanism.project.motionRigs.vehicle.vehicle!.driverSeat!.id,
      });
      // Steer and drive together (the reported jeep failure) for 15 s.
      play.setInput({ moveZ: 1, moveX: 1 });
      for (let t = 0; t < 900; t++) {
        const rig = play.stepTicks(1).mechanism!;
        expect(rig.blockedReason).toBeUndefined();
      }
      expect(
        Math.abs(play.snapshot().mechanism!.pose.vehicle!.headingDegrees),
      ).toBeGreaterThan(360);
    } finally {
      play.dispose();
    }
  },
);
