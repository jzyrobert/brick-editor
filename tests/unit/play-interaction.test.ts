import { expect, it } from "vitest";
import {
  nearbyInteraction,
  nearbyTrain,
  promptVisible,
  PROMPT_REACH,
  type PlayInteraction,
} from "../../src/play/interaction";
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
    // Mid-body (feet − height/2) level with the hinge anchor, 96 LDU away.
    position: [0, -60 + CHARACTER_PROFILE.height / 2, 96],
    profile: CHARACTER_PROFILE,
  } as unknown as PlaySnapshotReport;
  expect(nearbyInteraction(rig, report)).toMatchObject({
    available: true,
    target: -110,
  });
  report.position[2] = 96.01;
  expect(nearbyInteraction(rig, report)?.available).toBe(false);
  report.mechanism = {
    ...session.setJointPosition("hinge", -110),
    blocked: false,
    jointTargets: {},
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
      jointTargets: {},
    },
    position: [0, 0, 0],
    profile: CHARACTER_PROFILE,
  } as unknown as PlaySnapshotReport;
  expect(
    nearbyInteraction(project.motionRigs!.vehicle, report),
  ).toBeUndefined();
  rig.joints[0].limits = [0, 0];
  expect(nearbyInteraction(rig, report)).toBeUndefined();
});
it("reverses pending intent before midpoint and retains blocked retry direction", () => {
  const p = mechanismFixture(),
    rig = p.motionRigs!.door;
  const report = {
    mechanism: {
      ...new KinematicSession(p, rig.id).snapshot(),
      blocked: false,
      jointTargets: {
        hinge: {
          current: 15,
          target: 110,
          speed: 90,
          status: "moving",
          units: "degrees",
          speedUnits: "degrees/s",
        },
      },
    },
    position: [20, -0.3, 45],
    profile: CHARACTER_PROFILE,
  } as unknown as PlaySnapshotReport;
  report.mechanism!.pose.jointPositions.hinge = 15;
  expect(nearbyInteraction(rig, report)).toMatchObject({
    target: 0,
    label: "Close joint",
    progress: "Opening · 15.0° / 110.0°",
  });
  report.mechanism!.jointTargets.hinge = {
    current: 75,
    target: 0,
    speed: 90,
    status: "blocked",
    units: "degrees",
    speedUnits: "degrees/s",
    blockedReason: "Player blocks travel",
  };
  report.mechanism!.pose.jointPositions.hinge = 75;
  expect(nearbyInteraction(rig, report)).toMatchObject({
    target: 0,
    label: "Retry closing",
    blockedReason: "Player blocks travel",
  });
});
it("labels prismatic travel in LDU with a 40 LDU/s contextual default", () => {
  const p = mechanismFixture(),
    rig = p.motionRigs!.door;
  rig.joints[0].kind = "prismatic";
  rig.joints[0].limits = [0, 20];
  const report = {
    mechanism: {
      ...new KinematicSession(p, rig.id).snapshot(),
      blocked: false,
      jointTargets: {
        hinge: {
          current: 4,
          target: 20,
          speed: 40,
          status: "moving",
          units: "LDU",
          speedUnits: "LDU/s",
        },
      },
    },
    position: [20, -0.3, 45],
    profile: CHARACTER_PROFILE,
  } as unknown as PlaySnapshotReport;
  report.mechanism!.pose.jointPositions.hinge = 4;
  expect(nearbyInteraction(rig, report)).toMatchObject({
    target: 0,
    speed: 40,
    label: "Close joint",
    progress: "Opening · 4.0 LDU / 20.0 LDU",
  });
});
it("offers an action only in reach, or near with a reason why not", () => {
  const target = (patch: Partial<PlayInteraction>) =>
    ({
      kind: "vehicle",
      rigId: "car",
      label: "Drive vehicle",
      name: "Car",
      available: false,
      distance: 500,
      ...patch,
    }) as PlayInteraction;
  expect(promptVisible(undefined)).toBe(false);
  // Far away: nothing, not a greyed "move closer" prompt.
  expect(promptVisible(target({}))).toBe(false);
  expect(promptVisible(target({ blockedReason: "Blocked" }))).toBe(false);
  // Near but blocked: the reason is worth showing.
  expect(
    promptVisible(
      target({
        distance: PROMPT_REACH,
        blockedReason: "Driver seat access is obstructed",
      }),
    ),
  ).toBe(true);
  expect(promptVisible(target({ distance: 100 }))).toBe(false);
  expect(promptVisible(target({ available: true, distance: 90 }))).toBe(true);
});
it("offers Drive train beside the locomotive, not along the rest of the train", () => {
  // Feet on the ground (y = 0; LDraw up is −Y); the head pivot is on the
  // rail tops, running towards +X.
  const report = (position: number[]) =>
    ({
      position,
      profile: CHARACTER_PROFILE,
      trains: {
        trains: [
          {
            id: "train:1",
            name: "Train 1",
            position: [0, -16, 0],
            heading: [1, 0, 0],
          },
        ],
        switches: [],
      },
    }) as unknown as PlaySnapshotReport;
  expect(nearbyTrain(report([-200, 0, 110]))).toMatchObject({
    kind: "train",
    trainId: "train:1",
    label: "Drive train",
    available: true,
  });
  // Beyond the locomotive's length, beside the coaches: nothing offered.
  expect(nearbyTrain(report([-900, 0, 110]))).toBeUndefined();
  // Riding already: nothing to offer.
  const riding = report([-200, 0, 110]);
  riding.trains!.riding = "train:1";
  expect(nearbyTrain(riding)).toBeUndefined();
});
