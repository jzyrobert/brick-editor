import { Vector3 } from "three";
import { ensure, type Vec3 } from "../core/types";
import {
  isSourceBoundWinchCollision,
  type SourceBoundWinchCollision,
} from "./winch-collision";

type Point = Readonly<Vec3>;
type Owner = SourceBoundWinchCollision["owners"][number];
const dot = (a: Point, b: Point) => a.reduce((s, n, i) => s + n * b[i], 0);
const sub = (a: Point, b: Point) => a.map((n, i) => n - b[i]) as Vec3;
const area = (a: Point, b: Point, c: Point) =>
  new Vector3(...sub(b, a)).cross(new Vector3(...sub(c, a))).length() / 2;
const key = (p: Point) => p.join(",");
export type WinchSurfaceBand = Readonly<{
  occurrenceId: string;
  /** Original source-basis coordinates centered on the owner's source origin. */
  points: readonly Point[];
  triangles: readonly number[];
  /** Each output triangle retains its original oriented source face index. */
  sourceFaces: readonly number[];
  spanLdu: readonly [number, number];
  /** Merely geometric interval candidates, NEVER a contact exemption. */
  bearingCandidates: readonly number[];
}>;
export type WinchSurfaceBands = Readonly<{
  packet: SourceBoundWinchCollision;
  shafts: readonly Readonly<{
    occurrenceId: string;
    bands: readonly WinchSurfaceBand[];
    sourceTriangles: number;
    outputTriangles: number;
    maxFaceAreaErrorLdu2: number;
    maxSourcePlaneErrorLdu: number;
  }>[];
  ordinaryAdmission: false;
}>;
const seals = new WeakSet<WinchSurfaceBands>();
export const isWinchSurfaceBands = (
  value: unknown,
): value is WinchSurfaceBands =>
  !!value && typeof value === "object" && seals.has(value as WinchSurfaceBands);

/** Split literal triangles, not solids. No virtual endcaps, added hulls, deleted
 * tiny faces, widened cuts or dropped intervals. Exact shared edge/cut identity
 * ensures adjacent original triangles use the same intersection coordinate. */
function splitOwner(
  owner: Owner,
  origin: Point,
  axis: Point,
  cuts: number[],
  intervals: { index: number; lo: number; hi: number }[],
) {
  ensure(
    owner.regions.length === 1 && owner.regions[0].kind === "source-trimesh",
    "INVALID_INPUT",
    "Band only a complete literal source shaft mesh.",
  );
  const region = owner.regions[0],
    points = region.points,
    indices = region.triangles!,
    station = (p: Point) => dot(sub(p, origin), axis),
    min = Math.min(...points.map(station)),
    max = Math.max(...points.map(station));
  cuts = [...new Set(cuts)]
    .filter((c) => c > min && c < max)
    .sort((a, b) => a - b);
  ensure(
    cuts.length <= 64,
    "RESOURCE_LIMIT",
    "Winch source band event limit exceeded.",
  );
  const boundaries = [min, ...cuts, max],
    bands = boundaries.slice(0, -1).map((lo, i) => ({
      occurrenceId: owner.occurrenceId,
      points: [] as Point[],
      triangles: [] as number[],
      sourceFaces: [] as number[],
      spanLdu: [lo, boundaries[i + 1]] as [number, number],
      bearingCandidates: intervals
        .filter((s) => lo >= s.lo && boundaries[i + 1] <= s.hi)
        .map((s) => s.index),
    })),
    intersections = new Map<string, Point>();
  // Each polygon vertex carries an original edge identity. New cut segments
  // are constant in station and cannot cross a later ordered cut.
  type Vertex = { p: Point; edges: readonly string[] };
  const originalEdges = new Map<string, readonly [Point, Point]>();
  let maxFaceAreaErrorLdu2 = 0,
    maxSourcePlaneErrorLdu = 0,
    outputTriangles = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const source = [
        points[indices[t]],
        points[indices[t + 1]],
        points[indices[t + 2]],
      ],
      edges = source.map((a, i) => {
        const b = source[(i + 1) % 3],
          id = [key(a), key(b)].sort().join(";");
        if (!originalEdges.has(id))
          originalEdges.set(id, key(a) < key(b) ? [a, b] : [b, a]);
        return id;
      });
    let remaining: Vertex[] = source.map((p, i) => ({
        p,
        edges: [edges[i], edges[(i + 2) % 3]],
      })),
      sumArea = 0;
    const normal = new Vector3(...sub(source[1], source[0])).cross(
        new Vector3(...sub(source[2], source[0])),
      ),
      length = normal.length();
    if (length) normal.multiplyScalar(1 / length);
    const emit = (polygon: Vertex[], band: number) => {
      if (polygon.length < 3) return;
      const out = bands[band];
      for (let j = 1; j + 1 < polygon.length; j++) {
        const triangle = [polygon[0].p, polygon[j].p, polygon[j + 1].p];
        sumArea += area(...(triangle as [Point, Point, Point]));
        for (const p of triangle) {
          maxSourcePlaneErrorLdu = Math.max(
            maxSourcePlaneErrorLdu,
            Math.abs(normal.dot(new Vector3(...sub(p, source[0])))),
          );
          out.triangles.push(out.points.length);
          out.points.push(p);
        }
        out.sourceFaces.push(t / 3);
        outputTriangles++;
      }
    };
    for (let c = 0; c < cuts.length && remaining.length; c++) {
      const cut = cuts[c],
        stations = remaining.map((v) => station(v.p)),
        lo = Math.min(...stations),
        hi = Math.max(...stations);
      if (lo >= cut) continue; // Coplanar source faces belong to the upper band.
      if (hi <= cut) {
        emit(remaining, c);
        remaining = [];
        break;
      }
      const lower: Vertex[] = [],
        upper: Vertex[] = [];
      for (let j = 0; j < remaining.length; j++) {
        const a = remaining[j],
          b = remaining[(j + 1) % remaining.length],
          da = station(a.p) - cut,
          db = station(b.p) - cut;
        if (da <= 0) lower.push(a);
        if (da >= 0) upper.push(a);
        if (da * db < 0) {
          const shared = a.edges.find((e) => b.edges.includes(e));
          ensure(
            shared,
            "INVALID_INPUT",
            "Lost original source edge ancestry.",
          );
          const id = shared + "@" + cut;
          let p = intersections.get(id);
          if (!p) {
            const [x, y] = originalEdges.get(shared)!,
              sx = station(x),
              sy = station(y),
              fraction = (cut - sx) / (sy - sx);
            p = Object.freeze(
              x.map((n, k) => n + fraction * (y[k] - n)),
            ) as unknown as Point;
            intersections.set(id, p);
          }
          const v = { p, edges: [shared] };
          lower.push(v);
          upper.push(v);
        }
      }
      emit(lower, c);
      remaining = upper;
    }
    emit(remaining, cuts.length);
    maxFaceAreaErrorLdu2 = Math.max(
      maxFaceAreaErrorLdu2,
      Math.abs(sumArea - area(...(source as [Point, Point, Point]))),
    );
  }
  // These measured F64 serialization bounds never authorize omitted faces.
  ensure(
    maxFaceAreaErrorLdu2 <= 1e-8 && maxSourcePlaneErrorLdu <= 1e-9,
    "INVALID_INPUT",
    "Source triangle splitting exceeds its finite rounding scope.",
  );
  return Object.freeze({
    occurrenceId: owner.occurrenceId,
    bands: Object.freeze(
      bands
        .filter((b) => b.triangles.length)
        .map((b) =>
          Object.freeze({
            ...b,
            points: Object.freeze(b.points),
            triangles: Object.freeze(b.triangles),
            sourceFaces: Object.freeze(b.sourceFaces),
            spanLdu: Object.freeze(b.spanLdu),
            bearingCandidates: Object.freeze(b.bearingCandidates),
          }),
        ),
    ),
    sourceTriangles: indices.length / 3,
    outputTriangles,
    maxFaceAreaErrorLdu2,
    maxSourcePlaneErrorLdu,
  });
}

/** Partition every real shaft/pin surface at the actual source chamber ends.
 * Bearing candidates still need keyed negative-column/current/predicted scope.
 * Joiner dividers, collars, heads and foreign contacts are never exempt here. */
export function winchSurfaceBands(
  packet: SourceBoundWinchCollision,
): WinchSurfaceBands {
  ensure(
    isSourceBoundWinchCollision(packet),
    "INVALID_INPUT",
    "Use the sealed actual-source winch packet.",
  );
  const shafts = [
    ...new Set(packet.plan.bearings.map((b) => b.shaft.occurrenceId)),
  ].map((id) => {
    const owner = packet.owners.find((o) => o.occurrenceId === id)!,
      port = packet.plan.bearings.find(
        (b) => b.shaft.occurrenceId === id,
      )!.shaft,
      origin = sub(port.center, owner.frame.position),
      axis = port.axis,
      intervals = packet.plan.bearings.flatMap((b, index) => {
        if (b.shaft.occurrenceId !== id) return [];
        const center = dot(sub(b.bore.center, port.center), axis),
          sign = dot(b.bore.axis, axis),
          span = b.bore.spanLdu
            .map((s) => center + s * sign)
            .sort((a, b) => a - b);
        return [{ index, lo: span[0], hi: span[1] }];
      });
    return splitOwner(
      owner,
      origin,
      axis,
      intervals.flatMap((i) => [i.lo, i.hi]),
      intervals,
    );
  });
  const result = Object.freeze({
    packet,
    shafts: Object.freeze(shafts),
    ordinaryAdmission: false as const,
  });
  seals.add(result);
  return result;
}
