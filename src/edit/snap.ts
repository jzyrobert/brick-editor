// Connector snapping for placement (spec §11.1 connector mode, §11.2).
// Given a proposed placement (from the bounds-based stacking or the workplane),
// find the positions at which the new part's anti-studs sit on existing studs,
// or its studs sit in existing anti-studs. Only verified connector data is
// used on both sides; otherwise the caller keeps its bounds-based placement.
// Candidates are ranked (nearest first) so the user can cycle through them;
// a previous choice is kept with hysteresis so the preview does not flicker.
// A tap on a face carrying sideways studs (side-stud bricks, or parts already
// attached sideways) orients the new part to those studs instead.
import {
  partOccupancy,
  verifiedConnectors,
  type Connector,
} from "../catalog/connectors";
import {
  ConnectorIndex,
  worldConnectors,
  type WorldConnector,
} from "../core/connectivity";
import { isMale, mateKind } from "../catalog/connector-pack";
import { occurrences } from "../core/document";
import { add, compose, inverse, mv, physical, rotationY } from "../core/math";
import { transformBounds, type Bounds } from "../core/spatial";
import installedBounds from "../catalog/bounds.json";
import { catalog } from "../catalog/catalog";
import type {
  Basis,
  Occurrence,
  Project,
  Transform,
  Vec3,
} from "../core/types";
import { validateWorkplane, type Workplane } from "./workplane";

/** Largest horizontal (along the plane) move a snap may make, in LDU. */
export const SNAP_REACH = 20;
/** Largest move along the stacking direction; the proposal already sets the level. */
export const SNAP_LEVEL_TOLERANCE = 4.5;
/** A previous fit is kept until another is nearer by more than this (LDU). */
export const SNAP_HYSTERESIS = 6;
/** Most fits offered for cycling. */
export const MAX_FITS = 12;

/** Body occupancy of one scene part, for clash tests. */
export type Occupant = {
  occurrenceId: string;
  /** Its part reference (track and wheels nest by design). */
  ref?: string;
  /** World box of all its occupancy boxes (broad phase). */
  world: Bounds;
  transform: Transform;
  /** Occupancy boxes in the part's own space. */
  boxes: Bounds[];
};
export type SceneConnectors = {
  /** Male connectors: studs and hinge pins. */
  studs: ConnectorIndex;
  /** Female connectors: anti-studs and hinge sockets. */
  receptors: ConnectorIndex;
  all: WorldConnector[];
  /** Body occupancy of known official parts, for clash tests. */
  occupants?: Occupant[];
};
const STUD = 4;
const CLASH_MARGIN = 0.5; // LDU of overlap ignored as numeric noise
const localBounds = installedBounds.bounds as unknown as Record<
  string,
  Bounds | null
>;
const union = (boxes: Bounds[]): Bounds => {
  // A loop, not Math.min(...list): large selections overflow a spread.
  const min: Vec3 = [Infinity, Infinity, Infinity],
    max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const b of boxes)
    for (let i = 0; i < 3; i++) {
      if (b.min[i] < min[i]) min[i] = b.min[i];
      if (b.max[i] > max[i]) max[i] = b.max[i];
    }
  return { min, max };
};
/**
 * A part's body in its own space: the derived occupancy boxes of a catalogue
 * part (studs excluded), else its source box without the top stud row.
 */
export function localOccupancy(ref: string): Bounds[] | null {
  const boxes = partOccupancy(ref);
  if (boxes) return boxes;
  const b = Object.hasOwn(localBounds, ref) ? localBounds[ref] : null;
  if (!b) return null;
  const studded = Object.hasOwn(catalog, ref) && catalog[ref].studded;
  return [
    {
      min: [b.min[0], b.min[1] + (studded ? STUD : 0), b.min[2]],
      max: [...b.max],
    },
  ];
}
const overlaps = (a: Bounds, b: Bounds) =>
  [0, 1, 2].every(
    (i) =>
      Math.min(a.max[i], b.max[i]) - Math.max(a.min[i], b.min[i]) >
      CLASH_MARGIN,
  );
/** True when a rotation only permutes and flips axes (boxes stay boxes). */
const axisAligned = (m: Basis) =>
  m.every((v) => Math.abs(v) < 1e-6 || Math.abs(Math.abs(v) - 1) < 1e-6);
/**
 * Clash test for a part placed at `transform`: its occupancy boxes against each
 * nearby occupant's. When the two parts' axes are aligned (any quarter turn)
 * the boxes are compared exactly in the occupant's space; otherwise each box
 * is compared as its world box, which is conservative.
 */
export function clashes(
  ref: string,
  transform: Transform,
  occupants: readonly Occupant[],
): boolean {
  const boxes = localOccupancy(ref);
  if (!boxes) return false;
  const world = transformBounds(union(boxes), transform);
  for (const o of occupants) {
    if (!overlaps(world, o.world)) continue;
    const rel = compose(inverse(o.transform), transform);
    if (axisAligned(rel.basis)) {
      for (const b of boxes) {
        const box = transformBounds(b, rel);
        if (o.boxes.some((ob) => overlaps(box, ob))) return true;
      }
    } else {
      const theirs = o.boxes.map((ob) => transformBounds(ob, o.transform));
      for (const b of boxes) {
        const box = transformBounds(b, transform);
        if (theirs.some((ob) => overlaps(box, ob))) return true;
      }
    }
  }
  return false;
}
/** World connectors and body occupancy of every covered occurrence (optionally only some). */
export function sceneConnectors(
  project: Project,
  all: Occurrence[] = occurrences(project),
  include: (o: Occurrence) => boolean = () => true,
): SceneConnectors {
  const studs = new ConnectorIndex(),
    receptors = new ConnectorIndex(),
    list: WorldConnector[] = [],
    occupants: Occupant[] = [];
  for (const o of all) {
    if (!include(o)) continue;
    for (const c of worldConnectors(o) ?? []) {
      (isMale(c.kind) ? studs : receptors).add(c);
      list.push(c);
    }
    const boxes =
      o.namespace === "official" && o.node.kind === "part"
        ? localOccupancy(o.node.ref)
        : null;
    if (boxes)
      occupants.push({
        occurrenceId: o.id,
        ref: o.node.ref,
        world: transformBounds(union(boxes), o.transform),
        transform: o.transform,
        boxes,
      });
  }
  return { studs, receptors, all: list, occupants };
}

export type SnapResult = {
  position: Vec3;
  /** Orientation of the part at this fit (the proposal's unless oriented to a side stud). */
  basis: Basis;
  /** Number of the new part's connectors that mate at this position. */
  contacts: number;
  /** Occurrences the new part would connect to. */
  targetIds: string[];
};
/** A ranked fit: `distance` is its distance from the proposal or the tap. */
export type SnapCandidate = SnapResult & { distance: number };

const place = (c: Connector, basis: Basis, position: Vec3): Connector => ({
  kind: c.kind,
  p: add(position, mv(basis, c.p)),
  axis: mv(basis, c.axis),
});
const round = (v: Vec3) =>
  v.map((n) => Math.round(n * 1000) / 1000 || 0) as Vec3;
const tidy = (m: Basis) =>
  m.map((n) => Math.round(n * 1e9) / 1e9 || 0) as Basis;
const fitKey = (position: Vec3, basis: Basis) =>
  position.map((v) => Math.round(v * 100)).join(",") +
  "|" +
  basis.map((v) => Math.round(v * 1000)).join(",");

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
    const found = (isMale(c.kind) ? scene.receptors : scene.studs).mates(
      w,
      mateKind(c.kind),
    );
    if (found.length) {
      contacts++;
      for (const f of found) targets.add(f.occurrenceId);
    }
  }
  return { contacts, targetIds: [...targets] };
}

const rank = (a: SnapCandidate, b: SnapCandidate) =>
  a.distance - b.distance || b.contacts - a.contacts;
/** Keeps fits that connect and do not pass through another body. */
function evaluate(
  ref: string,
  local: Connector[],
  fits: Map<string, { position: Vec3; basis: Basis; distance: number }>,
  scene: SceneConnectors,
): SnapCandidate[] {
  const out: SnapCandidate[] = [];
  for (const { position, basis, distance } of fits.values()) {
    const { contacts, targetIds } = contactsAt(local, basis, position, scene);
    if (!contacts) continue;
    // A connection that would push the part through another body is not legal.
    if (scene.occupants && clashes(ref, { position, basis }, scene.occupants))
      continue;
    out.push({
      position: round(position),
      basis,
      contacts,
      targetIds,
      distance,
    });
  }
  return out.sort(rank).slice(0, MAX_FITS);
}

/**
 * Every fit of catalogue part `ref` (orientation kept) near a proposed
 * placement, nearest first: positions within one stud across and 4.5 LDU along
 * the stacking direction `up` (world unit vector; LDraw −Y for a horizontal
 * workplane) where it makes at least one verified stud connection and passes
 * through no other body. Empty when the part or every nearby target lacks
 * verified data.
 */
export function snapCandidates(
  ref: string,
  basis: Basis,
  proposal: Vec3,
  scene: SceneConnectors,
  up: Vec3 = [0, -1, 0],
): SnapCandidate[] {
  const local = verifiedConnectors(ref);
  if (!local || !physical({ position: proposal, basis })) return [];
  const fits = new Map<
    string,
    { position: Vec3; basis: Basis; distance: number }
  >();
  for (const c of local) {
    const w = place(c, basis, proposal);
    const wanted = mateKind(c.kind);
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
      fits.set(fitKey(position, basis), {
        position,
        basis,
        distance: Math.hypot(...d),
      });
    }
  }
  return evaluate(ref, local, fits, scene);
}

/**
 * Index of the fit to show: the previous one while it is still offered and no
 * other is nearer by more than SNAP_HYSTERESIS, else the nearest (0); −1 when
 * there is none.
 */
export function chooseFit(
  fits: readonly SnapCandidate[],
  previous?: { position: Vec3; basis?: Basis } | null,
): number {
  if (!fits.length) return -1;
  if (previous) {
    const i = fits.findIndex(
      (f) =>
        f.position.every((v, k) => Math.abs(v - previous.position[k]) < 0.01) &&
        (!previous.basis ||
          f.basis.every((v, k) => Math.abs(v - previous.basis![k]) < 1e-6)),
    );
    if (i >= 0 && fits[i].distance <= fits[0].distance + SNAP_HYSTERESIS)
      return i;
  }
  return 0;
}

/**
 * Snaps a proposed placement of catalogue part `ref` to verified connectors:
 * the nearest fit (see `snapCandidates`), or `previous` while hysteresis keeps
 * it. Returns null when nothing connects within reach.
 */
export function snapPlacement(
  ref: string,
  basis: Basis,
  proposal: Vec3,
  scene: SceneConnectors,
  up: Vec3 = [0, -1, 0],
  previous?: { position: Vec3; basis?: Basis } | null,
): SnapResult | null {
  const fits = snapCandidates(ref, basis, proposal, scene, up);
  const i = chooseFit(fits, previous);
  if (i < 0) return null;
  const { distance: _distance, ...result } = fits[i];
  return result;
}

const unitVec = (v: Vec3): Vec3 => {
  const l = Math.hypot(...v) || 1;
  return v.map((n) => n / l) as Vec3;
};
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/**
 * Orientation that turns local axis `local` (±Y, a stud's or receptor's axis)
 * into world direction `want`, spun by `spin` degrees about it. At spin 0 the
 * part's local x axis lies across the stacking direction `up`, so a plate on a
 * side stud has its length horizontal.
 */
export function orientTo(
  local: Vec3,
  want: Vec3,
  spin: number,
  up: Vec3 = [0, -1, 0],
): Basis {
  const s = local[1] < 0 ? -1 : 1;
  const y = unitVec(want.map((v) => v * s) as Vec3);
  let x = cross(y, up);
  if (Math.hypot(...x) < 0.1)
    x = cross(y, Math.abs(y[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1]);
  x = unitVec(x);
  const z = cross(x, y);
  const b0: Basis = [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
  return tidy(
    compose(
      { position: [0, 0, 0], basis: b0 },
      { position: [0, 0, 0], basis: rotationY(spin) },
    ).basis,
  );
}

/**
 * Fits that orient the new part to sideways connectors on the tapped face
 * (spec §11.1 connector mode): for every verified stud or anti-stud within
 * reach of the tap whose axis points out of the tapped face and across the
 * stacking direction `up`, each opposite upright connector of the new part is
 * mated to it with the part's up axis along the connector's axis, spun by
 * `spin` degrees. Ranked by the target's distance from the tap, then by how
 * near the part's body lies to the tap, then by contacts.
 */
export function orientedCandidates(
  ref: string,
  spin: number,
  tap: { point: Vec3; normal: Vec3 },
  scene: SceneConnectors,
  up: Vec3 = [0, -1, 0],
): SnapCandidate[] {
  const local = verifiedConnectors(ref);
  if (!local) return [];
  const targets = scene.all.filter(
    (t) =>
      dot3(t.axis, tap.normal) > 0.7 &&
      Math.abs(dot3(t.axis, up)) < 0.7 &&
      Math.hypot(...(t.p.map((v, i) => v - tap.point[i]) as Vec3)) <=
        SNAP_REACH,
  );
  if (!targets.length) return [];
  const boxes = localOccupancy(ref);
  const centre = boxes
    ? (() => {
        const u = union(boxes);
        return u.min.map((v, i) => (v + u.max[i]) / 2) as Vec3;
      })()
    : ([0, 0, 0] as Vec3);
  const fits = new Map<
    string,
    { position: Vec3; basis: Basis; distance: number }
  >();
  for (const t of targets)
    for (const c of local) {
      if (c.kind === t.kind || c.axis[0] || c.axis[2]) continue;
      const basis = orientTo(c.axis, t.axis.map((v) => -v) as Vec3, spin, up);
      const position = t.p.map((v, i) => v - mv(basis, c.p)[i]) as Vec3;
      const body = add(position, mv(basis, centre));
      // The target's own distance dominates; the body's distance breaks ties
      // between the part's own connectors on that target.
      const distance =
        Math.hypot(...(t.p.map((v, i) => v - tap.point[i]) as Vec3)) +
        Math.hypot(...(body.map((v, i) => v - tap.point[i]) as Vec3)) / 1000;
      const k = fitKey(position, basis);
      if (!fits.has(k)) fits.set(k, { position, basis, distance });
    }
  return evaluate(ref, local, fits, scene);
}

/** A hinge socket pair of one scene part, in world space. */
export type WorldHinge = {
  occurrenceId: string;
  /** Upper socket opening; `axis` points from it towards the lower one. */
  top: Vec3;
  bottom: Vec3;
  axis: Vec3;
};
/** Socket pairs in the scene: a socket opening towards another on its own axis. */
export function sceneHinges(scene: SceneConnectors): WorldHinge[] {
  const sockets = scene.all.filter((c) => c.kind === "socket");
  const out: WorldHinge[] = [];
  for (const a of sockets)
    for (const b of sockets) {
      if (a === b || a.occurrenceId !== b.occurrenceId) continue;
      if (dot3(a.axis, b.axis) > -0.99) continue;
      const d = b.p.map((v, i) => v - a.p[i]) as Vec3;
      const along = dot3(d, a.axis);
      const off = Math.hypot(
        ...(d.map((v, i) => v - along * a.axis[i]) as Vec3),
      );
      if (along <= 0 || off > 0.5) continue;
      out.push({
        occurrenceId: a.occurrenceId,
        top: a.p,
        bottom: b.p,
        axis: a.axis,
      });
    }
  return out;
}

/**
 * Closed seats of a hinged leaf in one socket pair of a frame. The leaf's
 * `top`/`bottom` pin points and `centre` are in its own space; the frame's
 * `transform` places it in the world, `box` is its body box in its own space
 * and `pair` is the socket pair in the world. The leaf turns with the frame in
 * quarter turns about the socket axis; a turn is a seat when the upper pin is
 * at the upper socket, the lower pin within 1 LDU of the lower socket (the
 * sizes match) and the leaf's centre lies within the frame's body box (closed,
 * not swung out through a post).
 */
export function hingeSeats(
  leaf: { top: Vec3; bottom: Vec3; centre: Vec3 },
  frame: { transform: Transform; box: Bounds },
  pair: { top: Vec3; bottom: Vec3; axis: Vec3 },
): { position: Vec3; basis: Basis }[] {
  const out: { position: Vec3; basis: Basis }[] = [];
  for (let k = 0; k < 4; k++) {
    const basis = tidy(
      compose(
        { position: [0, 0, 0], basis: frame.transform.basis },
        { position: [0, 0, 0], basis: rotationY(90 * k) },
      ).basis,
    );
    // The leaf's pins run along its local Y; so must the frame's sockets.
    if (dot3(mv(basis, [0, 1, 0]), pair.axis) < 0.99) continue;
    const position = pair.top.map((v, i) => v - mv(basis, leaf.top)[i]) as Vec3;
    const low = add(position, mv(basis, leaf.bottom));
    if (Math.hypot(...(low.map((v, i) => v - pair.bottom[i]) as Vec3)) > 1)
      continue;
    const inFrame = compose(inverse(frame.transform), {
      position: add(position, mv(basis, leaf.centre)),
      basis,
    }).position;
    if (
      [0, 2].every(
        (i) =>
          inFrame[i] > frame.box.min[i] + 0.5 &&
          inFrame[i] < frame.box.max[i] - 0.5,
      )
    )
      out.push({ position: round(position), basis });
  }
  return out;
}

/**
 * Seats a hinged leaf (a door or window pane with verified hinge pins) in the
 * sockets of a frame near the tap, closed (see `hingeSeats`): its upper pin enters the upper
 * socket with the pin axis on the socket axis, turned in quarter turns with the
 * frame so that the leaf lies inside the frame's body (so each socket pair
 * gives its own hinge side), and only where the lower pin reaches the lower
 * socket within 1 LDU (the sizes match). Nearest socket axis to the tap first.
 * The frame itself is exempt from the clash test (its sockets hold the pins);
 * every other part is not.
 */
export function hingeCandidates(
  ref: string,
  tap: { point: Vec3 },
  scene: SceneConnectors,
): SnapCandidate[] {
  const local = verifiedConnectors(ref);
  const pins = local?.filter((c) => c.kind === "pin") ?? [];
  const top = pins.find((c) => c.axis[1] < 0),
    bottom = pins.find((c) => c.axis[1] > 0);
  if (!local || !top || !bottom) return [];
  const boxes = localOccupancy(ref);
  const leaf = boxes ? union(boxes) : null;
  const centre = leaf
    ? (leaf.min.map((v, i) => (v + leaf.max[i]) / 2) as Vec3)
    : top.p;
  const out: SnapCandidate[] = [];
  const seen = new Set<string>();
  for (const h of sceneHinges(scene)) {
    const frame = scene.occupants?.find(
      (o) => o.occurrenceId === h.occurrenceId,
    );
    if (!frame) continue;
    const d = tap.point.map((v, i) => v - h.top[i]) as Vec3;
    const along = dot3(d, h.axis);
    const distance = Math.hypot(
      ...(d.map((v, i) => v - along * h.axis[i]) as Vec3),
    );
    if (distance > 100) continue;
    const seats = hingeSeats(
      { top: top.p, bottom: bottom.p, centre },
      { transform: frame.transform, box: union(frame.boxes) },
      h,
    );
    for (const { position, basis } of seats) {
      const key = fitKey(position, basis);
      if (seen.has(key)) continue;
      seen.add(key);
      const { contacts, targetIds } = contactsAt(local, basis, position, scene);
      if (contacts < 2) continue;
      const others = scene.occupants!.filter(
        (o) => o.occurrenceId !== h.occurrenceId,
      );
      if (clashes(ref, { position, basis }, others)) continue;
      out.push({
        position: round(position),
        basis,
        contacts,
        targetIds,
        distance,
      });
    }
  }
  return out.sort(rank).slice(0, MAX_FITS);
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
  const tidyN = (n: number) => Math.round(n * 1e9) / 1e9 || 0;
  const normal = best.axis.map(tidyN) as Vec3;
  // One of the part's own axes lies in the stud plane: x for an upright stud,
  // x or z for a side stud.
  const b = o.transform.basis;
  const u = [
    [b[0], b[3], b[6]],
    [b[2], b[5], b[8]],
    [b[1], b[4], b[7]],
  ]
    .map((axis) => axis.map(tidyN) as Vec3)
    .find((axis) => Math.abs(dot3(axis, normal)) < 1e-6)!;
  const v: Vec3 = cross(normal, u);
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
