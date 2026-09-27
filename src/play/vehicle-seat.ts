import RAPIER from "@dimforge/rapier3d-compat";
import { add, mv } from "../core/math";
import { ensure, type Vec3, type Transform } from "../core/types";
import type { DriverSeatSpec, MechanismSnapshot } from "../mechanisms/types";
import { CHARACTER_PROFILE as P } from "./types";
import {
  seatedPlacement,
  SEATED_BODY_PROFILE,
  type SeatedPlacement,
} from "./seated-profile";
import type { DrivingBox, DrivingPose } from "./vehicle-collision";
import type { PlayVehicleWorld } from "./vehicle-world";
import type { PlayMechanismSource } from "./mechanism";
import { certifyDrivingProfile, drivingPose } from "./vehicle-profile";
const S = P.scaleMetresPerLdu;
export const seatPoint = (frame: Transform, point: Vec3) =>
  add(frame.position, mv(frame.basis, point));
export const seatYaw = (frame: Transform) =>
  Math.atan2(-frame.basis[2], frame.basis[8]);
export const seatPlacement = (frame: Transform, seat: DriverSeatSpec) =>
  seatedPlacement(frame, {
    position: seat.pelvisPosition,
    yawDegrees: seat.yawDegrees,
  });
export const seatBodyBoxes = (): DrivingBox[] =>
  SEATED_BODY_PROFILE.envelopes.map((box) => ({
    center: [box.center[0] * S, -box.center[1] * S, -box.center[2] * S],
    halfExtents: box.halfExtents.map((n) => n * S) as Vec3,
  }));
export const seatBodyPose = (placement: SeatedPlacement): DrivingPose => ({
  x: placement.pelvisFrame.position[0] * S,
  y: -placement.pelvisFrame.position[1] * S,
  z: -placement.pelvisFrame.position[2] * S,
  yaw: seatYaw(placement.pelvisFrame),
});
const at = (position: Vec3, yaw: number): DrivingPose => ({
  x: position[0] * S,
  y: -position[1] * S,
  z: -position[2] * S,
  yaw,
});
const q = (yaw: number) => ({
  x: 0,
  y: Math.sin(yaw / 2),
  z: 0,
  w: Math.cos(yaw / 2),
});
/** Rigid chassis remains invariant relative to seated actor after geometry fit;
 * wheels additionally need clearance throughout their full spin/steer envelope. */
export function verifyWheelAttachment(
  source: PlayMechanismSource,
  state: MechanismSnapshot,
  placement: SeatedPlacement,
) {
  const profile = certifyDrivingProfile(source),
    pose = drivingPose(profile, state),
    body = seatBodyPose(placement),
    rig = source.project.motionRigs[source.rigId];
  const rotated = (center: Vec3, root: DrivingPose) => ({
    x: root.x + Math.cos(root.yaw) * center[0] + Math.sin(root.yaw) * center[2],
    y: root.y + center[1],
    z: root.z - Math.sin(root.yaw) * center[0] + Math.cos(root.yaw) * center[2],
  });
  for (let i = 0; i < rig.groups.length; i++) {
    if (!rig.vehicle!.wheels.some((w) => w.groupId === rig.groups[i].id))
      continue;
    const wheel = profile.boxes[i],
      shape = new RAPIER.Cuboid(...wheel.halfExtents);
    for (const box of seatBodyBoxes()) {
      const contact = shape.contactShape(
        rotated(wheel.center, pose),
        q(pose.yaw),
        new RAPIER.Cuboid(...box.halfExtents),
        rotated(box.center, body),
        q(body.yaw),
        0,
      );
      ensure(
        !contact || contact.distance > 0,
        "INVALID_INPUT",
        "Seat body intersects a wheel's full steering/spin envelope",
      );
    }
  }
}
/** Validates a bounded raised transfer, not endpoint teleportation. Every stage
 * includes target-rig geometry. Runtime commits only after all queries succeed. */
export function validateSeatTransfer(
  world: PlayVehicleWorld,
  standingFeet: Vec3,
  placement: SeatedPlacement,
  exiting: boolean,
  sweepStanding: (a: Vec3, b: Vec3) => boolean,
) {
  const pelvis = placement.pelvisFrame.position,
    standingPelvis: Vec3 = [
      standingFeet[0],
      standingFeet[1] - 26,
      standingFeet[2],
    ],
    height = Math.min(pelvis[1], standingPelvis[1]) - 80;
  const highStanding: Vec3 = [standingFeet[0], height + 26, standingFeet[2]],
    highPelvis: Vec3 = [standingFeet[0], height, standingFeet[2]],
    highSeat: Vec3 = [pelvis[0], height, pelvis[2]];
  ensure(
    sweepStanding(
      exiting ? highStanding : standingFeet,
      exiting ? standingFeet : highStanding,
    ),
    "INVALID_INPUT",
    "Standing transfer path is blocked",
  );
  // Explicit pose-transition envelope; independent of decorative animation.
  // Covers standing capsule and all supported rigid hip/shoulder poses at height.
  const transition: DrivingBox[] = [
    { center: [0, 12 * S, 0], halfExtents: [42 * S, 38 * S, 42 * S] },
  ];
  const clearance = world.sweepBody(
    transition,
    at(highPelvis, 0),
    at(highPelvis, 0),
  );
  ensure(
    clearance.accepted,
    "INVALID_INPUT",
    clearance.reason ?? "Seat pose-change space is blocked",
  );
  const yaw = seatYaw(placement.pelvisFrame),
    body = seatBodyBoxes();
  const stages: Vec3[][] = exiting
    ? [
        [pelvis, highSeat],
        [highSeat, highPelvis],
      ]
    : [
        [highPelvis, highSeat],
        [highSeat, pelvis],
      ];
  for (const [a, b] of stages) {
    const result = world.sweepBody(body, at(a, yaw), at(b, yaw));
    ensure(
      result.accepted,
      "INVALID_INPUT",
      result.reason ?? "Seat transfer path is blocked",
    );
  }
}
