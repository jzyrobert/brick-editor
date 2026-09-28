import { expect, it } from "vitest";
import { Editor } from "../../src/core/commands";
import { exportLDraw, importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { validate } from "../../src/core/validate";
import { physicsFixture } from "../../src/mechanisms/fixtures";
import { KinematicSession, validateRig } from "../../src/mechanisms/kinematic";
import {
  buildJointRig,
  buildRigDynamicsDraft,
  buildVehicleRig,
  rigAuthoringRequest,
  rigDraftCommand,
} from "../../src/mechanisms/authoring";
import { posedLDraw } from "../../src/mechanisms/posed-export";
import { anchoredGroup } from "../../src/mechanisms/dynamics-settings";
import { encodeNative, decodeNative } from "../../src/persistence/native";
import { template } from "../../src/catalog/templates";

it("the physics playground persists and restores rigs, motors and dynamic settings", async () => {
  const project = template("physics");
  expect(project.title).toBe("Physics playground");
  for (const rig of Object.values(project.motionRigs)) {
    validate("motionRig", rig);
    validateRig(project, rig);
  }
  const restored = await decodeNative(await encodeNative(project));
  expect(restored.motionRigs).toEqual(project.motionRigs);
  expect(restored.motionRigs.spinner.joints[0].motor).toEqual({
    mode: "velocity",
    target: 90,
    maxEffort: { value: 200, unit: "N*m" },
  });
  expect(restored.motionRigs.crate.dynamics).toEqual({
    groups: { crate: { anchored: false, massKg: 8 } },
  });
  // Default anchoring: roots of non-vehicle rigs stay put, vehicles move.
  expect(anchoredGroup(project.motionRigs.door, "frame")).toBe(true);
  expect(anchoredGroup(project.motionRigs.door, "door")).toBe(false);
  expect(anchoredGroup(project.motionRigs.vehicle, "chassis")).toBe(false);
  expect(anchoredGroup(project.motionRigs.crate, "crate")).toBe(false);
  // Standard LDraw keeps the rest pose and carries no mechanics.
  expect(exportLDraw(project)).not.toMatch(/dynamics|motor/);
});

it("physics-only drafts change nothing else, undo in one step and survive rig edits", () => {
  const editor = new Editor(physicsFixture());
  const project = editor.project;
  const draft = buildRigDynamicsDraft(project, {
    rigId: "door",
    expectedRevision: project.revision,
    dynamics: {
      groups: { door: { massKg: 3 } },
      friction: 0.4,
    },
  });
  const { dynamics, ...mechanics } = draft.rig;
  expect(mechanics).toEqual(project.motionRigs.door);
  expect(dynamics).toEqual({ groups: { door: { massKg: 3 } }, friction: 0.4 });
  editor.dispatch(rigDraftCommand(draft, "physics-1"));
  expect(editor.project.motionRigs.door.dynamics?.friction).toBe(0.4);
  // Loading the rig for mechanical editing keeps the settings.
  const loaded = rigAuthoringRequest(editor.project, "door");
  if (loaded.kind !== "joint") throw Error("Expected joint rig");
  expect(buildJointRig(editor.project, loaded.request).rig).toEqual(
    editor.project.motionRigs.door,
  );
  const vehicleDraft = buildRigDynamicsDraft(editor.project, {
    rigId: "vehicle",
    expectedRevision: editor.revision,
    dynamics: null,
  });
  expect(vehicleDraft.rig.dynamics).toBeUndefined();
  const vehicle = rigAuthoringRequest(editor.project, "vehicle");
  if (vehicle.kind !== "vehicle") throw Error("Expected vehicle rig");
  expect(buildVehicleRig(editor.project, vehicle.request).rig).toEqual(
    editor.project.motionRigs.vehicle,
  );
  expect(() =>
    buildRigDynamicsDraft(editor.project, {
      rigId: "door",
      expectedRevision: editor.revision,
      dynamics: { groups: { door: { massKg: -1 } } },
    }),
  ).toThrow(/mass/);
  expect(() =>
    buildRigDynamicsDraft(editor.project, {
      rigId: "door",
      expectedRevision: editor.revision - 1,
      dynamics: {},
    }),
  ).toThrow(/changed/);
  editor.dispatch({
    schemaVersion: 1,
    commandId: "physics-undo",
    expectedRevision: editor.revision,
    type: "history.undo",
    payload: {},
  });
  expect(editor.project.motionRigs.door.dynamics).toBeUndefined();
});

it("exports an explicitly posed static LDraw snapshot without touching the project", () => {
  const project = physicsFixture();
  const before = JSON.stringify(project);
  const session = new KinematicSession(project, "door");
  const posed = session.setJointPosition("hinge", 90);
  const out = posedLDraw(project, posed.transforms);
  expect(JSON.stringify(project)).toBe(before);
  const reimported = importLDraw(out.text, "posed.mpd");
  const doorId = project.motionRigs.door.groups[1].occurrenceIds[0];
  const door = occurrences(reimported).find((o) => o.id === doorId)!;
  expect(door.transform.position).toEqual(
    posed.transforms[doorId].position.map((v) => Math.round(v * 1e4) / 1e4),
  );
  expect(door.transform.basis.map((v) => Math.round(v * 1e6) / 1e6)).toEqual(
    posed.transforms[doorId].basis.map((v) => Math.round(v * 1e6) / 1e6 || 0),
  );
  // Unposed parts keep their original text.
  expect(out.text.split("\n").length).toBe(
    exportLDraw(project).split("\n").length,
  );
  expect(() =>
    posedLDraw(project, {
      [doorId]: { position: [0, 0, 0], basis: [2, 0, 0, 0, 1, 0, 0, 0, 1] },
    }),
  ).toThrow(/rigid/);
  expect(() =>
    posedLDraw(project, {
      '["missing"]': {
        position: [0, 0, 0],
        basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      },
    }),
  ).toThrow(/unknown/);
});
