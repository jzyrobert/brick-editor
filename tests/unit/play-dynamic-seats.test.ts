import { expect, it } from "vitest";
import { openBenchFixture } from "../../src/mechanisms/fixtures";
import { playSources } from "../helpers/play-dynamic-source";
import { PlaySession } from "../../src/play/session";
import { seatPlacement } from "../../src/play/vehicle-seat";
import { validate } from "../../src/core/validate";

it("seats and drives on the native dynamic chassis, follows full pose and exits at supported current-frame locations", async () => {
  const project = openBenchFixture(),
    original = JSON.stringify(project);
  const prepared = await playSources(project, ["vehicle"]);
  const run = async () => {
    const play = await PlaySession.create(
      prepared.geometry,
      {
        rigId: "vehicle",
        dynamicRigIds: ["vehicle"],
        position: [80, -0.3, -188],
      },
      prepared.sources,
    );
    try {
      play.stepTicks(60);
      const request = { rigId: "vehicle", seatId: "driver" };
      expect(play.vehicleSeatEligibility(request)).toMatchObject({
        eligible: true,
      });
      const entered = play.enterVehicle(request);
      expect(entered.avatar.state).toBe("seated");
      expect(entered.mechanism!.mode).toBe("dynamic");
      play.setInput({ moveZ: 1, moveX: -0.5 });
      const driven = play.stepTicks(90);
      const placement = seatPlacement(
        driven.mechanism!.groupFrames.chassis,
        project.motionRigs.vehicle.vehicle!.driverSeat!,
        true,
      );
      expect(driven.position).toEqual(placement.avatarRoot);
      expect(driven.occupancy!.effectiveEyeWorldLdu).toEqual(placement.eye);
      expect(driven.avatar.basis).toEqual(placement.pelvisFrame.basis);
      expect(
        Math.hypot(...driven.position.map((v, i) => v - entered.position[i])),
      ).toBeGreaterThan(50);
      validate("playSnapshot", driven);
      play.clearInput();
      play.stepTicks(180);
      const exit = play.exitVehicle();
      expect(exit.occupancy).toBeUndefined();
      expect(exit.position[1]).toBeCloseTo(-0.2, 1);
      expect(JSON.stringify(project)).toBe(original);
      return { entered, driven, exit };
    } finally {
      play.dispose();
    }
  };
  expect(await run()).toEqual(await run());
});

it("the dynamic rider's head shape meets a head-only obstacle and preserves chassis mass", async () => {
  const project = openBenchFixture();
  const prepared = await playSources(project, ["vehicle"]),
    geometry = prepared.geometry,
    offset = geometry.vertices.length / 3;
  geometry.vertices = new Float32Array([
    ...geometry.vertices,
    -60,
    -110,
    -300,
    60,
    -110,
    -300,
    60,
    -76,
    -300,
    -60,
    -76,
    -300,
  ]);
  geometry.indices = new Uint32Array([
    ...geometry.indices,
    offset,
    offset + 1,
    offset + 2,
    offset,
    offset + 2,
    offset + 3,
  ]);
  const play = await PlaySession.create(
    geometry,
    {
      rigId: "vehicle",
      dynamicRigIds: ["vehicle"],
      position: [80, -0.3, -188],
    },
    prepared.sources,
  );
  try {
    play.stepTicks(60);
    const mass = play.snapshot().mechanism!.dynamics!.bodies.chassis.massKg;
    play.enterVehicle({ rigId: "vehicle", seatId: "driver" });
    play.setInput({ moveZ: 1 });
    const contact = play.stepTicks(240);
    expect(contact.mechanism!.dynamics!.bodies.chassis.massKg).toBeCloseTo(
      mass,
      4,
    );
    expect(contact.occupancy!.pelvisWorldLdu[2]).toBeGreaterThan(-290);
    expect(contact.occupancy!.pelvisWorldLdu[2]).toBeLessThan(-220);
    play.setInput({ moveZ: -1 });
    const reversed = play.stepTicks(120);
    expect(reversed.position[2]).toBeGreaterThan(contact.position[2] + 20);
  } finally {
    play.dispose();
  }
});

it("dynamic seat entry failure is atomic and an unsupported first exit checks the next authored exit", async () => {
  const project = openBenchFixture();
  project.motionRigs.vehicle.vehicle!.driverSeat!.exits[0].position[1] = -10000;
  const prepared = await playSources(project, ["vehicle"]);
  const play = await PlaySession.create(
    prepared.geometry,
    {
      rigId: "vehicle",
      dynamicRigIds: ["vehicle"],
      position: [80, -0.3, -188],
    },
    prepared.sources,
  );
  try {
    play.stepTicks(60);
    const before = play.snapshot();
    expect(() =>
      play.enterVehicle({ rigId: "vehicle", seatId: "unknown" }),
    ).toThrow();
    expect(play.snapshot()).toEqual(before);
    play.enterVehicle({ rigId: "vehicle", seatId: "driver" });
    const exited = play.exitVehicle();
    expect(exited.occupancy).toBeUndefined();
    expect(exited.position[0]).toBeLessThan(-70);
  } finally {
    play.dispose();
  }
});
