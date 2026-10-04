import { occurrences } from "../core/document";
import { ensure, type Occurrence, type Project } from "../core/types";
import type { MotionRig } from "./types";
import {
  matchMechanicalFeatures,
  worldMechanicalFeatures,
} from "./mechanical-contacts";

export const GUIDED_RACK_PLAY_REFUSAL =
  "This rack guide needs matching reviewed geometry before Play can start. Reload its original parts and try again.";

export const GUIDED_RACK_PROXY_WARNING =
  "This rack guide uses reviewed simulation geometry in Play. Physical LEGO fit and loads are not certified.";

/** Identify an aligned guide contact that requires source-bound Play geometry.
 * Callers must check both captured member bindings before admitting this contact;
 * matching part references alone never grants Play support. The unsupported
 * descriptor explains an absent binding, not a blanket refusal of bound guides.
 * Proposals and mathematical preview do not allocate or bind Play geometry.
 * Only the reviewed 18940/18942 guide on a prismatic tree edge is recognized;
 * unrelated housings and arbitrary sliders are not rejected.
 */
export function unsupportedMechanicalPlayContact(
  project: Project,
  rig: MotionRig,
  occurrenceLookup?: ReadonlyMap<string, Occurrence>,
) {
  if (!rig.joints.some((joint) => joint.kind === "prismatic")) return undefined;
  const lookup =
      occurrenceLookup ?? new Map(occurrences(project).map((o) => [o.id, o])),
    groups = new Map(rig.groups.map((group) => [group.id, group]));
  let checks = 0;
  for (const joint of rig.joints) {
    if (joint.kind !== "prismatic") continue;
    const carrier = groups.get(joint.bodyA),
      slider = groups.get(joint.bodyB);
    if (!carrier || !slider) continue;
    for (const guideId of carrier.occurrenceIds) {
      const guide = lookup.get(guideId);
      if (guide?.node.ref !== "18940.dat") continue;
      const guideFeatures = worldMechanicalFeatures(guide)?.filter(
        (feature) => feature.kind === "rack-guide",
      );
      for (const rackId of slider.occurrenceIds) {
        const rack = lookup.get(rackId);
        if (rack?.node.ref !== "18942.dat") continue;
        ensure(
          ++checks <= 4096,
          "LIMIT_EXCEEDED",
          "This mechanism is too complex to check safely. Try fewer moving parts.",
          { limit: "mechanicalPlaySupport", maximum: 4096 },
        );
        const rackFeatures = worldMechanicalFeatures(rack)?.filter(
          (feature) => feature.kind === "rack-slide",
        );
        for (const a of guideFeatures ?? [])
          for (const b of rackFeatures ?? []) {
            const contact = matchMechanicalFeatures(a, b);
            if (contact && "kind" in contact && contact.kind === "rack-guide")
              return {
                contactStatus: "unsupported" as const,
                feature: "18940-guided-rack" as const,
                reason: GUIDED_RACK_PLAY_REFUSAL,
                rigId: rig.id,
                jointId: joint.id,
                guideOccurrenceId: guideId,
                rackOccurrenceId: rackId,
              };
          }
      }
    }
  }
  return undefined;
}
