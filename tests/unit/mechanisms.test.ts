import { describe, it, expect } from "vitest";
import { KinematicSession, validateRig } from "../../src/mechanisms/kinematic";
import { mechanismFixture } from "../../src/mechanisms/fixtures";
import { Editor } from "../../src/core/commands";
import { occurrences } from "../../src/core/document";
import { exportLDraw } from "../../src/ldraw/io";
import { encodeNative, decodeNative } from "../../src/persistence/native";
import { uid } from "../../src/core/types";
const command = (e: Editor, type: string, payload: Record<string, unknown>) =>
  e.dispatch({
    schemaVersion: 1,
    commandId: uid(),
    expectedRevision: e.project.revision,
    type,
    payload,
  });
describe("authored kinematic rigs", () => {
  it("turns the door around its declared hinge and leaves authored/exported rest unchanged", () => {
    const p = mechanismFixture(),
      rest = exportLDraw(p),
      s = new KinematicSession(p, "door"),
      door = p.motionRigs.door.groups[1].occurrenceIds[0];
    const report = s.setJointPosition("hinge", 90);
    expect(report.transforms[door].position[0]).toBeCloseTo(0);
    expect(report.transforms[door].position[1]).toBeCloseTo(-48);
    expect(report.transforms[door].position[2]).toBeCloseTo(-20);
    expect(exportLDraw(p)).toBe(rest);
    expect(() => s.setJointPosition("hinge", 120)).toThrow(/limits/);
  });
  it("steps a repeatable planar steering model with signed distance/radius wheel rotation", () => {
    const p = mechanismFixture(),
      a = new KinematicSession(p, "vehicle"),
      b = new KinematicSession(p, "vehicle");
    a.setVehicleInput({ throttle: 1, steering: 0 });
    b.setVehicleInput({ throttle: 1, steering: 0 });
    a.stepTicks(60);
    b.stepTicks(60);
    expect(a.snapshot()).toEqual(b.snapshot());
    expect(a.snapshot().pose.vehicle!.position[2]).toBeCloseTo(-100);
    expect(a.snapshot().pose.vehicle!.wheelAngles["left-front"]).toBeCloseTo(
      ((100 / 12) * 180) / Math.PI,
    );
    a.setVehicleInput({ throttle: 1, steering: 1 });
    a.stepTicks(60);
    expect(a.snapshot().pose.vehicle!.position[0]).toBeGreaterThan(20);
    expect(a.snapshot().pose.vehicle!.headingDegrees).toBeGreaterThan(0);
    const replay = new KinematicSession(p, "vehicle");
    replay.setPose(a.snapshot().pose);
    expect(replay.snapshot().transforms).toEqual(a.snapshot().transforms);
    expect(() => a.stepTicks(100000)).toThrow();
  });
  it("persists rig definitions natively and applies/rebases a posed snapshot as one undoable checked edit", async () => {
    const p = mechanismFixture(),
      e = new Editor(p),
      s = new KinematicSession(e.project, "door"),
      pose = s.setJointPosition("hinge", 90).pose;
    const rest = exportLDraw(e.project);
    expect(() =>
      command(e, "rigs.applyPose", { rigId: "door", sourceRevision: 9, pose }),
    ).toThrow(/older/);
    command(e, "rigs.applyPose", {
      rigId: "door",
      sourceRevision: e.project.revision,
      pose,
    });
    const after = e.project;
    expect(exportLDraw(after)).not.toBe(rest);
    expect(after.motionRigs.door.joints[0].limits).toEqual([-90, 20]);
    validateRig(after, after.motionRigs.door);
    const saved = await decodeNative(await encodeNative(after));
    expect(saved.motionRigs).toEqual(after.motionRigs);
    new KinematicSession(saved, "door");
    command(e, "history.undo", {});
    expect(exportLDraw(e.project)).toBe(rest);
    expect(e.project.motionRigs).toEqual(p.motionRigs);
  });
  it("validates joint families, units, cycles, missing members and locks before edits", () => {
    const p = mechanismFixture(),
      rig = structuredClone(p.motionRigs.door);
    rig.joints[0].kind = "spherical";
    expect(() => validateRig(p, rig)).toThrow(/scalar/);
    rig.joints[0].kind = "revolute";
    rig.joints[0].motor = {
      mode: "velocity",
      target: 20,
      maxEffort: { value: 2, unit: "N" },
    };
    expect(() => validateRig(p, rig)).toThrow(/unit/);
    delete rig.joints[0].motor;
    rig.joints.push({
      ...rig.joints[0],
      id: "cycle",
      bodyA: "door",
      bodyB: "frame",
      anchorA: [-20, 0, 0],
      anchorB: [0, -48, 0],
    });
    expect(() => validateRig(p, rig)).toThrow(/cycle/);
    const e = new Editor(p);
    command(e, "layers.update", {
      layerId: e.project.defaultLayerId,
      locked: true,
    });
    const snapshot = e.project;
    expect(() =>
      command(e, "rigs.applyPose", {
        rigId: "door",
        sourceRevision: snapshot.revision,
        pose: { jointPositions: { hinge: 45 } },
      }),
    ).toThrow(/Unlock/);
    expect(e.project).toEqual(snapshot);
  });
  it("implements prismatic LDU displacement and rejects stale rest geometry", () => {
    const p = mechanismFixture(),
      rig = p.motionRigs.door;
    rig.joints[0].kind = "prismatic";
    rig.joints[0].limits = [-20, 40];
    const session = new KinematicSession(p, "door"),
      id = rig.groups[1].occurrenceIds[0];
    expect(
      session.setJointPosition("hinge", 24).transforms[id].position[1],
    ).toBeCloseTo(-24);
    const e = new Editor(p);
    command(e, "parts.transform", { occurrenceIds: [id], delta: [20, 0, 0] });
    expect(() => new KinematicSession(e.project, "door")).toThrow(/rest pose/);
  });
});
it("rejects unsafe identifiers and restores state after a rejected compound pose", () => {
  const p = mechanismFixture(),
    s = new KinematicSession(p, "door"),
    before = s.snapshot();
  expect(() =>
    s.setPose({
      jointPositions: { hinge: 45 },
      vehicle: {
        position: [0, 0, 0],
        headingDegrees: 0,
        steeringDegrees: 0,
        wheelAngles: {},
      },
    }),
  ).toThrow();
  expect(s.snapshot()).toEqual(before);
  const bad = structuredClone(p.motionRigs.door);
  bad.id = "__proto__";
  expect(() => validateRig(p, bad)).toThrow();
});
