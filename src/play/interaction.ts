import { add, mv } from "../core/math";
import type { Vec3 } from "../core/types";
import type { MotionRig } from "../mechanisms/types";
import type { PlaySnapshotReport } from "./types";

export type PlayInteraction = {
  rigId: string;
  label: string;
  name: string;
  available: boolean;
  distance: number;
  progress?: string;
  blockedReason?: string;
} & (
  | { kind: "vehicle" }
  | { kind: "joint"; jointId: string; target: number; speed: number }
  | { kind: "points"; occurrenceId: string }
  | { kind: "train"; trainId: string }
);
/**
 * How near (LDU from the explorer's body) a target must be before the HUD
 * shows its action at all. Beyond it nothing is offered: a prompt appears
 * only when the explorer can act, or is close enough that the reason they
 * cannot (a blocked door, an obstructed seat) is useful.
 */
export const PROMPT_REACH = 160;
/** Whether the contextual action is worth showing (see PROMPT_REACH). */
export function promptVisible(target: PlayInteraction | undefined) {
  if (!target) return false;
  if (target.available) return true;
  return (
    target.distance <= PROMPT_REACH &&
    !!(target.blockedReason || target.progress)
  );
}
/** Reach for taking the controls of a train (LDU from its locomotive). */
export const TRAIN_REACH = 150;
/** Typical locomotive length behind the head pivot (a 6 × 24 base). */
const LOCOMOTIVE_LENGTH = 480;
/** The train whose locomotive the explorer stands beside, if any. */
export function nearbyTrain(
  report: PlaySnapshotReport,
): PlayInteraction | undefined {
  if (report.trains?.riding) return undefined;
  const body: Vec3 = [
    report.position[0],
    report.position[1] - report.profile.height / 2,
    report.position[2],
  ];
  let best: PlayInteraction | undefined;
  for (const train of report.trains?.trains ?? []) {
    // Distance to the locomotive: a segment from the head pivot back along
    // the track direction (the report carries the head and heading only).
    const [hx, hy, hz] = train.heading;
    const length = Math.hypot(hx, hy, hz) || 1;
    const offset = body.map((v, i) => v - train.position[i]);
    const back = Math.max(
      0,
      Math.min(
        LOCOMOTIVE_LENGTH,
        -(offset[0] * hx + offset[1] * hy + offset[2] * hz) / length,
      ),
    );
    const d = Math.hypot(
      ...offset.map((v, i) => v + (train.heading[i] / length) * back),
    );
    if (d > TRAIN_REACH * 1.6 || (best && d >= best.distance)) continue;
    best = {
      kind: "train",
      trainId: train.id,
      rigId: "",
      label: "Drive train",
      name: train.name,
      available: d <= TRAIN_REACH,
      distance: d,
    };
  }
  return best;
}
/** Reach for throwing a track switch by hand (LDU from the explorer's body). */
export const POINTS_REACH = 150;
/** Nearby track switches (points) of running trains. */
export function nearbyPoints(
  report: PlaySnapshotReport,
): PlayInteraction | undefined {
  let best: PlayInteraction | undefined;
  for (const s of report.trains?.switches ?? []) {
    const d = Math.hypot(
      s.position[0] - report.position[0],
      s.position[1] - (report.position[1] - report.profile.height / 2),
      s.position[2] - report.position[2],
    );
    // Points under a train are left out (the train slab shows them greyed).
    if (s.occupied) continue;
    if (d > POINTS_REACH * 1.6 || (best && d >= best.distance)) continue;
    best = {
      kind: "points",
      occurrenceId: s.occurrenceId,
      rigId: "",
      label:
        s.route === "straight"
          ? "Switch points to branch"
          : "Switch points to straight",
      name: "Track points",
      available: d <= POINTS_REACH,
      distance: d,
    };
  }
  return best;
}

/** Nearby authored anchors, measured from the middle of the explorer's body. */
export function nearbyInteraction(
  rig: MotionRig,
  report: PlaySnapshotReport,
  vehicleDistance?: number,
): PlayInteraction | undefined {
  const mechanism = report.mechanisms?.[rig.id] ?? report.mechanism;
  if (!mechanism || mechanism.rigId !== rig.id) return;
  const distance = (point: Vec3) =>
    Math.hypot(
      point[0] - report.position[0],
      point[1] - (report.position[1] - report.profile.height / 2),
      point[2] - report.position[2],
    );
  const targets: PlayInteraction[] = [];
  if (rig.vehicle) {
    const frame = mechanism.groupFrames[rig.vehicle.chassisGroup];
    if (frame) {
      const d = vehicleDistance ?? distance(frame.position);
      targets.push({
        kind: "vehicle",
        rigId: rig.id,
        label: "Get in",
        name: rig.name,
        available: d <= 96 && mechanism.vehicleCollision?.supported !== false,
        ...(mechanism.vehicleCollision?.supported === false
          ? {
              blockedReason:
                mechanism.vehicleCollision.reason ??
                "Vehicle collision support is unavailable",
            }
          : {}),
        distance: d,
      });
    }
  }
  for (const joint of rig.joints) {
    if (joint.kind !== "revolute" && joint.kind !== "prismatic") continue;
    const frame = mechanism.groupFrames[joint.bodyA];
    if (!frame) continue;
    const d = distance(add(frame.position, mv(frame.basis, joint.anchorA)));
    const [min, max] =
      joint.limits ?? (joint.kind === "revolute" ? [0, 90] : [0, 40]);
    const closed = Math.max(min, Math.min(max, 0));
    let opened = Math.abs(max - closed) >= Math.abs(min - closed) ? max : min;
    // Two-way automatic doors open away from the explorer, like a push door.
    const door = report.autoDoors?.doors.find(
      (d) => d.rigId === rig.id && d.jointId === joint.id,
    );
    if (door && min < 0 && max > 0) {
      const [ax, ay, az] = door.axis,
        [lx, ly, lz] = door.leaf;
      const swing: Vec3 = [
        ay * lz - az * ly,
        az * lx - ax * lz,
        ax * ly - ay * lx,
      ];
      const toward = [0, 1, 2].reduce(
        (sum, k) =>
          sum +
          swing[k] *
            ((k === 1
              ? report.position[1] - report.profile.height / 2
              : report.position[k]) -
              door.pivot[k]),
        0,
      );
      const now = mechanism.pose.jointPositions[joint.id] ?? 0,
        moving = mechanism.jointTargets?.[joint.id];
      // Keep the side an open (or opening) door is already on.
      opened =
        moving && moving.status !== "complete" && Math.abs(moving.target) > 1e-6
          ? moving.target > 0
            ? max
            : min
          : Math.abs(now) > 1
            ? now > 0
              ? max
              : min
            : toward > 0
              ? min
              : max;
    }
    if (Math.abs(opened - closed) < 1e-6) continue;
    const current = mechanism.pose.jointPositions[joint.id] ?? 0;
    const travel = mechanism.jointTargets?.[joint.id];
    const intendedOpen =
      travel &&
      Math.abs(travel.target - opened) < Math.abs(travel.target - closed);
    const retry = travel?.status === "blocked";
    const close =
      travel && travel.status !== "complete"
        ? retry
          ? !intendedOpen
          : !!intendedOpen
        : Math.abs(current - opened) < Math.abs(current - closed);
    const unit = joint.kind === "revolute" ? "°" : " LDU";
    const progress =
      travel?.status === "moving"
        ? `${intendedOpen ? "Opening" : "Closing"} · ${current.toFixed(1)}${unit} / ${travel.target.toFixed(1)}${unit}`
        : retry
          ? `Blocked at ${current.toFixed(1)}${unit}. Move clear, then retry.`
          : undefined;
    targets.push({
      kind: "joint",
      rigId: rig.id,
      jointId: joint.id,
      target: close ? closed : opened,
      speed: joint.kind === "revolute" ? 90 : 40,
      label: retry
        ? close
          ? "Retry closing"
          : "Retry opening"
        : close
          ? door
            ? "Close door"
            : "Close joint"
          : door
            ? "Open door"
            : "Open joint",
      progress,
      blockedReason: retry ? travel.blockedReason : undefined,
      name: door ? `${rig.name} · ${door.part}` : `${rig.name} · ${joint.id}`,
      available: d <= 96,
      distance: d,
    });
  }
  return targets.sort((a, b) => a.distance - b.distance)[0];
}
