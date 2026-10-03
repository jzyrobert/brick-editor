import { afterEach, beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  registerFullLibraryFromDisk,
  fullLibrarySources,
} from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import { rackFixture } from "../../src/mechanisms/rack-fixture";
import { DynamicRig } from "../../src/play/dynamics";
import { playSources } from "../helpers/play-dynamic-source";
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
async function fixture(
  mass?: number,
  mobileCarrier = false,
  rackMotor = false,
) {
  const { project, proposal } = rackFixture(),
    definition = proposal.rig!;
  if (rackMotor) {
    definition.joints[0].motor = undefined;
    definition.joints[1].motor = {
      mode: "position",
      target: 100,
      maxEffort: { value: 2000, unit: "N" },
    };
  }
  if (mass !== undefined || mobileCarrier)
    definition.dynamics = {
      groups: {
        ...(mass !== undefined ? { "moving-2": { massKg: mass } } : {}),
        ...(mobileCarrier ? { frame: { anchored: false } } : {}),
      },
    };
  const source = JSON.stringify(project);
  const { sources } = await playSources(
    project,
    [definition.id],
    fullLibrarySources(occurrences(project).map((o) => o.node.ref)),
  );
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    mirror = new RAPIER.World({ x: 0, y: 0, z: 0 });
  world.timestep = 1 / 60;
  const rig = new DynamicRig(world, mirror, sources[0], 0, project.revision);
  cleanup.push(() => {
    rig.dispose();
    world.free();
    mirror.free();
  });
  const bodies = (
    rig as unknown as { bodies: Map<string, { body: RAPIER.RigidBody }> }
  ).bodies;
  const step = (n: number) => {
    for (let i = 0; i < n; i++) {
      rig.beforeStep();
      world.step();
      rig.afterStep();
    }
    expect(JSON.stringify(project)).toBe(source);
    return rig.snapshot();
  };
  return {
    rig,
    world,
    step,
    rack: bodies.get("moving-2")!.body,
    pinion: bodies.get("moving-1")!.body,
    carrier: bodies.get("frame")!.body,
  };
}
const error = (s: ReturnType<DynamicRig["snapshot"]>) =>
  s.pose.jointPositions["joint-1"] +
  (s.pose.jointPositions["joint-0"] * Math.PI) / 18;
describe("dynamic ideal rack transmission with pinned geometry", () => {
  it("limits an authored rack position motor through the accumulated pinion coordinate", async () => {
    const { step } = await fixture(1, false, true);
    const report = step(600);
    expect(report.pose.jointPositions["joint-1"]).toBeCloseTo(100, 0);
    expect(report.pose.jointPositions["joint-0"]).toBeCloseTo(
      -1800 / Math.PI,
      0,
    );
    expect(report.motors!["joint-1"].status).toBe("holding");
  });
  it("drives through two turns, reaches the slider target and reverses without editing source", async () => {
    const { rig, step } = await fixture();
    rig.setJointTarget("joint-0", 720, 180);
    const driven = step(900);
    expect(driven.pose.jointPositions["joint-0"]).toBeCloseTo(720, 0);
    expect(Math.abs(error(driven))).toBeLessThan(0.5);
    expect(driven.jointTargets["joint-0"].status).toBe("complete");
    rig.setJointTarget("joint-1", 100, 40);
    const reversed = step(900);
    expect(reversed.pose.jointPositions["joint-1"]).toBeCloseTo(100, 0);
    expect(Math.abs(error(reversed))).toBeLessThan(0.5);
    expect(reversed.jointTargets["joint-1"].status).toBe("complete");
  });
  it("reflects rack inertia and obstruction back to its single motor", async () => {
    const light = await fixture(1),
      heavy = await fixture(10000);
    expect(
      Math.abs(heavy.step(60).pose.jointPositions["joint-0"]),
    ).toBeLessThan(
      Math.abs(light.step(60).pose.jointPositions["joint-0"]) * 0.5,
    );
    const stuck = await fixture();
    stuck.rack.lockTranslations(true, true);
    expect(
      Math.abs(stuck.step(180).pose.jointPositions["joint-0"]),
    ).toBeLessThan(10);
    stuck.rack.lockTranslations(false, true);
    expect(stuck.step(300).pose.jointPositions["joint-0"]).toBeGreaterThan(90);
  });
  it("backdrives the unpowered pinion from a physical rack impulse", async () => {
    const { rig, rack, step } = await fixture(1);
    rig.setMotor("joint-0", false);
    rack.applyImpulse({ x: 1, y: 0, z: 0 }, true);
    const report = step(90);
    expect(report.pose.jointPositions["joint-1"]).toBeGreaterThan(1);
    expect(report.pose.jointPositions["joint-0"]).toBeLessThan(-5);
    expect(Math.abs(error(report))).toBeLessThan(0.5);
  });
  it("returns rack force and pinion torque to a mobile carrier", async () => {
    const { rig, rack, carrier, world, step } = await fixture(1, true);
    rig.setMotor("joint-0", false);
    rack.applyImpulse({ x: 1, y: 0, z: 0 }, true);
    const total = () => {
      let p = 0;
      world.forEachRigidBody((b) => (p += b.mass() * b.linvel().x));
      return p;
    };
    world.forEachRigidBody((b) => {
      b.setLinearDamping(0);
      b.setAngularDamping(0);
    });
    const initial = total();
    step(30);
    expect(carrier.linvel().x).toBeGreaterThan(0);
    // Native joints preserve momentum too; avoid asserting just copied speeds.
    expect(total()).toBeCloseTo(initial, 3);
  });
  it("conserves angular momentum in each coupled impulse pass", async () => {
    const { rig, rack, world } = await fixture(1, true);
    rig.setMotor("joint-0", false);
    world.forEachRigidBody((b) => {
      b.setLinearDamping(0);
      b.setAngularDamping(0);
    });
    rack.applyImpulse({ x: 1, y: 0, z: 0 }, true);
    const momentum = () => {
      const total = { x: 0, y: 0, z: 0 };
      world.forEachRigidBody((b) => {
        const copy = (v: RAPIER.Vector) => ({ x: v.x, y: v.y, z: v.z });
        const w = copy(b.angvel()),
          p = copy(b.worldCom()),
          v = copy(b.linvel()),
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
    for (let i = 0; i < 120; i++) {
      rig.beforeStep();
      world.step();
      const before = momentum();
      rig.afterStep();
      const after = momentum();
      expect(
        Math.abs(after.x - before.x) +
          Math.abs(after.y - before.y) +
          Math.abs(after.z - before.z),
      ).toBeLessThan(1e-5);
    }
  });
});
