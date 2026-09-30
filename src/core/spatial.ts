import { add, mv } from "./math";
import { canonical } from "../ldraw/path";
import {
  ensure,
  type Basis,
  type Project,
  type Transform,
  type Vec3,
} from "./types";
export type Bounds = { min: Vec3; max: Vec3 };
export function pointsBounds(points: Vec3[]): Bounds | null {
  if (!points.length) return null;
  // Loops, not Math.min(...list): spreading more than ~120,000 arguments
  // overflows the stack, and a whole-model point list can be longer.
  const min: Vec3 = [Infinity, Infinity, Infinity],
    max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of points)
    for (let i = 0; i < 3; i++) {
      if (p[i] < min[i]) min[i] = p[i];
      if (p[i] > max[i]) max[i] = p[i];
    }
  return { min, max };
}
export function unionBounds(a: Bounds | null, b: Bounds | null): Bounds | null {
  if (!a) return b;
  if (!b) return a;
  return {
    min: a.min.map((v, i) => Math.min(v, b.min[i])) as Vec3,
    max: a.max.map((v, i) => Math.max(v, b.max[i])) as Vec3,
  };
}
export function transformBounds(b: Bounds, t: Transform): Bounds {
  const points: Vec3[] = [];
  for (const x of [b.min[0], b.max[0]])
    for (const y of [b.min[1], b.max[1]])
      for (const z of [b.min[2], b.max[2]])
        points.push(add(t.position, mv(t.basis, [x, y, z])));
  ensure(
    points.every((p) => p.every(Number.isFinite)),
    "LIMIT_EXCEEDED",
    "Spatial bounds overflow; reduce transform magnitude or depth",
  );
  return pointsBounds(points)!;
}
export function primitiveBounds(raw: string): Bounds | null {
  const t = raw.trim().split(/\s+/),
    kind = Number(t[0]);
  if (![2, 3, 4, 5].includes(kind)) return null;
  const count = kind === 3 ? 3 : kind === 4 ? 4 : 2;
  // Conditional-line control points determine visibility, not occupied geometry.
  const points = Array.from(
    { length: count },
    (_, i) => t.slice(2 + i * 3, 5 + i * 3).map(Number) as Vec3,
  );
  ensure(
    points.every((p) => p.length === 3 && p.every(Number.isFinite)),
    "INVALID_INPUT",
    "Invalid source geometry bounds",
  );
  return pointsBounds(points);
}
export function sourceDependencies(sources: Record<string, string>) {
  const direct = Object.fromEntries(
    Object.entries(sources).map(([name, text]) => [
      name,
      [
        ...new Set(
          text
            .split(/\r?\n/)
            .filter((line) => /^1\s/.test(line.trim()))
            .map((line) =>
              canonical(line.trim().split(/\s+/).slice(14).join(" ")),
            ),
        ),
      ],
    ]),
  );
  const transitive: Record<string, string[]> = Object.create(null);
  let work = 0;
  const visit = (name: string, path = new Set<string>()): string[] => {
    ensure(
      path.size < 64 && !path.has(name),
      "REFERENCE_CYCLE",
      "Cyclic/deep source dependencies",
    );
    ensure(
      Object.hasOwn(direct, name),
      "REFERENCE_MISSING",
      "Missing source dependency: " + name,
    );
    if (Object.hasOwn(transitive, name)) return transitive[name];
    const result = new Set<string>(),
      next = new Set(path).add(name);
    for (const child of direct[name]) {
      result.add(child);
      for (const ref of visit(child, next)) {
        ensure(
          ++work <= 2000000,
          "LIMIT_EXCEEDED",
          "Source dependency closure exceeds budget",
        );
        result.add(ref);
      }
    }
    return (transitive[name] = [...result]);
  };
  for (const name of Object.keys(direct)) visit(name);
  return { direct, transitive };
}
/** Offline build-time bounds, including all declared source geometry. */
export function sourceBounds(
  sources: Record<string, string>,
  ref: string,
): Bounds | null {
  let work = 0;
  const cache = new Map<string, Bounds | null>();
  function visit(name: string, ancestors: Set<string>): Bounds | null {
    ensure(
      ancestors.size < 64 && !ancestors.has(name),
      "REFERENCE_CYCLE",
      "Cyclic/deep bounds source",
    );
    if (cache.has(name)) return cache.get(name)!;
    ensure(
      Object.hasOwn(sources, name),
      "REFERENCE_MISSING",
      "Bounds source missing: " + name,
    );
    const next = new Set(ancestors).add(name);
    let result: Bounds | null = null;
    for (const raw of sources[name].split(/\r?\n/)) {
      ensure(
        ++work <= 2000000,
        "LIMIT_EXCEEDED",
        "Source bounds work exceeds budget",
      );
      const t = raw.trim().split(/\s+/);
      let b = primitiveBounds(raw);
      if (t[0] === "1") {
        const values = t.slice(2, 14).map(Number);
        ensure(
          values.length === 12 && values.every(Number.isFinite),
          "INVALID_INPUT",
          "Invalid bounds reference",
        );
        const child = visit(canonical(t.slice(14).join(" ")), next);
        b =
          child &&
          transformBounds(child, {
            position: values.slice(0, 3) as Vec3,
            basis: values.slice(3) as Basis,
          });
      }
      result = unionBounds(result, b);
    }
    cache.set(name, result);
    return result;
  }
  return visit(ref, new Set());
}
/** Conservative transformed source boxes. A missing dependency makes the box unknown. */
export function projectBounds(
  project: Project,
  official: Record<string, Bounds | null>,
  dependencies: Record<string, string[]> = {},
) {
  const cache = new Map<string, Bounds | null>();
  let work = 0;
  function model(ref: string, ancestors = new Set<string>()): Bounds | null {
    ensure(
      ancestors.size < 64 && !ancestors.has(ref),
      "REFERENCE_CYCLE",
      "Cyclic/deep bounds model",
    );
    if (cache.has(ref)) return cache.get(ref)!;
    if (!Object.hasOwn(project.models, ref)) {
      // The renderer merges project definitions into custom-part dependency trees.
      // A direct official leaf instead uses only the pinned official namespace.
      if (
        ancestors.size &&
        dependencies[ref]?.some((name) => Object.hasOwn(project.models, name))
      )
        return null;
      return Object.hasOwn(official, ref) ? official[ref] : null;
    }
    const m = project.models[ref],
      records = new Map(m.records.map((r) => [r.id, r.raw])),
      next = new Set(ancestors).add(ref);
    let result: Bounds | null = null;
    for (const n of m.nodes) {
      ensure(
        ++work <= 2000000,
        "LIMIT_EXCEEDED",
        "Model bounds work exceeds budget",
      );
      const b =
        n.kind === "geometry"
          ? primitiveBounds(records.get(n.sourceRecordId ?? "") ?? "")
          : model(n.ref, next);
      if (!b) {
        cache.set(ref, null);
        return null;
      }
      result = unionBounds(result, transformBounds(b, n.transform));
    }
    cache.set(ref, result);
    return result;
  }
  return { model, primitive: primitiveBounds };
}
