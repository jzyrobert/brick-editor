import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { LDrawConditionalLineMaterial } from "three/examples/jsm/materials/LDrawConditionalLineMaterial.js";
import {
  canInstanceMatrix,
  RenderBatches,
  registerTreatment,
  treatmentBase,
  transformLineGeometry,
  supportsInstancedLines,
  type InstancedLineSegments,
} from "../../src/render/batching";
import {
  OccurrenceHandles,
  type Treatment,
} from "../../src/render/occurrence-handles";

function fixture() {
  const scene = new THREE.Scene(),
    parent = new THREE.Group();
  scene.add(parent);
  parent.rotation.x = Math.PI;
  const material = new THREE.MeshBasicMaterial(),
    geometry = new THREE.BoxGeometry(2, 2, 2);
  const prototype = new THREE.Group();
  prototype.add(new THREE.Mesh(geometry, material));
  const handles = new OccurrenceHandles(parent);
  for (let i = 0; i < 3; i++)
    handles.place(String(i), prototype).matrix.makeTranslation(i * 10, 2, 0);
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
          // Handles are records, not scene objects: the draw's traversal
          // reaches only the batches (no tree per occurrence).
          const reached: THREE.Object3D[] = [];
          scene.traverse((o) => reached.push(o));
          expect(reached.every((o) => o === scene || o.parent)).toBe(true);
          expect(reached.filter((o) => (o as THREE.Mesh).isMesh)).toHaveLength(
            1,
          );
          expect([...handles.values()].every((g) => !g.object)).toBe(true);
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
    // The scene graph is untouched: the batches are still in place.
    const reached = new Set<THREE.Object3D>();
    scene.traverse((o) => reached.add(o));
    expect(reached.has(batches.root)).toBe(true);
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
    // The owner draws dynamic occurrences from materialized trees.
    const live = handles.materialize(handles.get("1")!);
    draw((reached) => {
      expect(reached.has(live)).toBe(true);
      expect(handles.get("0")!.object).toBe(null);
    });
    const packed = batches.root.children[0] as THREE.InstancedMesh;
    expect(packed.count).toBe(2);
    expect(packed.userData.occurrenceIds).toEqual(["0", "2"]);
    // Moving the live handle only needs its matrix; the batches are reused as-is.
    handles.get("1")!.matrix.makeTranslation(55, 2, 0);
    handles.get("1")!.moved();
    expect(live.matrixWorld.elements[12]).toBe(55);
    draw();
    expect(batches.root.children[0]).toBe(packed);
    // Visibility of batched handles is still detected without a rebuild call,
    // and refills the same draw in place.
    handles.get("2")!.visible = false;
    draw();
    expect(batches.root.children).toEqual([packed]);
    expect(packed.count).toBe(1);
    expect(packed.userData.occurrenceIds).toEqual(["0"]);
    expect(batches.setDynamic([])).toBe(true);
    handles.get("2")!.visible = true;
    draw();
    expect((batches.root.children[0] as THREE.InstancedMesh).count).toBe(3);
    batches.dispose();
  });
  it("refills instance arrays in place for visibility, treatments and transforms", () => {
    const { scene, handles, batches, camera, material } = fixture();
    const draw = () => batches.render({ render: () => {} }, scene, camera);
    draw();
    const packed = batches.root.children[0] as THREE.InstancedMesh;
    const structures = batches.stats().structures;
    // A ghost/dimming clone of the shared material: same bucket, second draw.
    const ghost = material.clone();
    ghost.transparent = true;
    ghost.opacity = 0.18;
    registerTreatment(ghost, material);
    expect(treatmentBase(ghost)).toBe(material);
    const treatment: Treatment = { treat: () => ghost };
    handles.get("1")!.treatments = [treatment];
    batches.refresh();
    draw();
    expect(batches.stats().structures).toBe(structures);
    const draws = batches.root.children.filter(
      (o) => o.visible,
    ) as THREE.InstancedMesh[];
    expect(draws).toHaveLength(2);
    expect(draws[0]).toBe(packed);
    expect(packed.count).toBe(2);
    expect(draws[1].material).toBe(ghost);
    expect(draws[1].count).toBe(1);
    expect(draws[1].userData.occurrenceIds).toEqual(["1"]);
    // A transform-only change (explode) moves the instance without a rebuild.
    handles.get("0")!.matrix.makeTranslation(0, 50, 0);
    handles.get("1")!.treatments = null;
    batches.refresh();
    draw();
    expect(batches.stats().structures).toBe(structures);
    expect(packed.count).toBe(3);
    expect(batches.root.children[1].visible).toBe(false);
    const matrix = new THREE.Matrix4();
    packed.getMatrixAt(0, matrix);
    expect(new THREE.Vector3().setFromMatrixPosition(matrix).y).toBe(50);
    // Culling spheres follow the filled instances.
    expect(
      packed.boundingSphere!.containsPoint(new THREE.Vector3(0, 50, 0)),
    ).toBe(true);
    batches.dispose();
    ghost.dispose();
  });
  it("instances repeated transparent meshes", () => {
    const { scene, batches, camera, material } = fixture();
    material.transparent = true;
    material.opacity = 0.5;
    batches.rebuild(new Map(batches["handles"]));
    batches.render({ render: () => {} }, scene, camera);
    const visible = batches.root.children.filter((o) => o.visible);
    expect(visible).toHaveLength(1);
    expect((visible[0] as THREE.InstancedMesh).isInstancedMesh).toBe(true);
    expect((visible[0] as THREE.InstancedMesh).count).toBe(3);
    batches.dispose();
  });
  it("culls instances wholly beyond a section plane and splits large buckets into cells", () => {
    const { scene, parent, handles, batches, camera } = fixture();
    const draw = () => batches.render({ render: () => {} }, scene, camera);
    draw();
    const packed = batches.root.children[0] as THREE.InstancedMesh;
    // World space: the parent is rotated by π about X, so parent x is world x.
    batches.setClipPlane(new THREE.Plane(new THREE.Vector3(-1, 0, 0), 5));
    draw();
    // Only x = 0 lies on the kept side (x ≤ 5); x = 10 and 20 are wholly beyond.
    expect(packed.count).toBe(1);
    expect(packed.userData.occurrenceIds).toEqual(["0"]);
    batches.setClipPlane(null);
    draw();
    expect(packed.count).toBe(3);
    batches.dispose();
    const cells = new RenderBatches({ cellSize: 15, cellMinSlots: 2 });
    parent.add(cells.root);
    cells.rebuild(handles);
    cells.render({ render: () => {} }, scene, camera);
    // x = 0 and 10 share cell 0; x = 20 is in cell 1.
    const counts = cells.root.children
      .map((o) =>
        (o as THREE.InstancedMesh).isInstancedMesh
          ? (o as THREE.InstancedMesh).count
          : 1,
      )
      .sort();
    expect(counts).toEqual([1, 2]);
    cells.dispose();
    const small = new RenderBatches({ cellSize: 15, cellMinSlots: 4 });
    parent.add(small.root);
    small.rebuild(handles);
    small.render({ render: () => {} }, scene, camera);
    expect(small.root.children).toHaveLength(1);
    small.dispose();
  });
  it("draws adaptive cells only while they are active, by refilling", () => {
    const scene = new THREE.Scene(),
      parent = new THREE.Group();
    scene.add(parent);
    // 1,200 triangles each: 120,000 in all, enough to split into cells.
    const prototype = new THREE.Group().add(
      new THREE.Mesh(
        new THREE.BoxGeometry(2, 2, 2, 10, 10, 10),
        new THREE.MeshBasicMaterial(),
      ),
    );
    const handles = new OccurrenceHandles(parent);
    for (let i = 0; i < 100; i++)
      handles.place(String(i), prototype).matrix.makeTranslation(i * 10, 0, 0);
    const batches = new RenderBatches({ adaptiveCells: true });
    parent.add(batches.root);
    batches.rebuild(handles);
    const draw = () =>
      batches.render({ render: () => {} }, scene, new THREE.Camera());
    const drawn = () =>
      batches.root.children.filter(
        (o) => o.visible && (o as THREE.InstancedMesh).count > 0,
      ) as THREE.InstancedMesh[];
    draw();
    // Whole-model views: one draw for the bucket.
    expect(drawn()).toHaveLength(1);
    expect(drawn()[0].count).toBe(100);
    const stats = batches.stats();
    // 990 LDU of extent over ADAPTIVE_CELLS_ACROSS (6): 165 LDU cells.
    expect(stats).toMatchObject({ cellSize: 165, cellsInUse: false });
    expect(stats.cells).toBe(7);
    // Share of the celled triangles a camera's view would cull: none from
    // afar, most when it looks at the first cell only.
    const far = new THREE.PerspectiveCamera(45, 1, 1, 10000);
    far.position.set(500, 0, 2000);
    far.lookAt(500, 0, 0);
    expect(batches.culledShare(far)).toBe(0);
    const near = new THREE.PerspectiveCamera(30, 1, 1, 10000);
    near.position.set(0, 0, 40);
    near.lookAt(0, 0, 0);
    expect(batches.culledShare(near)).toBeGreaterThan(0.8);
    batches.setCellsActive(true);
    draw();
    const cells = drawn();
    expect(cells).toHaveLength(7);
    expect(cells.reduce((n, d) => n + d.count, 0)).toBe(100);
    // Each cell's culling sphere covers only its own instances.
    for (const cell of cells)
      expect(cell.boundingSphere!.radius).toBeLessThan(120);
    expect(batches.stats()).toMatchObject({
      structures: stats.structures,
      cellsInUse: true,
      occurrencesDrawn: 100,
    });
    batches.setCellsActive(false);
    draw();
    expect(drawn()).toHaveLength(1);
    expect(drawn()[0].count).toBe(100);
    expect(batches.stats().structures).toBe(stats.structures);
    batches.dispose();
  });
  it("suppresses instanced lines while moving without refilling", () => {
    const scene = new THREE.Scene(),
      parent = new THREE.Group();
    scene.add(parent);
    const lineGeometry = new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0], 3),
    );
    const box = new THREE.BoxGeometry(),
      surface = new THREE.MeshBasicMaterial(),
      edge = new THREE.LineBasicMaterial();
    const handles = new OccurrenceHandles(parent);
    const shared = new THREE.Group(),
      own = new THREE.Group();
    shared.add(
      new THREE.Mesh(box, surface),
      new THREE.LineSegments(lineGeometry, edge),
    );
    // The third occurrence's lines use their own material: a single copy.
    own.add(
      new THREE.Mesh(box, surface),
      new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial()),
    );
    for (let i = 0; i < 3; i++)
      handles
        .place(String(i), i < 2 ? shared : own)
        .matrix.makeTranslation(i * 10, 0, 0);
    const batches = new RenderBatches();
    parent.add(batches.root);
    batches.rebuild(handles);
    const draw = () =>
      batches.render({ render: () => {} }, scene, new THREE.Camera());
    draw();
    const fills = batches.stats().fills;
    const lines = batches.root.children.filter(
      (o) => (o as THREE.LineSegments).isLineSegments,
    );
    expect(lines).toHaveLength(2);
    expect(lines.every((o) => o.visible)).toBe(true);
    batches.setLinesSuppressed(true);
    draw();
    expect(lines.some((o) => o.visible)).toBe(false);
    expect(batches.stats()).toMatchObject({
      fills,
      linesSuppressed: true,
      instancedLines: 1,
      single: 1,
      occurrencesDrawn: 3,
    });
    batches.setLinesSuppressed(false);
    draw();
    expect(lines.every((o) => o.visible)).toBe(true);
    // Edge-mode changes hide every handle's lines: a refill, no rebuild.
    handles.setEdges("none");
    batches.refresh();
    draw();
    expect(lines.some((o) => o.visible)).toBe(false);
    expect(batches.stats().structures).toBe(1);
    batches.dispose();
  });
  it("keeps reflected, sheared and transparent meshes on the reference path", () => {
    const { scene, handles, batches, camera, material } = fixture();
    handles.get("0")!.matrix.makeScale(-1, 1, 1).setPosition(0, 2, 0);
    handles
      .get("1")!
      .matrix.set(1, 0.5, 0, 10, 0, 1, 0, 2, 0, 0, 1, 0, 0, 0, 0, 1);
    batches.rebuild(handles);
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
  function lineFixture(material: THREE.Material | THREE.Material[]) {
    const scene = new THREE.Scene(),
      parent = new THREE.Group();
    scene.add(parent);
    const geometry = new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0], 3),
    );
    geometry.addGroup(0, 2, 0);
    geometry.addGroup(2, 2, 1);
    const handles = new OccurrenceHandles(parent);
    const prototype = new THREE.Group();
    prototype.add(new THREE.LineSegments(geometry, material));
    for (let i = 0; i < 2; i++)
      handles.place(String(i), prototype).matrix.makeTranslation(i * 10, 0, 0);
    const batches = new RenderBatches();
    parent.add(batches.root);
    batches.rebuild(handles);
    batches.render({ render: () => {} }, scene, new THREE.Camera());
    return { batches, geometry };
  }
  it("instances repeated lines, sharing the part's geometry and material groups", () => {
    const { batches, geometry } = lineFixture([
      new THREE.LineBasicMaterial(),
      new THREE.LineBasicMaterial(),
    ]);
    expect(batches.root.children).toHaveLength(1);
    const lines = batches.root.children[0] as InstancedLineSegments;
    expect(lines.isLineSegments).toBe(true);
    expect(lines.isInstancedMesh).toBe(true);
    // No baked copy: one geometry, one matrix per occurrence.
    expect(lines.geometry).toBe(geometry);
    expect(lines.count).toBe(2);
    expect(lines.userData.occurrenceIds).toEqual(["0", "1"]);
    const second = new THREE.Matrix4().fromArray(
      lines.instanceMatrix.array as Float32Array,
      16,
    );
    expect(new THREE.Vector3().setFromMatrixPosition(second).toArray()).toEqual(
      [10, 0, 0],
    );
    // Culling uses the union of all instances.
    expect(
      lines.boundingSphere.containsPoint(new THREE.Vector3(11, 1, 0)),
    ).toBe(true);
    expect(lines.boundingSphere.containsPoint(new THREE.Vector3(0, 0, 0))).toBe(
      true,
    );
    batches.dispose();
  });
  it("still merges lines whose shader cannot take an instance matrix", () => {
    const custom = () =>
      new THREE.ShaderMaterial({
        vertexShader: "void main() { gl_Position = vec4(position, 1.0); }",
      });
    const { batches } = lineFixture([custom(), custom()]);
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
  it("moves conditional-line control points with the instance matrix only when instanced", () => {
    const material = new LDrawConditionalLineMaterial();
    const before = material.vertexShader;
    expect(supportsInstancedLines(material)).toBe(true);
    const after = material.vertexShader;
    // Endpoints, direction end and both control points.
    expect(after.match(/LDRAW_INSTANCE\( vec4\(/g)).toHaveLength(5);
    expect(after).toContain("instanceMatrix * ( v )");
    expect(after).toContain("#define LDRAW_INSTANCE( v ) ( v )");
    expect(after).toContain(
      "modelViewMatrix * LDRAW_INSTANCE( vec4( position + direction, 1.0 ) )",
    );
    // Idempotent: a second batch build does not patch again.
    expect(supportsInstancedLines(material)).toBe(true);
    expect(material.vertexShader).toBe(after);
    expect(before).not.toContain("LDRAW_INSTANCE");
  });
});
