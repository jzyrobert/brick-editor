import { expect, it } from "vitest";
import { movingSource } from "../helpers/play-moving-source";
import { PlaySession } from "../../src/play/session";
import type { CollisionSnapshot } from "../../src/play/types";
function scene(wall = true): CollisionSnapshot {
  const vertices = [
    -1000, 0, -1000, 1000, 0, -1000, 1000, 0, 1000, -1000, 0, 1000,
  ];
  const indices = [0, 2, 1, 0, 3, 2];
  if (wall) {
    vertices.push(
      -100,
      -100,
      -300,
      100,
      -100,
      -300,
      100,
      0,
      -300,
      -100,
      0,
      -300,
    );
    indices.push(4, 5, 6, 4, 6, 7);
  }
  return {
    revision: 0,
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    bounds: { min: [-1000, -100, -1000], max: [1000, 0, 1000] },
  };
}
it("protects actual compiled vehicle against included floor+thinwall, retaining wheel travel atomically and persistent blocked status", async () => {
  const source = await movingSource("vehicle");
  const original = JSON.stringify(source.mechanism.project);
  const play = await PlaySession.create(
    scene(),
    { rigId: "vehicle", ground: false, position: [300, -0.3, -200] },
    source.mechanism,
  );
  try {
    expect(play.snapshot().mechanism!.vehicleCollision).toMatchObject({
      supported: true,
      status: "ready",
      units: "metres",
    });
    play.setMechanismVehicleInput({ throttle: 1, steering: 0 });
    const stopped = play.stepTicks(120).mechanism!;
    expect(stopped.vehicleCollision).toMatchObject({
      status: "blocked",
      obstacle: { sourceId: "included-static-world" },
    });
    const pose = stopped.pose.vehicle!;
    expect(pose.position[2]).toBeLessThan(-10);
    expect(pose.position[2]).toBeGreaterThan(-70);
    expect(pose.wheelAngles["left-front"]).toBeCloseTo(
      ((-pose.position[2] / 12) * 180) / Math.PI,
      5,
    );
    expect(play.stepTicks(60).mechanism!.pose).toEqual(stopped.pose);
    expect(play.snapshot().mechanism!.vehicleCollision).toEqual(
      stopped.vehicleCollision,
    );
    // Pointer release is not retry intent and must keep the stop explanation.
    const released = play.setMechanismVehicleInput({
      throttle: 0,
      steering: 0,
    }).mechanism!;
    expect(released.vehicleCollision).toEqual(stopped.vehicleCollision);
    expect(released.blockedReason).toBe(stopped.blockedReason);
    expect(play.stepTicks(2).mechanism!.pose).toEqual(stopped.pose);
    // A deliberate steering change is a retry even without throttle.
    expect(
      play.setMechanismVehicleInput({ throttle: 0, steering: 0.2 }).mechanism!
        .vehicleCollision!.status,
    ).toBe("ready");
    // Explicit reverse retry succeeds from last accepted pose.
    play.setMechanismVehicleInput({ throttle: -1, steering: 0 });
    expect(
      play.stepTicks(10).mechanism!.pose.vehicle!.position[2],
    ).toBeGreaterThan(pose.position[2]);
    expect(JSON.stringify(source.mechanism.project)).toBe(original);
  } finally {
    play.dispose();
  }
});
it("filtered-out wall permits travel, and temporaryground permits wheel tangency without authored floor", async () => {
  const source = await movingSource("vehicle");
  for (const ground of [false, true]) {
    const geometry = scene(false);
    if (ground) {
      geometry.vertices = new Float32Array();
      geometry.indices = new Uint32Array();
    }
    geometry.worldProfile = {
      excludedLayerIds: ["wall"],
      includedOccurrenceIds: [],
    };
    const play = await PlaySession.create(
      geometry,
      {
        rigId: "vehicle",
        ground,
        worldProfile: { excludedLayerIds: ["wall"] },
        position: [300, -0.3, -200],
      },
      source.mechanism,
    );
    try {
      play.setMechanismVehicleInput({ throttle: 1, steering: 0 });
      expect(
        play.stepTicks(60).mechanism!.pose.vehicle!.position[2],
      ).toBeCloseTo(-100, 4);
      expect(play.snapshot().mechanism!.vehicleCollision!.status).toBe("ready");
    } finally {
      play.dispose();
    }
  }
});
it("unsupported tilted axle disables vehicle motion while preserving ordinary door and Walk/Fly session", async () => {
  const car = await movingSource("vehicle"),
    door = await movingSource("door");
  car.mechanism.project.motionRigs.vehicle.vehicle!.wheels[0].axis = [0, 1, 0];
  const play = await PlaySession.create(
    scene(false),
    { rigIds: ["vehicle", "door"], position: [300, -0.3, -200] },
    [car.mechanism, door.mechanism],
  );
  try {
    expect(play.snapshot().mechanisms!.vehicle.vehicleCollision).toMatchObject({
      supported: false,
      status: "unsupported",
    });
    play.setMechanismVehicleInput({ throttle: 1, steering: 0 }, "vehicle");
    expect(
      play.stepTicks(20).mechanisms!.vehicle.pose.vehicle!.position,
    ).toEqual([0, 0, 0]);
    expect(
      play.setMechanismJoint("hinge", 90, "door").mechanisms!.door.pose
        .jointPositions.hinge,
    ).toBe(90);
    expect(play.setLocomotion("fly-noclip").locomotion).toBe("fly-noclip");
  } finally {
    play.dispose();
  }
});
it("two actual vehicles stop before each other with stable rig-ID priority independent of creation order", async () => {
  const a = await movingSource("vehicle"),
    b = await movingSource("vehicle");
  const rig = b.mechanism.project.motionRigs.vehicle;
  delete b.mechanism.project.motionRigs.vehicle;
  rig.id = "alpha";
  b.mechanism.project.motionRigs.alpha = rig;
  b.mechanism.rigId = "alpha";
  for (const group of rig.groups) {
    group.frame.position[2] -= 150;
    const rest: typeof group.restTransforms = {};
    for (const [id, t] of Object.entries(group.restTransforms)) {
      t.position[2] -= 150;
      const nodeId = JSON.parse(id)[0],
        replacement = "second-" + nodeId;
      const model = b.mechanism.project.models[b.mechanism.project.rootModelId];
      const node = model.nodes.find((n) => n.id === nodeId)!;
      node.transform.position[2] -= 150;
      node.id = replacement;
      for (const record of model.records)
        if (record.nodeId === nodeId) record.nodeId = replacement;
      const nextId = JSON.stringify([replacement]);
      rest[nextId] = t;
      group.occurrenceIds[group.occurrenceIds.indexOf(id)] = nextId;
    }
    group.restTransforms = rest;
    const mesh = b.mechanism.groups[group.id];
    for (let i = 2; i < mesh.vertices.length; i += 3) mesh.vertices[i] -= 150;
  }
  const run = async (reverse: boolean) => {
    const sources = reverse
      ? [b.mechanism, a.mechanism]
      : [a.mechanism, b.mechanism];
    const play = await PlaySession.create(
      scene(false),
      { rigIds: sources.map((s) => s.rigId), position: [300, -0.3, -200] },
      sources,
    );
    try {
      play.setMechanismVehicleInput({ throttle: 1, steering: 0 }, "vehicle");
      play.setMechanismVehicleInput({ throttle: -1, steering: 0 }, "alpha");
      const result = play.stepTicks(80).mechanisms!;
      expect(result.vehicle.vehicleCollision!.status).toBe("blocked");
      expect(result.alpha.vehicleCollision!.status).toBe("blocked");
      expect(result.vehicle.pose.vehicle!.position[2]).toBeGreaterThan(-50);
      expect(result.alpha.pose.vehicle!.position[2]).toBeLessThan(50);
      return { vehicle: result.vehicle.pose, alpha: result.alpha.pose };
    } finally {
      play.dispose();
    }
  };
  expect(await run(false)).toEqual(await run(true));
});
it("out-of-domain included obstacle disables driving without aborting ordinary exploration", async () => {
  const source = await movingSource("vehicle"),
    geometry = scene(false);
  geometry.vertices = new Float32Array([
    ...geometry.vertices,
    600000,
    0,
    0,
    600000,
    -10,
    0,
    600000,
    0,
    10,
  ]);
  geometry.indices = new Uint32Array([...geometry.indices, 4, 5, 6]);
  const play = await PlaySession.create(
    geometry,
    { rigId: "vehicle", position: [300, -0.3, -200] },
    source.mechanism,
  );
  try {
    expect(play.snapshot().mechanism!.vehicleCollision).toMatchObject({
      supported: false,
      status: "unsupported",
    });
    play.setMechanismVehicleInput({ throttle: 1, steering: 0 });
    expect(play.stepTicks(3).mechanism!.pose.vehicle!.position).toEqual([
      0, 0, 0,
    ]);
    expect(play.setLocomotion("fly-noclip").locomotion).toBe("fly-noclip");
  } finally {
    play.dispose();
  }
});
it("source-certified envelopes contain compiled chassis and wheels through heading, steering and spin", async () => {
  const { certifyDrivingProfile, drivingPose } = await import(
    "../../src/play/vehicle-profile"
  );
  const { KinematicSession } = await import("../../src/mechanisms/kinematic");
  const { compose, inverse, mv, add } = await import("../../src/core/math");
  const source = await movingSource("vehicle"),
    profile = certifyDrivingProfile(source.mechanism);
  const engine = new KinematicSession(source.mechanism.project, "vehicle");
  const rest = engine.snapshot().pose;
  rest.vehicle!.headingDegrees = 37;
  rest.vehicle!.steeringDegrees = 35;
  for (const id of Object.keys(rest.vehicle!.wheelAngles))
    rest.vehicle!.wheelAngles[id] = 47;
  const moved = engine.setPose(rest),
    pose = drivingPose(profile, moved),
    c = Math.cos(pose.yaw),
    s = Math.sin(pose.yaw);
  source.mechanism.project.motionRigs.vehicle.groups.forEach((group, index) => {
    const delta = compose(moved.groupFrames[group.id], inverse(group.frame)),
      mesh = source.mechanism.groups[group.id],
      box = profile.boxes[index];
    for (let i = 0; i < mesh.vertices.length; i += 3) {
      const world = add(
        delta.position,
        mv(delta.basis, [
          mesh.vertices[i],
          mesh.vertices[i + 1],
          mesh.vertices[i + 2],
        ]),
      );
      const x = world[0] * 0.02 - pose.x,
        y = -world[1] * 0.02 - pose.y,
        z = -world[2] * 0.02 - pose.z;
      const local = [c * x - s * z, y, s * x + c * z];
      for (let axis = 0; axis < 3; axis++)
        expect(Math.abs(local[axis] - box.center[axis])).toBeLessThanOrEqual(
          box.halfExtents[axis] + 1e-6,
        );
    }
  });
});
