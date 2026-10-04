import {
  ensure,
  type Basis,
  type Occurrence,
  type Project,
  type Transform,
  type Vec3,
} from "../core/types";
import { occurrences } from "../core/document";
import {
  add,
  compose,
  identity,
  inverse,
  mv,
  nearlyPhysical,
  physical,
  rotationY,
} from "../core/math";
import type { KinematicPose, MechanismSnapshot, MotionRig } from "./types";
import {
  transmissionMap,
  transmissionSpeedLimit,
  validateTransmissionPose,
  type TransmissionMap,
} from "./transmissions";
import {
  closeLoopPose,
  validateClosurePose,
  LOOP_LIMITS,
  loopSingular,
} from "./loops";
const DT = 1 / 60;
const vector = (v: unknown): v is Vec3 =>
  Array.isArray(v) &&
  v.length === 3 &&
  v.every(
    (x) => typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= 1e7,
  );
const safeId = (id: unknown) =>
  typeof id === "string" &&
  id.length > 0 &&
  id.length <= 128 &&
  !["__proto__", "constructor", "prototype"].includes(id);
const near = (a: number[], b: number[], t = 1e-5) =>
  a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < t);
const position = (t: Transform, p: Vec3) => add(t.position, mv(t.basis, p));
export function axisRotation(axis: Vec3, deg: number): Basis {
  const [x, y, z] = axis,
    c = Math.cos((deg * Math.PI) / 180),
    s = Math.sin((deg * Math.PI) / 180),
    t = 1 - c;
  return [
    t * x * x + c,
    t * x * y - s * z,
    t * x * z + s * y,
    t * x * y + s * z,
    t * y * y + c,
    t * y * z - s * x,
    t * x * z - s * y,
    t * y * z + s * x,
    t * z * z + c,
  ];
}
const around = (pivot: Vec3, basis: Basis): Transform => ({
  basis,
  position: add(pivot, mv(basis, pivot).map((v) => -v) as Vec3),
});
const finite = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= 1e9;
const rigid = (t: Transform) =>
  t &&
  vector(t.position) &&
  Array.isArray(t.basis) &&
  t.basis.length === 9 &&
  t.basis.every(finite) &&
  physical(t);
const member = (t: Transform) =>
  t &&
  vector(t.position) &&
  Array.isArray(t.basis) &&
  t.basis.length === 9 &&
  t.basis.every(finite) &&
  nearlyPhysical(t);
function fields(value: object, allowed: string[]) {
  ensure(
    value &&
      typeof value === "object" &&
      Object.keys(value).every((k) => allowed.includes(k)),
    "INVALID_INPUT",
    "Unknown mechanism field.",
  );
}
export function validateRig(
  project: Project,
  rig: MotionRig,
  checkRest = true,
  /** Optional precomputed occurrence index for the same project revision. */
  lookup?: ReadonlyMap<string, Occurrence>,
) {
  fields(rig, [
    "schemaVersion",
    "id",
    "name",
    "mode",
    "groups",
    "joints",
    "transmissions",
    "loopClosures",
    "forceLinks",
    "grippers",
    "vehicle",
    "dynamics",
  ]);
  ensure(
    rig.schemaVersion === 1 &&
      rig.mode === "kinematic" &&
      safeId(rig.id) &&
      typeof rig.name === "string" &&
      rig.name.length <= 200,
    "INVALID_INPUT",
    "Invalid kinematic rig identity.",
  );
  ensure(
    Array.isArray(rig.groups) &&
      rig.groups.length > 0 &&
      rig.groups.length <= 100 &&
      Array.isArray(rig.joints) &&
      rig.joints.length <= 100,
    "LIMIT_EXCEEDED",
    "Rig requires 1–100 groups and at most 100 joints.",
  );
  const ids = new Set<string>(),
    members = new Set<string>(),
    all = lookup ?? new Map(occurrences(project).map((o) => [o.id, o]));
  for (const group of rig.groups) {
    fields(group, ["id", "occurrenceIds", "frame", "restTransforms"]);
    ensure(
      safeId(group.id) && !ids.has(group.id),
      "INVALID_INPUT",
      "Group identifiers must be unique.",
    );
    ids.add(group.id);
    ensure(
      rigid(group.frame),
      "INVALID_TRANSFORM",
      "Rigid group frames must have a proper orthonormal basis.",
    );
    ensure(
      Array.isArray(group.occurrenceIds) &&
        group.occurrenceIds.length > 0 &&
        group.occurrenceIds.length <= 10000,
      "LIMIT_EXCEEDED",
      "Rigid group requires 1–10,000 members.",
    );
    ensure(
      group.restTransforms &&
        Object.keys(group.restTransforms).length === group.occurrenceIds.length,
      "INVALID_INPUT",
      "Every rigid group member requires exactly one rest transform.",
    );
    for (const id of group.occurrenceIds) {
      const o = all.get(id);
      ensure(
        o && !members.has(id),
        "INVALID_INPUT",
        "Rigid groups require distinct, existing occurrence members.",
      );
      members.add(id);
      const rest = group.restTransforms[id];
      // Members may carry LDraw's rounded rotations (official models write
      // 0.707 or 0.661/0.75); group frames stay exact rotations.
      ensure(
        member(rest) && nearlyPhysical(o.transform),
        "INVALID_TRANSFORM",
        "Scaled, mirrored or sheared members need explicit supported physical proxies before rigging.",
      );
      if (checkRest)
        ensure(
          near(rest.position, o.transform.position) &&
            near(rest.basis, o.transform.basis),
          "REVISION_CONFLICT",
          "Authored members moved since this rig rest pose; redefine the rig.",
        );
    }
  }
  const parent = new Map<string, string>(),
    jointIds = new Set<string>();
  for (const joint of rig.joints) {
    fields(joint, [
      "id",
      "bodyA",
      "bodyB",
      "kind",
      "anchorA",
      "anchorB",
      "axisA",
      "axisB",
      "limits",
      "motor",
      "angularResistance",
      "translationLimitsLdu",
      "mating",
    ]);
    ensure(
      safeId(joint.id) && !jointIds.has(joint.id),
      "INVALID_INPUT",
      "Joint identifiers must be unique.",
    );
    jointIds.add(joint.id);
    ensure(
      ids.has(joint.bodyA) &&
        ids.has(joint.bodyB) &&
        joint.bodyA !== joint.bodyB &&
        !parent.has(joint.bodyB),
      "INVALID_INPUT",
      "Joints must form a tree with one parent per child group.",
    );
    parent.set(joint.bodyB, joint.bodyA);
    ensure(
      ["fixed", "revolute", "prismatic", "spherical", "cylindrical"].includes(
        joint.kind,
      ) &&
        vector(joint.anchorA) &&
        vector(joint.anchorB),
      "INVALID_INPUT",
      "Invalid joint type or anchors.",
    );
    if (joint.angularResistance !== undefined) {
      fields(joint.angularResistance, ["maxTorqueNm", "dampingNmSeconds"]);
      ensure(
        joint.kind === "spherical" &&
          finite(joint.angularResistance.maxTorqueNm) &&
          joint.angularResistance.maxTorqueNm >= 0 &&
          joint.angularResistance.maxTorqueNm <= 1000000 &&
          finite(joint.angularResistance.dampingNmSeconds) &&
          joint.angularResistance.dampingNmSeconds >= 0 &&
          joint.angularResistance.dampingNmSeconds <= 100000,
        "INVALID_INPUT",
        "Angular resistance requires a spherical joint, bounded torque (0–1,000,000 N*m) and damping (0–100,000 N*m*s).",
      );
    }
    const a = rig.groups.find((g) => g.id === joint.bodyA)!,
      b = rig.groups.find((g) => g.id === joint.bodyB)!;
    ensure(
      near(
        position(a.frame, joint.anchorA),
        position(b.frame, joint.anchorB),
        1e-3,
      ),
      "INVALID_INPUT",
      "Joint rest anchors must coincide in world space.",
    );
    ensure(
      joint.kind === "cylindrical" || joint.translationLimitsLdu === undefined,
      "INVALID_INPUT",
      "Axial translation stops belong only to cylindrical bearings.",
    );
    if (joint.mating !== undefined) {
      ensure(
        joint.kind === "revolute",
        "INVALID_INPUT",
        "Local mating allowances currently support revolute joints only",
      );
      fields(joint.mating, ["radiusLdu", "halfLengthLdu"]);
      ensure(
        finite(joint.mating.radiusLdu) &&
          joint.mating.radiusLdu > 0 &&
          joint.mating.radiusLdu <= 32 &&
          finite(joint.mating.halfLengthLdu) &&
          joint.mating.halfLengthLdu > 0 &&
          joint.mating.halfLengthLdu <= 2048,
        "INVALID_INPUT",
        "Joint mating allowance exceeds the supported local bearing region",
      );
    }
    if (
      joint.kind === "revolute" ||
      joint.kind === "prismatic" ||
      joint.kind === "cylindrical"
    ) {
      ensure(
        vector(joint.axisA) &&
          vector(joint.axisB) &&
          Math.abs(Math.hypot(...joint.axisA) - 1) < 1e-5 &&
          Math.abs(Math.hypot(...joint.axisB) - 1) < 1e-5,
        "INVALID_INPUT",
        "Joint axes must be declared unit vectors.",
      );
      ensure(
        near(mv(a.frame.basis, joint.axisA), mv(b.frame.basis, joint.axisB)),
        "INVALID_INPUT",
        "Joint axes must agree at rest.",
      );
      if (joint.kind === "cylindrical") {
        ensure(
          joint.motor === undefined && joint.limits === undefined,
          "INVALID_INPUT",
          "Cylindrical bearings have free axial/spin motion; scalar motors/limits are not supported. Use translationLimitsLdu for axial stops.",
        );
        if (joint.translationLimitsLdu !== undefined)
          ensure(
            Array.isArray(joint.translationLimitsLdu) &&
              joint.translationLimitsLdu.length === 2 &&
              joint.translationLimitsLdu.every(
                (v) => finite(v) && Math.abs(v) <= 10000,
              ) &&
              joint.translationLimitsLdu[0] <= 0 &&
              joint.translationLimitsLdu[1] >= 0,
            "INVALID_INPUT",
            "Cylindrical axial stops must enclose zero within ±10,000 LDU.",
          );
      }
      if (joint.limits)
        ensure(
          Array.isArray(joint.limits) &&
            joint.limits.length === 2 &&
            joint.limits.every(finite) &&
            joint.limits[0] <= 0 &&
            joint.limits[1] >= 0,
          "INVALID_INPUT",
          "Limits must enclose the authored zero rest position.",
        );
      if (joint.motor) {
        fields(joint.motor, ["mode", "target", "maxEffort", "binding"]);
        if (joint.motor.binding) {
          fields(joint.motor.binding, ["occurrenceId", "profile"]);
          ensure(
            typeof joint.motor.binding.occurrenceId === "string" &&
              joint.motor.binding.occurrenceId.length > 0 &&
              joint.motor.binding.profile === "power-functions-motor-m-v1",
            "INVALID_INPUT",
            "Motor binding must name a supported physical motor occurrence.",
          );
        }
        fields(joint.motor.maxEffort, ["value", "unit"]);
        ensure(
          ["position", "velocity"].includes(joint.motor.mode) &&
            finite(joint.motor.target) &&
            finite(joint.motor.maxEffort.value) &&
            joint.motor.maxEffort.value >= 0 &&
            joint.motor.maxEffort.unit ===
              (joint.kind === "revolute" ? "N*m" : "N"),
          "INVALID_INPUT",
          "Motor target or effort unit is invalid for this joint.",
        );
      }
    } else
      ensure(
        !joint.limits &&
          !joint.motor &&
          !joint.axisA &&
          !joint.axisB &&
          !joint.mating,
        "INVALID_INPUT",
        "Fixed and spherical joints do not accept scalar limits, motors or axes.",
      );
  }
  for (const id of ids) {
    const visited = new Set<string>();
    let current: string | undefined = id;
    while (current) {
      ensure(!visited.has(current), "REFERENCE_CYCLE", "Motion joint cycle.");
      visited.add(current);
      current = parent.get(current);
    }
  }
  if (rig.loopClosures !== undefined) {
    ensure(
      Array.isArray(rig.loopClosures) &&
        rig.loopClosures.length <= LOOP_LIMITS.closures &&
        !rig.vehicle,
      "INVALID_INPUT",
      "Planar loops allow at most eight closures and cannot be vehicle rigs.",
    );
    const dependent = new Set<string>();
    const closurePairs = new Set<string>();
    for (const c of rig.loopClosures) {
      fields(c, [
        "id",
        "kind",
        "bodyA",
        "bodyB",
        "anchorA",
        "anchorB",
        "axisA",
        "axisB",
        "dependentJointIds",
        "mating",
      ]);
      ensure(
        safeId(c.id) &&
          !jointIds.has(c.id) &&
          c.kind === "revolute" &&
          ids.has(c.bodyA) &&
          ids.has(c.bodyB) &&
          c.bodyA !== c.bodyB,
        "INVALID_INPUT",
        "Invalid or duplicate closure identity or bodies.",
      );
      jointIds.add(c.id);
      if (c.mating !== undefined) {
        fields(c.mating, ["radiusLdu", "halfLengthLdu"]);
        ensure(
          finite(c.mating.radiusLdu) &&
            c.mating.radiusLdu > 0 &&
            c.mating.radiusLdu <= 32 &&
            finite(c.mating.halfLengthLdu) &&
            c.mating.halfLengthLdu > 0 &&
            c.mating.halfLengthLdu <= 2048,
          "INVALID_INPUT",
          "Closure mating allowance exceeds the supported local bearing region",
        );
      }
      const pair = [c.bodyA, c.bodyB].sort().join("\u0000");
      ensure(
        !closurePairs.has(pair),
        "INVALID_INPUT",
        "Repeated closure body pairs introduce redundant constraints.",
      );
      closurePairs.add(pair);
      ensure(
        vector(c.anchorA) &&
          vector(c.anchorB) &&
          vector(c.axisA) &&
          vector(c.axisB) &&
          Math.abs(Math.hypot(...c.axisA) - 1) < 1e-5 &&
          Math.abs(Math.hypot(...c.axisB) - 1) < 1e-5,
        "INVALID_INPUT",
        "Closure requires finite anchors and unit axes.",
      );
      const path = new Set<string>();
      let current: string | undefined = c.bodyA;
      while (current) {
        path.add(current);
        current = parent.get(current);
      }
      current = c.bodyB;
      const branch: string[] = [];
      while (current && !path.has(current)) {
        branch.push(current);
        current = parent.get(current);
      }
      ensure(
        current,
        "INVALID_INPUT",
        "Closure bodies must belong to the same joint tree.",
      );
      let other = c.bodyA;
      while (other !== current) {
        branch.push(other);
        other = parent.get(other)!;
      }
      const pathJoints = rig.joints.filter((j) => branch.includes(j.bodyB));
      const axis = mv(
        rig.groups.find((g) => g.id === c.bodyA)!.frame.basis,
        c.axisA,
      );
      ensure(
        near(
          axis,
          mv(rig.groups.find((g) => g.id === c.bodyB)!.frame.basis, c.axisB),
        ) &&
          pathJoints.length >= 2 &&
          pathJoints.every((j) => {
            const a = rig.groups.find((g) => g.id === j.bodyA)!;
            const ja = j.axisA && mv(a.frame.basis, j.axisA);
            return (
              j.kind === "fixed" ||
              (j.kind === "revolute" &&
                ja &&
                Math.abs(ja.reduce((sum, v, k) => sum + v * axis[k], 0)) >
                  1 - 1e-5) ||
              (j.kind === "prismatic" &&
                ja &&
                Math.abs(ja.reduce((sum, v, k) => sum + v * axis[k], 0)) < 1e-5)
            );
          }),
        "INVALID_INPUT",
        "Closure requires a planar tree path with compatible hinge axes and in-plane sliders.",
      );
      ensure(
        Array.isArray(c.dependentJointIds) &&
          c.dependentJointIds.length >= 2 &&
          c.dependentJointIds.length <= LOOP_LIMITS.dependentJoints &&
          new Set(c.dependentJointIds).size === c.dependentJointIds.length,
        "INVALID_INPUT",
        "Closure requires distinct passive dependent coordinates.",
      );
      for (const id of c.dependentJointIds) {
        const j = pathJoints.find((j) => j.id === id);
        ensure(
          j &&
            (j.kind === "revolute" || j.kind === "prismatic") &&
            !j.motor &&
            !rig.transmissions?.some((t) => t.jointA === id || t.jointB === id),
          "INVALID_INPUT",
          "Closure dependent joints must lie on its path and cannot carry motors or transmissions.",
        );
        dependent.add(id);
      }
    }
    ensure(
      dependent.size <= LOOP_LIMITS.dependentJoints,
      "LIMIT_EXCEEDED",
      "At most sixteen loop dependent coordinates are supported.",
    );
    validateClosurePose(rig, {});
  }
  if (rig.grippers !== undefined) {
    ensure(
      Array.isArray(rig.grippers) && rig.grippers.length <= 8,
      "LIMIT_EXCEEDED",
      "At most eight grippers are supported per rig.",
    );
    const gripIds = new Set<string>(),
      gripGroups = new Set<string>();
    for (const grip of rig.grippers) {
      fields(grip, [
        "id",
        "groupId",
        "anchor",
        "captureRadiusLdu",
        "maxPayloadMassKg",
      ]);
      ensure(
        safeId(grip.id) &&
          !gripIds.has(grip.id) &&
          ids.has(grip.groupId) &&
          !(
            Array.isArray(rig.vehicle?.wheels) &&
            rig.vehicle!.wheels.some((wheel) => wheel.groupId === grip.groupId)
          ) &&
          !gripGroups.has(grip.groupId) &&
          vector(grip.anchor) &&
          grip.anchor.every((value) => Math.abs(value) <= 2048),
        "INVALID_INPUT",
        "Grippers require unique IDs, distinct existing groups and local anchors within 2048 LDU.",
      );
      ensure(
        finite(grip.captureRadiusLdu) &&
          grip.captureRadiusLdu > 0 &&
          grip.captureRadiusLdu <= 32 &&
          finite(grip.maxPayloadMassKg) &&
          grip.maxPayloadMassKg >= 0.01 &&
          grip.maxPayloadMassKg <= 1000,
        "INVALID_INPUT",
        "Gripper capture radius must be 0–32 LDU and payload limit 0.01–1000 kg.",
      );
      gripIds.add(grip.id);
      gripGroups.add(grip.groupId);
    }
  }
  if (rig.forceLinks !== undefined) {
    ensure(
      Array.isArray(rig.forceLinks) && rig.forceLinks.length <= 32,
      "LIMIT_EXCEEDED",
      "At most 32 force links are supported per rig.",
    );
    for (const link of rig.forceLinks) {
      fields(link, [
        "id",
        "kind",
        "bodyA",
        "bodyB",
        "anchorA",
        "anchorB",
        ...(link.kind === "spring"
          ? [
              "restLengthLdu",
              "stiffnessNewtonsPerMetre",
              "dampingNewtonsSecondsPerMetre",
            ]
          : ["maxLengthLdu"]),
      ]);
      ensure(
        safeId(link.id) &&
          !jointIds.has(link.id) &&
          ids.has(link.bodyA) &&
          ids.has(link.bodyB) &&
          link.bodyA !== link.bodyB &&
          vector(link.anchorA) &&
          vector(link.anchorB),
        "INVALID_INPUT",
        "Force links require unique identities, distinct existing bodies and finite local anchors.",
      );
      jointIds.add(link.id);
      const within = (n: unknown, low: number, high: number) =>
        finite(n) && n >= low && n <= high;
      if (link.kind === "spring")
        ensure(
          within(link.restLengthLdu, 0, 10000) &&
            within(link.stiffnessNewtonsPerMetre, 0.001, 1000000) &&
            within(link.dampingNewtonsSecondsPerMetre, 0, 100000),
          "INVALID_INPUT",
          "Spring requires bounded rest length, stiffness (N/m) and damping (N*s/m).",
        );
      else {
        ensure(
          link.kind === "rope" && within(link.maxLengthLdu, 0.01, 10000),
          "INVALID_INPUT",
          "Rope requires a bounded positive maximum length.",
        );
        const a = rig.groups.find((g) => g.id === link.bodyA)!,
          b = rig.groups.find((g) => g.id === link.bodyB)!;
        const pa = position(a.frame, link.anchorA),
          pb = position(b.frame, link.anchorB);
        ensure(
          Math.hypot(...pa.map((v, k) => v - pb[k])) <=
            link.maxLengthLdu + 0.001,
          "INVALID_INPUT",
          "Authored rope attachments exceed its maximum length.",
        );
      }
    }
  }
  transmissionMap(rig);
  if (rig.vehicle) {
    const v = rig.vehicle;
    fields(v, [
      "chassisGroup",
      "wheels",
      "wheelbase",
      "maxSteerDegrees",
      "maxSpeed",
      "driverSeat",
    ]);
    ensure(
      ids.has(v.chassisGroup) && !parent.has(v.chassisGroup),
      "INVALID_INPUT",
      "Vehicle chassis must be a root rigid group.",
    );
    ensure(
      finite(v.wheelbase) &&
        v.wheelbase >= 1 &&
        finite(v.maxSpeed) &&
        v.maxSpeed > 0 &&
        v.maxSpeed <= 10000 &&
        finite(v.maxSteerDegrees) &&
        v.maxSteerDegrees > 0 &&
        v.maxSteerDegrees < 80,
      "INVALID_INPUT",
      "Invalid vehicle dimensions or speed.",
    );
    ensure(
      Array.isArray(v.wheels) && v.wheels.length >= 2 && v.wheels.length <= 16,
      "INVALID_INPUT",
      "Vehicle requires 2–16 authored wheel groups.",
    );
    if (v.driverSeat !== undefined) {
      const seat = v.driverSeat;
      fields(seat, [
        "id",
        "profile",
        "pelvisPosition",
        "yawDegrees",
        "accessPoint",
        "approachPosition",
        "exits",
      ]);
      const point = (p: unknown) =>
        vector(p) && p.every((x) => Math.abs(x) <= 10000);
      const yaw = (n: unknown) => finite(n) && Math.abs(n) <= 360;
      ensure(
        safeId(seat.id) &&
          seat.profile === "brick-figure-open-seat-v1" &&
          point(seat.pelvisPosition) &&
          point(seat.accessPoint) &&
          point(seat.approachPosition) &&
          yaw(seat.yawDegrees) &&
          Array.isArray(seat.exits) &&
          seat.exits.length >= 1 &&
          seat.exits.length <= 4,
        "INVALID_INPUT",
        "Driver seat requires a supported profile, bounded chassis-local positions, yaw and 1–4 ordered exits.",
      );
      for (const exit of seat.exits) {
        fields(exit, ["position", "yawDegrees"]);
        ensure(
          point(exit.position) && yaw(exit.yawDegrees),
          "INVALID_INPUT",
          "Invalid driver seat exit position or yaw.",
        );
      }
    }
    const wheels = new Set<string>();
    for (const w of v.wheels) {
      fields(w, ["groupId", "axis", "radius", "steering"]);
      ensure(
        ids.has(w.groupId) &&
          w.groupId !== v.chassisGroup &&
          !wheels.has(w.groupId) &&
          !parent.has(w.groupId) &&
          !rig.joints.some((j) => j.bodyA === w.groupId) &&
          vector(w.axis) &&
          Math.abs(Math.hypot(...w.axis) - 1) < 1e-5 &&
          finite(w.radius) &&
          w.radius >= 0.1 &&
          typeof w.steering === "boolean",
        "INVALID_INPUT",
        "Wheel groups must be distinct unjointed roots with a declared unit axle and positive radius.",
      );
      wheels.add(w.groupId);
    }
  }
  if (rig.dynamics !== undefined) validateRigDynamics(rig, ids);
  return rig;
}
/** Bounds for optional dynamic settings. They configure Play only. */
export const RIG_DYNAMICS_LIMITS = Object.freeze({
  massKg: { min: 0.001, max: 100000 },
  friction: { min: 0, max: 4 },
  restLength: { min: 0.5, max: 200 },
  travel: { min: 0.5, max: 200 },
  stiffness: { min: 1, max: 500 },
  damping: { min: 0.05, max: 50 },
  engineForce: { min: 0, max: 1000000 },
});
function validateRigDynamics(rig: MotionRig, groupIds: Set<string>) {
  const d = rig.dynamics!,
    L = RIG_DYNAMICS_LIMITS;
  fields(d, [
    "groups",
    "friction",
    "suspension",
    "engineForce",
    "startDynamic",
  ]);
  ensure(
    d.startDynamic === undefined || typeof d.startDynamic === "boolean",
    "INVALID_INPUT",
    "startDynamic must be boolean.",
  );
  const within = (n: unknown, range: { min: number; max: number }) =>
    finite(n) && n >= range.min && n <= range.max;
  if (d.groups !== undefined) {
    ensure(
      d.groups && typeof d.groups === "object" && !Array.isArray(d.groups),
      "INVALID_INPUT",
      "Dynamic group settings must be keyed by rig group ID.",
    );
    for (const [id, settings] of Object.entries(d.groups)) {
      ensure(
        groupIds.has(id),
        "INVALID_INPUT",
        `Dynamic settings name unknown group ${id}.`,
      );
      fields(settings, ["massKg", "anchored"]);
      ensure(
        (settings.massKg === undefined || within(settings.massKg, L.massKg)) &&
          (settings.anchored === undefined ||
            typeof settings.anchored === "boolean"),
        "INVALID_INPUT",
        `Group mass must be ${L.massKg.min}–${L.massKg.max} kg and anchored must be boolean.`,
      );
    }
    if (rig.vehicle)
      ensure(
        !Object.entries(d.groups).some(
          ([id, settings]) =>
            settings.anchored &&
            (id === rig.vehicle!.chassisGroup ||
              rig.vehicle!.wheels.some((w) => w.groupId === id)),
        ),
        "INVALID_INPUT",
        "A dynamic vehicle chassis or wheel cannot be anchored.",
      );
  }
  ensure(
    d.friction === undefined || within(d.friction, L.friction),
    "INVALID_INPUT",
    `Friction must be ${L.friction.min}–${L.friction.max}.`,
  );
  ensure(
    d.engineForce === undefined || within(d.engineForce, L.engineForce),
    "INVALID_INPUT",
    `Engine force must be ${L.engineForce.min}–${L.engineForce.max} N.`,
  );
  if (d.suspension !== undefined) {
    ensure(
      !!rig.vehicle,
      "INVALID_INPUT",
      "Suspension settings require a vehicle rig.",
    );
    fields(d.suspension, ["restLength", "travel", "stiffness", "damping"]);
    ensure(
      within(d.suspension.restLength, L.restLength) &&
        within(d.suspension.travel, L.travel) &&
        within(d.suspension.stiffness, L.stiffness) &&
        within(d.suspension.damping, L.damping),
      "INVALID_INPUT",
      "Suspension needs rest length and travel of 0.5–200 LDU, stiffness 1–500 and damping 0.05–50.",
    );
  }
}
export class KinematicSession {
  private rig: MotionRig;
  private transmissions: TransmissionMap;
  private pose: KinematicPose;
  private loopTangents = new Map<string, Record<string, number>>();
  private tick = 0;
  private throttle = 0;
  private steering = 0;
  private revision: number;
  constructor(
    project: Project,
    rigId: string,
    lookup?: ReadonlyMap<string, Occurrence>,
  ) {
    const rig = project.motionRigs[rigId] as MotionRig;
    ensure(
      rig && rig.id === rigId,
      "INVALID_INPUT",
      "Unknown or inconsistent motion rig identity.",
    );
    validateRig(project, rig, true, lookup);
    this.rig = structuredClone(rig);
    this.transmissions = transmissionMap(this.rig);
    // Only the revision is needed; cloning the whole project per rig was
    // quadratic in large Play worlds with many (derived) rigs.
    this.revision = project.revision;
    this.pose = {
      jointPositions: Object.fromEntries(
        rig.joints
          .filter((j) => j.kind === "revolute" || j.kind === "prismatic")
          .map((j) => [j.id, 0]),
      ),
    };
    if (rig.vehicle)
      this.pose.vehicle = {
        position: [0, 0, 0],
        headingDegrees: 0,
        steeringDegrees: 0,
        wheelAngles: Object.fromEntries(
          rig.vehicle.wheels.map((w) => [w.groupId, 0]),
        ),
      };
  }
  setJointPosition(id: string, value: number) {
    const j = this.rig.joints.find((j) => j.id === id);
    ensure(
      j && (j.kind === "revolute" || j.kind === "prismatic") && finite(value),
      "INVALID_INPUT",
      "Joint requires a finite scalar position.",
    );
    ensure(
      !this.rig.loopClosures?.some((c) => c.dependentJointIds.includes(id)),
      "INVALID_INPUT",
      "Loop dependent joints are passive; control an independent joint.",
    );
    const changes = [...(this.transmissions.get(id) ?? new Map([[id, 1]]))].map(
      ([other, ratio]) => [other, value * ratio] as const,
    );
    for (const [other, position] of changes) {
      const joint = this.rig.joints.find((j) => j.id === other)!;
      ensure(
        finite(position) &&
          (!joint.limits ||
            (position >= joint.limits[0] && position <= joint.limits[1])),
        "INVALID_INPUT",
        "Coupled joint position is outside authored limits.",
      );
    }
    const candidate = { ...this.pose.jointPositions };
    for (const [other, position] of changes) candidate[other] = position;
    if (!this.rig.loopClosures?.length) this.pose.jointPositions = candidate;
    else {
      const start = this.pose.jointPositions,
        delta = value - start[id];
      const steps = Math.max(1, Math.ceil(Math.abs(delta) / 2));
      ensure(
        steps <= 1024,
        "LIMIT_EXCEEDED",
        "Loop motion requires at most 1,024 continuation segments; use smaller commands.",
      );
      let current = { ...start },
        tangent = this.loopTangents.get(id);
      ensure(
        delta === 0 || tangent || !loopSingular(this.rig, start),
        "INVALID_INPUT",
        "Mechanism loop is at an ambiguous dead center; use an established motion path or edit its rest pose away from the toggle.",
      );
      for (let step = 1; step <= steps; step++) {
        const input = start[id] + (delta * step) / steps,
          increment = input - current[id];
        const seed = { ...current };
        if (tangent)
          for (const [dependent, slope] of Object.entries(tangent))
            seed[dependent] += slope * increment;
        for (const [other, ratio] of this.transmissions.get(id) ??
          new Map([[id, 1]]))
          seed[other] = input * ratio;
        const solved = closeLoopPose(this.rig, seed);
        if (increment !== 0)
          tangent = Object.fromEntries(
            this.rig.loopClosures
              .flatMap((c) => c.dependentJointIds)
              .map((dependent) => [
                dependent,
                (solved[dependent] - current[dependent]) / increment,
              ]),
          );
        current = solved;
      }
      if (tangent) this.loopTangents.set(id, tangent);
      this.pose.jointPositions = current;
    }
    return this.snapshot();
  }
  /** Reclose passive coordinates for swept interpolation without changing inputs. */
  closePose(pose: KinematicPose): KinematicPose {
    return {
      ...pose,
      jointPositions: closeLoopPose(this.rig, pose.jointPositions),
    };
  }
  /** Limits reflected through every connected shaft, in this shaft's degrees. */
  jointLimits(id: string): [number, number] {
    let low = -1e9,
      high = 1e9;
    for (const [other, ratio] of this.transmissions.get(id) ??
      new Map([[id, 1]])) {
      const joint = this.rig.joints.find((j) => j.id === other);
      ensure(joint, "INVALID_INPUT", "Unknown joint.");
      const values = (joint.limits ?? [-1e9, 1e9]).map((v) => v / ratio);
      low = Math.max(low, Math.min(...values));
      high = Math.min(high, Math.max(...values));
    }
    return [low, high];
  }
  coupledJointIds(id: string) {
    return [...(this.transmissions.get(id)?.keys() ?? [id])];
  }
  jointSpeedLimit(id: string) {
    return this.transmissions.has(id)
      ? transmissionSpeedLimit(this.transmissions, id)
      : Infinity;
  }
  clearInput() {
    this.throttle = 0;
  }
  /** True when a fixed tick cannot change the pose (no throttle). */
  get stationary() {
    return this.throttle === 0;
  }
  /** Advance the tick counter of a stationary rig without recomputing its pose. */
  idleTick() {
    ensure(this.stationary, "INVALID_INPUT", "Rig is moving");
    this.tick++;
  }
  /** Narrow one scalar joint's limits for this session (never widens them). */
  restrictLimits(id: string, limits: [number, number]) {
    const joint = this.rig.joints.find((j) => j.id === id);
    ensure(
      joint &&
        (joint.kind === "revolute" || joint.kind === "prismatic") &&
        limits[0] <= 0 &&
        limits[1] >= 0 &&
        (!joint.limits ||
          (limits[0] >= joint.limits[0] && limits[1] <= joint.limits[1])),
      "INVALID_INPUT",
      "Session limits must narrow the authored limits and include zero.",
    );
    joint.limits = [limits[0], limits[1]];
  }
  setVehicleInput(input: { throttle: number; steering: number }) {
    fields(input, ["throttle", "steering"]);
    ensure(
      this.rig.vehicle &&
        finite(input.throttle) &&
        Math.abs(input.throttle) <= 1 &&
        finite(input.steering) &&
        Math.abs(input.steering) <= 1,
      "INVALID_INPUT",
      "Vehicle input requires normalized throttle and steering.",
    );
    this.throttle = input.throttle;
    this.steering = input.steering;
    this.pose.vehicle!.steeringDegrees =
      input.steering * this.rig.vehicle!.maxSteerDegrees;
  }
  setPose(pose: KinematicPose) {
    const previous = structuredClone(this.pose),
      previousSteering = this.steering;
    try {
      fields(pose, ["jointPositions", "vehicle"]);
      ensure(
        pose.jointPositions &&
          Object.keys(pose.jointPositions).length ===
            Object.keys(this.pose.jointPositions).length,
        "INVALID_INPUT",
        "Pose must specify every scalar joint.",
      );
      for (const [id, value] of Object.entries(pose.jointPositions)) {
        const joint = this.rig.joints.find((j) => j.id === id);
        ensure(
          joint &&
            (joint.kind === "revolute" || joint.kind === "prismatic") &&
            finite(value) &&
            (!joint.limits ||
              (value >= joint.limits[0] && value <= joint.limits[1])),
          "INVALID_INPUT",
          "Pose has an invalid scalar joint position.",
        );
      }
      validateTransmissionPose(this.transmissions, pose.jointPositions);
      validateClosurePose(this.rig, pose.jointPositions);
      this.pose.jointPositions = { ...pose.jointPositions };
      if (this.rig.vehicle) {
        const v = pose.vehicle;
        ensure(
          v &&
            vector(v.position) &&
            v.position[1] === 0 &&
            finite(v.headingDegrees) &&
            finite(v.steeringDegrees) &&
            Math.abs(v.steeringDegrees) <= this.rig.vehicle.maxSteerDegrees &&
            v.wheelAngles &&
            Object.keys(v.wheelAngles).length ===
              this.rig.vehicle.wheels.length &&
            this.rig.vehicle.wheels.every((w) =>
              finite(v.wheelAngles[w.groupId]),
            ),
          "INVALID_INPUT",
          "Invalid planar vehicle pose.",
        );
        fields(v, [
          "position",
          "headingDegrees",
          "steeringDegrees",
          "wheelAngles",
        ]);
        this.pose.vehicle = structuredClone(v);
        this.steering = v.steeringDegrees / this.rig.vehicle.maxSteerDegrees;
      } else ensure(!pose.vehicle, "INVALID_INPUT", "This rig has no vehicle.");
      return this.snapshot();
    } catch (error) {
      this.pose = previous;
      this.steering = previousSteering;
      throw error;
    }
  }
  stepTicks(count: number) {
    ensure(
      Number.isInteger(count) && count >= 0 && count <= 3600,
      "LIMIT_EXCEEDED",
      "Mechanism stepTicks accepts 0–3600 ticks.",
    );
    for (let n = 0; n < count; n++) {
      const v = this.rig.vehicle,
        p = this.pose.vehicle;
      if (v && p) {
        const chassis = this.rig.groups.find((g) => g.id === v.chassisGroup)!;
        const distance = this.throttle * v.maxSpeed * DT,
          steer = (this.steering * v.maxSteerDegrees * Math.PI) / 180,
          turn = (distance / v.wheelbase) * Math.tan(steer),
          // Vehicle headings remain deltas from rest; travel follows the
          // actual chassis forward direction even when the model was rotated.
          restHeading = -Math.atan2(
            chassis.frame.basis[2],
            chassis.frame.basis[8],
          ),
          mid = restHeading + (p.headingDegrees * Math.PI) / 180 + turn / 2;
        p.position[0] += Math.sin(mid) * distance;
        p.position[2] -= Math.cos(mid) * distance;
        p.headingDegrees += (turn * 180) / Math.PI;
        for (const w of v.wheels)
          p.wheelAngles[w.groupId] += ((distance / w.radius) * 180) / Math.PI;
      }
      this.tick++;
    }
    return this.snapshot();
  }
  snapshot(): MechanismSnapshot {
    const frames: Record<string, Transform> = {};
    const parent = new Map(this.rig.joints.map((j) => [j.bodyB, j]));
    const vehicle = this.rig.vehicle,
      vpose = this.pose.vehicle;
    let vehicleDelta = identity();
    if (vehicle && vpose) {
      const chassis = this.rig.groups.find(
        (g) => g.id === vehicle.chassisGroup,
      )!;
      vehicleDelta = around(
        chassis.frame.position,
        rotationY(-vpose.headingDegrees),
      );
      vehicleDelta.position = add(vehicleDelta.position, vpose.position);
    }
    const frame = (id: string): Transform => {
      if (frames[id]) return frames[id];
      const group = this.rig.groups.find((g) => g.id === id)!;
      const joint = parent.get(id);
      let result = structuredClone(group.frame);
      if (joint) {
        const a = this.rig.groups.find((g) => g.id === joint.bodyA)!,
          fa = frame(a.id);
        result = compose(compose(fa, inverse(a.frame)), result);
        const value = this.pose.jointPositions[joint.id] ?? 0;
        if (joint.kind === "revolute")
          result = compose(
            around(
              position(fa, joint.anchorA),
              axisRotation(mv(fa.basis, joint.axisA!), value),
            ),
            result,
          );
        if (joint.kind === "prismatic")
          result.position = add(
            result.position,
            mv(fa.basis, joint.axisA!).map((v) => v * value) as Vec3,
          );
      } else if (
        vehicle &&
        vpose &&
        (id === vehicle.chassisGroup ||
          vehicle.wheels.some((w) => w.groupId === id))
      ) {
        result = compose(vehicleDelta, result);
        const wheel = vehicle.wheels.find((w) => w.groupId === id);
        if (wheel) {
          const steering = wheel.steering ? -vpose.steeringDegrees : 0;
          result = compose(
            around(result.position, rotationY(steering)),
            result,
          );
          result = compose(
            around(
              result.position,
              axisRotation(mv(result.basis, wheel.axis), vpose.wheelAngles[id]),
            ),
            result,
          );
        }
      }
      frames[id] = result;
      return result;
    };
    const transforms: Record<string, Transform> = {};
    for (const g of this.rig.groups) {
      const delta = compose(frame(g.id), inverse(g.frame));
      for (const id of g.occurrenceIds)
        transforms[id] = compose(delta, g.restTransforms[id]);
    }
    return {
      sourceRevision: this.revision,
      rigId: this.rig.id,
      tick: this.tick,
      simulationHz: 60,
      mode: "kinematic",
      units: "LDU",
      scaleMetresPerLdu: 0.02,
      pose: structuredClone(this.pose),
      groupFrames: structuredClone(frames),
      transforms,
      warnings: [
        ...(this.rig.joints.some((j) => j.kind === "cylindrical")
          ? [
              "Cylindrical bearings retain their rest position and spin in kinematic preview; free axial/spin motion requires Dynamic Play.",
            ]
          : []),
        ...(this.rig.grippers?.length
          ? [
              "Grippers retain their authored capture zones in preview; grabbing and releasing loose groups require Dynamic Play.",
            ]
          : []),
        ...(this.rig.forceLinks?.length
          ? [
              "Springs and ropes retain their authored preview; physical forces and rope tension require Dynamic Play.",
            ]
          : []),
        ...(this.rig.joints.some((j) => j.motor)
          ? [
              "Motor targets and effort are authored metadata; kinematic preview uses explicit positions, not dynamic motor physics.",
            ]
          : []),
        ...(vehicle
          ? [
              "Planar kinematic vehicle: no suspension, traction or collision response.",
            ]
          : []),
        ...(this.rig.joints.some((j) => j.kind === "spherical")
          ? [
              "Spherical joints remain at their rest orientation in this kinematic controller.",
            ]
          : []),
      ],
    };
  }
}
/** Rebase explicit applied pose as the new authored zero rest, retaining equivalent limits. */
export function rebaseRig(
  rig: MotionRig,
  snapshot: MechanismSnapshot,
): MotionRig {
  const next = structuredClone(rig);
  for (const g of next.groups) {
    g.frame = structuredClone(snapshot.groupFrames[g.id]);
    for (const id of g.occurrenceIds)
      g.restTransforms[id] = structuredClone(snapshot.transforms[id]);
  }
  for (const joint of next.joints) {
    const a = next.groups.find((g) => g.id === joint.bodyA)!,
      b = next.groups.find((g) => g.id === joint.bodyB)!;
    joint.anchorB = position(
      inverse(b.frame),
      position(a.frame, joint.anchorA),
    );
    if (joint.axisA)
      joint.axisB = mv(inverse(b.frame).basis, mv(a.frame.basis, joint.axisA));
    const value = snapshot.pose.jointPositions[joint.id] ?? 0;
    if (joint.limits)
      joint.limits = joint.limits.map((v) => v - value) as [number, number];
    if (joint.motor?.mode === "position") joint.motor.target -= value;
  }
  for (const closure of next.loopClosures ?? []) {
    const a = next.groups.find((g) => g.id === closure.bodyA)!,
      b = next.groups.find((g) => g.id === closure.bodyB)!;
    closure.anchorB = position(
      inverse(b.frame),
      position(a.frame, closure.anchorA),
    );
    closure.axisB = mv(
      inverse(b.frame).basis,
      mv(a.frame.basis, closure.axisA),
    );
  }
  return next;
}
