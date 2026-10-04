import { afterEach, beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { loopFixture } from "../../src/mechanisms/loop-fixture";
import { axisRotation } from "../../src/mechanisms/kinematic";
import { add, mv } from "../../src/core/math";
import type { Transform } from "../../src/core/types";
import { DynamicRig } from "../../src/play/dynamics";
import { PlayMechanism } from "../../src/play/mechanism";
import { playSources } from "../helpers/play-dynamic-source";

beforeAll(async () => {
  await RAPIER.init();
});
const cleanup: Array<() => void> = [];
afterEach(() =>
  cleanup
    .splice(0)
    .reverse()
    .forEach((f) => f()),
);
async function fixture(
  kind: "four-bar" | "slider-crank",
  dynamic = true,
  pose?: Transform,
  limited = false,
) {
  const { project, rig: definition } = loopFixture(kind, pose),
    source = JSON.stringify(project),
    { sources } = await playSources(project, [kind]);
  if (limited) {
    definition.joints[1].limits = [-10, 10];
    definition.joints[2].limits = [-1, 1];
  }
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    mirror = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = 1 / 60;
  const rig = dynamic
    ? new DynamicRig(world, mirror, sources[0], 0, project.revision)
    : new PlayMechanism(world, sources[0], () => ({
        position: [1000, 0, 1000],
        walk: false,
      }));
  cleanup.push(() => {
    rig.dispose();
    world.free();
    mirror.free();
  });
  const step = (ticks: number) => {
    for (let n = 0; n < ticks; n++)
      if (rig instanceof DynamicRig) {
        rig.beforeStep();
        rig.stepPhysics();
        rig.afterStep();
      } else rig.step();
    return rig.snapshot();
  };
  const error = (frames: Record<string, Transform>) =>
    Math.max(
      ...definition.loopClosures!.map((c) => {
        const a = add(
            frames[c.bodyA].position,
            mv(frames[c.bodyA].basis, c.anchorA),
          ),
          b = add(
            frames[c.bodyB].position,
            mv(frames[c.bodyB].basis, c.anchorB),
          );
        return Math.hypot(...a.map((v, k) => v - b[k]));
      }),
    );
  return { project, definition, source, world, rig, step, error };
}
describe("closed linkage Play constraints", () => {
  for (const kind of ["four-bar", "slider-crank"] as const)
    for (const dynamic of [false, true])
      it(`${dynamic ? "native dynamic" : "kinematic swept"} ${kind} closes while one motor drives repeated turns`, async () => {
        const f = await fixture(kind, dynamic, {
          basis: axisRotation(
            [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)],
            73,
          ),
          position: [300, -200, 100],
        });
        for (let n = 0; n < 20; n++) {
          const report = f.step(60);

          expect(f.error(report.groupFrames)).toBeLessThan(
            dynamic ? 0.08 : 0.002,
          );
        }
        const report = f.rig.snapshot();
        expect(report.pose.jointPositions.drive).toBeGreaterThan(500);
        expect(report.transforms).not.toEqual(
          Object.fromEntries(
            f.definition.groups.flatMap((g) =>
              Object.entries(g.restTransforms),
            ),
          ),
        );
        expect(JSON.stringify(f.project)).toBe(f.source);
        if (dynamic) expect(f.world.impulseJoints.len()).toBe(4);
      }, 15000);
  for (const kind of ["four-bar", "slider-crank"] as const)
    it(`settles multi-turn ${kind} position targets and reverses while closure remains physical`, async () => {
      const f = await fixture(kind);
      f.rig.setJointTarget("drive", 720, 180);
      let report = f.step(900);
      expect(report.jointTargets.drive.status).toBe("complete");
      expect(report.pose.jointPositions.drive).toBeCloseTo(720, 0);
      expect(f.error(report.groupFrames)).toBeLessThan(0.1);
      f.rig.setJointTarget("drive", -360, 180);
      report = f.step(1200);
      expect(report.jointTargets.drive.status).toBe("complete");
      expect(report.pose.jointPositions.drive).toBeCloseTo(-360, 0);
      expect(f.error(report.groupFrames)).toBeLessThan(0.1);
    });
  it("native constraints transmit a blocked output back to the only motor and recover", async () => {
    const f = await fixture("four-bar");
    const body = f.world.bodies
      .getAll()
      .find(
        (b) =>
          b.userData &&
          (b.userData as { groupId?: string }).groupId === "output",
      );
    // Bodies are created in authored group order; fixing the rocker prevents the
    // four-bar from moving without dropping or breaking the closure constraint.
    const output = body ?? f.world.bodies.getAll()[3];
    output.setBodyType(RAPIER.RigidBodyType.Fixed, true);
    const blocked = f.step(300);
    expect(Math.abs(blocked.pose.jointPositions.drive)).toBeLessThan(5);
    expect(f.error(blocked.groupFrames)).toBeLessThan(0.1);
    output.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    const moving = f.step(300);
    expect(moving.pose.jointPositions.drive).toBeGreaterThan(100);
    expect(f.error(moving.groupFrames)).toBeLessThan(0.1);
  });
  it("reports a physically limited closure as blocked without dropping the loop", async () => {
    const f = await fixture("four-bar", true, undefined, true);
    f.rig.setJointTarget("drive", 45, 90);
    const report = f.step(600);
    expect(report.jointTargets.drive.status).toBe("blocked");
    expect(Math.abs(report.pose.jointPositions.rod)).toBeLessThanOrEqual(11);
    expect(Math.abs(report.pose.jointPositions.output)).toBeLessThanOrEqual(2);
    expect(f.error(report.groupFrames)).toBeLessThan(0.1);
    expect(f.world.impulseJoints.len()).toBe(4);
  });
  it("replays native linkage reports exactly and refuses passive target input", async () => {
    const a = await fixture("slider-crank"),
      b = await fixture("slider-crank");
    expect(() => a.rig.setJointTarget("rod", 20, 60)).toThrow(/passive/);
    expect(a.step(720)).toEqual(b.step(720));
  });
});
