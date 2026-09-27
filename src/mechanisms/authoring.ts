import {
  ensure,
  type Command,
  type Project,
  type Transform,
  type Vec3,
} from "../core/types";
import { occurrences } from "../core/document";
import { add, inverse, mv, physical } from "../core/math";
import { KinematicSession, validateRig } from "./kinematic";
import type { MotionRig, RigidGroup } from "./types";

export type GroupDraft = {
  id: string;
  occurrenceIds: string[];
  frame: Transform;
};
type IdentityDraft = {
  id: string;
  name: string;
  expectedRevision: number;
  includeHidden?: boolean;
  activeLayerId?: string;
};
export type HingeRigRequest = IdentityDraft & {
  fixed: GroupDraft;
  moving: GroupDraft;
  pivotWorld: Vec3;
  axisWorld: Vec3;
  limits: [number, number];
};
export type VehicleRigRequest = IdentityDraft & {
  chassis: GroupDraft;
  wheels: Array<
    GroupDraft & { axisLocal: Vec3; radius: number; steering: boolean }
  >;
  wheelbase: number;
  maxSteerDegrees: number;
  maxSpeed: number;
};
export type RigDraft = {
  rig: MotionRig;
  sourceRevision: number;
  includeHidden: boolean;
  activeLayerId?: string;
  affectedOccurrenceIds: string[];
  warnings: string[];
};
const identityKeys = [
  "id",
  "name",
  "expectedRevision",
  "includeHidden",
  "activeLayerId",
];
function fields(value: unknown, allowed: string[]) {
  ensure(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).every((k) => allowed.includes(k)),
    "INVALID_INPUT",
    "Unknown rig authoring field",
  );
}
function vector(v: Vec3) {
  ensure(
    Array.isArray(v) &&
      v.length === 3 &&
      v.every((n) => Number.isFinite(n) && Math.abs(n) <= 1e7),
    "INVALID_INPUT",
    "Rig vectors require three finite bounded coordinates",
  );
}
function unit(v: Vec3): Vec3 {
  vector(v);
  const length = Math.hypot(...v);
  ensure(length > 1e-9, "INVALID_INPUT", "Declare a nonzero rotation axis");
  return v.map((n) => n / length) as Vec3;
}
function start(project: Project, request: IdentityDraft) {
  ensure(
    request.expectedRevision === project.revision,
    "REVISION_CONFLICT",
    "Project changed; rebuild the rig draft",
  );
  ensure(
    request.includeHidden === undefined ||
      typeof request.includeHidden === "boolean",
    "INVALID_INPUT",
    "includeHidden must be boolean",
  );
}
function group(
  project: Project,
  draft: GroupDraft,
  includeHidden: boolean,
): RigidGroup {
  fields(draft, ["id", "occurrenceIds", "frame"]);
  fields(draft.frame, ["position", "basis"]);
  vector(draft.frame.position);
  ensure(
    Array.isArray(draft.frame.basis) &&
      draft.frame.basis.length === 9 &&
      draft.frame.basis.every(Number.isFinite) &&
      physical(draft.frame),
    "INVALID_TRANSFORM",
    "Declare a proper rigid group frame",
  );
  ensure(
    Array.isArray(draft.occurrenceIds) &&
      draft.occurrenceIds.length > 0 &&
      draft.occurrenceIds.length <= 10000,
    "INVALID_INPUT",
    "Assign 1–10,000 selected occurrences to each rigid group",
  );
  const all = new Map(occurrences(project).map((o) => [o.id, o]));
  const rests = draft.occurrenceIds.map((id) => {
    const o = all.get(id);
    ensure(o, "INVALID_INPUT", "Rigid group contains an unknown occurrence");
    ensure(
      !project.layers[o.layerId].locked,
      "LAYER_LOCKED",
      "Unlock every rig member layer before authoring",
    );
    ensure(
      o.visible || includeHidden,
      "INVALID_INPUT",
      "Hidden rig members require includeHidden",
    );
    ensure(
      o.namespace !== "missing",
      "INVALID_INPUT",
      "Resolve missing parts before rigging them",
    );
    return [id, structuredClone(o.transform)] as const;
  });
  return {
    ...structuredClone(draft),
    restTransforms: Object.fromEntries(rests),
  };
}
function finish(
  project: Project,
  request: IdentityDraft,
  rig: MotionRig,
): RigDraft {
  validateRig(project, rig);
  const guarded = [
    ...rig.groups,
    ...(project.motionRigs[rig.id]?.groups ?? []),
  ];
  const all = new Map(occurrences(project).map((o) => [o.id, o]));
  for (const g of guarded)
    for (const id of g.occurrenceIds) {
      const o = all.get(id);
      ensure(o, "INVALID_INPUT", "Existing rig has a missing occurrence");
      ensure(
        !project.layers[o.layerId].locked,
        "LAYER_LOCKED",
        "Unlock every old and new rig member layer",
      );
      ensure(
        o.visible || request.includeHidden === true,
        "INVALID_INPUT",
        "Hidden rig members require includeHidden",
      );
      ensure(
        request.activeLayerId === undefined ||
          o.layerId === request.activeLayerId,
        "INVALID_INPUT",
        "Rig member outside active layer",
      );
    }
  const ids = rig.groups.flatMap((g) => g.occurrenceIds),
    selected = new Set(ids);
  for (const existing of Object.values(project.motionRigs))
    ensure(
      existing.id === rig.id ||
        !existing.groups.some((g) =>
          g.occurrenceIds.some((id) => selected.has(id)),
        ),
      "INVALID_INPUT",
      "An occurrence already belongs to another motion rig",
    );
  return {
    rig,
    sourceRevision: project.revision,
    includeHidden: request.includeHidden === true,
    ...(request.activeLayerId === undefined
      ? {}
      : { activeLayerId: request.activeLayerId }),
    affectedOccurrenceIds: ids,
    warnings: [
      "Kinematic preview does not infer joints, contacts, suspension or forces.",
      ...(rig.vehicle
        ? [
            "Vehicle motion uses the world XZ plane, initially forward along world −Z, regardless of chassis frame orientation. Steering rotates around world Y.",
          ]
        : []),
      ...(project.motionRigs[rig.id]
        ? ["Saving replaces the existing rig with this ID."]
        : []),
    ],
  };
}
/** Frames and pivot are authored in LDraw world coordinates; axis direction is normalized. */
export function buildHingeRig(
  project: Project,
  request: HingeRigRequest,
): RigDraft {
  fields(request, [
    ...identityKeys,
    "fixed",
    "moving",
    "pivotWorld",
    "axisWorld",
    "limits",
  ]);
  start(project, request);
  const fixed = group(project, request.fixed, request.includeHidden === true),
    moving = group(project, request.moving, request.includeHidden === true);
  vector(request.pivotWorld);
  ensure(
    Array.isArray(request.limits) && request.limits.length === 2,
    "INVALID_INPUT",
    "Declare both hinge angle limits in degrees",
  );
  const axis = unit(request.axisWorld),
    a = inverse(fixed.frame),
    b = inverse(moving.frame);
  return finish(project, request, {
    schemaVersion: 1,
    id: request.id,
    name: request.name,
    mode: "kinematic",
    groups: [fixed, moving],
    joints: [
      {
        id: "hinge",
        kind: "revolute",
        bodyA: fixed.id,
        bodyB: moving.id,
        anchorA: add(a.position, mv(a.basis, request.pivotWorld)),
        anchorB: add(b.position, mv(b.basis, request.pivotWorld)),
        axisA: mv(a.basis, axis),
        axisB: mv(b.basis, axis),
        limits: structuredClone(request.limits),
      },
    ],
  });
}
/** Wheel frame origins are the declared wheel centres; axles are local to those frames. */
export function buildVehicleRig(
  project: Project,
  request: VehicleRigRequest,
): RigDraft {
  fields(request, [
    ...identityKeys,
    "chassis",
    "wheels",
    "wheelbase",
    "maxSteerDegrees",
    "maxSpeed",
  ]);
  start(project, request);
  ensure(
    Array.isArray(request.wheels) &&
      request.wheels.length >= 2 &&
      request.wheels.length <= 16,
    "INVALID_INPUT",
    "Declare 2–16 wheels",
  );
  const chassis = group(
    project,
    request.chassis,
    request.includeHidden === true,
  );
  const wheels = request.wheels.map((w) => {
    fields(w, [
      "id",
      "occurrenceIds",
      "frame",
      "axisLocal",
      "radius",
      "steering",
    ]);
    return group(
      project,
      { id: w.id, occurrenceIds: w.occurrenceIds, frame: w.frame },
      request.includeHidden === true,
    );
  });
  return finish(project, request, {
    schemaVersion: 1,
    id: request.id,
    name: request.name,
    mode: "kinematic",
    groups: [chassis, ...wheels],
    joints: [],
    vehicle: {
      chassisGroup: chassis.id,
      wheels: request.wheels.map((w) => ({
        groupId: w.id,
        axis: unit(w.axisLocal),
        radius: w.radius,
        steering: w.steering,
      })),
      wheelbase: request.wheelbase,
      maxSteerDegrees: request.maxSteerDegrees,
      maxSpeed: request.maxSpeed,
    },
  });
}
export function rigDraftCommand(draft: RigDraft, commandId: string): Command {
  return {
    schemaVersion: 1,
    commandId,
    expectedRevision: draft.sourceRevision,
    type: "rigs.upsert",
    payload: {
      rig: structuredClone(draft.rig),
      includeHidden: draft.includeHidden,
      ...(draft.activeLayerId === undefined
        ? {}
        : { activeLayerId: draft.activeLayerId }),
    },
  };
}
/** Pure impact preview. It never writes a rig or posed transforms to the project. */
export function previewRigDraft(
  project: Project,
  draft: RigDraft,
  input: {
    jointPositions?: Record<string, number>;
    vehicleInput?: { throttle: number; steering: number };
    ticks?: number;
  } = {},
) {
  ensure(
    project.revision === draft.sourceRevision,
    "REVISION_CONFLICT",
    "Project changed; rebuild the rig draft",
  );
  fields(input, ["jointPositions", "vehicleInput", "ticks"]);
  const session = new KinematicSession(
    {
      ...project,
      motionRigs: { ...project.motionRigs, [draft.rig.id]: draft.rig },
    },
    draft.rig.id,
  );
  for (const [id, value] of Object.entries(input.jointPositions ?? {}))
    session.setJointPosition(id, value);
  if (input.vehicleInput) session.setVehicleInput(input.vehicleInput);
  return input.ticks === undefined
    ? session.snapshot()
    : session.stepTicks(input.ticks);
}
