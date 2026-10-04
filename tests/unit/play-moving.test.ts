import { expect, it } from "vitest";
import { movingSource as source } from "../helpers/play-moving-source";
import { PlaySession } from "../../src/play/session";
import { validate } from "../../src/core/validate";

it("opens a real door collider, traverses the opening and refuses a swept closing pose across the actor", async () => {
  const s = await source("door"),
    original = JSON.stringify(s.mechanism.project);
  const play = await PlaySession.create(
    s.geometry,
    { rigId: "door", position: [20, -0.3, 45] },
    s.mechanism,
  );
  play.setInput({ moveZ: 1 });
  play.stepTicks(40);
  expect(play.snapshot().position[2]).toBeGreaterThan(9);
  play.clearInput();
  play.teleport({ position: [20, -0.3, 45] });
  const opened = play.setMechanismJoint("hinge", 90);
  expect(opened.mechanism!.blocked).toBe(false);
  play.setInput({ moveZ: 1 });
  // 45 LDU at the walking speed (145 LDU/s): into the doorway.
  play.stepTicks(19);
  play.clearInput();
  expect(Math.abs(play.snapshot().position[2])).toBeLessThan(3);
  const before = play.snapshot().mechanism!.pose;
  const blocked = play.setMechanismJoint("hinge", 0);
  expect(blocked.mechanism!.blocked).toBe(true);
  expect(blocked.mechanism!.pose).toEqual(before);
  // Both the final closed position and the initial open position are clear here,
  // but a rotating panel would cross this actor between those endpoints.
  play.teleport({ position: [20, -0.3, 45] });
  play.setMechanismJoint("hinge", 0);
  play.teleport({ position: [22, -0.3, -22] });
  expect(play.setMechanismJoint("hinge", 90).mechanism!.blocked).toBe(true);
  expect(play.snapshot().mechanism!.pose.jointPositions.hinge).toBe(0);
  expect(JSON.stringify(s.mechanism.project)).toBe(original);
  play.teleport({ position: [20, -0.3, 0], policy: "free-flight" });
  play.setMechanismJoint("hinge", 90);
  play.setMechanismJoint("hinge", 0);
  const recovered = play.setLocomotion("walk");
  expect(recovered.locomotion).toBe("walk");
  expect(Math.abs(recovered.position[2])).toBeGreaterThan(9);
  validate("playSnapshot", play.snapshot());
  play.dispose();
});
it("fixed tick vehicle replay moves collision surfaces, stops before the actor, and clearing input stops throttle", async () => {
  const s = await source("vehicle");
  const run = async () => {
    const play = await PlaySession.create(
      s.geometry,
      { rigId: "vehicle", position: [0, -0.3, -300] },
      s.mechanism,
    );
    play.setMechanismVehicleInput({ throttle: 1, steering: 0 });
    play.stepTicks(120);
    const blocked = play.snapshot();
    expect(blocked.mechanism!.blocked).toBe(true);
    expect(blocked.mechanism!.pose.vehicle!.position[2]).toBeGreaterThan(-70);
    expect(blocked.tick).toBe(120);
    expect(blocked.mechanism!.tick).toBe(120);
    const before = blocked.mechanism!.pose;
    play.clearInput();
    play.teleport({ position: [200, -0.3, -300] });
    play.stepTicks(60);
    expect(play.snapshot().mechanism!.pose).toEqual(before);
    play.dispose();
    return blocked;
  };
  expect(await run()).toEqual(await run());
});

it("refuses invalid moving geometry and stops excessive sweep work without aborting fixed ticks", async () => {
  const s = await source("vehicle"),
    rig = s.mechanism.project.motionRigs!.vehicle;
  rig.vehicle!.maxSpeed = 10000;
  for (const wheel of rig.vehicle!.wheels) wheel.radius = 0.1;
  const play = await PlaySession.create(
    s.geometry,
    { rigId: "vehicle", position: [200, -0.3, -200] },
    s.mechanism,
  );
  play.setMechanismVehicleInput({ throttle: 1, steering: 0 });
  const bounded = play.stepTicks(1);
  expect(bounded.mechanism!.blocked).toBe(true);
  expect(bounded.mechanism!.blockedReason).toMatch(/too many safety checks/i);
  expect(bounded.mechanism!.pose.vehicle!.position).toEqual([0, 0, 0]);
  expect(() => play.stepTicks(5)).not.toThrow();
  play.dispose();
  s.mechanism.groups.chassis.indices = new Uint32Array([99999999, 1, 2]);
  await expect(
    PlaySession.create(s.geometry, { rigId: "vehicle" }, s.mechanism),
  ).rejects.toThrow("valid complete geometry");
});

it("revalidates a saved session spawn against a door that subsequently closed", async () => {
  const sourceData = await source("door");
  const session = await PlaySession.create(
    sourceData.geometry,
    { rigId: "door", position: [20, -0.3, 45] },
    sourceData.mechanism,
  );
  session.setMechanismJoint("hinge", 90);
  const saved = session.chooseSpawn({
    position: [20, -0.3, 0],
    yaw: 0,
    pitch: 0,
  }).spawn;
  expect(session.setMechanismJoint("hinge", 0).mechanism!.blocked).toBe(false);
  const before = session.snapshot();
  expect(() => session.useSpawn()).toThrow("intersects geometry");
  expect(session.snapshot()).toEqual(before);
  expect(session.snapshot().spawn).toEqual(saved);
  session.dispose();
});
it("runs door and vehicle rigs together with explicit targeting, shared collision world and deterministic ticks", async () => {
  const door = await source("door"),
    vehicle = await source("vehicle");
  const geometry = {
    ...door.geometry,
    vertices: new Float32Array(),
    indices: new Uint32Array(),
  };
  const before = JSON.stringify(door.mechanism.project);
  const play = await PlaySession.create(
    geometry,
    { rigIds: ["door", "vehicle"], position: [20, -0.3, 45] },
    [door.mechanism, vehicle.mechanism],
  );
  try {
    expect(play.snapshot().mechanism).toBeUndefined();
    expect(Object.keys(play.snapshot().mechanisms!)).toEqual([
      "door",
      "vehicle",
    ]);
    const unchanged = play.snapshot();
    expect(() => play.setMechanismJoint("hinge", 90)).toThrow("Specify rigId");
    expect(() =>
      play.setMechanismVehicleInput({ throttle: 1, steering: 0 }),
    ).toThrow("Specify rigId");
    expect(() => play.setMechanismJoint("hinge", 90, "missing")).toThrow(
      "Unknown active",
    );
    expect(play.snapshot()).toEqual(unchanged);
    play.setInput({ moveZ: 1 });
    play.stepTicks(40);
    expect(play.snapshot().position[2]).toBeGreaterThan(9);
    play.teleport({ position: [20, -0.3, 45] });
    play.setMechanismJoint("hinge", 90, "door");
    play.setInput({ moveZ: 1 });
    // 45 LDU at the walking speed (145 LDU/s): into the doorway.
    play.stepTicks(19);
    play.clearInput();
    expect(Math.abs(play.snapshot().position[2])).toBeLessThan(3);
    const blocked = play.setMechanismJoint("hinge", 0, "door");
    expect(blocked.mechanisms!.door.blocked).toBe(true);
    expect(blocked.mechanisms!.door.pose.jointPositions.hinge).toBe(90);
    play.teleport({ position: [200, -0.3, -200] });
    play.setMechanismVehicleInput({ throttle: 1, steering: 0 }, "vehicle");
    const driven = play.stepTicks(60);
    expect(driven.mechanisms!.vehicle.pose.vehicle!.position[2]).toBeCloseTo(
      -100,
      4,
    );
    expect(driven.mechanisms!.door.tick).toBe(driven.tick);
    expect(driven.mechanisms!.vehicle.tick).toBe(driven.tick);
    play.clearInput();
    expect(play.stepTicks(60).mechanisms!.vehicle.pose).toEqual(
      driven.mechanisms!.vehicle.pose,
    );
    expect(JSON.stringify(door.mechanism.project)).toBe(before);
  } finally {
    play.dispose();
  }
});
it("rejects duplicate or overlapping rigs, incompatible requests and aggregate moving geometry before allocating a session", async () => {
  const door = await source("door"),
    vehicle = await source("vehicle"),
    geometry = {
      ...door.geometry,
      vertices: new Float32Array(),
      indices: new Uint32Array(),
    };
  await expect(
    PlaySession.create(
      geometry,
      { rigId: "door", rigIds: ["door"] },
      door.mechanism,
    ),
  ).rejects.toThrow("not both");
  await expect(
    PlaySession.create(geometry, { rigIds: ["door", "door"] }, [
      door.mechanism,
      door.mechanism,
    ]),
  ).rejects.toThrow("distinct");
  await expect(
    PlaySession.create(geometry, {}, [door.mechanism, door.mechanism]),
  ).rejects.toThrow("distinct");
  await expect(
    PlaySession.create(
      geometry,
      { rigIds: ["door", "vehicle"] },
      door.mechanism,
    ),
  ).rejects.toThrow("matching geometry");
  const overlap = {
    ...door.mechanism,
    rigId: "other",
    project: structuredClone(door.mechanism.project),
  };
  overlap.project.motionRigs.other = {
    ...structuredClone(overlap.project.motionRigs.door),
    id: "other",
  };
  await expect(
    PlaySession.create(geometry, {}, [door.mechanism, overlap]),
  ).rejects.toThrow("share occurrence");
  for (const s of [door.mechanism, vehicle.mechanism]) {
    const first = s.project.motionRigs[s.rigId].groups[0].id;
    s.groups[first] = {
      ...s.groups[first],
      indices: new Uint32Array(110000 * 3),
    };
  }
  await expect(
    PlaySession.create(geometry, { rigIds: ["door", "vehicle"] }, [
      door.mechanism,
      vehicle.mechanism,
    ]),
  ).rejects.toThrow("Combined Play rigs");
  await expect(
    PlaySession.create(
      geometry,
      {},
      Array.from({ length: 33 }, () => door.mechanism),
    ),
  ).rejects.toThrow("32 authored rigs");
});
