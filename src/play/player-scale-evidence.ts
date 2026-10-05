import type { Bounds } from "../core/spatial";
import type { Occurrence, Project } from "../core/types";
import { occurrences } from "../core/document";
import { doorHinge } from "./auto-doors";
import { occurrenceBounds } from "./trains";
import type { BuildScaleEvidence } from "./player-scale";

/** Minifigure heads, torsos, arms, hips and legs (any print or pattern). */
const MINIFIG_PART =
  /^(3626|973|970|971|972|975|976|981|982|3815|3816|3817|3818|3819|3820)([a-z][a-z0-9-]*)?\.dat$/i;
const partName = (ref: string) =>
  ref.toLowerCase().replaceAll("\\", "/").replace(/^.*\//, "");

/**
 * What the player-size suggestion looks at (src/play/player-scale.ts):
 * minifigure doors and figures, and the overall bounds of the parts. One
 * pass over the placed parts; per-part answers are cached by reference.
 */
export function buildScaleEvidence(
  project: Project,
  all: Occurrence[] = occurrences(project),
): BuildScaleEvidence {
  const boundsOf = occurrenceBounds(project);
  const door = new Map<string, boolean>(),
    figure = new Map<string, boolean>();
  let doors = 0,
    minifigParts = 0,
    bounds: Bounds | null = null;
  for (const o of all) {
    const ref = o.node.ref;
    let isDoor = door.get(ref);
    if (isDoor === undefined) {
      isDoor = !!doorHinge(ref);
      door.set(ref, isDoor);
    }
    let isFigure = figure.get(ref);
    if (isFigure === undefined) {
      isFigure = MINIFIG_PART.test(partName(ref));
      figure.set(ref, isFigure);
    }
    if (isDoor) doors++;
    if (isFigure) minifigParts++;
    const b = boundsOf(o);
    if (!b) continue;
    if (!bounds) bounds = { min: [...b.min], max: [...b.max] } as Bounds;
    else
      for (let k = 0; k < 3; k++) {
        bounds.min[k] = Math.min(bounds.min[k], b.min[k]);
        bounds.max[k] = Math.max(bounds.max[k], b.max[k]);
      }
  }
  return {
    parts: all.length,
    doors,
    minifigParts,
    ...(bounds
      ? {
          bounds: {
            min: [...bounds.min] as [number, number, number],
            max: [...bounds.max] as [number, number, number],
          },
        }
      : {}),
  };
}
