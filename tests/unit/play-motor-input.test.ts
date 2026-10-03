import { describe, expect, it } from "vitest";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import { technicFixture } from "../../src/mechanisms/technic-fixture";
import { PlaySession } from "../../src/play/session";
import { playSources } from "../helpers/play-dynamic-source";
import { validate } from "../../src/core/validate";
registerFullLibraryFromDisk();
async function fixture(dynamic: boolean, position = false) {
  const { project, proposal } = technicFixture();
  const rig = proposal.rig!,
    joint = rig.joints[0];
  if (position)
    joint.motor = { ...joint.motor!, mode: "position", target: 720 };
  const original = JSON.stringify(project);
  const { geometry, sources } = await playSources(
    project,
    [rig.id],
    fullLibrarySources(occurrences(project).map((o) => o.node.ref)),
  );
  const play = await PlaySession.create(
    geometry,
    {
      rigIds: [rig.id],
      ...(dynamic ? { dynamicRigIds: [rig.id] } : {}),
      position: [200, -0.3, 200],
    },
    sources,
  );
  const motor = (input?: number, enabled = true) =>
    play.setMotor({
      rigId: rig.id,
      jointId: joint.id,
      enabled,
      ...(input !== undefined ? { input } : {}),
    });
  const report = () => play.snapshot().mechanisms![rig.id];
  return {
    play,
    rig,
    joint,
    motor,
    report,
    unchanged: () => expect(JSON.stringify(project)).toBe(original),
  };
}
for (const dynamic of [false, true])
  describe(`${dynamic ? "dynamic" : "kinematic"} live motor input`, () => {
    it("reverses at proportional speed, brakes on release and restores authored presets without changing source", async () => {
      const { play, rig, joint, motor, report, unchanged } =
        await fixture(dynamic);
      try {
        motor(0.5);
        play.stepTicks(180);
        const forward = report().pose.jointPositions[joint.id];
        expect(forward).toBeGreaterThan(80);
        expect(report().motors![joint.id]).toMatchObject({
          input: 0.5,
          mode: "velocity",
          target: 45,
          enabled: true,
        });
        validate("playSnapshot", play.snapshot());
        motor(-1);
        play.stepTicks(180);
        expect(report().pose.jointPositions[joint.id]).toBeLessThan(
          forward - 150,
        );
        play.clearInput();
        play.stepTicks(60);
        const stopped = report().pose.jointPositions[joint.id];
        expect(report().motors![joint.id]).toMatchObject({
          input: 0,
          target: 0,
          status: "holding",
        });
        play.stepTicks(60);
        expect(report().pose.jointPositions[joint.id]).toBeCloseTo(stopped, 0);
        motor();
        expect(report().motors![joint.id].input).toBeUndefined();
        expect(report().motors![joint.id].target).toBe(90);
        play.stepTicks(120);
        expect(report().pose.jointPositions[joint.id]).toBeGreaterThan(
          stopped + 90,
        );
        unchanged();
      } finally {
        play.dispose();
      }
    });
    it("temporarily drives a position motor, replaces connected travel and validates requests atomically", async () => {
      const { play, rig, joint, motor, report, unchanged } = await fixture(
        dynamic,
        true,
      );
      try {
        const output = rig.transmissions![0].jointB;
        play.setJointTarget({
          rigId: rig.id,
          jointId: output,
          target: 60,
          speed: 45,
        });
        motor(-0.5);
        expect(report().jointTargets[output]).toBeUndefined();
        play.stepTicks(90);
        expect(report().pose.jointPositions[joint.id]).toBeLessThan(-30);
        const before = play.snapshot();
        for (const [input, enabled] of [
          [1.01, true],
          [NaN, true],
          [1, false],
        ] as const)
          expect(() => motor(input, enabled)).toThrow(/input/i);
        expect(play.snapshot()).toEqual(before);
        motor();
        expect(report().motors![joint.id]).toMatchObject({
          mode: "position",
          target: 720,
        });
        unchanged();
      } finally {
        play.dispose();
      }
    });
  });
