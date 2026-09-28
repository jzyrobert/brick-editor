/**
 * Lossless compaction of a Play collision triangle soup.
 *
 * Rendered LDraw geometry reaches Play as one vertex per triangle corner, and the
 * pinned loader emits a reversed twin for every non-certified (double-sided) face.
 * Rapier trimesh queries used by Play are two-sided, so a reversed twin or an exact
 * duplicate adds no collision surface: it only doubles the triangles every character
 * query must test where geometry is dense. Compaction therefore:
 * - welds bit-identical vertex positions (no tolerance, so no surface moves),
 * - drops triangles whose welded corners repeat or whose area is exactly zero,
 * - keeps one triangle per unordered corner set, the first in source order.
 * The kept triangles are a subset of the input, with their original winding.
 */
export type CompactCollisionMesh = {
  vertices: Float32Array;
  indices: Uint32Array;
  stats: {
    inputTriangles: number;
    triangles: number;
    inputVertices: number;
    vertices: number;
    duplicateTriangles: number;
    degenerateTriangles: number;
  };
};

function hashTable(size: number) {
  let capacity = 16;
  while (capacity < size * 2) capacity *= 2;
  return { keys: new Int32Array(capacity).fill(-1), mask: capacity - 1 };
}

// Murmur3-style mixing: float bit patterns of round coordinates share their low bits,
// so each input word is avalanched before it reaches the power-of-two table mask.
const avalanche = (h: number) => {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
};
const mix = (h: number, v: number) => avalanche(h ^ avalanche(v));

export function compactCollisionMesh(
  vertices: ArrayLike<number>,
  indices: ArrayLike<number>,
): CompactCollisionMesh {
  const inputVertices = Math.floor(vertices.length / 3);
  const positions = Float32Array.from(vertices);
  const bits = new Uint32Array(positions.buffer);
  // Weld exact positions. `-0` and `0` differ in bits but are the same point.
  for (let i = 0; i < positions.length; i++)
    if (positions[i] === 0) positions[i] = 0;
  const weld = hashTable(inputVertices);
  const remap = new Uint32Array(inputVertices);
  const welded: number[] = [];
  let count = 0;
  for (let v = 0; v < inputVertices; v++) {
    const x = bits[v * 3],
      y = bits[v * 3 + 1],
      z = bits[v * 3 + 2];
    let slot = mix(mix(mix(0x811c9dc5, x), y), z) & weld.mask;
    for (;;) {
      const found = weld.keys[slot];
      if (found < 0) {
        weld.keys[slot] = v;
        remap[v] = count++;
        welded.push(v);
        break;
      }
      if (
        bits[found * 3] === x &&
        bits[found * 3 + 1] === y &&
        bits[found * 3 + 2] === z
      ) {
        remap[v] = remap[found];
        break;
      }
      slot = (slot + 1) & weld.mask;
    }
  }
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const source = welded[i] * 3;
    out[i * 3] = positions[source];
    out[i * 3 + 1] = positions[source + 1];
    out[i * 3 + 2] = positions[source + 2];
  }
  const inputTriangles = Math.floor(indices.length / 3);
  const kept = new Uint32Array(inputTriangles * 3);
  const seen = hashTable(inputTriangles);
  let triangles = 0,
    duplicateTriangles = 0,
    degenerateTriangles = 0;
  for (let t = 0; t < inputTriangles; t++) {
    const a = remap[indices[t * 3]],
      b = remap[indices[t * 3 + 1]],
      c = remap[indices[t * 3 + 2]];
    if (a === b || b === c || a === c) {
      degenerateTriangles++;
      continue;
    }
    const ux = out[b * 3] - out[a * 3],
      uy = out[b * 3 + 1] - out[a * 3 + 1],
      uz = out[b * 3 + 2] - out[a * 3 + 2],
      vx = out[c * 3] - out[a * 3],
      vy = out[c * 3 + 1] - out[a * 3 + 1],
      vz = out[c * 3 + 2] - out[a * 3 + 2];
    if (
      uy * vz - uz * vy === 0 &&
      uz * vx - ux * vz === 0 &&
      ux * vy - uy * vx === 0
    ) {
      degenerateTriangles++;
      continue;
    }
    const lo = Math.min(a, b, c),
      hi = Math.max(a, b, c),
      mid = a + b + c - lo - hi;
    let slot = mix(mix(mix(0x811c9dc5, lo), mid), hi) & seen.mask;
    let duplicate = false;
    for (;;) {
      const found = seen.keys[slot];
      if (found < 0) {
        seen.keys[slot] = triangles;
        break;
      }
      const p = kept[found * 3],
        q = kept[found * 3 + 1],
        r = kept[found * 3 + 2];
      if (
        Math.min(p, q, r) === lo &&
        Math.max(p, q, r) === hi &&
        p + q + r - lo - hi === mid
      ) {
        duplicate = true;
        break;
      }
      slot = (slot + 1) & seen.mask;
    }
    if (duplicate) {
      duplicateTriangles++;
      continue;
    }
    kept[triangles * 3] = a;
    kept[triangles * 3 + 1] = b;
    kept[triangles * 3 + 2] = c;
    triangles++;
  }
  return {
    vertices: out,
    indices: kept.slice(0, triangles * 3),
    stats: {
      inputTriangles,
      triangles,
      inputVertices,
      vertices: count,
      duplicateTriangles,
      degenerateTriangles,
    },
  };
}
