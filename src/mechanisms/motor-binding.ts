import { occurrences } from "../core/document";
import {
  add,
  inverse,
  mv,
  nearlyPhysical,
  orthonormalized,
} from "../core/math";
import {
  AppError,
  ensure,
  type Occurrence,
  type Project,
  type Vec3,
} from "../core/types";
import {
  mechanicalContactGraph,
  worldMechanicalFeatures,
} from "./mechanical-contacts";
import type { JointSpec, MotionRig } from "./types";

export type MotorBinding = {
  occurrenceId: string;
  profile: "power-functions-motor-m-v1";
};
/** Actual official output geometry: 47157's blind keyed socket Z0..20;
 * its back cap is closed, and the casing stays on the joint's carrier. */
export const PHYSICAL_MOTOR_PROFILE = Object.freeze({
  id: "power-functions-motor-m-v1" as const,
  ref: "58120.dat",
  outputAxis: [0, 0, 1] as Vec3,
  keyDirection: [1, 0, 0] as Vec3,
  socketSpanLdu: [0, 20] as [number, number],
  minimumEngagementLdu: 7.5,
  matingRadiusLdu: 9.1,
});
export type ResolvedMotorBinding = {
  motorOccurrenceId: string;
  shaftOccurrenceId: string;
  originLdu: Vec3;
  axis: Vec3;
  keyDirection: Vec3;
  engagementLdu: number;
  mating: { radiusLdu: number; halfLengthLdu: number; pivotLdu: Vec3 };
};
const dot = (a: Vec3, b: Vec3) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const sub = (a: Vec3, b: Vec3) => a.map((v, i) => v - b[i]) as Vec3;
const onAxis = (p: Vec3, origin: Vec3, axis: Vec3) => {
  const d = sub(p, origin),
    offset = dot(d, axis);
  return Math.hypot(...d.map((v, i) => v - offset * axis[i])) <= 0.05;
};
/** Bounded reviewed motor admission. Callers may reuse occurrence expansion.
 * A filename, an anonymous torque setting, or membership in a virtual frame
 * cannot stand in for a physically mounted, inserted motor output. */
export function resolvePhysicalMotorBinding(
  project: Project,
  rig: MotionRig,
  joint: JointSpec,
  binding: MotorBinding,
  all: readonly Occurrence[] = occurrences(project),
): ResolvedMotorBinding {
  ensure(
    binding && binding.profile === PHYSICAL_MOTOR_PROFILE.id,
    "INVALID_INPUT",
    "Choose a reviewed real motor part for this control.",
  );
  ensure(
    joint.kind === "revolute" && joint.axisA && joint.axisB,
    "INVALID_INPUT",
    "This motor drives a reviewed turning shaft.",
  );
  const carrier = rig.groups.find((g) => g.id === joint.bodyA),
    moving = rig.groups.find((g) => g.id === joint.bodyB);
  ensure(
    carrier && moving,
    "INVALID_INPUT",
    "The motor needs its carrier and turning shaft.",
  );
  const members = new Set(rig.groups.flatMap((g) => g.occurrenceIds)),
    local = all.filter((o) => members.has(o.id)),
    lookup = new Map(local.map((o) => [o.id, o]));
  const motor = lookup.get(binding.occurrenceId);
  ensure(
    motor &&
      motor.namespace === "official" &&
      motor.node.ref === PHYSICAL_MOTOR_PROFILE.ref &&
      worldMechanicalFeatures(motor) &&
      nearlyPhysical(motor.transform),
    "INVALID_INPUT",
    "This motor part or source placement has not been reviewed.",
  );
  ensure(
    carrier.occurrenceIds.includes(motor.id),
    "INVALID_INPUT",
    "Keep the motor casing on the shaft's carrier, not on its rotating group.",
  );
  const frame = orthonormalized(motor.transform),
    originLdu = frame.position,
    axis = mv(frame.basis, PHYSICAL_MOTOR_PROFILE.outputAxis),
    keyDirection = mv(frame.basis, PHYSICAL_MOTOR_PROFILE.keyDirection),
    jointAxis = mv(carrier.frame.basis, joint.axisA!),
    jointOrigin = add(
      carrier.frame.position,
      mv(carrier.frame.basis, joint.anchorA),
    );
  ensure(
    Math.abs(dot(axis, jointAxis)) >= 0.99999 &&
      onAxis(jointOrigin, originLdu, axis),
    "INVALID_INPUT",
    "Align the motor output with the turning shaft and its bearing axis.",
  );
  const inv = inverse(frame),
    shafts = moving.occurrenceIds
      .flatMap((id) => {
        const o = lookup.get(id);
        return o
          ? (worldMechanicalFeatures(o) ?? [])
              .filter((f) => f.kind === "axle")
              .map((f) => ({ o, f }))
          : [];
      })
      .filter(
        ({ f }) =>
          Math.abs(dot(f.axis, axis)) >= 0.99999 &&
          onAxis(f.center, originLdu, axis),
      );
  const inserted = shafts.filter(({ f }) => {
    if (f.kind !== "axle") return false;
    const localAxis = mv(inv.basis, f.axis),
      p = mv(inv.basis, sub(f.center, originLdu)),
      ends = f.span.map((t) => p[2] + localAxis[2] * t).sort((a, b) => a - b),
      phase = Math.acos(
        Math.min(1, Math.abs(dot(f.keyDirection, keyDirection))),
      );
    const keyed =
      Math.min(phase, Math.abs(Math.PI / 2 - phase)) <= Math.PI / 360;
    return (
      keyed &&
      ends[0] <= 0.05 &&
      ends[1] <= 20.05 &&
      ends[1] >= PHYSICAL_MOTOR_PROFILE.minimumEngagementLdu
    );
  });
  ensure(
    inserted.length === 1,
    "INVALID_INPUT",
    "Insert one aligned keyed axle into the motor socket without crossing its closed back.",
  );
  const shaft = inserted[0],
    graph = mechanicalContactGraph(project, local),
    welds = graph.contacts.filter(
      (c) =>
        c.kind === "stud-weld" &&
        carrier.occurrenceIds.includes(c.a.occurrenceId) &&
        carrier.occurrenceIds.includes(c.b.occurrenceId),
    );
  ensure(
    welds.filter(
      (c) => c.a.occurrenceId === motor.id || c.b.occurrenceId === motor.id,
    ).length >= 2,
    "INVALID_INPUT",
    "Mount the motor's underside on real studs before powering it.",
  );
  const connected = new Set([motor.id]);
  for (let pass = 0; pass < carrier.occurrenceIds.length; pass++) {
    let changed = false;
    for (const c of welds)
      if (connected.has(c.a.occurrenceId) || connected.has(c.b.occurrenceId))
        for (const id of [c.a.occurrenceId, c.b.occurrenceId])
          if (!connected.has(id)) {
            connected.add(id);
            changed = true;
          }
    if (!changed) break;
  }
  const bearings = graph.contacts.filter(
    (c) =>
      c.kind === "bearing" &&
      c.a.occurrenceId === shaft.o.id &&
      carrier.occurrenceIds.includes(c.b.occurrenceId),
  );
  ensure(
    bearings.length > 0 &&
      bearings.every((c) => connected.has(c.b.occurrenceId)),
    "INVALID_INPUT",
    "Connect the motor mount and shaft bearings with real bricks or plates.",
  );
  const p = mv(inv.basis, sub(shaft.f.center, originLdu)),
    localAxis = mv(inv.basis, shaft.f.axis),
    tip = Math.max(...shaft.f.span.map((t) => p[2] + localAxis[2] * t));
  return {
    motorOccurrenceId: motor.id,
    shaftOccurrenceId: shaft.o.id,
    originLdu,
    axis,
    keyDirection,
    engagementLdu: tip,
    mating: {
      radiusLdu: PHYSICAL_MOTOR_PROFILE.matingRadiusLdu,
      halfLengthLdu: 10,
      pivotLdu: add(originLdu, mv(frame.basis, [0, 0, 10])),
    },
  };
}
export function checkPhysicalMotorBinding(
  ...args: Parameters<typeof resolvePhysicalMotorBinding>
) {
  try {
    return {
      eligible: true as const,
      motor: resolvePhysicalMotorBinding(...args),
    };
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return { eligible: false as const, reason: error.message };
  }
}
