import { expect, it } from "vitest";
import { movingSource } from "../helpers/play-moving-source";
import { PlaySession } from "../../src/play/session";
import { exportLDraw } from "../../src/ldraw/io";
import { validate } from "../../src/core/validate";
const input = (target: number, speed = 90) => ({
  rigId: "door",
  jointId: "hinge",
  target,
  speed,
});
it("advances authored hinge targets at60Hz with exact endpoints, reversible intent and deterministic replay", async () => {
  const source = await movingSource("door"),
    before = exportLDraw(source.mechanism.project);
  const create = () =>
    PlaySession.create(
      source.geometry,
      { rigId: "door", position: [200, -0.3, 0] },
      source.mechanism,
    );
  const a = await create(),
    b = await create();
  try {
    const queued = a.setJointTarget(input(90));
    expect(queued.mechanism!.pose.jointPositions.hinge).toBe(0);
    expect(queued.mechanism!.jointTargets.hinge).toMatchObject({
      current: 0,
      target: 90,
      speed: 90,
      status: "moving",
      units: "degrees",
      speedUnits: "degrees/s",
    });
    expect(() => a.setJointTarget(input(80, 3601))).toThrow();
    expect(a.snapshot()).toEqual(queued);
    expect(a.stepTicks(15).mechanism!.pose.jointPositions.hinge).toBe(22.5);
    expect(a.stepTicks(15).mechanism!.pose.jointPositions.hinge).toBe(45);
    expect(a.stepTicks(30).mechanism!.jointTargets.hinge).toMatchObject({
      current: 90,
      status: "complete",
    });
    b.setJointTarget(input(90));
    for (let i = 0; i < 60; i++) b.stepTicks(1);
    expect(a.snapshot()).toEqual(b.snapshot());
    a.setJointTarget(input(0));
    a.stepTicks(10);
    expect(a.snapshot().mechanism!.pose.jointPositions.hinge).toBe(75);
    a.setJointTarget(input(90));
    expect(a.stepTicks(1).mechanism!.pose.jointPositions.hinge).toBe(76.5);
    a.setMechanismJoint("hinge", 0, "door");
    a.setJointTarget(input(0.1, 17));
    expect(a.stepTicks(1).mechanism!.jointTargets.hinge).toMatchObject({
      current: 0.1,
      status: "complete",
    });
    expect(exportLDraw(source.mechanism.project)).toBe(before);
    validate("playSnapshot", a.snapshot());
  } finally {
    a.dispose();
    b.dispose();
  }
});
it("validates targets atomically, supports negative prismatic units, and preserves pending travel through clearInput/camera capture", async () => {
  const source = await movingSource("door"),
    joint = source.mechanism.project.motionRigs.door.joints[0];
  joint.kind = "prismatic";
  // Negative travel runs away from the doorway, rather than down into its floor.
  joint.axisA = [0, 0, 1];
  joint.axisB = [0, 0, 1];
  joint.limits = [-20.25, 0];
  const s = await PlaySession.create(
    source.geometry,
    { rigId: "door", position: [200, -0.3, 0] },
    source.mechanism,
  );
  try {
    s.setJointTarget(input(-20, 40));
    const before = s.snapshot();
    for (const value of [
      { ...input(-21, 40) },
      { ...input(-10, 0) },
      { ...input(-10, 10001) },
      { ...input(-10, NaN) },
      { ...input(Infinity, 40) },
      { ...input(-10, 40), jointId: "absent" },
    ])
      expect(() => s.setJointTarget(value)).toThrow();
    expect(s.snapshot()).toEqual(before);
    const restore = s.beginCameraCapture(2);
    s.clearInput();
    restore();
    expect(s.snapshot()).toEqual(before);
    expect(s.stepTicks(30).mechanism!.jointTargets.hinge).toMatchObject({
      current: -20,
      status: "complete",
      units: "LDU",
      speedUnits: "LDU/s",
    });
    s.setJointTarget(input(-20.25, 40));
    expect(s.stepTicks(1).mechanism!.pose.jointPositions.hinge).toBe(-20.25);
  } finally {
    s.dispose();
  }
});
it("stops animated real door colliders at the last accepted tick, preserves blocked status while idle, and retries after the actor clears", async () => {
  const source = await movingSource("door");
  const s = await PlaySession.create(
    source.geometry,
    { rigId: "door", position: [20, -0.3, 45] },
    source.mechanism,
  );
  try {
    s.setMechanismJoint("hinge", 90, "door");
    s.teleport({ position: [20, -0.3, 0] });
    s.setJointTarget(input(0));
    let previous = 90,
      blocked = s.snapshot();
    for (let i = 0; i < 60; i++) {
      blocked = s.stepTicks(1);
      if (blocked.mechanism!.jointTargets.hinge.status === "blocked") break;
      previous = blocked.mechanism!.pose.jointPositions.hinge;
    }
    expect(blocked.mechanism!.jointTargets.hinge.status).toBe("blocked");
    expect(previous).toBeLessThan(90);
    expect(previous).toBeGreaterThan(0);
    expect(blocked.mechanism!.pose.jointPositions.hinge).toBe(previous);
    expect(s.stepTicks(60).mechanism!.jointTargets.hinge).toEqual(
      blocked.mechanism!.jointTargets.hinge,
    );
    s.setMechanismJoint("hinge", 0, "door");
    expect(s.snapshot().mechanism!.jointTargets.hinge).toBeUndefined();
    expect(s.snapshot().mechanism!.pose.jointPositions.hinge).toBe(previous);
    s.teleport({ position: [200, -0.3, 45] });
    s.setJointTarget(input(0));
    expect(s.stepTicks(60).mechanism!.jointTargets.hinge).toMatchObject({
      current: 0,
      status: "complete",
    });
    expect(s.snapshot().mechanism!.blocked).toBe(false);
  } finally {
    s.dispose();
  }
});
it("keeps targets independent across simultaneous rigs and immediate positioning only cancels its addressed joint", async () => {
  const one = await movingSource("door"),
    two = await movingSource("vehicle");
  // The vehicle fixture has independent wheel roots; explicitly author a slider
  // between two otherwise unjointed groups for a second targetable test rig.
  const rig = two.mechanism.project.motionRigs.vehicle;
  delete rig.vehicle;
  rig.joints = [
    {
      id: "slide",
      kind: "prismatic",
      bodyA: rig.groups[0].id,
      bodyB: rig.groups[1].id,
      anchorA: [0, 0, 0],
      anchorB: rig.groups[0].frame.position.map(
        (x, i) => x - rig.groups[1].frame.position[i],
      ) as [number, number, number],
      // Lift this independent coordinate away from the included floor.
      axisA: [0, -1, 0],
      axisB: [0, -1, 0],
      limits: [0, 20],
    },
  ];
  const geometry = {
    ...one.geometry,
    vertices: new Float32Array(),
    indices: new Uint32Array(),
  };
  const s = await PlaySession.create(
    geometry,
    { rigIds: ["door", "vehicle"], position: [300, -0.3, 0] },
    [one.mechanism, two.mechanism],
  );
  try {
    expect(() =>
      s.setJointTarget({ jointId: "hinge", target: 90, speed: 90 }),
    ).toThrow("Specify rigId");
    s.setJointTarget(input(90));
    s.setJointTarget({
      rigId: "vehicle",
      jointId: "slide",
      target: 20,
      speed: 40,
    });
    s.stepTicks(10);
    s.setMechanismJoint("hinge", 3, "door");
    expect(s.snapshot().mechanisms!.door.jointTargets.hinge).toBeUndefined();
    const done = s.stepTicks(20);
    expect(done.mechanisms!.door.pose.jointPositions.hinge).toBe(3);
    expect(done.mechanisms!.vehicle.jointTargets.slide).toMatchObject({
      current: 20,
      status: "complete",
    });
  } finally {
    s.dispose();
  }
});

it("an immediate update cancels only the addressed target within the same rig", async () => {
  const source = await movingSource("door"),
    vehicle = await movingSource("vehicle");
  const rig = source.mechanism.project.motionRigs.door,
    extra = structuredClone(
      vehicle.mechanism.project.motionRigs.vehicle.groups[0],
    );
  delete source.mechanism.project.motionRigs.vehicle;
  rig.groups.push(extra);
  source.mechanism.groups[extra.id] = vehicle.mechanism.groups[extra.id];
  rig.joints.push({
    id: "slide",
    kind: "prismatic",
    bodyA: rig.groups[0].id,
    bodyB: extra.id,
    anchorA: [0, 0, 0],
    anchorB: rig.groups[0].frame.position.map(
      (x, i) => x - extra.frame.position[i],
    ) as [number, number, number],
    axisA: [1, 0, 0],
    axisB: [1, 0, 0],
    limits: [0, 20],
  });
  const s = await PlaySession.create(
    {
      ...source.geometry,
      vertices: new Float32Array(),
      indices: new Uint32Array(),
    },
    { rigId: "door", position: [300, -0.3, 0] },
    source.mechanism,
  );
  try {
    s.setJointTarget(input(90));
    s.setJointTarget({
      rigId: "door",
      jointId: "slide",
      target: 20,
      speed: 40,
    });
    s.stepTicks(10);
    const queued = s.snapshot().mechanism!.jointTargets.slide;
    s.setMechanismJoint("hinge", 45, "door");
    expect(s.snapshot().mechanism!.jointTargets.hinge).toBeUndefined();
    expect(s.snapshot().mechanism!.jointTargets.slide).toEqual(queued);
    expect(s.stepTicks(20).mechanism!.jointTargets.slide).toMatchObject({
      current: 20,
      status: "complete",
    });
  } finally {
    s.dispose();
  }
});
