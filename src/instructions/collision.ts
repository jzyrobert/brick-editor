/** Continuous, fixed-orientation triangle-surface translation queries in LDU.
 * These are CAD travel checks, never solid-material/force/hand-fit certification.
 */
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Matrix4,
  Triangle,
  Vector3,
} from "three";
import { MeshBVH } from "three-mesh-bvh";
import { collisionProxy } from "../play/collision-proxy";
import { compactCollisionMesh } from "../play/collision-mesh";
import { curatedGeometrySource } from "../catalog/geometry-sources";
import { fullSource, fullLibraryLock } from "../catalog/full-library";
import { libraryLock } from "../catalog/catalog";
import { mates, worldConnectors } from "../core/connectivity";
import { physical } from "../core/math";
import {
  projectBounds,
  primitiveBounds,
  transformBounds,
  type Bounds,
} from "../core/spatial";
import installed from "../catalog/bounds.json";
import type { InstructionPlan, Occurrence, Project, Vec3 } from "../core/types";

export const INSERTION_LIMITS = Object.freeze({
  sourceCharacters: 20_000_000,
  broadPhaseQueries: 2_000_000,
  maxSourceCoordinate: 50_000,
  maxWorldCoordinate: 1_000_000,
  triangleTests: 1_000_000,
  pairQueries: 100_000,
  cachedTriangles: 500_000,
  meshTriangles: 50_000,
  maxTravel: 8_000,
  endpointTolerance: 0.05,
  contactTravel: 6,
  contactRadius: 7,
  contactDepth: 5,
});
export type SurfacePath = {
  status: "clear" | "blocked" | "unknown";
  outward: Vec3;
  distance: number;
  blockers: string[];
  uncertain: string[];
  reason?: string;
};
const tuple = (v: Vector3): Vec3 => [v.x, v.y, v.z];
const ae = Array.from({ length: 3 }, () => new Vector3()),
  be = Array.from({ length: 3 }, () => new Vector3());
const axes = Array.from({ length: 17 }, () => new Vector3());
const pose = (o: Occurrence) => {
  const { basis: b, position: p } = o.transform;
  return new Matrix4().set(
    b[0],
    b[1],
    b[2],
    p[0],
    b[3],
    b[4],
    b[5],
    p[1],
    b[6],
    b[7],
    b[8],
    p[2],
    0,
    0,
    0,
    1,
  );
};
/** SAT over time for translating triangles. Parallel face/edge sliding,
 * including coplanar contact, is allowed by the explicit tangency policy.
 * The additional edge/normal axes distinguish disjoint coplanar polygons.
 * No fixed time samples: a thin obstacle between sample poses is still found.
 */
export function sweptTriangleInterval(
  a: Triangle,
  b: Triangle,
  v: Vector3,
): [number, number] | undefined {
  ae[0].subVectors(a.b, a.a);
  ae[1].subVectors(a.c, a.b);
  ae[2].subVectors(a.a, a.c);
  be[0].subVectors(b.b, b.a);
  be[1].subVectors(b.c, b.b);
  be[2].subVectors(b.a, b.c);
  axes[0].crossVectors(ae[0], ae[1]);
  axes[1].crossVectors(be[0], be[1]);
  let at = 2;
  for (const e of ae) for (const f of be) axes[at++].crossVectors(e, f);
  for (const e of ae) axes[at++].crossVectors(axes[0], e);
  for (const e of be) axes[at++].crossVectors(axes[1], e);
  let lo = 0,
    hi = 1;
  for (const axis of axes) {
    if (axis.lengthSq() < 1e-18) continue;
    axis.normalize();
    const a0 = a.a.dot(axis),
      a1 = a.b.dot(axis),
      a2 = a.c.dot(axis),
      b0 = b.a.dot(axis),
      b1 = b.b.dot(axis),
      b2 = b.c.dot(axis);
    const amin = Math.min(a0, a1, a2),
      amax = Math.max(a0, a1, a2),
      bmin = Math.min(b0, b1, b2),
      bmax = Math.max(b0, b1, b2),
      speed = axis.dot(v);
    if (Math.abs(speed) < 1e-12) {
      if (amax < bmin - 1e-7 || bmax < amin - 1e-7) return;
      // Constant tangency along a face/edge has no transverse surface crossing.
      // This also handles neighboring bricks sharing a side plane. It is a
      // surface-contact convention, not a manufactured-clearance assertion.
      if (amax <= bmin + 1e-7 || bmax <= amin + 1e-7) return;
    } else {
      const t0 = (bmin - amax - 1e-7) / speed,
        t1 = (bmax - amin + 1e-7) / speed;
      lo = Math.max(lo, Math.min(t0, t1));
      hi = Math.min(hi, Math.max(t0, t1));
      if (lo > hi) return;
    }
  }
  return [lo, hi];
}
type Shape = {
  geometry: BufferGeometry;
  bvh: MeshBVH;
  triangles: Triangle[];
  box: Box3;
};
type Body = {
  o: Occurrence;
  matrix: Matrix4;
  inverse: Matrix4;
  box?: Box3;
  shape?: Shape;
  reason?: string;
};
type PairResult = "clear" | "blocked" | "unknown";

/** Fingerprint of authored geometry/poses and pinned sources, not an authenticity hash. */
export function insertionFingerprint(p: Project, plan?: InstructionPlan) {
  const text = JSON.stringify([
    "contact-policy-2",
    fullLibraryLock,
    INSERTION_LIMITS,
    p.rootModelId,
    p.library,
    p.models,
    plan?.steps,
    plan?.modules,
    plan?.stepMetadata?.map((m) => m.assembly),
  ]);
  let a = 0x811c9dc5,
    b = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 0x01000193);
    b = Math.imul(b ^ text.charCodeAt(i), 0x85ebca6b);
  }
  return `surface-translation-1:${(a >>> 0).toString(16)}:${(b >>> 0).toString(16)}:${text.length}`;
}

export function createInsertionEngine(
  project: Project,
  all: Occurrence[],
  limits: Partial<typeof INSERTION_LIMITS> = {},
) {
  const caps = { ...INSERTION_LIMITS, ...limits },
    shapes = new Map<string, Shape | null>(),
    bodies = new Map<string, Body>(),
    memo = new Map<string, PairResult>();
  const world = new Box3(),
    bounds = projectBounds(
      project,
      installed.bounds as unknown as Record<string, Bounds | null>,
      installed.dependencies.transitive,
    );
  let sourceCharacters = 0,
    preparationExhausted = false;
  let triangles = 0,
    triangleTests = 0,
    pairQueries = 0,
    broadPhaseQueries = 0,
    exhausted = false;
  let broadPhaseLimit = Math.floor(caps.broadPhaseQueries / 4);
  let triangleLimit = Math.floor(caps.triangleTests / 4),
    replay = false;
  const read = (name: string) =>
    curatedGeometrySource(name) ?? fullSource(name);
  const shape = (ref: string): Shape | undefined => {
    if (shapes.has(ref)) return shapes.get(ref) ?? undefined;
    shapes.set(ref, null);
    if (preparationExhausted || triangles >= caps.cachedTriangles) {
      exhausted = true;
      return;
    }
    // Reject texture alternatives rather than silently interpreting both branches.
    let unsupported = false;
    const raw = collisionProxy(
      (name) => {
        const text = read(name);
        sourceCharacters += text?.length ?? 0;
        if (sourceCharacters > caps.sourceCharacters) {
          preparationExhausted = exhausted = true;
          return;
        }
        if (text && /!TEXMAP|!LDCAD|!LSYNTH/.test(text)) unsupported = true;
        return text;
      },
      ref,
      () => false,
    ); // Full polygons, including every stud and underside tube.
    if (
      !raw?.length ||
      unsupported ||
      raw.length / 9 > caps.meshTriangles ||
      raw.some(
        (v) => !Number.isFinite(v) || Math.abs(v) > caps.maxSourceCoordinate,
      )
    )
      return;
    const compact = compactCollisionMesh(
      raw,
      Uint32Array.from({ length: raw.length / 3 }, (_, i) => i),
    );
    if (
      !compact.stats.triangles ||
      triangles + compact.stats.triangles > caps.cachedTriangles
    ) {
      preparationExhausted = exhausted = true;
      return;
    }
    triangles += compact.stats.triangles;
    const geometry = new BufferGeometry()
      .setAttribute("position", new BufferAttribute(compact.vertices, 3))
      .setIndex(new BufferAttribute(compact.indices, 1));
    geometry.computeBoundingBox();
    const bvh = new MeshBVH(geometry, { maxLeafTris: 8 });
    const position = geometry.getAttribute("position"),
      index = geometry.index!,
      tris: Triangle[] = [];
    for (let n = 0; n < index.count; n += 3)
      tris.push(
        new Triangle(
          ...([0, 1, 2].map((i) =>
            new Vector3().fromBufferAttribute(position, index.getX(n + i)),
          ) as [Vector3, Vector3, Vector3]),
        ),
      );
    const result = {
      geometry,
      bvh,
      triangles: tris,
      box: geometry.boundingBox!,
    };
    shapes.set(ref, result);
    return result;
  };
  const body = (o: Occurrence): Body => {
    const found = bodies.get(o.id);
    if (found) return found;
    const matrix = pose(o),
      result: Body = { o, matrix, inverse: matrix.clone().invert() };
    let local: Bounds | null = null;
    if (o.node.kind === "geometry")
      local = primitiveBounds(
        project.models[o.modelId].records.find(
          (r) => r.id === o.node.sourceRecordId,
        )?.raw ?? "",
      );
    else local = bounds.model(o.node.ref);
    if (local) {
      const b = transformBounds(local, o.transform);
      result.box = new Box3(new Vector3(...b.min), new Vector3(...b.max));
    }
    if (
      o.transform.position.some(
        (v) => !Number.isFinite(v) || Math.abs(v) > caps.maxWorldCoordinate,
      )
    )
      result.reason = "Placement exceeds the supported numerical domain.";
    else if (
      o.namespace !== "official" ||
      o.node.kind !== "part" ||
      !physical(o.transform, 0.001)
    )
      result.reason = "Requires ordinary rigid official geometry.";
    else if (project.library.manifestSha256 !== libraryLock.manifestSha256)
      result.reason = "The loaded geometry pack differs from the model lock.";
    else {
      result.shape = shape(o.node.ref);
      if (result.shape)
        result.box = result.shape.box.clone().applyMatrix4(matrix);
      else
        result.reason =
          "Complete supported part geometry is unavailable or exceeds the geometry budget.";
    }
    if (
      o.transform.position.some(
        (v) => !Number.isFinite(v) || Math.abs(v) > caps.maxWorldCoordinate,
      ) ||
      (result.box &&
        [...result.box.min.toArray(), ...result.box.max.toArray()].some(
          (v) => !Number.isFinite(v) || Math.abs(v) > caps.maxWorldCoordinate,
        ))
    ) {
      result.shape = undefined;
      result.box = undefined;
      result.reason = "Placement exceeds the supported numerical domain.";
    }
    bodies.set(o.id, result);
    return result;
  };
  let numericalDomain = true;
  for (const o of all) {
    const b = body(o);
    if (
      b.reason === "Placement exceeds the supported numerical domain." ||
      o.transform.position.some(
        (v) => !Number.isFinite(v) || Math.abs(v) > caps.maxWorldCoordinate,
      ) ||
      (b.box &&
        [...b.box.min.toArray(), ...b.box.max.toArray()].some(
          (v) => !Number.isFinite(v) || Math.abs(v) > caps.maxWorldCoordinate,
        ))
    )
      numericalDomain = false;
    if (b.box) world.union(b.box);
  }
  const allById = new Map(all.map((o) => [o.id, o]));
  const sweptBox = (box: Box3, shift: Vector3) =>
    box.clone().union(box.clone().translate(shift));
  const pair = (
    a: Body,
    b: Body,
    outward: Vec3,
    distance: number,
  ): PairResult => {
    if (++broadPhaseQueries > broadPhaseLimit) {
      exhausted = true;
      return "unknown";
    }
    const shiftWorld = new Vector3(...outward).multiplyScalar(distance);
    if (a.box && b.box && !sweptBox(a.box, shiftWorld).intersectsBox(b.box))
      return "clear";
    const key = JSON.stringify([a.o.id, b.o.id, outward, distance]);
    const cached = memo.get(key);
    if (cached) return cached;
    if (++pairQueries > caps.pairQueries) {
      exhausted = true;
      return "unknown";
    }
    if (!a.shape || !b.shape) return "unknown";
    const relative = b.inverse.clone().multiply(a.matrix),
      shift = shiftWorld
        .clone()
        .applyMatrix4(b.inverse)
        .sub(new Vector3().applyMatrix4(b.inverse));
    const ac = worldConnectors(a.o) ?? [],
      bc = worldConnectors(b.o) ?? [];
    const contacts = ac.flatMap((c) =>
      bc
        .filter(
          (d) =>
            ((c.kind === "antistud" && d.kind === "stud") ||
              (c.kind === "stud" && d.kind === "antistud")) &&
            mates(c, d) &&
            Math.abs(new Vector3(...c.axis).dot(new Vector3(...outward))) >
              0.99,
        )
        .map(() => c),
    );
    const covered = (tri: Triangle, matrix: Matrix4, fractions = [0]) =>
      contacts.some((c) =>
        fractions.every((t) =>
          [tri.a, tri.b, tri.c].every((p) => {
            const d = p
                .clone()
                .applyMatrix4(matrix)
                .addScaledVector(shiftWorld, t)
                .sub(new Vector3(...c.p)),
              axis = new Vector3(...c.axis),
              h = d.dot(axis);
            return (
              Math.abs(h) <= caps.contactDepth &&
              d.addScaledVector(axis, -h).length() <= caps.contactRadius
            );
          }),
        ),
      );
    let state: PairResult = "clear";
    for (const original of a.shape.triangles) {
      const moving = original.clone();
      for (const p of [moving.a, moving.b, moving.c]) p.applyMatrix4(relative);
      const box = new Box3().setFromPoints([moving.a, moving.b, moving.c]);
      const swept = sweptBox(box, shift);
      b.shape.bvh.shapecast({
        intersectsBounds: (box) => swept.intersectsBox(box),
        intersectsTriangle: (fixed) => {
          if (++triangleTests > triangleLimit) {
            exhausted = true;
            state = "unknown";
            return true;
          }
          const interval = sweptTriangleInterval(moving, fixed, shift);
          if (!interval || interval[1] * distance <= caps.endpointTolerance)
            return false;
          // Only a connector-local triangle in the final 6 LDU is exempted.
          // Other walls, holes and tubes of the same receiving part remain active.
          if (
            interval[1] * distance <= caps.contactTravel &&
            (covered(fixed, b.matrix) || covered(original, a.matrix, interval))
          )
            return false;
          state = "blocked";
          return true;
        },
      });
      if (state !== "clear") break;
    }
    if ((state as PairResult) !== "unknown") memo.set(key, state);
    return state;
  };
  /** Outward extraction from final pose reverses to an insertion segment.
   * Distance puts the ENTIRE moving group beyond the global model AABB on one
   * axis. That external start prevents closed-solid containment being missed.
   */
  const check = (
    movingIds: string[],
    obstacleIds: string[],
    directions: Vec3[],
  ): SurfacePath[] => {
    const moving = movingIds
      .map((id) => allById.get(id))
      .filter((o): o is Occurrence => !!o)
      .map(body);
    const box = new Box3();
    for (const b of moving) if (b.box) box.union(b.box);
    return directions.map((direction) => {
      const unit = new Vector3(...direction).normalize(),
        outward = tuple(unit);
      let travel = Infinity;
      for (const axis of ["x", "y", "z"] as const) {
        if (unit[axis] > 1e-8)
          travel = Math.min(
            travel,
            (world.max[axis] - box.min[axis] + 1) / unit[axis],
          );
        if (unit[axis] < -1e-8)
          travel = Math.min(
            travel,
            (box.max[axis] - world.min[axis] + 1) / -unit[axis],
          );
      }
      const result: SurfacePath = {
        status: "unknown",
        outward,
        distance: travel,
        blockers: [],
        uncertain: [],
      };
      if (!numericalDomain) {
        result.reason =
          "Model coordinates exceed the supported numerical domain.";
        return result;
      }
      if (
        triangleTests > triangleLimit ||
        pairQueries > caps.pairQueries ||
        broadPhaseQueries > broadPhaseLimit
      ) {
        result.reason = "The collision work budget was reached.";
        return result;
      }
      if (
        !moving.length ||
        moving.length !== movingIds.length ||
        moving.some((b) => !b.shape) ||
        !Number.isFinite(travel) ||
        travel <= 0 ||
        travel > caps.maxTravel ||
        !unit.lengthSq()
      ) {
        result.reason =
          "Moving geometry, external start or straight travel exceeds the supported domain.";
        return result;
      }
      const own = new Set(movingIds);
      for (const id of obstacleIds) {
        if (own.has(id)) continue;
        const o = allById.get(id);
        if (!o) {
          result.uncertain.push(id);
          continue;
        }
        const obstacle = body(o);
        for (const a of moving) {
          const state = pair(a, obstacle, outward, travel);
          if (state === "blocked") {
            result.blockers.push(id);
            break;
          }
          if (state === "unknown") result.uncertain.push(id);
        }
        if (
          triangleTests > triangleLimit ||
          pairQueries > caps.pairQueries ||
          broadPhaseQueries > broadPhaseLimit
        ) {
          result.reason = "The collision work budget was reached.";
          result.uncertain.push(id);
          break;
        }
      }
      result.blockers = [...new Set(result.blockers)];
      result.uncertain = [...new Set(result.uncertain)];
      result.status = result.reason
        ? "unknown"
        : result.blockers.length
          ? "blocked"
          : result.uncertain.length
            ? "unknown"
            : "clear";
      return result;
    });
  };
  return {
    check,
    body,
    beginReplay: () => {
      if (!replay) {
        triangleLimit = caps.triangleTests;
        broadPhaseLimit = caps.broadPhaseQueries;
        replay = true;
      }
    },
    stats: () => ({
      triangles,
      triangleTests,
      pairQueries,
      broadPhaseQueries,
      sourceCharacters,
      exhausted,
    }),
    dispose: () => {
      for (const s of shapes.values()) s?.geometry.dispose();
    },
  };
}
