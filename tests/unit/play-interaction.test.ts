import { expect, it } from "vitest";
import { nearbyInteraction } from "../../src/play/interaction";
import { mechanismFixture } from "../../src/mechanisms/fixtures";
import { KinematicSession } from "../../src/mechanisms/kinematic";
import { CHARACTER_PROFILE } from "../../src/play/types";
import type { PlaySnapshotReport } from "../../src/play/types";

it("toggles asymmetric negative joint limits and measures reach in world coordinates", () => {
  const project = mechanismFixture(),
    rig = project.motionRigs!.door;
  rig.joints[0].limits = [-110, 10];
  const session = new KinematicSession(project, rig.id);
  const report = {
    mechanism: { ...session.snapshot(), blocked: false },
    position: [0, -12, 96],
    profile: CHARACTER_PROFILE,
  } as PlaySnapshotReport;
  expect(nearbyInteraction(rig, report)).toMatchObject({
    available: true,
    target: -110,
  });
  report.position[2] = 96.01;
  expect(nearbyInteraction(rig, report)?.available).toBe(false);
  report.mechanism = {
    ...session.setJointPosition("hinge", -110),
    blocked: false,
  };
  expect(nearbyInteraction(rig, report)).toMatchObject({
    target: 0,
    label: "Close joint",
  });
});
it("does not offer interaction for another rig or a zero-travel joint", () => {
  const project = mechanismFixture(),
    rig = project.motionRigs!.door;
  const report = {
    mechanism: {
      ...new KinematicSession(project, rig.id).snapshot(),
      blocked: false,
    },
    position: [0, 0, 0],
    profile: CHARACTER_PROFILE,
  } as PlaySnapshotReport;
  expect(
    nearbyInteraction(project.motionRigs!.vehicle, report),
  ).toBeUndefined();
  rig.joints[0].limits = [0, 0];
  expect(nearbyInteraction(rig, report)).toBeUndefined();
});
