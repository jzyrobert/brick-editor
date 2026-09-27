import { Editor } from "../../src/core/commands";
import { exportLDraw } from "../../src/ldraw/io";
import { expect, it } from "vitest";
import { mechanismFixture } from "../../src/mechanisms/fixtures";
import type { DriverSeatSpec } from "../../src/mechanisms/types";
import { validateRig } from "../../src/mechanisms/kinematic";
import { validate } from "../../src/core/validate";
import {
  buildVehicleRig,
  buildDriverSeatDraft,
  rigDraftCommand,
  rigAuthoringRequest,
} from "../../src/mechanisms/authoring";
import { encodeNative, decodeNative } from "../../src/persistence/native";
const seat = (): DriverSeatSpec => ({
  id: "driver",
  profile: "brick-figure-open-seat-v1",
  pelvisPosition: [0, -17, 12],
  yawDegrees: 0,
  accessPoint: [65, -16, 12],
  approachPosition: [65, 24, 12],
  exits: [
    { position: [65, 24, 12], yawDegrees: 90 },
    { position: [-65, 24, 12], yawDegrees: -90 },
  ],
});
it("preserves explicit driver seat data through rig editing and native backup without aliasing", async () => {
  const project = mechanismFixture();
  project.motionRigs.vehicle.vehicle!.driverSeat = seat();
  const before = structuredClone(project);
  validateRig(project, project.motionRigs.vehicle);
  validate("motionRig", project.motionRigs.vehicle);
  const loaded = rigAuthoringRequest(project, "vehicle");
  if (loaded.kind !== "vehicle") throw Error("Expected vehicle");
  const rebuilt = buildVehicleRig(project, loaded.request);
  expect(rebuilt.rig).toEqual(project.motionRigs.vehicle);
  loaded.request.driverSeat!.exits.reverse();
  expect(project).toEqual(before);
  expect(rebuilt.rig).toEqual(project.motionRigs.vehicle);
  const restored = await decodeNative(await encodeNative(project));
  expect(restored.motionRigs.vehicle).toEqual(project.motionRigs.vehicle);
});
it("rejects malformed seat data consistently before runtime materialization", () => {
  const project = mechanismFixture();
  const bad = [
    { ...seat(), profile: "automatic" },
    { ...seat(), pelvisPosition: [10001, 0, 0] },
    { ...seat(), yawDegrees: 361 },
    { ...seat(), exits: [] },
    { ...seat(), exits: Array(5).fill(seat().exits[0]) },
    { ...seat(), exits: [{ position: [0, 0], yawDegrees: 0 }] },
    { ...seat(), eyeOverride: [0, 0, 0] },
    { ...seat(), id: "__proto__" },
  ];
  for (const value of bad) {
    const rig = structuredClone(project.motionRigs.vehicle);
    rig.vehicle!.driverSeat = value as DriverSeatSpec;
    expect(() => validate("motionRig", rig)).toThrow();
    expect(() => validateRig(project, rig)).toThrow();
  }
  expect(project.motionRigs.vehicle.vehicle!.driverSeat).toBeUndefined();
});

it("seat-only drafts preserve authored frames and refuse stale or locked updates", () => {
  const project = mechanismFixture();
  const before = structuredClone(project);
  const request = {
    rigId: "vehicle",
    expectedRevision: project.revision,
    driverSeat: seat(),
  };
  const draft = buildDriverSeatDraft(project, request);
  const withoutSeat = structuredClone(draft.rig);
  delete withoutSeat.vehicle!.driverSeat;
  expect(withoutSeat).toEqual(project.motionRigs.vehicle);
  expect(project).toEqual(before);
  request.driverSeat.exits[0].position[0] = 99;
  expect(draft.rig.vehicle!.driverSeat!.exits[0].position[0]).toBe(65);
  expect(() =>
    buildDriverSeatDraft(project, {
      ...request,
      expectedRevision: project.revision + 1,
    }),
  ).toThrow("changed");
  for (const layer of Object.values(project.layers)) layer.locked = true;
  expect(() => buildDriverSeatDraft(project, request)).toThrow("Unlock");
  for (const layer of Object.values(project.layers)) layer.locked = false;
  project.motionRigs.vehicle = draft.rig;
  expect(
    buildDriverSeatDraft(project, { ...request, driverSeat: null }).rig,
  ).toEqual(before.motionRigs.vehicle);
});

it("commits and undoes seat metadata in one revision without editing source parts", () => {
  const editor = new Editor(mechanismFixture());
  const before = structuredClone(editor.project.motionRigs);
  const source = exportLDraw(editor.project);
  const draft = buildDriverSeatDraft(editor.project, {
    rigId: "vehicle",
    expectedRevision: editor.project.revision,
    driverSeat: seat(),
  });
  editor.dispatch(rigDraftCommand(draft, "seat-save"));
  expect(editor.project.motionRigs.vehicle.vehicle!.driverSeat).toEqual(seat());
  expect(exportLDraw(editor.project)).toBe(source);
  editor.dispatch({
    schemaVersion: 1,
    commandId: "seat-undo",
    expectedRevision: editor.project.revision,
    type: "history.undo",
    payload: {},
  });
  expect(editor.project.motionRigs).toEqual(before);
  expect(exportLDraw(editor.project)).toBe(source);
});
