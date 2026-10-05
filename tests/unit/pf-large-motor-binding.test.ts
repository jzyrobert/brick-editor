import { beforeAll, describe, expect, it } from "vitest";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { exportLDraw } from "../../src/ldraw/io";
import { physicalPfLargeMotorFixture } from "../../src/mechanisms/pf-large-motor-fixture";
import {
  bindPfLargeMotorAssemblies,
  reviewedPfLargeMotorBinding,
} from "../../src/mechanisms/pf-large-motor-binding";
import { axisRotation } from "../../src/mechanisms/kinematic";
import { identity } from "../../src/core/math";
import { occurrences } from "../../src/core/document";
beforeAll(() => {
  expect(registerFullLibraryFromDisk()).toBe(true);
});
const sources = () => fullLibrarySources(["99499.dat", "2780.dat", "3707.dat"]);
describe("actual PF-L carrier and source output admission", () => {
  it.each([0, 23])(
    "proves a complete real carrier and retained axle at source rotor phase %s without changing authored placement",
    async (phase) => {
      const { project, rig, all } = physicalPfLargeMotorFixture(
          identity(),
          phase,
        ),
        before = exportLDraw(project);
      await bindPfLargeMotorAssemblies(project, [rig], sources(), all);
      const proof = reviewedPfLargeMotorBinding(
        project,
        rig,
        rig.joints[0],
        all,
      );
      expect(proof.sourceContact.mounts).toHaveLength(2);
      expect(proof.motorOccurrenceId).toBe(all[0].id);
      expect(proof.shaftOccurrenceId).toBe(all[10].id);
      expect(proof.engagementLdu).toBeCloseTo(20);
      expect(proof.rotorRestPhaseDegrees).toBeCloseTo(phase);
      expect(exportLDraw(project)).toBe(before);
    },
  );
  it("retains actual contact admission after rotating and translating the whole source assembly", async () => {
    const { project, rig, all } = physicalPfLargeMotorFixture(
      { position: [180, -90, 110], basis: axisRotation([0, 1, 0], 37) },
      -19,
    );
    await bindPfLargeMotorAssemblies(project, [rig], sources(), all);
    expect(
      reviewedPfLargeMotorBinding(project, rig, rig.joints[0], all)
        .rotorRestPhaseDegrees,
    ).toBeCloseTo(-19);
  });
  it("refuses source-unbound motor admission", () => {
    const { project, rig, all } = physicalPfLargeMotorFixture();
    expect(() =>
      reviewedPfLargeMotorBinding(project, rig, rig.joints[0], all),
    ).toThrow("Review the original");
  });
  it.each([
    [9, 0, 40, "source-seated"],
    [7, 0, 200, "every PF-L carrier"],
    [11, 2, -12, "Retain the PF-L shaft"],
  ] as const)(
    "refuses invalid source support/retention member %s",
    async (index, axis, delta, reason) => {
      const { project, rig, all } = physicalPfLargeMotorFixture();
      all[index].node.transform.position[axis] += delta;
      await expect(
        bindPfLargeMotorAssemblies(
          project,
          [rig],
          sources(),
          occurrences(project),
        ),
      ).rejects.toThrow(reason);
    },
  );
  it("refuses source shadows and invalidates the sealed result when authored data changes", async () => {
    const { project, rig, all } = physicalPfLargeMotorFixture();
    await bindPfLargeMotorAssemblies(project, [rig], sources(), all);
    rig.joints[0].anchorA[0] = 3;
    expect(() =>
      reviewedPfLargeMotorBinding(project, rig, rig.joints[0], all),
    ).toThrow("Review the original");
    const shadowed = physicalPfLargeMotorFixture();
    shadowed.project.models["axlehole.dat"] = {
      ...structuredClone(shadowed.project.models[shadowed.project.rootModelId]),
      id: "axlehole.dat",
      name: "axlehole.dat",
    };
    await expect(
      bindPfLargeMotorAssemblies(
        shadowed.project,
        [shadowed.rig],
        sources(),
        shadowed.all,
      ),
    ).rejects.toThrow("Project shadows reviewed source");
  });
});
