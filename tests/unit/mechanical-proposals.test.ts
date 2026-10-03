import { describe, expect, it } from "vitest";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import { compose, identity } from "../../src/core/math";
import type { Project, Transform, Vec3 } from "../../src/core/types";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { axisRotation, validateRig } from "../../src/mechanisms/kinematic";
import {
  proposeMechanicalRig,
  previewMechanicalProposal,
  type MechanicalProposalRequest,
} from "../../src/mechanisms/mechanical-proposals";

registerFullLibraryFromDisk();
const pose = (
  position: Vec3 = [0, 0, 0],
  basis = identity().basis,
): Transform => ({ position, basis });
const row = (ref: string, t = identity()) =>
  `1 7 ${[...t.position, ...t.basis].join(" ")} ${ref}`;
const rotation = (angle: number) => axisRotation([0, 0, 1], angle);
const shaft = (x: number, phase = 0) =>
  compose(
    pose([x, 0, 0], rotation(phase)),
    pose([0, 0, 0], axisRotation([0, 1, 0], -90)),
  );
function driveScene(): Project {
  return importLDraw(
    [
      "0 Original CC0-1.0 mechanical contact acceptance arrangement",
      row("3701.dat", pose([20, -10, -20])),
      row("3701.dat", pose([20, -10, 20])),
      row("3705.dat", shaft(0)),
      row("3647.dat"),
      row("4265a.dat", pose([0, 0, -35])),
      row("4265a.dat", pose([0, 0, 35])),
      row("3705.dat", shaft(40, 7.5)),
      row("3648b.dat", pose([40, 0, 0], rotation(7.5))),
      row("4265a.dat", pose([40, 0, -35], rotation(7.5))),
      row("4265a.dat", pose([40, 0, 35], rotation(7.5))),
      row("3700.dat", pose([120, -10, -10])),
      row("3673.dat", shaft(120)),
      row("3701.dat", pose([140, -10, 10])),
    ].join("\n"),
  );
}
function request(p: Project, anchors = [0, 1, 10]): MechanicalProposalRequest {
  const all = occurrences(p);
  return {
    id: "technic-proposal",
    name: "Technic contact preview",
    expectedRevision: p.revision,
    frameOccurrenceIds: anchors.map((i) => all[i].id),
  };
}

describe("session mechanical proposals", () => {
  it("reduces multiple coaxial bearings to one retained shaft joint and carries a 3:1 mesh candidate", () => {
    const p = driveScene(),
      before = JSON.stringify(p),
      all = occurrences(p);
    const inputId = all[2].id;
    const proposal = proposeMechanicalRig(p, {
      ...request(p),
      motors: {
        [inputId]: {
          mode: "velocity",
          target: 90,
          maxEffort: { value: 200, unit: "N*m" },
        },
      },
    });
    expect(proposal.unresolved).toEqual([]);
    expect(proposal.rig!.groups).toHaveLength(5); // fixed frame, two shafts, pin and arm.
    expect(proposal.rig!.joints).toHaveLength(4);
    expect(
      proposal
        .rig!.groups.find((g) => g.occurrenceIds.includes(inputId))!
        .occurrenceIds.sort(),
    ).toEqual([2, 3, 4, 5].map((i) => all[i].id).sort());
    expect(
      proposal
        .rig!.groups.find((g) => g.occurrenceIds.includes(all[6].id))!
        .occurrenceIds.sort(),
    ).toEqual([6, 7, 8, 9].map((i) => all[i].id).sort());
    expect(proposal.rig!.joints.filter((j) => j.motor)).toHaveLength(1);
    expect(proposal.relations).toEqual([
      expect.objectContaining({ ratio: -1 / 3, teethA: 8, teethB: 24 }),
    ]);
    validateRig(p, proposal.rig!);
    expect(JSON.stringify(p)).toBe(before);
  });

  it("previews coupled shafts and the pin arm without editing inventory or rest poses", () => {
    const p = driveScene(),
      before = exportLDraw(p),
      all = occurrences(p),
      proposal = proposeMechanicalRig(p, request(p));
    const preview = previewMechanicalProposal(p, proposal);
    const rest = preview.snapshot();
    for (const g of proposal.rig!.groups)
      for (const id of g.occurrenceIds) {
        rest.transforms[id].position.forEach((n, i) =>
          expect(n).toBeCloseTo(g.restTransforms[id].position[i], 8),
        );
        rest.transforms[id].basis.forEach((n, i) =>
          expect(n).toBeCloseTo(g.restTransforms[id].basis[i], 8),
        );
      }
    const input = proposal.rig!.groups.find((g) =>
      g.occurrenceIds.includes(all[2].id),
    )!;
    const j = proposal.rig!.joints.find((j) => j.bodyB === input.id)!;
    preview.setJointPosition(j.id, 90);
    const moved = preview.snapshot();
    expect(moved.transforms[all[3].id].basis[0]).toBeCloseTo(0, 8);
    const outputJoint = proposal.relations[0].jointB;
    expect(moved.pose.jointPositions[outputJoint]).toBe(-30);
    expect(moved.transforms[all[7].id]).not.toEqual(rest.transforms[all[7].id]);
    const arm = proposal.rig!.groups.find((g) =>
      g.occurrenceIds.includes(all[12].id),
    )!;
    preview.setJointPosition(
      proposal.rig!.joints.find((j) => j.bodyB === arm.id)!.id,
      45,
    );
    expect(
      preview.snapshot().transforms[all[12].id].position[1],
    ).not.toBeCloseTo(all[12].transform.position[1]);
    expect(exportLDraw(p)).toBe(before);
    expect(occurrences(p)).toHaveLength(13);
    expect(p.motionRigs).toEqual({});
  });

  it("preserves nested rounded placements and creates exact rotated joint frames", () => {
    const source = driveScene();
    const inner = source.models[source.rootModelId].nodes
      .map((n) => row(n.ref, n.transform))
      .join("\n");
    const global = pose([300, -200, 100], axisRotation([0, 1, 0], 45));
    global.basis = global.basis.map(
      (x) => Math.round(x * 1000) / 1000,
    ) as Transform["basis"];
    const p = importLDraw(
      [
        "0 FILE root.ldr",
        row("assembly.ldr", global),
        "0 FILE assembly.ldr",
        inner,
      ].join("\n"),
    );
    const saved = JSON.stringify(p),
      proposal = proposeMechanicalRig(p, request(p));
    expect(proposal.unresolved).toEqual([]);
    expect(proposal.rig!.joints).toHaveLength(4);
    validateRig(p, proposal.rig!);
    const preview = previewMechanicalProposal(p, proposal);
    preview.setJointPosition(proposal.rig!.joints[0].id, 720);
    expect(JSON.stringify(p)).toBe(saved);
  });

  it.each(["missing-retainer", "unclamped-gear", "phase-clash"])(
    "refuses the input shaft with %s instead of welding away its freedom",
    (change) => {
      const p = driveScene(),
        all = occurrences(p),
        root = p.models[p.rootModelId];
      if (change === "missing-retainer")
        root.nodes[5].transform.position[2] += 2;
      if (change === "unclamped-gear") root.nodes[3].transform.position[2] += 1;
      if (change === "phase-clash")
        root.nodes[3].transform.basis = rotation(22.5);
      const proposal = proposeMechanicalRig(p, request(p));
      expect(
        proposal.rig?.groups.some((g) => g.occurrenceIds.includes(all[2].id)),
      ).toBe(false);
      expect(
        proposal.unresolved.some((u) => u.occurrenceIds.includes(all[2].id)),
      ).toBe(true);
      if (change === "phase-clash") {
        // Invalid keyed engagement remains visible in the contact report. It is
        // not invented as an accessory or promoted to a transmission.
        expect(
          proposal.graph.rejected.some((r) => r.reason.includes("phase")),
        ).toBe(true);
        expect(proposal.relations).toHaveLength(0);
      } else {
        expect(
          proposal.rig?.groups.some((g) => g.occurrenceIds.includes(all[2].id)),
        ).toBe(false);
        expect(
          proposal.unresolved.some((u) => u.occurrenceIds.includes(all[2].id)),
        ).toBe(true);
      }
    },
  );

  it("refuses several shafts matching the same bore", () => {
    const p = driveScene();
    p.models[p.rootModelId].nodes.push({
      ...structuredClone(p.models[p.rootModelId].nodes[2]),
      id: "duplicate-shaft",
    });
    const proposal = proposeMechanicalRig(p, request(p));
    expect(
      proposal.rig?.groups.some((g) =>
        g.occurrenceIds.includes(occurrences(p)[2].id),
      ),
    ).toBe(false);
    expect(
      proposal.unresolved.some((u) => u.reason.includes("several shafts")),
    ).toBe(true);
  });

  it("retains a friction pin as two movable bearings", () => {
    const p = driveScene();
    p.models[p.rootModelId].nodes[11].ref = "2780.dat";
    const proposal = proposeMechanicalRig(p, request(p)),
      all = occurrences(p);
    const pin = proposal.rig!.groups.find((g) =>
      g.occurrenceIds.includes(all[11].id),
    )!;
    const arm = proposal.rig!.groups.find((g) =>
      g.occurrenceIds.includes(all[12].id),
    )!;
    expect(pin.id).not.toBe(arm.id);
    expect(
      proposal.rig!.joints.some(
        (j) => j.bodyA === pin.id && j.bodyB === arm.id,
      ),
    ).toBe(true);
    expect(
      proposal.warnings.some((w) => w.includes("friction pin remains movable")),
    ).toBe(true);
  });

  it("does not drop a second pin constraint from the same moving arm", () => {
    const p = importLDraw(
      [
        row("3701.dat", pose([20, -10, -10])),
        row("3701.dat", pose([20, -10, 10])),
        row("3673.dat", shaft(0)),
        row("3673.dat", shaft(40)),
      ].join("\n"),
    );
    const proposal = proposeMechanicalRig(p, request(p, [0]));
    expect(proposal.rig).toBeUndefined();
    expect(
      proposal.unresolved.filter((u) => u.reason.includes("closed linkage")),
    ).toHaveLength(2);
  });

  it("recruits an ordinary hinge's rigid accessory while keeping the hinge articulated", () => {
    const p = importLDraw(
      [
        row("4275b.dat"),
        row("4276b.dat", pose([60, 0, 0], axisRotation([0, 1, 0], 180))),
        row("3023.dat", pose([60, -8, 0], axisRotation([0, 1, 0], 180))),
      ].join("\n"),
    );
    const proposal = proposeMechanicalRig(p, request(p, [0]));
    expect(proposal.rig!.groups).toHaveLength(2);
    expect(proposal.rig!.groups[1].occurrenceIds).toHaveLength(2);
    const preview = previewMechanicalProposal(p, proposal);
    preview.setJointPosition(proposal.rig!.joints[0].id, 45);
    expect(
      preview.snapshot().transforms[occurrences(p)[2].id].basis[4],
    ).toBeCloseTo(Math.SQRT1_2, 8);
  });

  it("honours authored ownership and guards stale previews and motor identities", () => {
    const p = driveScene(),
      draft = proposeMechanicalRig(p, request(p));
    p.motionRigs.original = { ...structuredClone(draft.rig!), id: "original" };
    expect(() => proposeMechanicalRig(p, request(p))).toThrow(/already owns/);
    expect(() => previewMechanicalProposal(p, draft)).toThrow(/ownership/);
    p.motionRigs = {};
    p.revision++;
    expect(() => previewMechanicalProposal(p, draft)).toThrow(/changed/);
    expect(() =>
      proposeMechanicalRig(p, {
        ...request(p),
        motors: {
          [occurrences(p)[3].id]: {
            mode: "velocity",
            target: 90,
            maxEffort: { value: 1, unit: "N*m" },
          },
        },
      }),
    ).toThrow(/no supported shaft/);
    expect(() =>
      proposeMechanicalRig(p, {
        ...request(p),
        occurrenceIds: [occurrences(p)[2].id],
      }),
    ).toThrow(/frame anchor/);
  });
});
