import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { LayerGhost } from "../../src/render/layerGhost";

it("dims previous geometry including lines without changing shared prototypes and restores nested treatments", () => {
  const material = new THREE.MeshBasicMaterial({ color: "red" }),
    lineMaterial = new THREE.LineBasicMaterial({ color: "black" }),
    previous = new THREE.Mesh(new THREE.BoxGeometry(), material),
    addition = new THREE.Mesh(previous.geometry, material),
    lines = new THREE.LineSegments(new THREE.BufferGeometry(), lineMaterial),
    oldGroup = new THREE.Group(),
    newGroup = new THREE.Group();
  previous.castShadow = true;
  oldGroup.add(previous, lines);
  newGroup.add(addition);
  const handles = new Map([
      ["old", oldGroup],
      ["new", newGroup],
    ]),
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
