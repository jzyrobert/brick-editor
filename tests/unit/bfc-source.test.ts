import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import * as THREE from "three";
import { LDrawLoader } from "three/examples/jsm/loaders/LDrawLoader.js";
import { LDrawConditionalLineMaterial } from "three/examples/jsm/materials/LDrawConditionalLineMaterial.js";
import { normalizeBfcSource } from "../../src/render/bfc-source";
const load = (source: string) =>
  new Promise<THREE.Group>((resolve, reject) => {
    const loader = new LDrawLoader().setConditionalLineMaterial(
      LDrawConditionalLineMaterial,
    );
    (
      loader.parse as unknown as (
        s: string,
        ok: (g: THREE.Group) => void,
        fail: (e: unknown) => void,
      ) => void
    )(source, resolve, reject);
  });
it("whole normalized branches match independent expected front/back ray hits and local materials", async () => {
  const actual = await load(
    normalizeBfcSource(
      await readFile("fixtures/ldraw/bfc-branches.mpd", "utf8"),
    ),
  );
  const expected = await load(
    await readFile("fixtures/ldraw/bfc-branches.expected.mpd", "utf8"),
  );
  const probes = [
    [-95, -5],
    [5, -5],
    [95, -5],
    [-95, -85],
    [-83, -85],
    [95, -85],
    [83, -85],
    [-5, -85],
    [5, -45],
  ];
  const probe = (group: THREE.Group) => {
    group.updateMatrixWorld(true);
    return probes.flatMap(([x, y]) =>
      [-100, 100].map((z) => {
        const ray = new THREE.Raycaster(
          new THREE.Vector3(x, y, z),
          new THREE.Vector3(0, 0, -Math.sign(z)),
        );
        const hit = ray
          .intersectObject(group, true)
          .find((hit) => (hit.object as THREE.Mesh).isMesh);
        if (!hit) return null;
        const mesh = hit.object as THREE.Mesh;
        const material = Array.isArray(mesh.material)
          ? mesh.material[hit.face!.materialIndex]
          : mesh.material;
        return {
          z: Math.round(hit.point.z * 100) / 100,
          color: (material as THREE.MeshStandardMaterial).color.getHexString(),
        };
      }),
    );
  };
  const observed = probe(actual),
    reference = probe(expected);
  expect(reference.filter(Boolean).length).toBeGreaterThan(8);
  expect(observed).toEqual(reference);
  for (const group of [actual, expected])
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material)
        for (const material of Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material])
          material.dispose();
    });
});

it("a singular transform disables culling even across a physical-part reset", async () => {
  const group = await load(
    normalizeBfcSource(`0 FILE main.ldr
1 16 0 0 0 1 0 0 0 1 0 0 0 0 sheet.dat
0 FILE sheet.dat
0 !LDRAW_ORG Part
0 BFC CERTIFY CCW
3 16 0 0 0 30 0 0 0 -30 0
0 NOFILE`),
  );
  let vertices = 0;
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    vertices += mesh.geometry.getAttribute("position").count;
    mesh.geometry.dispose();
    for (const material of Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material])
      material.dispose();
  });
  expect(vertices).toBe(6);
});
