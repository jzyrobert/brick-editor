import RAPIER from "@dimforge/rapier3d-compat";
import { add, compose, inverse, mv, orthonormalized } from "../core/math";
import { ensure, type Transform, type Vec3 } from "../core/types";
import { occurrences } from "../core/document";
import { axisRotation } from "../mechanisms/kinematic";
import {
  PF_LARGE_MOTOR_PROFILE,
  reviewedPfLargeMotorBinding,
  type ResolvedPfLargeMotorBinding,
} from "../mechanisms/pf-large-motor-binding";
import type { RigidGroup } from "../mechanisms/types";
import type { SourceComponentLocalGeometry } from "../render/source-component-geometry";
import type { PlayMechanismSource } from "./mechanism";
import { reviewedGeometryDigest } from "./reviewed-geometry-binding";
import { surfaceCompoundLocal } from "./surface-compound";
import { fromPhysics, toPhysics, METRES_PER_LDU } from "./physics-frame";
import type { CollisionSnapshot } from "./types";
import {
  splitMechanicalConvex,
  type MechanicalSolid,
} from "./mechanical-solids";
import { DRIVETRAIN_SOURCES } from "../mechanisms/drivetrain-sources";
import { bindPfLargeMotorAssemblies } from "../mechanisms/pf-large-motor-binding";
import { curatedGeometrySource } from "../catalog/geometry-sources";
import { fullSource } from "../catalog/full-library";
import { directReferences } from "../catalog/full-pack";
import {
  sourceAxisMotion,
  sourceAxisTravel,
  type SourceAxisMotion,
} from "./source-axis-motion";
import type { MechanismSnapshot } from "../mechanisms/types";
import {
  axialEnvelopeInside,
  sourceAxialEnvelope,
  type SourceAxialEnvelope,
} from "./source-axial-envelope";

/** Read only already loaded, hash-verified same-origin library definitions.
 * Closure authoring shadows are refused by the shared drivetrain binder. */
export async function prepareLoadedMotorAssemblies(
  project: import("../core/types").Project,
  rigs: readonly import("../mechanisms/types").MotionRig[],
  all = occurrences(project),
) {
  if (
    !rigs.some((r) =>
      r.joints.some(
        (j) => j.motor?.binding?.profile === PF_LARGE_MOTOR_PROFILE,
      ),
    )
  )
    return;
  const refs = all
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
    .map((o) => o.node.ref);
  const sources: Record<string, string> = Object.create(null),
    pending = [...refs];
  let characters = 0;
  while (pending.length) {
    const ref = pending.pop()!;
    if (Object.hasOwn(sources, ref)) continue;
    const text = curatedGeometrySource(ref) ?? fullSource(ref);
    ensure(
      text !== undefined,
      "REFERENCE_MISSING",
      "Load the original motor and mounting source parts before Play.",
    );
    characters += text.length;
    ensure(
      Object.keys(sources).length < 1024 && characters <= 8_000_000,
      "LIMIT_EXCEEDED",
      "Motor source review budget exceeded.",
    );
    sources[ref] = text;
    pending.push(...directReferences(text));
  }
  await bindPfLargeMotorAssemblies(project, rigs, sources, all);
}

export type MotorSourceComponentCapture = {
  case: SourceComponentLocalGeometry;
  output: SourceComponentLocalGeometry;
};
const sourceSurfaces = {
  case: new Set([
    "ba5da2bc9d406175db3b48c6cbfed34a709bf40f28f89f861343a2d44edfa07e",
    "e0a73ef9277bf7275f0a53cecd2342fdf82eecbeb35e9180cb503fed0f78b69e",
  ]),
  output: new Set([
    "0686a272ab26c2dc885144eef92bd5aa2578c35076fcd3e333aaf8d66812cd49",
  ]),
};
type BoundMotor = {
  proof: ResolvedPfLargeMotorBinding;
  capture: MotorSourceComponentCapture;
  frame: string;
};
const bindings = new WeakMap<
  PlayMechanismSource,
  { revision: number; motors: BoundMotor[] }
>();
type ComponentMetadata = {
  source: PlayMechanismSource;
  proof: ResolvedPfLargeMotorBinding;
  role: "case" | "output";
  aperture: boolean;
  thrust: boolean;
  bore: boolean;
  mountFace: boolean;
  envelope?: SourceAxialEnvelope;
  axisToGroup?: Transform;
};
const metadata = new WeakMap<MechanicalSolid, ComponentMetadata>();
const sweepMetadata = new WeakMap<
  MechanicalSolid,
  {
    source: PlayMechanismSource;
    proof: ResolvedPfLargeMotorBinding;
    joint: import("../mechanisms/types").JointSpec;
    envelope: SourceAxisMotion;
  }
>();

/** Called only after the complete constructed source solid set is validated.
 * A packed motor name, copied solid or appended member supplies no witness. */
export function prepareMotorSourceSweep(
  source: PlayMechanismSource,
  solids: readonly MechanicalSolid[],
) {
  const rig = source.project.motionRigs[source.rigId];
  if (
    rig.joints.length !== 1 ||
    rig.transmissions?.length ||
    rig.loopClosures?.length ||
    rig.forceLinks?.length ||
    rig.grippers?.length ||
    rig.vehicle ||
    rig.joints[0].kind !== "revolute" ||
    rig.joints[0].motor?.binding?.profile !== PF_LARGE_MOTOR_PROFILE
  )
    return;
  const joint = rig.joints[0],
    motors = boundMotors(source);
  if (motors.length !== 1) return;
  const proof = motors[0].proof,
    group = rig.groups.find((g) => g.id === proof.outputGroupId)!;
  for (const solid of solids) {
    if (solid.groupId !== proof.outputGroupId) continue;
    const component = metadata.get(solid);
    if (
      component
        ? component.source !== source ||
          component.proof !== proof ||
          component.role !== "output"
        : !solid.memberId || !group.occurrenceIds.includes(solid.memberId)
    )
      continue;
    const envelope = sourceAxisMotion(
      solid.points,
      joint.anchorB,
      joint.axisB!,
    );
    if (envelope) sweepMetadata.set(solid, { source, proof, joint, envelope });
  }
}

/** A single source-proven rooted revolute with a fixed carrier. Descendants,
 * coupled shafts and moving axes retain the ordinary complete-radius bound. */
export function motorSourceSweepTravel(
  source: PlayMechanismSource,
  solid: MechanicalSolid,
  before: MechanismSnapshot,
  after: MechanismSnapshot,
) {
  const entry = sweepMetadata.get(solid),
    rig = source.project.motionRigs[source.rigId];
  if (
    !entry ||
    entry.source !== source ||
    bindings.get(source)?.revision !== source.project.revision ||
    rig.joints.length !== 1 ||
    rig.joints[0] !== entry.joint ||
    rig.transmissions?.length ||
    rig.loopClosures?.length ||
    rig.forceLinks?.length ||
    rig.grippers?.length ||
    rig.vehicle ||
    !bindings.get(source)?.motors.some((m) => m.proof === entry.proof)
  )
    return;
  const carrierA = before.groupFrames[entry.proof.carrierGroupId],
    carrierB = after.groupFrames[entry.proof.carrierGroupId];
  if (
    !carrierA ||
    !carrierB ||
    !carrierA.position.every((v, k) => v === carrierB.position[k]) ||
    !carrierA.basis.every((v, k) => v === carrierB.basis[k])
  )
    return;
  const a = before.groupFrames[solid.groupId],
    b = after.groupFrames[solid.groupId],
    from = before.pose.jointPositions[entry.joint.id],
    to = after.pose.jointPositions[entry.joint.id];
  if (!a || !b || !Number.isFinite(from) || !Number.isFinite(to)) return;
  return sourceAxisTravel(entry.envelope, a, b, to - from);
}
export const isMotorComponentSolid = (solid: MechanicalSolid) =>
  metadata.has(solid);
const localPoint = (frame: Transform, p: Vec3) =>
  add(frame.position, mv(frame.basis, p));

/** Canonical component surfaces are verified independently from whole-parent
 * collision meshes. Complete source carrier admission must already be sealed. */
export async function loadMotorSourceComponents(
  sources: readonly PlayMechanismSource[],
) {
  for (const source of sources) {
    const rig = source.project.motionRigs[source.rigId],
      lookup =
        source.lookup ??
        new Map(occurrences(source.project).map((o) => [o.id, o]));
    const joints = rig.joints.filter(
      (j) => j.motor?.binding?.profile === PF_LARGE_MOTOR_PROFILE,
    );
    if (!joints.length) continue;
    const revision = source.project.revision,
      captures = source.motorComponents;
    ensure(
      captures && Object.keys(captures).length === joints.length,
      "INVALID_INPUT",
      "Capture both actual PF-L source components before Play.",
    );
    const motors: BoundMotor[] = [];
    for (const joint of joints) {
      const proof = reviewedPfLargeMotorBinding(source.project, rig, joint, [
          ...lookup.values(),
        ]),
        capture = captures[proof.motorOccurrenceId],
        motor = lookup.get(proof.motorOccurrenceId)!;
      ensure(
        capture,
        "INVALID_INPUT",
        "PF-L component capture does not match its source motor.",
      );
      for (const role of ["case", "output"] as const) {
        const g = capture[role];
        ensure(
          g &&
            g.role === role &&
            g.parentOccurrenceId === motor.id &&
            g.componentId ===
              JSON.stringify([motor.id, "source-component", role]) &&
            g.namespace === "official" &&
            g.revision === revision &&
            JSON.stringify(g.frame) === JSON.stringify(motor.transform) &&
            g.sourcePath.join("/") ===
              (role === "case"
                ? "99499.dat/10089c01.dat"
                : "99499.dat/10095.dat") &&
            g.sourceClosureSha256 ===
              DRIVETRAIN_SOURCES["99499.dat"].closureSha256 &&
            !g.unsupported &&
            sourceSurfaces[role].has(await reviewedGeometryDigest(g)),
          "INVALID_INPUT",
          "PF-L needs complete matching case and output source surfaces.",
        );
      }
      motors.push({ proof, capture, frame: JSON.stringify(motor.transform) });
    }
    ensure(
      source.project.revision === revision,
      "REVISION_CONFLICT",
      "The motor source changed during collision review.",
    );
    bindings.set(source, { revision, motors });
  }
}
function boundMotors(source: PlayMechanismSource) {
  const bound = bindings.get(source),
    rig = source.project.motionRigs[source.rigId];
  if (
    !rig.joints.some(
      (j) => j.motor?.binding?.profile === PF_LARGE_MOTOR_PROFILE,
    )
  )
    return [];
  ensure(
    bound && bound.revision === source.project.revision,
    "INVALID_INPUT",
    "Review PF-L component geometry before allocating Play bodies.",
  );
  for (const motor of bound.motors) {
    const joint = rig.joints.find((j) => j.id === motor.proof.jointId)!;
    ensure(
      source.motorComponents?.[motor.proof.motorOccurrenceId] ===
        motor.capture &&
        reviewedPfLargeMotorBinding(
          source.project,
          rig,
          joint,
          source.lookup ? [...source.lookup.values()] : undefined,
        ) === motor.proof &&
        JSON.stringify(motor.capture.case.frame) === motor.frame &&
        JSON.stringify(motor.capture.output.frame) === motor.frame,
      "INVALID_INPUT",
      "The bound motor components or source carrier changed.",
    );
  }
  return bound.motors;
}
/** Internal render routing; the parent remains the sole inventory occurrence. */
export function motorComponentPresentation(source: PlayMechanismSource) {
  return boundMotors(source).map(({ proof }) => ({
    rigId: source.rigId,
    parentOccurrenceId: proof.motorOccurrenceId,
    jointId: proof.jointId,
    axisSign: proof.axisSign,
    restPhaseDegrees: proof.rotorRestPhaseDegrees,
  }));
}
function componentFrame(motor: BoundMotor, role: "case" | "output") {
  const frame = orthonormalized(motor.capture[role].frame);
  return role === "case"
    ? frame
    : compose(frame, {
        position: [0, 0, 0],
        basis: axisRotation([0, 0, 1], motor.proof.rotorRestPhaseDegrees),
      });
}
function componentWorldMesh(
  motor: BoundMotor,
  role: "case" | "output",
): CollisionSnapshot {
  const geometry = motor.capture[role],
    frame = componentFrame(motor, role),
    vertices = new Float32Array(geometry.vertices.length),
    min: Vec3 = [Infinity, Infinity, Infinity],
    max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < geometry.vertices.length; i += 3)
    vertices.set(
      localPoint(frame, Array.from(geometry.vertices.slice(i, i + 3)) as Vec3),
      i,
    );
  for (let i = 0; i < vertices.length; i++) {
    min[i % 3] = Math.min(min[i % 3], vertices[i]);
    max[i % 3] = Math.max(max[i % 3], vertices[i]);
  }
  return {
    revision: geometry.revision,
    vertices,
    indices: geometry.indices,
    bounds: { min, max },
  };
}
export function motorOutputOwnedMembers(
  source: PlayMechanismSource,
  group: RigidGroup,
) {
  return boundMotors(source)
    .filter((m) => m.proof.outputGroupId === group.id)
    .map(
      (motor) =>
        [
          motor.capture.output.componentId,
          componentWorldMesh(motor, "output"),
        ] as const,
    );
}

/** Replace the packed motor only in transient group collision ownership.
 * Original parent member captures, document nodes and inventory remain intact. */
export function motorComponentGroupMeshes(source: PlayMechanismSource) {
  const motors = boundMotors(source),
    rig = source.project.motionRigs[source.rigId];
  if (!motors.length) return source.groups;
  ensure(
    source.members,
    "INVALID_INPUT",
    "Motor ownership requires every actual source member.",
  );
  const parents = new Set(motors.map((m) => m.proof.motorOccurrenceId));
  const groups: Record<string, CollisionSnapshot> = {};
  for (const group of rig.groups) {
    const meshes = group.occurrenceIds
      .filter((id) => !parents.has(id))
      .map((id) => source.members![id]);
    for (const motor of motors)
      for (const role of ["case", "output"] as const)
        if (
          group.id ===
          (role === "case"
            ? motor.proof.carrierGroupId
            : motor.proof.outputGroupId)
        ) {
          meshes.push(componentWorldMesh(motor, role));
        }
    const vertices = new Float32Array(
        meshes.reduce((n, m) => n + m.vertices.length, 0),
      ),
      indices = new Uint32Array(
        meshes.reduce((n, m) => n + m.indices.length, 0),
      );
    let vertexOffset = 0,
      indexOffset = 0;
    for (const mesh of meshes) {
      vertices.set(mesh.vertices, vertexOffset);
      for (let i = 0; i < mesh.indices.length; i++)
        indices[indexOffset + i] = mesh.indices[i] + vertexOffset / 3;
      vertexOffset += mesh.vertices.length;
      indexOffset += mesh.indices.length;
    }
    const min: Vec3 = [Infinity, Infinity, Infinity],
      max: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < vertices.length; i++) {
      min[i % 3] = Math.min(min[i % 3], vertices[i]);
      max[i % 3] = Math.max(max[i % 3], vertices[i]);
    }
    groups[group.id] = {
      revision: source.project.revision,
      vertices,
      indices,
      bounds: { min, max },
    };
  }
  return groups;
}

/** Actual hollow source surface prisms, never a whole motor convex envelope.
 * Only the output's source bearing fragment receives an aperture class. */
export function motorComponentSolids(
  source: PlayMechanismSource,
  group: RigidGroup,
  parentId?: string,
) {
  const motors = boundMotors(source).filter((m) =>
    parentId
      ? m.proof.motorOccurrenceId === parentId &&
        m.proof.carrierGroupId === group.id
      : m.proof.outputGroupId === group.id,
  );
  if (!motors.length) return;
  const solids: MechanicalSolid[] = [];
  for (const motor of motors) {
    const role = parentId ? "case" : "output",
      geometry = motor.capture[role],
      relative = compose(inverse(group.frame), componentFrame(motor, role)),
      groupToAxis = compose(
        inverse(componentFrame(motor, "case")),
        group.frame,
      );
    let pieces = surfaceCompoundLocal(geometry, `pf-large:${role}`);
    if (role === "output") {
      const work = { value: 0 };
      for (const z of [-0.05, 0.05, 22.05])
        pieces = pieces.flatMap((p) =>
          splitMechanicalConvex(p, [0, 0, 1], z, work),
        );
    }
    const classes = new Map<string, Vec3[][]>();
    for (const piece of pieces) {
      const aperture =
        role === "output" &&
        piece.every(
          (p) =>
            Math.hypot(p[0], p[1]) <= 9.101 && p[2] >= -0.051 && p[2] <= 22.051,
        );
      // Complete literal radius-nine casing bore prisms. Coplanar source
      // merging spans Z0..22; preserve each original child and keep this
      // internal mouth separate from the unrelated casing exterior.
      const bore =
        role === "case" &&
        piece.every(
          (p) =>
            Math.hypot(p[0], p[1]) <= 9.101 && p[2] >= -0.051 && p[2] <= 22.051,
        );
      // Literal 10092 front plate and 10095 back disc share Z22. Keep
      // these source thrust faces separate from hub, disc rim and pin skins.
      const thrust =
        !aperture &&
        piece.every((p) => Math.abs(p[2] - 22) <= 0.051) &&
        (role === "case" ||
          piece.every((p) => Math.hypot(p[0], p[1]) <= 20.101));
      const mountFace = aperture && piece.every((p) => Math.abs(p[2]) <= 0.051);
      const key = bore
        ? "bore"
        : mountFace
          ? "mount-face"
          : aperture
            ? "aperture"
            : thrust
              ? "thrust"
              : "exterior";
      const list = classes.get(key) ?? [];
      list.push(piece);
      classes.set(key, list);
    }
    for (const [key, children] of classes) {
      const shapes: RAPIER.Shape[] = [],
        points: number[] = [];
      for (const piece of children) {
        const native = Float32Array.from(
          piece.flatMap((p) => {
            const q = toPhysics(localPoint(relative, p));
            return [q.x, q.y, q.z];
          }),
        );
        const desc = RAPIER.ColliderDesc.convexHull(native);
        ensure(
          desc && native.every(Number.isFinite),
          "INVALID_INPUT",
          "An actual motor source surface could not be prepared safely.",
        );
        const raw = desc.shape.intoRaw();
        ensure(
          raw,
          "INVALID_INPUT",
          "The motor source surface needs valid native support.",
        );
        raw.free();
        shapes.push(desc.shape);
        points.push(...native);
      }
      const min: Vec3 = [Infinity, Infinity, Infinity],
        max: Vec3 = [-Infinity, -Infinity, -Infinity];
      let radius = 0;
      for (let i = 0; i < points.length; i += 3) {
        for (let k = 0; k < 3; k++) {
          min[k] = Math.min(min[k], points[i + k]);
          max[k] = Math.max(max[k], points[i + k]);
        }
        radius = Math.max(
          radius,
          Math.hypot(points[i], points[i + 1], points[i + 2]),
        );
      }
      const solid: MechanicalSolid = {
        groupId: group.id,
        memberId:
          role === "case"
            ? motor.proof.motorOccurrenceId
            : geometry.componentId,
        shape: new RAPIER.Compound(
          shapes,
          shapes.map(() => ({ x: 0, y: 0, z: 0 })),
          shapes.map(() => ({ x: 0, y: 0, z: 0, w: 1 })),
        ),
        points: Float32Array.from(points),
        bounds: { min, max },
        // Mechanical sweep radii are LDU; native points and bounds are metres.
        radius: radius / METRES_PER_LDU,
        childCount: shapes.length,
        mating: new Set(),
      };
      metadata.set(solid, {
        source,
        proof: motor.proof,
        role,
        aperture: key === "aperture" || key === "mount-face",
        thrust: key === "thrust",
        bore: key === "bore",
        mountFace: key === "mount-face",
        envelope:
          role === "output"
            ? sourceAxialEnvelope(solid.points, groupToAxis)
            : undefined,
        axisToGroup: role === "output" ? inverse(groupToAxis) : undefined,
      });
      solids.push(solid);
    }
  }
  return solids;
}

/** Restrict allowances to the actual source casing aperture and whole current
 * and predicted fragment envelopes. Rotor disc/pins, foreign bodies and closed
 * backs retain contact. A shared motor name never supplies a pair bypass. */
export function motorComponentContactAllowed(
  source: PlayMechanismSource,
  a: MechanicalSolid,
  b: object,
  frames: readonly Record<string, Transform>[],
) {
  const ma = metadata.get(a),
    mb = metadata.get(b as MechanicalSolid);
  const face = ma?.mountFace
    ? { solid: a, meta: ma, support: b as MechanicalSolid }
    : mb?.mountFace
      ? { solid: b as MechanicalSolid, meta: mb, support: a }
      : undefined;
  if (
    face &&
    face.meta.source === source &&
    face.support.groupId === face.meta.proof.carrierGroupId &&
    face.support.memberId &&
    face.meta.proof.mountSupportOccurrenceIds.includes(face.support.memberId)
  ) {
    const motor = bindings
      .get(source)
      ?.motors.find((m) => m.proof === face.meta.proof);
    if (
      !motor ||
      bindings.get(source)?.revision !== source.project.revision ||
      !frames.length
    )
      return false;
    const group = source.project.motionRigs[source.rigId].groups.find(
      (g) => g.id === motor.proof.carrierGroupId,
    )!;
    const relative = compose(
      inverse(group.frame),
      componentFrame(motor, "case"),
    );
    return frames.every((frame) => {
      const output = frame[motor.proof.outputGroupId],
        carrier = frame[motor.proof.carrierGroupId];
      if (!output || !carrier) return false;
      const inv = inverse(compose(carrier, relative));
      if (
        face.meta.envelope &&
        face.meta.axisToGroup &&
        axialEnvelopeInside(
          face.meta.envelope,
          compose(compose(inv, output), face.meta.axisToGroup),
          9.102,
          -0.052,
          0.052,
        )
      )
        return true;
      for (let i = 0; i < face.solid.points.length; i += 3) {
        const p = localPoint(
          inv,
          localPoint(
            output,
            fromPhysics({
              x: face.solid.points[i],
              y: face.solid.points[i + 1],
              z: face.solid.points[i + 2],
            }),
          ),
        );
        if (Math.hypot(p[0], p[1]) > 9.102 || Math.abs(p[2]) > 0.052)
          return false;
      }
      return true;
    });
  }
  const casing =
    ma?.role === "case"
      ? { solid: a, meta: ma }
      : mb?.role === "case"
        ? { solid: b as MechanicalSolid, meta: mb }
        : undefined;
  if (!casing || casing.meta.source !== source) return;
  const other = casing.solid === a ? (b as MechanicalSolid) : a,
    otherMeta = metadata.get(other),
    proof = casing.meta.proof;
  if (
    other.groupId !== proof.outputGroupId ||
    (otherMeta
      ? otherMeta.proof !== proof ||
        !(
          otherMeta.aperture ||
          (otherMeta.thrust && (casing.meta.thrust || casing.meta.bore))
        )
      : other.memberId !== proof.shaftOccurrenceId)
  )
    return false;
  if (!(other.points instanceof Float32Array) || !frames.length) return false;
  const group = source.project.motionRigs[source.rigId].groups.find(
      (g) => g.id === proof.carrierGroupId,
    )!,
    motor = bindings.get(source)?.motors.find((m) => m.proof === proof);
  if (!motor || bindings.get(source)?.revision !== source.project.revision)
    return false;
  const relative = compose(inverse(group.frame), componentFrame(motor, "case"));
  return frames.every((frame) => {
    if (!frame[proof.carrierGroupId] || !frame[proof.outputGroupId])
      return false;
    const inv = inverse(compose(frame[proof.carrierGroupId], relative));
    if (
      otherMeta?.envelope &&
      otherMeta.axisToGroup &&
      axialEnvelopeInside(
        otherMeta.envelope,
        compose(
          compose(inv, frame[proof.outputGroupId]),
          otherMeta.axisToGroup,
        ),
        otherMeta.thrust ? 20.102 : 9.102,
        otherMeta.thrust ? 21.948 : -0.052,
        22.052,
      )
    )
      return true;
    for (let i = 0; i < other.points.length; i += 3) {
      const p = localPoint(
        inv,
        localPoint(
          frame[proof.outputGroupId],
          fromPhysics({
            x: other.points[i],
            y: other.points[i + 1],
            z: other.points[i + 2],
          }),
        ),
      );
      if (
        otherMeta?.thrust
          ? Math.hypot(p[0], p[1]) > 20.102 || Math.abs(p[2] - 22) > 0.052
          : Math.hypot(p[0], p[1]) > 9.102 ||
            p[2] < -0.052 ||
            p[2] > (otherMeta ? 22.052 : 20.052)
      )
        return false;
    }
    return true;
  });
}
