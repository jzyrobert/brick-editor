import { expect, it, vi } from "vitest";
import * as THREE from "three";
import {
  RenderBatches,
  transformTriangleGeometry,
  RAW_BATCH_LIMITS,
} from "../../src/render/batching";
import { RawPrimitiveCompiler } from "../../src/render/raw-primitives";
const colors = "0 !COLOUR White CODE 15 VALUE #FFFFFF EDGE #333333";
async function fixture(records: string[]) {
  const compiler = new RawPrimitiveCompiler(colors),
    scene = new THREE.Scene(),
    handles = new Map<string, THREE.Group>(),
    batches = new RenderBatches();
  scene.add(batches.root);
  for (let i = 0; i < records.length; i++) {
    const proto = await compiler.compile(records[i], "15", {
        source: "0 BFC CERTIFY CCW",
        forceDoubleSided: false,
      }),
      handle = proto.clone(true);
    handle.userData = { prototype: proto };
    handle.position.x = i * 10;
    scene.add(handle);
    handles.set(String(i), handle);
  }
  batches.rebuild(handles);
  const draw = () =>
    batches.render({ render: () => {} }, scene, new THREE.PerspectiveCamera());
  return { compiler, scene, handles, batches, draw };
}
it("merges mixed triangle/quad primitives, preserves handles and cumulative material ranges, updates visibility", async () => {
  const f = await fixture([
    "3 15 0 0 0 1 0 0 0 1 0",
    "4 15 0 0 0 1 0 0 1 1 0 0 1 0",
  ]);
  const original = f.handles.get("0")!,
    geometry = (original.children[0] as THREE.Mesh).geometry,
    positions = Array.from(geometry.getAttribute("position").array);
  f.draw();
  expect(f.batches.root.children).toHaveLength(1);
  const merged = (f.batches.root.children[0] as THREE.Mesh).geometry;
  expect(merged.getAttribute("position").count).toBe(9);
  expect(merged.groups).toEqual([{ start: 0, count: 9, materialIndex: 0 }]);
  expect(Array.from(merged.getAttribute("position").array).slice(9)).toContain(
    11,
  );
  expect(Array.from(geometry.getAttribute("position").array)).toEqual(
    positions,
  );
  expect(f.handles.get("0")).toBe(original);
  const dispose = vi.spyOn(merged, "dispose");
  original.visible = false;
  f.draw();
  expect(dispose).toHaveBeenCalledOnce();
  expect(original.visible).toBe(false);
  expect(
    (f.batches.root.children[0] as THREE.Mesh).geometry.getAttribute("position")
      .count,
  ).toBe(6);
  f.batches.dispose();
  f.compiler.dispose();
});
it("bakes reflected/sheared positions and inverse-transpose normals with corrected front winding", () => {
  const geometry = new THREE.BufferGeometry().setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 1], 3),
  );
  geometry.computeVertexNormals();
  const matrix = new THREE.Matrix4().set(
      -2,
      0.5,
      0,
      10,
      0,
      3,
      0.25,
      20,
      0,
      0,
      4,
      30,
      0,
      0,
      0,
      1,
    ),
    baked = transformTriangleGeometry(geometry, matrix);
  const expected = [0, 2, 1].map((i) =>
    new THREE.Vector3()
      .fromBufferAttribute(geometry.getAttribute("position"), i)
      .applyMatrix4(matrix),
  );
  const actual = [0, 1, 2].map((i) =>
    new THREE.Vector3().fromBufferAttribute(baked.getAttribute("position"), i),
  );
  actual.forEach((v, i) =>
    expect(v.distanceTo(expected[i])).toBeLessThan(1e-6),
  );
  const normal = new THREE.Vector3().fromBufferAttribute(
      baked.getAttribute("normal"),
      0,
    ),
    cross = actual[1]
      .clone()
      .sub(actual[0])
      .cross(actual[2].clone().sub(actual[0]))
      .normalize();
  expect(normal.dot(cross)).toBeCloseTo(1, 6);
  expect(Array.from(geometry.getAttribute("position").array)).toEqual([
    0, 0, 0, 1, 0, 0, 0, 1, 1,
  ]);
});
it("keeps transparent primitives separate and bakes conditional-line control attributes", async () => {
  const f = await fixture([
    "5 15 0 0 0 1 0 0 0 1 0 1 1 0",
    "5 15 0 0 0 2 0 0 0 2 0 2 2 0",
  ]);
  f.draw();
  expect(f.batches.root.children).toHaveLength(1);
  const merged = (f.batches.root.children[0] as THREE.LineSegments).geometry;
  expect(merged.getAttribute("control0").count).toBe(4);
  expect(Array.from(merged.getAttribute("control0").array)).toContain(10);
  for (const h of f.handles.values()) {
    const m = (h.children[0] as THREE.LineSegments).material as THREE.Material;
    m.transparent = true;
  }
  f.batches.rebuild(f.handles);
  f.draw();
  expect(f.batches.root.children).toHaveLength(2);
  f.batches.dispose();
  f.compiler.dispose();
});
it("chunks large opaque source sets and disposes generated geometry without source ownership", async () => {
  const f = await fixture(["3 15 0 0 0 1 0 0 0 1 0"]),
    source = f.handles.get("0")!;
  for (let i = 1; i < 22000; i++) {
    const h = source.clone(true);
    h.userData = source.userData;
    h.position.x = i;
    f.scene.add(h);
    f.handles.set(String(i), h);
  }
  f.batches.rebuild(f.handles);
  f.draw();
  expect(f.batches.root.children).toHaveLength(2);
  for (const child of f.batches.root.children)
    expect(
      (child as THREE.Mesh).geometry.getAttribute("position").count,
    ).toBeLessThanOrEqual(RAW_BATCH_LIMITS.chunkVertices);
  const sourceDispose = vi.spyOn(
    (source.children[0] as THREE.Mesh).geometry,
    "dispose",
  );
  f.batches.dispose();
  expect(sourceDispose).not.toHaveBeenCalled();
  f.compiler.dispose();
});
function physical(
  count: number,
  matrix: (i: number) => THREE.Matrix4,
  box = new THREE.BoxGeometry(1, 1, 1),
) {
  const scene = new THREE.Scene(),
    handles = new Map<string, THREE.Group>(),
    batches = new RenderBatches(),
    geometry = box.toNonIndexed(),
    material = new THREE.MeshStandardMaterial();
  scene.add(batches.root);
  for (let i = 0; i < count; i++) {
    const handle = new THREE.Group().add(new THREE.Mesh(geometry, material));
    handle.matrixAutoUpdate = false;
    handle.matrix.copy(matrix(i));
    scene.add(handle);
    handles.set(String(i), handle);
  }
  batches.rebuild(handles);
  batches.render({ render: () => {} }, scene, new THREE.PerspectiveCamera());
  return { batches, geometry };
}
const sheared = (i: number) =>
  new THREE.Matrix4().set(4, 2, 0, i * 10, 0, 1, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1);
it("bakes sheared physical-part placements into merged batches instead of one draw each", () => {
  const f = physical(50, sheared);
  expect(f.batches.root.children).toHaveLength(1);
  const mesh = f.batches.root.children[0] as THREE.Mesh;
  expect(mesh.userData.occurrenceIds).toHaveLength(50);
  expect(mesh.geometry.getAttribute("position").count).toBe(
    50 * f.geometry.getAttribute("position").count,
  );
  // Instanceable placements still use one instanced draw.
  const g = physical(50, (i) => new THREE.Matrix4().makeTranslation(i, 0, 0));
  expect(
    (g.batches.root.children[0] as THREE.InstancedMesh).isInstancedMesh,
  ).toBe(true);
  f.batches.dispose();
  g.batches.dispose();
});
it("falls back to per-object draws for non-raw merges beyond the raw vertex budget without refusing", () => {
  // 360,000 vertices each: five fit within the two-million raw budget.
  const f = physical(8, sheared, new THREE.BoxGeometry(1, 1, 1, 100, 100, 100));
  const drawn = f.batches.root.children;
  const merged = drawn.filter((o) => o.userData.rawPrimitiveBatch);
  const fallback = drawn.filter((o) => o.userData.occurrenceId);
  expect(merged.reduce((n, o) => n + o.userData.occurrenceIds.length, 0)).toBe(
    5,
  );
  expect(fallback).toHaveLength(3);
  f.batches.dispose();
});
