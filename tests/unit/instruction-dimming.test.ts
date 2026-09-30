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
