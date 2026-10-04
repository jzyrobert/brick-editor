import { expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { Quaternion, Vector3 } from "three";
import { PlayMechanism } from "../../src/play/mechanism";
import type { Vec3 } from "../../src/core/types";
import { movingPlatformFixture } from "../../src/mechanisms/platform-fixture";
import { playSources } from "../helpers/play-dynamic-source";
import { PlaySession } from "../../src/play/session";
import { seatPoint } from "../../src/play/vehicle-seat";
import { inverse } from "../../src/core/math";

for (const dynamic of [false, true])
  for (const kind of ["lift", "turntable"] as const) {
    it(`${dynamic ? "Dynamic" : "Kinematic"} ${kind} carries a walking actor and detaches with point velocity`, async () => {
      const prepared = await playSources(movingPlatformFixture(kind), [
        "platform",
      ]);
      const source = {
        geometry: prepared.geometry,
        mechanism: prepared.sources[0],
      };
      const original = JSON.stringify(source.mechanism.project);
      const run = async () => {
        const play = await PlaySession.create(
          source.geometry,
          {
            rigId: "platform",
            ...(dynamic ? { dynamicRigIds: ["platform"] } : {}),
            position: [80, -28.3, 0],
            ground: true,
          },
          source.mechanism,
        );
        try {
          play.setMotor({
            rigId: "platform",
            jointId: "motion",
            enabled: true,
            input: 0,
          });
          play.stepTicks(10);
          const before = play.snapshot();
          expect(before.grounded).toBe(true);
          const local = seatPoint(
            inverse(before.mechanism!.groupFrames.deck),
            before.position,
          );
          play.setMotor({
            rigId: "platform",
            jointId: "motion",
            enabled: true,
            input: 1,
          });
          const carried = play.stepTicks(120);
          expect(carried.grounded).toBe(true);
          const expected = seatPoint(
            carried.mechanism!.groupFrames.deck,
            local,
          );
          expect(
            Math.hypot(...carried.position.map((v, i) => v - expected[i])),
          ).toBeLessThan(1);
          expect(
            Math.hypot(
              ...carried.position.map((v, i) => v - before.position[i]),
            ),
          ).toBeGreaterThan(20);
          play.setInput({ jump: true });
          const jumped = play.stepTicks(1);
          expect(jumped.grounded).toBe(false);
          expect(jumped.velocity[1]).toBeLessThan(-100);
          if (kind === "turntable")
            expect(
              Math.hypot(jumped.velocity[0], jumped.velocity[2]),
            ).toBeGreaterThan(20);
          expect(JSON.stringify(source.mechanism.project)).toBe(original);
          return { carried, jumped };
        } finally {
          play.dispose();
        }
      };
      expect(await run()).toEqual(await run());
    });
  }

for (const dynamic of [false, true])
  it(`${dynamic ? "Dynamic" : "Kinematic"} lift refuses a blocked carry beneath a ceiling`, async () => {
    const prepared = await playSources(movingPlatformFixture("lift"), [
      "platform",
    ]);
    const geometry = prepared.geometry,
      offset = geometry.vertices.length / 3;
    geometry.vertices = new Float32Array([
      ...geometry.vertices,
      20,
      -165,
      -50,
      130,
      -165,
      -50,
      130,
      -165,
      50,
      20,
      -165,
      50,
    ]);
    geometry.indices = new Uint32Array([
      ...geometry.indices,
      offset,
      offset + 1,
      offset + 2,
      offset,
      offset + 2,
      offset + 3,
    ]);
    const play = await PlaySession.create(
      geometry,
      {
        rigId: "platform",
        ...(dynamic ? { dynamicRigIds: ["platform"] } : {}),
        position: [80, -28.3, 0],
      },
      prepared.sources,
    );
    try {
      play.setMotor({
        rigId: "platform",
        jointId: "motion",
        enabled: true,
        input: 0,
      });
      play.stepTicks(10);
      const before = play.snapshot();
      play.setMotor({
        rigId: "platform",
        jointId: "motion",
        enabled: true,
        input: 1,
      });
      const blocked = play.stepTicks(180);
      expect(before.position[1] - blocked.position[1]).toBeLessThan(40);
      expect(() => play.teleport({ position: blocked.position })).not.toThrow();
      if (!dynamic)
        expect(blocked.mechanism!.motors!.motion.status).toBe("blocked");
    } finally {
      play.dispose();
    }
  });

it("leaves a turning support while walking, then safely re-enters Walk from Fly", async () => {
  const prepared = await playSources(movingPlatformFixture("turntable"), [
    "platform",
  ]);
  const play = await PlaySession.create(
    prepared.geometry,
    { rigId: "platform", position: [80, -28.3, 0] },
    prepared.sources,
  );
  try {
    play.setMotor({
      rigId: "platform",
      jointId: "motion",
      enabled: true,
      input: 0,
    });
    play.stepTicks(10);
    play.setMotor({
      rigId: "platform",
      jointId: "motion",
      enabled: true,
      input: 1,
    });
    play.stepTicks(30);
    const start = play.snapshot();
    play.setInput({
      yaw: Math.atan2(start.position[0], -start.position[2]),
      moveZ: 1,
    });
    const left = play.stepTicks(60);
    expect(left.position[1]).toBeGreaterThan(start.position[1]);
    play.setLocomotion("fly-noclip");
    play.teleport({ position: [80, -120, 0], policy: "free-flight" });
    play.setLocomotion("walk");
    play.setMotor({
      rigId: "platform",
      jointId: "motion",
      enabled: true,
      input: 1,
    });
    const back = play.stepTicks(30);
    expect(back.grounded).toBe(true);
    expect(Math.hypot(back.position[0], back.position[2])).toBeLessThan(90);
  } finally {
    play.dispose();
  }
});

for (const plane of [
  {
    name: "translated ground",
    origin: [0, 0.3, 0] as Vec3,
    angle: 0,
    axis: [0, -1, 0] as Vec3,
    forbidden: -6,
  },
  {
    name: "tilted ground",
    origin: [0, -2.65, 0] as Vec3,
    angle: Math.PI / 4,
    axis: [0, -1, 0] as Vec3,
    forbidden: -4,
  },
  {
    name: "vertical plane",
    origin: [3.5, 0, 0] as Vec3,
    angle: Math.PI / 2,
    axis: [1, 0, 0] as Vec3,
    forbidden: 30,
  },
])
  it(`certifies source-bound clearance above ${plane.name} and refuses travel into its solid halfspace`, async () => {
    await RAPIER.init();
    const project = movingPlatformFixture("lift"),
      joint = project.motionRigs.platform.joints[0];
    joint.limits = [-100, 200];
    joint.axisA = plane.axis;
    joint.axisB = [...plane.axis];
    const original = JSON.stringify(project);
    const prepared = await playSources(project, ["platform"]);
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    const orientation = new Quaternion().setFromAxisAngle(
      new Vector3(0, 0, 1),
      plane.angle,
    );
    world.createCollider(
      new RAPIER.ColliderDesc(new RAPIER.HalfSpace({ x: 0, y: 1, z: 0 }))
        .setTranslation(...plane.origin)
        .setRotation(orientation),
    );
    const mechanism = new PlayMechanism(world, prepared.sources[0], () => ({
      position: [1000, -100, 1000],
      walk: false,
    }));
    try {
      const clear = mechanism.setJointPosition("motion", 20);
      expect(clear.blocked).toBe(false);
      expect(clear.pose.jointPositions.motion).toBe(20);
      const blocked = mechanism.setJointPosition("motion", plane.forbidden);
      expect(blocked.blocked).toBe(true);
      expect(blocked.blockedReason).toMatch(/included ground/);
      expect(blocked.pose).toEqual(clear.pose);
      expect(JSON.stringify(project)).toBe(original);
    } finally {
      mechanism.dispose();
      world.free();
    }
  });
