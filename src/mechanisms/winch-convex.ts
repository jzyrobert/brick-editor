import { ShapeUtils, Vector2 } from "three";
import { add, mv } from "../core/math";
import { ensure, type Transform, type Vec3 } from "../core/types";
import {
  retainedWinchGeometrySources,
  type RetainedWinchBinding,
} from "./retained-winch";

/** Finite all-source-face clipping evidence uses this normal-plane envelope.
 * It is not a boundary Hausdorff or general material/topology theorem. */
export const WINCH_SOURCE_PLANE_ENVELOPE_LDU = 0.00035;

export type WinchConvexRegion = Readonly<{
  points: readonly Vec3[];
  contactClass: "core" | "tooth";
  source: string;
}>;
const lines = (text: string, type: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter((words) => words[0] === type);
const point = (words: string[], index: number): Vec3 =>
  words.slice(index, index + 3).map(Number) as Vec3;
const key = (p: readonly number[]) => p.join(",");
const unique = (points: readonly Vec3[]) => [
  ...new Map(points.map((p) => [key(p), p])).values(),
];
const prism = (polygon: readonly Vec3[], lo: number, hi: number) =>
  polygon.flatMap(
    ([x, y]) =>
      [
        [x, y, lo],
        [x, y, hi],
      ] as Vec3[],
  );
const quarter = ([x, y, z]: Vec3, k: number): Vec3 =>
  [
    [x, y, z],
    [-y, x, z],
    [-x, -y, z],
    [y, -x, z],
  ][k] as Vec3;
/** Clip a convex pointset by the ORIGINAL source end planes. Every new point is
 * a segment/plane intersection inside the original convex set. No thickness,
 * gap, positive interval or small-volume cutoff is used. */
function zClip(points: readonly Vec3[], plane: number, below: boolean): Vec3[] {
  const inside = (p: Vec3) => (below ? p[2] <= plane : p[2] >= plane);
  const out = points.filter(inside);
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i],
        b = points[j];
      if (inside(a) === inside(b) || a[2] === b[2]) continue;
      const t = (plane - a[2]) / (b[2] - a[2]);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), plane]);
    }
  return unique(out);
}
function bore(sources: Readonly<Record<string, string>>) {
  // axl5hol8 is the actual24-sided concave rounded keyed perimeter, extruded
  // by the root axlehole primitive. Preserve its indentations and openings.
  const vertices = unique(
    lines(sources["axl5hol8.dat"], "4")
      .flatMap((words) => [2, 5, 8, 11].map((i) => point(words, i)))
      .filter((p) => p[1] === 0)
      .map(([x, , z]) => [x, z, 0] as Vec3),
  );
  ensure(
    vertices.length === 24,
    "INVALID_INPUT",
    "Rounded keyed bore source changed.",
  );
  return vertices.sort(
    (a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]),
  );
}
function annulus(
  outer: Vec3[],
  inner: Vec3[],
  lo: number,
  hi: number,
  source: string,
): WinchConvexRegion[] {
  const points = [...outer, ...inner];
  return ShapeUtils.triangulateShape(
    outer.map(([x, y]) => new Vector2(x, y)),
    [inner.map(([x, y]) => new Vector2(x, y))],
  ).map((indices) => ({
    points: prism(
      indices.map((i) => points[i]),
      lo,
      hi,
    ),
    contactClass: "core",
    source,
  }));
}
const profiles = new WeakMap<
  RetainedWinchBinding,
  Map<string, readonly WinchConvexRegion[]>
>();
/** Source-backed convex candidates for the literal4716/10928 bodies. Thread
 * cells retain actual authored lower/upper flank diagonals and lead. The worm
 * reconciles authored root/crest decimal alternatives: root changes are at
 * most0.000141422LDU; scaled crest changes are at most0.000326LDU. Native
 * rounding is additional; the finite source-face normal-plane audit is separate.
 * This is a reviewed profile constructor, not automatic Play admission. */
export function winchConvexRegions(
  binding: RetainedWinchBinding,
  ref: "4716.dat" | "10928.dat",
): readonly WinchConvexRegion[] {
  let cached = profiles.get(binding);
  if (!cached) {
    cached = new Map();
    profiles.set(binding, cached);
  }
  if (cached.has(ref)) return cached.get(ref)!;
  const sources = retainedWinchGeometrySources(binding),
    inner = bore(sources);
  const regions: WinchConvexRegion[] = [];
  if (ref === "4716.dat") {
    const triangles = lines(sources["s/4716s01.dat"], "3");
    ensure(
      triangles.length === 8,
      "INVALID_INPUT",
      "Actual worm flank source changed.",
    );
    const root: Vec3[] = [],
      crest: Vec3[] = [];
    for (let j = 0; j < 4; j++) {
      const a = triangles[2 * j],
        b = triangles[2 * j + 1];
      root.push(point(a, 2));
      crest.push(point(b, 5));
      if (j === 3) {
        root.push(point(a, 5));
        crest.push(point(a, 8));
      }
    }
    const outer = Array.from({ length: 4 }, (_, k) =>
      root.slice(0, 4).map((p) => quarter([p[0], p[1], 0], k)),
    ).flat();
    regions.push(
      ...annulus(
        outer,
        inner,
        -20,
        20,
        "4716/axlehole + source root perimeter",
      ),
    );
    for (let k = 0; k < 4; k++)
      for (let j = 0; j < 4; j++)
        for (let period = -3; period <= 3; period++) {
          const dz = 2 * k + 8 * period;
          const points = [j, j + 1].flatMap((index) => {
            const r = quarter(root[index], k),
              c = quarter(crest[index], k);
            return [
              [r[0], r[1], r[2] + dz],
              [c[0], c[1], c[2] + dz],
              [c[0], c[1], c[2] + dz + 2],
              [r[0], r[1], r[2] + dz + 6],
            ] as Vec3[];
          });
          const clipped = zClip(zClip(points, -20, false), 20, true);
          if (!clipped.length) continue;
          // Plane-only contact support at an end is already retained in the
          // neighbouring positive cell/cap; this is not a positive-volume cutoff.
          if (clipped.every((p) => p[2] === clipped[0][2])) continue;
          regions.push({
            points: clipped,
            contactClass: "tooth",
            source: `4716s01 sector${k}:${j}:${period}, clipped at source ends`,
          });
        }
  } else {
    // Source4-4cyli is a16-sided cylinder; preserve that polygon, not a smooth
    // circle or outer whole-part hull which would fill the keyed cavity.
    const edge = lines(sources["4-4edge.dat"], "2");
    const outer = unique(
      edge
        .flatMap((w) => [point(w, 2), point(w, 5)])
        .map(([x, , z]) => [7.5 * x, 7.5 * z, 0] as Vec3),
    ).sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
    ensure(
      outer.length === 16,
      "INVALID_INPUT",
      "Actual gear root source changed.",
    );
    // The literal root cylinder is part of tooth contact too: 4716's
    //12.7 addendum reaches the wheel's7.5 root at a20LDU centre seat.
    // Split the unchanged annulus at radius7; the inner keyed hub stays core.
    // This is a contact partition, not a change of either outer boundary.
    const hub = outer.map(
      ([x, y]) => [(x * 7) / 7.5, (y * 7) / 7.5, 0] as Vec3,
    );
    regions.push(...annulus(hub, inner, -10, 10, "10928 keyed hub"));
    for (let i = 0; i < outer.length; i++) {
      const j = (i + 1) % outer.length;
      regions.push({
        points: prism([hub[i], outer[i], outer[j], hub[j]], -10, 10),
        contactClass: "tooth",
        source: "10928 literal root cylinder, outer contact band",
      });
    }
    const teeth = lines(sources["10928.dat"], "1").filter(
      (w) => w[14] === "tooth8a.dat",
    );
    ensure(
      teeth.length === 8,
      "INVALID_INPUT",
      "Actual eight-tooth source changed.",
    );
    const root: Vec3[] = [
      [-1.5, 2.1, 0],
      [1.5, 2.1, 0],
      [1.35, 0.232, 0],
      [0, 0.5, 0],
      [-1.35, 0.232, 0],
    ];
    const rootTriangles = ShapeUtils.triangulateShape(
      root.map(([x, y]) => new Vector2(x, y)),
      [],
    );
    for (const words of teeth) {
      const t: Transform = {
        position: point(words, 2),
        basis: words.slice(5, 14).map(Number) as Transform["basis"],
      };
      const apply = (points: readonly Vec3[]) =>
        points.map((p) => add(t.position, mv(t.basis, p)));
      const parts = [
        prism(
          [
            [-1.5, 3.4, 0],
            [1.5, 3.4, 0],
            [0.7, 5.43, 0],
            [-0.7, 5.43, 0],
          ],
          -4.75,
          4.75,
        ),
        prism(
          [
            [-1.5, 2.1, 0],
            [1.5, 2.1, 0],
            [1.5, 3.4, 0],
            [-1.5, 3.4, 0],
          ],
          -4.75,
          4.75,
        ),
        ...rootTriangles.map((indices) =>
          prism(
            indices.map((i) => root[i]),
            -9.8,
            9.8,
          ),
        ),
      ];
      parts.forEach((points, i) =>
        regions.push({
          points: apply(points),
          contactClass: "tooth",
          source: `10928/tooth8a literal nose/base/root${i}`,
        }),
      );
    }
  }
  ensure(
    regions.length <= 256 &&
      regions.every(
        (r) =>
          r.points.length <= 256 &&
          r.points.every((p) => p.every(Number.isFinite)),
      ),
    "RESOURCE_LIMIT",
    "Winch convex profile exceeds existing native limits.",
  );
  const result = Object.freeze(
    regions.map((r) =>
      Object.freeze({
        ...r,
        points: Object.freeze(
          r.points.map((p) => Object.freeze(p) as unknown as Vec3),
        ),
      }),
    ),
  );
  cached.set(ref, result);
  return result;
}
