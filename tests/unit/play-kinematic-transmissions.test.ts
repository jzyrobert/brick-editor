import { describe, expect, it } from "vitest";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import { technicFixture } from "../../src/mechanisms/technic-fixture";
import { PlaySession } from "../../src/play/session";
import { playSources } from "../helpers/play-dynamic-source";

registerFullLibraryFromDisk();
async function fixture(outputLimits?: [number, number]) {
  const { project, proposal } = technicFixture();
  const rig = proposal.rig!;
  const { jointA: input, jointB: output } = rig.transmissions![0];
  if (outputLimits)
    rig.joints.find((j) => j.id === output)!.limits = outputLimits;
  const source = JSON.stringify(project);
  const { geometry, sources } = await playSources(
    project,
    [rig.id],
    fullLibrarySources(occurrences(project).map((o) => o.node.ref)),
  );
  const play = await PlaySession.create(
    geometry,
    { rigId: rig.id, position: [200, -0.3, 200] },
    sources[0],
  );
  const report = () => play.snapshot().mechanisms![rig.id];
  return {
    play,
    rig,
    input,
    output,
    report,
    unchanged: () => expect(JSON.stringify(project)).toBe(source),
  };
}
describe("kinematic Play spur drive", () => {
  it("keeps velocity phase past the former folding threshold and replaces a connected driver atomically", async () => {
    const { play, rig, input, output, report, unchanged } = await fixture();
    try {
      play.stepTicks(3000);
      expect(report().pose.jointPositions[input]).toBe(4500);
      expect(report().pose.jointPositions[output]).toBe(-1500);
      play.setJointTarget({
        rigId: rig.id,
        jointId: input,
        target: 765,
        speed: 360,
      });
      play.stepTicks(900);
      expect(report().pose.jointPositions[output]).toBe(-255);
      expect(report().jointTargets[input].status).toBe("complete");
      play.setJointTarget({
        rigId: rig.id,
        jointId: output,
        target: 270,
        speed: 180,
      });
      expect(report().jointTargets[input]).toBeUndefined();
      play.stepTicks(180);
      expect(report().pose.jointPositions[input]).toBe(-810);
      expect(report().motors![input].enabled).toBe(false);
      unchanged();
    } finally {
      play.dispose();
    }
  }, 15000);
  it("stops a velocity motor at a driven output's limit and validates manual targets without changing its state", async () => {
    const { play, rig, input, output, report, unchanged } = await fixture([
      -30, 60,
    ]);
    try {
      play.stepTicks(120);
      expect(report().pose.jointPositions[input]).toBe(90);
      expect(report().pose.jointPositions[output]).toBe(-30);
      expect(report().motors![input].status).toBe("at-limit");
      const before = play.snapshot();
      expect(() =>
        play.setJointTarget({
          rigId: rig.id,
          jointId: input,
          target: 91,
          speed: 90,
        }),
      ).toThrow(/limits/);
      expect(play.snapshot()).toEqual(before);
      unchanged();
    } finally {
      play.dispose();
    }
  });
});
