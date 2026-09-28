import { describe, expect, it } from "vitest";
import { physicsFixture } from "../../src/mechanisms/fixtures";
import { validateRig } from "../../src/mechanisms/kinematic";
import { PlaySession } from "../../src/play/session";
import { proxyPoints } from "../../src/play/dynamics";
import { validate } from "../../src/core/validate";
import { playSources } from "../helpers/play-dynamic-source";

const IDS = ["crate", "door", "spinner", "vehicle"];
async function session(
  dynamic: string[] = IDS,
  position: [number, number, number] = [-120, -0.3, 140],
) {
  const project = physicsFixture();
  const { geometry, sources } = await playSources(project, IDS);
  const original = JSON.stringify(project);
  const play = await PlaySession.create(
    geometry,
    { rigIds: IDS, dynamicRigIds: dynamic, position },
    sources,
  );
  return { play, project, original };
}
const report = (play: PlaySession, id: string) =>
  play.snapshot().mechanisms![id];

describe("dynamic Play physics", () => {
  it("replays the same inputs to identical fixed-tick reports", async () => {
    const run = async () => {
      const { play } = await session();
      play.setJointTarget({
        rigId: "door",
        jointId: "hinge",
        target: 90,
        speed: 90,
      });
      play.setMechanismVehicleInput({ throttle: 1, steering: 0.5 }, "vehicle");
      play.setInput({ moveZ: 1 });
      play.stepTicks(150);
      const out = play.snapshot();
      play.dispose();
      return out;
    };
    const [a, b] = [await run(), await run()];
    expect(a.tick).toBe(150);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    validate("playSnapshot", a);
  });

  it("drives a joint through its motor to the requested angle and never edits the build", async () => {
    const { play, project, original } = await session();
    expect(() => play.setMechanismJoint("hinge", 45, "door")).toThrow(
      /dynamically/,
    );
    play.setJointTarget({
      rigId: "door",
      jointId: "hinge",
      target: 90,
      speed: 90,
    });
    play.stepTicks(20);
    const moving = report(play, "door").jointTargets.hinge;
    expect(moving.status).toBe("moving");
    expect(moving.current).toBeGreaterThan(10);
    play.stepTicks(100);
    const done = report(play, "door");
    expect(done.mode).toBe("dynamic");
    expect(done.jointTargets.hinge.status).toBe("complete");
    expect(Math.abs(done.pose.jointPositions.hinge - 90)).toBeLessThan(1.5);
    expect(done.dynamics!.bodies.frame.anchored).toBe(true);
    expect(done.dynamics!.bodies.door.anchored).toBe(false);
    // The rendered transforms rotate the door about the authored hinge.
    const doorId = project.motionRigs.door.groups[1].occurrenceIds[0];
    expect(done.transforms[doorId].basis[0]).toBeCloseTo(0, 1);
    expect(JSON.stringify(project)).toBe(original);
    play.dispose();
  });

  it("lets the explorer push a loose crate that stays put when kinematic", async () => {
    for (const dynamic of [[], IDS]) {
      const { play } = await session(dynamic);
      play.stepTicks(30);
      const before = report(play, "crate").groupFrames.crate.position;
      play.setInput({ moveZ: 1 });
      play.stepTicks(90);
      const after = report(play, "crate").groupFrames.crate.position;
      if (dynamic.length) {
        expect(after[2]).toBeLessThan(before[2] - 30);
        // It slides on the ground rather than sinking or flying.
        expect(Math.abs(after[1] - before[1])).toBeLessThan(2);
      } else expect(after).toEqual(before);
      play.dispose();
    }
  });

  it("runs velocity motors: exact kinematic rate, simulated spin-up, stop and blocking", async () => {
    const kinematic = await session([], [300, -0.3, 300]);
    kinematic.play.stepTicks(60);
    const k = report(kinematic.play, "spinner");
    expect(k.pose.jointPositions.axle).toBeCloseTo(90, 6);
    expect(k.motors!.axle).toMatchObject({
      status: "running",
      simulation: "kinematic-rate",
      targetUnits: "degrees/s",
    });
    kinematic.play.setMotor({
      rigId: "spinner",
      jointId: "axle",
      enabled: false,
    });
    kinematic.play.stepTicks(30);
    expect(
      report(kinematic.play, "spinner").pose.jointPositions.axle,
    ).toBeCloseTo(90, 6);
    expect(report(kinematic.play, "spinner").motors!.axle.status).toBe(
      "stopped",
    );
    // Standing inside the paddle's sweep stops the kinematic motor.
    kinematic.play.teleport({ position: [200, -0.3, 60] });
    kinematic.play.setMotor({
      rigId: "spinner",
      jointId: "axle",
      enabled: true,
    });
    kinematic.play.stepTicks(120);
    const blocked = report(kinematic.play, "spinner");
    expect(blocked.motors!.axle.status).toBe("blocked");
    kinematic.play.teleport({ position: [300, -0.3, 300] });
    kinematic.play.stepTicks(2);
    expect(report(kinematic.play, "spinner").motors!.axle.status).toBe(
      "running",
    );
    kinematic.play.dispose();

    const dynamic = await session(IDS, [300, -0.3, 300]);
    dynamic.play.stepTicks(120);
    const d = report(dynamic.play, "spinner");
    expect(d.motors!.axle.simulation).toBe("dynamic-motor");
    const spun = d.pose.jointPositions.axle;
    expect(spun).toBeGreaterThan(120);
    dynamic.play.stepTicks(60);
    const rate =
      report(dynamic.play, "spinner").pose.jointPositions.axle - spun;
    expect(rate).toBeGreaterThan(80);
    expect(rate).toBeLessThan(100);
    dynamic.play.dispose();
  });

  it("drives the car on sprung ray-cast wheels with the kinematic steering convention", async () => {
    const { play } = await session(IDS, [300, -0.3, 300]);
    play.stepTicks(40);
    const rest = report(play, "vehicle");
    for (const wheel of Object.values(rest.dynamics!.wheels!)) {
      expect(wheel.contact).toBe(true);
      // Compressed by the chassis weight within the declared travel.
      expect(wheel.suspensionLength).toBeGreaterThan(1);
      expect(wheel.suspensionLength).toBeLessThan(6);
    }
    play.setMechanismVehicleInput({ throttle: 1, steering: 0 }, "vehicle");
    play.stepTicks(60);
    const forward = report(play, "vehicle").pose.vehicle!;
    expect(forward.position[2]).toBeLessThan(-50);
    expect(Math.abs(forward.position[0])).toBeLessThan(1);
    // Top speed respects the authored maxSpeed (100 LDU/s).
    expect(report(play, "vehicle").dynamics!.speed!).toBeLessThan(110);
    play.setMechanismVehicleInput({ throttle: 1, steering: 1 }, "vehicle");
    play.stepTicks(45);
    const turned = report(play, "vehicle").pose.vehicle!;
    // Positive steering increases heading towards +X, as in kinematic mode.
    expect(turned.headingDegrees).toBeGreaterThan(15);
    expect(turned.position[0]).toBeGreaterThan(forward.position[0]);
    play.setMechanismVehicleInput({ throttle: 0, steering: 0 }, "vehicle");
    play.stepTicks(120);
    const stopped = report(play, "vehicle").pose.vehicle!.position;
    play.stepTicks(60);
    const still = report(play, "vehicle").pose.vehicle!.position;
    expect(Math.hypot(...still.map((v, k) => v - stopped[k]))).toBeLessThan(3);
    play.dispose();
  });

  it("validates requests, settings and proxy inputs before simulating", async () => {
    const project = physicsFixture();
    const { geometry, sources } = await playSources(project, IDS);
    await expect(
      PlaySession.create(
        geometry,
        { rigIds: ["door"], dynamicRigIds: ["vehicle"] },
        sources.filter((s) => s.rigId === "door"),
      ),
    ).rejects.toThrow(/dynamicRigIds/);
    const broken = sources.map((s) =>
      s.rigId === "crate" ? { ...s, members: {} } : s,
    );
    await expect(
      PlaySession.create(
        geometry,
        { rigIds: IDS, dynamicRigIds: ["crate"] },
        broken,
      ),
    ).rejects.toThrow(/every member/);
    const rig = structuredClone(project.motionRigs.vehicle);
    rig.dynamics = { groups: { chassis: { anchored: true } } };
    expect(() => validateRig(project, rig)).toThrow(/cannot be anchored/);
    rig.dynamics = { groups: { nowhere: { massKg: 2 } } };
    expect(() => validateRig(project, rig)).toThrow(/unknown group/);
    rig.dynamics = {
      suspension: { restLength: 6, travel: 5, stiffness: 0, damping: 4 },
    };
    expect(() => validateRig(project, rig)).toThrow(/Suspension/);
    const door = structuredClone(project.motionRigs.door);
    door.dynamics = {
      suspension: { restLength: 6, travel: 5, stiffness: 40, damping: 4 },
    };
    expect(() => validateRig(project, door)).toThrow(/vehicle/);
  });

  it("reduces convex proxy points without inflating them", () => {
    const vertices: number[] = [];
    for (let i = 0; i < 2000; i++) {
      const a = (i / 2000) * Math.PI * 2;
      vertices.push(Math.cos(a) * 40, (i % 7) * 3, Math.sin(a) * 40);
    }
    const points = proxyPoints(
      {
        revision: 0,
        vertices: new Float32Array(vertices),
        indices: new Uint32Array(),
        bounds: { min: [0, 0, 0], max: [0, 0, 0] },
      },
      [0, 0, 0],
      64,
    );
    expect(points.length / 3).toBeLessThanOrEqual(64);
    for (let i = 0; i < points.length; i += 3)
      expect(Math.hypot(points[i], points[i + 2]) / 0.02).toBeLessThanOrEqual(
        40.001,
      );
  });
});
