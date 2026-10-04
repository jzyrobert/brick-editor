import { afterEach, beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { loopFixture } from "../../src/mechanisms/loop-fixture";
import { DynamicRig } from "../../src/play/dynamics";
import { playSources } from "../helpers/play-dynamic-source";
import { axisRotation } from "../../src/mechanisms/kinematic";
import type { Transform, Vec3 } from "../../src/core/types";
import { add, compose, inverse, mv } from "../../src/core/math";

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
  options: {
    effort?: number;
    authored?: boolean;
    pose?: Transform;
    spring?: boolean;
    velocity?: number;
    gravity?: boolean;
  } = {},
) {
  const { project, rig: definition } = loopFixture();
  definition.groups = definition.groups.slice(0, 2);
  // Scalar load tests use a clear support behind the beam. Its real authored
  // attachment spans the gap, and the obstacle test still creates a solid stop.
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
  delete definition.loopClosures;
  definition.dynamics = {
    groups: { frame: { anchored: true }, input: { massKg: 1 } },
  };
  definition.joints = [
    {
      id: "slide",
      kind: "prismatic",
      bodyA: "frame",
      bodyB: "input",
      anchorA: mount,
      anchorB: [0, 0, 0],
      axisA: [0, 1, 0],
      axisB: [0, 1, 0],
      limits: [-50, 50],
      motor: {
        mode: options.velocity === undefined ? "position" : "velocity",
        target: options.velocity ?? (options.authored ? 10 : 0),
        maxEffort: { value: options.effort ?? 500, unit: "N" },
      },
    },
  ];
  if (options.spring)
    definition.forceLinks = [
      {
        id: "spring",
        kind: "spring",
        bodyA: "frame",
        bodyB: "input",
        anchorA: add(mount, [0, -20, 0]),
        anchorB: [0, 0, 0],
        restLengthLdu: 20,
        stiffnessNewtonsPerMetre: 100,
        dampingNewtonsSecondsPerMetre: 10,
      },
    ];
  if (options.pose) {
    for (const node of project.models[project.rootModelId].nodes)
      node.transform = compose(options.pose, node.transform);
    for (const g of definition.groups) {
      g.frame = compose(options.pose, g.frame);
      for (const id of g.occurrenceIds)
        g.restTransforms[id] = compose(options.pose, g.restTransforms[id]);
    }
  }
  const source = JSON.stringify(project),
    { sources } = await playSources(project, [definition.id]);
  const world = new RAPIER.World({
      x: 0,
      y: options.gravity === false ? 0 : -9.81,
      z: 0,
    }),
    mirror = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    rig = new DynamicRig(world, mirror, sources[0], 0, project.revision);
  world.timestep = 1 / 60;
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
  return { project, source, definition, world, rig, step };
}
describe("loaded linear position control", () => {
  it("reaches and holds the vertical 10 LDU target that formerly stalled 2.369 LDU away", async () => {
    const f = await fixture();
    f.rig.setJointTarget("slide", 10, 40);
    let report = f.step(900);
    expect(report.jointTargets.slide.status).toBe("complete");
    expect(report.pose.jointPositions.slide).toBeCloseTo(10, 1);
    report = f.step(300);
    expect(report.pose.jointPositions.slide).toBeCloseTo(10, 1);
    expect(JSON.stringify(f.project)).toBe(f.source);
  });
  it("holds an authored position motor against a guided spring load", async () => {
    const f = await fixture({ authored: true, spring: true });
    const report = f.step(600);
    expect(report.motors!.slide.status).toBe("holding");
    expect(report.pose.jointPositions.slide).toBeCloseTo(10, 1);
    expect(JSON.stringify(f.project)).toBe(f.source);
  });
  it("retains a slow requested linear rate and settles after reversal", async () => {
    const f = await fixture();
    f.rig.setJointTarget("slide", 10, 2);
    let previous = 0,
      peak = 0;
    for (let n = 0; n < 600; n++) {
      const position = f.step(1).pose.jointPositions.slide;
      peak = Math.max(peak, Math.abs(position - previous) * 60);
      previous = position;
    }
    expect(peak).toBeLessThan(2.2);
    expect(f.rig.snapshot().jointTargets.slide.status).toBe("complete");
    expect(previous).toBeCloseTo(10, 1);
    f.rig.setJointTarget("slide", -20, 5);
    const reversed = f.step(600);
    expect(reversed.jointTargets.slide.status).toBe("complete");
    expect(reversed.pose.jointPositions.slide).toBeCloseTo(-20, 1);
  });
  it("keeps an authored low-rate motor awake instead of sleeping mid-motion", async () => {
    const f = await fixture({ velocity: 0.2, gravity: false });
    const report = f.step(600);
    expect(report.pose.jointPositions.slide).toBeGreaterThan(1.9);
    expect(report.pose.jointPositions.slide).toBeLessThan(2.1);
    expect(report.dynamics!.bodies.input.sleeping).toBe(false);
    expect(JSON.stringify(f.project)).toBe(f.source);
  });
  it("reports a blocked load with insufficient effort instead of moving or holding it artificially", async () => {
    const f = await fixture({ effort: 1 });
    f.rig.setJointTarget("slide", -20, 10);
    const report = f.step(600);
    expect(report.jointTargets.slide.status).toBe("blocked");
    expect(report.pose.jointPositions.slide).toBeGreaterThan(0);
    expect(report.pose.jointPositions.slide).toBeLessThan(50.5);
    expect(JSON.stringify(f.project)).toBe(f.source);
  });
  it("stalls on a real world obstruction and recovers after it is removed", async () => {
    const f = await fixture(),
      obstacle = f.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.5, 0.1, 0.5).setTranslation(0, 1.7, 0),
      );
    f.rig.setJointTarget("slide", 20, 20);
    let report = f.step(600);
    expect(report.jointTargets.slide.status).toBe("blocked");
    expect(report.pose.jointPositions.slide).toBeLessThan(11);
    f.world.removeCollider(obstacle, true);
    report = f.step(600);
    expect(report.jointTargets.slide.status).toBe("complete");
    expect(report.pose.jointPositions.slide).toBeCloseTo(20, 1);
  });
  it("handles oblique local axes with the same physical loaded position and exact replay", async () => {
    const pose = {
        basis: axisRotation(
          [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)],
          73,
        ),
        position: [300, -200, 100] as Vec3,
      },
      a = await fixture({ pose }),
      b = await fixture({ pose });
    a.rig.setJointTarget("slide", -10, 10);
    b.rig.setJointTarget("slide", -10, 10);
    const report = a.step(600);
    expect(report).toEqual(b.step(600));
    expect(report.jointTargets.slide.status).toBe("complete");
    expect(report.pose.jointPositions.slide).toBeCloseTo(-10, 1);
  });
});
