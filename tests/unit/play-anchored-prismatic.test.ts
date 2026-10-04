import { afterEach, beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { mechanismFixture } from "../../src/mechanisms/fixtures";
import { axisRotation } from "../../src/mechanisms/kinematic";
import { compose, identity, mv, add } from "../../src/core/math";
import { occurrences } from "../../src/core/document";
import { DynamicRig } from "../../src/play/dynamics";
import {
  MechanicalContactPolicy,
  mechanicalSolids,
} from "../../src/play/mechanical-solids";
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
async function slider(mobile = false, oblique = false, centredProxy = false) {
  const project = mechanismFixture(),
    definition = project.motionRigs.door;
  const joint = definition.joints[0];
  joint.kind = "prismatic";
  joint.axisA = joint.axisB = [0, 0, 1];
  joint.limits = [0, 20];
  // Keep the authored guide behind the panel throughout its linear travel.
  project.models[project.rootModelId].nodes[0].transform.position[2] = -40;
  const frame = definition.groups.find((g) => g.id === "frame")!;
  frame.frame.position[2] = -40;
  frame.restTransforms[frame.occurrenceIds[0]].position[2] = -40;
  joint.anchorA[2] = 40;

  joint.motor = {
    mode: "position",
    target: 10,
    maxEffort: { value: 2000, unit: "N" },
  };
  definition.dynamics = {
    groups: { frame: { anchored: !mobile, massKg: 10 }, door: { massKg: 1 } },
  };
  if (oblique) {
    const pose = {
      ...identity(),
      position: [100, -200, 50] as [number, number, number],
      basis: axisRotation([Math.SQRT1_2, Math.SQRT1_2, 0], 37),
    };
    for (const node of project.models[project.rootModelId].nodes)
      node.transform = compose(pose, node.transform);
    const all = new Map(occurrences(project).map((o) => [o.id, o]));
    for (const group of definition.groups) {
      group.frame = compose(pose, group.frame);
      for (const id of group.occurrenceIds)
        group.restTransforms[id] = structuredClone(all.get(id)!.transform);
    }
  }
  const sourceJSON = JSON.stringify(project),
    { sources } = await playSources(project, ["door"]);
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    mirror = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = 1 / 60;
  const policy = new MechanicalContactPolicy(definition, sources[0]);
  const solids = mechanicalSolids(sources[0], policy);
  if (centredProxy) {
    const solid = solids.find((s) => s.groupId === "door")!;
    solid.shape = new RAPIER.Compound(
      [new RAPIER.Cuboid(0.015, 0.015, 0.015)],
      [{ x: 0.3, y: 0, z: 0 }],
      [{ x: 0, y: 0, z: 0, w: 1 }],
    );
  }
  const rig = new DynamicRig(world, mirror, sources[0], 0, project.revision, {
    policy,
    solids,
    stationary: [],
  });
  cleanup.push(() => {
    rig.dispose();
    world.free();
    mirror.free();
  });
  const bodies = (
    rig as unknown as { bodies: Map<string, { body: RAPIER.RigidBody }> }
  ).bodies;
  const body = bodies.get("door")!.body,
    carrier = bodies.get("frame")!.body;
  const step = (n: number) => {
    for (let i = 0; i < n; i++) {
      rig.beforeStep();
      rig.stepPhysics();
      rig.afterStep();
    }
    expect(JSON.stringify(project)).toBe(sourceJSON);
    return rig.snapshot();
  };
  const doorFrame = definition.groups.find((g) => g.id === "door")!.frame;
  const point = add(doorFrame.position, mv(doorFrame.basis, [15, 0, 0]));
  const expectedCentre = {
    x: point[0] * 0.02,
    y: -point[1] * 0.02,
    z: -point[2] * 0.02,
  };
  return { rig, world, mirror, body, carrier, step, expectedCentre };
}
describe("native sliders on fixed carriers", () => {
  it.each([false, true])(
    "keeps its existing rotational locks through obstruction and retry (oblique %s)",
    async (oblique) => {
      const { body, step } = await slider(false, oblique);
      body.lockTranslations(true, true);
      body.applyTorqueImpulse({ x: 1, y: 2, z: 3 }, true);
      const stalled = step(120);
      expect(Math.abs(stalled.pose.jointPositions.hinge)).toBeLessThan(0.5);
      expect(body.rotation()).toEqual({ x: 0, y: 0, z: 0, w: 1 });
      body.lockTranslations(false, true);
      const released = step(240);
      expect(released.pose.jointPositions.hinge).toBeCloseTo(10, 0);
      expect(body.rotation()).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    },
  );
  it("rotates centred compound children with the authored frame in both native worlds", async () => {
    const { body, mirror, expectedCentre } = await slider(false, true, true);
    expect(body.collider(0).containsPoint(expectedCentre)).toBe(true);
    let matches = 0;
    mirror.forEachCollider((c) => {
      if (c.containsPoint(expectedCentre)) matches++;
    });
    expect(matches).toBe(1);
    const centre = body.translation();
    expect(
      body
        .collider(0)
        .containsPoint({ x: centre.x + 0.3, y: centre.y, z: centre.z }),
    ).toBe(false);
  });
  it("keeps moving-carrier rotation available", async () => {
    const { body, carrier, step } = await slider(true);
    body.applyTorqueImpulse({ x: 0, y: 0, z: 1 }, true);
    step(30);
    expect(Math.abs(carrier.rotation().z)).toBeGreaterThan(0.001);
    expect(Math.abs(body.rotation().z)).toBeGreaterThan(0.001);
  });
  it("retains a foreign obstruction and reaches its target when that obstruction is removed", async () => {
    const { rig, world, step } = await slider();
    const blocker = world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.35, 1, 0.02).setTranslation(0.4, 1.2, -0.15),
    );
    expect(step(240).pose.jointPositions.hinge).toBeLessThan(8);
    world.removeCollider(blocker, true);
    rig.setJointTarget("hinge", 10, 40);
    expect(step(240).pose.jointPositions.hinge).toBeCloseTo(10, 0);
  });
});
