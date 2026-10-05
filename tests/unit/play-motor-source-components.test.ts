import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, describe, expect, it } from "vitest";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { pfLargeSource } from "../helpers/pf-large-source";
import { identity } from "../../src/core/math";
import {
  prepareMechanicalSources,
  MechanicalContactPolicy,
} from "../../src/play/mechanical-solids";
import {
  isMotorComponentSolid,
  loadMotorSourceComponents,
  motorComponentSolids,
  motorComponentContactAllowed,
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
});
