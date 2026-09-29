import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  indexPrototypeGeometry,
  indexTriangleGeometry,
} from "../../src/render/geometry-index";
import { transformTriangleGeometry } from "../../src/render/batching";

const flat = (geometry: THREE.BufferGeometry, name: string) =>
  Array.from(
    (geometry.index ? geometry.toNonIndexed() : geometry).getAttribute(name)
      .array,
  );

describe("prototype geometry indexing", () => {
  it("merges only bit-identical corners and draws the same triangles", () => {
    const source = new THREE.BoxGeometry(2, 3, 4).toNonIndexed();
    source.clearGroups();
    source.addGroup(0, 18, 0);
    source.addGroup(18, 18, 1);
    const reference = source.clone();
    const result = indexTriangleGeometry(source);
    // 6 faces × 2 triangles × 3 corners; flat-shaded faces share 4 corners each.
    expect(result).toEqual({ indexed: true, before: 36, after: 24 });
    expect(source.index!.count).toBe(36);
    expect(source.index!.array).toBeInstanceOf(Uint16Array);
    expect(source.getAttribute("position").count).toBe(24);
    for (const name of ["position", "normal", "uv"])
      expect(flat(source, name)).toEqual(flat(reference, name));
    // Group numbering is unchanged (vertices → indices).
    expect(source.groups.map((g) => [g.start, g.count])).toEqual([
      [0, 18],
      [18, 18],
    ]);
    // Baked (raw/sheared) batches still see the same corners.
    const matrix = new THREE.Matrix4().makeScale(-1, 1, 1);
    expect(flat(transformTriangleGeometry(source, matrix), "position")).toEqual(
      flat(transformTriangleGeometry(reference, matrix), "position"),
    );
    // Already indexed: nothing to do.
    expect(indexTriangleGeometry(source).indexed).toBe(false);
  });
  it("keeps corners whose normals differ, even by one bit", () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0],
        3,
      ),
    );
    const normals = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(normals, 3),
    );
    const nudged = geometry.clone();
    const n = nudged.getAttribute("normal").array as Float32Array;
    n[5] = Math.fround(1 + 2 ** -23);
    expect(indexTriangleGeometry(geometry).after).toBe(3);
    expect(indexTriangleGeometry(nudged).after).toBe(4);
    expect(flat(nudged, "normal")[5]).toBe(Math.fround(1 + 2 ** -23));
  });
  it("leaves unusual layouts untouched", () => {
    const interleaved = new THREE.BufferGeometry();
    const buffer = new THREE.InterleavedBuffer(new Float32Array(18), 6);
    interleaved.setAttribute(
      "position",
      new THREE.InterleavedBufferAttribute(buffer, 3, 0),
    );
    expect(indexTriangleGeometry(interleaved).indexed).toBe(false);
    const ranged = new THREE.BoxGeometry().toNonIndexed();
    ranged.setDrawRange(0, 6);
    expect(indexTriangleGeometry(ranged).indexed).toBe(false);
    const bytes = new THREE.BufferGeometry();
    bytes.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Float32Array(9), 3),
    );
    bytes.setAttribute(
      "color",
      new THREE.Uint8BufferAttribute(new Uint8Array(9), 3, true),
    );
    expect(indexTriangleGeometry(bytes).indexed).toBe(false);
  });
  it("indexes each shared prototype geometry once", () => {
    const geometry = new THREE.BoxGeometry().toNonIndexed();
    const make = () => {
      const group = new THREE.Group();
      group.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
      group.add(
        new THREE.LineSegments(
          new THREE.BufferGeometry().setAttribute(
            "position",
            new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1], 3),
          ),
        ),
      );
      return group;
    };
    let disposed = 0;
    geometry.addEventListener("dispose", () => disposed++);
    expect(indexPrototypeGeometry(make())).toEqual({ before: 36, after: 24 });
    // A colour variant sharing the geometry: already done.
    expect(indexPrototypeGeometry(make())).toEqual({ before: 0, after: 0 });
    expect(disposed).toBe(1);
    expect(geometry.index).not.toBeNull();
  });
});
