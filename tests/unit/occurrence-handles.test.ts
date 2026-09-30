import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  cloneTree,
  drawableTemplates,
  OccurrenceHandles,
  writeBoxHelper,
} from "../../src/render/occurrence-handles";
import { LayerGhost } from "../../src/render/layerGhost";

/** A compiled-part-like prototype: render group → part group → mesh, edge
 * lines and conditional lines, with transforms on the inner groups. */
function prototype() {
  const root = new THREE.Group(),
    part = new THREE.Group();
  part.position.set(1, 2, 3);
  part.rotation.y = Math.PI / 2;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(4, 2, 6),
    new THREE.MeshStandardMaterial(),
  );
  mesh.castShadow = true;
  mesh.position.x = 5;
  const edges = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0, 9, 0, 0], 3),
    ),
    new THREE.LineBasicMaterial(),
  );
  const conditionalGeometry = new THREE.BufferGeometry()
    .setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0, 0, 7, 0], 3),
    )
    .setAttribute(
      "control0",
      new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3),
    );
  const conditional = new THREE.LineSegments(
    conditionalGeometry,
    new THREE.LineBasicMaterial(),
  );
  part.add(mesh, edges, conditional);
  root.add(part);
  return root;
}

const placement = new THREE.Matrix4()
  .makeRotationZ(0.3)
  .setPosition(40, -20, 10);

describe("occurrence handles", () => {
  it("describe a prototype's drawables with root-relative matrices, as a clone places them", () => {
    const proto = prototype();
    const templates = drawableTemplates(proto);
    expect(templates.map((t) => [t.mesh, t.conditional])).toEqual([
      [true, false],
      [false, false],
      [false, true],
    ]);
    expect(drawableTemplates(proto)).toBe(templates);
    // The same world matrices a cloned tree placed at `placement` gets.
    const clone = cloneTree(proto);
    clone.matrixAutoUpdate = false;
    clone.matrix.copy(placement);
    clone.updateMatrixWorld(true);
    const drawables: THREE.Object3D[] = [];
    clone.traverse((o) => {
      if ((o as THREE.Mesh).isMesh || (o as THREE.LineSegments).isLineSegments)
        drawables.push(o);
    });
    const handles = new OccurrenceHandles(new THREE.Group());
    const handle = handles.place("a", proto);
    handle.matrix.copy(placement);
    templates.forEach((template, i) => {
      const matrix = handle.drawableMatrix(template, null, new THREE.Matrix4());
      matrix.elements.forEach((v, k) =>
        expect(v).toBeCloseTo(drawables[i].matrixWorld.elements[k], 10),
      );
    });
    // Bounds as Box3.setFromObject gives for the tree.
    const expected = new THREE.Box3().setFromObject(clone);
    const box = handle.expandBox(new THREE.Box3(), null);
    expect(box.min.distanceTo(expected.min)).toBeLessThan(1e-9);
    expect(box.max.distanceTo(expected.max)).toBeLessThan(1e-9);
  });
  it("are records until materialized; a materialized tree follows the record", () => {
    const proto = prototype();
    const parent = new THREE.Group();
    const handles = new OccurrenceHandles(parent);
    const handle = handles.place("a", proto);
    expect(handle.object).toBe(null);
    expect(parent.children).toHaveLength(0);
    // Placing the same prototype again reuses the record.
    expect(handles.place("a", proto)).toBe(handle);
    handle.matrix.copy(placement);
    const tree = handles.materialize(handle);
    expect(parent.children).toEqual([tree]);
    expect(tree.matrixWorld.equals(placement)).toBe(true);
    handle.matrix.makeTranslation(1, 1, 1);
    handle.moved();
    expect(tree.matrixWorld.elements[12]).toBe(1);
    handle.visible = false;
    expect(tree.visible).toBe(false);
    // Edge modes hide lines on the tree and in drawableShown().
    const [mesh, edges, conditional] = tree.children[0].children;
    handles.setEdges("ordinary");
    expect([mesh.visible, edges.visible, conditional.visible]).toEqual([
      true,
      true,
      false,
    ]);
    expect(handle.drawables.map((t) => handle.drawableShown(t))).toEqual([
      true,
      true,
      false,
    ]);
    // Treatments swap materials on the tree and drop shadows; restore undoes it.
    const ghost = new LayerGhost();
    ghost.apply(handles, new Set(["a"]));
    const treated = (mesh as THREE.Mesh).material as THREE.Material;
    expect(treated).not.toBe(handle.drawables[0].object.material);
    expect(treated.transparent).toBe(true);
    expect(mesh.castShadow).toBe(false);
    expect(handle.castsShadow(handle.drawables[0])).toBe(false);
    ghost.restore();
    expect((mesh as THREE.Mesh).material).toBe(
      handle.drawables[0].object.material,
    );
    expect(mesh.castShadow).toBe(true);
    // A new prototype replaces the record and keeps it materialized.
    const other = handles.place("a", prototype());
    expect(other).not.toBe(handle);
    expect(handle.object).toBe(null);
    expect(other.object).not.toBe(null);
    expect(parent.children).toEqual([other.object]);
    handles.delete("a");
    expect(parent.children).toHaveLength(0);
    expect(handles.size).toBe(0);
  });
  it("draw selection boxes like a BoxHelper of the tree", () => {
    const proto = prototype();
    const clone = cloneTree(proto);
    clone.matrixAutoUpdate = false;
    clone.matrix.copy(placement);
    clone.updateMatrixWorld(true);
    const reference = new THREE.BoxHelper(clone);
    const handles = new OccurrenceHandles(new THREE.Group());
    const handle = handles.place("a", proto);
    handle.matrix.copy(placement);
    const helper = writeBoxHelper(
      new THREE.BoxHelper(new THREE.Object3D()),
      handle.expandBox(new THREE.Box3(), null),
    );
    const a = reference.geometry.getAttribute("position").array,
      b = helper.geometry.getAttribute("position").array;
    expect(b.length).toBe(a.length);
    for (let i = 0; i < a.length; i++) expect(b[i]).toBeCloseTo(a[i], 4);
  });
  it("cost a small, fixed amount of memory each (no Object3D per occurrence)", () => {
    const proto = prototype();
    const handles = new OccurrenceHandles(new THREE.Group());
    for (let i = 0; i < 1000; i++) handles.place(String(i), proto);
    for (const handle of handles.values()) {
      expect(handle.object).toBe(null);
      expect(handle.prototype).toBe(proto);
    }
    expect(Object.keys(handles.get("0")!).sort()).toEqual([
      "id",
      "matrix",
      "object",
      "prototype",
      "shownFlag",
      "style",
      "treatments",
    ]);
  });
});
