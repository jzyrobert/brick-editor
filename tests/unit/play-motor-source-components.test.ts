import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, describe, expect, it } from "vitest";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { pfLargeSource } from "../helpers/pf-large-source";
import { add, compose, identity, inverse, mv } from "../../src/core/math";
import { axisRotation, KinematicSession } from "../../src/mechanisms/kinematic";
import {
  fromPhysics,
  toPhysics,
  METRES_PER_LDU,
} from "../../src/play/physics-frame";
import {
  prepareMechanicalSources,
  MechanicalContactPolicy,
} from "../../src/play/mechanical-solids";
import {
  isMotorComponentSolid,
  loadMotorSourceComponents,
  motorComponentSolids,
  motorComponentContactAllowed,
  prepareMotorSourceSweep,
  motorSourceSweepTravel,
} from "../../src/play/motor-source-components";
import { exportLDraw } from "../../src/ldraw/io";
import { requirePhysicalPlay } from "../../src/mechanisms/physical-play";
import { PlaySession } from "../../src/play/session";

beforeAll(async () => {
  expect(registerFullLibraryFromDisk()).toBe(true);
  await RAPIER.init();
});
describe("real PF-L internal collision ownership", () => {
  it.each([false, true])(
    "runs actual PF-L case/output ownership through %s native session",
    async (dynamic) => {
      const { source, rig, project, geometry, all } = await pfLargeSource(
        identity(),
        23,
      );
      const before = exportLDraw(project);
      const session = await PlaySession.create(
        geometry,
        {
          rigId: rig.id,
          dynamicRigIds: dynamic ? [rig.id] : [],
          ground: false,
          locomotion: "fly-noclip",
          position: [300, -200, 400],
        },
        source,
      );
      try {
        session.setMotor({
          rigId: rig.id,
          jointId: "motor-output",
          enabled: true,
          input: 1,
          power: 1,
        });
        const forward = session.stepTicks(dynamic ? 60 : 20).mechanism!;
        expect(forward.pose.jointPositions["motor-output"]).toBeGreaterThan(10);
        for (let i = 0; i < 3; i++)
          expect(forward.transforms[all[0].id].position[i]).toBeCloseTo(
            all[0].transform.position[i],
            4,
          );
        expect(forward.transforms[all[0].id].basis).toEqual(
          all[0].transform.basis,
        );
        session.setMotor({
          rigId: rig.id,
          jointId: "motor-output",
          enabled: true,
          input: -1,
          power: 1,
        });
        const reverse = session.stepTicks(dynamic ? 60 : 40).mechanism!;
        expect(reverse.pose.jointPositions["motor-output"]).toBeLessThan(
          forward.pose.jointPositions["motor-output"] - 10,
        );
        session.setMotor({
          rigId: rig.id,
          jointId: "motor-output",
          enabled: true,
          input: -1,
          power: 0,
        });
        const stopped = session.stepTicks(2).mechanism!;
        expect(stopped.motors!["motor-output"].power).toBe(0);
        expect(stopped.motors!["motor-output"].status).toBe("stopped");
        session.setMotor({
          rigId: rig.id,
          jointId: "motor-output",
          enabled: true,
          input: -1,
          power: 0.5,
        });
        const resumed = session.stepTicks(dynamic ? 60 : 20).mechanism!;
        expect(resumed.pose.jointPositions["motor-output"]).toBeLessThan(
          stopped.pose.jointPositions["motor-output"] - 5,
        );
        expect(resumed.motors!["motor-output"].power).toBe(0.5);
        expect(exportLDraw(project)).toBe(before);
      } finally {
        session.dispose();
      }
    },
    // Complete source contacts take ~40s for this case on the shared VM.
    60000,
  );
  it("owns every original case/output source triangle once and retains independent native hollow components", async () => {
    const { source, rig, project, all } = await pfLargeSource(identity(), 23),
      before = exportLDraw(project);
    requirePhysicalPlay(project, rig, all, source);
    expect(
      Object.values(source.groups).reduce((n, g) => n + g.indices.length, 0),
    ).toBe(
      Object.values(source.members!).reduce((n, g) => n + g.indices.length, 0),
    );
    const prepared = prepareMechanicalSources([source]).get(rig.id)!;
    const casing = prepared.stationary.filter(
        (s) => s.groupId === "carrier" && isMotorComponentSolid(s),
      ),
      output = prepared.solids.filter(isMotorComponentSolid);
    expect(casing).toHaveLength(2);
    expect(casing.reduce((n, s) => n + s.childCount, 0)).toBe(2854);
    expect(output).toHaveLength(4);
    expect(
      output.every((s) => s.groupId === "output" && s.memberId !== all[0].id),
    ).toBe(true);
    expect(output.reduce((n, s) => n + s.childCount, 0)).toBeGreaterThan(140);
    expect(
      [...casing, ...output].every((s) => s.shape instanceof RAPIER.Compound),
    ).toBe(true);
    for (const s of [...casing, ...output]) {
      let radiusLdu = 0;
      for (let i = 0; i < s.points.length; i += 3)
        radiusLdu = Math.max(
          radiusLdu,
          Math.hypot(s.points[i], s.points[i + 1], s.points[i + 2]) /
            METRES_PER_LDU,
        );
      expect(s.radius).toBeCloseTo(radiusLdu, 8);
    }
    expect(exportLDraw(project)).toBe(before);
    expect(all).toHaveLength(13);
  });
  it("allows only the source bearing fragment and refuses displaced envelopes, rotor disc and foreign members", async () => {
    const { source, rig } = await pfLargeSource();
    const casing = motorComponentSolids(
        source,
        rig.groups[0],
        rig.groups[0].occurrenceIds[0],
      )![0],
      output = motorComponentSolids(source, rig.groups[1])!;
    const frame = Object.fromEntries(rig.groups.map((g) => [g.id, g.frame]));
    const policy = new MechanicalContactPolicy(rig, source);
    const allowances = output.map((s) =>
      motorComponentContactAllowed(source, casing, s, [frame]),
    );
    expect(allowances.sort()).toEqual([false, false, true, true]);
    const hub = output.find((s) =>
      motorComponentContactAllowed(source, casing, s, [frame]),
    )!;
    const shifted = { ...frame, output: structuredClone(frame.output) };
    shifted.output.position[0] += 2;
    expect(
      motorComponentContactAllowed(source, casing, hub, [frame, shifted]),
    ).toBe(false);
    const foreign = { ...hub, memberId: "foreign" };
    expect(motorComponentContactAllowed(source, casing, foreign, [frame])).toBe(
      false,
    );
    expect(policy.allowed(casing, output.find((s) => s !== hub)!)).toBe(false);
    // Independent exact Float32 support-point oracle for the source aperture.
    // Full turns, small off-axis drift and both prediction endpoints must keep
    // the same decisions after the conservative positive certificate.
    const caseRest =
      source.motorComponents![rig.groups[0].occurrenceIds[0]].case.frame;
    const caseLocal = compose(inverse(rig.groups[0].frame), caseRest);
    for (let n = 0; n < 40; n++) {
      const pose = {
        ...frame,
        output: compose(frame.output, {
          position: [(n % 3) * 0.002, 0, (n % 4) * 0.001],
          basis: axisRotation([0, 0, 1], n * 137 - 720),
        }),
      };
      const next = {
        ...pose,
        output: compose(pose.output, {
          position: [0, 0, (n % 5) * 0.01],
          basis: axisRotation([1, 0, 0], (n % 3) * 0.001),
        }),
      };
      const expected = [pose, next].every((f) => {
        const relative = compose(
          inverse(compose(frame.carrier, caseLocal)),
          f.output,
        );
        for (let i = 0; i < hub.points.length; i += 3) {
          const p = add(
            relative.position,
            mv(
              relative.basis,
              fromPhysics({
                x: hub.points[i],
                y: hub.points[i + 1],
                z: hub.points[i + 2],
              }),
            ),
          );
          if (Math.hypot(p[0], p[1]) > 9.102 || p[2] < -0.052 || p[2] > 22.052)
            return false;
        }
        return true;
      });
      expect(
        motorComponentContactAllowed(source, casing, hub, [pose, next]),
      ).toBe(expected);
    }
  });
  it("refuses altered component buffers before allocating collision shapes", async () => {
    const { source, all } = await pfLargeSource();
    const capture = source.motorComponents![all[0].id];
    capture.output = {
      ...capture.output,
      vertices: capture.output.vertices.slice(),
    };
    capture.output.vertices[0] += 1;
    await expect(loadMotorSourceComponents([source])).rejects.toThrow(
      "matching case and output",
    );
  });
  it("bounds every actual source support point and falls back for moving carriers, copies and coupled rigs", async () => {
    const f = await pfLargeSource(identity(), 23),
      prepared = prepareMechanicalSources([f.source]).get(f.rig.id)!;
    prepareMotorSourceSweep(f.source, prepared.solids);
    const session = new KinematicSession(f.project, f.rig.id),
      before = session.snapshot();
    session.setJointPosition("motor-output", 1.5);
    const after = session.snapshot();
    let max = 0;
    for (const solid of prepared.solids) {
      const bound = motorSourceSweepTravel(f.source, solid, before, after)!;
      expect(bound).toBeGreaterThan(0);
      max = Math.max(max, bound);
      for (let i = 0; i < solid.points.length; i += 3) {
        const p = fromPhysics({
          x: solid.points[i],
          y: solid.points[i + 1],
          z: solid.points[i + 2],
        });
        const a = add(
            before.groupFrames.output.position,
            mv(before.groupFrames.output.basis, p),
          ),
          b = add(
            after.groupFrames.output.position,
            mv(after.groupFrames.output.basis, p),
          );
        expect(Math.hypot(...a.map((v, k) => v - b[k]))).toBeLessThanOrEqual(
          bound,
        );
      }
    }
    expect(max).toBeLessThan(0.53);
    expect(
      motorSourceSweepTravel(
        f.source,
        { ...prepared.solids[0] },
        before,
        after,
      ),
    ).toBeUndefined();
    const moved = structuredClone(after);
    moved.groupFrames.carrier.position[0] += 0.01;
    expect(
      motorSourceSweepTravel(f.source, prepared.solids[0], before, moved),
    ).toBeUndefined();
    session.setJointPosition("motor-output", 720);
    expect(
      motorSourceSweepTravel(
        f.source,
        prepared.solids[0],
        before,
        session.snapshot(),
      ),
    ).toBeGreaterThan(100);
    f.rig.joints.push({ ...f.rig.joints[0], id: "other" });
    expect(
      motorSourceSweepTravel(f.source, prepared.solids[0], before, after),
    ).toBeUndefined();
  });
  it("stops the actual rotor pins at a foreign obstruction and resumes after removal", async () => {
    const f = await pfLargeSource(),
      session = await PlaySession.create(
        f.geometry,
        {
          rigId: f.rig.id,
          ground: false,
          locomotion: "fly-noclip",
          position: [300, -200, 400],
        },
        f.source,
      );
    try {
      const runtime = (session as any).rigTarget(f.rig.id).rig;
      const exterior = runtime.contactSolids.find(
        (s: import("../../src/play/mechanical-solids").MechanicalSolid) =>
          isMotorComponentSolid(s) && s.childCount === 68,
      )!;
      let tip: import("../../src/core/types").Vec3 = [0, 0, -Infinity];
      for (let i = 0; i < exterior.points.length; i += 3) {
        const p = fromPhysics({
          x: exterior.points[i],
          y: exterior.points[i + 1],
          z: exterior.points[i + 2],
        });
        if (p[2] > tip[2]) tip = p;
      }
      expect(Math.hypot(tip[0], tip[1])).toBeGreaterThan(10);
      const ahead = add(
          f.rig.groups[1].frame.position,
          mv(axisRotation([0, 0, 1], 8), tip),
        ),
        p = toPhysics(ahead),
        world: RAPIER.World = (session as any).world;
      const obstacle = world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.015, 0.015, 0.015).setTranslation(
          p.x,
          p.y,
          p.z,
        ),
      );
      session.setMotor({
        rigId: f.rig.id,
        jointId: "motor-output",
        enabled: true,
        input: 1,
        power: 1,
      });
      const stopped = session.stepTicks(20).mechanism!;
      expect(stopped.pose.jointPositions["motor-output"]).toBeLessThan(12);
      expect(stopped.motors!["motor-output"].status).toBe("blocked");
      world.removeCollider(obstacle, true);
      session.setMotor({
        rigId: f.rig.id,
        jointId: "motor-output",
        enabled: true,
        input: 1,
        power: 1,
      });
      const resumed = session.stepTicks(10).mechanism!;
      expect(resumed.pose.jointPositions["motor-output"]).toBeGreaterThan(
        stopped.pose.jointPositions["motor-output"] + 10,
      );
    } finally {
      session.dispose();
    }
  }, 30000);
});
