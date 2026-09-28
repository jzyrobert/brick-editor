// Memoised whole-library source bounds with the exact semantics of sourceBounds
// (src/core/spatial.ts): the union of every line's geometry, conditional-line
// control points excluded. Shared by the complete-pack build and validation.
import {
  primitiveBounds,
  transformBounds,
  unionBounds,
  type Bounds,
} from "../src/core/spatial";
import { canonical } from "../src/ldraw/path";
import type { Basis, Vec3 } from "../src/core/types";

/** `text(name)` returns a file's source, or undefined when the library lacks it
 * (bounds depending on such a file are unknown: null). */
export function libraryBounds(text: (name: string) => string | undefined) {
  const memo = new Map<string, { b: Bounds | null; unknown: boolean }>();
  const visit = (
    name: string,
    path: Set<string>,
  ): { b: Bounds | null; unknown: boolean } => {
    const hit = memo.get(name);
    if (hit) return hit;
    if (path.has(name)) throw new Error("Bounds cycle at " + name);
    const source = text(name);
    let b: Bounds | null = null,
      unknown = source === undefined;
    const next = new Set(path).add(name);
    for (const raw of source?.split(/\r?\n/) ?? []) {
      const t = raw.trim().split(/\s+/);
      let line = primitiveBounds(raw);
      if (t[0] === "1") {
        const v = t.slice(2, 14).map(Number);
        const child = visit(canonical(t.slice(14).join(" ")), next);
        unknown ||= child.unknown;
        line =
          child.b &&
          transformBounds(child.b, {
            position: v.slice(0, 3) as Vec3,
            basis: v.slice(3) as Basis,
          });
      }
      b = unionBounds(b, line);
    }
    const result = { b: unknown ? null : b, unknown };
    memo.set(name, result);
    return result;
  };
  return (name: string) => visit(name, new Set()).b;
}

/** Conservative 0.001 LDU storage form: [min xyz, max xyz] (or null). */
export const packBounds = (b: Bounds | null) =>
  b && [
    ...b.min.map((v) => Math.floor(v * 1000 + 1e-6) / 1000 || 0),
    ...b.max.map((v) => Math.ceil(v * 1000 - 1e-6) / 1000 || 0),
  ];
