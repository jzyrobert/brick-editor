import { ensure } from "../core/types";
import type { PlayMechanismSource } from "./mechanism";
import {
  prepareArocsBallRest,
  readPreparedArocsBallRest,
  requireArocsBallRestConstruction,
} from "./arocs-ball-rest";

export const hasNativeRestDeclaration = (source: PlayMechanismSource) =>
  source.project.motionRigs[source.rigId]?.joints.some(
    (joint) => joint.restAssembly !== undefined,
  ) ?? false;

/** Complete source preflight before any native world is allocated. A supplied
 * witness must remain bound to this exact source; replacing it cannot repair
 * an edited source or turn a copied token into a valid admission. */
export async function prepareNativeRestSources(
  sources: readonly PlayMechanismSource[],
  dynamicRigIds: readonly string[],
): Promise<void> {
  ensure(
    sources.length <= 32,
    "LIMIT_EXCEEDED",
    "Too many moving mechanisms to check safely.",
  );
  const pending = await Promise.all(
    sources.map(async (source) => {
      if (source.nativeRest !== undefined)
        requireArocsBallRestConstruction(source);
      if (!hasNativeRestDeclaration(source)) return undefined;
      ensure(
        dynamicRigIds.includes(source.rigId),
        "INVALID_INPUT",
        "This source assembly needs Dynamic Play to seat its actual ball joints.",
      );
      const prepared =
        source.nativeRest ?? (await prepareArocsBallRest(source));
      return { source, prepared };
    }),
  );
  // Recheck all tokens after the async work, before publishing any new binding.
  for (const entry of pending)
    if (entry)
      for (const prepared of entry.prepared)
        readPreparedArocsBallRest(prepared);
  for (const entry of pending)
    if (entry) {
      entry.source.nativeRest = entry.prepared;
      requireArocsBallRestConstruction(entry.source);
    }
}
