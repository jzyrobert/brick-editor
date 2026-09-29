import * as THREE from "three";

/**
 * Render-side post-process for compiled part geometry (spec §13; see
 * docs/RENDERING.md "Frame cost"). LDrawLoader emits non-indexed triangles:
 * every corner is its own vertex, so the GPU runs the vertex shader three
 * times per triangle and cannot reuse transformed vertices. Indexing merges
 * corners whose every attribute is bit-identical (exact, no tolerance: shading,
 * picking, collision and export see the same positions and normals), which on
 * LDraw parts typically leaves 25–45% of the vertices and lets the
 * post-transform cache skip repeated corners.
 *
 * The geometry is changed in place so every mesh (and every colour variant)
 * sharing it follows. Groups keep their numbering: a non-indexed group counts
 * vertices, an indexed one counts indices, and index i replaces vertex i.
 * Anything unusual (interleaved/morph attributes, non-32-bit components,
 * non-triangle counts, draw ranges) is left untouched.
 */
export function indexTriangleGeometry(geometry: THREE.BufferGeometry): {
  indexed: boolean;
  before: number;
  after: number;
} {
  const position = geometry.getAttribute("position");
  const count = position?.count ?? 0;
  const none = { indexed: false, before: count, after: count };
  if (
    geometry.index ||
    !position ||
    count < 3 ||
    count % 3 !== 0 ||
    Object.keys(geometry.morphAttributes).length ||
    geometry.drawRange.start !== 0 ||
    geometry.drawRange.count !== Infinity
  )
    return none;
  const names = Object.keys(geometry.attributes);
  const sources: Array<{
    name: string;
    attribute: THREE.BufferAttribute;
    words: Uint32Array;
    size: number;
  }> = [];
  for (const name of names) {
    const attribute = geometry.attributes[name] as THREE.BufferAttribute;
    const array = attribute.array as ArrayBufferView & ArrayLike<number>;
    if (
      (attribute as unknown as THREE.InterleavedBufferAttribute)
        .isInterleavedBufferAttribute ||
      attribute.count !== count ||
      !(
        array instanceof Float32Array ||
        array instanceof Uint32Array ||
        array instanceof Int32Array
      )
    )
      return none;
    sources.push({
      name,
      attribute,
      words: new Uint32Array(array.buffer, array.byteOffset, array.length),
      size: attribute.itemSize,
    });
  }
  // Open-addressing hash of every vertex's attribute words.
  let capacity = 1;
  while (capacity < count * 2) capacity <<= 1;
  const mask = capacity - 1;
  const table = new Int32Array(capacity).fill(-1);
  const remap = new Uint32Array(count);
  const unique = new Uint32Array(count);
  let uniqueCount = 0;
  const same = (a: number, b: number) => {
    for (const { words, size } of sources) {
      const x = a * size,
        y = b * size;
      for (let k = 0; k < size; k++)
        if (words[x + k] !== words[y + k]) return false;
    }
    return true;
  };
  for (let v = 0; v < count; v++) {
    let hash = 0x811c9dc5;
    for (const { words, size } of sources) {
      const offset = v * size;
      for (let k = 0; k < size; k++)
        hash = Math.imul(hash ^ words[offset + k], 0x01000193);
    }
    let slot = (hash ^ (hash >>> 15)) & mask;
    for (;;) {
      const found = table[slot];
      if (found < 0) {
        table[slot] = uniqueCount;
        unique[uniqueCount] = v;
        remap[v] = uniqueCount++;
        break;
      }
      if (same(unique[found], v)) {
        remap[v] = found;
        break;
      }
      slot = (slot + 1) & mask;
    }
  }
  if (uniqueCount === count) return none;
  for (const { name, attribute, words, size } of sources) {
    const Typed = (attribute.array as Float32Array).constructor as
      | Float32ArrayConstructor
      | Uint32ArrayConstructor
      | Int32ArrayConstructor;
    const out = new Typed(uniqueCount * size);
    const outWords = new Uint32Array(out.buffer);
    for (let u = 0; u < uniqueCount; u++) {
      const from = unique[u] * size,
        to = u * size;
      for (let k = 0; k < size; k++) outWords[to + k] = words[from + k];
    }
    const next = new THREE.BufferAttribute(out, size, attribute.normalized);
    next.name = attribute.name;
    next.usage = attribute.usage;
    geometry.setAttribute(name, next);
  }
  const index =
    uniqueCount <= 65536 ? new Uint16Array(count) : new Uint32Array(count);
  index.set(remap);
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  return { indexed: true, before: count, after: uniqueCount };
}

const indexedGeometries = new WeakSet<THREE.BufferGeometry>();

/**
 * Index the triangle meshes of a compiled prototype once per geometry
 * (colour variants share one). The prototype has not been drawn yet when this
 * runs, but a preview may have uploaded it: the geometry is disposed first so
 * three releases the GPU copies of the replaced non-indexed attributes.
 * Returns vertex totals before/after for diagnostics.
 */
export function indexPrototypeGeometry(root: THREE.Object3D) {
  let before = 0,
    after = 0;
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry;
    if (indexedGeometries.has(geometry)) return;
    indexedGeometries.add(geometry);
    if (geometry.index) return;
    geometry.dispose();
    const result = indexTriangleGeometry(geometry);
    before += result.before;
    after += result.after;
  });
  return { before, after };
}
