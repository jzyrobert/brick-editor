/**
 * The Play figure's assembly: which official LDraw minifig parts it is made
 * of, where each sits, and the rig's joints. Pure data and maths (no Three.js),
 * shared by the runtime (avatar.ts), the pack builder
 * (scripts/build-avatar-pack.ts) and tests.
 *
 * Offsets are the standard minifig assembly used by the official library
 * itself: arms and hands as placed by the shortcut 973c01 ("Minifig Torso with
 * Arms and Yellow Hands"), head 24 LDU above the torso origin, hips 32 below
 * it, and legs 12 below the hips (the !HELP lines of 3816c/3817c). These are
 * given in the torso's own LDraw frame ("T": origin at the neck base, −Y up,
 * the figure faces −Z, its right side is −X).
 *
 * The avatar frame ("A") is +Y up with the feet (the collider anchor) at the
 * origin; the figure faces −Z and its right side is +X. A = F·T + (0, 72, 0)
 * with F = diag(−1, −1, 1) — a proper rotation (180° about Z), so no part is
 * mirrored.
 */
export type V3 = readonly [number, number, number];
/** Row-major 3 × 3 rotation. */
export type M3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];
export type AvatarNode =
  | "body"
  | "head"
  | "leftShoulder"
  | "rightShoulder"
  | "leftWrist"
  | "rightWrist"
  | "leftHip"
  | "rightHip";

/** Torso-frame (T) feet level: legs end 12 + 28 LDU below the hips. */
export const FEET_T = 72;
/** 973c01 arm roll: the arm matrix is [0.985 ∓0.17 0; ±0.17 0.985 0; 0 0 1]. */
const ARM_ROLL = Math.atan2(0.17, 0.985);
/** 973c01 hand tilt: 45° about the arm's X axis. */
const HAND_TILT = Math.PI / 4;

const mm = (a: M3, b: M3): M3 =>
  [0, 1, 2].flatMap((r) =>
    [0, 1, 2].map(
      (c) =>
        a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c],
    ),
  ) as unknown as M3;
const mv = (m: M3, v: V3): V3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];
const transpose = (m: M3): M3 => [
  m[0],
  m[3],
  m[6],
  m[1],
  m[4],
  m[7],
  m[2],
  m[5],
  m[8],
];
export const rotZ = (a: number): M3 => [
  Math.cos(a),
  -Math.sin(a),
  0,
  Math.sin(a),
  Math.cos(a),
  0,
  0,
  0,
  1,
];
export const rotX = (a: number): M3 => [
  1,
  0,
  0,
  0,
  Math.cos(a),
  -Math.sin(a),
  0,
  Math.sin(a),
  Math.cos(a),
];
const I: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
/** LDraw (T) to avatar (A) axes. */
export const F: M3 = [-1, 0, 0, 0, -1, 0, 0, 0, 1];
const toA = (p: V3): V3 => {
  const q = mv(F, p);
  return [q[0], q[1] + FEET_T, q[2]];
};

/** Standard assembly in the torso frame T (side −1 = the figure's right). */
function reference(side: -1 | 1) {
  const arm = {
    position: [15.552 * side, 9, 0] as V3,
    basis: rotZ(-side * ARM_ROLL),
  };
  // Hand in the arm's frame: 973c01's hand placement expressed relative to the
  // arm (it reduces to a 45° tilt about the arm's X axis).
  const handT: V3 = [23.6904 * side, 26.774, -9.8982];
  const rel = mv(
    transpose(arm.basis),
    handT.map((v, i) => v - arm.position[i]) as unknown as V3,
  );
  return { arm, hand: { position: rel, basis: rotX(HAND_TILT) } };
}

export type JointDefinition = {
  /** Parent node ("body" is the root, fixed to the collider feet). */
  parent: AvatarNode;
  /** Pivot in the parent's frame (A axes, LDU). */
  pivot: V3;
  /** Rest rotation of the joint frame in the parent's frame. */
  rest: M3;
  /** Rest rotation as Euler angles (radians) with `order`, for Three.js. */
  restEuler: V3;
  order: "YXZ" | "ZXY" | "XYZ";
  /** Unit hinge axis in the joint's own (rest) frame. */
  axis: V3;
  limits: readonly [number, number];
  /** Neck only: the second (pitch) axis and its limits. */
  pitchAxis?: V3;
  pitchLimits?: readonly [number, number];
};

function shoulder(side: -1 | 1): JointDefinition {
  const { arm } = reference(side);
  // A-frame rotation F·R·F: for a Z rotation this is the same matrix.
  const rest = mm(mm(F, arm.basis), F);
  return {
    parent: "body",
    pivot: toA(arm.position),
    rest,
    restEuler: [0, 0, Math.atan2(rest[3], rest[0])],
    order: "ZXY",
    axis: [1, 0, 0],
    limits: [-1.4, 1.4],
  };
}
function wrist(side: -1 | 1): JointDefinition {
  const { hand } = reference(side);
  const rest = mm(mm(F, hand.basis), F);
  return {
    parent: side === -1 ? "rightShoulder" : "leftShoulder",
    pivot: mv(F, hand.position),
    rest,
    restEuler: [Math.atan2(rest[7], rest[8]), 0, 0],
    order: "XYZ",
    // The hand's grip cylinder runs along its own Z axis.
    axis: [0, 0, 1],
    limits: [-1.2, 1.2],
  };
}
const hip = (): JointDefinition => ({
  parent: "body",
  // Both legs turn on the hips' single cross axle, 12 LDU below the hips' top.
  pivot: toA([0, 44, 0]),
  rest: I,
  restEuler: [0, 0, 0],
  order: "YXZ",
  axis: [1, 0, 0],
  limits: [-1.4, 1.4],
});

/**
 * The rig. Positive hinge angles swing a limb forward (towards −Z); the neck
 * yaws about +Y and pitches about +X. Every joint turns about this declared
 * pivot, never a mesh centre.
 */
export const JOINTS: Readonly<
  Record<Exclude<AvatarNode, "body">, JointDefinition>
> = Object.freeze({
  head: {
    parent: "body",
    pivot: toA([0, 0, 0]),
    rest: I,
    restEuler: [0, 0, 0],
    order: "YXZ",
    axis: [0, 1, 0],
    limits: [-0.873, 0.873],
    pitchAxis: [1, 0, 0],
    pitchLimits: [-0.35, 0.45],
  },
  rightShoulder: shoulder(-1),
  leftShoulder: shoulder(1),
  rightWrist: wrist(-1),
  leftWrist: wrist(1),
  rightHip: hip(),
  leftHip: hip(),
});

/** LDraw colour codes (LDConfig): skin Yellow, torso Red, legs Blue, hair
 * Reddish Brown. Printed detail keeps the file's own colours (black face). */
export const AVATAR_COLOURS = Object.freeze({
  skin: 14,
  torso: 4,
  legs: 1,
  hair: 70,
});

export type AvatarPart = {
  node: AvatarNode;
  /** Official part file (library-relative, lower case). */
  part: string;
  /** LDraw colour code applied as the part's main colour (16). */
  colour: number;
  /** Part origin in the node's frame (A axes). */
  position: V3;
  /** Part LDraw axes to node axes (includes F). */
  basis: M3;
};
const inNode = (
  node: AvatarNode,
  part: string,
  colour: number,
  positionT: V3,
  pivotT: V3 = [0, 0, 0],
): AvatarPart => ({
  node,
  part,
  colour,
  position: mv(F, positionT.map((v, i) => v - pivotT[i]) as unknown as V3),
  basis: F,
});
/**
 * Parts per node. Arms and hands sit at their joint origin (the joint frame
 * carries the assembly rotation), so their part basis is just F.
 */
export const AVATAR_PARTS: readonly AvatarPart[] = Object.freeze([
  // Minifig Torso, Minifig Hips (current 3815b, not the obsolete 3815).
  inNode("body", "973.dat", AVATAR_COLOURS.torso, [0, 0, 0], [0, FEET_T, 0]),
  inNode("body", "3815b.dat", AVATAR_COLOURS.legs, [0, 32, 0], [0, FEET_T, 0]),
  // Minifig Head with Standard Grin Pattern (Hollow Stud) and Hair Male.
  inNode("head", "3626cp01.dat", AVATAR_COLOURS.skin, [0, -24, 0]),
  inNode("head", "3901.dat", AVATAR_COLOURS.hair, [0, -24, 0]),
  // Minifig Arm Right/Left and Minifig Hand (973c01 placement).
  inNode("rightShoulder", "3818.dat", AVATAR_COLOURS.torso, [0, 0, 0]),
  inNode("leftShoulder", "3819.dat", AVATAR_COLOURS.torso, [0, 0, 0]),
  inNode("rightWrist", "3820.dat", AVATAR_COLOURS.skin, [0, 0, 0]),
  inNode("leftWrist", "3820.dat", AVATAR_COLOURS.skin, [0, 0, 0]),
  // Minifig Leg Right/Left (current 3816c/3817c), origin on the hip axle.
  inNode("rightHip", "3816c.dat", AVATAR_COLOURS.legs, [0, 44, 0], [0, 44, 0]),
  inNode("leftHip", "3817c.dat", AVATAR_COLOURS.legs, [0, 44, 0], [0, 44, 0]),
]);
/** Joint names in parent-before-child order. */
export const JOINT_ORDER = Object.keys(JOINTS) as Exclude<AvatarNode, "body">[];
