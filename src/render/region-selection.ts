import * as THREE from "three";
import { ensure } from "../core/types";
export type Point2 = [number, number];
/**
 * Visible: only parts you can see (a depth-tested ID image of what is drawn).
 * Through: every shown part whose projected outline meets the rule, at any depth.
 */
export type RegionMode = "visible" | "through";
/** When a part counts as inside the region. */
export type Containment = "touching" | "centre" | "inside";
export const DEFAULT_CONTAINMENT: Readonly<Record<RegionMode, Containment>> =
  Object.freeze({ visible: "touching", through: "centre" });
/** Visible parts need at least this many seen pixels inside the region (or all of
 * them, when a part shows fewer), so a region edge grazing a part, or a sliver
 * seen through a gap, does not grab it. */
export const VISIBLE_PIXEL_THRESHOLD = 4;
export const REGION_LIMITS = Object.freeze({
  /** CSS pixels of the ID image. */
  pixels: 4_000_000,
  lassoPoints: 2048,
  /** Polygon edge tests per evaluation (outline versus lasso). */
  edgeWork: 40_000_000,
});

/** Boundary-inclusive even/odd polygon test, in CSS pixels. */
export function insidePolygon(p: Point2, polygon: Point2[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j],
      b = polygon[i];
    const cross = (p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0]);
    if (
      Math.abs(cross) < 1e-7 &&
      p[0] >= Math.min(a[0], b[0]) &&
      p[0] <= Math.max(a[0], b[0]) &&
      p[1] >= Math.min(a[1], b[1]) &&
      p[1] <= Math.max(a[1], b[1])
    )
      return true;
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
/** Even/odd scanline spans avoid polygon-edge work for every readback pixel. */
export function scanlineSpans(
  y: number,
  polygon: Point2[],
): [number, number][] {
  const crossings: number[] = [],
    spans: [number, number][] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length];
    if (a[1] === y && b[1] === y)
      spans.push([Math.min(a[0], b[0]), Math.max(a[0], b[0])]);
    if (a[1] > y !== b[1] > y)
      crossings.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
  }
  crossings.sort((a, b) => a - b);
  for (let i = 0; i + 1 < crossings.length; i += 2)
    spans.push([crossings[i], crossings[i + 1]]);
  return spans;
}
function segmentsIntersect(a: Point2, b: Point2, c: Point2, d: Point2) {
  const cross = (a: Point2, b: Point2, c: Point2) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const abC = cross(a, b, c),
    abD = cross(a, b, d),
    cdA = cross(c, d, a),
    cdB = cross(c, d, b);
  return (
    abC * abD <= 0 &&
    cdA * cdB <= 0 &&
    Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <=
      Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) &&
    Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <=
      Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1]))
  );
}
function edgesCross(a: Point2[], b: Point2[]) {
  return a.some((p, i) =>
    b.some((q, j) =>
      segmentsIntersect(p, a[(i + 1) % a.length], q, b[(j + 1) % b.length]),
    ),
  );
}
export function polygonsIntersect(a: Point2[], b: Point2[]) {
  if (a.some((p) => insidePolygon(p, b)) || b.some((p) => insidePolygon(p, a)))
    return true;
  return edgesCross(a, b);
}
/** Whether a polygon lies wholly inside another (touching the boundary counts). */
export function polygonInside(inner: Point2[], outer: Point2[]) {
  if (!inner.every((p) => insidePolygon(p, outer))) return false;
  // A convex region contains the hull of contained points; a concave lasso
  // may still cut across an edge between two contained corners.
  return isConvex(outer) || !edgesCross(inner, outer);
}
export function isConvex(polygon: Point2[]) {
  let sign = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length],
      c = polygon[(i + 2) % polygon.length];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cross) < 1e-9) continue;
    const s = Math.sign(cross);
    if (sign && s !== sign) return false;
    sign = s;
  }
  return true;
}
/** Monotone-chain convex hull (counter-clockwise in screen space, no repeats). */
export function convexHull(points: Point2[]): Point2[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o: Point2, a: Point2, b: Point2) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Point2[] = [],
    upper: Point2[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, p) <= 0)
      lower.pop();
    lower.push(p);
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, p) <= 0)
      upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
/** Clip before perspective divide: triangles crossing the near plane must not wrap across the viewport. */
export function clipTriangle(vertices: THREE.Vector4[]) {
  let poly = vertices;
  const planes = [
    (p: THREE.Vector4) => p.w + p.x,
    (p: THREE.Vector4) => p.w - p.x,
    (p: THREE.Vector4) => p.w + p.y,
    (p: THREE.Vector4) => p.w - p.y,
    (p: THREE.Vector4) => p.w + p.z,
    (p: THREE.Vector4) => p.w - p.z,
  ];
  for (const distance of planes) {
    const out: THREE.Vector4[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length],
        da = distance(a),
        db = distance(b);
      if (da >= 0) out.push(a);
      if (da >= 0 !== db >= 0) out.push(a.clone().lerp(b, da / (da - db)));
    }
    poly = out;
  }
  return poly.filter((p) => p.w > 1e-9);
}

/** A part's projected outline (convex hull of its box, clipped to the view). */
export type Footprint = {
  id: string;
  hull: Point2[];
  /** Projected box centre; null when it is behind the camera or off screen. */
  centre: Point2 | null;
  /** The outline was cut by the view edges: part of the part is off screen. */
  clipped: boolean;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};
const BOX_FACES = [
  [0, 1, 3, 2],
  [4, 6, 7, 5],
  [0, 4, 5, 1],
  [2, 3, 7, 6],
  [0, 2, 6, 4],
  [1, 5, 7, 3],
];
const scratchCorners = Array.from({ length: 8 }, () => new THREE.Vector4());
/**
 * Project a local box through `matrix` (local → clip space) into CSS pixels.
 * Corners inside the view are projected directly; otherwise the box faces are
 * clipped first so parts crossing the camera plane keep an honest outline.
 */
export function boxFootprint(
  id: string,
  box: THREE.Box3,
  matrix: THREE.Matrix4,
  width: number,
  height: number,
): Footprint | null {
  const toScreen = (p: THREE.Vector4): Point2 => [
    ((p.x / p.w + 1) * width) / 2,
    ((1 - p.y / p.w) * height) / 2,
  ];
  let inside = true;
  for (let i = 0; i < 8; i++) {
    const c = scratchCorners[i].set(
      i & 1 ? box.max.x : box.min.x,
      i & 2 ? box.max.y : box.min.y,
      i & 4 ? box.max.z : box.min.z,
      1,
    );
    c.applyMatrix4(matrix);
    if (
      !(c.w > 1e-9) ||
      Math.abs(c.x) > c.w ||
      Math.abs(c.y) > c.w ||
      Math.abs(c.z) > c.w
    )
      inside = false;
  }
  let points: Point2[];
  if (inside) points = scratchCorners.map(toScreen);
  else {
    points = [];
    for (const face of BOX_FACES)
      for (const [a, b, c] of [
        [face[0], face[1], face[2]],
        [face[0], face[2], face[3]],
      ])
        for (const p of clipTriangle([
          scratchCorners[a],
          scratchCorners[b],
          scratchCorners[c],
        ]))
          points.push(toScreen(p));
    if (points.length < 3) return null;
  }
  const hull = convexHull(points);
  if (hull.length < 1) return null;
  const centre = new THREE.Vector4(
    (box.min.x + box.max.x) / 2,
    (box.min.y + box.max.y) / 2,
    (box.min.z + box.max.z) / 2,
    1,
  ).applyMatrix4(matrix);
  const centreShown =
    centre.w > 1e-9 &&
    Math.abs(centre.x) <= centre.w &&
    Math.abs(centre.y) <= centre.w &&
    Math.abs(centre.z) <= centre.w;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of hull) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return {
    id,
    hull,
    centre: centreShown ? toScreen(centre) : null,
    clipped: !inside,
    minX,
    minY,
    maxX,
    maxY,
  };
}
type Region = {
  polygon: Point2[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  convex: boolean;
};
export function region(polygon: Point2[]): Region {
  ensure(
    polygon.length >= 3 &&
      polygon.length <= REGION_LIMITS.lassoPoints &&
      polygon.every((p) => p.length === 2 && p.every(Number.isFinite)),
    "INVALID_SELECTION",
    "Use a bounded finite selection polygon",
  );
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of polygon) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { polygon, minX, minY, maxX, maxY, convex: isConvex(polygon) };
}
/** Through-mode rule for one outline. `work` counts edge tests for the budget. */
export function footprintMatches(
  f: Footprint,
  r: Region,
  rule: Containment,
  work = { edges: 0 },
): boolean {
  if (rule === "centre")
    return (
      !!f.centre &&
      f.centre[0] >= r.minX &&
      f.centre[0] <= r.maxX &&
      f.centre[1] >= r.minY &&
      f.centre[1] <= r.maxY &&
      insidePolygon(f.centre, r.polygon)
    );
  if (f.maxX < r.minX || f.minX > r.maxX || f.maxY < r.minY || f.minY > r.maxY)
    return false;
  if (rule === "inside") {
    if (
      f.clipped ||
      f.minX < r.minX ||
      f.maxX > r.maxX ||
      f.minY < r.minY ||
      f.maxY > r.maxY
    )
      return false;
    work.edges += f.hull.length * r.polygon.length;
    return polygonInside(f.hull, r.polygon);
  }
  // Touching: any overlap of outline and region.
  if (f.centre && insidePolygon(f.centre, r.polygon)) return true;
  work.edges += f.hull.length * r.polygon.length;
  ensure(
    work.edges <= REGION_LIMITS.edgeWork,
    "SELECTION_BUDGET",
    "Selection is too complex; use a smaller region or a simpler lasso",
  );
  return polygonsIntersect(f.hull, r.polygon);
}

/**
 * What the Visible ID pass saw, one entry per CSS pixel: the index of the drawn
 * occurrence (or -1), with each occurrence's seen pixel count and whether it
 * reaches the view's edge (so it may continue off screen).
 */
export type IdCoverage = {
  width: number;
  height: number;
  ids: string[];
  pixels: Int32Array;
  totals: Uint32Array;
  edge: Uint8Array;
  /** Draw calls the ID pass issued (one per batch draw, not per part). */
  draws?: number;
};
export function coverageFromIds(
  width: number,
  height: number,
  ids: string[],
  pixels: Int32Array,
): IdCoverage {
  const totals = new Uint32Array(ids.length),
    edge = new Uint8Array(ids.length);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const id = pixels[y * width + x];
      if (id < 0) continue;
      totals[id]++;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1)
        edge[id] = 1;
    }
  return { width, height, ids, pixels, totals, edge };
}
/**
 * Visible-mode rule over the ID image (pixel centres inside the region):
 * touching needs `VISIBLE_PIXEL_THRESHOLD` seen pixels inside (or all of a
 * smaller part); centre needs the projected centre inside and some pixel seen
 * inside; inside needs every seen pixel inside and none at the view's edge.
 */
export function coverageMatches(
  coverage: IdCoverage,
  polygon: Point2[],
  rule: Containment,
  centre?: (id: string) => Point2 | null,
): string[] {
  const r = region(polygon);
  const { width, height, pixels, totals, edge, ids } = coverage;
  const counts = new Uint32Array(ids.length),
    touched: number[] = [];
  const y0 = Math.max(0, Math.floor(r.minY)),
    y1 = Math.min(height, Math.ceil(r.maxY));
  for (let y = y0; y < y1; y++)
    for (const [left, right] of scanlineSpans(y + 0.5, polygon)) {
      const first = Math.max(0, Math.ceil(left - 0.5)),
        last = Math.min(width - 1, Math.floor(right - 0.5));
      const row = y * width;
      for (let x = first; x <= last; x++) {
        const id = pixels[row + x];
        if (id < 0) continue;
        if (counts[id]++ === 0) touched.push(id);
      }
    }
  touched.sort((a, b) => a - b);
  return touched
    .filter((i) => {
      const n = counts[i];
      if (rule === "inside") return n >= totals[i] && !edge[i];
      if (rule === "centre") {
        const c = centre?.(ids[i]);
        return !!c && insidePolygon(c, polygon);
      }
      return n >= Math.min(VISIBLE_PIXEL_THRESHOLD, totals[i]);
    })
    .map((i) => ids[i]);
}

/** One drawable of the ID pass: a batch draw, a merged batch, or a single mesh. */
export type IdSource =
  | {
      kind: "instanced";
      object: THREE.InstancedMesh;
      /** Occurrence of each instance, in instance order. */
      occurrenceIds: readonly string[];
    }
  | {
      kind: "merged";
      object: THREE.Mesh;
      /** Occurrence of each merged entry, and its vertex count. */
      occurrenceIds: readonly string[];
      vertexCounts: readonly number[];
    }
  | { kind: "single"; object: THREE.Mesh; occurrenceId: string };

const idVertex = `
#include <common>
#include <clipping_planes_pars_vertex>
uniform float idBase;
#ifdef SELECTION_ENTRY
attribute float selectionEntry;
#endif
varying vec3 vId;
void main() {
  float id = idBase;
#ifdef USE_INSTANCING
  id += float(gl_InstanceID);
#endif
#ifdef SELECTION_ENTRY
  id += selectionEntry;
#endif
  vId = vec3(mod(id, 256.0), mod(floor(id / 256.0), 256.0), floor(id / 65536.0)) / 255.0;
#include <begin_vertex>
#include <project_vertex>
#include <clipping_planes_vertex>
}`;
const idFragment = `
#include <clipping_planes_pars_fragment>
varying vec3 vId;
void main() {
#include <clipping_planes_fragment>
  gl_FragColor = vec4(vId, 1.0);
}`;
function idMaterial(base: number, side: THREE.Side, entries: boolean) {
  return new THREE.ShaderMaterial({
    vertexShader: idVertex,
    fragmentShader: idFragment,
    uniforms: { idBase: { value: base } },
    defines: entries ? { SELECTION_ENTRY: "" } : {},
    side,
    clipping: true,
    toneMapped: false,
  });
}
/** Per-vertex entry index of a merged batch, attached once to its own geometry. */
function entryAttribute(
  geometry: THREE.BufferGeometry,
  counts: readonly number[],
) {
  const existing = geometry.getAttribute("selectionEntry");
  if (existing) return;
  const total = counts.reduce((a, b) => a + b, 0);
  const values = new Float32Array(total);
  let offset = 0;
  counts.forEach((count, i) => {
    values.fill(i, offset, offset + count);
    offset += count;
  });
  geometry.setAttribute("selectionEntry", new THREE.BufferAttribute(values, 1));
}
/**
 * Render the ID pass: every source drawn once with an ID material (instanced
 * draws reuse their instance buffers; one draw per batch, not per part), depth
 * tested and clipped by the renderer's section planes, at one sample per CSS
 * pixel. Returns the per-pixel occurrence indices.
 */
export function renderIdCoverage(
  renderer: THREE.WebGLRenderer,
  camera: THREE.Camera,
  sources: IdSource[],
  width: number,
  height: number,
): IdCoverage {
  ensure(
    width > 0 && height > 0 && width * height <= REGION_LIMITS.pixels,
    "SELECTION_BUDGET",
    "Selection viewport exceeds four million CSS pixels",
  );
  const scene = new THREE.Scene();
  scene.matrixWorldAutoUpdate = false;
  const materials: THREE.Material[] = [];
  /** ID slot (1-based in the image) → occurrence index. */
  const slotToOccurrence: number[] = [0];
  const occurrenceIndex = new Map<string, number>(),
    ids: string[] = [];
  const index = (id: string) => {
    let i = occurrenceIndex.get(id);
    if (i === undefined) {
      i = ids.length;
      ids.push(id);
      occurrenceIndex.set(id, i);
    }
    return i;
  };
  for (const source of sources) {
    const list = source.object.material;
    const first = Array.isArray(list) ? list[0] : list;
    const side = Array.isArray(list)
      ? list.every((m) => m.side === first.side)
        ? first.side
        : THREE.DoubleSide
      : first.side;
    const base = slotToOccurrence.length;
    ensure(
      base < 0xffffff - 1,
      "SELECTION_BUDGET",
      "Selection needs more than sixteen million IDs",
    );
    let proxy: THREE.Mesh;
    if (source.kind === "instanced") {
      const draw = source.object;
      const material = idMaterial(base, side, false);
      const instanced = new THREE.InstancedMesh(draw.geometry, material, 0);
      // Share the batch's instance buffer (already on the GPU); never dispose it here.
      instanced.instanceMatrix = draw.instanceMatrix;
      instanced.count = draw.count;
      instanced.boundingSphere = draw.boundingSphere;
      proxy = instanced;
      materials.push(material);
      for (let i = 0; i < draw.count; i++)
        slotToOccurrence.push(index(source.occurrenceIds[i]));
    } else if (source.kind === "merged") {
      entryAttribute(source.object.geometry, source.vertexCounts);
      const material = idMaterial(base, side, true);
      proxy = new THREE.Mesh(source.object.geometry, material);
      materials.push(material);
      for (const id of source.occurrenceIds) slotToOccurrence.push(index(id));
    } else {
      const material = idMaterial(base, side, false);
      proxy = new THREE.Mesh(source.object.geometry, material);
      materials.push(material);
      slotToOccurrence.push(index(source.occurrenceId));
    }
    proxy.matrixAutoUpdate = false;
    proxy.matrixWorldAutoUpdate = false;
    proxy.matrix.copy(source.object.matrixWorld);
    proxy.matrixWorld.copy(source.object.matrixWorld);
    // The batches keep bounds for their draws: off-screen ones are skipped.
    proxy.frustumCulled = source.object.frustumCulled;
    scene.add(proxy);
  }
  const target = new THREE.WebGLRenderTarget(width, height, {
    depthBuffer: true,
    stencilBuffer: false,
    samples: 0,
  });
  const previous = renderer.getRenderTarget(),
    clearColor = renderer.getClearColor(new THREE.Color()),
    clearAlpha = renderer.getClearAlpha(),
    autoClear = renderer.autoClear,
    toneMapping = renderer.toneMapping,
    colorSpace = renderer.outputColorSpace;
  const rgba = new Uint8Array(width * height * 4);
  try {
    // The target's own viewport covers it whatever the canvas pixel ratio.
    renderer.setRenderTarget(target);
    renderer.setClearColor(0, 0);
    renderer.autoClear = true;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, width, height, rgba);
  } finally {
    renderer.setRenderTarget(previous);
    renderer.setClearColor(clearColor, clearAlpha);
    renderer.autoClear = autoClear;
    renderer.toneMapping = toneMapping;
    renderer.outputColorSpace = colorSpace;
    target.dispose();
    for (const m of materials) m.dispose();
  }
  const pixels = new Int32Array(width * height);
  const slots = slotToOccurrence.length;
  for (let y = 0; y < height; y++) {
    // Readback rows run bottom-up.
    const source = (height - 1 - y) * width * 4,
      row = y * width;
    for (let x = 0; x < width; x++) {
      const o = source + x * 4;
      const slot = rgba[o] | (rgba[o + 1] << 8) | (rgba[o + 2] << 16);
      pixels[row + x] = slot > 0 && slot < slots ? slotToOccurrence[slot] : -1;
    }
  }
  return {
    ...coverageFromIds(width, height, ids, pixels),
    draws: sources.length,
  };
}

/** Everything a region gesture needs, captured once when it starts. */
export type RegionSnapshot =
  | {
      mode: "visible";
      coverage: IdCoverage;
      footprints: () => Map<string, Footprint>;
    }
  | { mode: "through"; footprints: Footprint[] };
/** Occurrences a region selects under a rule, from a snapshot (cheap to repeat). */
export function snapshotSelect(
  snapshot: RegionSnapshot,
  polygon: Point2[],
  rule: Containment,
): string[] {
  if (snapshot.mode === "visible")
    return coverageMatches(
      snapshot.coverage,
      polygon,
      rule,
      rule === "centre"
        ? (() => {
            const map = snapshot.footprints();
            return (id: string) => map.get(id)?.centre ?? null;
          })()
        : undefined,
    );
  const r = region(polygon),
    work = { edges: 0 };
  return snapshot.footprints
    .filter((f) => footprintMatches(f, r, rule, work))
    .map((f) => f.id);
}
