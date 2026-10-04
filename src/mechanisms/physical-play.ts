import { occurrences } from "../core/document";
import { add, mv } from "../core/math";
import {
  ensure,
  type Occurrence,
  type Project,
  type Vec3,
} from "../core/types";
import { deriveDoorRigs } from "../play/auto-doors";
import { proposeMechanicalRig } from "./mechanical-proposals";
import { checkPhysicalMotorBinding } from "./motor-binding";
import type { JointSpec, MotionRig, RigidGroup } from "./types";

const members = (g: RigidGroup) => JSON.stringify([...g.occurrenceIds].sort());
const distance = (a: Vec3, b: Vec3) => Math.hypot(...a.map((v, i) => v - b[i]));
const dot = (a: Vec3, b: Vec3) => a.reduce((v, x, i) => v + x * b[i], 0);
const unit = (v: Vec3): Vec3 => v.map((x) => x / Math.hypot(...v)) as Vec3;
const anchor = (g: RigidGroup, j: JointSpec) =>
  add(g.frame.position, mv(g.frame.basis, j.anchorA));

/** Mathematical rigs are losslessly stored, but only reviewed source connections
 * are controllable in ordinary Play. Engineering fixtures use the engine directly. */
export function physicalPlayEligibility(
  project: Project,
  rig: MotionRig,
  all: Occurrence[] = occurrences(project),
): { eligible: boolean; reason?: string } {
  const refuse = (reason: string) => ({ eligible: false, reason });
  if (rig.grippers?.length)
    return refuse(
      "This grab control needs real jaws and a supported physical grasp. Proximity attachments are not available in Play.",
    );
  if (rig.forceLinks?.length || rig.loopClosures?.length)
    return refuse(
      "This linkage needs reviewed physical joints and attachment points before it can move in Play.",
    );
  // A single source solid may always fall and collide without a mechanical joint.
  if (
    !rig.joints.length &&
    rig.groups.every((g) => g.occurrenceIds.length === 1)
  )
    return { eligible: true };
  // Vehicles have a separate wheelbase heuristic and need no motor part.
  if (rig.vehicle) return { eligible: true };
  for (const joint of rig.joints) {
    if (!joint.motor) continue;
    if (!joint.motor.binding)
      return refuse(
        "Attach a supported motor part to this mechanism before using powered controls.",
      );
    const check = checkPhysicalMotorBinding(
      project,
      rig,
      joint,
      joint.motor.binding,
      all,
    );
    if (!check.eligible)
      return refuse(
        check.reason ?? "The motor is not mounted and coupled to this shaft.",
      );
  }
  const owned = new Set(rig.groups.flatMap((g) => g.occurrenceIds));
  const selected = all.filter((o) => owned.has(o.id));
  if (selected.length !== owned.size || selected.length > 2048)
    return refuse(
      "Choose a complete assembly of at most 2,048 parts for connection review.",
    );
  const sameRig = (reviewed: MotionRig) => {
    const byMembers = new Map(reviewed.groups.map((g) => [members(g), g]));
    const mapped = new Map(
      rig.groups.map((g) => [g.id, byMembers.get(members(g))]),
    );
    if (
      rig.groups.length !== reviewed.groups.length ||
      [...mapped.values()].some((g) => !g)
    )
      return false;
    const originals = new Map(rig.groups.map((g) => [g.id, g]));
    const matched = new Map<string, string>();
    for (const joint of rig.joints) {
      const a = mapped.get(joint.bodyA)!,
        b = mapped.get(joint.bodyB)!;
      const candidate = reviewed.joints.find(
        (j) => j.bodyA === a.id && j.bodyB === b.id && j.kind === joint.kind,
      );
      if (!candidate || !joint.axisA || !candidate.axisA) return false;
      const axis = unit(
        mv(originals.get(joint.bodyA)!.frame.basis, joint.axisA),
      );
      const otherAxis = unit(mv(a.frame.basis, candidate.axisA));
      if (dot(axis, otherAxis) < 0.999) return false;
      const p = anchor(originals.get(joint.bodyA)!, joint),
        q = anchor(a, candidate);
      const delta = p.map((x, i) => x - q[i]) as Vec3;
      const along = joint.kind === "revolute" ? dot(delta, axis) : 0;
      if (distance(delta, axis.map((x) => x * along) as Vec3) > 0.5)
        return false;
      if (
        joint.mating &&
        (!candidate.mating ||
          joint.mating.radiusLdu > candidate.mating.radiusLdu + 0.01 ||
          joint.mating.halfLengthLdu > candidate.mating.halfLengthLdu + 0.01)
      )
        return false;
      if (
        candidate.limits &&
        (!joint.limits ||
          joint.limits[0] < candidate.limits[0] - 0.01 ||
          joint.limits[1] > candidate.limits[1] + 0.01)
      )
        return false;
      matched.set(joint.id, candidate.id);
    }
    if (matched.size !== reviewed.joints.length) return false;
    const relation = (
      t: NonNullable<MotionRig["transmissions"]>[number],
      map?: Map<string, string>,
    ) =>
      JSON.stringify([
        t.kind,
        map ? map.get(t.jointA) : t.jointA,
        map ? map.get(t.jointB) : t.jointB,
        t.kind === "spur" ? [t.teethA, t.teethB, t.axisSign] : t.pitchRadiusLdu,
      ]);
    const relations = (rig.transmissions ?? []).map((t) =>
      relation(t, matched),
    );
    return (
      relations.length === (reviewed.transmissions?.length ?? 0) &&
      relations.every((t) =>
        reviewed.transmissions?.some((r) => relation(r) === t),
      )
    );
  };
  // Doors use the verified leaf/holder sockets rather than generic axle profiles.
  const doors = deriveDoorRigs(project, {
    all: selected,
    reserved: new Set(),
    maxRigs: 32,
    maxGroups: 128,
  });
  if (Object.values(doors.rigs).some(sameRig)) return { eligible: true };
  const children = new Set(rig.joints.map((j) => j.bodyB));
  const frame = rig.groups
    .filter((g) => !children.has(g.id))
    .flatMap((g) => g.occurrenceIds);
  try {
    const review = proposeMechanicalRig(
      { ...project, motionRigs: {} },
      {
        id: "physical-play-review",
        name: rig.name,
        expectedRevision: project.revision,
        frameOccurrenceIds: frame,
        occurrenceIds: [...owned],
        includeHidden: true,
      },
      new Map(all.map((o) => [o.id, o])),
    );
    const connected = new Set(frame.slice(0, 1));
    const welds = review.graph.contacts.filter(
      (c) =>
        c.kind === "stud-weld" &&
        frame.includes(c.a.occurrenceId) &&
        frame.includes(c.b.occurrenceId),
    );
    for (let pass = 0; pass < frame.length; pass++) {
      let added = false;
      for (const c of welds)
        if (connected.has(c.a.occurrenceId) || connected.has(c.b.occurrenceId))
          for (const id of [c.a.occurrenceId, c.b.occurrenceId])
            if (!connected.has(id)) {
              connected.add(id);
              added = true;
            }
      if (!added) break;
    }
    if (
      review.rig &&
      !review.unresolved.length &&
      frame.every((id) => connected.has(id)) &&
      sameRig(review.rig)
    )
      return { eligible: true };
  } catch {
    /* A refused source proposal remains static; no invented joint. */
  }
  return refuse(
    "These moving parts need supported, physically attached hinges, axles or guides. Review their connections in Set up a mechanism.",
  );
}

export function requirePhysicalPlay(
  project: Project,
  rig: MotionRig,
  all?: Occurrence[],
) {
  const result = physicalPlayEligibility(project, rig, all);
  ensure(
    result.eligible,
    "INVALID_INPUT",
    result.reason ?? "This mechanism needs connection review.",
  );
}
