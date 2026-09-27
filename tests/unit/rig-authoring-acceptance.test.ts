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

it.each(["fixed", "spherical"] as const)(
  "exposes %s as a rest-preserving constraint, never a simulated scalar joint",
  async (kind) => {
    const { KinematicSession, validateRig } = await import(
      "../../src/mechanisms/kinematic"
    );
    const p = mechanismFixture(),
      rig = p.motionRigs.door,
      joint = rig.joints[0];
    joint.kind = kind;
    delete joint.limits;
    delete joint.axisA;
    delete joint.axisB;
    validateRig(p, rig);
    const s = new KinematicSession(p, "door"),
      before = s.snapshot();
    expect(before.pose.jointPositions).toEqual({});
    expect(() => s.setJointPosition(joint.id, 30)).toThrow(/scalar/);
    expect(s.snapshot()).toEqual(before);
    expect(s.stepTicks(60).transforms).toEqual(before.transforms);
    if (kind === "spherical")
      expect(before.warnings.join(" ")).toMatch(/rest orientation/);
    for (const patch of [
      { limits: [-10, 10] as [number, number] },
      {
        motor: {
          mode: "position" as const,
          target: 0,
          maxEffort: { value: 1, unit: "N*m" as const },
        },
      },
    ]) {
      const bad = structuredClone(rig);
      Object.assign(bad.joints[0], patch);
      expect(() => validateRig(p, bad)).toThrow();
    }
  },
);
it("applies prismatic LDU travel and rebases its limits as one undoable rest edit", async () => {
  const { KinematicSession } = await import("../../src/mechanisms/kinematic");
  const p = mechanismFixture(),
    rig = p.motionRigs.door;
  rig.joints[0].kind = "prismatic";
  rig.joints[0].limits = [-30, 50];
  const e = new Editor(p),
    id = rig.groups[1].occurrenceIds[0],
    before = structuredClone(e.project),
    s = new KinematicSession(e.project, "door");
  const preview = s.setJointPosition("hinge", 25);
  expect(preview.transforms[id].position[1]).toBeCloseTo(-23);
  expect(preview.transforms[id].basis).toEqual(
    rig.groups[1].restTransforms[id].basis,
  );
  expect(e.project).toEqual(before);
  e.dispatch({
    schemaVersion: 1,
    commandId: uid(),
    expectedRevision: e.project.revision,
    type: "rigs.applyPose",
    payload: {
      rigId: "door",
      sourceRevision: e.project.revision,
      pose: preview.pose,
    },
  });
  expect(e.project.motionRigs.door.joints[0].limits).toEqual([-55, 25]);
  const rebased = new KinematicSession(e.project, "door");
  expect(rebased.snapshot().transforms[id]).toEqual(preview.transforms[id]);
  e.dispatch({
    schemaVersion: 1,
    commandId: uid(),
    expectedRevision: e.project.revision,
    type: "history.undo",
    payload: {},
  });
  expect(e.project.motionRigs).toEqual(before.motionRigs);
});

it("retains motor settings as explicit metadata without pretending fixed ticks drive a motor", async () => {
  const { KinematicSession, validateRig } = await import(
    "../../src/mechanisms/kinematic"
  );
  const p = mechanismFixture(),
    rig = p.motionRigs.door;
  rig.joints[0].motor = {
    mode: "velocity",
    target: 90,
    maxEffort: { value: 2, unit: "N*m" },
  };
  const s = new KinematicSession(p, "door"),
    before = s.snapshot();
  expect(before.warnings.join(" ")).toMatch(/metadata.*explicit positions/);
  expect(s.stepTicks(60).transforms).toEqual(before.transforms);
  expect(s.snapshot().pose.jointPositions.hinge).toBe(0);
  const wrong = structuredClone(rig);
  wrong.joints[0].motor!.maxEffort.unit = "N";
  expect(() => validateRig(p, wrong)).toThrow(/unit/);
});

it.each(["revolute", "prismatic", "fixed", "spherical"] as const)(
  "round-trips loaded %s frames, IDs, bounds and metadata without flattening",
  async (kind) => {
    const {
      buildJointRig,
      rigAuthoringRequest,
      rigDraftCommand,
      previewRigDraft,
    } = await import("../../src/mechanisms/authoring");
    const { rotationY } = await import("../../src/core/math");
    const p = mechanismFixture(),
      original = p.motionRigs.door;
    delete p.motionRigs.door;
    const scalar = kind === "revolute" || kind === "prismatic";
    const draft = buildJointRig(p, {
      id: "loaded",
      name: "Imported constraint",
      expectedRevision: p.revision,
      jointId: "unusual-original-joint",
      kind,
      fixed: {
        id: "frame-original",
        occurrenceIds: original.groups[0].occurrenceIds,
        frame: { position: [-30, 10, 80], basis: rotationY(37) },
      },
      moving: {
        id: "leaf-original",
        occurrenceIds: original.groups[1].occurrenceIds,
        frame: { position: [25, -80, 60], basis: rotationY(-62) },
      },
      pivotWorld: [10, -25, 35],
      ...(scalar
        ? {
            axisWorld: [1, 2, 3] as [number, number, number],
            motor: {
              mode: "velocity" as const,
              target: 12,
              maxEffort: {
                value: 3,
                unit: kind === "revolute" ? ("N*m" as const) : ("N" as const),
              },
            },
          }
        : {}),
      ...(kind === "revolute" ? { limits: [-45, 95] as [number, number] } : {}),
    });
    const e = new Editor(p);
    e.dispatch(rigDraftCommand(draft, uid()));
    const before = structuredClone(e.project);
    const loaded = rigAuthoringRequest(e.project, "loaded");
    expect(loaded.kind).toBe("joint");
    if (loaded.kind !== "joint") throw Error("joint expected");
    const rebuilt = buildJointRig(e.project, loaded.request);
    expect(rebuilt.rig.groups).toEqual(draft.rig.groups);
    expect(rebuilt.rig.joints[0].id).toBe("unusual-original-joint");
    expect(rebuilt.rig.joints[0].motor).toEqual(draft.rig.joints[0].motor);
    expect(rebuilt.rig.joints[0].limits).toEqual(draft.rig.joints[0].limits);
    for (const field of ["anchorA", "anchorB", "axisA", "axisB"] as const) {
      const actual = rebuilt.rig.joints[0][field],
        expected = draft.rig.joints[0][field];
      if (expected)
        expected.forEach((value, index) =>
          expect(actual![index]).toBeCloseTo(value, 9),
        );
      else expect(actual).toBeUndefined();
    }
    if (scalar) {
      const a = previewRigDraft(
          e.project,
          { ...draft, sourceRevision: e.project.revision },
          { jointPositions: { "unusual-original-joint": 20 } },
        ),
        b = previewRigDraft(e.project, rebuilt, {
          jointPositions: { "unusual-original-joint": 20 },
        });
      for (const id of Object.keys(a.transforms))
        for (const field of ["position", "basis"] as const)
          a.transforms[id][field].forEach((v, i) =>
            expect(b.transforms[id][field][i]).toBeCloseTo(v, 9),
          );
    }
    expect(e.project).toEqual(before);
    const renamed = buildJointRig(e.project, {
      ...loaded.request,
      name: "Renamed constraint",
    });
    e.dispatch(rigDraftCommand(renamed, uid()));
    expect(e.project.revision).toBe(before.revision + 1);
    e.dispatch({
      schemaVersion: 1,
      commandId: uid(),
      expectedRevision: e.project.revision,
      type: "history.undo",
      payload: {},
    });
    expect(e.project.motionRigs).toEqual(before.motionRigs);
  },
);
it("refuses to load a valid rig with extra groups rather than discarding them", async () => {
  const { rigAuthoringRequest } = await import(
    "../../src/mechanisms/authoring"
  );
  const { validateRig } = await import("../../src/mechanisms/kinematic");
  const p = mechanismFixture();
  p.motionRigs.door.groups.push(
    structuredClone(p.motionRigs.vehicle.groups[0]),
  );
  delete p.motionRigs.vehicle;
  validateRig(p, p.motionRigs.door);
  const before = structuredClone(p);
  expect(() => rigAuthoringRequest(p, "door")).toThrow(
    /extra groups|losing authored data/,
  );
  expect(p).toEqual(before);
});
