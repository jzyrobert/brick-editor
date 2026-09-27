import * as THREE from "three";
import { ensure } from "../core/types";
export type Point2 = [number, number];
export type RegionMode = "visible" | "through";
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
export function polygonsIntersect(a: Point2[], b: Point2[]) {
  if (a.some((p) => insidePolygon(p, b)) || b.some((p) => insidePolygon(p, a)))
    return true;
  return a.some((p, i) =>
    b.some((q, j) =>
      segmentsIntersect(p, a[(i + 1) % a.length], q, b[(j + 1) % b.length]),
    ),
  );
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
function meshes(group: THREE.Object3D) {
  const result: THREE.Mesh[] = [];
  group.traverseVisible((o) => {
    if (o instanceof THREE.Mesh) result.push(o);
  });
  return result;
}
/** Visible mode uses an actual depth-tested ID pass at one sample per CSS pixel.
 * All visible layers occlude, even if not editable. Through mode tests projected
 * clipped triangle coverage, never projected centres or bounding boxes alone.
 * Helpers, lines and fully transparent mesh materials do not select surfaces.
 */
export function selectRegion(
  renderer: THREE.WebGLRenderer,
  camera: THREE.Camera,
  handles: Map<string, THREE.Group>,
  polygon: Point2[],
  mode: RegionMode,
): string[] {
  ensure(
    polygon.length >= 3 &&
      polygon.length <= 2048 &&
      polygon.every((p) => p.every(Number.isFinite)),
    "INVALID_SELECTION",
    "Use a bounded finite selection polygon",
  );
  const rect = renderer.domElement.getBoundingClientRect(),
    width = Math.ceil(rect.width),
    height = Math.ceil(rect.height);
  ensure(
    width > 0 && height > 0 && width * height <= 4_000_000,
    "SELECTION_BUDGET",
    "Selection viewport exceeds four million CSS pixels",
  );
  const ids = [...handles].filter(([, g]) => g.visible);
  for (const [, g] of ids) g.updateWorldMatrix(true, true);
  camera.updateMatrixWorld(true);
  if (mode === "through") {
    const result: string[] = [];
    let triangles = 0,
      intersectionWork = 0;
    const regionMinX = Math.min(...polygon.map((p) => p[0])),
      regionMaxX = Math.max(...polygon.map((p) => p[0])),
      regionMinY = Math.min(...polygon.map((p) => p[1])),
      regionMaxY = Math.max(...polygon.map((p) => p[1]));
    for (const [id, group] of ids) {
      let found = false;
      for (const mesh of meshes(group)) {
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        if (materials.every((m) => !m.visible || m.opacity === 0)) continue;
        const geometry = mesh.geometry,
          position = geometry.getAttribute("position"),
          index = geometry.index;
        if (!position) continue;
        const mvp = new THREE.Matrix4()
          .multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
          .multiply(mesh.matrixWorld);
        const count = index ? index.count : position.count;
        for (
          let i = geometry.drawRange.start;
          i + 2 <
          Math.min(count, geometry.drawRange.start + geometry.drawRange.count);
          i += 3
        ) {
          ensure(
            ++triangles <= 5_000_000,
            "SELECTION_BUDGET",
            "Through-selection exceeds five million triangles",
          );
          if (
            Array.isArray(mesh.material) &&
            !geometry.groups.some((group) => {
              const material = materials[group.materialIndex ?? 0];
              return (
                i >= group.start &&
                i + 2 < group.start + group.count &&
                material?.visible &&
                material.opacity > 0
              );
            })
          )
            continue;
          const vertices = [0, 1, 2].map((j) => {
            const k = index ? index.getX(i + j) : i + j;
            return new THREE.Vector4(
              position.getX(k),
              position.getY(k),
              position.getZ(k),
              1,
            ).applyMatrix4(mvp);
          });
          const clipped = clipTriangle(vertices).map(
            (p) =>
              [
                ((p.x / p.w + 1) * width) / 2,
                ((1 - p.y / p.w) * height) / 2,
              ] as Point2,
          );
          if (
            clipped.length < 3 ||
            Math.max(...clipped.map((p) => p[0])) < regionMinX ||
            Math.min(...clipped.map((p) => p[0])) > regionMaxX ||
            Math.max(...clipped.map((p) => p[1])) < regionMinY ||
            Math.min(...clipped.map((p) => p[1])) > regionMaxY
          )
            continue;
          intersectionWork += clipped.length * polygon.length;
          ensure(
            intersectionWork <= 20_000_000,
            "SELECTION_BUDGET",
            "Selection is too complex; use a smaller region or simpler lasso",
          );
          if (polygonsIntersect(clipped, polygon)) {
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (found) result.push(id);
    }
    return result;
  }
  const scene = new THREE.Scene(),
    materials: THREE.Material[] = [];
  ids.forEach(([, group], i) => {
    const encoded = i + 1;
    for (const mesh of meshes(group)) {
      const source = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      const replacements = source.map((m) => {
        const material = new THREE.MeshBasicMaterial({
          color: new THREE.Color().setRGB(
            (encoded & 255) / 255,
            ((encoded >> 8) & 255) / 255,
            ((encoded >> 16) & 255) / 255,
          ),
          side: m.side,
          visible: m.visible && m.opacity > 0,
          toneMapped: false,
        });
        materials.push(material);
        return material;
      });
      const proxy = new THREE.Mesh(
        mesh.geometry,
        Array.isArray(mesh.material) ? replacements : replacements[0],
      );
      proxy.matrixAutoUpdate = false;
      proxy.matrix.copy(mesh.matrixWorld);
      scene.add(proxy);
    }
  });
  const target = new THREE.WebGLRenderTarget(width, height, {
    depthBuffer: true,
    stencilBuffer: false,
    samples: 0,
  });
  const previous = renderer.getRenderTarget(),
    viewport = renderer.getViewport(new THREE.Vector4()),
    scissor = renderer.getScissor(new THREE.Vector4()),
    scissorTest = renderer.getScissorTest(),
    clearColor = renderer.getClearColor(new THREE.Color()),
    clearAlpha = renderer.getClearAlpha(),
    autoClear = renderer.autoClear,
    toneMapping = renderer.toneMapping,
    colorSpace = renderer.outputColorSpace;
  try {
    renderer.setRenderTarget(target);
    renderer.setViewport(0, 0, width, height);
    renderer.setScissorTest(false);
    renderer.setClearColor(0, 0);
    renderer.autoClear = true;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.render(scene, camera);
    const x0 = Math.max(0, Math.floor(Math.min(...polygon.map((p) => p[0])))),
      x1 = Math.min(width, Math.ceil(Math.max(...polygon.map((p) => p[0])))),
      y0 = Math.max(0, Math.floor(Math.min(...polygon.map((p) => p[1])))),
      y1 = Math.min(height, Math.ceil(Math.max(...polygon.map((p) => p[1]))));
    if (x1 <= x0 || y1 <= y0) return [];
    const pixels = new Uint8Array((x1 - x0) * (y1 - y0) * 4);
    renderer.readRenderTargetPixels(
      target,
      x0,
      height - y1,
      x1 - x0,
      y1 - y0,
      pixels,
    );
    const selected = new Set<number>();
    for (let y = y0; y < y1; y++) {
      for (const [left, right] of scanlineSpans(y + 0.5, polygon)) {
        const first = Math.max(x0, Math.ceil(left - 0.5)),
          last = Math.min(x1 - 1, Math.floor(right - 0.5));
        for (let x = first; x <= last; x++) {
          const offset = ((y1 - 1 - y) * (x1 - x0) + x - x0) * 4,
            id =
              pixels[offset] +
              (pixels[offset + 1] << 8) +
              (pixels[offset + 2] << 16);
          if (id > 0 && id <= ids.length) selected.add(id - 1);
        }
      }
    }
    return ids.filter((_, i) => selected.has(i)).map(([id]) => id);
  } finally {
    renderer.setRenderTarget(previous);
    renderer.setViewport(viewport);
    renderer.setScissor(scissor);
    renderer.setScissorTest(scissorTest);
    renderer.setClearColor(clearColor, clearAlpha);
    renderer.autoClear = autoClear;
    renderer.toneMapping = toneMapping;
    renderer.outputColorSpace = colorSpace;
    target.dispose();
    for (const m of materials) m.dispose();
  }
}
