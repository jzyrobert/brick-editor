import { catalog } from "../catalog/catalog";
import type { Occurrence, Vec3 } from "../core/types";

export type ReplaceAnchor = "bottom" | "top";
/**
 * Plan replacing selected catalogue parts with another catalogue part, keeping layer
 * and colour. LDraw brick/plate origins sit at the top face (+Y down), so keeping the
 * bottom face in place shifts the origin by the height difference along local +Y.
 * Raw geometry, project definitions and missing parts are excluded and counted.
 */
export function planReplacement(
  selected: Occurrence[],
  targetRef: string,
  anchor: ReplaceAnchor = "bottom",
) {
  const target = catalog[targetRef];
  const groups = new Map<string, string[]>();
  let excluded = 0,
    unchanged = 0;
  for (const o of selected) {
    const current = o.node.kind === "part" ? catalog[o.node.ref] : undefined;
    if (!current || o.namespace !== "official") excluded++;
    else if (o.node.ref === targetRef) unchanged++;
    else groups.set(o.node.ref, [...(groups.get(o.node.ref) ?? []), o.id]);
  }
  const payloads = [...groups].map(([ref, occurrenceIds]) => {
    const heightChange = target ? target.height - catalog[ref].height : 0;
    return {
      occurrenceIds,
      ref: targetRef,
      ...(anchor === "bottom" && heightChange
        ? { anchorOffset: [0, -heightChange, 0] as Vec3 }
        : {}),
    };
  });
  const changes = [...groups.keys()].map((ref) => {
    const from = catalog[ref];
    return {
      from: from.name,
      count: groups.get(ref)!.length,
      heightChange: target ? target.height - from.height : 0,
      footprint: !target
        ? ("unknown" as const)
        : target.width * target.depth > from.width * from.depth
          ? ("larger" as const)
          : target.width * target.depth < from.width * from.depth
            ? ("smaller" as const)
            : target.width === from.width
              ? ("same" as const)
              : ("rotated" as const),
    };
  });
  return {
    target,
    payloads,
    replaced: payloads.reduce((n, p) => n + p.occurrenceIds.length, 0),
    excluded,
    unchanged,
    changes,
    /** A larger, differently shaped or taller part may overlap neighbours. */
    mayOverlap: changes.some(
      (c) =>
        c.footprint === "larger" ||
        c.footprint === "rotated" ||
        // Taller parts grow into the space above (bottom anchor) or below (top anchor).
        c.heightChange > 0,
    ),
  };
}
