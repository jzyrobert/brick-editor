import { ensure, type Project, type Transform } from "../core/types";
import { occurrences } from "../core/document";
import { RESOURCE_PROFILES } from "../core/resource-profile";
import { compose, inverse, nearlyPhysical, physical } from "../core/math";
import { parentTransform, uniqueNode } from "../core/commands";
import { exportLDraw } from "../ldraw/io";

const round = (value: number, step: number) => {
  const r = Math.round(value / step) * step;
  return Object.is(r, -0) ? 0 : Number(r.toFixed(9));
};
/**
 * Static posed LDraw snapshot (spec 19.5). Writes the supplied world
 * transforms into a private copy of the project and exports MPD text. The
 * authored project, its rest pose and its rigs are never changed; this is the
 * explicit alternative to the rest-pose default export.
 */
export function posedLDraw(
  project: Project,
  transforms: Record<string, Transform>,
): { text: string; posedOccurrenceIds: string[]; warnings: string[] } {
  ensure(
    transforms && typeof transforms === "object",
    "INVALID_INPUT",
    "Posed export requires occurrence transforms",
  );
  const copy = structuredClone(project);
  const all = new Map(occurrences(copy).map((o) => [o.id, o]));
  const ids = Object.keys(transforms).sort();
  ensure(
    ids.length <= RESOURCE_PROFILES.desktop.occurrences,
    "LIMIT_EXCEEDED",
    "Too many posed occurrences",
  );
  for (const id of ids) {
    const o = all.get(id);
    ensure(o, "INVALID_INPUT", "Posed transform names an unknown occurrence");
    const t = transforms[id];
    ensure(
      t &&
        Array.isArray(t.position) &&
        t.position.length === 3 &&
        Array.isArray(t.basis) &&
        t.basis.length === 9 &&
        [...t.position, ...t.basis].every(Number.isFinite) &&
        // Preserve the authored decimal basis under a strictly rigid motion.
        // The original rounding allowance never permits new scale or shear.
        (physical(t) ||
          (nearlyPhysical(o.transform) &&
            physical(compose(t, inverse(o.transform))))),
      "INVALID_TRANSFORM",
      "Posed transforms must be finite rigid placements",
    );
    const node = uniqueNode(copy, o);
    const local = compose(inverse(parentTransform(copy, o.path)), t);
    node.transform = {
      position: local.position.map((v) =>
        round(v, 1e-4),
      ) as Transform["position"],
      basis: local.basis.map((v) => round(v, 1e-7)) as Transform["basis"],
    };
  }
  return {
    text: exportLDraw(copy),
    posedOccurrenceIds: ids,
    warnings: [
      "Static posed snapshot: rig definitions and the authored rest pose are unchanged. Re-importing this file yields plain parts at the posed placements.",
    ],
  };
}
