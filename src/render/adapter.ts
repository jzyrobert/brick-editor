import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { LDrawLoader } from "three/addons/loaders/LDrawLoader.js";
import { LDrawConditionalLineMaterial } from "three/addons/materials/LDrawConditionalLineMaterial.js";
import {
  type Project,
  type CameraSpec,
  type Occurrence,
  type Vec3,
  ensure,
  AppError,
} from "../core/types";
import { occurrences } from "../core/document";
import { conversion } from "../core/math";
import { exportLDraw } from "../ldraw/io";
import { libraryLock } from "../catalog/catalog";
import { sha256, stable } from "../core/hash";
import { validate } from "../core/validate";
const defaultCamera: CameraSpec = {
  space: "ldraw",
  projection: "perspective",
  position: [420, -340, 460],
  target: [0, -25, 0],
  up: [0, -1, 0],
  fovDeg: 45,
  near: 0.5,
  far: 50000,
};
export type RenderRequest = {
  revision: number;
  width: number;
  height: number;
  format: "png";
  visibility: { mode: "all" | "current" | "layers"; layerIds?: string[] };
  background: { type: "solid" | "transparent"; color?: string };
  quality: "fast" | "balanced" | "photo";
  strict?: boolean;
};
export class SceneAdapter {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  root = new THREE.Group();
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  controls: OrbitControls;
  grid: THREE.GridHelper;
  cameraSpec = structuredClone(defaultCamera);
  revision = -1;
  error: unknown;
  private project?: Project;
  private pending: Promise<void> = Promise.resolve();
  private handles = new Map<string, THREE.Group>();
  private cache = new Map<string, Promise<THREE.Group>>();
  private allPrototypes = new Set<THREE.Group>();
  private libraryText = "";
  private colorText = "";
  private knownColors = new Set<string>();
  private resolvedCache = new Map<string, THREE.Group>();
  private load: Promise<void>;
  private raf = 0;
  private resizeObserver: ResizeObserver;
  private selection = new THREE.Group();
  private ghost = new THREE.Group();
  private ghostToken = 0;
  private disposed = false;
  private captureActive = false;
  private lost = false;
  constructor(
    private element: HTMLElement,
    private report: (message: string) => void,
  ) {
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      throw new AppError(
        "WEBGL_UNAVAILABLE",
        "WebGL2 is unavailable; file and inventory exports remain available.",
      );
    }
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.domElement.setAttribute("aria-label", "3D build viewport");
    element.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color("#e9edef");
    this.root.rotation.x = Math.PI;
    this.scene.add(this.root, this.selection);
    this.ghost.rotation.x = Math.PI;
    this.scene.add(this.ghost);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xa4adb2, 3));
    const sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.position.set(250, 600, 300);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xcbdcf0, 1.5);
    fill.position.set(-300, 150, -200);
    this.scene.add(fill);
    this.grid = new THREE.GridHelper(2000, 100, 0xaab6bd, 0xd1d9de);
    this.grid.position.y = -0.1;
    this.scene.add(this.grid);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 50000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.addEventListener("change", () => this.invalidate());
    this.setCamera(defaultCamera);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(element);
    this.resize();
    this.load = this.loadLibrary();
    this.renderer.domElement.addEventListener(
      "webglcontextlost",
      this.contextLost,
    );
    this.renderer.domElement.addEventListener(
      "webglcontextrestored",
      this.contextRestored,
    );
  }
  private contextLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
    this.report(
      "Graphics context lost. Your document remains available for native export.",
    );
  };
  private contextRestored = () => {
    this.lost = false;
    this.report("Graphics restored.");
    this.invalidate();
  };
  private async loadLibrary() {
    const base =
      import.meta.env.BASE_URL + "libraries/" + libraryLock.releaseId + "/";
    const res = await fetch(base + "manifest.json");
    ensure(res.ok, "REFERENCE_MISSING", "Library manifest unavailable");
    const manifestText = await res.text();
    ensure(
      (await sha256(manifestText)) === libraryLock.manifestSha256,
      "INVALID_INPUT",
      "Library manifest hash mismatch",
    );
    const manifest = JSON.parse(manifestText);
    const sources = await Promise.all(
      manifest.files.map(async (f: any) => {
        const r = await fetch(base + f.path);
        ensure(
          r.ok,
          "REFERENCE_MISSING",
          "Library file unavailable: " + f.path,
        );
        const text = await r.text();
        ensure(
          (await sha256(text)) === f.sha256,
          "INVALID_INPUT",
          "Library file hash mismatch",
        );
        return { path: f.path, text };
      }),
    );
    this.libraryText = sources
      .filter((s) => s.path !== "LDConfig.ldr")
      .map(
        (s) => "0 FILE " + s.path.replace(/^(parts|p)\//, "") + "\n" + s.text,
      )
      .join("\n");
    this.colorText = sources
      .find((s) => s.path === "LDConfig.ldr")!
      .text.split(/\r?\n/)
      .filter((l: string) => /^0 !COLOUR/.test(l))
      .join("\n");
    this.knownColors = new Set(
      [...this.colorText.matchAll(/\sCODE\s+(\d+)/g)]
        .map((m) => m[1])
        .filter((c) => c !== "16" && c !== "24"),
    );
  }
  private prototype(o: Occurrence, p: Project): Promise<THREE.Group> {
    const source = o.namespace === "official" ? "" : exportLDraw(p);
    const raw =
      o.node.kind === "geometry"
        ? p.models[o.modelId].records.find(
            (r) => r.id === o.node.sourceRecordId,
          )?.raw || ""
        : "";
    const key =
      o.namespace +
      ":" +
      o.node.ref +
      ":" +
      o.colorCode +
      ":" +
      raw +
      ":" +
      source;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const promise = (async () => {
      await this.load;
      if (o.namespace === "missing") {
        const g = new THREE.Group();
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(20, 24, 20),
          new THREE.MeshBasicMaterial({ color: 0xff37ac, wireframe: true }),
        );
        mesh.position.y = 12;
        g.add(mesh);
        this.allPrototypes.add(g);
        this.resolvedCache.set(key, g);
        return g;
      }
      let dependencyFailure: string | undefined;
      const manager = new THREE.LoadingManager();
      const loader = new LDrawLoader(manager);
      loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
      loader.setMaterials([]);
      manager.setURLModifier((url) => {
        dependencyFailure = url;
        throw new AppError(
          "REFERENCE_MISSING",
          "Unresolved dependency (network resolution disabled): " + url,
        );
      });
      const ref =
        o.namespace === "project"
          ? p.models[o.node.ref]?.name || o.node.ref
          : o.node.ref;
      const line =
        o.node.kind === "geometry"
          ? raw.replace(/^([2-5])\s+\S+/, `$1 ${o.colorCode}`)
          : `1 ${o.colorCode} 0 0 0 1 0 0 0 1 0 0 0 1 ${ref}`;
      const projectSource = source.replace(/\n0 NOFILE\s*$/, "");
      const localNames = new Set(
        Object.values(p.models).map((m) => m.name.toLowerCase()),
      );
      const library =
        o.namespace === "project"
          ? this.libraryText
              .split(/(?=^0 FILE )/m)
              .filter(
                (block) =>
                  !localNames.has(
                    block.match(/^0 FILE (.+)/)?.[1].toLowerCase() || "",
                  ),
              )
              .join("")
          : this.libraryText;
      const text =
        "0 FILE __render__.ldr\n" +
        this.colorText +
        "\n" +
        line +
        "\n" +
        projectSource +
        "\n" +
        library;
      loader.setFileMap(
        Object.fromEntries(
          [...text.matchAll(/^0 FILE (.+)$/gm)].map((m) => [m[1], m[1]]),
        ),
      );
      const group = await new Promise<THREE.Group>((resolve, reject) =>
        (
          loader.parse as unknown as (
            text: string,
            resolve: (g: THREE.Group) => void,
            reject: (e: unknown) => void,
          ) => void
        )(text, resolve, reject),
      );
      ensure(
        !dependencyFailure,
        "REFERENCE_MISSING",
        "Unresolved dependency: " + dependencyFailure,
      );
      ensure(
        o.namespace !== "official" || group.children.length > 0,
        "REFERENCE_MISSING",
        "Part compilation produced no geometry: " + o.node.ref,
      );
      this.allPrototypes.add(group);
      this.resolvedCache.set(key, group);
      return group;
    })();
    this.cache.set(key, promise);
    return promise;
  }
  update(p: Project) {
    const snapshot = structuredClone(p);
    this.pending = this.pending
      .catch(() => {})
      .then(async () => {
        await this.load;
        ensure(
          snapshot.library.manifestSha256 === libraryLock.manifestSha256,
          "REFERENCE_MISSING",
          "Pinned library is unavailable",
        );
        const all = occurrences(snapshot),
          keep = new Set(all.map((o) => o.id));
        ensure(
          all.length <= 5000,
          "LIMIT_EXCEEDED",
          "Reference renderer budget is 5,000 occurrences; document and exports remain available.",
        );
        const variants = new Set(
          all.map(
            (o) =>
              o.namespace +
              ":" +
              o.node.ref +
              ":" +
              o.colorCode +
              (o.node.kind === "geometry" ? ":" + o.node.id : ""),
          ),
        );
        ensure(
          variants.size <= 128,
          "LIMIT_EXCEEDED",
          "Reference renderer budget is 128 part/material variants.",
        );
        const customVariants = new Set(
          all
            .filter((o) => o.namespace === "project")
            .map(
              (o) =>
                o.node.ref +
                ":" +
                o.colorCode +
                (o.node.kind === "geometry" ? o.node.id : ""),
            ),
        ).size;
        ensure(
          !customVariants ||
            exportLDraw(snapshot).length * customVariants <= 50 * 1024 * 1024,
          "LIMIT_EXCEEDED",
          "Custom geometry compilation exceeds its bounded source budget.",
        );
        const loaded = await Promise.all(
          all.map(async (o) => ({
            o,
            prototype: await this.prototype(o, snapshot),
          })),
        );
        if (this.disposed) return;
        for (const [id, g] of this.handles)
          if (!keep.has(id)) {
            this.root.remove(g);
            this.handles.delete(id);
          }
        for (const { o, prototype } of loaded) {
          let group = this.handles.get(o.id);
          if (!group || group.userData.prototype !== prototype) {
            if (group) this.root.remove(group);
            group = prototype.clone(true);
            group.userData = { occurrenceId: o.id, prototype };
            this.handles.set(o.id, group);
            this.root.add(group);
          }
          const b = o.transform.basis,
            v = o.transform.position;
          group.matrixAutoUpdate = false;
          group.matrix.set(
            b[0],
            b[1],
            b[2],
            v[0],
            b[3],
            b[4],
            b[5],
            v[1],
            b[6],
            b[7],
            b[8],
            v[2],
            0,
            0,
            0,
            1,
          );
          group.visible = o.visible;
          group.updateMatrixWorld(true);
        }
        const inUse = new Set(
          [...this.handles.values()].map((g) => g.userData.prototype),
        );
        if (this.ghost.userData.prototype)
          inUse.add(this.ghost.userData.prototype);
        for (const [key, proto] of this.resolvedCache) {
          if (this.resolvedCache.size <= 128) break;
          if (inUse.has(proto)) continue;
          proto.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            mesh.geometry?.dispose();
            if (mesh.material)
              for (const mat of Array.isArray(mesh.material)
                ? mesh.material
                : [mesh.material])
                mat.dispose();
          });
          this.resolvedCache.delete(key);
          this.cache.delete(key);
          this.allPrototypes.delete(proto);
        }
        this.root.visible = true;
        this.project = snapshot;
        this.revision = snapshot.revision;
        this.error = undefined;
        this.select([]);
        this.invalidate();
      })
      .catch((e) => {
        this.error = e;
        this.root.visible = false;
        this.invalidate();
        this.report(e instanceof Error ? e.message : String(e));
        throw e;
      });
    this.pending.catch(() => {});
    return this.pending;
  }
  async ready(minRevision?: number, strict = false) {
    await this.pending;
    ensure(!this.lost, "WEBGL_UNAVAILABLE", "Graphics context is lost");
    ensure(
      minRevision === undefined || this.revision >= minRevision,
      "REVISION_CONFLICT",
      "Requested revision is not rendered",
    );
    if (strict) {
      ensure(
        this.project &&
          !this.project.diagnostics.some(
            (d) =>
              d.code === "UNSUPPORTED_RENDER_FEATURE" ||
              d.code === "REFERENCE_MISSING",
          ),
        "UNSUPPORTED_RENDER_FEATURE",
        "Strict render refuses missing references or unsupported features",
      );
      ensure(
        !occurrences(this.project).some((o) => o.namespace === "missing"),
        "REFERENCE_MISSING",
        "Strict render refuses unresolved parts",
      );
    }
    if (strict && this.project) {
      ensure(
        occurrences(this.project).every(
          (o) =>
            this.knownColors.has(o.colorCode) ||
            /^0x2[0-9a-f]{6}$/i.test(o.colorCode) ||
            Object.values(this.project!.models).some((m) =>
              m.records.some((r) =>
                r.raw.includes(" CODE " + o.colorCode + " "),
              ),
            ),
        ),
        "UNSUPPORTED_RENDER_FEATURE",
        "Strict capture refuses unresolved body colours",
      );
    }
    return {
      revision: this.revision,
      ready: true,
      warnings: this.project?.diagnostics || [],
    };
  }
  invalidate() {
    if (this.raf || this.disposed || this.lost) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.renderer.render(this.scene, this.camera);
    });
  }
  resize() {
    const w = this.element.clientWidth,
      h = this.element.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.aspect(w / h);
    this.invalidate();
  }
  private aspect(a: number) {
    if (this.camera instanceof THREE.PerspectiveCamera) this.camera.aspect = a;
    else {
      const span = this.cameraSpec.span || 600;
      this.camera.left = (-span * a) / 2;
      this.camera.right = (span * a) / 2;
      this.camera.top = span / 2;
      this.camera.bottom = -span / 2;
    }
    this.camera.updateProjectionMatrix();
  }
  setCamera(spec: CameraSpec) {
    validate("camera", spec);
    ensure(
      spec.far > spec.near,
      "INVALID_INPUT",
      "Far plane must exceed near plane",
    );
    ensure(
      new THREE.Vector3(...spec.position).distanceTo(
        new THREE.Vector3(...spec.target),
      ) > 0,
      "INVALID_INPUT",
      "Camera position equals target",
    );
    ensure(
      new THREE.Vector3(...spec.up).length() > 0,
      "INVALID_INPUT",
      "Camera up vector is zero",
    );
    this.cameraSpec = structuredClone(spec);
    this.camera =
      spec.projection === "perspective"
        ? new THREE.PerspectiveCamera(spec.fovDeg, 1, spec.near, spec.far)
        : new THREE.OrthographicCamera(
            -300,
            300,
            300,
            -300,
            spec.near,
            spec.far,
          );
    this.camera.position.fromArray(conversion(spec.position));
    this.camera.up.fromArray(conversion(spec.up));
    this.controls.object = this.camera;
    this.controls.target.fromArray(conversion(spec.target));
    this.camera.lookAt(this.controls.target);
    this.controls.update();
    this.camera.position.fromArray(conversion(spec.position));
    this.camera.lookAt(this.controls.target);
    this.resize();
  }
  currentCamera(): CameraSpec {
    return {
      ...this.cameraSpec,
      position: conversion(this.camera.position.toArray() as Vec3),
      target: conversion(this.controls.target.toArray() as Vec3),
      up: conversion(this.camera.up.toArray() as Vec3),
    };
  }
  fit() {
    const box = new THREE.Box3().setFromObject(this.root);
    if (box.isEmpty()) {
      this.setCamera(defaultCamera);
      return;
    }
    const size = box.getSize(new THREE.Vector3()).length(),
      center = box.getCenter(new THREE.Vector3());
    this.setCamera({
      ...defaultCamera,
      position: conversion(
        center
          .clone()
          .add(new THREE.Vector3(size * 0.8, size * 0.65, size * 0.9))
          .toArray() as Vec3,
      ),
      target: conversion(center.toArray() as Vec3),
      span: size * 1.3,
    });
  }
  select(ids: string[]) {
    for (const child of [...this.selection.children]) {
      this.selection.remove(child);
      const helper = child as THREE.BoxHelper;
      helper.geometry.dispose();
      (helper.material as THREE.Material).dispose();
    }
    for (const id of ids) {
      const obj = this.handles.get(id);
      if (obj) {
        const helper = new THREE.BoxHelper(obj, 0xea883c);
        this.selection.add(helper);
      }
    }
    this.invalidate();
  }
  ray(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        (-(clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    return ray;
  }
  pick(x: number, y: number) {
    this.scene.updateMatrixWorld(true);
    const intersections = this.ray(x, y).intersectObjects(
      [...this.handles.values()].filter((g) => g.visible),
      true,
    );
    for (const hit of intersections) {
      let obj: THREE.Object3D | null = hit.object;
      while (obj && !obj.userData.occurrenceId) obj = obj.parent;
      if (obj?.userData.occurrenceId)
        return obj.userData.occurrenceId as string;
    }
    return null;
  }
  workplane(x: number, y: number, elevation: number): Vec3 | null {
    const point = this.ray(x, y).ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 1, 0), elevation),
      new THREE.Vector3(),
    );
    return point ? conversion(point.toArray() as Vec3) : null;
  }
  showStep(ids: string[] | null) {
    const visible = new Set(
      ids ??
        (this.project
          ? occurrences(this.project)
              .filter((o) => o.visible)
              .map((o) => o.id)
          : []),
    );
    for (const [id, obj] of this.handles) obj.visible = visible.has(id);
    this.invalidate();
  }
  async previewPart(
    ref: string,
    colorCode: string,
    position: Vec3,
    basis: number[],
  ) {
    const token = ++this.ghostToken;
    this.clearGhost(false);
    if (!this.project) return;
    const node = {
      id: "ghost",
      kind: "part" as const,
      ref,
      colorCode,
      transform: { position, basis: basis as import("../core/types").Basis },
    };
    const o: Occurrence = {
      id: "ghost",
      path: ["ghost"],
      node,
      modelId: this.project.rootModelId,
      transform: node.transform,
      colorCode,
      layerId: this.project.defaultLayerId,
      namespace: "official",
      visible: true,
    };
    const proto = await this.prototype(o, this.project);
    if (token !== this.ghostToken || this.disposed) return;
    const group = proto.clone(true);
    group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.material) {
        mesh.material = (
          Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        ).map((material) => {
          const copy = material.clone();
          copy.transparent = true;
          copy.opacity = 0.4;
          copy.depthWrite = false;
          return copy;
        });
        if (mesh.material.length === 1) mesh.material = mesh.material[0];
      }
    });
    const b = basis,
      v = position;
    group.matrixAutoUpdate = false;
    group.matrix.set(
      b[0],
      b[1],
      b[2],
      v[0],
      b[3],
      b[4],
      b[5],
      v[1],
      b[6],
      b[7],
      b[8],
      v[2],
      0,
      0,
      0,
      1,
    );
    this.ghost.userData.prototype = proto;
    this.ghost.add(group);
    this.invalidate();
  }
  clearGhost(invalidateToken = true) {
    delete this.ghost.userData.prototype;
    if (invalidateToken) this.ghostToken++;
    for (const obj of [...this.ghost.children]) {
      obj.traverse((o) => {
        const material = (o as THREE.Mesh).material;
        if (material)
          for (const m of Array.isArray(material) ? material : [material])
            m.dispose();
      });
      this.ghost.remove(obj);
    }
    this.invalidate();
  }
  async image(request: RenderRequest) {
    validate("render", request);
    ensure(
      !this.captureActive,
      "INVALID_INPUT",
      "Another capture is in progress",
    );
    ensure(
      request.format === "png" &&
        Number.isInteger(request.width) &&
        Number.isInteger(request.height) &&
        request.width > 0 &&
        request.height > 0 &&
        request.width * request.height <= 16000000,
      "LIMIT_EXCEEDED",
      "PNG capture requires positive dimensions up to 16 megapixels",
    );
    ensure(
      request.width <= this.renderer.capabilities.maxTextureSize &&
        request.height <= this.renderer.capabilities.maxTextureSize,
      "LIMIT_EXCEEDED",
      "Image exceeds GPU size limit",
    );
    ensure(
      ["all", "current", "layers"].includes(request.visibility.mode),
      "INVALID_INPUT",
      "Explicit visibility is required",
    );
    await this.ready(request.revision, request.strict);
    ensure(
      this.revision === request.revision,
      "REVISION_CONFLICT",
      "Capture revision changed",
    );
    const p = this.project!,
      camera = this.currentCamera(),
      savedVisible = new Map(
        [...this.handles].map(([id, g]) => [id, g.visible]),
      ),
      background = this.scene.background,
      grid = this.grid.visible,
      selection = this.selection.visible,
      target = this.renderer.getRenderTarget();
    const rt = new THREE.WebGLRenderTarget(request.width, request.height, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      colorSpace: THREE.SRGBColorSpace,
    });
    const pixels = new Uint8Array(request.width * request.height * 4);
    const capturedRevision = this.revision;
    ensure(
      !this.captureActive,
      "INVALID_INPUT",
      "Another capture is in progress",
    );
    this.captureActive = true;
    try {
      for (const o of occurrences(p)) {
        const obj = this.handles.get(o.id)!;
        obj.visible =
          request.visibility.mode === "all" ||
          (request.visibility.mode === "current"
            ? o.visible
            : !!request.visibility.layerIds?.includes(o.layerId));
      }
      this.grid.visible = false;
      this.selection.visible = false;
      this.ghost.visible = false;
      this.scene.background =
        request.background.type === "transparent"
          ? null
          : new THREE.Color(request.background.color || "#ffffff");
      this.aspect(request.width / request.height);
      await this.renderer.compileAsync(this.scene, this.camera);
      ensure(
        this.revision === capturedRevision,
        "REVISION_CONFLICT",
        "Document changed during capture",
      );
      this.renderer.setRenderTarget(rt);
      this.renderer.render(this.scene, this.camera);
      this.renderer.readRenderTargetPixels(
        rt,
        0,
        0,
        request.width,
        request.height,
        pixels,
      );
    } finally {
      this.captureActive = false;
      this.renderer.setRenderTarget(target);
      rt.dispose();
      for (const [id, visible] of savedVisible) {
        const g = this.handles.get(id);
        if (g) g.visible = visible;
      }
      this.scene.background = background;
      this.grid.visible = grid;
      this.selection.visible = selection;
      this.ghost.visible = true;
      this.resize();
    }
    const canvas = document.createElement("canvas");
    canvas.width = request.width;
    canvas.height = request.height;
    const ctx = canvas.getContext("2d")!;
    const image = ctx.createImageData(request.width, request.height);
    for (let y = 0; y < request.height; y++)
      image.data.set(
        pixels.subarray(
          (request.height - 1 - y) * request.width * 4,
          (request.height - y) * request.width * 4,
        ),
        y * request.width * 4,
      );
    ctx.putImageData(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))),
        "image/png",
      ),
    );
    return {
      blob,
      manifest: {
        documentId: p.id,
        revision: p.revision,
        documentHash: await sha256(stable(p)),
        library: p.library,
        renderer: "three@0.174.0",
        camera,
        request,
        warnings: p.diagnostics,
        approximate: p.diagnostics.length > 0,
        graphics: this.renderer
          .getContext()
          .getParameter(this.renderer.getContext().RENDERER),
        stats: { ...this.renderer.info.render },
      },
    };
  }
  dispose() {
    this.disposed = true;
    this.clearGhost();
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.domElement.removeEventListener(
      "webglcontextlost",
      this.contextLost,
    );
    this.renderer.domElement.removeEventListener(
      "webglcontextrestored",
      this.contextRestored,
    );
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>();
    for (const group of this.allPrototypes)
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        if (mesh.material)
          for (const m of Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material])
            materials.add(m);
      });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    this.select([]);
    this.grid.geometry.dispose();
    (this.grid.material as THREE.Material).dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
