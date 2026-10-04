import { afterEach, beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { physicsFixture } from "../../src/mechanisms/fixtures";
import { DynamicRig } from "../../src/play/dynamics";
import { playSources } from "../helpers/play-dynamic-source";
import { compose } from "../../src/core/math";
import type { Transform } from "../../src/core/types";
import { axisRotation } from "../../src/mechanisms/kinematic";

beforeAll(async () => {
  await RAPIER.init();
});
const cleanup: Array<() => void> = [];
afterEach(() => {
  cleanup
    .splice(0)
    .reverse()
    .forEach((dispose) => dispose());
});

async function fixture(
  positionMotor?: number,
  options: { pose?: Transform; massKg?: number; effort?: number } = {},
) {
  const project = physicsFixture(true);
  const joint = project.motionRigs.door.joints[0];
  delete joint.limits;
  if (positionMotor !== undefined)
    joint.motor = {
      mode: "position",
      target: positionMotor,
      maxEffort: { value: options.effort ?? 500, unit: "N*m" },
    };
  if (options.massKg !== undefined)
    project.motionRigs.door.dynamics = {
      groups: { door: { massKg: options.massKg } },
    };
  if (options.pose) {
    for (const node of project.models[project.rootModelId].nodes)
      node.transform = compose(options.pose, node.transform);
    for (const group of project.motionRigs.door.groups) {
      group.frame = compose(options.pose, group.frame);
      for (const id of group.occurrenceIds)
        group.restTransforms[id] = compose(
          options.pose,
          group.restTransforms[id],
        );
    }
  }
  const before = JSON.stringify(project);
  const { sources } = await playSources(project, ["door"]);
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  const mirror = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = 1 / 60;
  const rig = new DynamicRig(world, mirror, sources[0], 0, project.revision);
  cleanup.push(() => {
    rig.dispose();
    world.free();
    mirror.free();
  });
  const step = (ticks: number) => {
    for (let i = 0; i < ticks; i++) {
      rig.beforeStep();
      rig.stepPhysics();
      rig.afterStep();
    }
    expect(JSON.stringify(project)).toBe(before);
    return rig.snapshot();
  };
  const angle = () => rig.snapshot().pose.jointPositions.hinge;
  return { rig, world, step, angle };
}

describe("accumulated-turn dynamic position control", () => {
  it("replays targets and reversals to identical reports", async () => {
    const run = async () => {
      const { rig, step } = await fixture();
      rig.setJointTarget("hinge", 1080, 180);
      const midway = step(180);
      rig.setJointTarget("hinge", -720, 180);
      const reversed = step(600);
      return [midway, reversed];
    };
    expect(await run()).toEqual(await run());
  });
  it.each([720, -720, 1080, -1080])(
    "reaches and holds %s degrees through every intervening turn",
    async (target) => {
      const { rig, step, angle } = await fixture();
      rig.setJointTarget("hinge", target, 180);
      let previous = 0;
      for (let i = 0; i < 600; i++) {
        step(1);
        const current = angle();
        // Finite motor effort permits a small settling correction near the end.
        if (Math.abs(previous) < Math.abs(target) - 5)
          expect(Math.sign(target) * (current - previous)).toBeGreaterThan(
            -0.1,
          );
        expect(Math.abs(current - previous)).toBeLessThan(5);
        expect(Math.abs(current)).toBeLessThan(Math.abs(target) + 5);
        if (rig.snapshot().jointTargets.hinge.status === "complete")
          expect(Math.abs(current - target)).toBeLessThan(1);
        previous = current;
      }
      expect(angle()).toBeCloseTo(target, 0);
      expect(rig.snapshot().jointTargets.hinge.status).toBe("complete");
      step(120);
      expect(angle()).toBeCloseTo(target, 0);
    },
  );

  it("reverses an in-progress target and then crosses back through zero", async () => {
    const { rig, step, angle } = await fixture();
    rig.setJointTarget("hinge", 1080, 180);
    step(180);
    expect(angle()).toBeGreaterThan(360);
    rig.setJointTarget("hinge", -720, 180);
    step(600);
    expect(angle()).toBeCloseTo(-720, 0);
    rig.setJointTarget("hinge", 450, 180);
    step(600);
    expect(angle()).toBeCloseTo(450, 0);
    expect(rig.snapshot().jointTargets.hinge.status).toBe("complete");
  });

  it.each([720, -720])(
    "also holds an authored position motor at %s degrees",
    async (target) => {
      const { rig, step, angle } = await fixture(target);
      step(600);
      expect(angle()).toBeCloseTo(target, 0);
      expect(rig.snapshot().motors!.hinge.status).toBe("holding");
      step(120);
      expect(angle()).toBeCloseTo(target, 0);
    },
  );

  it("reports an obstruction and resumes safely after the body is released", async () => {
    const { rig, world, step, angle } = await fixture();
    let body: RAPIER.RigidBody | undefined;
    world.bodies.forEach((candidate) => {
      if (candidate.isDynamic()) body = candidate;
    });
    expect(body).toBeDefined();
    body!.setEnabledRotations(false, false, false, true);
    rig.setJointTarget("hinge", 720, 180);
    step(600);
    expect(angle()).toBeCloseTo(0);
    expect(rig.snapshot().jointTargets.hinge.status).toBe("blocked");
    body!.setEnabledRotations(true, true, true, true);
    step(600);
    expect(angle()).toBeCloseTo(720, 0);
    expect(rig.snapshot().jointTargets.hinge.status).toBe("complete");
  });

  it("tracks accumulated turns around an oblique world axis", async () => {
    const { rig, step, angle } = await fixture(undefined, {
      pose: {
        position: [200, -300, 100],
        basis: axisRotation(
          [1 / Math.sqrt(14), 2 / Math.sqrt(14), 3 / Math.sqrt(14)],
          57,
        ),
      },
    });
    rig.setJointTarget("hinge", -1080, 180);
    step(600);
    expect(angle()).toBeCloseTo(-1080, 0);
    expect(rig.snapshot().jointTargets.hinge.status).toBe("complete");
  });

  it("keeps reporting slow progress under a heavy load", async () => {
    const { rig, step, angle } = await fixture(0, { massKg: 1000, effort: 1 });
    rig.setJointTarget("hinge", 4, 90);
    step(180);
    expect(angle()).toBeGreaterThan(0.01);
    expect(angle()).toBeLessThan(3);
    expect(rig.snapshot().jointTargets.hinge.status).toBe("moving");
  });

  it("reopens a completed target after an external impulse and settles again", async () => {
    const { rig, world, step, angle } = await fixture();
    rig.setJointTarget("hinge", 720, 180);
    step(600);
    expect(rig.snapshot().jointTargets.hinge.status).toBe("complete");
    world.bodies.forEach((body) => {
      if (body.isDynamic())
        body.applyTorqueImpulse({ x: 0, y: 20, z: 0 }, true);
    });
    step(3);
    expect(Math.abs(angle() - 720)).toBeGreaterThan(1);
    expect(rig.snapshot().jointTargets.hinge.status).toBe("moving");
    step(600);
    expect(angle()).toBeCloseTo(720, 0);
    expect(rig.snapshot().jointTargets.hinge.status).toBe("complete");
  });
});
