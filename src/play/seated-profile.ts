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
  avatarRootFromPelvis: Object.freeze([0, 26, 0] as const),
  eyeFromPelvis: Object.freeze([0, -38, 0] as const),
  envelopes: Object.freeze([
    Object.freeze({
      id: "torso-head" as const,
      center: Object.freeze([0, -22, -4] as const),
      halfExtents: Object.freeze([20, 26, 20] as const),
    }),
    Object.freeze({
      id: "straight-legs" as const,
      center: Object.freeze([0, -4, -13.5] as const),
      halfExtents: Object.freeze([14, 10, 14] as const),
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
  headYawLimits: Object.freeze([-0.7, 0.7] as const),
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
    Math.abs(up[0]) < 1e-8 &&
      Math.abs(up[1] + 1) < 1e-8 &&
      Math.abs(up[2]) < 1e-8,
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
