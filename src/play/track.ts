import { add, inverse, mv } from "../core/math";
import type { Transform, Vec3 } from "../core/types";

/**
 * Official LDraw train track: the rail centreline of each supported part,
 * in part-local LDU (negative Y up), and the rail graph a build's placed
 * track pieces form. Every number here is read from the official geometry
 * of the complete library (ldraw-full-2026-09-28) and pinned by
 * tests/unit/play-track.test.ts, which re-checks the rail heads of each
 * part against these centrelines.
 *
 * - Gauge: rail centres 100 LDU apart (5 studs), heads 6 LDU wide.
 * - Straight (53401, 74746, 4.5V/12V): 320 LDU (16 studs) along local X,
 *   ends at x = ±160.
 * - Curve R40 (53400, 74747, 4.5V/12V): radius 800 LDU (40 studs) about
 *   (0, 0, −800), 22.5° (16 make a circle), ends at x = ±156.073,
 *   z = −15.372, the middle sleeper on the origin.
 * - 9V switch right (75541 / 2859): common end x = −320, straight end
 *   x = +320 (two straights); the diverging route is an R40 arc about
 *   (−320, −800) through 36.87° (sin 0.6) to (160, −160), then a reverse R40
 *   arc about (640, 480) back to 22.5°, ending at (333.853, −259.104). A
 *   reverse curve after it gives a parallel track 320 LDU (16 studs) over,
 *   level with the end of one more straight. The left switch (75542 / 2861)
 *   is its mirror in Z.
 * - Rail tops: y = −16 on the plastic (53401, 53400) and 9V track, whose
 *   sleepers' bottoms are at y = +8; y = 0 on 4.5V/12V track, bottoms at +24.
 */

/** A centreline piece in the part's XZ plane. */
export type TrackPrim =
  | { kind: "line"; from: [number, number]; to: [number, number] }
  | {
      kind: "arc";
      /** point(φ) = center + radius·(sin φ, cos φ) in (x, z). */
      center: [number, number];
      radius: number;
      /** Start angle and signed sweep, radians. */
      start: number;
      sweep: number;
    };
export type TrackEndDef = {
  /** (x, z) at rail-top height. */
  position: [number, number];
  /** Outward unit direction (x, z): the way a train leaves the piece here. */
  direction: [number, number];
};
export type TrackSegmentDef = {
  /** Path from ends[0] to ends[1]. */
  ends: [number, number];
  prims: TrackPrim[];
  /** Switch route this segment is (0 straight, 1 diverging). */
  route?: 0 | 1;
};
export type TrackPartDef = {
  part: string;
  kind: "straight" | "curve" | "switch";
  system: "plastic" | "9V" | "4.5V/12V";
  title: string;
  /** Local Y of the rail heads' top. */
  railTop: number;
  ends: TrackEndDef[];
  segments: TrackSegmentDef[];
  /** Switch route set by the part as placed (its -f1/-f2 formation). */
  defaultRoute?: 0 | 1;
};

const DEG = Math.PI / 180;
/** R40 curve: radius and angle of one piece. */
export const TRACK_RADIUS = 800;
export const CURVE_ANGLE = 22.5 * DEG;
export const STRAIGHT_LENGTH = 320;
export const RAIL_GAUGE = 100;

const straight = (
  part: string,
  system: TrackPartDef["system"],
  title: string,
  railTop: number,
): TrackPartDef => ({
  part,
  kind: "straight",
  system,
  title,
  railTop,
  ends: [
    { position: [-160, 0], direction: [-1, 0] },
    { position: [160, 0], direction: [1, 0] },
  ],
  segments: [
    { ends: [0, 1], prims: [{ kind: "line", from: [-160, 0], to: [160, 0] }] },
  ],
});
const curve = (
  part: string,
  system: TrackPartDef["system"],
  title: string,
  railTop: number,
): TrackPartDef => {
  const h = CURVE_ANGLE / 2,
    x = TRACK_RADIUS * Math.sin(h),
    z = -TRACK_RADIUS * (1 - Math.cos(h));
  return {
    part,
    kind: "curve",
    system,
    title,
    railTop,
    ends: [
      { position: [-x, z], direction: [-Math.cos(h), -Math.sin(h)] },
      { position: [x, z], direction: [Math.cos(h), -Math.sin(h)] },
    ],
    segments: [
      {
        ends: [0, 1],
        prims: [
          {
            kind: "arc",
            center: [0, -TRACK_RADIUS],
            radius: TRACK_RADIUS,
            start: -h,
            sweep: CURVE_ANGLE,
          },
        ],
      },
    ],
  };
};
/** 9V switch; `side` −1 diverges toward −Z (right), +1 toward +Z (left). */
const switchPart = (
  part: string,
  title: string,
  side: 1 | -1,
  defaultRoute: 0 | 1,
): TrackPartDef => {
  // Two R40 arcs: out through a = asin 0.6 (cos 0.8), back to 22.5°.
  const a = Math.asin(0.6),
    R = TRACK_RADIUS,
    s = side;
  const endX = -320 + R * (2 * 0.6 - Math.sin(CURVE_ANGLE)),
    endZ = s * R * (1 + Math.cos(CURVE_ANGLE) - 2 * 0.8);
  return {
    part,
    kind: "switch",
    system: "9V",
    title,
    railTop: -16,
    defaultRoute,
    ends: [
      { position: [-320, 0], direction: [-1, 0] },
      { position: [320, 0], direction: [1, 0] },
      {
        position: [endX, endZ],
        direction: [Math.cos(CURVE_ANGLE), s * Math.sin(CURVE_ANGLE)],
      },
    ],
    segments: [
      {
        ends: [0, 1],
        route: 0,
        prims: [{ kind: "line", from: [-320, 0], to: [320, 0] }],
      },
      {
        ends: [0, 2],
        route: 1,
        prims:
          s === -1
            ? [
                // Centre on the −Z side: φ measured from +Z, sweeping +a.
                {
                  kind: "arc",
                  center: [-320, -R],
                  radius: R,
                  start: 0,
                  sweep: a,
                },
                {
                  kind: "arc",
                  center: [640, 480],
                  radius: R,
                  start: Math.PI + a,
                  sweep: -(a - CURVE_ANGLE),
                },
              ]
            : [
                {
                  kind: "arc",
                  center: [-320, R],
                  radius: R,
                  start: Math.PI,
                  sweep: -a,
                },
                {
                  kind: "arc",
                  center: [640, -480],
                  radius: R,
                  start: -a,
                  sweep: a - CURVE_ANGLE,
                },
              ],
      },
    ],
  };
};

const defs: TrackPartDef[] = [
  straight("53401", "plastic", "Train Track 6 Studs Wide Straight", -16),
  curve("53400", "plastic", "Train Track 6 Studs Wide Curved", -16),
  straight("74746", "9V", "Train Track 9V Straight", -16),
  curve("74747", "9V", "Train Track 9V Curved", -16),
  switchPart("75541-f1", "Train Track 9V Switch Right Straight", -1, 0),
  switchPart("75541-f2", "Train Track 9V Switch Right Branching", -1, 1),
  switchPart(
    "75541c01-f1",
    "Train Track 9V Point Right Straight with Yellow Lever",
    -1,
    0,
  ),
  switchPart(
    "75541c01-f2",
    "Train Track 9V Point Right Branching with Yellow Lever",
    -1,
    1,
  ),
  switchPart("75542-f1", "Train Track 9V Switch Left Straight", 1, 0),
  switchPart("75542-f2", "Train Track 9V Switch Left Branching", 1, 1),
  switchPart(
    "75542c01-f1",
    "Train Track 9V Point Left Straight with Yellow Lever",
    1,
    0,
  ),
  switchPart(
    "75542c01-f2",
    "Train Track 9V Point Left Branching with Yellow Lever",
    1,
    1,
  ),
  straight("3228ac01", "4.5V/12V", "Train Track 4.5V Tapered Straight", 0),
  straight("3228bc01", "4.5V/12V", "Train Track 4.5V Slotted Straight", 0),
  straight("861c01", "4.5V/12V", "Train Track 12V Tapered Straight", 0),
  straight(
    "3240ac01",
    "4.5V/12V",
    "Train Track 12V Slotted Straight (Conductive Centre Rail)",
    0,
  ),
  straight(
    "3240bc01",
    "4.5V/12V",
    "Train Track 12V Slotted Straight (Conductive Centre Rail, Sockets)",
    0,
  ),
  curve("3229ac01", "4.5V/12V", "Train Track 4.5V Curved Tapered", 0),
  curve("3229bc01", "4.5V/12V", "Train Track 4.5V Curved Slotted", 0),
  curve("866c01", "4.5V/12V", "Train Track 12V Curved Tapered", 0),
  curve("3241ac01", "4.5V/12V", "Train Track 12V Slotted Curved", 0),
];
export const TRACK_PARTS: Readonly<Record<string, TrackPartDef>> =
  Object.freeze(Object.fromEntries(defs.map((d) => [d.part, d])));

export const trackPartKey = (ref: string) =>
  ref
    .toLowerCase()
    .replaceAll("\\", "/")
    .replace(/^.*\//, "")
    .replace(/\.dat$/, "");
export const trackPart = (ref: string): TrackPartDef | undefined =>
  TRACK_PARTS[trackPartKey(ref)];

// ---- Local evaluation ------------------------------------------------------

export const primLength = (p: TrackPrim) =>
  p.kind === "line"
    ? Math.hypot(p.to[0] - p.from[0], p.to[1] - p.from[1])
    : p.radius * Math.abs(p.sweep);
export const segmentLength = (s: TrackSegmentDef) =>
  s.prims.reduce((sum, p) => sum + primLength(p), 0);

/** Point and unit tangent (x, z) at arc length `s` along one primitive. */
function primAt(p: TrackPrim, s: number): [number, number, number, number] {
  if (p.kind === "line") {
    const L = primLength(p) || 1,
      dx = (p.to[0] - p.from[0]) / L,
      dz = (p.to[1] - p.from[1]) / L;
    return [p.from[0] + dx * s, p.from[1] + dz * s, dx, dz];
  }
  const sign = Math.sign(p.sweep) || 1,
    phi = p.start + (sign * s) / p.radius;
  return [
    p.center[0] + p.radius * Math.sin(phi),
    p.center[1] + p.radius * Math.cos(phi),
    sign * Math.cos(phi),
    -sign * Math.sin(phi),
  ];
}
/** Local (x, z, tx, tz) at arc length s ∈ [0, length] along a segment. */
export function segmentAt(seg: TrackSegmentDef, s: number) {
  let rest = s;
  for (let i = 0; i < seg.prims.length; i++) {
    const L = primLength(seg.prims[i]);
    if (rest <= L || i === seg.prims.length - 1)
      return primAt(seg.prims[i], Math.max(0, Math.min(L, rest)));
    rest -= L;
  }
  return primAt(seg.prims[0], 0);
}
/** Nearest arc length along a segment to a local (x, z) point. */
function segmentNearest(seg: TrackSegmentDef, x: number, z: number) {
  let best = { s: 0, d: Infinity },
    offset = 0;
  for (const p of seg.prims) {
    const L = primLength(p);
    let s: number;
    if (p.kind === "line") {
      const dx = (p.to[0] - p.from[0]) / (L || 1),
        dz = (p.to[1] - p.from[1]) / (L || 1);
      s = (x - p.from[0]) * dx + (z - p.from[1]) * dz;
    } else {
      const sign = Math.sign(p.sweep) || 1;
      let phi = Math.atan2(x - p.center[0], z - p.center[1]);
      // Unwrap near the arc's middle, then clamp.
      const mid = p.start + p.sweep / 2;
      while (phi - mid > Math.PI) phi -= 2 * Math.PI;
      while (phi - mid < -Math.PI) phi += 2 * Math.PI;
      s = ((phi - p.start) * sign * p.radius) as number;
    }
    s = Math.max(0, Math.min(L, s));
    const q = primAt(p, s),
      d = Math.hypot(q[0] - x, q[1] - z);
    if (d < best.d) best = { s: offset + s, d };
    offset += L;
  }
  return best;
}

// ---- The rail graph of a build --------------------------------------------

export type TrackPiece = {
  occurrenceId: string;
  part: string;
  def: TrackPartDef;
  transform: Transform;
  /** World position and outward direction of each end (rail-top height). */
  ends: Array<{ position: Vec3; direction: Vec3 }>;
  lengths: number[];
  /** Link of each end to another piece's end. */
  links: Array<{ piece: number; end: number } | undefined>;
};
export type TrackGap = {
  a: { occurrenceId: string; end: number };
  b: { occurrenceId: string; end: number };
  /** LDU between the two ends. */
  distance: number;
  /** Degrees off a straight run. */
  angle: number;
};
export type TrackSkip = { occurrenceId: string; part: string; reason: string };
export type TrackGraph = {
  pieces: TrackPiece[];
  /** Ends near another end that do not join. */
  gaps: TrackGap[];
  /** Ends with nothing near: the track stops here. */
  deadEnds: Array<{ occurrenceId: string; end: number; position: Vec3 }>;
  skipped: TrackSkip[];
};
/** Ends join within this distance (LDU), facing each other within ~3°. */
export const TRACK_JOIN_DISTANCE = 3;
export const TRACK_JOIN_COS = -0.9985;
/** Unjoined ends closer than this are reported as gaps. */
export const TRACK_GAP_REPORT = 60;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
/**
 * Upright placement check: local Y must stay world Y (the rails on top) and
 * the basis must be a rotation or a mirror without scale. A mirrored right
 * switch is a left switch, and every centreline follows the mirror.
 */
export function trackPlacementIssue(t: Transform): string | undefined {
  const b = t.basis;
  const cols = [0, 1, 2].map((j) => [b[j], b[3 + j], b[6 + j]] as Vec3);
  // LDraw files round rotations (often to 3–5 decimals): allow for that.
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      if (Math.abs(dot(cols[i], cols[j]) - (i === j ? 1 : 0)) > 0.01)
        return "Scaled or sheared track cannot be followed";
  if (Math.abs(b[4] - 1) > 0.01 || Math.hypot(b[1], b[3], b[5], b[7]) > 0.01)
    return "Track must lie flat with its rails on top";
  return undefined;
}
/**
 * The exact rotation (or mirror) about Y nearest an upright placement:
 * rounding in the file would otherwise bend the centreline by up to a few
 * tenths of an LDU across a switch.
 */
export function uprightTransform(t: Transform): Transform {
  const b = t.basis;
  const l = Math.hypot(b[0], b[6]) || 1,
    c = b[0] / l,
    s = -b[6] / l;
  // det < 0: the file mirrors the part (local Z flipped).
  const m = b[0] * b[8] - b[2] * b[6] < 0 ? -1 : 1;
  return {
    position: [...t.position],
    basis: [c, 0, m * s, 0, 1, 0, -s, 0, m * c],
  };
}
export function worldPoint(piece: TrackPiece, x: number, z: number): Vec3 {
  return add(
    piece.transform.position,
    mv(piece.transform.basis, [x, piece.def.railTop, z]),
  );
}
export function worldDirection(
  piece: TrackPiece,
  tx: number,
  tz: number,
): Vec3 {
  return norm(mv(piece.transform.basis, [tx, 0, tz]));
}

/**
 * Build the rail graph of placed track occurrences. Ends of different
 * pieces join when they meet within TRACK_JOIN_DISTANCE facing each other.
 */
export function buildTrackGraph(
  occurrences: ReadonlyArray<{
    id: string;
    ref: string;
    transform: Transform;
  }>,
): TrackGraph {
  const pieces: TrackPiece[] = [],
    skipped: TrackSkip[] = [];
  for (const o of occurrences) {
    const def = trackPart(o.ref);
    if (!def) continue;
    const issue = trackPlacementIssue(o.transform);
    if (issue) {
      skipped.push({ occurrenceId: o.id, part: def.part, reason: issue });
      continue;
    }
    const piece: TrackPiece = {
      occurrenceId: o.id,
      part: def.part,
      def,
      transform: uprightTransform(o.transform),
      ends: [],
      lengths: def.segments.map(segmentLength),
      links: [],
    };
    piece.ends = def.ends.map((e) => ({
      position: worldPoint(piece, e.position[0], e.position[1]),
      direction: worldDirection(piece, e.direction[0], e.direction[1]),
    }));
    piece.links = def.ends.map(() => undefined);
    pieces.push(piece);
  }
  // Spatial hash of ends.
  const CELL = 64,
    grid = new Map<string, Array<[number, number]>>();
  const key = (p: Vec3) =>
    `${Math.floor(p[0] / CELL)},${Math.floor(p[2] / CELL)}`;
  pieces.forEach((piece, i) =>
    piece.ends.forEach((end, e) => {
      const k = key(end.position),
        list = grid.get(k) ?? [];
      list.push([i, e]);
      grid.set(k, list);
    }),
  );
  const near = (p: Vec3) => {
    const cx = Math.floor(p[0] / CELL),
      cz = Math.floor(p[2] / CELL),
      out: Array<[number, number]> = [];
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++)
        out.push(...(grid.get(`${cx + dx},${cz + dz}`) ?? []));
    return out;
  };
  const candidates: Array<{
    d: number;
    a: [number, number];
    b: [number, number];
  }> = [];
  pieces.forEach((piece, i) =>
    piece.ends.forEach((end, e) => {
      for (const [j, f] of near(end.position)) {
        if (j <= i) continue;
        const other = pieces[j].ends[f],
          d = Math.hypot(...sub(end.position, other.position));
        if (
          d <= TRACK_JOIN_DISTANCE &&
          dot(end.direction, other.direction) <= TRACK_JOIN_COS
        )
          candidates.push({ d, a: [i, e], b: [j, f] });
      }
    }),
  );
  // Closest pairs first; each end joins at most once.
  candidates.sort(
    (x, y) =>
      x.d - y.d || x.a[0] - y.a[0] || x.a[1] - y.a[1] || x.b[0] - y.b[0],
  );
  for (const c of candidates) {
    const [i, e] = c.a,
      [j, f] = c.b;
    if (pieces[i].links[e] || pieces[j].links[f]) continue;
    pieces[i].links[e] = { piece: j, end: f };
    pieces[j].links[f] = { piece: i, end: e };
  }
  const gaps: TrackGap[] = [],
    deadEnds: TrackGraph["deadEnds"] = [];
  pieces.forEach((piece, i) =>
    piece.ends.forEach((end, e) => {
      if (piece.links[e]) return;
      let best: { j: number; f: number; d: number } | undefined;
      for (const [j, f] of near(end.position)) {
        if (j === i || pieces[j].links[f]) continue;
        const d = Math.hypot(...sub(end.position, pieces[j].ends[f].position));
        if (d <= TRACK_GAP_REPORT && (!best || d < best.d)) best = { j, f, d };
      }
      if (best) {
        if (best.j > i || (best.j === i && best.f > e))
          gaps.push({
            a: { occurrenceId: piece.occurrenceId, end: e },
            b: { occurrenceId: pieces[best.j].occurrenceId, end: best.f },
            distance: Math.round(best.d * 100) / 100,
            angle:
              Math.round(
                (Math.acos(
                  Math.max(
                    -1,
                    Math.min(
                      1,
                      -dot(
                        end.direction,
                        pieces[best.j].ends[best.f].direction,
                      ),
                    ),
                  ),
                ) /
                  DEG) *
                  100,
              ) / 100,
          });
      } else
        deadEnds.push({
          occurrenceId: piece.occurrenceId,
          end: e,
          position: [...end.position],
        });
    }),
  );
  return { pieces, gaps, deadEnds, skipped };
}

/** Local position and tangent of `s` along segment `seg` of a piece. */
export function pieceAt(
  piece: TrackPiece,
  seg: number,
  s: number,
): { position: Vec3; tangent: Vec3 } {
  const [x, z, tx, tz] = segmentAt(piece.def.segments[seg], s);
  return {
    position: worldPoint(piece, x, z),
    tangent: worldDirection(piece, tx, tz),
  };
}

export type TrackProjection = {
  piece: number;
  segment: number;
  /** Arc length along the segment from its ends[0]. */
  s: number;
  /** Horizontal distance from the centreline, LDU. */
  lateral: number;
  /** World Y of the rail tops there. */
  railY: number;
};
/**
 * Nearest centreline point to a world point, over every segment (both
 * routes of a switch). `prefer` breaks ties toward a switch's set route.
 */
export function projectOnTrack(
  graph: TrackGraph,
  point: Vec3,
  maxLateral = 80,
  routeOf?: (piece: number) => 0 | 1,
): TrackProjection | undefined {
  let best: TrackProjection | undefined;
  graph.pieces.forEach((piece, i) => {
    // Cheap reject: farther than any centreline of this piece can be.
    const centre = piece.transform.position,
      reach = 420 + maxLateral;
    if (
      Math.abs(point[0] - centre[0]) > reach ||
      Math.abs(point[2] - centre[2]) > reach
    )
      return;
    const inv = inverse(piece.transform),
      local = add(inv.position, mv(inv.basis, point));
    piece.def.segments.forEach((seg, j) => {
      const hit = segmentNearest(seg, local[0], local[2]);
      if (hit.d > maxLateral) return;
      const preferred =
        seg.route === undefined || !routeOf || routeOf(i) === seg.route;
      const score = hit.d - (preferred ? 0.01 : 0);
      const bestScore = best
        ? best.lateral -
          (graph.pieces[best.piece].def.segments[best.segment].route ===
            undefined ||
          !routeOf ||
          routeOf(best.piece) ===
            graph.pieces[best.piece].def.segments[best.segment].route
            ? 0.01
            : 0)
        : Infinity;
      if (score < bestScore - 1e-9) {
        const at = pieceAt(piece, j, hit.s);
        best = {
          piece: i,
          segment: j,
          s: hit.s,
          lateral: hit.d,
          railY: at.position[1],
        };
      }
    });
  });
  return best;
}

// ---- Routes: the directed path a train follows ----------------------------

/** One segment of one piece, travelled from ends[0] (forward) or ends[1]. */
export type Traversal = {
  piece: number;
  segment: number;
  forward: boolean;
  length: number;
};
export const entryEnd = (graph: TrackGraph, t: Traversal) =>
  graph.pieces[t.piece].def.segments[t.segment].ends[t.forward ? 0 : 1];
export const exitEnd = (graph: TrackGraph, t: Traversal) =>
  graph.pieces[t.piece].def.segments[t.segment].ends[t.forward ? 1 : 0];
/** World point and travel tangent `s` along a traversal. */
export function traversalAt(graph: TrackGraph, t: Traversal, s: number) {
  const piece = graph.pieces[t.piece],
    at = pieceAt(piece, t.segment, t.forward ? s : t.length - s);
  if (!t.forward) at.tangent = at.tangent.map((v) => -v) as Vec3;
  return at;
}
/**
 * The segments a train can take entering `piece` at `end` (as a traversal
 * starting there). Facing a switch, `route` picks one.
 */
export function enter(
  graph: TrackGraph,
  piece: number,
  end: number,
  route: 0 | 1 = 0,
): Traversal | undefined {
  const p = graph.pieces[piece];
  const options = p.def.segments
    .map((seg, i) => ({ seg, i }))
    .filter(({ seg }) => seg.ends[0] === end || seg.ends[1] === end);
  if (!options.length) return undefined;
  const pick =
    options.length === 1
      ? options[0]
      : (options.find(({ seg }) => seg.route === route) ?? options[0]);
  return {
    piece,
    segment: pick.i,
    forward: pick.seg.ends[0] === end,
    length: p.lengths[pick.i],
  };
}
export const reverseTraversal = (t: Traversal): Traversal => ({
  ...t,
  forward: !t.forward,
});
export const norm3 = norm;

// ---- Laying track ----------------------------------------------------------

/** A rail-top point and a unit travel direction (x, z) on it. */
export type TrackCursor = { position: Vec3; direction: [number, number] };
/**
 * Place a track part so its end `inEnd` meets `cursor` (the part continues
 * the way the cursor points). Returns the part's transform and every end as
 * a cursor pointing out of the part: continue from `ends[outEnd]`.
 */
export function placeTrackPiece(
  part: string,
  cursor: TrackCursor,
  inEnd = 0,
): { transform: Transform; ends: TrackCursor[] } {
  const def = trackPart(part);
  if (!def) throw new Error("Not a supported track part: " + part);
  const e = def.ends[inEnd];
  // Rotation about Y, LDraw rotationY(φ): (x, z) → (c·x + s·z, −s·x + c·z),
  // i.e. a turn by −φ; the in-end must face back along the cursor.
  const angle = (x: number, z: number) => Math.atan2(z, x);
  const phi =
    angle(e.direction[0], e.direction[1]) -
    angle(-cursor.direction[0], -cursor.direction[1]);
  const c = Math.cos(phi),
    s = Math.sin(phi);
  const clean = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);
  const basis = [
    clean(c),
    0,
    clean(s),
    0,
    1,
    0,
    clean(-s),
    0,
    clean(c),
  ] as Transform["basis"];
  const rotate = (x: number, z: number): [number, number] => [
    c * x + s * z,
    -s * x + c * z,
  ];
  const [ex, ez] = rotate(e.position[0], e.position[1]);
  const position: Vec3 = [
    cursor.position[0] - ex,
    cursor.position[1] - def.railTop,
    cursor.position[2] - ez,
  ];
  return {
    transform: { position, basis },
    ends: def.ends.map((end) => {
      const [x, z] = rotate(end.position[0], end.position[1]),
        [dx, dz] = rotate(end.direction[0], end.direction[1]);
      const l = Math.hypot(dx, dz) || 1;
      return {
        position: [
          position[0] + x,
          cursor.position[1],
          position[2] + z,
        ] as Vec3,
        direction: [dx / l, dz / l] as [number, number],
      };
    }),
  };
}
