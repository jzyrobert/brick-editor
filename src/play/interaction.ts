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
);
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
      const d = distance(frame.position);
      targets.push({
        kind: "vehicle",
        rigId: rig.id,
        label: "Control vehicle",
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
