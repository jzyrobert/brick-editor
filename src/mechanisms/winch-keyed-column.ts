import { ShapeUtils, Vector2 } from "three";
import { ensure, type Vec3 } from "../core/types";

/** Static source-face normal-plane scope, including compilation toF32.
 * This never changes native geometry or grants an axial weld. */
export const WINCH_KEY_SOURCE_PLANE_ENVELOPE_LDU = 1e-6;
type P = readonly number[];
type Plane = { x: number; y: number; d: number };
const area = (p: P[]) =>
  Math.abs(
    p.reduce((s, a, i) => {
      const b = p[(i + 1) % p.length];
      return s + a[0] * b[1] - a[1] * b[0];
    }, 0),
  ) / 2;
function split(p: P[], f: Plane) {
  const halves: P[][] = [[], []];
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      da = f.x * a[0] + f.y * a[1] - f.d,
      db = f.x * b[0] + f.y * b[1] - f.d;
    if (da <= 0) halves[0].push(a);
    if (da >= 0) halves[1].push(a);
    if (da * db < 0) {
      const t = da / (da - db),
        v = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
      halves[0].push(v);
      halves[1].push(v);
    }
  }
  return halves;
}
/** Full triangular footprint subtraction AND full edge-interval coverage.
 * Degenerate projected side triangles are retained by the edge proof. This
 * is a bounded normal-plane certificate of the source negative column, not
 * a general solid/topology theorem, native contact query or a weld token. */
export function certifyWinchKeyedColumn(
  triangles: readonly (readonly Readonly<Vec3>[])[],
  hole: readonly Readonly<Vec3>[],
) {
  ensure(
    hole.length === 24 &&
      triangles.length <= 20_000 &&
      [...hole, ...triangles.flat()].every((p) => p.every(Number.isFinite)),
    "INVALID_INPUT",
    "Invalid bounded keyed-column source review.",
  );
  const cells = ShapeUtils.triangulateShape(
    hole.map((p) => new Vector2(p[0], p[1])),
    [],
  ).map((ids) => {
    const t = ids.map((i) => hole[i]),
      cx = t.reduce((s, p) => s + p[0], 0) / 3,
      cy = t.reduce((s, p) => s + p[1], 0) / 3;
    return t.map((a, i) => {
      const b = t[(i + 1) % 3],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      let x = (b[1] - a[1]) / length,
        y = (a[0] - b[0]) / length,
        d = x * a[0] + y * a[1];
      if (x * cx + y * cy > d) {
        x = -x;
        y = -y;
        d = -d;
      }
      return { x, y, d: d + WINCH_KEY_SOURCE_PLANE_ENVELOPE_LDU };
    });
  });
  let maxResidualAreaLdu2 = 0,
    maxEdgeGapFraction = 0;
  for (const triangle of triangles) {
    ensure(
      triangle.length === 3,
      "INVALID_INPUT",
      "Review actual source triangles.",
    );
    let remaining: P[][] = [Array.from(triangle)];
    for (const cell of cells) {
      const outside: P[][] = [];
      for (const p of remaining) {
        let inside: P[][] = [p];
        for (const f of cell) {
          const next: P[][] = [];
          for (const q of inside) {
            const [lo, hi] = split(q, f);
            if (hi.length >= 3 && area(hi) > 0) outside.push(hi);
            if (lo.length >= 3 && area(lo) > 0) next.push(lo);
          }
          inside = next;
        }
      }
      remaining = outside;
      ensure(
        remaining.length <= 4096,
        "RESOURCE_LIMIT",
        "Keyed-column polygon budget exceeded.",
      );
    }
    maxResidualAreaLdu2 = Math.max(
      maxResidualAreaLdu2,
      remaining.reduce((s, p) => s + area(p), 0),
    );
    for (let i = 0; i < 3; i++) {
      const a = triangle[i],
        b = triangle[(i + 1) % 3],
        intervals: number[][] = [];
      for (const cell of cells) {
        let lo = 0,
          hi = 1;
        for (const f of cell) {
          const start = f.x * a[0] + f.y * a[1] - f.d,
            slope = f.x * (b[0] - a[0]) + f.y * (b[1] - a[1]);
          if (slope === 0) {
            if (start > 0) {
              lo = 1;
              hi = 0;
              break;
            }
          } else if (slope > 0) hi = Math.min(hi, -start / slope);
          else lo = Math.max(lo, -start / slope);
        }
        if (lo <= hi) intervals.push([lo, hi]);
      }
      intervals.sort((a, b) => a[0] - b[0]);
      let end = 0;
      for (const [lo, hi] of intervals) {
        maxEdgeGapFraction = Math.max(maxEdgeGapFraction, lo - end);
        end = Math.max(end, hi);
      }
      maxEdgeGapFraction = Math.max(maxEdgeGapFraction, 1 - end);
    }
  }
  ensure(
    maxResidualAreaLdu2 <= 1e-10 && maxEdgeGapFraction <= 1e-12,
    "INVALID_INPUT",
    "Shaft source footprint crosses the keyed negative column.",
  );
  return Object.freeze({
    triangles: triangles.length,
    normalPlaneEnvelopeLdu: WINCH_KEY_SOURCE_PLANE_ENVELOPE_LDU,
    maxResidualAreaLdu2,
    maxEdgeGapFraction,
  });
}
