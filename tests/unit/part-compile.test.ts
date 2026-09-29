import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { LDrawLoader as UpstreamLoader } from "three/examples/jsm/loaders/LDrawLoader.js";
import { LDrawConditionalLineMaterial } from "three/examples/jsm/materials/LDrawConditionalLineMaterial.js";
import { LDrawLoader as VendoredLoader } from "../../src/render/vendor/LDrawLoader.js";
import {
  compilePartRecord,
  definesLocalColours,
  parseLDraw,
} from "../../src/render/part-compile-core";
import {
  materialSlot,
  packPart,
  rebuildPart,
  unpackPart,
  type MaterialSlot,
} from "../../src/render/part-record";
import { repairFaceNormals } from "../../src/render/raw-primitives";
import { indexPrototypeGeometry } from "../../src/render/geometry-index";
import { normalizeBfcSource } from "../../src/render/bfc-source";
import { PACK, readPack } from "../helpers/official-geometry";

const SHARED = "0 !COLOUR Shared CODE 9900016 VALUE #808080 EDGE #333333";
const ldconfig = readFileSync(PACK + "/LDConfig.ldr", "utf8")
  .split(/\r?\n/)
  .filter((l) => l.startsWith("0 !COLOUR"))
  .join("\n");

/** A renderer-shaped compile source: shared main colour, LDConfig, the
 * reference and its official closure as `0 FILE` blocks. */
function source(ref: string, colour = "9900016", context = "") {
  const blocks = new Map<string, string>();
  const visit = (text: string) => {
    for (const m of text.matchAll(/^\s*1\s+(?:\S+\s+){13}(.+?)\s*$/gm)) {
      const name = m[1].toLowerCase().replaceAll("\\", "/");
      const body = readPack(name);
      if (body === undefined || blocks.has(name)) continue;
      blocks.set(name, `0 FILE ${name}\n${body}`);
      visit(body);
    }
  };
  const line = `1 ${colour} 0 0 0 1 0 0 0 1 0 0 0 1 ${ref}`;
  visit(line);
  return normalizeBfcSource(
    [
      "0 FILE __render__.ldr",
      SHARED,
      ldconfig,
      context,
      "0 BFC CERTIFY CCW",
      line,
      ...blocks.values(),
    ].join("\n"),
  );
}

async function parseWith(Loader: typeof VendoredLoader, text: string) {
  const loader = new Loader().setConditionalLineMaterial(
    LDrawConditionalLineMaterial,
  );
  loader.setMaterials([]);
  loader.setFileMap(
    Object.fromEntries(
      [...text.matchAll(/^0 FILE (.+)$/gm)].map((m) => [m[1], m[1]]),
    ),
  );
  return new Promise<THREE.Group>((resolve, reject) =>
    (
      loader.parse as unknown as (
        s: string,
        ok: (g: THREE.Group) => void,
        fail: (e: unknown) => void,
      ) => void
    )(text, resolve, reject),
  );
}

/** Everything drawn: tree shape, transforms, attributes (exact bits),
 * groups and the colour code/kind of every material slot. */
function describeGroup(group: THREE.Object3D) {
  const out: unknown[] = [];
  group.traverse((object) => {
    const drawable = object as THREE.Mesh;
    const entry: Record<string, unknown> = {
      type: (object as { isConditionalLine?: boolean }).isConditionalLine
        ? "conditional"
        : object.type,
      name: object.name,
      children: object.children.length,
      matrix: object.matrix.toArray(),
      position: object.position.toArray(),
    };
    if (drawable.geometry) {
      entry.attributes = Object.fromEntries(
        Object.entries(drawable.geometry.attributes).map(([name, a]) => [
          name,
          [
            (a as THREE.BufferAttribute).itemSize,
            (a as THREE.BufferAttribute).count,
            // Exact bits, compared by digest.
            createHash("sha256")
              .update(new Float32Array((a as THREE.BufferAttribute).array))
              .digest("hex"),
          ],
        ]),
      );
      entry.groups = drawable.geometry.groups;
      entry.index = drawable.geometry.index
        ? createHash("sha256")
            .update(drawable.geometry.index.array as Uint16Array)
            .digest("hex")
        : null;
      entry.materials = (
        Array.isArray(drawable.material)
          ? drawable.material
          : [drawable.material]
      ).map((m) => materialSlot(m, object));
      entry.multi = Array.isArray(drawable.material);
    }
    out.push(entry);
  });
  return out;
}

// Studs, a sloped/curved part, a plate and a round part: smoothing across
// hard edges, conditional lines and several subparts.
const parts = ["3001.dat", "3062b.dat", "3040b.dat", "6141.dat", "3024.dat"];

describe("vendored LDrawLoader", () => {
  it("draws exactly what the pinned upstream loader draws", async () => {
    for (const ref of parts) {
      const text = source(ref);
      const upstream = await parseWith(
        UpstreamLoader as unknown as typeof VendoredLoader,
        text,
      );
      const vendored = await parseWith(VendoredLoader, text);
      expect(describeGroup(vendored), ref).toEqual(describeGroup(upstream));
    }
  }, 120000);

  it("smooths normals in linear time (a 32x32 baseplate compiles quickly)", async () => {
    const start = performance.now();
    const group = await parseWith(VendoredLoader, source("3811.dat"));
    const elapsed = performance.now() - start;
    let triangles = 0;
    group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh)
        triangles +=
          (o as THREE.Mesh).geometry.getAttribute("position").count / 3;
    });
    expect(triangles).toBeGreaterThan(40000);
    // Upstream's quadratic smoothing took tens of seconds for this part.
    expect(elapsed).toBeLessThan(15000);
  }, 60000);
});

describe("compiled part records", () => {
  it("rebuild to the same geometry and colour slots as a direct compile", async () => {
    for (const ref of parts) {
      const text = source(ref);
      const buffer = await compilePartRecord(text);
      expect(buffer, ref).toBeInstanceOf(ArrayBuffer);
      const { group } = await parseLDraw(text);
      repairFaceNormals(group);
      indexPrototypeGeometry(group);
      const materials = new Map<string, THREE.Material>();
      const rebuilt = rebuildPart(buffer!, (slot: MaterialSlot) => {
        const key = slot.code + ":" + slot.kind;
        if (!materials.has(key))
          materials.set(
            key,
            slot.kind === "face"
              ? Object.assign(new THREE.MeshStandardMaterial(), {
                  userData: { code: slot.code },
                })
              : slot.kind === "edge"
                ? Object.assign(new THREE.LineBasicMaterial(), {
                    userData: { code: slot.code },
                  })
                : Object.assign(new LDrawConditionalLineMaterial(), {
                    userData: { code: slot.code },
                  }),
          );
        return materials.get(key)!;
      });
      group.updateMatrixWorld(true);
      rebuilt.updateMatrixWorld(true);
      expect(describeGroup(rebuilt), ref).toEqual(describeGroup(group));
      const { header } = unpackPart(buffer!);
      expect(header.codes).toContain("9900016");
      expect(header.triangles).toBeGreaterThan(0);
    }
  }, 120000);

  it("packs into one buffer whose arrays are views (transferable, no copies)", async () => {
    const buffer = (await compilePartRecord(source("3001.dat")))!;
    const rebuilt = rebuildPart(buffer, () => new THREE.MeshBasicMaterial());
    rebuilt.traverse((o) => {
      const geometry = (o as THREE.Mesh).geometry;
      if (!geometry) return;
      for (const a of Object.values(geometry.attributes))
        expect((a as THREE.BufferAttribute).array.buffer).toBe(buffer);
    });
  });

  it("leaves parts with file-local colours to the main thread", async () => {
    const local = [
      "0 FILE __render__.ldr",
      SHARED,
      "1 9900016 0 0 0 1 0 0 0 1 0 0 0 1 custom.dat",
      "0 FILE custom.dat",
      "0 !COLOUR Local CODE 100 VALUE #1288FF EDGE #334455",
      "3 100 0 0 0 1 0 0 0 0 1",
    ].join("\n");
    expect(definesLocalColours(local)).toBe(true);
    expect(await compilePartRecord(local)).toBeNull();
    expect(definesLocalColours(source("3001.dat"))).toBe(false);
  });

  it("reports unresolved dependencies instead of fetching them", async () => {
    const text = [
      "0 FILE __render__.ldr",
      SHARED,
      "1 9900016 0 0 0 1 0 0 0 1 0 0 0 1 missing-part.dat",
    ].join("\n");
    await expect(compilePartRecord(text)).rejects.toMatchObject({
      code: "REFERENCE_MISSING",
    });
  });

  it("refuses malformed records", () => {
    expect(() => unpackPart(new ArrayBuffer(4))).toThrow();
    const group = new THREE.Group();
    const mesh = new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(9), 3),
      ),
      Object.assign(new THREE.MeshStandardMaterial(), {
        userData: { code: "4" },
      }),
    );
    group.add(mesh);
    const buffer = packPart(group);
    // Point an array past the end of the buffer.
    const truncated = buffer.slice(0, buffer.byteLength - 8);
    expect(() => rebuildPart(truncated, () => mesh.material)).toThrow();
    // Materials without a colour code (direct or missing colours) do not pack.
    mesh.material = new THREE.MeshStandardMaterial();
    expect(() => packPart(group)).toThrow();
  });
});
