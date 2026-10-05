import RAPIER from "@dimforge/rapier3d-compat";
import { Quaternion, Vector3 } from "three";
import { beforeAll, expect, it } from "vitest";
import { occurrences } from "../../src/core/document";
import { add, mv } from "../../src/core/math";
import type { Transform, Vec3 } from "../../src/core/types";
import { exportLDraw } from "../../src/ldraw/io";
import { partsList } from "../../src/inventory/parts-list";
import { physicalPlayEligibility } from "../../src/mechanisms/physical-play";
import { axisRotation } from "../../src/mechanisms/kinematic";
import { loadArocsBallContacts } from "../../src/play/arocs-ball-contacts";
import { DynamicRig } from "../../src/play/dynamics";
import { prepareMechanicalSources } from "../../src/play/mechanical-solids";
import { PlaySession } from "../../src/play/session";
import { toPhysics, frameRotation } from "../../src/play/physics-frame";
import { arocsBallFixture } from "../helpers/arocs-ball-source";
beforeAll(() => RAPIER.init());
const poses: Array<Transform | undefined> = [
  undefined,
  {
    position: [80, -60, 120],
    basis: axisRotation(
      [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)],
      37,
    ),
  },
];
it.each(poses)(
  "enters through exact bound source eligibility with both spherical bodies mobile at pose%j",
  async (pose) => {
    const f = await arocsBallFixture(pose, true),
      before = JSON.stringify(f.project),
      text = exportLDraw(f.project),
      inventory = partsList(f.project, occurrences(f.project));
    await loadArocsBallContacts([f.source]);
    expect(
      physicalPlayEligibility(
        f.project,
        f.project.motionRigs.ball,
        occurrences(f.project),
        f.source,
      ).eligible,
    ).toBe(true);
    const session = await PlaySession.create(
      f.geometry,
      {
        rigIds: ["ball"],
        dynamicRigIds: ["ball"],
        ground: false,
        realtime: false,
        locomotion: "fly-noclip",
        position: [300, -200, 400],
      },
      [f.source],
    );
    try {
      session.stepTicks(2);
      const report = session.snapshot().mechanisms!.ball;
      expect(Object.values(report.dynamics!.bodies)).toHaveLength(2);
      expect(
        Object.values(report.dynamics!.bodies).every((b) => !b.anchored),
      ).toBe(true);
      expect(report.transforms[f.ball.id]).toBeDefined();
      expect(report.transforms[f.socket.id]).toBeDefined();
      expect(JSON.stringify(f.project)).toBe(before);
      expect(exportLDraw(f.project)).toBe(text);
      expect(partsList(f.project, occurrences(f.project))).toEqual(inventory);
    } finally {
      session.dispose();
    }
  },
  30000,
);
it.each(poses)(
  "retains mobile carrier reaction and momentum under the source-bound DynamicRig path at pose%j",
  async (pose) => {
    const f = await arocsBallFixture(pose, true),
      before = JSON.stringify(f.project),
      inventory = partsList(f.project, occurrences(f.project));
    await loadArocsBallContacts([f.source]);
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
      walking = new RAPIER.World({ x: 0, y: 0, z: 0 });
    world.timestep = 1 / 60;
    const prepared = prepareMechanicalSources([f.source]).get("ball")!;
    expect(prepared.solids.reduce((n, s) => n + s.childCount, 0)).toBe(607);
    expect(prepared.solids.length).toBe(5);
    const native = new DynamicRig(
        world,
        walking,
        f.source,
        0,
        f.project.revision,
        prepared,
      ),
      bodies = native.gripSource().groups;
    const ball = bodies.find((b) => b.groupId === "ball")!.body,
      socket = bodies.find((b) => b.groupId === "socket")!.body;
    const pivot = (groupId: string, anchor: Vec3) => {
      const t = native.snapshot().groupFrames[groupId];
      return add(t.position, mv(t.basis, anchor));
    };
    let drift = 0;
    const step = (n: number) => {
      for (let i = 0; i < n; i++) {
        // Keep this controlled zero-damping momentum witness awake; native
        // sleep deliberately discards subthreshold velocities.
        for (const b of bodies) b.body.wakeUp();
        native.beforeStep();
        native.stepPhysics();
        native.afterStep();
        const a = pivot("ball", [-10, 0, 0]),
          b = pivot("socket", [0, 0, 0]);
        drift = Math.max(drift, Math.hypot(...a.map((v, k) => v - b[k])));
      }
    };
    try {
      expect(ball.isDynamic() && socket.isDynamic()).toBe(true);
      ball.setLinearDamping(0);
      ball.setAngularDamping(0);
      socket.setLinearDamping(0);
      socket.setAngularDamping(0);
      ball.applyImpulse({ x: 1, y: 0, z: 0 }, true);
      step(120);
      const total = bodies.reduce(
        (p, b) => p + b.body.mass() * b.body.linvel().x,
        0,
      );
      expect(total).toBeCloseTo(1, 5);
      expect(Math.hypot(...Object.values(socket.linvel()))).toBeGreaterThan(
        0.0001,
      );
      expect(drift).toBeLessThan(0.05);
      // Start a separate declared hand-torque witness from rest velocities.
      for (const b of bodies) {
        b.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        b.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
      const beforeHand = new Quaternion().copy(socket.rotation() as Quaternion);
      const axis = new Vector3(0, 0, 1).applyQuaternion(
        frameRotation(f.groups[0].frame),
      );
      for (let i = 0; i < 360; i++) {
        ball.resetTorques(false);
        ball.addTorque(
          { x: 0.2 * axis.x, y: 0.2 * axis.y, z: 0.2 * axis.z },
          true,
        );
        step(1);
      }
      const q = new Quaternion().copy(socket.rotation() as Quaternion);
      expect(q.angleTo(beforeHand)).toBeGreaterThan(0.001);
      expect(drift).toBeLessThan(0.05);
      expect(JSON.stringify(f.project)).toBe(before);
      expect(partsList(f.project, occurrences(f.project))).toEqual(inventory);
    } finally {
      native.dispose();
      world.free();
      walking.free();
    }
  },
  30000,
);
