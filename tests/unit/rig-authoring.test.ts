import { expect, it } from "vitest";
import {
  buildHingeRig,
  buildVehicleRig,
  previewRigDraft,
  rigDraftCommand,
  type HingeRigRequest,
  type VehicleRigRequest,
} from "../../src/mechanisms/authoring";
import { mechanismFixture } from "../../src/mechanisms/fixtures";
import { Editor } from "../../src/core/commands";
import { exportLDraw } from "../../src/ldraw/io";
import { encodeNative, decodeNative } from "../../src/persistence/native";
const fixture = () => {
  const p = mechanismFixture(),
    door = p.motionRigs.door,
    vehicle = p.motionRigs.vehicle;
  p.motionRigs = {};
  const hinge: HingeRigRequest = {
    id: "my-door",
    name: "Door",
    expectedRevision: p.revision,
    fixed: door.groups[0],
    moving: door.groups[1],
    pivotWorld: [0, -48, 0],
    axisWorld: [0, 2, 0],
    limits: [0, 90],
  };
  // Request groups deliberately omit stored restTransforms: only authored member IDs/frames are inputs.
  const clean = (g: (typeof door.groups)[number]) => ({
    id: g.id,
    occurrenceIds: g.occurrenceIds,
    frame: g.frame,
  });
  hinge.fixed = clean(door.groups[0]);
  hinge.moving = clean(door.groups[1]);
  const v = vehicle.vehicle!;
  const car: VehicleRigRequest = {
    id: "my-car",
    name: "Car",
    expectedRevision: p.revision,
    chassis: clean(vehicle.groups.find((g) => g.id === v.chassisGroup)!),
    wheels: v.wheels.map((w) => ({
      ...clean(vehicle.groups.find((g) => g.id === w.groupId)!),
      axisLocal: w.axis,
      radius: w.radius,
      steering: w.steering,
    })),
    wheelbase: v.wheelbase,
    maxSteerDegrees: v.maxSteerDegrees,
    maxSpeed: v.maxSpeed,
  };
  return { p, hinge, car };
};
it("authors and previews a hinge without touching rest geometry; commit, native roundtrip and undo retain the exact rig", async () => {
  const { p, hinge } = fixture(),
    before = structuredClone(p),
    source = exportLDraw(p),
    draft = buildHingeRig(p, hinge);
  const preview = previewRigDraft(p, draft, { jointPositions: { hinge: 90 } }),
    moved = hinge.moving.occurrenceIds[0];
  expect(preview.transforms[moved]).not.toEqual(
    draft.rig.groups[1].restTransforms[moved],
  );
  expect(p).toEqual(before);
  expect(exportLDraw(p)).toBe(source);
  hinge.moving.frame.position[0] += 100;
  expect(draft.rig.groups[1].frame.position).not.toEqual(
    hinge.moving.frame.position,
  );
  const e = new Editor(p);
  e.dispatch(rigDraftCommand(draft, "create-rig"));
  expect(e.project.motionRigs[draft.rig.id]).toEqual(draft.rig);
  expect(exportLDraw(e.project)).toBe(source);
  expect(
    (await decodeNative(await encodeNative(e.project))).motionRigs[
      draft.rig.id
    ],
  ).toEqual(draft.rig);
  e.dispatch({
    schemaVersion: 1,
    commandId: "undo-rig",
    expectedRevision: e.project.revision,
    type: "history.undo",
    payload: {},
  });
  expect(e.project.motionRigs).toEqual({});
  expect(() => previewRigDraft(e.project, draft)).toThrow("changed");
});
it("vehicle preview uses declared radius and deterministic fixed ticks without persisting poses", () => {
  const { p, car } = fixture(),
    before = structuredClone(p),
    draft = buildVehicleRig(p, car);
  const input = { vehicleInput: { throttle: 1, steering: 0 }, ticks: 60 };
  const a = previewRigDraft(p, draft, input),
    b = previewRigDraft(p, draft, input);
  expect(a).toEqual(b);
  expect(a.pose.vehicle!.position[2]).toBeCloseTo(-car.maxSpeed);
  for (const w of car.wheels)
    expect(a.pose.vehicle!.wheelAngles[w.id]).toBeCloseTo(
      ((car.maxSpeed / w.radius) * 180) / Math.PI,
    );
  expect(draft.warnings.join(" ")).toContain("world −Z");
  expect(p).toEqual(before);
  car.wheels[0].axisLocal = [0, 0, 0];
  expect(() => buildVehicleRig(p, car)).toThrow("axis");
});
it("draft guards scope, hidden and locked members, overlapping groups and stale revisions", () => {
  const { p, hinge } = fixture();
  expect(() => buildHingeRig(p, { ...hinge, activeLayerId: "other" })).toThrow(
    "active layer",
  );
  expect(() => buildHingeRig(p, { ...hinge, expectedRevision: 999 })).toThrow(
    "changed",
  );
  expect(() => buildHingeRig(p, { ...hinge, moving: hinge.fixed })).toThrow();
  expect(() => buildHingeRig(p, { ...hinge, limits: [10, 90] })).toThrow(
    "Limits",
  );
  p.layers[p.defaultLayerId].visible = false;
  expect(() => buildHingeRig(p, hinge)).toThrow("Hidden");
  expect(() =>
    buildHingeRig(p, { ...hinge, includeHidden: true }),
  ).not.toThrow();
  p.layers[p.defaultLayerId].locked = true;
  expect(() => buildHingeRig(p, { ...hinge, includeHidden: true })).toThrow(
    "Unlock",
  );
});
