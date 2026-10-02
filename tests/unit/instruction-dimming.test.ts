import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { LayerGhost } from "../../src/render/layerGhost";
import { OccurrenceHandles } from "../../src/render/occurrence-handles";

it("dims previous geometry including lines without changing shared prototypes and restores nested treatments", () => {
  const material = new THREE.MeshBasicMaterial({ color: "red" }),
    lineMaterial = new THREE.LineBasicMaterial({ color: "black" }),
    shape = new THREE.Mesh(new THREE.BoxGeometry(), material),
    oldPrototype = new THREE.Group(),
    newPrototype = new THREE.Group();
  shape.castShadow = true;
  oldPrototype.add(
    shape,
    new THREE.LineSegments(new THREE.BufferGeometry(), lineMaterial),
  );
  newPrototype.add(new THREE.Mesh(shape.geometry, material));
  // Materialized trees show what a handle's treatments draw.
  const handles = new OccurrenceHandles(new THREE.Group()),
    oldGroup = handles.materialize(handles.place("old", oldPrototype)),
    newGroup = handles.materialize(handles.place("new", newPrototype)),
    previous = oldGroup.children[0] as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshBasicMaterial
    >,
    lines = oldGroup.children[1] as THREE.LineSegments<
      THREE.BufferGeometry,
      THREE.LineBasicMaterial
    >,
    addition = newGroup.children[0] as THREE.Mesh,
    layer = new LayerGhost(),
    dim = new LayerGhost(0.3);
  layer.apply(handles, new Set(["old"]));
  const layerMaterial = previous.material;
  dim.apply(handles, new Set(["old"]));
  const clone = previous.material,
    dispose = vi.spyOn(clone, "dispose");
  expect(clone.opacity).toBeCloseTo(0.18 * 0.3);
  expect(clone.depthWrite).toBe(false);
  expect(previous.visible).toBe(true);
  expect(lines.material.opacity).toBeCloseTo(0.18 * 0.3);
  expect(addition.material).toBe(material);
  expect(material.opacity).toBe(1);
  expect(previous.castShadow).toBe(false);
  dim.restore();
  expect(previous.material).toBe(layerMaterial);
  expect(dispose).toHaveBeenCalledOnce();
  layer.restore();
  expect(previous.material).toBe(material);
  expect(previous.castShadow).toBe(true);
  expect(lines.material).toBe(lineMaterial);
  dim.restore();
  expect(dispose).toHaveBeenCalledOnce();
});

it("pale instruction context stays opaque and restores shared colours and maps", () => {
  const material = new THREE.MeshBasicMaterial({
    color: "red",
    opacity: 0.4,
    transparent: true,
    map: new THREE.Texture(),
  });
  const prototype = new THREE.Group();
  prototype.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
  const handles = new OccurrenceHandles(new THREE.Group());
  const group = handles.materialize(handles.place("old", prototype));
  const mesh = group.children[0] as THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshBasicMaterial
  >;
  const pale = new LayerGhost(1, true);
  pale.apply(handles, new Set(["old"]));
  expect(mesh.material.transparent).toBe(false);
  expect(mesh.material.opacity).toBe(1);
  expect(mesh.material.depthWrite).toBe(true);
  expect(mesh.material.color.getHexString()).toBe("d1d5d9");
  expect(mesh.material.map).toBeNull();
  expect(material.color.getHexString()).toBe("ff0000");
  expect(material.map).not.toBeNull();
  pale.restore();
  expect(mesh.material).toBe(material);
});
