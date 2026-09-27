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
);

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
        available: d <= 96,
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
    const opened = Math.abs(max - closed) >= Math.abs(min - closed) ? max : min;
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
          ? "Close joint"
          : "Open joint",
      progress,
      blockedReason: retry ? travel.blockedReason : undefined,
      name: `${rig.name} · ${joint.id}`,
      available: d <= 96,
      distance: d,
    });
  }
  return targets.sort((a, b) => a.distance - b.distance)[0];
}
