// Track pieces snap end to end ("rail ends"): a track part placed near a
// free end of the placed track is offered at every way one of its own ends
// meets it, as the official pieces join (docs/PLAY-TRAINS.md). Rail ends
// are derived from the pinned centreline table (src/play/track.ts), not from
// studs: two ends join when they meet within TRACK_JOIN_DISTANCE facing
// each other.
import type { Basis, Transform, Vec3 } from "../core/types";
import {
  buildTrackGraph,
  placeTrackPiece,
  projectOnTrack,
  segmentAt,
  trackPart,
  worldPoint,
} from "../play/track";
import type { Occupant, SnapCandidate } from "./snap";

/** A free rail end counts for a tap within this distance (LDU). */
export const RAIL_END_REACH = 240;
/** A new piece may not run along existing track closer than this. */
const OVERLAP_LATERAL = 60;

type TrackOccurrence = { id: string; ref: string; transform: Transform };
const tidy = (m: Basis) =>
  m.map((n) => Math.round(n * 1e9) / 1e9 || 0) as Basis;
const round = (v: Vec3) => v.map((n) => Math.round(n * 1e6) / 1e6 || 0) as Vec3;

/** Placed track (visible, official) from scene occupants. */
export function sceneTrack(occupants: readonly Occupant[]): TrackOccurrence[] {
  return occupants
    .filter((o) => o.ref && trackPart(o.ref))
    .map((o) => ({ id: o.occurrenceId, ref: o.ref!, transform: o.transform }));
}

/**
 * Pieces of existing track the new piece would join at its ends, and whether
 * it would lie along existing track instead (on top of another piece).
 */
export function trackJoins(
  ref: string,
  transform: Transform,
  track: readonly TrackOccurrence[],
): { joined: string[]; overlaps: boolean } {
  const graph = buildTrackGraph([
    ...track,
    { id: "\u0000new", ref, transform },
  ]);
  const i = graph.pieces.findIndex((p) => p.occurrenceId === "\u0000new");
  if (i < 0) return { joined: [], overlaps: false };
  const piece = graph.pieces[i];
  const joined = [
    ...new Set(
      piece.links
        .filter((l): l is NonNullable<typeof l> => !!l)
        .map((l) => graph.pieces[l.piece].occurrenceId),
    ),
  ];
  // Sample the new centrelines away from the ends: if any runs on existing
  // track, the piece would sit on it.
  const others = {
    ...graph,
    pieces: graph.pieces.filter((_, j) => j !== i),
  };
  let overlaps = false;
  for (const seg of piece.def.segments) {
    const L = piece.lengths[piece.def.segments.indexOf(seg)];
    for (const f of [0.3, 0.5, 0.7]) {
      const [x, z] = segmentAt(seg, L * f);
      const p = worldPoint(piece, x, z);
      const hit = projectOnTrack(others, p, OVERLAP_LATERAL);
      if (hit && Math.abs(hit.railY - p[1]) < 8) overlaps = true;
    }
  }
  return { joined, overlaps };
}

/**
 * Fits for a track part tapped near the placed track: each free rail end
 * within reach of the tap, met by each end of the new part (so a curve is
 * offered bending either way, and a switch from its common or its other
 * ends). Nearest rail end first; fits that would lie on existing track are
 * left out.
 */
export function trackCandidates(
  ref: string,
  tap: { point: Vec3 },
  occupants: readonly Occupant[],
): SnapCandidate[] {
  const def = trackPart(ref);
  if (!def) return [];
  const track = sceneTrack(occupants);
  if (!track.length) return [];
  const graph = buildTrackGraph(track);
  const out: SnapCandidate[] = [];
  const seen = new Set<string>();
  graph.pieces.forEach((piece) =>
    piece.ends.forEach((end, e) => {
      if (piece.links[e]) return;
      const distance = Math.hypot(
        end.position[0] - tap.point[0],
        end.position[2] - tap.point[2],
      );
      if (distance > RAIL_END_REACH) return;
      def.ends.forEach((_, k) => {
        const placed = placeTrackPiece(
          ref,
          {
            position: end.position,
            direction: [end.direction[0], end.direction[2]],
          },
          k,
        );
        const transform = {
          position: round(placed.transform.position),
          basis: tidy(placed.transform.basis),
        };
        // The same track either way round (a straight turned end for end)
        // is one fit: key by where its ends lie.
        const key = placed.ends
          .map((c) => c.position.map((v) => Math.round(v)).join(","))
          .sort()
          .join("|");
        if (seen.has(key)) return;
        seen.add(key);
        const { joined, overlaps } = trackJoins(ref, transform, track);
        if (overlaps || !joined.length) return;
        out.push({
          position: transform.position,
          basis: transform.basis,
          contacts: joined.length,
          targetIds: joined,
          // Nearest end first; then the new part's own end order.
          distance: distance + k * 1e-3,
        });
      });
    }),
  );
  return out.sort((a, b) => a.distance - b.distance).slice(0, 12);
}
