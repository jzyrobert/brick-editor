import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { LDrawConditionalLineMaterial } from "three/examples/jsm/materials/LDrawConditionalLineMaterial.js";
import {
  parseTexmapCommand,
  projectPolygon,
  texmapProjector,
  type TexmapProjection,
} from "../../src/render/texmap";
import {
  compilePartRecord,
  parseLDraw,
} from "../../src/render/part-compile-core";
import { rebuildPart, unpackPart } from "../../src/render/part-record";
import { normalizeBfcSource } from "../../src/render/bfc-source";
import {
  TexmapMaterial,
  TexmapTextures,
  decodedSize,
  textureBytes,
  texmapBudget,
  type TexmapImage,
} from "../../src/render/texmap-textures";
import { pngSize, texmapTextures } from "../../src/catalog/full-texture-pack";
import { directReferences } from "../../src/catalog/full-pack";
import { fullLibrarySources } from "../../scripts/full-library-node";
import { modelHealth } from "../../src/core/health";
import { importLDraw } from "../../src/ldraw/io";
import { readFileSync } from "node:fs";
import { PACK } from "../helpers/official-geometry";

const LDCONFIG = readFileSync(PACK + "/LDConfig.ldr", "utf8")
  .split(/\r?\n/)
  .filter((l) => l.startsWith("0 !COLOUR"))
  .join("\n");
const close = (a: number[], b: number[]) =>
  a.forEach((x, i) => expect(x).toBeCloseTo(b[i], 6));

describe("!TEXMAP command parsing", () => {
  it("reads START/NEXT with each projection's parameters and the image", () => {
    expect(
      parseTexmapCommand(
        "START PLANAR -38.5 0 -18.5 -38.5 0 18.5 38.5 0 18.5 87079pxf.png",
      ),
    ).toEqual({
      command: "START",
      texmap: {
        method: "PLANAR",
        p1: [-38.5, 0, -18.5],
        p2: [-38.5, 0, 18.5],
        p3: [38.5, 0, 18.5],
        texture: "87079pxf.png",
      },
    });
    const cyl = parseTexmapCommand(
      "NEXT CYLINDRICAL 0 0 0 0 -10 0 0 0 -5 90 S\\Label.PNG GLOSSMAP gloss.png",
    );
    expect(cyl).toMatchObject({
      command: "NEXT",
      texmap: {
        method: "CYLINDRICAL",
        a: 90,
        texture: "s/label.png",
        glossmap: "gloss.png",
      },
    });
    expect(
      parseTexmapCommand(
        "START SPHERICAL 0 -20 0 -26 -20 0 0 -20 -26 180 175 61287p01rb.png",
      ),
    ).toMatchObject({ texmap: { method: "SPHERICAL", a: 180, b: 175 } });
  });
  it("accepts quoted names with spaces and escapes", () => {
    const c = parseTexmapCommand(
      'START PLANAR 0 0 0 1 0 0 0 1 0 "my \\"odd\\" \\\\image.png"',
    );
    expect(c && "texmap" in c && c.texmap.texture).toBe('my "odd" /image.png');
  });
  it("reads FALLBACK and END, and rejects malformed commands", () => {
    expect(parseTexmapCommand("FALLBACK")).toEqual({ command: "FALLBACK" });
    expect(parseTexmapCommand("end")).toEqual({ command: "END" });
    expect(
      parseTexmapCommand("START PLANAR 0 0 0 1 0 0 x.png"),
    ).toBeUndefined();
    expect(
      parseTexmapCommand("START CUBIC 0 0 0 1 0 0 0 1 0 x.png"),
    ).toBeUndefined();
    expect(
      parseTexmapCommand("START PLANAR 0 0 0 1 0 0 0 1 0"),
    ).toBeUndefined();
    expect(parseTexmapCommand("PUSH")).toBeUndefined();
  });
});

describe("!TEXMAP projections", () => {
  it("PLANAR: point 1 top-left, 2 top-right, 3 bottom-left", () => {
    const p: TexmapProjection = {
      method: "PLANAR",
      p1: [-10, 0, 5],
      p2: [10, 0, 5],
      p3: [-10, 20, 5],
    };
    const project = texmapProjector(p);
    close(project(-10, 0, 5), [0, 0]);
    close(project(10, 0, 5), [1, 0]);
    close(project(-10, 20, 5), [0, 1]);
    close(project(10, 20, 5), [1, 1]);
    close(project(0, 5, -40), [0.5, 0.25]); // projected along the normal
    close(project(20, -10, 0), [1.5, -0.5]); // beyond the extent
  });
  it("CYLINDRICAL: angle about the axis over a, height from the base", () => {
    // Axis up (-Y in LDraw), radial towards -Z, a quarter of the circumference.
    const project = texmapProjector({
      method: "CYLINDRICAL",
      p1: [0, 0, 0],
      p2: [0, -24, 0],
      p3: [0, 0, -10],
      a: 90,
    });
    close(project(0, 0, -10), [0.5, 1]); // bottom centre of the image
    close(project(0, -24, -10), [0.5, 0]); // top centre
    close(project(0, -12, -3), [0.5, 0.5]); // radius does not matter
    // Right-handed about 1→2 (up): seen from outside at -Z with -Y up, +X
    // is to the viewer's right, so the image reads from -X to +X.
    const r = Math.SQRT1_2 * 10;
    close(project(-r, -6, -r), [0, 0.75]);
    close(project(r, -6, -r), [1, 0.75]);
    // A full turn: a = 360 maps the far side to the image edges.
    const whole = texmapProjector({
      method: "CYLINDRICAL",
      p1: [0, 0, 0],
      p2: [0, -1, 0],
      p3: [0, 0, -1],
      a: 360,
    });
    expect(Math.abs(whole(0, 0, 1)[0] - 0.5)).toBeCloseTo(0.5, 6);
  });
  it("SPHERICAL: longitude in P1 over a, latitude over b (image top along (1→2)×(1→3))", () => {
    // 61287p01: centre (0,-20,0), image centre towards -X, P1 horizontal.
    const project = texmapProjector({
      method: "SPHERICAL",
      p1: [0, -20, 0],
      p2: [-26, -20, 0],
      p3: [0, -20, -26],
      a: 180,
      b: 175,
    });
    close(project(-26, -20, 0), [0.5, 0.5]);
    close(project(0, -20, -26), [1, 0.5]); // point 3: right edge
    close(project(0, -20, 26), [0, 0.5]);
    // Up (-Y) is the top of the image: 87.5° up is v = 0.
    const up = (87.5 * Math.PI) / 180;
    close(project(-26 * Math.cos(up), -20 - 26 * Math.sin(up), 0), [0.5, 0]);
    // Latitude does not jump for points just behind the centre plane.
    const [, v] = project(0.001, -20 - 5, -26);
    expect(v).toBeGreaterThan(0.2);
    expect(v).toBeLessThan(0.5);
  });
  it("keeps polygons straddling the ±180° seam on one side", () => {
    const project = texmapProjector({
      method: "CYLINDRICAL",
      p1: [0, 0, 0],
      p2: [0, -1, 0],
      p3: [0, 0, -1],
      a: 360,
    });
    const uv = projectPolygon(
      project,
      "CYLINDRICAL",
      [
        { x: 0.1, y: 0, z: 1 },
        { x: -0.1, y: 0, z: 1 },
        { x: -0.1, y: -1, z: 1 },
      ],
      360,
    );
    const us = [uv[0], uv[2], uv[4]];
    expect(Math.max(...us) - Math.min(...us)).toBeLessThan(0.1);
  });
});

async function compile(text: string) {
  return (await parseLDraw(normalizeBfcSource(text))).group;
}
function tagged(group: THREE.Object3D) {
  const out: { type: string; tag: unknown; count: number; uv?: number[] }[] =
    [];
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.geometry) return;
    const uv = m.geometry.getAttribute("uv");
    out.push({
      type: o.type,
      tag: o.userData.texmap ?? null,
      count: m.geometry.getAttribute("position").count,
      uv: uv ? [...(uv.array as Float32Array)] : undefined,
    });
  });
  return out;
}
const HEADER = [
  "0 FILE __render__.ldr",
  "0 !COLOUR Red CODE 4 VALUE #C91A09 EDGE #333333",
  "0 !COLOUR Main CODE 16 VALUE #808080 EDGE #333333",
  "0 BFC CERTIFY CCW",
  "1 4 0 0 0 1 0 0 0 1 0 0 0 1 t.dat",
  "0 FILE t.dat",
  "0 !LDRAW_ORG Part",
  "0 BFC CERTIFY CCW",
].join("\n");

describe("vendored loader !TEXMAP", () => {
  it("separates textured, fallback and plain geometry; UVs on textured faces", async () => {
    const group = await compile(
      HEADER +
        "\n" +
        [
          "3 16 0 0 0 1 0 0 0 1 0",
          "0 !TEXMAP START PLANAR 0 0 0 10 0 0 0 10 0 face.png",
          "0 !: 4 16 0 0 0 0 10 0 10 10 0 10 0 0",
          "0 !: 2 24 0 0 0 10 0 0",
          "0 !TEXMAP FALLBACK",
          "3 16 0 0 0 0 10 0 10 0 0",
          "0 !TEXMAP END",
        ].join("\n"),
    );
    const objects = tagged(group);
    const plain = objects.filter((o) => o.tag === null && o.type === "Mesh");
    expect(plain).toHaveLength(1);
    expect(plain[0].count).toBe(3);
    const textured = objects.find(
      (o) => (o.tag as { m: string } | null)?.m === "T" && o.type === "Mesh",
    )!;
    expect(textured.tag).toEqual({ t: "face.png", m: "T" });
    expect(textured.count).toBe(6); // one quad
    // Corners in quad order 0,1,2 / 0,2,3: (0,0) (0,10) (10,10) (10,0).
    close(textured.uv!, [0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0]);
    expect(objects.find((o) => o.type === "LineSegments")?.tag).toEqual({
      t: null,
      m: "T",
    });
    expect(
      objects.find(
        (o) => (o.tag as { m: string } | null)?.m === "F" && o.type === "Mesh",
      )?.count,
    ).toBe(3);
  });

  it("maps a referenced subfile in the referencing file's coordinates (and ignores stray !: lines)", async () => {
    const group = await compile(
      HEADER +
        "\n" +
        [
          "0 !: 3 16 0 0 0 1 0 0 0 1 0", // outside a texmap: ignored
          "0 !TEXMAP START PLANAR 0 0 0 20 0 0 0 20 0 face.png",
          "0 !: 1 16 10 0 0 1 0 0 0 1 0 0 0 1 s/quad.dat",
          "0 !TEXMAP FALLBACK",
          "0 !TEXMAP END",
          "0 FILE s/quad.dat",
          "0 !LDRAW_ORG Subpart",
          "0 BFC CERTIFY CCW",
          "4 16 0 0 0 0 10 0 10 10 0 10 0 0",
        ].join("\n"),
    );
    const objects = tagged(group);
    expect(objects).toHaveLength(1);
    expect(objects[0].tag).toEqual({ t: "face.png", m: "T" });
    // The subpart quad spans x 10…20 of the 20-wide texture.
    close(objects[0].uv!, [0.5, 0, 0.5, 0.5, 1, 0.5, 0.5, 0, 1, 0.5, 1, 0]);
  });

  it("NEXT maps one line; STEP and END close textures; geometry in both modes is 'B'", async () => {
    const group = await compile(
      HEADER +
        "\n" +
        [
          "0 !TEXMAP NEXT PLANAR 0 0 0 1 0 0 0 1 0 a.png",
          "3 16 0 0 0 1 0 0 0 1 0",
          "3 16 0 0 1 1 0 1 0 1 1",
          "0 !TEXMAP NEXT PLANAR 0 0 0 1 0 0 0 1 0 ignored.png",
          "0 // a comment cancels NEXT",
          "3 16 0 0 2 1 0 2 0 1 2",
          "0 !TEXMAP START PLANAR 0 0 0 1 0 0 0 1 0 b.png",
          "0 STEP",
          "3 16 0 0 3 1 0 3 0 1 3",
        ].join("\n"),
    );
    const meshes = tagged(group).filter((o) => o.type === "Mesh");
    expect(meshes.map((m) => [m.tag, m.count])).toEqual([
      [null, 9],
      [{ t: "a.png", m: "B" }, 3],
    ]);
  });

  it("reverses UVs with mirrored subfile winding", async () => {
    const group = await compile(
      HEADER +
        "\n" +
        [
          "1 16 0 0 0 -1 0 0 0 1 0 0 0 1 s/t.dat",
          "0 FILE s/t.dat",
          "0 !LDRAW_ORG Subpart",
          "0 BFC CERTIFY CCW",
          "0 !TEXMAP START PLANAR 0 0 0 1 0 0 0 1 0 a.png",
          "0 !: 3 16 0 0 0 1 0 0 0 1 0",
          "0 !TEXMAP END",
        ].join("\n"),
    );
    const mesh = tagged(group).find((o) => o.type === "Mesh")!;
    const position = (() => {
      let p: number[] = [];
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh)
          p = [...(m.geometry.getAttribute("position").array as Float32Array)];
      });
      return p;
    })();
    // Each corner keeps its own texture coordinate: u = -x, v = y (mirrored).
    for (let i = 0; i < 3; i++) {
      expect(mesh.uv![i * 2]).toBeCloseTo(-position[i * 3], 6);
      expect(mesh.uv![i * 2 + 1]).toBeCloseTo(position[i * 3 + 1], 6);
    }
  });

  it("render BFC normalization rewrites texture-mapped references", () => {
    const text = normalizeBfcSource(
      [
        "0 FILE a.ldr",
        "0 !TEXMAP START PLANAR 0 0 0 1 0 0 0 1 0 a.png",
        "0 !: 1 16 0 0 0 1 0 0 0 1 0 0 0 1 b.dat",
        "0 !TEXMAP END",
        "0 FILE b.dat",
        "0 BFC CERTIFY CCW",
        "3 16 0 0 0 1 0 0 0 1 0",
      ].join("\n"),
    );
    expect(text).toMatch(
      /^0 !: 1 16 0 0 0 1 0 0 0 1 0 0 0 1 __bfc_v1_1\.dat$/m,
    );
    expect(
      directReferences("0 !: 1 16 0 0 0 1 0 0 0 1 0 0 0 1 S\\x.dat"),
    ).toEqual(["s/x.dat"]);
    expect(
      directReferences("0 !: 1 16 0 0 0 1 0 0 0 1 0 0 0 1 x.dat", false),
    ).toEqual([]);
  });

  it("compiles official textured parts into records with UVs and tags (workers)", async () => {
    for (const [ref, textures] of [
      ["87079pxf.dat", ["87079pxf.png"]], // planar, empty fallback
      ["3626cpx0.dat", ["3626cpx0a.png", "3626cpx0b.png"]], // !: subfile refs
      ["61287p01.dat", ["61287p01rb.png"]], // spherical
    ] as const) {
      const files = fullLibrarySources([ref]);
      const text = normalizeBfcSource(
        [
          "0 FILE __render__.ldr",
          "0 !COLOUR Shared CODE 9900016 VALUE #808080 EDGE #333333",
          LDCONFIG,
          "0 BFC CERTIFY CCW",
          `1 9900016 0 0 0 1 0 0 0 1 0 0 0 1 ${ref}`,
          ...Object.entries(files).map(([n, t]) => `0 FILE ${n}\n${t}`),
        ].join("\n"),
      );
      const buffer = await compilePartRecord(text);
      expect(buffer, ref).toBeInstanceOf(ArrayBuffer);
      const { header } = unpackPart(buffer!);
      const tags = header.objects
        .map((o) => o.userData.texmap as { t: string | null } | undefined)
        .filter(Boolean);
      expect(
        [...new Set(tags.map((t) => t!.t).filter(Boolean))].sort(),
        ref,
      ).toEqual([...textures]);
      const group = rebuildPart(buffer!, (slot) =>
        slot.kind === "face"
          ? new THREE.MeshStandardMaterial()
          : slot.kind === "edge"
            ? new THREE.LineBasicMaterial()
            : new LDrawConditionalLineMaterial(),
      );
      let uvs = 0;
      group.traverse((o) => {
        const uv = (o as THREE.Mesh).geometry?.getAttribute("uv");
        if (!uv) return;
        expect(o.userData.texmap.t).toBeTruthy();
        uvs += uv.count;
        for (const value of uv.array as Float32Array)
          expect(Number.isFinite(value)).toBe(true);
      });
      expect(uvs, ref).toBeGreaterThan(0);
    }
  }, 60000);
});

/** A prototype shaped like a compiled textured part. */
function prototype() {
  const group = new THREE.Group();
  const face = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  face.userData.code = "4";
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(9), 3),
  );
  geometry.setAttribute(
    "uv",
    new THREE.BufferAttribute(new Float32Array(6), 2),
  );
  const plain = new THREE.Mesh(geometry, face);
  const textured = new THREE.Mesh(geometry, face);
  textured.userData.texmap = { t: "a.png", m: "T" };
  const fallback = new THREE.Mesh(geometry, face);
  fallback.userData.texmap = { t: null, m: "F" };
  const both = new THREE.Mesh(geometry, [face, face]);
  both.userData.texmap = { t: "b.png", m: "B" };
  group.add(plain, textured, fallback, both);
  return { group, plain, textured, fallback, both, face };
}
const image = (width = 64, height = 32): TexmapImage => ({
  bytes: new Uint8Array(8),
  width,
  height,
});
const fakeDecode = async (_: TexmapImage, w: number, h: number) =>
  ({ width: w, height: h }) as unknown as ImageBitmap;

describe("texture store and fallback selection", () => {
  it("draws textured when every texture loads, sharing materials and textures", async () => {
    const loads: string[] = [];
    const store = new TexmapTextures({
      load: async (n) => (loads.push(n), image()),
      budget: () => texmapBudget("desktop"),
      decode: fakeDecode,
    });
    const a = prototype();
    const outcome = await store.resolve(a.group, "t.dat");
    expect(outcome).toMatchObject({ textured: true, missing: [] });
    expect(a.group.children).not.toContain(a.fallback);
    expect(a.group.children).toContain(a.textured);
    const m = a.textured.material as TexmapMaterial;
    expect(m).toBeInstanceOf(TexmapMaterial);
    expect(m.map?.name).toBe("a.png");
    expect(m.map?.flipY).toBe(false);
    expect(m.userData.code).toBe("4");
    expect(a.plain.material).toBe(a.face);
    expect((a.both.material as THREE.Material[])[0].name).toContain("b.png");
    // A second prototype (another colour variant, another part) shares them.
    const b = prototype();
    b.textured.material = a.face;
    await store.resolve(b.group, "u.dat");
    expect(b.textured.material).toBe(m);
    expect(loads.sort()).toEqual(["a.png", "b.png"]);
    expect(store.stats()).toMatchObject({
      textures: 2,
      decodedBytes: 2 * textureBytes(64, 32),
    });
    // Clones (view treatments) keep the texture blending shader.
    const clone = m.clone() as TexmapMaterial;
    expect(clone.isTexmapMaterial).toBe(true);
    expect(clone.customProgramCacheKey()).toBe("ldraw-texmap-1");
    const shader = { fragmentShader: "x\n#include <map_fragment>\ny" };
    clone.onBeforeCompile(shader as never, undefined as never);
    expect(shader.fragmentShader).toContain("mix( diffuseColor.rgb");
    expect(
      store.diagnostics([{ id: "o1", node: { kind: "part", ref: "t.dat" } }]),
    ).toEqual([]);
    expect(TexmapTextures.texturesOf(new THREE.Group())).toBeUndefined();
    expect(await store.resolve(new THREE.Group())).toBeUndefined();
  });

  it("falls back (and reports) when a texture is missing or over budget", async () => {
    const store = new TexmapTextures({
      load: async (n) => (n === "a.png" ? undefined : image()),
      budget: () => texmapBudget("desktop"),
      decode: fakeDecode,
    });
    const a = prototype();
    const outcome = await store.resolve(a.group, "t.dat");
    expect(outcome?.textured).toBe(false);
    expect(outcome?.missing[0]).toMatchObject({ texture: "a.png" });
    expect(a.group.children).not.toContain(a.textured);
    expect(a.group.children).toContain(a.fallback);
    expect(a.both.material).toEqual([a.face, a.face]); // plain in fallback
    const [d] = store.diagnostics([
      { id: "o1", node: { kind: "part", ref: "t.dat" } },
      { id: "o2", node: { kind: "part", ref: "t.dat" } },
      { id: "o3", node: { kind: "part", ref: "3001.dat" } },
    ]);
    expect(d).toMatchObject({
      code: "UNSUPPORTED_RENDER_FEATURE",
      occurrenceIds: ["o1", "o2"],
    });
    expect(d.message).toContain("t.dat");
    expect(d.message).toContain("fallback");
    // Health reports it with the source's findings.
    const project = importLDraw("1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat");
    const check = modelHealth(project, [d]).checks.find(
      (c) => c.id === "unsupported-rendering",
    );
    expect(check?.status).toBe("warning");

    const tight = new TexmapTextures({
      load: async () => image(4096, 4096),
      budget: () => ({ bytes: 1024 * 1024, size: 2048, anisotropy: 1 }),
      decode: fakeDecode,
    });
    const b = prototype();
    const over = await tight.resolve(b.group);
    expect(over?.textured).toBe(false);
    expect(over?.missing[0].reason).toContain("budget");
    expect(tight.stats().decodedBytes).toBe(0);
  });

  it("downscales on the phone profile", async () => {
    expect(texmapBudget("mobile").size).toBeLessThan(
      texmapBudget("desktop").size,
    );
    expect(texmapBudget("mobile").bytes).toBeLessThan(
      texmapBudget("desktop").bytes,
    );
    expect(decodedSize(4746, 2301, 1024)).toEqual([1024, 496]);
    expect(decodedSize(4746, 2301, 2048)).toEqual([2048, 993]);
    expect(decodedSize(100, 50, 1024)).toEqual([100, 50]);
    const sizes: number[][] = [];
    const store = new TexmapTextures({
      load: async () => image(3200, 1600),
      budget: () => texmapBudget("mobile"),
      decode: async (i, w, h) => (sizes.push([w, h]), fakeDecode(i, w, h)),
    });
    await store.resolve(prototype().group);
    expect(sizes).toEqual([
      [1024, 512],
      [1024, 512],
    ]);
    expect(store.stats().decodedBytes).toBe(2 * textureBytes(1024, 512));
  });
});

describe("texture pack helpers", () => {
  it("reads PNG sizes and the textures a file names", () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48,
      0x44, 0x52, 0, 0, 1, 0, 0, 0, 0, 64,
    ]);
    expect(pngSize(png)).toEqual([256, 64]);
    expect(pngSize(new Uint8Array(24))).toBeUndefined();
    expect(
      texmapTextures(
        [
          "0 !TEXMAP START PLANAR 0 0 0 1 0 0 0 1 0 A.png GLOSSMAP g.png",
          "0 !TEXMAP NEXT SPHERICAL 0 0 0 1 0 0 0 1 0 90 90 b.png",
          "0 !TEXMAP FALLBACK",
          "0 !TEXMAP END",
        ].join("\n"),
      ).sort(),
    ).toEqual(["a.png", "b.png", "g.png"]);
  });
});
