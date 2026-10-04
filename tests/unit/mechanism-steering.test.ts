import { afterEach, beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { readFileSync } from "node:fs";
import { decodeNative, encodeNative } from "../../src/persistence/native";
import { steeringFixture } from "../../src/mechanisms/steering-fixture";
import {
  axisRotation,
  KinematicSession,
  validateRig,
} from "../../src/mechanisms/kinematic";
import { closureResidual } from "../../src/mechanisms/loops";
import { add, compose, identity, mv } from "../../src/core/math";
import { exportLDraw } from "../../src/ldraw/io";
import { DynamicRig } from "../../src/play/dynamics";
import { PlayMechanism } from "../../src/play/mechanism";
import { frameRotation, toPhysics } from "../../src/play/physics-frame";
import { playSources } from "../helpers/play-dynamic-source";
import type { Transform } from "../../src/core/types";

const pose = {
  basis: axisRotation(
    [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)],
    73,
  ),
  position: [300, -200, 100] as [number, number, number],
};
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
function closureError(
  f: { definition: ReturnType<typeof steeringFixture>["rig"] },
  frames: Record<string, Transform>,
) {
  return Math.max(
    ...f.definition.loopClosures!.map((c) => {
      const a = add(
          frames[c.bodyA].position,
          mv(frames[c.bodyA].basis, c.anchorA),
        ),
        b = add(frames[c.bodyB].position, mv(frames[c.bodyB].basis, c.anchorB));
      return Math.hypot(...a.map((x, k) => x - b[k]));
    }),
  );
}
async function play(dynamic: boolean, outputMassKg = 1, effortNm = 100) {
  const f = steeringFixture(pose);
  for (const id of ["leftSteer", "rightSteer"])
    f.rig.dynamics!.groups![id].massKg = outputMassKg;
  f.rig.joints[0].motor!.maxEffort.value = effortNm;
  const source = JSON.stringify(f.project),
    rest = exportLDraw(f.project),
    { sources } = await playSources(f.project, [f.rig.id]);
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    mirror = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = 1 / 60;
  const rig = dynamic
    ? new DynamicRig(world, mirror, sources[0], 0, f.project.revision)
    : new PlayMechanism(world, sources[0], () => ({
        position: [1000, 0, 1000],
        walk: false,
      }));
  cleanup.push(() => {
    rig.dispose();
    world.free();
    mirror.free();
  });
  let maxClosureError = 0;
  const step = (n: number) => {
    for (let i = 0; i < n; i++) {
      if (rig instanceof DynamicRig) {
        rig.beforeStep();
        rig.stepPhysics();
        rig.afterStep();
      } else rig.step();
      maxClosureError = Math.max(
        maxClosureError,
        closureError({ definition: f.rig }, rig.snapshot().groupFrames),
      );
    }
    return rig.snapshot();
  };
  return {
    ...f,
    definition: f.rig,
    source,
    rest,
    world,
    rig,
    step,
    errorMax: () => maxClosureError,
  };
}
describe("twin-loop steering acceptance", () => {
  it("keeps the original source fixture and explicit two-loop data intact through native persistence", async () => {
    const f = steeringFixture();
    expect(
      readFileSync(
        new URL("../../fixtures/ldraw/steering-linkage.mpd", import.meta.url),
        "utf8",
      ),
    ).toBe(f.text);
    const restored = await decodeNative(await encodeNative(f.project));
    expect(restored.motionRigs).toEqual(f.project.motionRigs);
    expect(exportLDraw(restored)).toBe(exportLDraw(f.project));
    validateRig(restored, restored.motionRigs.steering);
  });
  it("steers both separate wheel outputs with bounded closure over repeated reversals in rotated frames", () => {
    const f = steeringFixture(pose),
      source = JSON.stringify(f.project),
      rest = exportLDraw(f.project),
      s = new KinematicSession(f.project, f.rig.id),
      replay = new KinematicSession(f.project, f.rig.id);
    expect(f.rig.groups).toHaveLength(6);
    expect(f.rig.loopClosures).toHaveLength(2);
    expect(
      f.rig.groups.find((g) => g.id === "leftSteer")!.occurrenceIds,
    ).toHaveLength(2);
    for (let n = 0; n < 8; n++)
      for (const target of [25, -25, 0]) {
        const report = s.setJointPosition("drive", target);
        expect(
          Math.max(
            ...closureResidual(f.rig, report.pose.jointPositions).map(Math.abs),
          ),
        ).toBeLessThan(0.001);
        expect(report.pose.jointPositions.drive).toBe(target);
        if (target !== 0) {
          expect(Math.sign(report.pose.jointPositions.leftSteer)).toBe(
            Math.sign(target),
          );
          expect(Math.sign(report.pose.jointPositions.rightSteer)).toBe(
            Math.sign(target),
          );
          expect(
            Math.abs(
              report.pose.jointPositions.leftSteer -
                report.pose.jointPositions.rightSteer,
            ),
          ).toBeGreaterThan(5);
        }
        replay.setJointPosition("drive", target);
      }
    expect(s.snapshot()).toEqual(replay.snapshot());
    expect(JSON.stringify(f.project)).toBe(source);
    expect(exportLDraw(f.project)).toBe(rest);
  }, 15000);
  it("refuses cold steering toggles and passive controls, retains stops and fails unreachable poses atomically", () => {
    const f = steeringFixture(undefined, true),
      s = new KinematicSession(f.project, f.rig.id),
      before = s.snapshot();
    expect(() => s.setJointPosition("drive", 1)).toThrow(
      /ambiguous dead center/,
    );
    expect(s.snapshot()).toEqual(before);
    const normal = steeringFixture(),
      limited = new KinematicSession(normal.project, normal.rig.id);
    expect(() => limited.setJointPosition("leftSteer", 1)).toThrow(/passive/);
    expect(() => limited.setJointPosition("drive", 90)).toThrow(
      /outside authored limits/,
    );
    normal.rig.joints.find((j) => j.id === "leftSteer")!.limits = [-1, 1];
    const tight = new KinematicSession(normal.project, normal.rig.id),
      prior = tight.snapshot();
    expect(() => tight.setJointPosition("drive", 25)).toThrow(/cannot close/);
    expect(tight.snapshot()).toEqual(prior);
    const malformed = structuredClone(normal.rig);
    malformed.loopClosures![1].axisB = [1, 0, 0];
    expect(() => validateRig(normal.project, malformed)).toThrow(/planar/);
  });
  for (const dynamic of [false, true])
    it(`${dynamic ? "native" : "swept"} motor steering closes both loops, reverses and preserves source`, async () => {
      const f = await play(dynamic);
      for (const target of [25, -25, 25, -25, 0]) {
        f.rig.setJointTarget("drive", target, 60);
        const report = f.step(600);
        expect(report.jointTargets.drive.status).toBe("complete");
        expect(report.pose.jointPositions.drive).toBeCloseTo(target, 0);
        expect(closureError(f, report.groupFrames)).toBeLessThan(
          dynamic ? 0.1 : 0.002,
        );
        for (const id of ["leftTie", "rightTie", "leftSteer", "rightSteer"])
          expect(Math.abs(report.pose.jointPositions[id])).toBeLessThan(50.1);
      }
      expect(() => f.rig.setJointTarget("rightSteer", 10, 60)).toThrow(
        /passive/,
      );
      expect(JSON.stringify(f.project)).toBe(f.source);
      expect(exportLDraw(f.project)).toBe(f.rest);
      expect(f.errorMax()).toBeLessThan(dynamic ? 0.1 : 0.002);
      if (dynamic) expect(f.world.impulseJoints.len()).toBe(7);
    }, 30000);
  it("a native wheel obstruction stalls the sole motor through both tie rods and recovers on release", async () => {
    const f = await play(true),
      bodies = f.world.bodies.getAll(),
      output =
        bodies[f.definition.groups.findIndex((g) => g.id === "leftSteer")];
    output.setBodyType(RAPIER.RigidBodyType.Fixed, true);
    f.rig.setJointTarget("drive", 25, 60);
    const blocked = f.step(600);
    expect(blocked.jointTargets.drive.status).toBe("blocked");
    expect(Math.abs(blocked.pose.jointPositions.drive)).toBeLessThan(1);
    expect(closureError(f, blocked.groupFrames)).toBeLessThan(0.1);
    output.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    const moved = f.step(600);
    expect(moved.jointTargets.drive.status).toBe("complete");
    expect(moved.pose.jointPositions.drive).toBeCloseTo(25, 0);
    expect(closureError(f, moved.groupFrames)).toBeLessThan(0.1);
    expect(moved.pose.jointPositions.rightSteer).toBeGreaterThan(1);
  }, 15000);
  it("reflected wheel inertia slows the effort-limited native input and still settles", async () => {
    const light = await play(true, 1, 2),
      loaded = await play(true, 40, 2);
    for (const f of [light, loaded]) f.rig.setJointTarget("drive", 25, 60);
    const a = light.step(20),
      b = loaded.step(20);
    expect(b.pose.jointPositions.drive).toBeGreaterThan(0);
    expect(b.pose.jointPositions.drive).toBeLessThan(
      a.pose.jointPositions.drive * 0.8,
    );
    expect(closureError(loaded, b.groupFrames)).toBeLessThan(0.1);
    const settled = loaded.step(1000);
    expect(settled.jointTargets.drive.status).toBe("complete");
    expect(settled.pose.jointPositions.drive).toBeCloseTo(25, 0);
    expect(closureError(loaded, settled.groupFrames)).toBeLessThan(0.1);
    expect(loaded.errorMax()).toBeLessThan(0.1);
    expect(JSON.stringify(loaded.project)).toBe(loaded.source);
  }, 15000);
  for (const [effortNm, toleranceLdu] of [
    [10, 0.1],
    [100, 0.2],
  ] as const)
    it(`native world contact at a wheel blocks ${effortNm} N·m steering and releases safely`, async () => {
      const f = await play(true, 1, effortNm),
        frame = compose(pose, { ...identity(), position: [-113.5, -102, 12] });
      const p = toPhysics(frame.position),
        obstacle = f.world.createCollider(
          RAPIER.ColliderDesc.cuboid(0.04, 0.28, 0.16)
            .setTranslation(p.x, p.y, p.z)
            .setRotation(frameRotation(frame))
            .setCollisionGroups(0x0001ffff),
        );
      f.rig.setJointTarget("drive", 25, 60);
      const blocked = f.step(600);
      expect(blocked.jointTargets.drive.status).toBe("blocked");
      expect(blocked.pose.jointPositions.drive).toBeGreaterThan(5);
      expect(blocked.pose.jointPositions.drive).toBeLessThan(24);
      expect(f.errorMax()).toBeLessThan(toleranceLdu);
      f.world.removeCollider(obstacle, true);
      const released = f.step(600);
      expect(released.jointTargets.drive.status).toBe("complete");
      expect(released.pose.jointPositions.drive).toBeCloseTo(25, 0);
      expect(f.errorMax()).toBeLessThan(toleranceLdu);
      expect(JSON.stringify(f.project)).toBe(f.source);
    }, 15000);
});
