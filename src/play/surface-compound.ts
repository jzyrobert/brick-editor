import { Vector3 } from "three";
import { inverse, add, mv, identity } from "../core/math";
import { ensure, type Transform, type Vec3 } from "../core/types";
import { compactCollisionMesh } from "./collision-mesh";
import type { CollisionSnapshot } from "./types";

const key = (p: Vec3) => p.map((v) => v.toFixed(3)).join(",");
type Face = { points: Vec3[]; normal: Vec3; outward: Vec3; area: number };
/** Convex planar regions formed only by joining adjacent, coplanar triangles
 * whose hull has exactly the same area. A hole/concave gap never gets bridged. */
function hull(points: Vec3[], normal: Vec3) {
  const drop = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs))),
    axes = [0, 1, 2].filter((k) => k !== drop);
  const unique = [...new Map(points.map((p) => [key(p), p])).values()].sort(
    (a, b) => a[axes[0]] - b[axes[0]] || a[axes[1]] - b[axes[1]],
  );
  const cross = (o: Vec3, a: Vec3, b: Vec3) =>
    (a[axes[0]] - o[axes[0]]) * (b[axes[1]] - o[axes[1]]) -
    (a[axes[1]] - o[axes[1]]) * (b[axes[0]] - o[axes[0]]);
  const half = (ps: Vec3[]) => {
    const out: Vec3[] = [];
    for (const p of ps) {
      while (
        out.length >= 2 &&
        cross(out[out.length - 2], out[out.length - 1], p) <= 1e-8
      )
        out.pop();
      out.push(p);
    }
    return out;
  };
  const lower = half(unique),
    upper = half([...unique].reverse()),
    poly = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    area += a[axes[0]] * b[axes[1]] - a[axes[1]] * b[axes[0]];
  }
  return { points: poly, area: Math.abs(area) / 2 };
}
const cache = new Map<string, Vec3[][]>();

/** Reviewed non-convex rack surfaces as thin convex prisms. This keeps guide
 * clearance and source holes without dynamic triangle meshes. 0.02 LDU inward skin
 * thickness is an explicitly bounded simulation approximation. */
export function surfaceCompound(
  mesh: CollisionSnapshot,
  frame: Transform,
  cacheKey: string,
  canonical = false,
) {
  ensure(
    mesh.indices.length <= 8192 * 3 && mesh.vertices.length <= 8192 * 9,
    "LIMIT_EXCEEDED",
    "Reviewed surface source exceeds 8,192 triangles or 24,576 vertices",
  );
  const inv = inverse(frame),
    compact = canonical
      ? compactCanonicalSurface(mesh.vertices, mesh.indices)
      : compactCollisionMesh(mesh.vertices, mesh.indices);
  const positions: Vec3[] = [];
  for (let i = 0; i < compact.vertices.length; i += 3)
    positions.push(
      add(
        inv.position,
        mv(inv.basis, Array.from(compact.vertices.slice(i, i + 3)) as Vec3),
      ),
    );
  // Include geometry in the key: a same-ref mock or coarser collision surface
  // cannot reuse another shape's decomposition.
  const signature =
    cacheKey +
    (canonical ? ":canonical:" : ":world:") +
    positions.map((p) => (canonical ? p.join(",") : key(p))).join(";") +
    ":" +
    Array.from(compact.indices).join(",");
  let local = cache.get(signature);
  if (!local) {
    ensure(
      compact.indices.length / 3 <= 8192,
      "LIMIT_EXCEEDED",
      "Reviewed surface-compound triangle budget exhausted",
    );
    let signedVolume = 0;
    for (let i = 0; i < compact.indices.length; i += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => positions[compact.indices[i + k]]);
      signedVolume += new Vector3(...a).dot(
        new Vector3(...b).cross(new Vector3(...c)),
      );
    }
    ensure(
      Math.abs(signedVolume) > 1e-6,
      "INVALID_INPUT",
      "Reviewed surface compound requires oriented volumetric source geometry",
    );
    const orientation = Math.sign(signedVolume);
    const planes = new Map<string, Face[]>();
    for (let i = 0; i < compact.indices.length; i += 3) {
      const points = [0, 1, 2].map((k) => positions[compact.indices[i + k]]);
      const a = new Vector3(...points[1]).sub(new Vector3(...points[0])),
        b = new Vector3(...points[2]).sub(new Vector3(...points[0]));
      const v = a.cross(b).normalize();
      const outward = v.clone().multiplyScalar(orientation).toArray() as Vec3;
      const components = [v.x, v.y, v.z],
        dominant = components
          .map(Math.abs)
          .indexOf(Math.max(...components.map(Math.abs))),
        sign = components[dominant] < 0 ? -1 : 1;
      const normal = v.multiplyScalar(sign).toArray() as Vec3,
        plane = normal.reduce((sum, n, k) => sum + n * points[0][k], 0);
      const planeKey =
          normal
            .map((n) => (Math.abs(n) < 0.0001 ? "0.000" : n.toFixed(3)))
            .join(",") +
          ":" +
          plane.toFixed(3),
        list = planes.get(planeKey) ?? [];
      const convex = hull(points, normal);
      if (convex.area > 1e-8)
        list.push({ points, normal, outward, area: convex.area });
      planes.set(planeKey, list);
    }
    let work = 0;
    for (const faces of planes.values()) {
      const live = new Map(faces.map((face, i) => [i, face])),
        owners = new Map<string, Set<number>>();
      const register = (i: number, face: Face) => {
        for (const p of face.points) {
          const k = key(p),
            set = owners.get(k) ?? new Set();
          set.add(i);
          owners.set(k, set);
        }
      };
      faces.forEach((face, i) => register(i, face));
      for (let i = 0; i < faces.length; i++) {
        if (!live.has(i)) continue;
        let changed = true;
        while (changed) {
          changed = false;
          const a = live.get(i)!,
            adjacent = new Map<number, number>();
          for (const k of new Set(a.points.map(key)))
            for (const j of owners.get(k) ?? [])
              if (j !== i && live.has(j))
                adjacent.set(j, (adjacent.get(j) ?? 0) + 1);
          for (const [j, shared] of [...adjacent].sort(([a], [b]) => a - b)) {
            if (shared < 2) continue;
            ensure(
              ++work <= 200000,
              "LIMIT_EXCEEDED",
              "Reviewed surface-compound merge work exhausted",
            );
            const b = live.get(j)!;
            const plane = a.normal.reduce(
              (v, n, k) => v + n * a.points[0][k],
              0,
            );
            if (
              b.points.some(
                (p) =>
                  Math.abs(
                    a.normal.reduce((v, n, k) => v + n * p[k], 0) - plane,
                  ) > 0.001,
              )
            )
              continue;
            const merged = hull([...a.points, ...b.points], a.normal);
            if (
              Math.abs(merged.area - a.area - b.area) >
              Math.max(1e-6, merged.area * 1e-7)
            )
              continue;
            for (const p of b.points) owners.get(key(p))!.delete(j);
            a.points = [
              ...new Map(
                [...a.points, ...b.points].map((p) => [key(p), p]),
              ).values(),
            ];
            a.area += b.area;
            register(i, a);
            live.delete(j);
            changed = true;
            break;
          }
        }
      }
      faces.splice(0, faces.length, ...live.values());
    }
    local = [...planes.values()].flatMap((faces) =>
      faces.map((face) =>
        hull(face.points, face.normal).points.flatMap((p) =>
          [-0.02, 0].map(
            (offset) => p.map((n, k) => n + face.outward[k] * offset) as Vec3,
          ),
        ),
      ),
    );
    ensure(
      local.length <= 4096,
      "LIMIT_EXCEEDED",
      "Reviewed surface compound exceeds 4,096 convex surfaces",
      {
        surfaces: local.length,
        planes: planes.size,
        triangles: compact.indices.length / 3,
      },
    );
    if (cache.size >= 8) cache.delete(cache.keys().next().value!);
    cache.set(signature, local);
  }
  return local.map((piece) =>
    piece.map((p) => add(frame.position, mv(frame.basis, p))),
  );
}

/** Preserve the loaded prototype's local double-precision coordinates. */
export function surfaceCompoundLocal(
  mesh: { vertices: Float64Array; indices: Uint32Array },
  cacheKey: string,
) {
  return surfaceCompound(
    mesh as unknown as CollisionSnapshot,
    identity(),
    cacheKey,
    true,
  );
}

function compactCanonicalSurface(
  vertices: ArrayLike<number>,
  indices: Uint32Array,
) {
  const points: number[] = [],
    remap: number[] = [],
    unique = new Map<string, number>();
  for (let i = 0; i < vertices.length; i += 3) {
    const p = [vertices[i], vertices[i + 1], vertices[i + 2]],
      key = p.join(",");
    let id = unique.get(key);
    if (id === undefined) {
      id = points.length / 3;
      unique.set(key, id);
      points.push(...p);
    }
    remap.push(id);
  }
  const kept: number[] = [],
    seen = new Set<string>();
  for (let i = 0; i < indices.length; i += 3) {
    const t = [remap[indices[i]], remap[indices[i + 1]], remap[indices[i + 2]]];
    if (new Set(t).size < 3) continue;
    const key = [...t].sort((a, b) => a - b).join(",");
    if (seen.has(key)) continue;
    const p = t.map(
      (v) => new Vector3(points[v * 3], points[v * 3 + 1], points[v * 3 + 2]),
    );
    if (
      new Vector3()
        .subVectors(p[1], p[0])
        .cross(new Vector3().subVectors(p[2], p[0]))
        .lengthSq() === 0
    )
      continue;
    seen.add(key);
    kept.push(...t);
  }
  return {
    vertices: Float64Array.from(points),
    indices: Uint32Array.from(kept),
  };
}
