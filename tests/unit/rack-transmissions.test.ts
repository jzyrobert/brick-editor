import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import { compose, identity } from "../../src/core/math";
import { posedLDraw } from "../../src/mechanisms/posed-export";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { decodeNative, encodeNative } from "../../src/persistence/native";
import {
  axisRotation,
  KinematicSession,
  validateRig,
} from "../../src/mechanisms/kinematic";
import { rackFixture } from "../../src/mechanisms/rack-fixture";
import { proposeMechanicalRig } from "../../src/mechanisms/mechanical-proposals";
import { mechanicalContactGraph } from "../../src/mechanisms/mechanical-contacts";
import { transmissionMap } from "../../src/mechanisms/transmissions";

registerFullLibraryFromDisk();
const draft = (project: ReturnType<typeof rackFixture>["project"]) => {
  project.motionRigs = {};
  const all = occurrences(project);
  return proposeMechanicalRig(project, {
    id: "rack-drive",
    name: "Rack",
    expectedRevision: project.revision,
    frameOccurrenceIds: [0, 1, 2].map((i) => all[i].id),
  });
};
describe("reviewed guided rack", () => {
  it("reproduces the original source and proposes a bounded slider with one driver", () => {
    const { project, proposal } = rackFixture();
    expect(exportLDraw(project)).toBe(
      readFileSync(
        new URL("../../fixtures/ldraw/rack-motion.mpd", import.meta.url),
        "utf8",
      ),
    );
    expect(proposal.unresolved).toEqual([]);
    expect(proposal.rig!.groups.map((g) => g.occurrenceIds.length)).toEqual([
      3, 4, 1,
    ]);
    expect(proposal.rig!.joints[1]).toMatchObject({
      kind: "prismatic",
      limits: [-128, 112],
    });
    expect(proposal.relations).toMatchObject([
      { kind: "rack", pitchRadiusLdu: -10 },
    ]);
    expect(proposal.rig!.joints.filter((j) => j.motor)).toHaveLength(1);
  });
  it("keeps accumulated shaft turns, reflected travel limits and native source unchanged", async () => {
    const { project, proposal } = rackFixture(),
      rig = proposal.rig!,
      session = new KinematicSession(project, rig.id);
    const source = JSON.stringify(project);
    const pose = session.setJointPosition("joint-0", 720);
    expect(pose.pose.jointPositions["joint-1"]).toBeCloseTo(-40 * Math.PI, 9);
    expect(
      session.setJointPosition("joint-1", 100).pose.jointPositions["joint-0"],
    ).toBeCloseTo(-1800 / Math.PI, 9);
    const before = session.snapshot();
    expect(() => session.setJointPosition("joint-0", 740)).toThrow(/limits/);
    expect(session.snapshot()).toEqual(before);
    expect(() =>
      session.setPose({ jointPositions: { "joint-0": 720, "joint-1": 0 } }),
    ).toThrow(/ratio/);
    expect(JSON.stringify(project)).toBe(source);
    const restored = await decodeNative(await encodeNative(project));
    expect(restored.motionRigs[rig.id].transmissions).toEqual(
      rig.transmissions,
    );
    const posed = importLDraw(
      posedLDraw(project, session.snapshot().transforms).text,
    );
    expect(occurrences(posed)).toHaveLength(8);
    expect(exportLDraw(posed)).not.toBe(exportLDraw(project));
  });
  it("matches rotated placement frames without changing the reviewed signed relation", () => {
    const { project } = rackFixture();
    const rotation = {
      position: [300, -120, 90] as [number, number, number],
      basis: axisRotation(
        [1, 1, 1].map((x) => x / Math.sqrt(3)) as [number, number, number],
        63,
      ),
    };
    for (const n of project.models[project.rootModelId].nodes)
      n.transform = compose(rotation, n.transform);
    const p = draft(project);
    expect(p.unresolved).toEqual([]);
    expect(p.rig!.transmissions).toMatchObject([
      { kind: "rack", pitchRadiusLdu: -10 },
    ]);
    validateRig(project, p.rig!, true);
  });
  it.each(["sideways", "reversed", "pitch-distance", "phase", "withdrawn"])(
    "refuses %s engagement instead of creating a fictitious guide",
    (failure) => {
      const { project } = rackFixture(),
        nodes = project.models[project.rootModelId].nodes;
      if (failure === "sideways") nodes[7].transform.position[2] += 2;
      if (failure === "reversed")
        nodes[7].transform.basis = axisRotation([1, 0, 0], 180);
      if (failure === "withdrawn") nodes[7].transform.position[0] += 260;
      if (failure === "pitch-distance")
        for (const i of [1, 2, 3, 4, 5, 6]) nodes[i].transform.position[1] -= 4;
      if (failure === "phase")
        for (const i of [1, 2, 3, 4, 5, 6]) nodes[i].transform.position[0] += 4;
      const p = draft(project);
      expect(p.rig?.transmissions ?? []).toEqual([]);
      expect(p.graph.rejected.length + p.unresolved.length).toBeGreaterThan(0);
    },
  );
  it("requires perpendicular, limited rack mounting and refuses duplicate power", () => {
    const { proposal } = rackFixture(),
      rig = proposal.rig!;
    rig.joints[1].axisA = [0, 0, 1];
    expect(() => transmissionMap(rig)).toThrow(/perpendicular/);
    rig.joints[1].axisA = [1, 0, 0];
    rig.joints[1].limits = undefined;
    expect(() => transmissionMap(rig)).toThrow(/limited/);
    rig.joints[1].limits = [-128, 112];
    rig.joints[1].motor = {
      mode: "velocity",
      target: 1,
      maxEffort: { value: 10, unit: "N" },
    };
    expect(() => transmissionMap(rig)).toThrow(/one authored motor/);
  });
});
