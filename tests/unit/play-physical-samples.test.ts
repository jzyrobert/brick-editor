import { KinematicSession } from "../../src/mechanisms/kinematic";
import { DynamicRig } from "../../src/play/dynamics";
import {
  MechanicalContactPolicy,
  mechanicalSolids,
  mechanicalStationarySolids,
} from "../../src/play/mechanical-solids";
import { toPhysics, frameRotation } from "../../src/play/physics-frame";
import { loadReviewedMechanicalProxies } from "../../src/play/reviewed-mechanical-proxies";
import { beforeAll, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { motionSample } from "../../src/catalog/motion-samples";
import { occurrences } from "../../src/core/document";
import { PlayMechanism } from "../../src/play/mechanism";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "../../scripts/full-library-node";
import { playSources } from "../helpers/play-dynamic-source";

beforeAll(async () => {
  registerFullLibraryFromDisk();
  await RAPIER.init();
});
for (const name of ["motor-gears", "rack-drive"] as const)
  it(`${name} moves its real source-connected mechanism and preserves source`, async () => {
    const project = motionSample(name),
      before = JSON.stringify(project),
      rig = Object.values(project.motionRigs)[0],
      refs = occurrences(project).map((o) => o.node.ref),
      { sources } = await playSources(
        project,
        [rig.id],
        fullLibrarySources(refs),
      ),
      world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    await loadReviewedMechanicalProxies(sources);
    const mechanism = new PlayMechanism(world, sources[0], () => ({
      position: [300, -100, 300],
      walk: false,
    }));
    try {
      const target = name === "motor-gears" ? 360 : -60;
      let moved = mechanism.setJointPosition(
        rig.joints[0].id,
        name === "motor-gears" ? 30 : target,
      );
      if (name === "motor-gears")
        for (let angle = 60; angle <= 360; angle += 30) {
          expect(moved.blocked, moved.blockedReason).toBe(false);
          moved = mechanism.setJointPosition(rig.joints[0].id, angle);
        }
      expect(moved.blocked, moved.blockedReason).toBe(false);
      expect(moved.pose.jointPositions[rig.joints[0].id]).toBeCloseTo(target);
      if (name === "motor-gears")
        expect(moved.pose.jointPositions[rig.joints[1].id]).toBeCloseTo(-120);
      expect(JSON.stringify(project)).toBe(before);
    } finally {
      mechanism.dispose();
      world.free();
    }
  }, 30000);

it("actual shaft bearing tags preserve same-frame foreign contacts and real bore-mouth contacts", async () => {
  const project = motionSample("motor-gears"),
    all = occurrences(project),
    rig = project.motionRigs["technic-drive"],
    { sources } = await playSources(
      project,
      [rig.id],
      fullLibrarySources(all.map((o) => o.node.ref)),
    ),
    policy = new MechanicalContactPolicy(rig, sources[0]),
    solids = mechanicalSolids(sources[0], policy),
    shaft = solids.find(
      (s) => s.memberId === all[2].id && s.mating.has("joint-0"),
    )!;
  expect(shaft).toBeDefined();
  const carrier = rig.joints[0].bodyA;
  expect(policy.allowed(shaft, { groupId: carrier, memberId: all[0].id })).toBe(
    true,
  );
  expect(
    policy.allowed(shaft, { groupId: carrier, memberId: all[13].id }),
  ).toBe(false);
  expect(policy.allowed(shaft, { groupId: carrier })).toBe(false);
  for (const index of [4, 5]) {
    const collar = solids.find(
      (s) => s.memberId === all[index].id && s.mating.has("joint-0"),
    )!;
    expect(collar).toBeDefined();
    expect(
      policy.allowed(collar, {
        groupId: carrier,
        memberId: all[index === 4 ? 0 : 1].id,
      }),
    ).toBe(true);
    expect(
      policy.allowed(collar, {
        groupId: carrier,
        memberId: all[index === 4 ? 1 : 0].id,
      }),
    ).toBe(false);
  }
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  try {
    const frame = rig.groups.find((g) => g.id === shaft.groupId)!.frame,
      pos = toPhysics(frame.position),
      actual = world.createCollider(
        new RAPIER.ColliderDesc(shaft.shape)
          .setTranslation(pos.x, pos.y, pos.z)
          .setRotation(frameRotation(frame)),
      ),
      foreign = world.createCollider(
        RAPIER.ColliderDesc.ball(0.05).setTranslation(0, 0.92, 0),
      );
    expect(actual.contactCollider(foreign, 0)?.distance).toBeLessThan(0);
    expect(
      policy.allowed(shaft, { groupId: carrier, memberId: "foreign-member" }),
    ).toBe(false);
    const caseSolid = mechanicalStationarySolids(sources[0]).find(
      (s) => s.memberId === all[10].id,
    )!;
    expect(sources[0].memberLocals![all[10].id].bounds.min[2]).toBe(0);
    const pose = new KinematicSession(project, rig.id).setJointPosition(
        "joint-0",
        1,
      ),
      next = pose.groupFrames[shaft.groupId],
      nextPosition = toPhysics(next.position),
      caseFrame = pose.groupFrames[carrier],
      casePosition = toPhysics(caseFrame.position),
      casing = world.createCollider(
        new RAPIER.ColliderDesc(caseSolid.shape)
          .setTranslation(casePosition.x, casePosition.y, casePosition.z)
          .setRotation(frameRotation(caseFrame)),
      );
    actual.setTranslation(nextPosition);
    actual.setRotation(frameRotation(next));
    // The shaft fragment ends 0.1 LDU before the motor's Z0 entrance,
    // yet Rapier's cross-edge convex/mesh contact has a false negative sign.
    const seamDistances = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 45].flatMap(
      (angle) => {
        const witness = new KinematicSession(project, rig.id).setJointPosition(
          "joint-0",
          angle,
        ).groupFrames[shaft.groupId];
        actual.setTranslation(toPhysics(witness.position));
        actual.setRotation(frameRotation(witness));
        return [0.005012385704515608, 0.01].map(
          (prediction) =>
            actual.contactCollider(casing, prediction)?.distance ?? Infinity,
        );
      },
    );
    expect(Math.min(...seamDistances)).toBeLessThan(0);
    policy.updateGuideFrames(pose.groupFrames);
    expect(policy.allowed(shaft, caseSolid)).toBe(true);
    const crossed = structuredClone(pose.groupFrames);
    crossed[shaft.groupId].position[2] += 0.2;
    policy.updateGuideFrames(pose.groupFrames, crossed);
    expect(policy.allowed(shaft, caseSolid)).toBe(false);
    const sideways = structuredClone(pose.groupFrames);
    sideways[shaft.groupId].position[0] += 10;
    policy.updateGuideFrames(sideways);
    expect(policy.allowed(shaft, caseSolid)).toBe(false);
  } finally {
    world.free();
  }
}, 30000);

it("the mounted motor completes continuous native rotation with exact member contact pairs", async () => {
  const project = motionSample("motor-gears"),
    before = JSON.stringify(project),
    rig = project.motionRigs["technic-drive"],
    { sources } = await playSources(
      project,
      [rig.id],
      fullLibrarySources(occurrences(project).map((o) => o.node.ref)),
    ),
    world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    mirror = new RAPIER.World({ x: 0, y: 0, z: 0 });
  const motor = new DynamicRig(world, mirror, sources[0], 0, project.revision);
  try {
    motor.setJointTarget("joint-0", 360, 180);
    for (let i = 0; i < 240; i++) {
      motor.beforeStep();
      motor.stepPhysics();
      motor.afterStep();
    }
    const report = motor.snapshot();
    expect(report.pose.jointPositions["joint-0"]).toBeGreaterThan(350);
    expect(report.pose.jointPositions["joint-1"]).toBeCloseTo(
      -report.pose.jointPositions["joint-0"] / 3,
      1,
    );
    expect(report.jointTargets["joint-0"].status).toBe("complete");
    expect(JSON.stringify(project)).toBe(before);
  } finally {
    motor.dispose();
    world.free();
    mirror.free();
  }
}, 30000);
