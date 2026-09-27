import { expect, it } from "vitest";
import * as THREE from "three";
import { LDrawLoader } from "three/addons/loaders/LDrawLoader.js";
import { LDrawConditionalLineMaterial } from "three/addons/materials/LDrawConditionalLineMaterial.js";
import {
  RawPrimitiveCompiler,
  repairFaceNormals,
} from "../../src/render/raw-primitives";
const colors =
  "0 !COLOUR Red CODE 4 VALUE #CC2211 EDGE #442211\n0 !COLOUR Local CODE 100 VALUE #1288FF EDGE #334455 ALPHA 128";
async function reference(raw: string, context: string) {
  const loader = new LDrawLoader().setConditionalLineMaterial(
    LDrawConditionalLineMaterial,
  );
  loader.setMaterials([]);
  // A single primitive has no neighbours; loader smoothing only cancels double-sided twins.
  loader.smoothNormals = false;
  return new Promise<THREE.Group>((resolve, reject) =>
    (
      loader.parse as unknown as (
        s: string,
        cb: (g: THREE.Group) => void,
        err: (e: unknown) => void,
      ) => void
    )(colors + "\n" + context + "\n" + raw, resolve, reject),
  );
}
function data(group: THREE.Group) {
  const result: unknown[] = [];
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.geometry) return;
    result.push({
      type: object.type,
      attributes: Object.fromEntries(
        Object.entries(mesh.geometry.attributes).map(([k, v]) => [
          k,
          Array.from(v.array),
        ]),
      ),
      index: mesh.geometry.index && Array.from(mesh.geometry.index.array),
      materials: (Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      ).map((m) => ({
        type: m.type,
        color: (m as THREE.MeshStandardMaterial).color?.getHexString(),
        opacity: m.opacity,
        transparent: m.transparent,
        side: m.side,
      })),
    });
  });
  return result;
}
it("tiny primitive parsing matches loader geometry, BFC and materials for types2–5", async () => {
  const compiler = new RawPrimitiveCompiler(colors);
  for (const bfc of [
    "0 BFC CERTIFY CCW",
    "0 BFC CERTIFY CW",
    "0 BFC CERTIFY CCW\n0 BFC NOCLIP",
  ])
    for (const raw of [
      "2 4 0 0 0 10 10 0",
      "3 100 0 0 0 20 0 0 0 -20 0",
      "4 4 0 0 0 20 0 0 20 -20 0 0 -20 0",
      "5 4 0 0 0 20 0 0 0 -20 0 20 20 0",
      "3 0x212ABEF 0 0 0 20 0 0 0 -20 0",
      "2 24 0 0 0 20 0 0",
      "3 16 0 0 0 20 0 0 0 -20 0",
    ]) {
      const actual = await compiler.compile(raw, raw.split(" ")[1], {
        source: bfc,
        forceDoubleSided: false,
      });
      expect(data(actual)).toEqual(data(await reference(raw, bfc)));
    }
  compiler.dispose();
});
it("shares effective scoped face/edge/conditional materials across independent source faces", async () => {
  const compiler = new RawPrimitiveCompiler(colors),
    context = {
      source:
        "0 BFC CERTIFY CCW\n0 !COLOUR Override CODE 4 VALUE #ABCDEF EDGE #FEDCBA",
      forceDoubleSided: false,
    };
  for (const type of ["3", "2", "5"]) {
    const raw =
      type +
      " 4 0 0 0 20 0 0" +
      (type === "3" ? " 0 -20 0" : type === "5" ? " 0 -20 0 20 20 0" : "");
    const first = await compiler.compile(raw, "4", context),
      second = await compiler.compile(raw.replace("20", "25"), "4", context);
    expect((first.children[0] as THREE.Mesh).material).toEqual(
      (second.children[0] as THREE.Mesh).material,
    );
    expect(data(first)).toEqual(data(await reference(raw, context.source)));
  }
  expect(compiler.metrics.palettes).toBe(1);
  compiler.dispose();
});
it("does not accept multiline records or external part references", async () => {
  const compiler = new RawPrimitiveCompiler(colors);
  await expect(
    compiler.compile("1 4 0 0 0 1 0 0 0 1 0 0 0 1 bad.dat", "4", {
      source: "",
      forceDoubleSided: false,
    }),
  ).rejects.toThrow();
  await expect(
    compiler.compile("3 4 0 0 0 1 0 0 0 1 0\n1 bad", "4", {
      source: "",
      forceDoubleSided: false,
    }),
  ).rejects.toThrow();
});
it("isolates forced-double-sided materials and refuses use after disposal", async () => {
  const compiler = new RawPrimitiveCompiler(colors);
  const raw = "3 4 0 0 0 20 0 0 0 -20 0";
  const front = await compiler.compile(raw, "4", {
    source: "0 BFC CERTIFY CCW",
    forceDoubleSided: false,
  });
  const double = await compiler.compile(raw, "4", {
    source: "0 BFC CERTIFY CCW",
    forceDoubleSided: true,
  });
  const first = (front.children[0] as THREE.Mesh).material as THREE.Material;
  const second = (double.children[0] as THREE.Mesh).material as THREE.Material;
  expect(first.side).toBe(THREE.FrontSide);
  expect(second.side).toBe(THREE.DoubleSide);
  compiler.dispose();
  await expect(
    compiler.compile(raw, "4", { source: "", forceDoubleSided: false }),
  ).rejects.toThrow("disposed");
});

it("non-certified faces keep lit, outward normals on both sides", async () => {
  const compiler = new RawPrimitiveCompiler(colors);
  for (const source of [
    "0 BFC NOCERTIFY",
    "",
    "0 BFC CERTIFY CCW\n0 BFC NOCLIP",
  ]) {
    const group = await compiler.compile(
      "4 4 0 0 0 20 0 0 20 -20 0 0 -20 0",
      "4",
      { source, forceDoubleSided: false },
    );
    const mesh = group.children.find(
      (c) => (c as THREE.Mesh).isMesh,
    ) as THREE.Mesh;
    const normal = mesh.geometry.getAttribute("normal");
    const zs = new Set<number>();
    for (let i = 0; i < normal.count; i++) {
      const n = new THREE.Vector3().fromBufferAttribute(normal, i);
      expect(n.length()).toBeCloseTo(1, 5);
      zs.add(Math.sign(n.z));
    }
    expect([...zs].sort()).toEqual([-1, 1]);
  }
  compiler.dispose();
});
it("repairs cancelled or inward normals from loader smoothing without touching valid ones", () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
      3,
    ),
  );
  const smooth = new THREE.Vector3(0.3, 0, 1).normalize();
  geometry.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(
      [
        0,
        0,
        0,
        0.6,
        -0.8,
        0,
        0,
        0,
        -1,
        smooth.x,
        smooth.y,
        smooth.z,
        0,
        0,
        1,
        0,
        0,
        1,
      ],
      3,
    ),
  );
  const root = new THREE.Group().add(new THREE.Mesh(geometry));
  repairFaceNormals(root);
  const normal = geometry.getAttribute("normal");
  for (let i = 0; i < 3; i++)
    expect(
      new THREE.Vector3()
        .fromBufferAttribute(normal, i)
        .distanceTo(new THREE.Vector3(0, 0, 1)),
    ).toBeLessThan(1e-6);
  expect(new THREE.Vector3().fromBufferAttribute(normal, 3).x).toBeCloseTo(
    smooth.x,
    6,
  );
});
