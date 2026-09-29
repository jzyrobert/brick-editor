/**
 * Simplified collision shapes for official parts in very large Play worlds.
 *
 * A real-parts building of 10,000–30,000 parts draws 5–15 million triangles, most
 * of them in stud and underside-tube primitives. Play's static collision budget is
 * one million triangles, so such a world would otherwise fall back to Fly only.
 * When the full surface exceeds that budget, each official part collides with its
 * own polygons minus the stud and tube primitives: the walls, openings, arches
 * and slopes keep their exact shape; only the ≤ 4 LDU stud relief on top and the
 * hidden tubes underneath are omitted. The proxy is expanded from the part's
 * pinned source once per part (not per colour or occurrence).
 */
import { canonical } from "../ldraw/path";

/** Stud and underside-tube primitive families (any resolution prefix). */
const OMITTED = /(^|\/)(stud[\w-]*|stug[\w-]*)\.dat$/;
export const isCollisionOmitted = (name: string) => OMITTED.test(name);

export const COLLISION_PROXY_LIMITS = Object.freeze({
  /** Lines visited while expanding one part. */
  work: 2_000_000,
  /** Triangles kept for one part. */
  triangles: 50_000,
  depth: 32,
});

/**
 * Expands `ref` into part-space LDraw triangles (9 floats each), skipping stud
 * and tube primitives. Returns undefined when a dependency is missing or a limit
 * is reached, so the caller keeps the rendered surface for that part.
 */
export function collisionProxy(
  read: (name: string) => string | undefined,
  ref: string,
  omit: (name: string) => boolean = isCollisionOmitted,
): Float32Array | undefined {
  const out: number[] = [];
  let work = 0;
  let failed = false;
  const visit = (name: string, m: number[], depth: number) => {
    if (failed) return;
    if (depth > COLLISION_PROXY_LIMITS.depth) return void (failed = true);
    const text = read(name);
    if (text === undefined) return void (failed = true);
    for (const line of text.split(/\r?\n/)) {
      if (++work > COLLISION_PROXY_LIMITS.work) return void (failed = true);
      const t = line.trim().split(/\s+/);
      if (t[0] === "1" && t.length >= 15) {
        let child: string;
        try {
          child = canonical(t.slice(14).join(" "));
        } catch {
          return void (failed = true);
        }
        if (omit(child)) continue;
        const v = t.slice(2, 14).map(Number);
        if (v.some((n) => !Number.isFinite(n))) return void (failed = true);
        // Row-major 3×4 affine: [a b c x; d e f y; g h i z].
        const local = [
          v[3],
          v[4],
          v[5],
          v[0],
          v[6],
          v[7],
          v[8],
          v[1],
          v[9],
          v[10],
          v[11],
          v[2],
        ];
        visit(child, compose(m, local), depth + 1);
        if (failed) return;
      } else if (
        (t[0] === "3" && t.length >= 11) ||
        (t[0] === "4" && t.length >= 14)
      ) {
        const corners = t[0] === "3" ? 3 : 4;
        const p: number[] = [];
        for (let i = 0; i < corners; i++) {
          const x = Number(t[2 + i * 3]),
            y = Number(t[3 + i * 3]),
            z = Number(t[4 + i * 3]);
          if (!Number.isFinite(x + y + z)) return void (failed = true);
          p.push(
            m[0] * x + m[1] * y + m[2] * z + m[3],
            m[4] * x + m[5] * y + m[6] * z + m[7],
            m[8] * x + m[9] * y + m[10] * z + m[11],
          );
        }
        out.push(...p.slice(0, 9));
        if (corners === 4) out.push(...p.slice(0, 3), ...p.slice(6, 12));
        if (out.length / 9 > COLLISION_PROXY_LIMITS.triangles)
          return void (failed = true);
      }
    }
  };
  visit(ref, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], 0);
  return failed ? undefined : Float32Array.from(out);
}

function compose(a: number[], b: number[]) {
  const r = new Array<number>(12);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++)
      r[row * 4 + col] =
        a[row * 4] * b[col] +
        a[row * 4 + 1] * b[4 + col] +
        a[row * 4 + 2] * b[8 + col];
    r[row * 4 + 3] =
      a[row * 4] * b[3] +
      a[row * 4 + 1] * b[7] +
      a[row * 4 + 2] * b[11] +
      a[row * 4 + 3];
  }
  return r;
}

/**
 * Parts a walker passes through or under: their openings must survive the
 * coarsest collision level. Matched on the official part title.
 */
const OPENINGS = /^~?(Door|Arch|Gate|Panel\s.*\bOpening)\b/i;
/** The part title: the first meta line of an LDraw file. */
export function partTitle(text: string) {
  for (const line of text.split(/\r?\n/, 8)) {
    const m = /^0\s+(?!FILE\b|Name:|Author:|!|BFC\b)(\S.*)$/.exec(line.trim());
    if (m) return m[1];
  }
  return "";
}
export const keepsOpenings = (title: string) => OPENINGS.test(title);

/**
 * The part-space bounding box of a proxy as 12 triangles: the coarsest
 * collision level, used only when even stud-free proxies exceed the budget.
 */
export function boxProxy(tris: Float32Array): Float32Array {
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < tris.length; i++) {
    const a = i % 3;
    if (tris[i] < min[a]) min[a] = tris[i];
    if (tris[i] > max[a]) max[a] = tris[i];
  }
  if (!(min[0] <= max[0])) return new Float32Array(0);
  const c = (i: number) => [
    i & 1 ? max[0] : min[0],
    i & 2 ? max[1] : min[1],
    i & 4 ? max[2] : min[2],
  ];
  // Two triangles per face; winding is irrelevant (queries are two-sided).
  const faces = [
    [0, 1, 3, 2],
    [4, 5, 7, 6],
    [0, 1, 5, 4],
    [2, 3, 7, 6],
    [0, 2, 6, 4],
    [1, 3, 7, 5],
  ];
  const out: number[] = [];
  for (const [a, b, d, e] of faces)
    out.push(...c(a), ...c(b), ...c(d), ...c(a), ...c(d), ...c(e));
  return Float32Array.from(out);
}
