import { expect, it } from "vitest";
import { Editor } from "../../src/core/commands";
import { mechanismFixture } from "../../src/mechanisms/fixtures";
import { uid } from "../../src/core/types";

it.each(["remove", "replace"])(
  "refuses to %s a rig with a locked existing member atomically",
  (operation) => {
    const p = mechanismFixture();
    const fixed = p.motionRigs.door.groups[0].occurrenceIds[0];
    p.layers.fixed = {
      id: "fixed",
      name: "Locked frame",
      visible: true,
      locked: true,
      order: 1,
    };
    p.layerAssignments[fixed] = "fixed";
    const e = new Editor(p),
      before = structuredClone(e.project);
    const replacement = structuredClone(p.motionRigs.door);
    replacement.groups = replacement.groups.slice(1);
    replacement.joints = [];
    expect(() =>
      e.dispatch({
        schemaVersion: 1,
        commandId: uid(),
        expectedRevision: p.revision,
        type: operation === "remove" ? "rigs.remove" : "rigs.upsert",
        payload:
          operation === "remove" ? { rigId: "door" } : { rig: replacement },
      }),
    ).toThrow(/Unlock|locked/i);
    expect(e.project).toEqual(before);
  },
);

it("converts a world hinge pivot through independently rotated group frames without changing authored rest", async () => {
  const { buildHingeRig, previewRigDraft, rigDraftCommand } = await import(
    "../../src/mechanisms/authoring"
  );
  const { rotationY } = await import("../../src/core/math");
  const { exportLDraw } = await import("../../src/ldraw/io");
  const p = mechanismFixture(),
    originalRig = p.motionRigs.door;
  delete p.motionRigs.door;
  const before = structuredClone(p),
    rest = exportLDraw(p);
  const request = {
    id: "authored-hinge",
    name: "Offset world pivot",
    expectedRevision: p.revision,
    fixed: {
      id: "fixed",
      occurrenceIds: originalRig.groups[0].occurrenceIds,
      frame: {
        position: [100, -20, 30] as [number, number, number],
        basis: rotationY(90),
      },
    },
    moving: {
      id: "moving",
      occurrenceIds: originalRig.groups[1].occurrenceIds,
      frame: {
        position: [-20, 15, 40] as [number, number, number],
        basis: rotationY(-45),
      },
    },
    pivotWorld: [3, -4, 5] as [number, number, number],
    axisWorld: [0, 2, 0] as [number, number, number],
    limits: [-90, 90] as [number, number],
  };
  const draft = buildHingeRig(p, request),
    preview = previewRigDraft(p, draft, { jointPositions: { hinge: 90 } });
  const id = originalRig.groups[1].occurrenceIds[0];
  // The authored member starts at (20,-48,0): relative (17,-44,-5)
  // about world pivot (3,-4,5), +90deg aboutY yields (-2,-48,-12).
  for (const [i, value] of [-2, -48, -12].entries())
    expect(preview.transforms[id].position[i]).toBeCloseTo(value, 8);
  expect(preview.transforms[originalRig.groups[0].occurrenceIds[0]]).toEqual(
    originalRig.groups[0].restTransforms[
      originalRig.groups[0].occurrenceIds[0]
    ],
  );
  expect(p).toEqual(before);
  expect(exportLDraw(p)).toBe(rest);
  const e = new Editor(p);
  e.dispatch(rigDraftCommand(draft, uid()));
  expect(exportLDraw(e.project)).toBe(rest);
  expect(() => previewRigDraft(e.project, draft)).toThrow(/changed/i);
  expect(() => e.dispatch(rigDraftCommand(draft, uid()))).toThrow();
  const good = structuredClone(p);
  for (const patch of [
    { axisWorld: [0, 0, 0] },
    { limits: [10, 20] },
    { moving: request.fixed },
  ])
    expect(() =>
      buildHingeRig(p, { ...request, ...patch } as typeof request),
    ).toThrow();
  expect(p).toEqual(good);
});
