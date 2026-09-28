// Connector snapping for placement (spec §11.1 connector mode, §11.2).
// Given a proposed placement (from the bounds-based stacking or the workplane),
// find the nearest translation at which the new part's anti-studs sit on
// existing studs, or its studs sit in existing anti-studs. Only verified
// connector data is used on both sides; otherwise the caller keeps its
// bounds-based placement. The part's orientation is never changed here.
import { verifiedConnectors, type Connector } from "../catalog/connectors";
import {
  ConnectorIndex,
  worldConnectors,
  type WorldConnector,
} from "../core/connectivity";
import { occurrences } from "../core/document";
import { add, mv, physical } from "../core/math";
import { transformBounds, type Bounds } from "../core/spatial";
import installedBounds from "../catalog/bounds.json";
import { catalog } from "../catalog/catalog";
import type { Basis, Occurrence, Project, Vec3 } from "../core/types";
import { validateWorkplane, type Workplane } from "./workplane";

/** Largest horizontal (along the plane) move a snap may make, in LDU. */
export const SNAP_REACH = 20;
/** Largest move along the stacking direction; the proposal already sets the level. */
export const SNAP_LEVEL_TOLERANCE = 4.5;

export type SceneConnectors = {
  studs: ConnectorIndex;
  receptors: ConnectorIndex;
  all: WorldConnector[];
  /** Body boxes (stud rows removed) of known official parts, for clash tests. */
  bodies?: Bounds[];
};
const STUD = 4;
const CLASH_MARGIN = 0.5; // LDU of overlap ignored as numeric noise
const localBounds = installedBounds.bounds as unknown as Record<
  string,
  Bounds | null
>;
/** A catalogue part's body box: its source box without the top stud row. */
function localBody(ref: string): Bounds | null {
  const b = Object.hasOwn(localBounds, ref) ? localBounds[ref] : null;
  if (!b) return null;
  const studded = Object.hasOwn(catalog, ref) && catalog[ref].studded;
  return {
    min: [b.min[0], b.min[1] + (studded ? STUD : 0), b.min[2]],
    max: [...b.max],
  };
}
function bodyClash(ref: string, basis: Basis, bodies: Bounds[]) {
  const body = localBody(ref);
  if (!body) return null;
  return (position: Vec3) => {
    const box = transformBounds(body, { position, basis });
    return bodies.some((b) =>
      [0, 1, 2].every(
        (i) =>
          Math.min(box.max[i], b.max[i]) - Math.max(box.min[i], b.min[i]) >
          CLASH_MARGIN,
      ),
    );
  };
}
/** World connectors of every covered occurrence (optionally only some). */
export function sceneConnectors(
  project: Project,
  all: Occurrence[] = occurrences(project),
  include: (o: Occurrence) => boolean = () => true,
): SceneConnectors {
  const studs = new ConnectorIndex(),
    receptors = new ConnectorIndex(),
    list: WorldConnector[] = [],
    bodies: Bounds[] = [];
  for (const o of all) {
    if (!include(o)) continue;
    for (const c of worldConnectors(o) ?? []) {
      (c.kind === "stud" ? studs : receptors).add(c);
      list.push(c);
    }
    const body =
      o.namespace === "official" && o.node.kind === "part"
        ? localBody(o.node.ref)
        : null;
    if (body) bodies.push(transformBounds(body, o.transform));
  }
  return { studs, receptors, all: list, bodies };
}

export type SnapResult = {
  position: Vec3;
  /** Number of the new part's connectors that mate at this position. */
  contacts: number;
  /** Occurrences the new part would connect to. */
  targetIds: string[];
};

const place = (c: Connector, basis: Basis, position: Vec3): Connector => ({
  kind: c.kind,
  p: add(position, mv(basis, c.p)),
  axis: mv(basis, c.axis),
});

/** Mating connectors of a part placed with this basis/position. */
export function contactsAt(
  local: Connector[],
  basis: Basis,
  position: Vec3,
  scene: SceneConnectors,
) {
  let contacts = 0;
  const targets = new Set<string>();
  for (const c of local) {
    const w = place(c, basis, position);
    const found =
      c.kind === "antistud"
        ? scene.studs.mates(w, "stud")
        : scene.receptors.mates(w, "antistud");
    if (found.length) {
      contacts++;
      for (const f of found) targets.add(f.occurrenceId);
    }
  }
  return { contacts, targetIds: [...targets] };
}

/**
 * Snaps a proposed placement of catalogue part `ref` to verified connectors.
 * `up` is the stacking direction (world unit vector; LDraw −Y for a horizontal
 * workplane). Returns null when the part or every nearby target lacks
 * verified data, or when no connection lies within reach.
 */
export function snapPlacement(
  ref: string,
  basis: Basis,
  proposal: Vec3,
  scene: SceneConnectors,
  up: Vec3 = [0, -1, 0],
): SnapResult | null {
  const blocked = scene.bodies ? bodyClash(ref, basis, scene.bodies) : null;
  const local = verifiedConnectors(ref);
  if (!local || !physical({ position: proposal, basis })) return null;
  const candidates = new Map<string, Vec3>();
  for (const c of local) {
    const w = place(c, basis, proposal);
    const wanted = c.kind === "antistud" ? "stud" : "antistud";
    for (const t of scene.all) {
      if (t.kind !== wanted) continue;
      const dot =
        t.axis[0] * w.axis[0] + t.axis[1] * w.axis[1] + t.axis[2] * w.axis[2];
      if (dot > -0.99) continue;
      const d: Vec3 = [t.p[0] - w.p[0], t.p[1] - w.p[1], t.p[2] - w.p[2]];
      const along = d[0] * up[0] + d[1] * up[1] + d[2] * up[2];
      const across = Math.hypot(
        d[0] - along * up[0],
        d[1] - along * up[1],
        d[2] - along * up[2],
      );
      if (Math.abs(along) > SNAP_LEVEL_TOLERANCE || across > SNAP_REACH + 1e-6)
        continue;
      const position: Vec3 = [
        proposal[0] + d[0],
        proposal[1] + d[1],
        proposal[2] + d[2],
      ];
      candidates.set(
        position.map((v) => Math.round(v * 100)).join(","),
        position,
      );
    }
  }
  let best: (SnapResult & { distance: number }) | null = null;
  for (const position of candidates.values()) {
    const { contacts, targetIds } = contactsAt(local, basis, position, scene);
    if (!contacts) continue;
    // A connection that would push the part through another body is not legal.
    if (blocked?.(position)) continue;
    const distance = Math.hypot(
      position[0] - proposal[0],
      position[1] - proposal[1],
      position[2] - proposal[2],
    );
    // Nearest to the proposal wins; more contacts break near-ties.
    if (
      !best ||
      distance < best.distance - 1e-6 ||
      (Math.abs(distance - best.distance) <= 1e-6 && contacts > best.contacts)
    )
      best = {
        position: position.map((v) => Math.round(v * 1000) / 1000) as Vec3,
        contacts,
        targetIds,
        distance,
      };
  }
  if (!best) return null;
  const { distance: _distance, ...result } = best;
  return result;
}

/**
 * Workplane on the verified stud of `o` nearest to a tapped point (spec §8.3
 * "aligned to a selected connector"): the plane lies on the stud's base with its
 * normal along the stud, its axes follow the part, and its origin sits on a
 * stud-cell corner so the ordinary 20 LDU grid keeps new parts on that part's
 * studs. Returns null when the part has no verified stud within one stud of
 * the point.
 */
export function studWorkplane(
  o: Occurrence,
  point: Vec3,
  settings: Workplane,
): { plane: Workplane; stud: WorldConnector } | null {
  const studs = (worldConnectors(o) ?? []).filter((c) => c.kind === "stud");
  let best: WorldConnector | null = null,
    bestDistance = 20;
  for (const s of studs) {
    const d = Math.hypot(
      s.p[0] - point[0],
      s.p[1] - point[1],
      s.p[2] - point[2],
    );
    if (d <= bestDistance) {
      best = s;
      bestDistance = d;
    }
  }
  if (!best) return null;
  const tidy = (n: number) => Math.round(n * 1e9) / 1e9 || 0;
  const normal = best.axis.map(tidy) as Vec3;
  // The part's local x axis lies in the stud plane for an upright stud.
  const b = o.transform.basis;
  const u = [b[0], b[3], b[6]].map(tidy) as Vec3;
  const v: Vec3 = [
    normal[1] * u[2] - normal[2] * u[1],
    normal[2] * u[0] - normal[0] * u[2],
    normal[0] * u[1] - normal[1] * u[0],
  ];
  const origin = best.p.map(
    (n, i) => Math.round((n - 10 * u[i] - 10 * v[i]) * 1000) / 1000 || 0,
  ) as Vec3;
  const plane: Workplane = {
    ...settings,
    origin,
    normal,
    u,
    elevation: 0,
  };
  validateWorkplane(plane);
  return { plane, stud: best };
}
