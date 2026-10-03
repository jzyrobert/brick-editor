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
import type {
  DriverSeatSpec,
  JointSpec,
  MotionRig,
  RigDynamics,
  RigidGroup,
} from "./types";

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
export type JointRigRequest = IdentityDraft & {
  fixed: GroupDraft;
  moving: GroupDraft;
  jointId: string;
  kind: Exclude<JointSpec["kind"], "cylindrical">;
  pivotWorld: Vec3;
  axisWorld?: Vec3;
  /** Degrees for revolute joints, LDU for prismatic joints. Absent means unbounded. */
  limits?: [number, number];
  motor?: JointSpec["motor"];
  /** Optional dynamic-Play settings, preserved through edits. */
  dynamics?: RigDynamics;
};
export type VehicleRigRequest = IdentityDraft & {
  driverSeat?: DriverSeatSpec;
  /** Optional dynamic-Play settings, preserved through edits. */
  dynamics?: RigDynamics;
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
      ...(rig.joints.some((j) => j.kind === "spherical")
        ? [
            "Spherical joints preserve their authored rest orientation; this kinematic preview has no multi-axis spherical actuator.",
          ]
        : []),
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
/** Explicit world pivot/axis are converted into each declared group frame. */
export function buildJointRig(
  project: Project,
  request: JointRigRequest,
): RigDraft {
  fields(request, [
    ...identityKeys,
    "fixed",
    "moving",
    "jointId",
    "kind",
    "pivotWorld",
    "axisWorld",
    "limits",
    "motor",
    "dynamics",
  ]);
  start(project, request);
  const fixed = group(project, request.fixed, request.includeHidden === true),
    moving = group(project, request.moving, request.includeHidden === true);
  vector(request.pivotWorld);
  const scalar = request.kind === "revolute" || request.kind === "prismatic";
  ensure(
    scalar ||
      (request.axisWorld === undefined &&
        request.limits === undefined &&
        request.motor === undefined),
    "INVALID_INPUT",
    "Fixed and spherical joints cannot have scalar axes, limits or motors",
  );
  const a = inverse(fixed.frame),
    b = inverse(moving.frame),
    axis = scalar ? unit(request.axisWorld!) : undefined;
  return finish(project, request, {
    schemaVersion: 1,
    id: request.id,
    name: request.name,
    mode: "kinematic",
    groups: [fixed, moving],
    joints: [
      {
        id: request.jointId,
        kind: request.kind,
        bodyA: fixed.id,
        bodyB: moving.id,
        anchorA: add(a.position, mv(a.basis, request.pivotWorld)),
        anchorB: add(b.position, mv(b.basis, request.pivotWorld)),
        ...(axis ? { axisA: mv(a.basis, axis), axisB: mv(b.basis, axis) } : {}),
        ...(request.limits === undefined
          ? {}
          : { limits: structuredClone(request.limits) }),
        ...(request.motor === undefined
          ? {}
          : { motor: structuredClone(request.motor) }),
      },
    ],
    ...(request.dynamics === undefined
      ? {}
      : { dynamics: structuredClone(request.dynamics) }),
  });
}
/** Bounded hinge convenience builder retained for existing callers. */
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
  ensure(
    Array.isArray(request.limits) && request.limits.length === 2,
    "INVALID_INPUT",
    "Declare both hinge angle limits in degrees",
  );
  return buildJointRig(project, {
    ...request,
    jointId: "hinge",
    kind: "revolute",
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
    "driverSeat",
    "dynamics",
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
      ...(request.driverSeat !== undefined
        ? { driverSeat: structuredClone(request.driverSeat) }
        : {}),
    },
    ...(request.dynamics === undefined
      ? {}
      : { dynamics: structuredClone(request.dynamics) }),
  });
}
/** Update only seat metadata, preserving all authored vehicle geometry and mechanics. */
export function buildDriverSeatDraft(
  project: Project,
  request: {
    rigId: string;
    expectedRevision: number;
    driverSeat: DriverSeatSpec | null;
    includeHidden?: boolean;
    activeLayerId?: string;
  },
): RigDraft {
  fields(request, [
    "rigId",
    "expectedRevision",
    "driverSeat",
    "includeHidden",
    "activeLayerId",
  ]);
  const existing = project.motionRigs[request.rigId];
  ensure(
    existing?.vehicle,
    "INVALID_INPUT",
    "Choose an existing vehicle rig for a driver seat",
  );
  ensure(
    request.driverSeat !== undefined,
    "INVALID_INPUT",
    "Supply driver seat metadata or null to remove it",
  );
  const identity = { ...request, id: existing.id, name: existing.name };
  start(project, identity);
  const rig = structuredClone(existing);
  if (request.driverSeat === null) delete rig.vehicle!.driverSeat;
  else rig.vehicle!.driverSeat = structuredClone(request.driverSeat);
  return finish(project, identity, rig);
}
/**
 * Update only a rig's optional dynamic-Play settings (masses, anchoring,
 * friction, suspension, engine force); `null` removes them. Mechanics, rest
 * data and members are unchanged, and the result is one undoable rig edit.
 */
export function buildRigDynamicsDraft(
  project: Project,
  request: {
    rigId: string;
    expectedRevision: number;
    dynamics: RigDynamics | null;
    includeHidden?: boolean;
    activeLayerId?: string;
  },
): RigDraft {
  fields(request, [
    "rigId",
    "expectedRevision",
    "dynamics",
    "includeHidden",
    "activeLayerId",
  ]);
  const existing = project.motionRigs[request.rigId];
  ensure(existing, "INVALID_INPUT", "Choose an existing rig");
  ensure(
    request.dynamics !== undefined,
    "INVALID_INPUT",
    "Supply physics settings or null to remove them",
  );
  const identity = { ...request, id: existing.id, name: existing.name };
  start(project, identity);
  const rig = structuredClone(existing);
  if (request.dynamics === null) delete rig.dynamics;
  else rig.dynamics = structuredClone(request.dynamics);
  return finish(project, identity, rig);
}
export type RigAuthoringRequest =
  | { kind: "joint"; request: JointRigRequest }
  | { kind: "vehicle"; request: VehicleRigRequest };
/** Imported values may satisfy domain tolerances yet be changed by normalized UI inputs. */
function ensureLosslessRig(original: MotionRig, reconstructed: MotionRig) {
  const equivalent = (a: unknown, b: unknown): boolean => {
    if (typeof a === "number" && typeof b === "number")
      return (
        Math.abs(a - b) <=
        1e-9 + 16 * Number.EPSILON * Math.max(Math.abs(a), Math.abs(b))
      );
    if (a === b) return true;
    if (Array.isArray(a) || Array.isArray(b))
      return (
        Array.isArray(a) &&
        Array.isArray(b) &&
        a.length === b.length &&
        a.every((v, i) => equivalent(v, b[i]))
      );
    if (!a || !b || typeof a !== "object" || typeof b !== "object")
      return false;
    const left = a as Record<string, unknown>,
      right = b as Record<string, unknown>,
      keys = Object.keys(left);
    return (
      keys.length === Object.keys(right).length &&
      keys.every(
        (key) => Object.hasOwn(right, key) && equivalent(left[key], right[key]),
      )
    );
  };
  const semantic = (rig: MotionRig) => ({
    ...rig,
    groups: [...rig.groups].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    ),
  });
  ensure(
    equivalent(semantic(original), semantic(reconstructed)),
    "INVALID_INPUT",
    "This rig cannot be loaded without changing stored axes, anchors or rest data. Keep the original rig, or explicitly redefine it through the automation API; this editor will not normalize it silently.",
  );
}
/** Load only losslessly representable topologies. Never flatten a joint tree or discard extra groups. */
export function rigAuthoringRequest(
  project: Project,
  rigId: string,
  scope: { includeHidden?: boolean; activeLayerId?: string } = {},
): RigAuthoringRequest {
  fields(scope, ["includeHidden", "activeLayerId"]);
  const rig = project.motionRigs[rigId];
  ensure(rig, "INVALID_INPUT", "Unknown motion rig");
  validateRig(project, rig);
  ensure(
    !rig.forceLinks?.length &&
      !rig.joints.some((j) => j.angularResistance !== undefined),
    "INVALID_INPUT",
    "This editor cannot load force links or angular resistance without losing authored data; use Physics settings or edit the full rig definition.",
  );
  const identity = {
    id: rig.id,
    name: rig.name,
    expectedRevision: project.revision,
    ...scope,
  };
  const draftGroup = (id: string): GroupDraft => {
    const g = rig.groups.find((g) => g.id === id)!;
    return {
      id: g.id,
      occurrenceIds: [...g.occurrenceIds],
      frame: structuredClone(g.frame),
    };
  };
  if (rig.vehicle) {
    const v = rig.vehicle;
    ensure(
      rig.joints.length === 0 && rig.groups.length === v.wheels.length + 1,
      "INVALID_INPUT",
      "This editor cannot load a vehicle with extra groups or joints without losing authored data",
    );
    const request: VehicleRigRequest = {
      ...identity,
      chassis: draftGroup(v.chassisGroup),
      wheels: v.wheels.map((w) => ({
        ...draftGroup(w.groupId),
        axisLocal: [...w.axis],
        radius: w.radius,
        steering: w.steering,
      })),
      wheelbase: v.wheelbase,
      maxSteerDegrees: v.maxSteerDegrees,
      maxSpeed: v.maxSpeed,
      ...(v.driverSeat !== undefined
        ? { driverSeat: structuredClone(v.driverSeat) }
        : {}),
      ...(rig.dynamics ? { dynamics: structuredClone(rig.dynamics) } : {}),
    };
    ensureLosslessRig(rig, buildVehicleRig(project, request).rig);
    return { kind: "vehicle", request };
  }
  ensure(
    rig.groups.length === 2 && rig.joints.length === 1,
    "INVALID_INPUT",
    "This editor supports one joint between two groups; a joint tree or extra groups cannot be loaded without losing authored data",
  );
  const joint = rig.joints[0],
    fixed = draftGroup(joint.bodyA),
    moving = draftGroup(joint.bodyB);
  ensure(
    joint.kind !== "cylindrical",
    "INVALID_INPUT",
    "This editor cannot load cylindrical freedom and axial stops without losing authored data; edit the full rig definition.",
  );
  const request: JointRigRequest = {
    ...identity,
    fixed,
    moving,
    jointId: joint.id,
    kind: joint.kind,
    pivotWorld: add(fixed.frame.position, mv(fixed.frame.basis, joint.anchorA)),
    ...(joint.axisA ? { axisWorld: mv(fixed.frame.basis, joint.axisA) } : {}),
    ...(joint.limits ? { limits: structuredClone(joint.limits) } : {}),
    ...(joint.motor ? { motor: structuredClone(joint.motor) } : {}),
    ...(rig.dynamics ? { dynamics: structuredClone(rig.dynamics) } : {}),
  };
  ensureLosslessRig(rig, buildJointRig(project, request).rig);
  return { kind: "joint", request };
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
