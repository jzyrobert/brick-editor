import { afterEach, beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { loopFixture } from "../../src/mechanisms/loop-fixture";
import { KinematicSession, validateRig } from "../../src/mechanisms/kinematic";
import type { ForceLink, MotionRig } from "../../src/mechanisms/types";
import { DynamicRig } from "../../src/play/dynamics";
import { playSources } from "../helpers/play-dynamic-source";
import { decodeNative, encodeNative } from "../../src/persistence/native";
import { rigAuthoringRequest } from "../../src/mechanisms/authoring";
import { add, inverse, mv } from "../../src/core/math";
import type { Vec3 } from "../../src/core/types";

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
const spring: ForceLink = {
  id: "spring",
  kind: "spring",
  bodyA: "frame",
  bodyB: "input",
  anchorA: [0, -20, 0],
  anchorB: [0, 0, 0],
  restLengthLdu: 20,
  stiffnessNewtonsPerMetre: 100,
  dampingNewtonsSecondsPerMetre: 10,
};
async function fixture(
  link?: ForceLink,
  resistance?: MotionRig["joints"][number]["angularResistance"] | false,
  gravity = true,
  guide = false,
) {
  const { project, rig: definition } = loopFixture();
  definition.groups = definition.groups.slice(0, 2);
  // Keep the authored support clear of the loaded beam throughout travel.
  // The attachment spans this gap; it does not remove physical contacts.
  const [frame, load] = definition.groups;
  frame.frame.position[2] = load.frame.position[2] - 40;
  const frameId = frame.occurrenceIds[0];
  frame.restTransforms[frameId] = structuredClone(frame.frame);
  project.models[project.rootModelId].nodes[0].transform = structuredClone(
    frame.frame,
  );
  const mount = mv(
    inverse(frame.frame).basis,
    load.frame.position.map((v, k) => v - frame.frame.position[k]) as Vec3,
  );
  const installedLink = link
    ? { ...structuredClone(link), anchorA: add(mount, link.anchorA) }
    : undefined;
  definition.joints = [];
  delete definition.loopClosures;
  definition.forceLinks = installedLink ? [installedLink] : [];
  definition.dynamics = {
    groups: {
      frame: { anchored: true },
      input: { massKg: 1, anchored: false },
    },
  };
  if (resistance !== undefined)
    definition.joints = [
      {
        id: "ball",
        kind: "spherical",
        bodyA: "frame",
        bodyB: "input",
        anchorA: mount,
        anchorB: [0, 0, 0],
        ...(resistance ? { angularResistance: resistance } : {}),
      },
    ];
  if (guide)
    definition.joints = [
      {
        id: "guide",
        kind: "prismatic",
        bodyA: "frame",
        bodyB: "input",
        anchorA: mount,
        anchorB: [0, 0, 0],
        axisA: [0, 1, 0],
        axisB: [0, 1, 0],
        limits: [0, 2],
      },
    ];
  validateRig(project, definition);
  const source = JSON.stringify(project),
    { sources } = await playSources(project, [definition.id]);
  const world = new RAPIER.World({ x: 0, y: gravity ? -9.81 : 0, z: 0 }),
    mirror = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    rig = new DynamicRig(world, mirror, sources[0], 0, project.revision);
  world.timestep = 1 / 60;
  const body = world.bodies.getAll()[1];
  if (link) body.setEnabledRotations(false, false, false, true);
  cleanup.push(() => {
    rig.dispose();
    world.free();
    mirror.free();
  });
  const step = (ticks: number) => {
    for (let n = 0; n < ticks; n++) {
      rig.beforeStep();
      rig.stepPhysics();
      rig.afterStep();
    }
    return rig.snapshot();
  };
  const length = () => {
    const frames = rig.snapshot().groupFrames;
    if (!installedLink) return 0;
    const a = add(
        frames[installedLink.bodyA].position,
        mv(frames[installedLink.bodyA].basis, installedLink.anchorA),
      ),
      b = add(
        frames[installedLink.bodyB].position,
        mv(frames[installedLink.bodyB].basis, installedLink.anchorB),
      );
    return Math.hypot(...a.map((v, k) => v - b[k]));
  };
  return { project, definition, source, world, rig, body, step, length, mount };
}
describe("authored force links and ball resistance", () => {
  it("holds a kilogram on a spring at its physical loaded extension and damps motion", async () => {
    const f = await fixture(spring);
    f.step(600);
    // Rapier's fixed-tick solver and sleep threshold leave <0.1 LDU
    // (2 mm at gameplay scale) equilibrium error for this 1 kg / 100 N/m load.
    expect(Math.abs(f.length() - (20 + 9.81 / 100 / 0.02))).toBeLessThan(0.1);
    expect(
      f.rig.snapshot().dynamics!.bodies.input.linearVelocity[1],
    ).toBeCloseTo(0, 1);
    expect(f.world.impulseJoints.len()).toBe(1);
    expect(JSON.stringify(f.project)).toBe(f.source);
    const preview = new KinematicSession(f.project, f.definition.id).snapshot();
    expect(preview.warnings.join(" ")).toMatch(/Dynamic Play/);
    expect(preview.groupFrames.input).toEqual(f.definition.groups[1].frame);
  });
  it("keeps a guided spring within its authored travel stops", async () => {
    const f = await fixture(spring, undefined, true, true);
    const report = f.step(600);
    expect(report.pose.jointPositions.guide).toBeGreaterThan(1.9);
    expect(report.pose.jointPositions.guide).toBeLessThan(2.1);
    expect(f.length()).toBeLessThan(22.1);
    expect(f.world.impulseJoints.len()).toBe(2);
  });
  it("damps an impulse-driven spring rather than only freezing a rest preview", async () => {
    const damped = await fixture(spring, undefined, false),
      undamped = await fixture(
        { ...spring, dampingNewtonsSecondsPerMetre: 0 },
        undefined,
        false,
      );
    damped.body.applyImpulse({ x: 0, y: -1, z: 0 }, true);
    undamped.body.applyImpulse({ x: 0, y: -1, z: 0 }, true);
    let peakDamped = 0,
      peakUndamped = 0;
    for (let tick = 0; tick < 180; tick++) {
      damped.step(1);
      undamped.step(1);
      if (tick > 120) {
        peakDamped = Math.max(peakDamped, Math.abs(damped.length() - 20));
        peakUndamped = Math.max(peakUndamped, Math.abs(undamped.length() - 20));
      }
    }
    expect(peakDamped).toBeLessThan(0.1);
    expect(peakUndamped).toBeGreaterThan(1);
  });
  it("keeps a rope slack initially, catches a falling mass at its maximum length and allows it to shorten", async () => {
    const rope: ForceLink = {
      id: "rope",
      kind: "rope",
      bodyA: "frame",
      bodyB: "input",
      anchorA: [0, -20, 0],
      anchorB: [0, 0, 0],
      maxLengthLdu: 30,
    };
    const f = await fixture(rope);
    expect(f.length()).toBeCloseTo(20);
    f.step(3);
    expect(f.length()).toBeGreaterThan(20);
    expect(f.length()).toBeLessThan(30);
    f.step(300);
    expect(f.length()).toBeCloseTo(30, 1);
    f.body.applyImpulse({ x: 0, y: 1, z: 0 }, true);
    f.step(5);
    expect(f.length()).toBeLessThan(29);
    expect(JSON.stringify(f.project)).toBe(f.source);
  });
  it("uses the public spherical wrapper to oppose rotation while the unresisted ball stays free", async () => {
    const free = await fixture(undefined, false, false),
      resisted = await fixture(
        undefined,
        { maxTorqueNm: 5, dampingNmSeconds: 10 },
        false,
      );
    expect(free.world.impulseJoints.getAll()[0].type()).toBe(
      RAPIER.JointType.Generic,
    );
    free.body.applyTorqueImpulse({ x: 0, y: 0, z: 1 }, true);
    resisted.body.applyTorqueImpulse({ x: 0, y: 0, z: 1 }, true);
    const a = free.step(120),
      b = resisted.step(120);
    expect(a.dynamics!.bodies.input.angularSpeed).toBeGreaterThan(20);
    expect(b.dynamics!.bodies.input.angularSpeed).toBeLessThan(1);
    expect(b.transforms).not.toEqual(a.transforms);
    expect(JSON.stringify(resisted.project)).toBe(resisted.source);
  });
  it("refuses authoring forms that would discard force links or angular resistance", async () => {
    const f = await fixture(spring);
    f.definition.joints = [
      {
        id: "guide",
        kind: "prismatic",
        bodyA: "frame",
        bodyB: "input",
        anchorA: f.mount,
        anchorB: [0, 0, 0],
        axisA: [0, 1, 0],
        axisB: [0, 1, 0],
        limits: [0, 20],
      },
    ];
    expect(() => rigAuthoringRequest(f.project, f.definition.id)).toThrow(
      /without losing authored data/,
    );
    const ball = await fixture(undefined, {
      maxTorqueNm: 5,
      dampingNmSeconds: 10,
    });
    expect(() => rigAuthoringRequest(ball.project, ball.definition.id)).toThrow(
      /without losing authored data/,
    );
  });
  it("validates force units/length bounds and preserves definitions through native persistence", async () => {
    const f = await fixture(spring),
      saved = await decodeNative(await encodeNative(f.project));
    expect(saved.motionRigs).toEqual(f.project.motionRigs);
    const reject = (edit: (r: MotionRig) => void, pattern: RegExp) => {
      const rig = structuredClone(f.definition);
      edit(rig);
      expect(() => validateRig(f.project, rig)).toThrow(pattern);
    };
    reject((r) => {
      r.forceLinks = [{ ...spring, stiffnessNewtonsPerMetre: -1 }];
    }, /Spring/);
    reject((r) => {
      r.forceLinks = [
        {
          id: "short",
          kind: "rope",
          bodyA: "frame",
          bodyB: "input",
          anchorA: [0, -20, 0],
          anchorB: [0, 0, 0],
          maxLengthLdu: 10,
        },
      ];
    }, /exceed/);
    reject((r) => {
      r.forceLinks = Array.from({ length: 33 }, (_, i) => ({
        ...spring,
        id: `spring${i}`,
      }));
    }, /32/);
    reject((r) => {
      r.forceLinks = [spring, { ...spring }];
    }, /unique/);
    reject((r) => {
      r.joints = [
        {
          id: "ball",
          kind: "spherical",
          bodyA: "frame",
          bodyB: "input",
          anchorA: [0, 0, 0],
          anchorB: [0, 0, 0],
          angularResistance: { maxTorqueNm: -1, dampingNmSeconds: 10 },
        },
      ];
    }, /Angular/);
  });
});
