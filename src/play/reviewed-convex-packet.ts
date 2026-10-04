import RAPIER from "@dimforge/rapier3d-compat";
import { ensure, type Vec3 } from "../core/types";
import { MECHANICAL_CONTACT_LIMITS } from "./mechanical-solids";

/** Generated source-reviewed region, already projected to the shared native
 * Float32 lattice. Positions and vertices are in part-local native metres.
 * Exact supporting facets are supplied by the generator; native QuickHull
 * must not replace them. Lower-dimensional support is retained explicitly. */
export type ReviewedConvexRegion = {
  id: number;
  rank: 0 | 1 | 2 | 3;
  position: Vec3;
  vertices: number[];
  triangles: number[];
  extremes: number[];
  /** Source-volume class, not a classification of rounded native bounds. */
  planeClass: -1 | 0 | 1;
};
export type ReviewedNativeChild = {
  shape: RAPIER.Shape;
  position: RAPIER.Vector;
  sourceRegionId: number;
  planeClass: -1 | 0 | 1;
};

/** Prepare reviewed generated geometry without allocating world colliders.
 * Caller must additionally bind the packet to the actual source occurrence
 * and include every returned primitive in the aggregate session budget. */
export function prepareReviewedConvexRegions(
  regions: readonly ReviewedConvexRegion[],
) {
  ensure(
    regions.length > 0 &&
      regions.length <= MECHANICAL_CONTACT_LIMITS.solidsPerMember,
    "LIMIT_EXCEEDED",
    "This mechanism is too complex to check safely. Try fewer moving parts.",
  );
  let childCount = 0;
  const ids = new Set<number>();
  for (const region of regions) {
    ensure(
      Number.isSafeInteger(region.id) && region.id >= 0 && !ids.has(region.id),
      "INVALID_INPUT",
      "Reviewed geometry has an invalid region identifier",
    );
    ids.add(region.id);
    ensure(
      [0, 1, 2, 3].includes(region.rank) &&
        [-1, 0, 1].includes(region.planeClass),
      "INVALID_INPUT",
      "Reviewed geometry has an invalid support class",
    );
    ensure(
      region.vertices.length >= 3 &&
        region.vertices.length % 3 === 0 &&
        region.vertices.length / 3 <= MECHANICAL_CONTACT_LIMITS.hullPoints &&
        region.position.length === 3 &&
        [...region.vertices, ...region.position].every(
          (v) => Number.isFinite(v) && Math.fround(v) === v,
        ),
      "INVALID_INPUT",
      "Reviewed geometry requires finite shared Float32 coordinates",
    );
    const count = region.vertices.length / 3;
    ensure(
      region.triangles.length <= 6 * MECHANICAL_CONTACT_LIMITS.hullPoints &&
        region.extremes.length <= MECHANICAL_CONTACT_LIMITS.hullPoints &&
        region.triangles.length % 3 === 0 &&
        [...region.triangles, ...region.extremes].every(
          (i) => Number.isInteger(i) && i >= 0 && i < count,
        ),
      "INVALID_INPUT",
      "Reviewed geometry has invalid supporting facets",
    );
    ensure(
      region.rank >= 2
        ? region.triangles.length >= 3
        : region.extremes.length === (region.rank === 1 ? 2 : 1),
      "INVALID_INPUT",
      "Reviewed geometry has incomplete support",
    );
    childCount += region.rank === 2 ? region.triangles.length / 3 : 1;
    ensure(
      childCount <= MECHANICAL_CONTACT_LIMITS.solidsPerMember,
      "LIMIT_EXCEEDED",
      "This mechanism is too complex to check safely. Try fewer moving parts.",
      {
        limit: "reviewedNativeChildren",
        actual: childCount,
        maximum: MECHANICAL_CONTACT_LIMITS.solidsPerMember,
      },
    );
  }
  const children: ReviewedNativeChild[] = [];
  const vector = (p: readonly number[]) => ({ x: p[0], y: p[1], z: p[2] });
  for (const region of regions) {
    const point = (i: number) =>
      vector(region.vertices.slice(i * 3, i * 3 + 3));
    const add = (shape: RAPIER.Shape) => {
      const raw = shape.intoRaw();
      ensure(
        raw,
        "INVALID_INPUT",
        "This part cannot be checked safely. Try a simpler mechanism.",
        { regionId: region.id, stage: "reviewedNativeAdmission" },
      );
      raw.free();
      children.push({
        shape,
        position: vector(region.position),
        sourceRegionId: region.id,
        planeClass: region.planeClass,
      });
    };
    if (region.rank === 3) {
      // Different input IDs may carry the same shared coordinate. Rapier's
      // explicit polyhedron constructor requires one ID per exact coordinate.
      const unique: number[] = [],
        keys = new Map<string, number>(),
        remap: number[] = [];
      for (let i = 0; i < region.vertices.length; i += 3) {
        const p = region.vertices.slice(i, i + 3),
          key = p.join(",");
        let index = keys.get(key);
        if (index === undefined) {
          index = unique.length / 3;
          keys.set(key, index);
          unique.push(...p);
        }
        remap.push(index);
      }
      add(
        new RAPIER.ConvexPolyhedron(
          Float32Array.from(unique),
          Uint32Array.from(region.triangles.map((i) => remap[i])),
        ),
      );
    } else if (region.rank === 2) {
      for (let i = 0; i < region.triangles.length; i += 3)
        add(
          new RAPIER.Triangle(
            point(region.triangles[i]),
            point(region.triangles[i + 1]),
            point(region.triangles[i + 2]),
          ),
        );
    } else if (region.rank === 1)
      add(
        new RAPIER.Segment(
          point(region.extremes[0]),
          point(region.extremes[1]),
        ),
      );
    else {
      // A rank-zero point may have nonzero local coordinates. Keep its actual
      // position rather than replacing it with the child origin.
      const p = point(region.extremes[0]);
      const raw = new RAPIER.Ball(0).intoRaw();
      ensure(raw, "INVALID_INPUT", "A reviewed point could not be prepared");
      raw.free();
      children.push({
        shape: new RAPIER.Ball(0),
        position: {
          x: region.position[0] + p.x,
          y: region.position[1] + p.y,
          z: region.position[2] + p.z,
        },
        sourceRegionId: region.id,
        planeClass: region.planeClass,
      });
    }
  }
  return { children, childCount };
}
