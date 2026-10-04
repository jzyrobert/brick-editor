import {
  MechanicalContactPolicy,
  type MechanicalSolid,
} from "../../src/play/mechanical-solids";
import type { PlayMechanismSource } from "../../src/play/mechanism";
import { beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { Box3, DoubleSide, Mesh, Raycaster, Vector3 } from "three";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { occurrences } from "../../src/core/document";
import { compose, identity } from "../../src/core/math";
import { axisRotation } from "../../src/mechanisms/kinematic";
import { physicalMotorFixture } from "../../src/mechanisms/motor-fixture";
import {
  checkPhysicalMotorBinding,
  resolvePhysicalMotorBinding,
} from "../../src/mechanisms/motor-binding";
import { compileOfficialPart } from "../helpers/compile-part";
import { MECHANICAL_PARTS } from "../../src/mechanisms/mechanical-pack";
import type { Vec3 } from "../../src/core/types";

beforeAll(() => expect(registerFullLibraryFromDisk()).toBe(true));
const fixture = () => {
  const f = physicalMotorFixture(),
    rig = f.project.motionRigs["technic-drive"],
    joint = rig.joints.find((j) => j.motor)!;
  return { ...f, rig, joint, all: occurrences(f.project) };
};
describe("source-bound physical PF-M motor", () => {
  it("derives the licensed case, closed output socket and mounting landmarks from pinned sources", () => {
    const sources = fullLibrarySources(["58120.dat"]);
    expect(
      createHash("sha256").update(sources["58120.dat"]).digest("hex"),
    ).toBe(MECHANICAL_PARTS["58120.dat"].sourceSha256);
    expect(sources["58120.dat"]).toContain(
      "0 !LICENSE Licensed under CC BY 4.0",
    );
    expect(sources["58120.dat"]).toContain(
      "1 25 0 0 0 1 0 0 0 1 0 0 0 1 47157.dat",
    );
    expect(sources["47157.dat"]).toContain(
      "0 0 20 1 0 0 0 0 1 0 1 0 axl5end.dat",
    );
    expect(sources["47157.dat"]).toContain(
      "0 0 0 1 0 0 0 0 1 0 20 0 axlehole.dat",
    );
    expect(MECHANICAL_PARTS["58120.dat"].studs).toHaveLength(12);
  });
  it("independently ray-checks the actual hub's open keyed entrance and closed back", async () => {
    for (const ref of ["47157.dat", "58120.dat"]) {
      const g = await compileOfficialPart(ref);
      g.updateMatrixWorld(true);
      g.traverse((o) => {
        if (o instanceof Mesh)
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            m.side = DoubleSide;
      });
      const hits = new Raycaster(
        new Vector3(0, 0, -1),
        new Vector3(0, 0, 1),
      ).intersectObject(g, true);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].point.z).toBeCloseTo(20, 4);
      const flank = new Raycaster(
        new Vector3(7, 0, -1),
        new Vector3(0, 0, 1),
      ).intersectObject(g, true);
      expect(flank[0].point.z).toBeCloseTo(0, 4);
      expect(new Box3().setFromObject(g).min.z).toBe(0);
    }
  });
  it("admits one actual inserted axle and a physically stud-connected motor/bearing carrier", () => {
    const f = fixture(),
      before = JSON.stringify(f.project),
      resolved = resolvePhysicalMotorBinding(
        f.project,
        f.rig,
        f.joint,
        f.binding,
      );
    expect(f.proposal.unresolved).toEqual([]);
    expect(f.all).toHaveLength(15);
    expect(resolved).toMatchObject({
      motorOccurrenceId: f.all[10].id,
      shaftOccurrenceId: f.all[2].id,
      originLdu: [0, -46, 50],
      engagementLdu: 10,
      mating: { pivotLdu: [0, -46, 60], halfLengthLdu: 10 },
    });
    expect(JSON.stringify(f.project)).toBe(before);
  });
  it("keeps the mounted binding under a rotated carrier", () => {
    const f = physicalMotorFixture({
        position: [80, -20, 60],
        basis: axisRotation([0, 1, 0], 37),
      }),
      rig = f.project.motionRigs["technic-drive"],
      joint = rig.joints.find((j) => j.motor)!;
    const r = resolvePhysicalMotorBinding(f.project, rig, joint, f.binding);
    expect(r.engagementLdu).toBeCloseTo(10, 5);
  });
  for (const [name, edit] of [
    [
      "floating motor",
      (f: ReturnType<typeof fixture>) =>
        (f.project.models[
          f.project.rootModelId
        ].nodes[11].transform.position[0] += 100),
    ],
    [
      "disconnected bearing supports",
      (f: ReturnType<typeof fixture>) =>
        (f.project.models[
          f.project.rootModelId
        ].nodes[12].transform.position[0] += 100),
    ],
    [
      "shaft before socket",
      (f: ReturnType<typeof fixture>) =>
        (f.project.models[
          f.project.rootModelId
        ].nodes[2].transform.position[2] -= 20),
    ],
    [
      "shaft through blind back",
      (f: ReturnType<typeof fixture>) =>
        (f.project.models[
          f.project.rootModelId
        ].nodes[2].transform.position[2] += 20),
    ],
    [
      "motor axis offset",
      (f: ReturnType<typeof fixture>) =>
        (f.project.models[
          f.project.rootModelId
        ].nodes[10].transform.position[0] += 1),
    ],
    [
      "motor key mismatch",
      (f: ReturnType<typeof fixture>) =>
        (f.project.models[f.project.rootModelId].nodes[10].transform.basis =
          axisRotation([0, 0, 1], 20)),
    ],
    [
      "motor in rotating group",
      (f: ReturnType<typeof fixture>) => {
        f.rig.groups.find((g) => g.id === f.joint.bodyA)!.occurrenceIds =
          f.rig.groups
            .find((g) => g.id === f.joint.bodyA)!
            .occurrenceIds.filter((id) => id !== f.binding.occurrenceId);
        f.rig.groups
          .find((g) => g.id === f.joint.bodyB)!
          .occurrenceIds.push(f.binding.occurrenceId);
      },
    ],
  ] as const)
    it(`refuses ${name}`, () => {
      const f = fixture();
      edit(f);
      expect(
        checkPhysicalMotorBinding(f.project, f.rig, f.joint, f.binding)
          .eligible,
      ).toBe(false);
    });
});

describe("source-bound motor socket contacts", () => {
  it("admits only the inserted shaft against its reviewed casing", () => {
    const { project } = physicalMotorFixture(),
      rig = project.motionRigs["technic-drive"],
      policy = new MechanicalContactPolicy(rig, {
        project,
        rigId: rig.id,
      } as PlayMechanismSource),
      socket = policy.bearings.find((b) => b.id.endsWith(":motor-socket"))!;
    expect(socket.pivot).toEqual([0, -46, 59.95]);
    const shaft = {
      groupId: socket.b,
      memberId: socket.memberB,
      mating: new Set([socket.id]),
    } as MechanicalSolid;
    expect(
      policy.allowed(shaft, { groupId: socket.a, memberId: socket.memberA }),
    ).toBe(true);
    expect(
      policy.allowed(shaft, { groupId: socket.a, memberId: "foreign-member" }),
    ).toBe(false);
    expect(
      policy.allowed(shaft, {
        groupId: "foreign-rig",
        memberId: socket.memberA,
      }),
    ).toBe(false);
    expect(
      policy.allowed(
        { ...shaft, memberId: "another-shaft" },
        { groupId: socket.a, memberId: socket.memberA },
      ),
    ).toBe(false);
    expect(
      new MechanicalContactPolicy(rig).bearings.some((b) =>
        b.id.endsWith(":motor-socket"),
      ),
    ).toBe(false);
  });
});
