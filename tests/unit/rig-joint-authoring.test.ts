import { expect, it } from "vitest";
import { mechanismFixture } from "../../src/mechanisms/fixtures";
import {
  buildJointRig,
  buildVehicleRig,
  previewRigDraft,
  rigAuthoringRequest,
  type JointRigRequest,
} from "../../src/mechanisms/authoring";
import { add, mv } from "../../src/core/math";
import { axisRotation, validateRig } from "../../src/mechanisms/kinematic";

it("converts prismatic world anchors and axes into rotated frames and previews LDU translation", () => {
  const p = mechanismFixture(),
    loaded = rigAuthoringRequest(p, "door");
  expect(loaded.kind).toBe("joint");
  if (loaded.kind !== "joint") throw Error();
  const request: JointRigRequest = {
    ...loaded.request,
    kind: "prismatic",
    jointId: "slide",
    axisWorld: [2, 0, 0],
    limits: [-25, 50],
    pivotWorld: [3, -4, 5],
  };
  request.fixed.frame = {
    position: [20, 30, 40],
    basis: axisRotation([0, 1, 0], 90),
  };
  request.moving.frame = {
    position: [-10, 5, 8],
    basis: axisRotation([1, 0, 0], 90),
  };
  const before = structuredClone(p),
    draft = buildJointRig(p, request),
    joint = draft.rig.joints[0];
  for (const [g, a, axis] of [
    [draft.rig.groups[0], joint.anchorA, joint.axisA!],
    [draft.rig.groups[1], joint.anchorB, joint.axisB!],
  ] as const) {
    const anchor = add(g.frame.position, mv(g.frame.basis, a)),
      direction = mv(g.frame.basis, axis);
    anchor.forEach((n, i) => expect(n).toBeCloseTo(request.pivotWorld[i], 8));
    direction.forEach((n, i) => expect(n).toBeCloseTo(i === 0 ? 1 : 0, 8));
  }
  const pose = previewRigDraft(p, draft, { jointPositions: { slide: 17 } }),
    moving = draft.rig.groups[1];
  for (const id of moving.occurrenceIds) {
    expect(pose.transforms[id].position[0]).toBeCloseTo(
      moving.restTransforms[id].position[0] + 17,
      8,
    );
    expect(pose.transforms[id].position[1]).toBeCloseTo(
      moving.restTransforms[id].position[1],
      8,
    );
  }
  expect(p).toEqual(before);
});
it("loads editable rigs preserving group bases, IDs, motors and unbounded joints; refuses lossy topology", () => {
  const p = mechanismFixture();
  p.motionRigs.door.joints[0].id = "authored-pivot";
  p.motionRigs.door.joints[0].motor = {
    mode: "velocity",
    target: 7,
    maxEffort: { value: 2, unit: "N*m" },
  };
  delete p.motionRigs.door.joints[0].limits;
  const before = structuredClone(p),
    loaded = rigAuthoringRequest(p, "door");
  if (loaded.kind !== "joint") throw Error();
  expect(buildJointRig(p, loaded.request).rig).toEqual(p.motionRigs.door);
  expect(loaded.request.limits).toBeUndefined();
  loaded.request.fixed.frame.position[0] += 12;
  expect(p).toEqual(before);
  const vehicle = rigAuthoringRequest(p, "vehicle");
  if (vehicle.kind !== "vehicle") throw Error();
  expect(buildVehicleRig(p, vehicle.request).rig).toEqual(p.motionRigs.vehicle);
  p.motionRigs.door.groups.push(
    structuredClone(p.motionRigs.vehicle.groups[0]),
  );
  expect(() => rigAuthoringRequest(p, "door")).toThrow("losing authored data");
});
it("fixed and spherical builders reject scalar controls and preserve the authored rest pose", () => {
  const p = mechanismFixture(),
    loaded = rigAuthoringRequest(p, "door");
  if (loaded.kind !== "joint") throw Error();
  const { axisWorld: _a, limits: _l, ...base } = loaded.request;
  for (const kind of ["fixed", "spherical"] as const) {
    const request = { ...base, kind },
      draft = buildJointRig(p, request),
      rest = previewRigDraft(p, draft);
    for (const group of draft.rig.groups)
      for (const id of group.occurrenceIds)
        expect(rest.transforms[id]).toEqual(group.restTransforms[id]);
    expect(() => buildJointRig(p, { ...request, limits: [0, 90] })).toThrow(
      "scalar",
    );
    expect(() =>
      buildJointRig(p, {
        ...request,
        motor: {
          mode: "position",
          target: 0,
          maxEffort: { value: 1, unit: "N*m" },
        },
      }),
    ).toThrow("scalar");
    expect(() =>
      previewRigDraft(p, draft, { jointPositions: { hinge: 10 } }),
    ).toThrow();
    if (kind === "spherical")
      expect(draft.warnings.join(" ")).toContain("rest orientation");
    p.revision++;
    expect(() => previewRigDraft(p, draft)).toThrow("changed");
    p.revision--;
  }
});
it("refuses tolerant imported values that editing would silently normalize, preserving the original rig", () => {
  for (const variation of ["axis", "anchor", "rest", "wheel"] as const) {
    const p = mechanismFixture(),
      id = variation === "wheel" ? "vehicle" : "door",
      rig = p.motionRigs[id];
    if (variation === "axis") {
      rig.joints[0].axisA = [0, 1.000005, 0];
      rig.joints[0].axisB = [0, 1.000005, 0];
    } else if (variation === "anchor") rig.joints[0].anchorB[0] += 0.0005;
    else if (variation === "rest") {
      const g = rig.groups[0];
      g.restTransforms[g.occurrenceIds[0]].position[0] += 0.000005;
    } else rig.vehicle!.wheels[0].axis = [1.000005, 0, 0];
    validateRig(p, rig); // These are accepted persisted rigs, not malformed input.
    const before = structuredClone(p);
    expect(() => rigAuthoringRequest(p, id)).toThrow(
      "will not normalize it silently",
    );
    expect(p).toEqual(before);
  }
});
it("ignores group ordering and accepts ordinary coordinate roundoff while retaining all member identities", () => {
  const p = mechanismFixture();
  p.motionRigs.door.groups.reverse();
  p.motionRigs.door.joints[0].anchorB[0] += 1e-12;
  const loaded = rigAuthoringRequest(p, "door");
  expect(loaded.kind).toBe("joint");
  if (loaded.kind !== "joint") throw Error();
  expect(buildJointRig(p, loaded.request).affectedOccurrenceIds.sort()).toEqual(
    p.motionRigs.door.groups.flatMap((g) => g.occurrenceIds).sort(),
  );
});
