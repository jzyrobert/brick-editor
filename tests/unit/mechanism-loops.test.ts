import { describe, expect, it } from "vitest";
import {
  axisRotation,
  KinematicSession,
  validateRig,
} from "../../src/mechanisms/kinematic";
import { loopFixture } from "../../src/mechanisms/loop-fixture";
import { closureResidual } from "../../src/mechanisms/loops";
import { exportLDraw } from "../../src/ldraw/io";
import { decodeNative, encodeNative } from "../../src/persistence/native";
import { Editor } from "../../src/core/commands";
import { uid } from "../../src/core/types";

describe("explicit closed planar linkages", () => {
  for (const kind of ["four-bar", "slider-crank"] as const)
    it(`closes a rotated ${kind} over repeated full turns without changing independent inputs or source`, () => {
      const { project, rig } = loopFixture(kind, {
          basis: axisRotation(
            [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)],
            73,
          ),
          position: [300, -200, 100],
        }),
        source = JSON.stringify(project),
        rest = exportLDraw(project);
      const a = new KinematicSession(project, rig.id),
        b = new KinematicSession(project, rig.id);
      for (let angle = 1; angle <= 1080; angle++) {
        const report = a.setJointPosition("drive", angle);
        expect(report.pose.jointPositions.drive).toBe(angle);
        expect(
          Math.max(
            ...closureResidual(rig, report.pose.jointPositions).map(Math.abs),
          ),
        ).toBeLessThanOrEqual(0.001);
        b.setJointPosition("drive", angle);
        if (kind === "four-bar")
          expect(report.pose.jointPositions.rod).toBeCloseTo(-angle, 2);
      }
      expect(a.snapshot()).toEqual(b.snapshot());
      expect(JSON.stringify(project)).toBe(source);
      expect(exportLDraw(project)).toBe(rest);
    }, 15000);
  it("refuses passive commands, inconsistent poses and unreachable limited geometry atomically", () => {
    const { project, rig } = loopFixture("four-bar");
    rig.joints[1].limits = [-10, 10];
    rig.joints[2].limits = [-1, 1];
    const session = new KinematicSession(project, rig.id),
      before = session.snapshot();
    expect(() => session.setJointPosition("rod", 1)).toThrow(/passive/);
    expect(() => session.setJointPosition("drive", 45)).toThrow(/cannot close/);
    expect(session.snapshot()).toEqual(before);
    expect(() =>
      session.setPose({ jointPositions: { drive: 5, rod: 0, output: 0 } }),
    ).toThrow(/close/);
    expect(session.snapshot()).toEqual(before);
  });
  it("continues a known branch through dead centers but refuses ambiguous cold toggles atomically", () => {
    const { project, rig } = loopFixture();
    const warm = new KinematicSession(project, rig.id);
    for (const angle of [89, 90, 91, 269, 270, 271, 270, 269]) {
      const report = warm.setJointPosition("drive", angle);
      expect(report.pose.jointPositions.rod).toBeCloseTo(-angle, 2);
      expect(
        Math.max(
          ...closureResidual(rig, report.pose.jointPositions).map(Math.abs),
        ),
      ).toBeLessThan(0.001);
    }
    for (const angle of [90, 270]) {
      const cold = new KinematicSession(project, rig.id);
      cold.setPose({
        jointPositions: { drive: angle, rod: -angle, output: angle },
      });
      const before = cold.snapshot();
      expect(() => cold.setJointPosition("drive", angle + 1)).toThrow(
        /ambiguous dead center/,
      );
      expect(cold.snapshot()).toEqual(before);
      cold.setPose({ jointPositions: { drive: 89, rod: -89, output: 89 } });
      expect(
        cold.setJointPosition("drive", 91).pose.jointPositions.rod,
      ).toBeCloseTo(-91, 2);
    }
  });
  it("validates planar topology, axes, anchors, dependency ownership and bounded work", () => {
    const { project, rig } = loopFixture();
    const reject = (edit: (r: typeof rig) => void, pattern: RegExp) => {
      const r = structuredClone(rig);
      edit(r);
      expect(() => validateRig(project, r)).toThrow(pattern);
    };
    reject((r) => {
      r.loopClosures![0].anchorA[0] += 2;
    }, /close/);
    reject((r) => {
      r.loopClosures![0].axisB = [1, 0, 0];
    }, /planar/);
    reject((r) => {
      r.joints[1].motor = {
        mode: "velocity",
        target: 1,
        maxEffort: { value: 1, unit: "N*m" },
      };
    }, /motors/);
    reject((r) => {
      r.loopClosures![0].dependentJointIds = ["drive", "rod"];
    }, /motors/);
    reject((r) => {
      r.loopClosures![0].dependentJointIds = ["rod", "rod"];
    }, /distinct/);
    reject((r) => {
      r.loopClosures!.push({ ...r.loopClosures![0], id: "duplicate-closure" });
    }, /redundant/);
    reject((r) => {
      r.loopClosures = Array.from({ length: 9 }, (_, i) => ({
        ...r.loopClosures![0],
        id: `loop${i}`,
      }));
    }, /eight/);
    reject((r) => {
      r.joints.push({
        ...r.joints[0],
        id: "cycle",
        bodyA: "output",
        bodyB: "frame",
        anchorA: [0, 40, 0],
        anchorB: [100, 0, 0],
      });
    }, /cycle/);
  });
  it("preserves closures through native persistence, posed apply/rebase and undo", async () => {
    const { project, rig } = loopFixture();
    const session = new KinematicSession(project, rig.id);
    const report = session.setJointPosition("drive", 35);
    const saved = await decodeNative(await encodeNative(project));
    expect(saved.motionRigs).toEqual(project.motionRigs);
    const editor = new Editor(saved),
      rest = exportLDraw(saved);
    editor.dispatch({
      schemaVersion: 1,
      commandId: uid(),
      expectedRevision: editor.project.revision,
      type: "rigs.applyPose",
      payload: {
        rigId: rig.id,
        sourceRevision: editor.project.revision,
        pose: report.pose,
      },
    });
    validateRig(editor.project, editor.project.motionRigs[rig.id]);
    const rebased = new KinematicSession(editor.project, rig.id);
    rebased.setJointPosition("drive", 10);
    expect(exportLDraw(editor.project)).not.toBe(rest);
    editor.dispatch({
      schemaVersion: 1,
      commandId: uid(),
      expectedRevision: editor.project.revision,
      type: "history.undo",
      payload: {},
    });
    expect(exportLDraw(editor.project)).toBe(rest);
  });
});
