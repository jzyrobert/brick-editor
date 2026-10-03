import { add, compose, mv, physical, rotationY } from "../core/math";
import { ensure, type Transform, type Vec3 } from "../core/types";

/** Declared gameplay collision profile, independent of decorative avatar mesh.
 * Pelvis-local LDU: -Y up, -Z forward. Changing artwork cannot alter clearance.
 * Open-bench, rigid straight-leg seating only; not a low-cabin/bent-knee profile. */
export const SEATED_BODY_PROFILE = Object.freeze({
  id: "brick-figure-open-seat-v1" as const,
  units: "LDU" as const,
  up: "-Y" as const,
  forward: "-Z" as const,
  // The pelvis is the minifig hip axle, 28 LDU above the feet; the eyes
  // are the head print's, 86 LDU above the feet (avatar-assembly.ts).
  avatarRootFromPelvis: Object.freeze([0, 28, 0] as const),
  eyeFromPelvis: Object.freeze([0, -58, 0] as const),
  // Measured from the seated figure (legs forward, arms at 0.7 rad, head
  // level over its whole yaw range) with about 0.5 LDU to spare: torso, arms,
  // hands and head above the hips; hips and legs below. The hips' underside
  // (and the legs' rounded backs) sit 9.3 LDU under the pelvis.
  envelopes: Object.freeze([
    Object.freeze({
      id: "torso-head" as const,
      center: Object.freeze([0, -43.75, -9.75] as const),
      halfExtents: Object.freeze([29, 31.75, 26.25] as const),
    }),
    Object.freeze({
      id: "straight-legs" as const,
      center: Object.freeze([0, -1.35, -8.5] as const),
      halfExtents: Object.freeze([20, 10.65, 20] as const),
    }),
  ]),
});
/** Separate visual pose, deliberately outside ordinary walking hip limits.
 * It does not modify JOINTS or the standing/gait profile. No knee joints exist. */
export const SEATED_VISUAL_POSE = Object.freeze({
  leftHip: Math.PI / 2,
  rightHip: Math.PI / 2,
  leftShoulder: 0.7,
  rightShoulder: 0.7,
  leftWrist: 0,
  rightWrist: 0,
  /** Resting head pitch (level). */
  headPitch: 0,
  /** The seated head turns with the look within these limits. */
  headYawLimits: Object.freeze([-0.7, 0.7] as const),
  /** It may nod forward (negative) with the look but never tips back: tipping
   * back swings the hair towards a backrest right behind the torso. Every
   * pitch in this range stays inside the declared torso-head envelope. */
  headPitchLimits: Object.freeze([-0.35, 0] as const),
});
export type SeatedPelvisAnchor = { position: Vec3; yawDegrees: number };
export type SeatedPlacement = {
  profile: typeof SEATED_BODY_PROFILE.id;
  units: "LDU";
  pelvisFrame: Transform;
  avatarRoot: Vec3;
  eye: Vec3;
  /** World LDraw basis shared by every independently declared body box. */
  envelopes: Array<{ id: string; frame: Transform; halfExtents: Vec3 }>;
};
const finitePosition = (position: readonly number[]) =>
  position.length === 3 &&
  position.every((n) => Number.isFinite(n) && Math.abs(n) <= 500000);
/** Local yaw follows Play heading: positive turns local forward(-Z) toward+X.
 * Caller supplies the current accepted chassis frame, never stale rest placement. */
export function seatedPlacement(
  chassisFrame: Transform,
  pelvis: SeatedPelvisAnchor,
  allowTilt = false,
): SeatedPlacement {
  ensure(
    finitePosition(chassisFrame.position) &&
      chassisFrame.basis.length === 9 &&
      chassisFrame.basis.every(Number.isFinite) &&
      physical(chassisFrame),
    "INVALID_INPUT",
    "Seat requires a finite proper chassis frame",
  );
  const up = mv(chassisFrame.basis, [0, -1, 0]);
  ensure(
    allowTilt ||
      (Math.abs(up[0]) < 1e-8 &&
        Math.abs(up[1] + 1) < 1e-8 &&
        Math.abs(up[2]) < 1e-8),
    "INVALID_INPUT",
    "Open-bench seats require a world-upright chassis",
  );
  ensure(
    finitePosition(pelvis.position) &&
      Number.isFinite(pelvis.yawDegrees) &&
      Math.abs(pelvis.yawDegrees) <= 360,
    "INVALID_INPUT",
    "Seat pelvis needs bounded local LDU coordinates and yaw within ±360 degrees",
  );
  const pelvisFrame = compose(chassisFrame, {
    position: [...pelvis.position],
    basis: rotationY(-pelvis.yawDegrees),
  });
  const point = (local: readonly number[]) =>
    add(pelvisFrame.position, mv(pelvisFrame.basis, [...local] as Vec3));
  const avatarRoot = point(SEATED_BODY_PROFILE.avatarRootFromPelvis),
    eye = point(SEATED_BODY_PROFILE.eyeFromPelvis);
  const envelopes = SEATED_BODY_PROFILE.envelopes.map((box) => ({
    id: box.id,
    frame: {
      position: point(box.center),
      basis: [...pelvisFrame.basis] as Transform["basis"],
    },
    halfExtents: [...box.halfExtents] as Vec3,
  }));
  ensure(
    [
      pelvisFrame.position,
      avatarRoot,
      eye,
      ...envelopes.map((b) => b.frame.position),
    ].every(finitePosition),
    "INVALID_INPUT",
    "Seat placement exceeds the supported LDU domain",
  );
  return {
    profile: SEATED_BODY_PROFILE.id,
    units: "LDU",
    pelvisFrame,
    avatarRoot,
    eye,
    envelopes,
  };
}
