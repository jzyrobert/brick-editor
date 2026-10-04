import { beforeAll, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { occurrences } from "../../src/core/document";
import { partsList } from "../../src/inventory/parts-list";
import { template } from "../../src/catalog/templates";
import { TEMPLATE_CARDS } from "../../src/catalog/template-names";
import { MOTION_SAMPLES } from "../../src/catalog/motion-sample-specs";
import { twinDriveFixture } from "../../src/mechanisms/twin-drive-fixture";
import { physicalPlayEligibility } from "../../src/mechanisms/physical-play";
import { resolvePhysicalMotorBinding } from "../../src/mechanisms/motor-binding";
import { validateRig } from "../../src/mechanisms/kinematic";
import { DynamicRig, type DynamicRigSource } from "../../src/play/dynamics";
import { PlayMechanism } from "../../src/play/mechanism";
import { prepareMechanicalSources } from "../../src/play/mechanical-solids";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { playSources } from "../helpers/play-dynamic-source";

let fixture: ReturnType<typeof twinDriveFixture>, source: DynamicRigSource;
beforeAll(async () => {
  registerFullLibraryFromDisk();
  await RAPIER.init();
  fixture = twinDriveFixture();
  const all = occurrences(fixture.project);
  source = (
    await playSources(
      fixture.project,
      ["twin-drive"],
      fullLibrarySources(all.map((o) => o.node.ref)),
    )
  ).sources[0];
});

it("reviews two independently mounted motors and three actual meshes on one connected frame", () => {
  const { project, proposal } = fixture,
    rig = proposal.rig!,
    all = occurrences(project);
  expect(proposal.unresolved).toEqual([]);
  expect(proposal.graph.rejected).toEqual([]);
  expect(physicalPlayEligibility(project, rig)).toEqual({ eligible: true });
  validateRig(project, rig);
  expect(all).toHaveLength(35);
  const selected = template("twin-drive");
  expect(TEMPLATE_CARDS.find((c) => c.name === "twin-drive")?.title).toBe(
    selected.title,
  );
  expect(selected.scene).toEqual({
    backdrop: "studio",
    playHint: MOTION_SAMPLES["twin-drive"].hint,
  });
  expect(
    physicalPlayEligibility(selected, selected.motionRigs[rig.id]),
  ).toEqual({ eligible: true });
  expect(rig.groups).toHaveLength(6);
  expect(rig.groups[0].occurrenceIds).toHaveLength(15);
  expect(rig.joints).toHaveLength(5);
  expect(rig.transmissions).toMatchObject([
    { jointA: "joint-0", jointB: "joint-1", teethA: 8, teethB: 8 },
    { jointA: "joint-1", jointB: "joint-2", teethA: 8, teethB: 24 },
    { jointA: "joint-3", jointB: "joint-4", teethA: 8, teethB: 8 },
  ]);
  const motors = rig.joints.filter((j) => j.motor);
  expect(motors.map((j) => j.id)).toEqual(["joint-0", "joint-3"]);
  for (const joint of motors)
    expect(
      resolvePhysicalMotorBinding(project, rig, joint, joint.motor!.binding!),
    ).toMatchObject({ engagementLdu: 10 });
  const prepared = prepareMechanicalSources([source]).get(rig.id)!;
  expect(prepared.solids.reduce((n, s) => n + s.childCount, 0)).toBe(2737);
  const detached = structuredClone(project);
  detached.models[detached.rootModelId].nodes[0].transform.position[0] += 500;
  expect(
    physicalPlayEligibility(detached, detached.motionRigs[rig.id]).eligible,
  ).toBe(false);
});

for (const dynamic of [false, true])
  it(`${dynamic ? "native" : "kinematic"} twin drive keeps proportional power, independent reversal and source`, () => {
    const { project, proposal } = fixture,
      rig = proposal.rig!,
      before = JSON.stringify(project),
      inventory = partsList(project, occurrences(project)),
      world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
      mirror = new RAPIER.World({ x: 0, y: 0, z: 0 });
    const machine = dynamic
      ? new DynamicRig(world, mirror, source, 0, project.revision)
      : new PlayMechanism(world, source, () => ({
          position: [300, -100, 300],
          walk: false,
        }));
    const step = (ticks: number) => {
      for (let i = 0; i < ticks; i++) {
        if (machine instanceof DynamicRig) {
          machine.beforeStep();
          machine.stepPhysics();
          machine.afterStep();
        } else machine.step();
      }
      const report = machine.snapshot(),
        q = report.pose.jointPositions;
      expect(q["joint-1"]).toBeCloseTo(-q["joint-0"], dynamic ? 0 : 5);
      expect(q["joint-2"]).toBeCloseTo(q["joint-0"] / 3, dynamic ? 0 : 5);
      expect(q["joint-4"]).toBeCloseTo(-q["joint-3"], dynamic ? 0 : 5);
      expect(JSON.stringify(project)).toBe(before);
      expect(partsList(project, occurrences(project))).toEqual(inventory);
      return report;
    };
    try {
      machine.setMotor("joint-0", true, 1);
      machine.setMotor("joint-3", true, 0.5);
      const forward = step(120).pose.jointPositions;
      expect(forward["joint-0"]).toBeGreaterThan(150);
      expect(forward["joint-3"]).toBeGreaterThan(65);
      expect(forward["joint-0"] / forward["joint-3"]).toBeCloseTo(2, 0);
      machine.setMotor("joint-0", true, -0.5);
      machine.setMotor("joint-3", true, 1);
      const reversed = step(120).pose.jointPositions;
      expect(reversed["joint-0"]).toBeLessThan(forward["joint-0"] - 65);
      expect(reversed["joint-3"]).toBeGreaterThan(forward["joint-3"] + 150);
      machine.setMotor("joint-3", true, 0);
      const stopped = step(60).pose.jointPositions;
      expect(Math.abs(stopped["joint-3"] - reversed["joint-3"])).toBeLessThan(
        3,
      );
      expect(stopped["joint-0"]).toBeLessThan(reversed["joint-0"] - 35);
    } finally {
      machine.dispose();
      world.free();
      mirror.free();
    }
  }, 60000);

for (const dynamic of [false, true])
  it(`${dynamic ? "native" : "kinematic"} red output obstruction stalls only its own gear train and recovers`, () => {
    const before = JSON.stringify(fixture.project),
      world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
      mirror = new RAPIER.World({ x: 0, y: 0, z: 0 }),
      machine = dynamic
        ? new DynamicRig(world, mirror, source, 0, fixture.project.revision)
        : new PlayMechanism(world, source, () => ({
            position: [300, -100, 300],
            walk: false,
          })),
      angle = Math.PI / 24,
      blocker = world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.025, 0.025, 0.08).setTranslation(
          (60 + 30 * Math.sin(angle)) * 0.02,
          (54 - 30 * Math.cos(angle)) * 0.02,
          0,
        ),
      );
    const step = (ticks: number) => {
      for (let i = 0; i < ticks; i++) {
        if (machine instanceof DynamicRig) {
          machine.beforeStep();
          machine.stepPhysics();
          machine.afterStep();
        } else machine.step();
      }
      expect(JSON.stringify(fixture.project)).toBe(before);
      return machine.snapshot();
    };
    try {
      machine.setMotor("joint-0", true, 1);
      machine.setMotor("joint-3", true, 1);
      const blocked = step(dynamic ? 360 : 120);
      expect(
        blocked.motors!["joint-0"].status,
        JSON.stringify({ motors: blocked.motors, pose: blocked.pose }),
      ).toBe("blocked");
      expect(blocked.motors!["joint-3"].status).toBe("running");
      expect(blocked.pose.jointPositions["joint-0"]).toBeLessThan(60);
      expect(blocked.pose.jointPositions["joint-3"]).toBeGreaterThan(150);
      world.removeCollider(blocker, true);
      const recovered = step(120);
      expect(recovered.motors!["joint-0"].status).toBe("running");
      expect(recovered.pose.jointPositions["joint-0"]).toBeGreaterThan(
        blocked.pose.jointPositions["joint-0"] + 150,
      );
      expect(recovered.pose.jointPositions["joint-3"]).toBeGreaterThan(
        blocked.pose.jointPositions["joint-3"] + 150,
      );
    } finally {
      machine.dispose();
      world.free();
      mirror.free();
    }
  }, 60000);
