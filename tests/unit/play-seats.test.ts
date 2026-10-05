import { expect, it } from "vitest";
import { openBenchFixture } from "../../src/mechanisms/fixtures";
import { movingSource } from "../helpers/play-moving-source";
import { PlaySession } from "../../src/play/session";
import { PLAY_CAMERA_DEFAULTS } from "../../src/play/types";
const position: [number, number, number] = [80, -0.3, -188];
async function create() {
  const source = await movingSource("vehicle", openBenchFixture());
  const play = await PlaySession.create(
    source.geometry,
    { rigId: "vehicle", position },
    source.mechanism,
  );
  return {
    source,
    play,
    request: {
      rigId: "vehicle",
      seatId:
        source.mechanism.project.motionRigs.vehicle.vehicle!.driverSeat!.id,
    },
  };
}
it("enters a true rigid seated profile, drives with attached eye/root, and safely exits at current-frame feet", async () => {
  const { source, play, request } = await create();
  const original = JSON.stringify(source.mechanism.project);
  try {
    expect(play.vehicleSeatEligibility(request)).toMatchObject({
      eligible: true,
    });
    const entry = play.enterVehicle(request);
    expect(entry.occupancy).toBeDefined();
    expect(entry.avatar.state).toBe("seated");
    expect(entry.avatar.leftHip).toBe(Math.PI / 2);
    expect(entry.positionAnchor).toBe("seated-avatar-root");
    // Pelvis 22.5 LDU above the chassis origin (y −24); the root is the
    // minifig's feet level, 28 LDU below its hip axle.
    expect(entry.position[1]).toBeCloseTo(-18.5, 5);
    expect(entry.occupancy!.pelvisWorldLdu[1]).toBe(-46.5);
    expect(entry.cameraMode).toBe("third-person");
    expect(entry.avatarVisible).toBe(false);
    play.setCameraMode("first-person");
    const beforeCamera = play.camera();
    expect(beforeCamera.position).toEqual(
      entry.occupancy!.effectiveEyeWorldLdu,
    );
    play.setInput({ moveZ: 1, yaw: 0.2, pitch: 0.1 });
    const after = play.stepTicks(30);
    expect(after.position[2]).toBeLessThan(entry.position[2] - 40);
    expect(after.occupancy!.localLookYaw).toBeCloseTo(0.2, 5);
    const positionBefore = [...after.position];
    play.setCameraMode("third-person");
    expect(play.snapshot().position).toEqual(positionBefore);
    expect(() => play.setLocomotion("fly-noclip")).toThrow(/Exit vehicle/);
    expect(() => play.respawn()).toThrow(/Exit vehicle/);
    const exit = play.exitVehicle();
    expect(exit.occupancy).toBeUndefined();
    expect(exit.positionAnchor).toBe("standing-feet");
    expect(exit.position[0]).toBeCloseTo(80, 5);
    expect(exit.position[2]).toBeCloseTo(-238, 4);
    expect(JSON.stringify(source.mechanism.project)).toBe(original);
  } finally {
    play.dispose();
  }
});
it("rejects invalid/far requests without entry mutation", async () => {
  const { play, request } = await create();
  try {
    const before = play.snapshot();
    expect(() =>
      play.enterVehicle({ ...request, bogus: 1 } as never),
    ).toThrow();
    expect(play.snapshot()).toEqual(before);
    play.teleport({ position: [300, -0.3, -188] });
    const far = play.snapshot();
    expect(play.vehicleSeatEligibility(request).eligible).toBe(false);
    expect(() => play.enterVehicle(request)).toThrow(
      /closer to the driver's seat/,
    );
    expect(play.snapshot()).toEqual(far);
  } finally {
    play.dispose();
  }
});
it("head-only obstacle stops rider+vehicle+wheel pose atomically and release preserves explanation", async () => {
  const source = await movingSource("vehicle", openBenchFixture());
  const mesh = source.geometry,
    offset = mesh.vertices.length / 3;
  mesh.vertices = new Float32Array([
    ...mesh.vertices,
    -30,
    -100,
    -260,
    30,
    -100,
    -260,
    30,
    -76,
    -260,
    -30,
    -76,
    -260,
  ]);
  mesh.indices = new Uint32Array([
    ...mesh.indices,
    offset,
    offset + 1,
    offset + 2,
    offset,
    offset + 2,
    offset + 3,
  ]);
  const play = await PlaySession.create(
      mesh,
      { rigId: "vehicle", position },
      source.mechanism,
    ),
    request = {
      rigId: "vehicle",
      seatId:
        source.mechanism.project.motionRigs.vehicle.vehicle!.driverSeat!.id,
    };
  try {
    play.enterVehicle(request);
    play.setInput({ moveZ: 1 });
    const stopped = play.stepTicks(120);
    expect(stopped.mechanism!.blocked).toBe(true);
    expect(stopped.mechanism!.blockedReason).toMatch(/Body/);
    expect(stopped.mechanism!.pose.vehicle!.position[2]).toBeLessThan(-10);
    expect(stopped.mechanism!.pose.vehicle!.position[2]).toBeGreaterThan(-60);
    expect(stopped.position[2] - stopped.occupancy!.pelvisWorldLdu[2]).toBe(0);
    play.setInput({});
    const idle = play.stepTicks(5);
    expect(idle.position).toEqual(stopped.position);
    expect(idle.mechanism!.pose).toEqual(stopped.mechanism!.pose);
    expect(idle.mechanism!.blockedReason).toBe(
      stopped.mechanism!.blockedReason,
    );
  } finally {
    play.dispose();
  }
});
it("exit cannot use its own seated sensor as supporting floor and remains occupied", async () => {
  const project = openBenchFixture();
  project.motionRigs.vehicle.vehicle!.driverSeat!.exits = [
    { position: [0, -65.3, 12], yawDegrees: 0 },
  ];
  const source = await movingSource("vehicle", project),
    play = await PlaySession.create(
      source.geometry,
      { rigId: "vehicle", position },
      source.mechanism,
    );
  try {
    play.enterVehicle({
      rigId: "vehicle",
      seatId: project.motionRigs.vehicle.vehicle!.driverSeat!.id,
    });
    const before = play.snapshot();
    expect(() => play.exitVehicle()).toThrow(/Exit blocked/);
    expect(play.snapshot().occupancy).toEqual(before.occupancy);
    expect(play.snapshot().position).toEqual(before.position);
    expect(() => play.exitVehicle({ exitIndex: 99 })).toThrow(/Unknown/);
  } finally {
    play.dispose();
  }
});
it("valid authored metadata cannot bypass full-spin wheel-body clearance", async () => {
  const project = openBenchFixture();
  project.motionRigs.vehicle.vehicle!.driverSeat!.pelvisPosition = [
    40, 12, -20,
  ];
  const source = await movingSource("vehicle", project),
    play = await PlaySession.create(
      source.geometry,
      { rigId: "vehicle", position },
      source.mechanism,
    );
  try {
    const before = play.snapshot();
    expect(() =>
      play.enterVehicle({
        rigId: "vehicle",
        seatId: project.motionRigs.vehicle.vehicle!.driverSeat!.id,
      }),
    ).toThrow(/wheel/);
    expect(play.snapshot()).toEqual(before);
  } finally {
    play.dispose();
  }
});
it("foreign moving door stops against the actual seated body while own vehicle may carry it", async () => {
  const car = await movingSource("vehicle", openBenchFixture()),
    project = openBenchFixture();
  const rig = project.motionRigs.door;
  const frame = Object.values(project.models).find(
    (m) => m.name === "frame.dat",
  )!;
  frame.nodes = frame.nodes.slice(0, 6);
  const kept = new Set(frame.nodes.map((n) => n.id));
  frame.records = frame.records.filter((r) => !r.nodeId || kept.has(r.nodeId));
  // The opened leaf stands just clear of the seated minifig's hands (29 LDU
  // out from its pelvis). Its lower edge clears the chassis and cushion, so
  // closing it tests the seated body rather than an existing body intersection.
  for (const group of rig.groups) {
    group.frame.position[0] -= 34;
    group.frame.position[1] -= 40;
    group.frame.position[2] -= 200;
    for (const [id, rest] of Object.entries(group.restTransforms)) {
      rest.position[0] -= 34;
      rest.position[1] -= 40;
      rest.position[2] -= 200;
      const node = project.models[project.rootModelId].nodes.find(
        (n) => n.id === JSON.parse(id)[0],
      )!;
      node.transform.position[0] -= 34;
      node.transform.position[1] -= 40;
      node.transform.position[2] -= 200;
    }
  }
  const door = await movingSource("door", project),
    play = await PlaySession.create(
      {
        ...car.geometry,
        vertices: new Float32Array(),
        indices: new Uint32Array(),
      },
      { rigIds: ["vehicle", "door"], position },
      [car.mechanism, door.mechanism],
    );
  try {
    expect(
      play.setMechanismJoint("hinge", 90, "door").mechanisms!.door.blocked,
    ).toBe(false);
    expect(
      play.setMechanismJoint("hinge", 0, "door").mechanisms!.door.blocked,
    ).toBe(false);
    play.setMechanismJoint("hinge", 90, "door");
    play.enterVehicle({
      rigId: "vehicle",
      seatId: car.mechanism.project.motionRigs.vehicle.vehicle!.driverSeat!.id,
    });
    const seated = play.snapshot().occupancy;
    const stopped = play.setMechanismJoint("hinge", 0, "door");
    expect(stopped.mechanisms!.door.blocked).toBe(true);
    expect(stopped.mechanisms!.door.pose.jointPositions.hinge).toBe(90);
    expect(stopped.occupancy).toEqual(seated);
  } finally {
    play.dispose();
  }
});
it("ordered exits use current chassis frame and skip an obstructed first exit", async () => {
  const { BoxGeometry } = await import("three");
  const source = await movingSource("vehicle", openBenchFixture());
  const obstruction = new BoxGeometry(20, 20, 20).toNonIndexed();
  obstruction.translate(80, -10, -238);
  const vertices = obstruction.getAttribute("position"),
    offset = source.geometry.vertices.length / 3;
  source.geometry.vertices = new Float32Array([
    ...source.geometry.vertices,
    ...Array.from(vertices.array),
  ]);
  source.geometry.indices = new Uint32Array([
    ...source.geometry.indices,
    ...Array.from({ length: vertices.count }, (_, i) => offset + i),
  ]);
  obstruction.dispose();
  const play = await PlaySession.create(
    source.geometry,
    { rigId: "vehicle", position },
    source.mechanism,
  );
  try {
    play.enterVehicle({
      rigId: "vehicle",
      seatId:
        source.mechanism.project.motionRigs.vehicle.vehicle!.driverSeat!.id,
    });
    play.setInput({ moveZ: 1 });
    play.stepTicks(30);
    play.clearInput();
    expect(() => play.exitVehicle({ exitIndex: 0 })).toThrow(/Exit blocked/);
    expect(play.snapshot().occupancy).toBeDefined();
    const beforeCapture = play.snapshot(),
      restore = play.beginCameraCapture(0.6);
    restore();
    expect(play.snapshot()).toEqual(beforeCapture);
    const exit = play.exitVehicle();
    expect(exit.position[0]).toBeCloseTo(-80, 4);
    expect(exit.position[2]).toBeCloseTo(-238, 4);
    expect(exit.occupancy).toBeUndefined();
  } finally {
    play.dispose();
  }
});
it("seated relative look wraps correctly across zero and a negative chassis heading", async () => {
  const { compose, rotationY, mv } = await import("../../src/core/math");
  for (const degrees of [0, 135]) {
    const project = openBenchFixture(),
      rig = project.motionRigs.vehicle,
      origin = [...rig.groups[0].frame.position] as [number, number, number],
      basis = rotationY(degrees),
      rotated = mv(basis, origin),
      delta = {
        basis,
        position: origin.map((v, i) => v - rotated[i]) as [
          number,
          number,
          number,
        ],
      };
    for (const group of rig.groups) {
      group.frame = compose(delta, group.frame);
      for (const [id, rest] of Object.entries(group.restTransforms)) {
        group.restTransforms[id] = compose(delta, rest);
        const node = project.models[project.rootModelId].nodes.find(
          (n) => n.id === JSON.parse(id)[0],
        )!;
        node.transform = compose(delta, node.transform);
      }
    }
    const { seatPoint } = await import("../../src/play/vehicle-seat"),
      approach = seatPoint(
        rig.groups[0].frame,
        rig.vehicle!.driverSeat!.approachPosition,
      ),
      source = await movingSource("vehicle", project),
      play = await PlaySession.create(
        source.geometry,
        { rigId: "vehicle", position: approach },
        source.mechanism,
      );
    try {
      play.enterVehicle({
        rigId: "vehicle",
        seatId: rig.vehicle!.driverSeat!.id,
      });
      const heading = play.snapshot().avatar.heading;
      for (const look of [-0.1, 0.1]) {
        play.setInput({ yaw: heading + look });
        expect(play.snapshot().occupancy!.localLookYaw).toBeCloseTo(look, 8);
        expect(play.snapshot().avatar.headYaw).toBeCloseTo(look, 8);
      }
    } finally {
      play.dispose();
    }
  }
});
it("seated chase frames torso from above a shoulder, preserves first-person eye and respects own backrest", async () => {
  for (const tallBackrest of [false, true]) {
    const project = openBenchFixture();
    if (tallBackrest) {
      const chassis = Object.values(project.models).find(
        (m) => m.name === "chassis.dat",
      )!;
      for (const record of chassis.records)
        record.raw = record.raw
          .split(" ")
          .map((token) => (token === "-46" ? "-116" : token))
          .join(" ");
    }
    const source = await movingSource("vehicle", project),
      play = await PlaySession.create(
        source.geometry,
        { rigId: "vehicle", position },
        source.mechanism,
      );
    try {
      play.enterVehicle({
        rigId: "vehicle",
        seatId: project.motionRigs.vehicle.vehicle!.driverSeat!.id,
      });
      play.setCameraMode("first-person");
      const first = play.camera(),
        actor = play.snapshot().position;
      play.setCameraMode("third-person");
      const chase = play.camera(),
        arm = Math.hypot(...chase.position.map((n, i) => n - chase.target[i]));
      // 30 LDU over the pelvis: the minifig's chest.
      expect(chase.target[1]).toBeCloseTo(-76.5, 5);
      expect(chase.target[2]).toBeCloseTo(-198, 5);
      expect(chase.position[0]).toBeLessThan(-5);
      expect(chase.position[1]).toBeLessThan(chase.target[1] - 15);
      if (tallBackrest) {
        expect(arm).toBeLessThan(65);
        expect(chase.position[2]).toBeLessThan(-168);
      } else {
        expect(arm).toBeCloseTo(PLAY_CAMERA_DEFAULTS.followDistance, 4);
        expect(play.snapshot().avatarVisible).toBe(false);
      }
      const restore = play.beginCameraCapture(10);
      expect(
        Math.hypot(
          ...play.camera().position.map((n, i) => n - play.camera().target[i]),
        ),
      ).toBeLessThanOrEqual(arm + 1e-6);
      restore();
      expect(play.camera()).toEqual(chase);
      expect(play.snapshot().position).toEqual(actor);
      play.setCameraMode("first-person");
      expect(play.camera()).toEqual(first);
    } finally {
      play.dispose();
    }
  }
});
