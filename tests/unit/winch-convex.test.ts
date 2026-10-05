import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { ShapeUtils, Vector2, Vector3 } from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import {
  bindRetainedWinchSources,
  type RetainedWinchBinding,
} from "../../src/mechanisms/retained-winch";
import {
  winchConvexRegions,
  WINCH_SOURCE_PLANE_ENVELOPE_LDU,
} from "../../src/mechanisms/winch-convex";
import { memberLocalOf } from "../helpers/play-dynamic-source";
const project = importLDraw(
  readFileSync("fixtures/ldraw/technic/42042-retained-winch.ldr", "utf8"),
);
type Point = readonly number[];
type Plane = { n: Point; d: number };
const dot = (a: Point, b: Point) => a.reduce((s, n, i) => s + n * b[i], 0);
const sub = (a: Point, b: Point) => a.map((n, i) => n - b[i]);
function split(polygon: Point[], plane: Plane) {
  const sides: Point[][] = [[], []];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length],
      da = dot(a, plane.n) - plane.d,
      db = dot(b, plane.n) - plane.d;
    if (da <= 0) sides[0].push(a);
    if (da >= 0) sides[1].push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db),
        p = a.map((n, j) => n + t * (b[j] - n));
      sides[0].push(p);
      sides[1].push(p);
    }
  }
  return sides;
}
function area(p: Point[]) {
  let result = 0;
  for (let i = 1; i + 1 < p.length; i++)
    result +=
      new Vector3(...sub(p[i], p[0]))
        .cross(new Vector3(...sub(p[i + 1], p[0])))
        .length() / 2;
  return result;
}
let sources: Record<string, string>, binding: RetainedWinchBinding;
beforeAll(async () => {
  registerFullLibraryFromDisk();
  sources = fullLibrarySources(occurrences(project).map((o) => o.node.ref));
  binding = await bindRetainedWinchSources(sources, project);
});
describe("literal convex worm and gear profiles", () => {
  it.each(["4716.dat", "10928.dat"] as const)(
    "clips every actual%s source triangle against the whole candidate union, within the declared plane envelope",
    async (ref) => {
      const regions = winchConvexRegions(binding, ref);
      expect(regions).toHaveLength(ref === "4716.dat" ? 132 : 96);
      const planes = regions.map((r) => {
        const hull = new ConvexGeometry(r.points.map((p) => new Vector3(...p))),
          positions = hull.getAttribute("position"),
          normals = hull.getAttribute("normal"),
          result: Plane[] = [];
        for (let i = 0; i < positions.count; i += 3) {
          const n = [normals.getX(i), normals.getY(i), normals.getZ(i)];
          result.push({
            n,
            d: dot(n, [
              positions.getX(i),
              positions.getY(i),
              positions.getZ(i),
            ]),
          });
        }
        hull.dispose();
        return result;
      });
      const o = occurrences(project).find((o) => o.node.ref === ref)!;
      const mesh = await memberLocalOf(project, o.id, sources);
      expect(mesh.indices.length / 3).toBe(ref === "4716.dat" ? 836 : 544);
      const points = Array.from({ length: mesh.vertices.length / 3 }, (_, i) =>
        Array.from(mesh.vertices.slice(3 * i, 3 * i + 3)),
      );
      let residueArea = 0;
      for (let i = 0; i < mesh.indices.length; i += 3) {
        let remaining: Point[][] = [
          [0, 1, 2].map((j) => points[mesh.indices[i + j]]),
        ];
        for (const cell of planes) {
          const outside: Point[][] = [];
          for (const polygon of remaining) {
            let inside: Point[][] = [polygon];
            for (const plane of cell) {
              const next: Point[][] = [];
              for (const p of inside) {
                const [lo, hi] = split(p, {
                  n: plane.n,
                  d: plane.d + WINCH_SOURCE_PLANE_ENVELOPE_LDU,
                });
                // Record the residual numerical scope; this does not delete a
                // runtime geometry interval or replace the all-point clipping.
                if (hi.length >= 3 && area(hi) > 1e-14) outside.push(hi);
                if (lo.length >= 3 && area(lo) > 1e-14) next.push(lo);
              }
              inside = next;
            }
          }
          remaining = outside;
          if (!remaining.length) break;
        }
        residueArea += remaining.reduce((sum, p) => sum + area(p), 0);
      }
      expect(residueArea).toBe(0);
    },
  );
  it("preserves the actual rounded keyed hole for every axial station in the extruded core", () => {
    // Clip every complete convex-cell projection against a triangulation of
    // the actual24-sided source bore. Disjoint projections preserve that void
    // through EVERY axial station, not just the independent point controls.
    const hole = [
      ...new Map(
        sources["axl5hol8.dat"]
          .split(/\r?\n/)
          .map((line) => line.trim().split(/\s+/))
          .filter((w) => w[0] === "4")
          .flatMap((w) =>
            [2, 5, 8, 11].map((i) => w.slice(i, i + 3).map(Number)),
          )
          .filter((p) => p[1] === 0)
          .map(([x, , z]) => [[x, z].join(","), [x, z, 0]] as const),
      ).values(),
    ].sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
    const holeTriangles = ShapeUtils.triangulateShape(
      hole.map(([x, y]) => new Vector2(x, y)),
      [],
    );
    const hull2d = (points: readonly Point[]) => {
      const p = [
        ...new Map(
          points.map(([x, y]) => [[x, y].join(","), [x, y, 0]]),
        ).values(),
      ].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cross = (a: Point, b: Point, c: Point) =>
        (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      const side = (p: Point[]) => {
        const out: Point[] = [];
        for (const q of p) {
          while (
            out.length > 1 &&
            cross(out[out.length - 2], out[out.length - 1], q) <= 0
          )
            out.pop();
          out.push(q);
        }
        return out.slice(0, -1);
      };
      return [...side(p), ...side([...p].reverse())];
    };
    for (const ref of ["4716.dat", "10928.dat"] as const) {
      let overlapArea = 0;
      for (const region of winchConvexRegions(binding, ref))
        for (const indices of holeTriangles) {
          const t = indices.map((i) => hole[i]),
            sign = Math.sign(
              (t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) -
                (t[1][1] - t[0][1]) * (t[2][0] - t[0][0]),
            );
          let p = hull2d(region.points);
          for (let i = 0; i < 3; i++) {
            const a = t[i],
              b = t[(i + 1) % 3],
              n = [sign * (b[1] - a[1]), -sign * (b[0] - a[0]), 0];
            p = split(p, { n, d: dot(n, a) })[0];
          }
          overlapArea += area(p);
        }
      expect(overlapArea).toBeLessThan(1e-10);
    }
    for (const ref of ["4716.dat", "10928.dat"] as const) {
      const cells = winchConvexRegions(binding, ref).map((r) => {
        const h = new ConvexGeometry(r.points.map((p) => new Vector3(...p))),
          p = h.getAttribute("position"),
          n = h.getAttribute("normal"),
          planes: Plane[] = [];
        for (let i = 0; i < p.count; i += 3) {
          const normal = [n.getX(i), n.getY(i), n.getZ(i)];
          planes.push({
            n: normal,
            d: dot(normal, [p.getX(i), p.getY(i), p.getZ(i)]),
          });
        }
        h.dispose();
        return planes;
      });
      for (const z of [-9, -2, 0, 2, 9])
        for (const xy of [
          [0, 0],
          [5, 0],
          [0, 5],
          [-5, 0],
          [0, -5],
          [2.4, 2.4],
          [-2.4, 2.4],
          [-2.4, -2.4],
          [2.4, -2.4],
        ]) {
          const p = [...xy, z];
          expect(
            cells.some((planes) =>
              planes.every((plane) => dot(plane.n, p) < plane.d - 0.01),
            ),
          ).toBe(false);
        }
    }
  });
});
