import type { Vec3 } from "../core/types";

/**
 * Where the explorer stands on a locomotive, in the lead car's pivot frame
 * (LDraw units: +X forward along the track, +Y down, +Z to the side, the
 * origin on the rail tops between the car's pivots).
 */
export type TrainCab = {
  /** The feet at the controls. */
  feet: Vec3;
  /** Whether the spot has a roof over it (a cab rather than an open deck). */
  enclosed: boolean;
  /** The car's extent along the track and to either side. */
  extent: { minX: number; maxX: number; halfWidth: number };
};

/** Headroom a standing figure needs over a floor (LDU). */
const HEADROOM = 72;
/** Floors lower than this above the rail tops are chassis, not a deck. */
const MIN_FLOOR = 20;
/** Where to look for the cab, as fractions of the car's length from its front. */
const ALONG = [0.2, 0.3, 0.15, 0.4, 0.1, 0.5, 0.6, 0.7, 0.8];

/**
 * Heights (local Y, down positive) where a vertical line at (x, z) crosses
 * the car's triangles.
 */
function crossings(
  vertices: ArrayLike<number>,
  indices: ArrayLike<number>,
  x: number,
  z: number,
) {
  const out: number[] = [];
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const a = indices[i] * 3,
      b = indices[i + 1] * 3,
      c = indices[i + 2] * 3;
    const ax = vertices[a],
      az = vertices[a + 2],
      bx = vertices[b],
      bz = vertices[b + 2],
      cx = vertices[c],
      cz = vertices[c + 2];
    if (
      x < Math.min(ax, bx, cx) ||
      x > Math.max(ax, bx, cx) ||
      z < Math.min(az, bz, cz) ||
      z > Math.max(az, bz, cz)
    )
      continue;
    const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(det) < 1e-9) continue; // vertical triangle
    const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det,
      v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det,
      w = 1 - u - v;
    if (u < -1e-6 || v < -1e-6 || w < -1e-6) continue;
    out.push(u * vertices[a + 1] + v * vertices[b + 1] + w * vertices[c + 1]);
  }
  return out.sort((p, q) => q - p); // lowest (largest Y) first
}

/**
 * Finds the driver's place on a locomotive from its collision mesh: the
 * lowest floor near the front with headroom under a roof (the cab), or,
 * failing that, the lowest open deck; failing both, a deck height a train
 * base on bogies would have. Deterministic and independent of the pose.
 */
export function trainCab(
  vertices: ArrayLike<number>,
  indices: ArrayLike<number>,
): TrainCab {
  let minX = Infinity,
    maxX = -Infinity,
    halfWidth = 0;
  for (let v = 0; v + 2 < vertices.length; v += 3) {
    minX = Math.min(minX, vertices[v]);
    maxX = Math.max(maxX, vertices[v]);
    halfWidth = Math.max(halfWidth, Math.abs(vertices[v + 2]));
  }
  if (!(maxX > minX)) {
    // No mesh: a 6 × 24 base on bogies, a quarter back from the front.
    return {
      feet: [120, -71, 0],
      enclosed: false,
      extent: { minX: -240, maxX: 240, halfWidth: 60 },
    };
  }
  const extent = { minX, maxX, halfWidth };
  let open: Vec3 | undefined;
  for (const f of ALONG) {
    const x = maxX - f * (maxX - minX);
    const ys = crossings(vertices, indices, x, 0);
    for (let i = 0; i < ys.length; i++) {
      const floor = ys[i];
      if (-floor < MIN_FLOOR) continue;
      // The next surface above this one (skipping a floor's own thickness).
      const above = ys.slice(i + 1).find((y) => floor - y > 1);
      if (above === undefined) {
        open ??= [x, floor, 0];
        break;
      }
      if (floor - above >= HEADROOM)
        return { feet: [x, floor, 0], enclosed: true, extent };
    }
  }
  return {
    feet: open ?? [maxX - 0.25 * (maxX - minX), -71, 0],
    enclosed: false,
    extent,
  };
}

/**
 * Local points beside the car to step off onto, nearest first: either side
 * of the cab, then along the car, clear of its widest part.
 */
export function alightPoints(cab: TrainCab): Vec3[] {
  const { minX, maxX, halfWidth } = cab.extent;
  const out: Vec3[] = [];
  const along = [cab.feet[0], (minX + maxX) / 2, maxX, minX];
  for (const reach of [40, 80, 130])
    for (const x of along)
      for (const side of [-1, 1])
        out.push([x, 0, side * (halfWidth + 12 + reach)]);
  return out;
}
