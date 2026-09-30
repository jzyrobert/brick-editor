import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { resolveLook } from "../../src/render/look";
import {
  PHOTO_SCHEDULE,
  choosePhotoRenderer,
  nextTilesPerFrame,
  photoDenoise,
  photoLens,
  photoProgress,
  traceMeshes,
  traceSignature,
} from "../../src/render/photo-policy";
import {
  mergeTraceGeometry,
  pathMaterial,
  studioBackdropGeometry,
  studioEnvironmentData,
} from "../../src/render/photo-tracer";
import { registerTreatment } from "../../src/render/batching";
import { RENDER_BUDGETS } from "../../src/render/render-budget";

const support = { floatRenderTargets: true, maxTextureSize: 8192 };

describe("photo look: path-traced stills", () => {
  it("path-traces by default with more samples on desktop than on phones", () => {
    const desktop = resolveLook("photo");
    const phone = resolveLook("photo", {}, "mobile");
    expect(desktop).toMatchObject({
      renderer: "path",
      backdrop: "studio",
      grade: "film",
      toneMapping: "neutral",
    });
    expect(desktop.depthOfField).toBeGreaterThan(0);
    expect(phone.renderer).toBe("path");
    expect(phone.pathSamples).toBeLessThan(desktop.pathSamples);
    // Realistic stays a raster look, unchanged by the photo controls.
    expect(resolveLook("realistic")).toMatchObject({
      renderer: "raster",
      backdrop: "none",
      grade: "none",
      depthOfField: 0,
    });
    for (const controls of [
      { pathSamples: 0 },
      { pathSamples: 5000 },
      { depthOfField: 2 },
      { renderer: "cycles" },
      { backdrop: "sky" },
      { grade: "sepia" },
      { toneMapping: "filmic" },
    ])
      expect(() => resolveLook("photo", controls as never)).toThrow(/bounds/);
  });

  it("falls back to the accumulated raster photo only for stated reasons", () => {
    const base = {
      look: { renderer: "path" as const },
      support,
      triangles: 250_000,
      triangleBudget: RENDER_BUDGETS.mobile.photoTriangles,
      profile: "mobile" as const,
    };
    expect(choosePhotoRenderer(base)).toEqual({
      renderer: "path",
      reason: null,
    });
    expect(
      choosePhotoRenderer({ ...base, look: { renderer: "raster" } }),
    ).toEqual({ renderer: "raster", reason: null });
    const over = choosePhotoRenderer({ ...base, triangles: 900_000 });
    expect(over.renderer).toBe("raster");
    expect(over.reason).toMatch(
      /900,000 triangles; the phone path tracer is limited to 600,000/,
    );
    expect(
      choosePhotoRenderer({
        ...base,
        support: { ...support, floatRenderTargets: false },
      }).reason,
    ).toMatch(/floating-point/);
    expect(choosePhotoRenderer({ ...base, sectionCut: true }).reason).toMatch(
      /Section cuts/,
    );
    expect(choosePhotoRenderer({ ...base, play: true }).renderer).toBe(
      "raster",
    );
    expect(
      choosePhotoRenderer({
        ...base,
        support: { ...support, maxTextureSize: 256 },
      }).reason,
    ).toMatch(/texture limit/);
    // Phones trace smaller scenes than desktops, in more, smaller tiles.
    expect(RENDER_BUDGETS.mobile.photoTriangles).toBeLessThan(
      RENDER_BUDGETS.desktop.photoTriangles,
    );
    const phone = PHOTO_SCHEDULE.mobile,
      desktop = PHOTO_SCHEDULE.desktop;
    expect(phone.tiles[0] * phone.tiles[1]).toBeGreaterThan(
      desktop.tiles[0] * desktop.tiles[1],
    );
    expect(phone.tilesPerFrame).toBeLessThanOrEqual(desktop.tilesPerFrame);
  });

  it("schedules tiles per frame from the measured frame interval", () => {
    expect(nextTilesPerFrame(4, 120, 9)).toBe(2);
    expect(nextTilesPerFrame(1, 500, 9)).toBe(1);
    expect(nextTilesPerFrame(2, 16, 9)).toBe(3);
    expect(nextTilesPerFrame(9, 16, 9)).toBe(9);
    expect(nextTilesPerFrame(3, 40, 9)).toBe(3);
    expect(nextTilesPerFrame(3, NaN, 9)).toBe(3);
    // Progress and smoothing follow the sample count.
    expect(photoProgress(0, 64)).toBe(0);
    expect(photoProgress(32, 64)).toBe(50);
    expect(photoProgress(80, 64)).toBe(100);
    expect(photoDenoise(1)).toBeGreaterThan(photoDenoise(16));
    expect(photoDenoise(16)).toBeGreaterThan(photoDenoise(256));
  });

  it("scales the lens aperture with the focus distance", () => {
    expect(photoLens(300, 0).apertureRadius).toBe(0);
    const near = photoLens(100, 0.5),
      far = photoLens(1000, 0.5);
    expect(far.apertureRadius / far.focusDistance).toBeCloseTo(
      near.apertureRadius / near.focusDistance,
    );
    expect(photoLens(-5, 1).focusDistance).toBe(1);
  });

  it("lights the studio from above camera left, deterministically", () => {
    const width = 128,
      height = 64;
    const a = studioEnvironmentData(width, height);
    expect(studioEnvironmentData(width, height)).toEqual(a);
    const at = (x: number, y: number, z: number) => {
      const d = new THREE.Vector3(x, y, z).normalize();
      const u = Math.atan2(d.z, d.x) / (2 * Math.PI) + 0.5;
      const v = 1 - Math.acos(d.y) / Math.PI;
      const column = Math.min(width - 1, Math.floor(u * width));
      const row = Math.min(height - 1, Math.floor(v * height));
      return a[(row * width + column) * 4];
    };
    // Key softbox (camera frame: +Z towards the camera, −X to its left).
    expect(at(-0.62, 0.7, 0.36)).toBeGreaterThan(10);
    expect(at(-0.62, 0.7, 0.36)).toBeGreaterThan(5 * at(0.62, 0.7, 0.36));
    // Below the horizon is dark.
    expect(at(0, -1, 0)).toBeLessThan(0.1);
  });

  it("builds a seamless inward-facing studio cove around the model", () => {
    const geometry = studioBackdropGeometry(
      new THREE.Vector3(10, 0, 20),
      100,
      -5,
    );
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.min.y).toBeCloseTo(-5);
    expect(box.max.y).toBeGreaterThan(500);
    expect(box.max.x - 10).toBeGreaterThan(500);
    // Faces point up on the floor and towards the subject on the walls.
    const position = geometry.getAttribute("position");
    const index = geometry.index!;
    const a = new THREE.Vector3(),
      b = new THREE.Vector3(),
      c = new THREE.Vector3();
    let floorUp = 0,
      wallIn = 0;
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(position, index.getX(i));
      b.fromBufferAttribute(position, index.getX(i + 1));
      c.fromBufferAttribute(position, index.getX(i + 2));
      const normal = new THREE.Vector3()
        .subVectors(b, a)
        .cross(new THREE.Vector3().subVectors(c, a));
      if (normal.lengthSq() < 1e-6) continue;
      normal.normalize();
      const centre = a.clone().add(b).add(c).divideScalar(3);
      if (centre.y < -4) floorUp += normal.y > 0.99 ? 1 : -1;
      else if (centre.y > 300) {
        const outward = new THREE.Vector3(
          centre.x - 10,
          0,
          centre.z - 20,
        ).normalize();
        wallIn += normal.dot(outward) < -0.9 ? 1 : -1;
      }
    }
    expect(floorUp).toBeGreaterThan(0);
    expect(wallIn).toBeGreaterThan(0);
  });

  it("merges meshes in world space, splitting vertices shared by two materials", () => {
    const red = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x0000ff });
    // A quad whose two triangles share an edge but use different materials.
    const quad = new THREE.BufferGeometry();
    quad.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3),
    );
    quad.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3),
    );
    quad.setIndex([0, 1, 2, 0, 2, 3]);
    quad.addGroup(0, 3, 0);
    quad.addGroup(3, 3, 1);
    const slots = new Map<THREE.Material, number>([
      [red, 1],
      [blue, 2],
    ]);
    const merged = mergeTraceGeometry(
      [
        {
          geometry: quad,
          matrix: new THREE.Matrix4().makeTranslation(10, 0, 0),
          materials: [red, blue],
        },
        {
          geometry: quad,
          matrix: new THREE.Matrix4().makeScale(-1, 1, 1),
          materials: [red, blue],
        },
      ],
      (m) => slots.get(m)!,
    );
    const position = merged.getAttribute("position");
    const index = merged.index!;
    // 4 vertices per copy, plus the 2 shared corners duplicated per copy.
    expect(position.count).toBe(12);
    expect(index.count).toBe(12);
    expect(position.getX(0)).toBe(10);
    const material = merged.getAttribute("materialIndex");
    const perTriangle = [0, 3, 6, 9].map((i) => material.getX(index.getX(i)));
    expect(perTriangle).toEqual([1, 2, 1, 2]);
    // The mirrored copy keeps its faces pointing along +Z.
    const face = (i: number) => {
      const p = (k: number) =>
        new THREE.Vector3().fromBufferAttribute(position, index.getX(i + k));
      return new THREE.Vector3()
        .subVectors(p(1), p(0))
        .cross(new THREE.Vector3().subVectors(p(2), p(0)));
    };
    expect(face(0).z).toBeGreaterThan(0);
    expect(face(6).z).toBeGreaterThan(0);
  });

  it("gives LDraw finishes physical path-tracing materials", () => {
    const material = (name: string, options: Record<string, unknown>) =>
      Object.assign(new THREE.MeshStandardMaterial(), { name, ...options });
    const abs = pathMaterial(material("Red", { roughness: 0.3, metalness: 0 }));
    expect(abs.transmission).toBe(0);
    expect(abs.clearcoat).toBeGreaterThan(0);
    const glass = pathMaterial(
      material("Trans_Clear", {
        roughness: 0.3,
        metalness: 0,
        transparent: true,
        opacity: 0.5,
      }),
    );
    expect(glass.transmission).toBe(1);
    expect(glass.transparent).toBe(false);
    const chrome = pathMaterial(
      material("Chrome_Silver", { roughness: 0, metalness: 1 }),
    );
    expect(chrome.metalness).toBe(1);
    // A ghosted (treated) opaque part stays see-through, not refractive.
    const base = material("Blue", { roughness: 0.3, metalness: 0 });
    const ghost = Object.assign(base.clone(), {
      transparent: true,
      opacity: 0.18,
    });
    registerTreatment(ghost, base);
    const traced = pathMaterial(ghost);
    expect(traced.transparent).toBe(true);
    expect(traced.opacity).toBeCloseTo(0.18);
    expect(traced.transmission).toBe(0);
    // A scene environment's ground keeps its own look: no ABS clear coat.
    const grass = new THREE.MeshStandardMaterial({
      color: 0x4a8a2a,
      roughness: 1,
    });
    grass.userData.photoStage = true;
    const ground = pathMaterial(grass);
    expect(ground.clearcoat).toBe(0);
    expect(ground.roughness).toBe(1);
    expect(ground.color.getHex()).toBe(grass.color.getHex());
  });

  it("collects visible triangle meshes and changes signature when they move", () => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial(),
    );
    const hidden = mesh.clone();
    hidden.visible = false;
    const lines = new THREE.LineSegments(new THREE.BufferGeometry());
    group.add(mesh, hidden, lines);
    group.updateMatrixWorld(true);
    const { meshes, triangles } = traceMeshes([group]);
    expect(meshes).toEqual([mesh]);
    expect(triangles).toBe(12);
    const before = traceSignature(meshes);
    expect(traceSignature(meshes)).toBe(before);
    mesh.position.x = 5;
    group.updateMatrixWorld(true);
    expect(traceSignature(meshes)).not.toBe(before);
  });
});
