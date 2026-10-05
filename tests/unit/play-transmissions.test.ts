import { afterEach, beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import { compose } from "../../src/core/math";
import { axisRotation } from "../../src/mechanisms/kinematic";
import type { Transform } from "../../src/core/types";
import { technicFixture } from "../../src/mechanisms/technic-fixture";
import {
  MechanicalContactPolicy,
  mechanicalSolids,
} from "../../src/play/mechanical-solids";
import { DynamicRig } from "../../src/play/dynamics";
import { playSources } from "../helpers/play-dynamic-source";

registerFullLibraryFromDisk();
beforeAll(async () => {
  await RAPIER.init();
});
const cleanup: Array<() => void> = [];
afterEach(() => {
  cleanup
    .splice(0)
    .reverse()
    .forEach((f) => f());
});

async function fixture(
  outputMass?: number,
  options: {
    pose?: Transform;
    oppositeAxis?: boolean;
    mobileCarrier?: boolean;
    gravity?: boolean;
    armEffort?: number;
  } = {},
) {
  const { project, proposal } = technicFixture();
  const definition = proposal.rig!;
  const { jointA: input, jointB: output } = definition.transmissions![0];
  const outputGroup = definition.joints.find((j) => j.id === output)!.bodyB;
  if (options.armEffort !== undefined)
    definition.joints[3].motor = {
      mode: "position",
      target: 0,
      maxEffort: { value: options.armEffort, unit: "N*m" },
    };
  if (outputMass !== undefined)
    definition.dynamics = { groups: { [outputGroup]: { massKg: outputMass } } };
  if (options.oppositeAxis) {
    const joint = definition.joints.find((j) => j.id === output)!;
    joint.axisA = joint.axisA!.map((n) => -n) as typeof joint.axisA;
    joint.axisB = joint.axisB!.map((n) => -n) as typeof joint.axisB;
    definition.transmissions![0].axisSign = -1;
  }
  if (options.mobileCarrier)
    definition.dynamics = {
      groups: { [definition.groups[0].id]: { anchored: false } },
    };
  if (options.pose) {
    for (const node of project.models[project.rootModelId].nodes)
      node.transform = compose(options.pose, node.transform);
    for (const group of definition.groups) {
      group.frame = compose(options.pose, group.frame);
      for (const id of group.occurrenceIds)
        group.restTransforms[id] = compose(
          options.pose,
          group.restTransforms[id],
        );
    }
  }
  const source = JSON.stringify(project);
  const { sources } = await playSources(
    project,
    [definition.id],
    fullLibrarySources(occurrences(project).map((o) => o.node.ref)),
  );
  const world = new RAPIER.World({
    x: 0,
    y: options.gravity ? -9.81 : 0,
    z: 0,
  });
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
    expect(JSON.stringify(project)).toBe(source);
    return rig.snapshot();
  };
  const outputBody = () => {
    const frame = definition.groups.find((g) => g.id === outputGroup)!.frame;
    let body: RAPIER.RigidBody | undefined;
    world.forEachRigidBody((b) => {
      if (
        Math.abs(b.translation().x - frame.position[0] * 0.02) < 0.01 &&
        !b.isFixed()
      )
        body = b;
    });
    expect(body).toBeDefined();
    return body!;
  };
  return {
    rig,
    world,
    step,
    input,
    output,
    outputBody,
    definition,
    source: sources[0],
  };
}
// The longest replay integrates 3,240 native ticks with the reviewed tooth
// compounds (about 6 ms/tick on the shared VM); retain every physical assertion.
describe("physical spur coupling", { timeout: 30_000 }, () => {
  it("admits only source-seated gear hubs at their actual bearing mouths", async () => {
    const { source, definition, input, output } = await fixture(),
      all = occurrences(source.project),
      policy = new MechanicalContactPolicy(definition, source),
      solids = mechanicalSolids(source, policy),
      carrier = definition.joints[0].bodyA;
    for (const [index, joint] of [
      [3, input],
      [7, output],
    ] as const) {
      const hub = solids.find(
          (s) => s.memberId === all[index].id && s.mating.has(joint),
        )!,
        teeth = solids.find(
          (s) => s.memberId === all[index].id && !s.mating.has(joint),
        )!;
      expect(hub).toBeDefined();
      expect(teeth).toBeDefined();
      for (const support of [0, 1])
        expect(
          policy.allowed(hub, { groupId: carrier, memberId: all[support].id }),
        ).toBe(true);
      expect(
        policy.allowed(hub, { groupId: carrier, memberId: all[10].id }),
      ).toBe(false);
      expect(
        policy.allowed(hub, {
          groupId: carrier,
          memberId: "unrelated-accessory",
        }),
      ).toBe(false);
      expect(
        policy.allowed(teeth, { groupId: carrier, memberId: all[0].id }),
      ).toBe(false);
      const shifted = structuredClone(source.project),
        movedGear = shifted.models[shifted.rootModelId].nodes.find(
          (n) => n.id === all[index].node.id,
        )!;
      movedGear.transform.position[2] += 1;
      const unseated = new MechanicalContactPolicy(
        shifted.motionRigs[definition.id],
        {
          ...source,
          project: shifted,
          lookup: undefined,
        },
      );
      expect(
        unseated.allowed(hub, { groupId: carrier, memberId: all[0].id }),
      ).toBe(false);
      expect(
        unseated.allowed(hub, { groupId: carrier, memberId: all[1].id }),
      ).toBe(false);
    }
  });
  it("reports a held motor input blocked by its output, then recovers and brakes", async () => {
    const { rig, step, input, outputBody } = await fixture();
    const blocked = outputBody();
    blocked.lockRotations(true, true);
    rig.setMotor(input, true, 1);
    let report = step(120);
    expect(report.motors![input].status).toBe("blocked");
    expect(report.blocked).toBe(true);
    expect(report.blockedReason).toMatch(/motor cannot turn/);
    rig.setMotor(input, true, 1);
    expect(step(1).motors![input].status).toBe("blocked");
    blocked.lockRotations(false, true);
    report = step(120);
    expect(report.motors![input].status).toBe("running");
    expect(report.blocked).toBe(false);
    rig.setMotor(input, true, 0);
    expect(step(120).motors![input].status).toBe("holding");
  });
  it("reports a genuinely underpowered arm as blocked without bypassing its authored effort", async () => {
    const { rig, step, definition } = await fixture(undefined, {
      gravity: true,
      armEffort: 1,
    });
    const pin = definition.joints[2].id,
      arm = definition.joints[3].id;
    rig.setJointTarget(pin, 0, 90);
    rig.setJointTarget(arm, 45, 90);
    const report = step(600);
    expect(Math.abs(report.pose.jointPositions[arm] - 45)).toBeGreaterThan(20);
    expect(report.jointTargets[arm].status).toBe("blocked");
    expect(report.jointTargets[arm].blockedReason).toMatch(/effort/);
  });
  it("positions and holds the pin arm against gravity using its two bearing coordinates", async () => {
    const { rig, step, definition } = await fixture(undefined, {
      gravity: true,
    });
    step(120);
    const pin = definition.joints[2].id,
      arm = definition.joints[3].id;
    rig.setJointTarget(pin, 0, 90);
    rig.setJointTarget(arm, 45, 90);
    let report = step(300);
    expect(report.pose.jointPositions[pin]).toBeCloseTo(0, 0);
    expect(report.pose.jointPositions[arm]).toBeCloseTo(45, 0);
    expect(report.jointTargets[pin].status).toBe("complete");
    expect(report.jointTargets[arm].status).toBe("complete");
    report = step(180);
    expect(report.pose.jointPositions[arm]).toBeCloseTo(45, 0);
  });
  it("replays identical geared controls to identical poses and reports", async () => {
    const run = async () => {
      const { rig, step, input, output } = await fixture();
      const moving = step(120);
      rig.setJointTarget(input, 765, 180);
      const held = step(600);
      rig.setJointTarget(output, 270, 90);
      return [moving, held, step(900)];
    };
    expect(await run()).toEqual(await run());
  });
  it("preserves ratio for oblique world axes and opposite declared shaft axes", async () => {
    const pose: Transform = {
      position: [300, -200, 100],
      basis: axisRotation(
        [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)],
        73,
      ),
    };
    const { step, input, output } = await fixture(undefined, {
      pose,
      oppositeAxis: true,
    });
    const positions = step(600).pose.jointPositions;
    expect(positions[input]).toBeGreaterThan(720);
    expect(Math.abs(positions[output] - positions[input] / 3)).toBeLessThan(1);
  });
  it("keeps rounded source placements while deriving unit native constraint axes", async () => {
    const pose: Transform = {
      position: [80, -30, 100],
      basis: [0.707107, 0, 0.707107, 0, 1, 0, -0.707107, 0, 0.707107],
    };
    const { step, input, output, definition } = await fixture(undefined, {
      pose,
    });
    const sourceFrame = structuredClone(definition.groups[0].frame);
    const positions = step(180).pose.jointPositions;
    expect(positions[input]).toBeGreaterThan(90);
    expect(Math.abs(positions[output] + positions[input] / 3)).toBeLessThan(1);
    expect(definition.groups[0].frame).toEqual(sourceFrame);
  });
  it("returns reaction to a free carrier without creating net torque when unpowered", async () => {
    const { rig, world, step, input, outputBody, definition } = await fixture(
      undefined,
      { mobileCarrier: true },
    );
    rig.setMotor(input, false);
    world.forEachRigidBody((b) => {
      b.setLinearDamping(0);
      b.setAngularDamping(0);
    });
    outputBody().applyTorqueImpulse({ x: 0, y: 0, z: 1 }, true);
    const momentum = () => {
      const total = { x: 0, y: 0, z: 0 };
      world.forEachRigidBody((b) => {
        // Pinned Rapier defaults its matrix to a shared scratch-buffer view.
        // Read vectors first, then use the inertia before another native call.
        const w = b.angvel(),
          p = b.worldCom(),
          v = b.linvel(),
          mass = b.mass(),
          m = b.effectiveAngularInertia();
        total.x +=
          m.m11 * w.x +
          m.m12 * w.y +
          m.m13 * w.z +
          mass * (p.y * v.z - p.z * v.y);
        total.y +=
          m.m21 * w.x +
          m.m22 * w.y +
          m.m23 * w.z +
          mass * (p.z * v.x - p.x * v.z);
        total.z +=
          m.m31 * w.x +
          m.m32 * w.y +
          m.m33 * w.z +
          mass * (p.x * v.y - p.y * v.x);
      });
      return total;
    };
    expect(momentum().z).toBeCloseTo(1, 5);
    // Isolate the external coupling pass from native joint integration error:
    // each of its torque impulses must conserve all three momentum components.
    for (let i = 0; i < 120; i++) {
      rig.beforeStep();
      rig.stepPhysics();
      const before = momentum();
      rig.afterStep();
      const after = momentum();
      expect(
        Math.abs(after.x - before.x) +
          Math.abs(after.y - before.y) +
          Math.abs(after.z - before.z),
      ).toBeLessThan(1e-5);
    }
    const report = step(0);
    expect(momentum().z).toBeCloseTo(1, 2);
    expect(report.groupFrames[definition.groups[0].id].basis).not.toEqual(
      definition.groups[0].frame.basis,
    );
  });
  it("drives official 8:24 shafts through many turns with one motor", async () => {
    const { step, input, output } = await fixture();
    let previous = 0;
    for (let i = 0; i < 10; i++) {
      const pose = step(60).pose.jointPositions;
      expect(pose[input]).toBeGreaterThan(previous);
      expect(Math.abs(pose[output] + pose[input] / 3)).toBeLessThan(1);
      previous = pose[input];
    }
    expect(previous).toBeGreaterThan(720);
  });
  it("reverses a multi-turn target and permits driving from the output", async () => {
    const { rig, step, input, output } = await fixture();
    expect(() => rig.setJointTarget(output, 270, 1201)).toThrow(/speed/);
    rig.setJointTarget(input, 720, 180);
    let report = step(900);
    expect(report.pose.jointPositions[input]).toBeCloseTo(720, 0);
    expect(report.pose.jointPositions[output]).toBeCloseTo(-240, 0);
    expect(report.jointTargets[input].status).toBe("complete");
    rig.setJointTarget(output, 270, 90);
    report = step(1200);
    expect(report.pose.jointPositions[input]).toBeCloseTo(-810, 0);
    expect(report.pose.jointPositions[output]).toBeCloseTo(270, 0);
    expect(report.jointTargets[output].status).toBe("complete");
    expect(report.motors![input].enabled).toBe(false);
    expect(report.jointTargets[input]).toBeUndefined();
  });
  it("reflects a heavy output's inertia to the finite-effort input motor", async () => {
    const light = await fixture(1);
    const heavy = await fixture(10000);
    const lightAngle = light.step(120).pose.jointPositions[light.input];
    const heavyPose = heavy.step(120).pose.jointPositions;
    expect(lightAngle).toBeGreaterThan(150);
    expect(heavyPose[heavy.input]).toBeLessThan(lightAngle / 2);
    expect(
      Math.abs(heavyPose[heavy.output] + heavyPose[heavy.input] / 3),
    ).toBeLessThan(1);
  });
  it("stalls the input when the output is obstructed, then resumes after release", async () => {
    const { rig, step, input, output, outputBody } = await fixture();
    const body = outputBody();
    body.setEnabledRotations(false, false, false, true);
    rig.setJointTarget(input, 720, 180);
    const blocked = step(600);
    expect(Math.abs(blocked.pose.jointPositions[output])).toBeLessThan(0.01);
    expect(Math.abs(blocked.pose.jointPositions[input])).toBeLessThan(10);
    expect(blocked.jointTargets[input].status).toBe("blocked");
    body.setEnabledRotations(true, true, true, true);
    const released = step(900);
    expect(released.pose.jointPositions[input]).toBeCloseTo(720, 0);
    expect(released.pose.jointPositions[output]).toBeCloseTo(-240, 0);
    expect(released.jointTargets[input].status).toBe("complete");
  });
  it("back-drives an unpowered input from an external output torque impulse", async () => {
    const { rig, step, input, output, outputBody } = await fixture();
    rig.setMotor(input, false);
    outputBody().applyTorqueImpulse({ x: 0, y: 0, z: 1 }, true);
    const pose = step(120).pose.jointPositions;
    expect(Math.abs(pose[output])).toBeGreaterThan(5);
    expect(Math.abs(pose[input] + 3 * pose[output])).toBeLessThan(1);
  });
});
