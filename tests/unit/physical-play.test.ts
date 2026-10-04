import { beforeAll, expect, it } from "vitest";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import { importLDraw } from "../../src/ldraw/io";
import { physicalMotorFixture } from "../../src/mechanisms/motor-fixture";
import { mechanismFixture } from "../../src/mechanisms/fixtures";
import { gripperFixture } from "../../src/mechanisms/gripper-fixture";
import { proposeMechanicalRig } from "../../src/mechanisms/mechanical-proposals";
import {
  physicalPlayEligibility,
  requirePhysicalPlay,
} from "../../src/mechanisms/physical-play";
import { prepareMechanicalProposal } from "../../src/mechanisms/proposal-entry";

beforeAll(() => expect(registerFullLibraryFromDisk()).toBe(true));
const scene = () => {
  const f = physicalMotorFixture();
  return { ...f, rig: f.project.motionRigs["technic-drive"] };
};
it("admits a physically mounted source motor and a complete connected gearbox without editing source", () => {
  const { project, rig } = scene(),
    before = JSON.stringify(project);
  expect(physicalPlayEligibility(project, rig)).toEqual({ eligible: true });
  expect(JSON.stringify(project)).toBe(before);
});
it("admits hand movement of the same real, retained shafts without inventing power", () => {
  const { project, rig } = scene();
  for (const joint of rig.joints) delete joint.motor;
  expect(physicalPlayEligibility(project, rig)).toEqual({ eligible: true });
});
it("refuses torque metadata without hardware while preserving legacy definitions", () => {
  const { project, rig } = scene();
  delete rig.joints.find((j) => j.motor)!.motor!.binding;
  const before = JSON.stringify(project);
  expect(() => requirePhysicalPlay(project, rig)).toThrow(
    /supported motor part/,
  );
  expect(JSON.stringify(project)).toBe(before);
});
it("refuses enlarged mathematical contact exemptions and moved hinge axes", () => {
  for (const mutate of [
    (r: ReturnType<typeof scene>["rig"]) => {
      r.joints[1].mating!.radiusLdu += 10;
    },
    (r: ReturnType<typeof scene>["rig"]) => {
      r.joints[1].anchorA[0] += 10;
    },
  ]) {
    const { project, rig } = scene();
    mutate(rig);
    expect(physicalPlayEligibility(project, rig).eligible).toBe(false);
  }
});
it("refuses a synthetic door joint and proximity-based grab control in normal Play", () => {
  const door = mechanismFixture();
  expect(physicalPlayEligibility(door, door.motionRigs.door).eligible).toBe(
    false,
  );
  const { project: grips } = gripperFixture();
  const rig = Object.values(grips.motionRigs).find((r) => r.grippers?.length)!;
  expect(physicalPlayEligibility(grips, rig).reason).toMatch(/real jaws/);
});
it("preserves gravity and collision for individual loose source solids", () => {
  const { project, rig } = scene();
  rig.joints = [];
  delete rig.transmissions;
  rig.groups = [rig.groups[0]];
  rig.groups[0].occurrenceIds = rig.groups[0].occurrenceIds.slice(0, 1);
  expect(physicalPlayEligibility(project, rig)).toEqual({ eligible: true });
});
it("permits a reviewed real finger hinge and refuses a powered proposal without a motor", async () => {
  const project = importLDraw(
    [
      "1 7 0 0 0 1 0 0 0 1 0 0 0 1 4275b.dat",
      "1 4 60 0 0 -1 0 0 0 1 0 0 0 -1 4276b.dat",
      "1 14 60 -8 0 -1 0 0 0 1 0 0 0 -1 3023.dat",
    ].join("\n"),
  );
  const all = occurrences(project),
    request = {
      id: "real-hinge",
      name: "Real hinge",
      expectedRevision: project.revision,
      frameOccurrenceIds: [all[0].id],
    };
  const proposal = proposeMechanicalRig(project, request);
  expect(physicalPlayEligibility(project, proposal.rig!)).toEqual({
    eligible: true,
  });
  await expect(
    prepareMechanicalProposal(
      project,
      {
        ...request,
        motors: {
          [proposal.drivers[proposal.rig!.joints[0].id]]: {
            mode: "velocity",
            target: 60,
            maxEffort: { value: 10, unit: "N*m" },
          },
        },
      },
      () => true,
    ),
  ).rejects.toThrow(/real, mounted motor/);
});

it("admits reversed axis conventions with the matching physical gear relation", () => {
  const { project, rig } = scene();
  const joint = rig.joints[0];
  joint.axisA = joint.axisA!.map((x) => -x) as typeof joint.axisA;
  joint.axisB = joint.axisB!.map((x) => -x) as typeof joint.axisB;
  const relation = rig.transmissions![0];
  if (relation.kind === "spur")
    relation.axisSign = relation.axisSign === 1 ? -1 : 1;
  expect(physicalPlayEligibility(project, rig)).toEqual({ eligible: true });
});
it("refuses shifting a bearing contact exemption along an otherwise valid shaft line", () => {
  const { project, rig } = scene();
  rig.joints[1].anchorA[2] += 10;
  expect(physicalPlayEligibility(project, rig).eligible).toBe(false);
});
