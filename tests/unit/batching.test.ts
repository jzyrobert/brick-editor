import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  canInstanceMatrix,
  RenderBatches,
  transformLineGeometry,
} from "../../src/render/batching";

function fixture() {
  const scene = new THREE.Scene(),
    parent = new THREE.Group();
  scene.add(parent);
  parent.rotation.x = Math.PI;
  const material = new THREE.MeshBasicMaterial(),
    geometry = new THREE.BoxGeometry(2, 2, 2);
  const handles = new Map<string, THREE.Group>();
  for (let i = 0; i < 3; i++) {
    const group = new THREE.Group();
    group.position.set(i * 10, 2, 0);
    group.add(new THREE.Mesh(geometry, material));
    parent.add(group);
    handles.set(String(i), group);
  }
  const batches = new RenderBatches();
  parent.add(batches.root);
  batches.rebuild(handles);
  const camera = new THREE.PerspectiveCamera();
  return { scene, parent, handles, batches, camera, material };
}

describe("render-only batching", () => {
  it("preserves occurrence handles while packing repeated opaque meshes and visibility", () => {
    const { scene, handles, batches, camera } = fixture();
    const original = handles.get("1")!;
    batches.render(
      {
        render: () => {
          // Batched handles are left out of the draw traversal (not merely hidden),
          // so three neither draws them nor recomposes their matrices per frame.
          const reached = new Set<THREE.Object3D>();
          scene.traverse((o) => reached.add(o));
          expect([...handles.values()].some((g) => reached.has(g))).toBe(false);
          expect([...handles.values()].every((g) => !!g.parent)).toBe(true);
        },
      },
      scene,
      camera,
    );
    const mesh = batches.root.children[0] as THREE.InstancedMesh;
    expect(mesh.isInstancedMesh).toBe(true);
    expect(mesh.count).toBe(3);
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(1, matrix);
    expect(new THREE.Vector3().setFromMatrixPosition(matrix).toArray()).toEqual(
      [10, 2, 0],
    );
    expect(mesh.userData.occurrenceIds).toEqual(["0", "1", "2"]);
    expect(handles.get("1")).toBe(original);
    expect(original.visible).toBe(true);
    handles.get("0")!.visible = false;
    batches.render({ render: () => {} }, scene, camera);
    expect((batches.root.children[0] as THREE.InstancedMesh).count).toBe(2);
    expect(handles.get("0")!.visible).toBe(false);
    batches.dispose();
  });
  it("restores authored visibility even when rendering throws", () => {
    const { scene, handles, batches, camera } = fixture();
    expect(() =>
      batches.render(
        {
          render: () => {
            throw new Error("context failure");
          },
        },
        scene,
        camera,
      ),
    ).toThrow("context failure");
    expect([...handles.values()].every((g) => g.visible)).toBe(true);
    // The scene graph is restored too: every handle is reachable again.
    const reached = new Set<THREE.Object3D>();
    scene.traverse((o) => reached.add(o));
    expect([...handles.values()].every((g) => reached.has(g))).toBe(true);
    batches.dispose();
  });
  it("draws moving (dynamic) occurrences live so later poses do not re-merge", () => {
    const { scene, handles, batches, camera } = fixture();
    const draw = (check: (reached: Set<THREE.Object3D>) => void = () => {}) =>
      batches.render(
        {
          render: () => {
            const reached = new Set<THREE.Object3D>();
            scene.traverse((o) => reached.add(o));
            check(reached);
          },
        },
        scene,
        camera,
      );
    draw();
    expect((batches.root.children[0] as THREE.InstancedMesh).count).toBe(3);
    expect(batches.setDynamic(["1"])).toBe(true);
    expect(batches.setDynamic(["1"])).toBe(false);
    draw((reached) => {
      expect(reached.has(handles.get("1")!)).toBe(true);
      expect(reached.has(handles.get("0")!)).toBe(false);
    });
    const packed = batches.root.children[0] as THREE.InstancedMesh;
    expect(packed.count).toBe(2);
    expect(packed.userData.occurrenceIds).toEqual(["0", "2"]);
    // Moving the live handle only needs its matrix; the batches are reused as-is.
    handles.get("1")!.position.x = 55;
    handles.get("1")!.updateMatrixWorld(true);
    draw();
    expect(batches.root.children[0]).toBe(packed);
    // Visibility of batched handles is still detected without a rebuild call.
    handles.get("2")!.visible = false;
    draw();
    expect(batches.root.children).toHaveLength(1);
    expect(batches.root.children[0].userData.occurrenceId).toBe("0");
    expect(batches.setDynamic([])).toBe(true);
    handles.get("2")!.visible = true;
    draw();
    expect((batches.root.children[0] as THREE.InstancedMesh).count).toBe(3);
    batches.dispose();
  });
  it("keeps reflected, sheared and transparent meshes on the reference path", () => {
    const { scene, handles, batches, camera, material } = fixture();
    handles.get("0")!.scale.x = -1;
    handles.get("1")!.matrixAutoUpdate = false;
    handles
      .get("1")!
      .matrix.set(1, 0.5, 0, 10, 0, 1, 0, 2, 0, 0, 1, 0, 0, 0, 0, 1);
    batches.render({ render: () => {} }, scene, camera);
    expect(
      batches.root.children.some(
        (o) => (o as THREE.InstancedMesh).isInstancedMesh,
      ),
    ).toBe(false);
    material.transparent = true;
    batches.rebuild(handles);
    batches.render({ render: () => {} }, scene, camera);
    expect(batches.root.children).toHaveLength(3);
    batches.dispose();
  });
  it("transforms conditional control points and unnormalized direction vectors correctly", () => {
    const geometry = new THREE.BufferGeometry();
    for (const name of ["position", "control0", "control1", "direction"])
      geometry.setAttribute(
        name,
        new THREE.Float32BufferAttribute([1, 2, 3], 3),
      );
    const matrix = new THREE.Matrix4().set(
      -2,
      0.5,
      0,
      10,
      0,
      3,
      0,
      20,
      0,
      0,
      4,
      30,
      0,
      0,
      0,
      1,
    );
    const transformed = transformLineGeometry(geometry, matrix);
    expect(Array.from(transformed.getAttribute("position").array)).toEqual([
      9, 26, 42,
    ]);
    expect(Array.from(transformed.getAttribute("control0").array)).toEqual([
      9, 26, 42,
    ]);
    expect(Array.from(transformed.getAttribute("control1").array)).toEqual([
      9, 26, 42,
    ]);
    expect(Array.from(transformed.getAttribute("direction").array)).toEqual([
      -1, 6, 12,
    ]);
    expect(Array.from(geometry.getAttribute("control0").array)).toEqual([
      1, 2, 3,
    ]);
    expect(canInstanceMatrix(matrix)).toBe(false);
    transformed.dispose();
    geometry.dispose();
  });
  it("merges repeated line material groups without losing vertices", () => {
    const scene = new THREE.Scene(),
      parent = new THREE.Group();
    scene.add(parent);
    const geometry = new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0], 3),
    );
    geometry.addGroup(0, 2, 0);
    geometry.addGroup(2, 2, 1);
    const material = [
      new THREE.LineBasicMaterial(),
      new THREE.LineBasicMaterial(),
    ];
    const handles = new Map<string, THREE.Group>();
    for (let i = 0; i < 2; i++) {
      const group = new THREE.Group();
      group.position.x = i * 10;
      group.add(new THREE.LineSegments(geometry, material));
      parent.add(group);
      handles.set(String(i), group);
    }
    const batches = new RenderBatches();
    parent.add(batches.root);
    batches.rebuild(handles);
    batches.render({ render: () => {} }, scene, new THREE.Camera());
    const merged = (batches.root.children[0] as THREE.LineSegments).geometry;
    expect(merged.getAttribute("position").count).toBe(8);
    expect(
      merged.groups.map((g) => [g.start, g.count, g.materialIndex]),
    ).toEqual([
      [0, 2, 0],
      [2, 2, 1],
      [4, 2, 0],
      [6, 2, 1],
    ]);
    batches.dispose();
  });
});
