import { ensure, type Project } from "../core/types";
import { occurrences } from "../core/document";
import type { PlayWorldProfile, ResolvedPlayWorldProfile } from "./types";
export function validatePlayWorldProfile(
  input: PlayWorldProfile | undefined,
): PlayWorldProfile {
  if (input === undefined) return { excludedLayerIds: [] };
  ensure(
    input &&
      typeof input === "object" &&
      !Array.isArray(input) &&
      Object.keys(input).every((key) => key === "excludedLayerIds"),
    "INVALID_INPUT",
    "Play world profile accepts only excludedLayerIds",
  );
  ensure(
    Array.isArray(input.excludedLayerIds) &&
      input.excludedLayerIds.length <= 10000 &&
      input.excludedLayerIds.every(
        (id) => typeof id === "string" && id.length > 0 && id.length <= 1024,
      ),
    "INVALID_INPUT",
    "Excluded layers must be a bounded array of layer IDs",
  );
  ensure(
    new Set(input.excludedLayerIds).size === input.excludedLayerIds.length,
    "INVALID_INPUT",
    "Excluded layer IDs must be unique",
  );
  return { excludedLayerIds: [...input.excludedLayerIds].sort() };
}
/** Editor visibility and locking never determine Play inclusion. */
export function resolvePlayWorldProfile(
  project: Project,
  input?: PlayWorldProfile,
  rigId?: string,
): ResolvedPlayWorldProfile {
  const requested = validatePlayWorldProfile(input),
    excluded = new Set(requested.excludedLayerIds);
  ensure(
    requested.excludedLayerIds.every((id) => Object.hasOwn(project.layers, id)),
    "INVALID_INPUT",
    "Play profile contains an unknown layer",
  );
  const includedOccurrenceIds = occurrences(project)
    .filter((o) => !excluded.has(o.layerId))
    .map((o) => o.id);
  if (rigId) {
    const rig = project.motionRigs?.[rigId],
      included = new Set(includedOccurrenceIds);
    ensure(rig, "INVALID_INPUT", "Unknown authored Play rig");
    ensure(
      rig.groups.every((group) =>
        group.occurrenceIds.every((id) => included.has(id)),
      ),
      "INVALID_INPUT",
      "The Play profile excludes a member of the selected rig. Include every rig layer or choose another rig.",
    );
  }
  return { ...requested, includedOccurrenceIds };
}
