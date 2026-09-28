import type { MotionRig } from "./types";

/**
 * Whether a group becomes a fixed body in dynamic Play. Explicit settings win;
 * otherwise root groups of non-vehicle rigs stay anchored (a door frame, an
 * axle post) and everything else moves.
 */
export function anchoredGroup(rig: MotionRig, groupId: string) {
  const explicit = rig.dynamics?.groups?.[groupId]?.anchored;
  if (explicit !== undefined) return explicit;
  if (rig.vehicle) return false;
  return !rig.joints.some((joint) => joint.bodyB === groupId);
}
