import { afterEach, beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  physicsFixture,
  mechanismFixture,
} from "../../src/mechanisms/fixtures";
import { technicFixture } from "../../src/mechanisms/technic-fixture";
import { rigAuthoringRequest } from "../../src/mechanisms/authoring";
import { KinematicSession } from "../../src/mechanisms/kinematic";
import { occurrences } from "../../src/core/document";
import { DynamicRig } from "../../src/play/dynamics";
import { PlayMechanism } from "../../src/play/mechanism";
import {
  MechanicalContactPolicy,
  mechanicalSolids,
  prepareMechanicalSources,
} from "../../src/play/mechanical-solids";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "../../scripts/full-library-node";
import { playSources } from "../helpers/play-dynamic-source";
import { MechanicalQueryWorld } from "../../src/play/mechanical-query-world";
import { encodeNative, decodeNative } from "../../src/persistence/native";
import { posedLDraw } from "../../src/mechanisms/posed-export";
import { exportLDraw } from "../../src/ldraw/io";
import type { Project } from "../../src/core/types";

registerFullLibraryFromDisk();
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

async function door(native = false, free = false) {
  const project = physicsFixture(free);
  delete project.motionRigs.door.joints[0].limits;
  const { sources } = await playSources(project, ["door"]);
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  const mirror = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = 1 / 60;
  const rig = native
    ? new DynamicRig(world, mirror, sources[0], 0, project.revision)
    : new PlayMechanism(world, sources[0], () => ({
        position: [300, -100, 300],
        walk: false,
      }));
  cleanup.push(() => {
    rig.dispose();
    world.free();
    mirror.free();
  });
  const source = JSON.stringify(project);
  const step = (ticks: number) => {
    for (let i = 0; i < ticks; i++) {
      if (rig instanceof DynamicRig) {
        rig.beforeStep();
        rig.stepPhysics();
        rig.afterStep();
      } else rig.step();
    }
    expect(JSON.stringify(project)).toBe(source);
    return rig.snapshot();
  };
  return { project, world, rig, step };
}

describe("bounded mechanical contacts", () => {
  it("bounds the shared query pool across callers and releases it for reuse", () => {
    const queries = new MechanicalQueryWorld();
    cleanup.push(() => queries.dispose());
    const first = new RAPIER.Ball(0.1);
    expect(queries.collider(first)).toBe(queries.collider(first));
    for (let i = 1; i < 512; i++) queries.collider(new RAPIER.Ball(0.1));
    expect(() => queries.collider(new RAPIER.Ball(0.1))).toThrow(
      /fewer moving parts/,
    );
    queries.dispose();
    expect(() => queries.collider(first)).not.toThrow();
  });

  it("preserves mating definitions through native save and posed export", async () => {
    const project = physicsFixture(),
      before = JSON.stringify(project),
      text = exportLDraw(project);
    const restored = await decodeNative(await encodeNative(project));
    expect(restored.motionRigs).toEqual(project.motionRigs);
    const session = new KinematicSession(restored, "door");
    expect(
      posedLDraw(restored, session.setJointPosition("hinge", 90).transforms)
        .text,
    ).not.toBe(text);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("rejects incomplete member geometry before creating walking proxies", async () => {
    const project = physicsFixture(),
      { sources } = await playSources(project, ["door"]);
    const source = sources[0],
      id = project.motionRigs.door.groups[0].occurrenceIds[0];
    delete source.members![id];
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    cleanup.push(() => world.free());
    expect(
      () =>
        new PlayMechanism(world, source, () => ({
          position: [300, -100, 300],
          walk: false,
        })),
    ).toThrow(/complete geometry/);
    expect(world.colliders.len()).toBe(0);
  });

  it("opens the basic editable door to its full limit without a mating exemption", async () => {
    const project = mechanismFixture(),
      { sources } = await playSources(project, ["door"]);
    expect(project.motionRigs.door.joints[0].mating).toBeUndefined();
    const walking = new RAPIER.World({ x: 0, y: 0, z: 0 }),
      world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
      mirror = new RAPIER.World({ x: 0, y: 0, z: 0 });
    const mechanism = new PlayMechanism(walking, sources[0], () => ({
      position: [300, -100, 300],
      walk: false,
    }));
    const rig = new DynamicRig(world, mirror, sources[0], 0, project.revision);
    cleanup.push(() => {
      mechanism.dispose();
      rig.dispose();
      walking.free();
      world.free();
      mirror.free();
    });
    expect(mechanism.setJointPosition("hinge", 110).blocked).toBe(false);
    rig.setJointTarget("hinge", 110, 90);
    for (let i = 0; i < 240; i++) {
      rig.beforeStep();
      rig.stepPhysics();
      rig.afterStep();
    }
    expect(rig.snapshot().jointTargets.hinge.status).toBe("complete");
  });

  it("refuses a thin static wall between clear rotation endpoints and permits retry after moving it clear", async () => {
    const { world, rig } = await door();
    expect(rig).toBeInstanceOf(PlayMechanism);
    const mechanism = rig as PlayMechanism;
    const wall = world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.2, 1.2, 0.0005).setTranslation(
        0.4,
        1.2,
        0.4,
      ),
    );
    const blocked = mechanism.setJointPosition("hinge", 90);
    expect(blocked.blocked).toBe(true);
    expect(blocked.pose.jointPositions.hinge).toBe(0);
    expect(blocked.blockedReason).toMatch(/world|assembly/);
    wall.setTranslation({ x: 3, y: 1.2, z: 0.4 });
    expect(
      mechanism.setJointPosition("hinge", 90).pose.jointPositions.hinge,
    ).toBe(90);
  });

  it("uses a foreign collider's current accepted pose and keeps a blocked motor retryable", async () => {
    const { world, rig, step, project } = await door();
    const mechanism = rig as PlayMechanism;
    const wall = world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.2, 1.2, 0.001).setTranslation(3, 1.2, 0.4),
    );
    wall.setTranslation({ x: 0.4, y: 1.2, z: 0.4 });
    mechanism.setJointTarget("hinge", 90, 90);
    const stopped = step(90);
    expect(stopped.jointTargets.hinge.status).toBe("blocked");
    expect(stopped.pose.jointPositions.hinge).toBeLessThan(60);
    const before = JSON.stringify(project);
    wall.setTranslation({ x: 3, y: 1.2, z: 0.4 });
    mechanism.setJointTarget("hinge", 90, 90);
    expect(step(90).jointTargets.hinge.status).toBe("complete");
    expect(JSON.stringify(project)).toBe(before);
  });

  it("allows the bearing while preserving same-frame interference outside it", async () => {
    const { rig } = await door();
    const mechanism = rig as PlayMechanism;
    expect(mechanism.setJointPosition("hinge", 90).blocked).toBe(false);
    expect(mechanism.setJointPosition("hinge", 360).blocked).toBe(true);
    expect(mechanism.snapshot().pose.jointPositions.hinge).toBe(90);
  });

  it("refuses unchecked long travel and retains every accepted proxy", async () => {
    const { rig } = await door(false, true);
    const mechanism = rig as PlayMechanism;
    const before = mechanism.snapshot();
    expect(mechanism.setJointPosition("hinge", 100000).blocked).toBe(true);
    expect(mechanism.snapshot().pose).toEqual(before.pose);
    expect(mechanism.setJointPosition("hinge", 90).blocked).toBe(false);
  });

  it("keeps real native frame stops and actually invokes queue-backed mating hooks", async () => {
    const { rig, step } = await door(true);
    const native = rig as DynamicRig;
    let calls = 0;
    const original = native.physicsHooks.filterContactPair;
    native.physicsHooks.filterContactPair = (...args) => {
      calls++;
      return original(...args);
    };
    native.setJointTarget("hinge", 360, 180);
    const stopped = step(360);
    expect(calls).toBeGreaterThan(0);
    expect(stopped.pose.jointPositions.hinge).toBeLessThan(200);
    expect(stopped.jointTargets.hinge.status).toBe("blocked");
    native.setJointTarget("hinge", 0, 180);
    expect(step(180).jointTargets.hinge.status).toBe("complete");
  });

  it.each([null, false, 0])(
    "refuses malformed mating value %s before changing source",
    (value) => {
      const project = physicsFixture();
      (
        project.motionRigs.door.joints[0] as unknown as { mating: unknown }
      ).mating = value;
      const before = JSON.stringify(project);
      expect(() => new KinematicSession(project, "door")).toThrow();
      expect(JSON.stringify(project)).toBe(before);
    },
  );

  it("keeps the basic door editable and refuses to silently discard an advanced mating allowance", () => {
    const basic = mechanismFixture();
    expect(rigAuthoringRequest(basic, "door").kind).toBe("joint");
    const advanced = physicsFixture(),
      before = JSON.stringify(advanced);
    expect(() => rigAuthoringRequest(advanced, "door")).toThrow(
      /cannot be loaded/,
    );
    expect(JSON.stringify(advanced)).toBe(before);
  });

  it("refuses prismatic mating rather than carrying a permanent bearing exemption into distant obstacles", () => {
    const project = physicsFixture();
    const joint = project.motionRigs.door.joints[0];
    joint.kind = "prismatic";
    const before = JSON.stringify(project);
    expect(() => new KinematicSession(project, "door")).toThrow(/revolute/);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("preserves actual pinned Technic bores and native 8:24 rotation with contact-class compounds", async () => {
    const { project } = technicFixture();
    const before = JSON.stringify(project);
    const { sources } = await playSources(
      project,
      ["technic-drive"],
      fullLibrarySources(occurrences(project).map((o) => o.node.ref)),
    );
    const source = sources[0],
      solids = mechanicalSolids(
        source,
        new MechanicalContactPolicy(
          project.motionRigs["technic-drive"],
          source,
        ),
      );
    expect(solids.length).toBeLessThan(32);
    expect(solids.reduce((n, s) => n + s.childCount, 0)).toBeLessThan(4096);
    const arm = project.motionRigs["technic-drive"].groups.at(-1)!;
    // Both round holes survive the moving brick compound, while its wall
    // between them remains solid. Coordinates are group-local physics metres.
    const armSolids = solids.filter((s) => s.groupId === arm.id);
    const contains = (x: number, y: number) =>
      armSolids.some((s) =>
        s.shape.containsPoint(
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0, z: 0, w: 1 },
          { x: x * 0.02, y: -y * 0.02, z: 0 },
        ),
      );
    expect(contains(-20, 10)).toBe(false);
    expect(contains(0, 10)).toBe(false);
    expect(contains(-10, 10)).toBe(true);
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
      mirror = new RAPIER.World({ x: 0, y: 0, z: 0 });
    const rig = new DynamicRig(world, mirror, source, 0, project.revision);
    cleanup.push(() => {
      rig.dispose();
      world.free();
      mirror.free();
    });
    for (let i = 0; i < 180; i++) {
      rig.beforeStep();
      rig.stepPhysics();
      rig.afterStep();
    }
    const report = rig.snapshot(),
      [input, output, pin, armJoint] =
        project.motionRigs["technic-drive"].joints;
    expect(report.pose.jointPositions[input.id]).toBeGreaterThan(240);
    expect(
      Math.abs(
        report.pose.jointPositions[output.id] +
          report.pose.jointPositions[input.id] / 3,
      ),
    ).toBeLessThan(0.1);
    expect(Math.abs(report.pose.jointPositions[pin.id])).toBeLessThan(0.01);
    expect(Math.abs(report.pose.jointPositions[armJoint.id])).toBeLessThan(
      0.01,
    );
    expect(JSON.stringify(project)).toBe(before);
  });

  it("stalls the pinned pin arm on a real non-mating frame brick and retries toward clear space", async () => {
    const { project } = technicFixture(),
      definition = project.motionRigs["technic-drive"];
    const template = project.models[project.rootModelId].nodes.find(
      (n) => n.ref === "3700.dat",
    )!;
    const node = structuredClone(template);
    node.id = "arm-stop";
    delete node.sourceRecordId;
    node.transform.position = [149, -44, 10.5];
    project.models[project.rootModelId].nodes.push(node);
    const occurrence = occurrences(project).find((o) => o.node.id === node.id)!;
    definition.groups[0].occurrenceIds.push(occurrence.id);
    definition.groups[0].restTransforms[occurrence.id] = structuredClone(
      occurrence.transform,
    );
    const before = JSON.stringify(project);
    const { sources } = await playSources(
      project,
      [definition.id],
      fullLibrarySources(occurrences(project).map((o) => o.node.ref)),
    );
    const query = new RAPIER.World({ x: 0, y: 0, z: 0 });
    const mechanism = new PlayMechanism(query, sources[0], () => ({
      position: [300, -100, 300],
      walk: false,
    }));
    cleanup.push(() => {
      mechanism.dispose();
      query.free();
    });
    expect(
      mechanism.setJointPosition(definition.joints[3].id, 45).blocked,
    ).toBe(true);
    const clear = mechanism.setJointPosition(definition.joints[3].id, -45);
    expect(clear.blocked).toBe(false);
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
      mirror = new RAPIER.World({ x: 0, y: 0, z: 0 });
    const rig = new DynamicRig(world, mirror, sources[0], 0, project.revision);
    cleanup.push(() => {
      rig.dispose();
      world.free();
      mirror.free();
    });
    const pin = definition.joints[2].id,
      arm = definition.joints[3].id;
    const step = (ticks: number) => {
      for (let i = 0; i < ticks; i++) {
        rig.beforeStep();
        rig.stepPhysics();
        rig.afterStep();
      }
      return rig.snapshot();
    };
    rig.setJointTarget(pin, 0, 90);
    rig.setJointTarget(arm, 45, 90);
    const blocked = step(240);
    expect(blocked.jointTargets[arm].status).toBe("blocked");
    expect(blocked.pose.jointPositions[arm]).toBeLessThan(35);
    rig.setJointTarget(arm, -45, 90);
    expect(step(240).jointTargets[arm].status).toBe("complete");
    expect(JSON.stringify(project)).toBe(before);
  }, 15000);

  it("refuses aggregate source budget before allocating native colliders", async () => {
    const { project } = technicFixture();
    const { sources } = await playSources(
      project,
      ["technic-drive"],
      fullLibrarySources(occurrences(project).map((o) => o.node.ref)),
    );
    const source = sources[0],
      before = JSON.stringify(project);
    // Each individual source is supported; three independent copies exceed
    // the global 4,096 child cap before any query/native world is allocated.
    const copies = [0, 1, 2].map((i) => {
      const copy = structuredClone(project);
      const rig = copy.motionRigs["technic-drive"];
      rig.id = `copy-${i}`;
      copy.motionRigs = { [rig.id]: rig };
      return { ...source, project: copy as Project, rigId: rig.id };
    });
    expect(() => prepareMechanicalSources(copies)).toThrow(/4,096/);
    expect(JSON.stringify(project)).toBe(before);
  });
});
