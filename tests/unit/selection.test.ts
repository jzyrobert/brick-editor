import * as THREE from "three";
import { selectRegion, scanlineSpans } from "../../src/render/region-selection";
import { describe, it, expect } from "vitest";
import { Vector4 } from "three";
import {
  insidePolygon,
  polygonsIntersect,
  clipTriangle,
} from "../../src/render/region-selection";
import { combineSelection } from "../../src/edit/selection";
describe("region geometry", () => {
  it("selects crossing triangles with no vertices inside and includes boundaries", () => {
    const box: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    expect(
      polygonsIntersect(
        [
          [-2, 4],
          [12, 4],
          [12, 6],
        ],
        box,
      ),
    ).toBe(true);
    expect(
      polygonsIntersect(
        [
          [-4, -4],
          [-1, -4],
          [-1, -1],
        ],
        box,
      ),
    ).toBe(false);
    expect(insidePolygon([0, 5], box)).toBe(true);
    expect(
      insidePolygon(
        [5, 5],
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [6, 10],
          [6, 3],
          [4, 3],
          [4, 10],
          [0, 10],
        ],
      ),
    ).toBe(false);
  });
  it("clips near-plane crossings and rejects triangles entirely behind camera", () => {
    const clipped = clipTriangle([
      new Vector4(-0.5, -0.5, 0, 1),
      new Vector4(0.5, -0.5, 0, 1),
      new Vector4(0, 0.5, -2, 1),
    ]);
    expect(clipped).toHaveLength(4);
    expect(clipped.every((p) => p.z >= -p.w && p.w > 0)).toBe(true);
    expect(
      clipTriangle([
        new Vector4(0, 0, 0, -1),
        new Vector4(1, 0, 0, -1),
        new Vector4(0, 1, 0, -1),
      ]),
    ).toEqual([]);
  });
  it("makes touch add/remove/toggle explicit and preserves stable order", () => {
    expect(combineSelection(["a", "b"], ["b", "c"], "add")).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(combineSelection(["a", "b"], ["b", "c"], "remove")).toEqual(["a"]);
    expect(combineSelection(["a", "b"], ["b", "c"], "toggle")).toEqual([
      "a",
      "c",
    ]);
    expect(combineSelection(["a"], ["b", "b"], "replace")).toEqual(["b"]);
  });
});

it("through-selection excludes hidden and fully transparent material groups", () => {
  const geometry = new THREE.BufferGeometry().setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [-9, -9, 0, -7, -9, 0, -9, -7, 0, -1, -1, 0, 1, -1, 0, 0, 1, 0],
      3,
    ),
  );
  geometry.addGroup(0, 3, 0);
  geometry.addGroup(3, 3, 1);
  const visible = new THREE.MeshBasicMaterial(),
    hidden = new THREE.MeshBasicMaterial({ visible: false });
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, [visible, hidden]));
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
  camera.position.z = 10;
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  const renderer = {
    domElement: { getBoundingClientRect: () => ({ width: 100, height: 100 }) },
  } as THREE.WebGLRenderer;
  const select = () =>
    selectRegion(
      renderer,
      camera,
      new Map([["surface", group]]),
      [
        [45, 45],
        [55, 45],
        [55, 55],
        [45, 55],
      ],
      "through",
    );
  expect(select()).toEqual([]);
  hidden.visible = true;
  hidden.opacity = 0;
  expect(select()).toEqual([]);
  hidden.opacity = 1;
  expect(select()).toEqual(["surface"]);
  geometry.dispose();
  visible.dispose();
  hidden.dispose();
});

it("scanline spans preserve concave lasso gaps without per-pixel polygon walks", () => {
  expect(
    scanlineSpans(5, [
      [0, 0],
      [10, 0],
      [10, 10],
      [6, 10],
      [6, 3],
      [4, 3],
      [4, 10],
      [0, 10],
    ]),
  ).toEqual([
    [0, 4],
    [6, 10],
  ]);
  expect(
    scanlineSpans(2, [
      [0, 0],
      [10, 0],
      [10, 10],
      [6, 10],
      [6, 3],
      [4, 3],
      [4, 10],
      [0, 10],
    ]),
  ).toEqual([[0, 10]]);
});
