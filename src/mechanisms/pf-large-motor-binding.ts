import { occurrences } from "../core/document";
import { add, mv, orthonormalized } from "../core/math";
import {
  ensure,
  type Occurrence,
  type Project,
  type Vec3,
} from "../core/types";
import { sourceAssemblyEdges } from "../play/source-assembly";
import {
  bindDrivetrainSources,
  drivetrainInterfaces,
  isReviewedPfLargeMotorContacts,
  pfLargeMotorContacts,
  type DrivetrainRef,
  type PfLargeMotorContacts,
} from "./drivetrain-interfaces";
import { mechanicalContactGraph } from "./mechanical-contacts";
import type { JointSpec, MotionRig } from "./types";
import type { ResolvedMotorBinding } from "./motor-binding";

export const PF_LARGE_MOTOR_PROFILE = "power-functions-motor-l-v1" as const;
export type ResolvedPfLargeMotorBinding = ResolvedMotorBinding & {
  profile: typeof PF_LARGE_MOTOR_PROFILE;
  carrierGroupId: string;
  outputGroupId: string;
  jointId: string;
  axisSign: 1 | -1;
  rotorRestPhaseDegrees: number;
  mountSupportOccurrenceIds: readonly string[];
  sourceContact: PfLargeMotorContacts;
};
type BoundRig = {
  signature: string;
  source: string;
  motors: Map<string, ResolvedPfLargeMotorBinding>;
};
const bindings = new WeakMap<
  Project["models"],
  { revision: number; roster: string; rigs: Map<string, BoundRig> }
>();
const modelRoster = (project: Project) =>
  JSON.stringify(Object.values(project.models).map((m) => [m.id, m.name]));
const dot = (a: Vec3, b: Vec3) => a.reduce((n, x, k) => n + x * b[k], 0);
const signature = (rig: MotionRig) => JSON.stringify(rig);
const sourceSignature = (rig: MotionRig, all: readonly Occurrence[]) => {
  const members = new Set(rig.groups.flatMap((g) => g.occurrenceIds));
  return JSON.stringify(
    all
      .filter((o) => members.has(o.id))
      .map((o) => [o.id, o.namespace, o.node.ref, o.transform]),
  );
};

/** Source closure verification precedes ordinary Play admission and native
 * allocation. Pin seats grant motor mounting only after their opposite support
 * seats and the output bearings reach the same real fixed carrier island. */
export async function bindPfLargeMotorAssemblies(
  project: Project,
  rigs: readonly MotionRig[],
  sources: Readonly<Record<string, string>>,
  all: readonly Occurrence[] = occurrences(project),
) {
  const requests = rigs.filter((rig) =>
    rig.joints.some(
      (j) => j.motor?.binding?.profile === PF_LARGE_MOTOR_PROFILE,
    ),
  );
  if (!requests.length) return;
  const revision = project.revision,
    models = project.models,
    authored = requests.map(signature).join("\n");
  ensure(
    requests.length <= 32,
    "LIMIT_EXCEEDED",
    "Too many motor assemblies for source review.",
  );
  const refs = [
    ...new Set(
      all
        .filter((o) =>
          [
            "99499.dat",
            "48989.dat",
            "2780.dat",
            "3673.dat",
            "3705.dat",
            "3707.dat",
          ].includes(o.node.ref),
        )
        .map((o) => o.node.ref as DrivetrainRef),
    ),
  ];
  const binding = await bindDrivetrainSources(sources, refs, { project });
  const result = new Map<string, BoundRig>();
  for (const rig of requests) {
    const owned = new Set(rig.groups.flatMap((g) => g.occurrenceIds)),
      selected = all.filter((o) => owned.has(o.id)),
      lookup = new Map(selected.map((o) => [o.id, o]));
    const graph = mechanicalContactGraph(project, selected),
      edges = sourceAssemblyEdges(project, selected);
    const motors = new Map<string, ResolvedPfLargeMotorBinding>();
    for (const joint of rig.joints.filter(
      (j) => j.motor?.binding?.profile === PF_LARGE_MOTOR_PROFILE,
    )) {
      ensure(
        joint.kind === "revolute" && joint.axisA && joint.axisB,
        "INVALID_INPUT",
        "PF-L drives a reviewed turning shaft.",
      );
      const carrier = rig.groups.find((g) => g.id === joint.bodyA),
        moving = rig.groups.find((g) => g.id === joint.bodyB),
        motor = lookup.get(joint.motor!.binding!.occurrenceId);
      ensure(
        carrier && moving && motor && carrier.occurrenceIds.includes(motor.id),
        "INVALID_INPUT",
        "Keep the PF-L case on its actual shaft carrier.",
      );
      const motorInterface = drivetrainInterfaces(motor, binding);
      ensure(
        motorInterface?.ref === "99499.dat",
        "INVALID_INPUT",
        "Bind the actual source PF-L motor before Play.",
      );
      const supports = carrier.occurrenceIds.flatMap((id) => {
        const o = lookup.get(id),
          i = o && drivetrainInterfaces(o, binding);
        return i?.pins.length ? [i] : [];
      });
      const candidates = moving.occurrenceIds.flatMap((id) => {
        const o = lookup.get(id),
          i = o && drivetrainInterfaces(o, binding);
        if (!i?.shaft) return [];
        try {
          return [pfLargeMotorContacts(motorInterface, supports, i)];
        } catch {
          return [];
        }
      });
      ensure(
        candidates.length === 1,
        "INVALID_INPUT",
        "Insert one source-seated PF-L axle with at least two distinct mounted pin seats.",
      );
      const contact = candidates[0],
        mountOwners = new Set(contact.mounts.map((m) => m.ownerId));
      const anchors = contact.mounts.map((seat) => {
        const owner = lookup.get(seat.ownerId)!;
        if (owner.node.ref === "48989.dat") return owner.id;
        // A standalone pin must also seat its opposite half in a real carrier
        // bore. Its friction alone is never promoted to a rigid weld.
        const seats = graph.contacts
          .filter(
            (c) =>
              c.kind === "pin-bearing" &&
              c.retained &&
              c.a.occurrenceId === owner.id &&
              carrier.occurrenceIds.includes(c.b.occurrenceId) &&
              !mountOwners.has(c.b.occurrenceId),
          )
          .map((c) => c.b.occurrenceId);
        ensure(
          seats.length === 1,
          "INVALID_INPUT",
          "Seat each motor pin's other half in one unambiguous actual carrier support.",
        );
        return seats[0];
      });
      const reached = new Set(anchors.slice(0, 1));
      for (let pass = 0; pass < carrier.occurrenceIds.length; pass++) {
        const before = reached.size;
        for (const edge of edges)
          if (
            edge.kind === "fixed" &&
            carrier.occurrenceIds.includes(edge.a) &&
            carrier.occurrenceIds.includes(edge.b) &&
            (reached.has(edge.a) || reached.has(edge.b))
          ) {
            reached.add(edge.a);
            reached.add(edge.b);
          }
        if (before === reached.size) break;
      }
      const bearingOwners = graph.contacts
        .filter(
          (c) =>
            c.kind === "bearing" &&
            c.a.occurrenceId === contact.shaftOccurrenceId &&
            carrier.occurrenceIds.includes(c.b.occurrenceId),
        )
        .map((c) => c.b.occurrenceId);
      ensure(
        bearingOwners.length > 0 &&
          [...anchors, ...bearingOwners].every((id) => reached.has(id)) &&
          carrier.occurrenceIds.every(
            (id) => id === motor.id || mountOwners.has(id) || reached.has(id),
          ),
        "INVALID_INPUT",
        "Connect every PF-L carrier member, pin support and output bearing with actual fixed source attachments.",
      );
      ensure(
        edges.some(
          (e) =>
            e.kind === "articulated" &&
            e.evidence.profile === "source-retained-axle-bearing" &&
            e.a === contact.shaftOccurrenceId &&
            bearingOwners.includes(e.b),
        ),
        "INVALID_INPUT",
        "Retain the PF-L shaft at an actual source bearing with seated axle stops.",
      );
      const movingReached = new Set([contact.shaftOccurrenceId]);
      for (let pass = 0; pass < moving.occurrenceIds.length; pass++) {
        const before = movingReached.size;
        for (const e of edges)
          if (
            e.kind === "fixed" &&
            moving.occurrenceIds.includes(e.a) &&
            moving.occurrenceIds.includes(e.b) &&
            (movingReached.has(e.a) || movingReached.has(e.b))
          ) {
            movingReached.add(e.a);
            movingReached.add(e.b);
          }
        if (before === movingReached.size) break;
      }
      ensure(
        moving.occurrenceIds.every((id) => movingReached.has(id)),
        "INVALID_INPUT",
        "Keep only actual fixed source shaft attachments in the PF-L output group.",
      );
      const frame = orthonormalized(motor.transform),
        axis = contact.socket.axis,
        jointAxis = mv(carrier.frame.basis, joint.axisA!),
        origin = add(
          carrier.frame.position,
          mv(carrier.frame.basis, joint.anchorA),
        ),
        delta = origin.map((x, k) => x - frame.position[k]) as Vec3;
      const alignment = dot(axis, jointAxis);
      ensure(
        Math.abs(alignment) >= 0.99999 &&
          Math.hypot(...delta.map((x, k) => x - dot(delta, axis) * axis[k])) <=
            0.05,
        "INVALID_INPUT",
        "Align the PF-L socket, source shaft bearing and turning joint.",
      );
      motors.set(
        joint.id,
        Object.freeze({
          profile: PF_LARGE_MOTOR_PROFILE,
          motorOccurrenceId: motor.id,
          shaftOccurrenceId: contact.shaftOccurrenceId,
          originLdu: frame.position,
          axis,
          keyDirection: contact.socket.keyDirection!,
          engagementLdu: contact.engagementLdu,
          mating: {
            radiusLdu: 9.1,
            halfLengthLdu: 10,
            pivotLdu: add(frame.position, mv(frame.basis, [0, 0, 10])),
          },
          carrierGroupId: carrier.id,
          outputGroupId: moving.id,
          jointId: joint.id,
          axisSign: alignment < 0 ? -1 : 1,
          rotorRestPhaseDegrees: contact.rotorRestPhaseDegrees,
          mountSupportOccurrenceIds: Object.freeze([...new Set(anchors)]),
          sourceContact: contact,
        }),
      );
    }
    result.set(rig.id, {
      signature: signature(rig),
      source: sourceSignature(rig, all),
      motors,
    });
  }
  ensure(
    project.models === models &&
      project.revision === revision &&
      requests.map(signature).join("\n") === authored,
    "REVISION_CONFLICT",
    "The PF-L source changed during assembly review.",
  );
  bindings.set(models, {
    revision,
    roster: modelRoster(project),
    rigs: result,
  });
}

export function reviewedPfLargeMotorBinding(
  project: Project,
  rig: MotionRig,
  joint: JointSpec,
  all: readonly Occurrence[] = occurrences(project),
) {
  const bound = bindings.get(project.models),
    entry = bound?.rigs.get(rig.id),
    motor = entry?.motors.get(joint.id);
  ensure(
    bound?.revision === project.revision &&
      bound.roster === modelRoster(project) &&
      entry?.signature === signature(rig) &&
      entry.source === sourceSignature(rig, all) &&
      motor &&
      isReviewedPfLargeMotorContacts(motor.sourceContact),
    "INVALID_INPUT",
    "Review the original PF-L source, mounted carrier and output geometry before powering it.",
  );
  return motor;
}

/** Narrow ordinary-entry witness for a fully reviewed PF-L-only shaft rig.
 * Additional transmission/linkage families retain their own admission route. */
export function reviewedPfLargeRigEligible(
  project: Project,
  rig: MotionRig,
  all: readonly Occurrence[] = occurrences(project),
) {
  if (
    !rig.joints.length ||
    rig.transmissions?.length ||
    rig.loopClosures?.length ||
    rig.forceLinks?.length ||
    rig.grippers?.length ||
    rig.vehicle ||
    !rig.joints.every(
      (j) => j.motor?.binding?.profile === PF_LARGE_MOTOR_PROFILE,
    )
  )
    return false;
  const groups = new Set<string>();
  for (const joint of rig.joints) {
    const proof = reviewedPfLargeMotorBinding(project, rig, joint, all);
    groups.add(proof.carrierGroupId);
    groups.add(proof.outputGroupId);
  }
  return rig.groups.every((g) => groups.has(g.id));
}
