import RAPIER from "@dimforge/rapier3d-compat";
import type { Transform } from "../core/types";
import type { JointSpec, MechanismSnapshot } from "../mechanisms/types";
import type { MechanicalSolid } from "./mechanical-solids";
import { CHARACTER_PROFILE } from "./types";

const scale = CHARACTER_PROFILE.scaleMetresPerLdu;
const word = new Uint32Array(1);
const float = new Float32Array(word.buffer);
function outward(value: number, up: boolean) {
  float[0] = value;
  if ((up && float[0] <= value) || (!up && float[0] >= value)) {
    if (float[0] === 0) word[0] = up ? 1 : 0x80000001;
    else word[0] += float[0] > 0 === up ? 1 : -1;
  }
  return float[0];
}
const fixed = (a: Transform, b: Transform) =>
  a.position.every((v, k) => v === b.position[k]) &&
  a.basis.every((v, k) => v === b.basis[k]);
const yBasis = (f: Transform) =>
  f.basis[1] === 0 &&
  f.basis[3] === 0 &&
  f.basis[4] === 1 &&
  f.basis[5] === 0 &&
  f.basis[7] === 0;
const authoredYBasis = (f: Transform) =>
  yBasis(f) &&
  f.basis[0] === f.basis[8] &&
  f.basis[2] === -f.basis[6] &&
  ((Math.abs(f.basis[0]) === 1 && f.basis[2] === 0) ||
    (f.basis[0] === 0 && Math.abs(f.basis[2]) === 1));
const bindings = new WeakMap<
  MechanicalSolid,
  {
    shape: RAPIER.Shape;
    points: Float32Array;
    vertices: Float32Array;
    valid: boolean;
  }
>();
function nativePointBinding(solid: MechanicalSolid) {
  if (!(solid.shape instanceof RAPIER.ConvexPolyhedron)) return false;
  const vertices = solid.shape.vertices,
    old = bindings.get(solid);
  if (
    old?.shape === solid.shape &&
    old.points === solid.points &&
    old.vertices === vertices
  )
    return old.valid;
  const valid =
    solid.points.length === vertices.length &&
    (solid.points === vertices ||
      solid.points.every((v, k) => v === vertices[k]));
  // Mechanical source point arrays and shape vertices are immutable after
  // preparation; cache their binding rather than rescan during subdivision.
  bindings.set(solid, {
    shape: solid.shape,
    points: solid.points,
    vertices,
    valid,
  });
  return valid;
}

/** The path is one literal zero-anchor Y revolute, not an inference from equal
 * endpoint poses. Other paths and native compound child transforms fall back. */
export function invariantYRotationEligible(
  solid: MechanicalSolid,
  joints: JointSpec[],
  before: MechanismSnapshot,
  after: MechanismSnapshot,
  restFrames: Record<string, Transform>,
) {
  if (joints.length !== 1 || !(solid.shape instanceof RAPIER.ConvexPolyhedron))
    return false;
  const j = joints[0],
    a = before.groupFrames[j.bodyA],
    b = after.groupFrames[j.bodyA],
    c = before.groupFrames[solid.groupId],
    d = after.groupFrames[solid.groupId];
  const restA = restFrames[j.bodyA],
    restB = restFrames[j.bodyB];
  return (
    j.kind === "revolute" &&
    j.bodyB === solid.groupId &&
    j.anchorA.every((v) => v === 0) &&
    j.anchorB.every((v) => v === 0) &&
    j.axisA?.[0] === 0 &&
    Math.abs(j.axisA[1]) === 1 &&
    j.axisA[2] === 0 &&
    j.axisB?.[0] === 0 &&
    j.axisB[1] === j.axisA[1] &&
    j.axisB[2] === 0 &&
    !!restA &&
    !!restB &&
    authoredYBasis(restA) &&
    authoredYBasis(restB) &&
    !!a &&
    !!b &&
    !!c &&
    !!d &&
    fixed(a, b) &&
    a.basis.every((v, k) => v === restA.basis[k]) &&
    yBasis(c) &&
    yBasis(d) &&
    c.position.every((v, k) => v === d.position[k]) &&
    JSON.stringify(before.pose.vehicle) ===
      JSON.stringify(after.pose.vehicle) &&
    nativePointBinding(solid)
  );
}

/** Enclose every angle of the native direct convex, including F32 pivot and
 * quaternion rounding. No cylinder collider or sampled-angle bound is used. */
export function invariantYRotationBounds(
  points: Float32Array,
  frame: Transform,
) {
  let radius = 0,
    minimum = Infinity,
    maximum = -Infinity;
  for (let i = 0; i < points.length; i += 3) {
    radius = Math.max(radius, Math.hypot(points[i], points[i + 2]));
    minimum = Math.min(minimum, points[i + 1]);
    maximum = Math.max(maximum, points[i + 1]);
  }
  // For q=(0,s,0,c), radial scale²=1+4s²(s²+c²−1). Both
  // rounded sin/cos have absolute error <=2^-25, for the entire angular orbit.
  radius *= Math.sqrt(
    1 + 4 * (1 + 2 ** -25) ** 2 * (2 * Math.SQRT2 * 2 ** -25 + 2 * 2 ** -50),
  );
  const p = [
      frame.position[0] * scale,
      -frame.position[1] * scale,
      -frame.position[2] * scale,
    ],
    native = p.map(Math.fround),
    guard = 0.001 * scale;
  minimum = outward(Math.min(p[1], native[1]) + minimum, false);
  maximum = outward(Math.max(p[1], native[1]) + maximum, true);
  const query: [number, number, number, number, number, number] = [
    outward(Math.min(p[0], native[0]) - radius - guard, false),
    minimum - guard,
    outward(Math.min(p[2], native[2]) - radius - guard, false),
    outward(Math.max(p[0], native[0]) + radius + guard, true),
    maximum + guard,
    outward(Math.max(p[2], native[2]) + radius + guard, true),
  ];
  return { query, minimum, maximum, guard };
}
