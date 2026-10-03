import { describe, expect, it } from "vitest";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { technicFixture } from "../../src/mechanisms/technic-fixture";
import { KinematicSession, validateRig } from "../../src/mechanisms/kinematic";
import { Editor } from "../../src/core/commands";
import { uid } from "../../src/core/types";
import { exportLDraw } from "../../src/ldraw/io";
import { encodeNative, decodeNative } from "../../src/persistence/native";
import { transmissionMap } from "../../src/mechanisms/transmissions";
import { readFileSync } from "node:fs";

registerFullLibraryFromDisk();
const fixture = () => {
  const { project, proposal } = technicFixture();
  const rig = proposal.rig!;
  const { jointA: input, jointB: output } = rig.transmissions![0];
  return { project, rig, input, output };
};
describe("ideal spur transmissions", () => {
  it("keeps the original browser acceptance source identical to its generator", () => {
    expect(exportLDraw(technicFixture().project)).toBe(
      readFileSync(
        new URL("../../fixtures/ldraw/technic-motion.mpd", import.meta.url),
        "utf8",
      ),
    );
  });
  it("supports consistent transmission chains and even loops, and rejects an incompatible loop", () => {
    const { rig } = fixture();
    const joint = rig.joints[0];
    rig.joints = ["a", "b", "c", "d"].map((id, i) => ({
      ...joint,
      id,
      bodyB: `shaft-${i}`,
      ...(i ? { motor: undefined } : {}),
    }));
    rig.transmissions = ["a", "b", "c", "d"].map((id, i, all) => ({
      id: `mesh-${i}`,
      kind: "spur",
      jointA: id,
      jointB: all[(i + 1) % all.length],
      teethA: 8,
      teethB: 8,
      axisSign: 1,
    }));
    expect([...transmissionMap(rig).get("a")!]).toEqual([
      ["a", 1],
      ["b", -1],
      ["d", -1],
      ["c", 1],
    ]);
    rig.transmissions[3].teethA = 24;
    expect(() => transmissionMap(rig)).toThrow(/contradictory/);
    rig.transmissions = Array.from({ length: 101 }, (_, i) => ({
      ...rig.transmissions![0],
      id: `mesh-${i}`,
    }));
    expect(() => transmissionMap(rig)).toThrow(/100/);
  });
  it.each([90, 720, -1080, 4320])(
    "holds unwrapped 8:24 phase at %s degrees, with either shaft as driver",
    (angle) => {
      const { project, rig, input, output } = fixture();
      const source = JSON.stringify(project);
      const session = new KinematicSession(project, rig.id);
      let report = session.setJointPosition(input, angle);
      expect(report.pose.jointPositions[output]).toBeCloseTo(-angle / 3, 8);
      report = session.setJointPosition(output, angle);
      expect(report.pose.jointPositions[input]).toBeCloseTo(-angle * 3, 8);
      expect(JSON.stringify(project)).toBe(source);
    },
  );
  it("reflects output stops to input limits and refuses the entire change atomically", () => {
    const { project, rig, input, output } = fixture();
    rig.joints.find((j) => j.id === output)!.limits = [-30, 60];
    const session = new KinematicSession(project, rig.id);
    expect(session.jointLimits(input)).toEqual([-180, 90]);
    session.setJointPosition(input, 90);
    const before = session.snapshot();
    expect(() => session.setJointPosition(input, 91)).toThrow(/limits/);
    expect(session.snapshot()).toEqual(before);
    const inconsistent = structuredClone(before.pose);
    inconsistent.jointPositions[output] = 0;
    expect(() => session.setPose(inconsistent)).toThrow(/ratio/);
    expect(session.snapshot()).toEqual(before);
  });
  it("preserves phase through native save, posed apply and undo", async () => {
    const { project, rig, input, output } = fixture();
    const editor = new Editor(project);
    const source = exportLDraw(project);
    const session = new KinematicSession(project, rig.id);
    const pose = session.setJointPosition(input, 765).pose;
    editor.dispatch({
      schemaVersion: 1,
      commandId: uid(),
      expectedRevision: project.revision,
      type: "rigs.applyPose",
      payload: { rigId: rig.id, sourceRevision: project.revision, pose },
    });
    const saved = await decodeNative(await encodeNative(editor.project));
    validateRig(saved, saved.motionRigs[rig.id]);
    const resumed = new KinematicSession(saved, rig.id);
    expect(
      resumed.setJointPosition(input, 90).pose.jointPositions[output],
    ).toBe(-30);
    editor.dispatch({
      schemaVersion: 1,
      commandId: uid(),
      expectedRevision: editor.revision,
      type: "history.undo",
      payload: {},
    });
    expect(exportLDraw(editor.project)).toBe(source);
    expect(editor.project.motionRigs[rig.id].transmissions).toEqual(
      rig.transmissions,
    );
  });
  it("rejects wrong axes, unsupported shafts, duplicate IDs and two authored drivers", () => {
    for (const mutate of [
      (r: ReturnType<typeof fixture>["rig"]) => {
        r.transmissions![0].axisSign = -1;
      },
      (r: ReturnType<typeof fixture>["rig"]) => {
        r.joints[0].motor!.target = 4000;
      },
      (r: ReturnType<typeof fixture>["rig"]) => {
        r.transmissions![0].jointB = "unknown";
      },
      (r: ReturnType<typeof fixture>["rig"]) => {
        r.transmissions!.push({ ...r.transmissions![0] });
      },
      (r: ReturnType<typeof fixture>["rig"]) => {
        r.joints.find((j) => j.id === r.transmissions![0].jointB)!.motor = {
          mode: "velocity",
          target: -30,
          maxEffort: { value: 50, unit: "N*m" },
        };
      },
    ]) {
      const { project, rig } = fixture();
      mutate(rig);
      expect(() => validateRig(project, rig)).toThrow();
    }
  });
});
