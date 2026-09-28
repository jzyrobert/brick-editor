import { validateRequest } from "../core/validate-request";
import { normalizeBfcSource } from "./bfc-source";
import {
  planeFromTriangle,
  planeOrigin,
  placeBasis,
  validateWorkplane,
  type Workplane,
} from "../edit/workplane";
import {
  selectRegion as selectRenderedRegion,
  type Point2,
  type RegionMode,
} from "./region-selection";
import {
  TransformHandles,
  type TransformHandleOptions,
} from "../edit/transform-handles";
import { LayerGhost } from "./layerGhost";
import { occurrenceRenderContext, occurrenceRawRecord } from "./source-context";
import { RawPrimitiveCompiler, repairFaceNormals } from "./raw-primitives";
import { dependencySource } from "./dependency-source";
import {
  resolveQuality,
  type QualityName,
  type QualityControls,
  type RenderProfile,
} from "./quality";
import { RenderBatches } from "./batching";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { LDrawLoader } from "three/addons/loaders/LDrawLoader.js";
import { LDrawConditionalLineMaterial } from "three/addons/materials/LDrawConditionalLineMaterial.js";
import {
  type Project,
  type CameraSpec,
  type Occurrence,
  type Vec3,
  type Transform,
  ensure,
  AppError,
} from "../core/types";
import { occurrences } from "../core/document";
import { conversion } from "../core/math";
import { libraryLock } from "../catalog/catalog";
import { sha256, stable } from "../core/hash";
/** Play renders continuously; cap its drawing buffer below phone DPRs of 2-3. */
export const PLAY_PIXEL_RATIO_CAP = 1.5;
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
  visibility: {
    mode: "all" | "current" | "layers" | "occurrences";
    layerIds?: string[];
    occurrenceIds?: string[];
  };
  background: { type: "solid" | "transparent"; color?: string };
  quality: "fast" | "balanced" | "photo";
  qualityControls?: Partial<QualityControls>;
  /** Keep these additions opaque while dimming all other captured occurrences. */
  instructionNewIds?: string[];
  strict?: boolean;
};
export type SectionSpec = { axis: "x" | "y" | "z"; at: number; flip?: boolean };
/** Renderer-world clipping plane for an LDraw-space section (world = (x, −y, −z)). */
function sectionPlane(spec: SectionSpec) {
  // Kept side: LDraw y ≥ at (below), x ≤ at, z ≤ at; flip keeps the opposite side.
  const normal =
    spec.axis === "y"
      ? new THREE.Vector3(0, -1, 0)
      : spec.axis === "x"
        ? new THREE.Vector3(-1, 0, 0)
        : new THREE.Vector3(0, 0, 1);
  const constant = spec.axis === "y" ? -spec.at : spec.at;
  return spec.flip
    ? new THREE.Plane(normal.negate(), -constant)
    : new THREE.Plane(normal, constant);
}
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
  private rawCompiler?: RawPrimitiveCompiler;
  private updateEpoch = 0;
  private compilationKeys = new WeakMap<
    Project,
    Map<string, Promise<string>>
  >();
  private knownColors = new Set<string>();
  private resolvedCache = new Map<string, THREE.Group>();
  private load: Promise<void>;
  private raf = 0;
  private resizeObserver: ResizeObserver;
  private transformHandles?: TransformHandles;
  private selection = new THREE.Group();
  private instructionVisibility: Set<string> | null = null;
  private ghost = new THREE.Group();
  private ghostToken = 0;
  private disposed = false;
  private captureActive = false;
  private batches = new RenderBatches();
  private layerGhost = new LayerGhost();
  private instructionDimming = new LayerGhost(0.3);
  private instructionNewIds: Set<string> | null = null;
  private playViewActive = false;
  private cameraChangeCount = 0;
  private playIncludedIds?: Set<string>;
  private ghostLayerId: string | null = null;
  private batchingEnabled =
    new URLSearchParams(location.search).get("referenceRenderer") !== "1";
  private lost = false;
  private contextEpoch = 0;
  private contextWork = new AbortController();
  private qualityProfile = resolveQuality("balanced");
  private keyLight!: THREE.DirectionalLight;
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
    this.root.add(this.batches.root);
    this.ghost.rotation.x = Math.PI;
    this.scene.add(this.ghost);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xa4adb2, 3));
    const sun = new THREE.DirectionalLight(0xffffff, 3);
    this.keyLight = sun;
    sun.name = "key";
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.2;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 5000;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -1500;
    sun.shadow.camera.right = sun.shadow.camera.top = 1500;
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
    this.contextEpoch++;
    this.contextWork.abort();
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.report(
      "Graphics context lost. Your document remains available for native export.",
    );
  };
  private contextRestored = () => {
    if (this.disposed) return;
    this.lost = false;
    this.contextWork = new AbortController();
    // Three rebuilds its GPU caches before this listener; retained scene
    // geometry and materials upload again on the next draw.
    this.renderer.setRenderTarget(null);
    this.resize();
    this.report("Graphics restored.");
    this.invalidate();
  };
  private async withContext<T>(work: Promise<T>): Promise<T> {
    const signal = this.contextWork.signal;
    ensure(
      !this.lost && !this.disposed,
      "WEBGL_UNAVAILABLE",
      "Graphics context is unavailable",
    );
    let interrupt: () => void = () => {};
    const interrupted = new Promise<never>((_, reject) => {
      interrupt = () =>
        reject(
          new AppError(
            "WEBGL_UNAVAILABLE",
            "Graphics context was interrupted; retry the capture after restoration",
          ),
        );
      signal.addEventListener("abort", interrupt, { once: true });
    });
    try {
      return await Promise.race([work, interrupted]);
    } finally {
      signal.removeEventListener("abort", interrupt);
    }
  }
  private compileForCapture() {
    const signal = this.contextWork.signal;
    const materials = this.renderer.compile(this.scene, this.camera);
    // The pinned Three release's compileAsync owns an uncancellable polling
    // timer. Own that polling here so a lost context cannot leave it running.
    return new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const start = performance.now();
      const finish = (error?: unknown) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        if (error) reject(error);
        else resolve();
      };
      const abort = () =>
        finish(
          new AppError(
            "WEBGL_UNAVAILABLE",
            "Shader compilation interrupted by graphics loss",
          ),
        );
      const check = () => {
        if (signal.aborted) {
          abort();
          return;
        }
        try {
          for (const material of materials) {
            const program = (
              this.renderer.properties.get(material) as {
                currentProgram?: { isReady(): boolean };
              }
            ).currentProgram;
            if (program?.isReady()) materials.delete(material);
          }
          if (!materials.size) {
            finish();
            return;
          }
          if (performance.now() - start > 30000) {
            finish(
              new AppError(
                "WEBGL_UNAVAILABLE",
                "Shader compilation timed out; retry capture",
              ),
            );
            return;
          }
          timer = setTimeout(check, 10);
        } catch (error) {
          finish(error);
        }
      };
      signal.addEventListener("abort", abort, { once: true });
      check();
    });
  }
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
  private compilationKey(project: Project, source: string) {
    let keys = this.compilationKeys.get(project);
    if (!keys) {
      keys = new Map();
      this.compilationKeys.set(project, keys);
    }
    let value = keys.get(source);
    if (!value) {
      value = sha256(source);
      keys.set(source, value);
    }
    return value;
  }
  private async prototype(o: Occurrence, p: Project): Promise<THREE.Group> {
    const source =
      o.namespace === "project" && o.node.kind !== "geometry"
        ? dependencySource(p, o.node.ref)
        : "";
    const renderContext = occurrenceRenderContext(p, o);
    const context = renderContext.source;
    const raw = o.node.kind === "geometry" ? occurrenceRawRecord(p, o) : "";
    const fingerprint = await this.compilationKey(
      p,
      context + "\n" + renderContext.forceDoubleSided + "\n" + source,
    );
    const key = JSON.stringify([
      o.namespace,
      o.node.ref,
      o.colorCode,
      fingerprint,
      raw,
    ]);
    const cached = this.cache.get(key);
    if (cached) return cached;
    const promise = (async () => {
      await this.load;
      if (o.node.kind === "geometry") {
        const compiler = (this.rawCompiler ??= new RawPrimitiveCompiler(
          this.colorText,
        ));
        const group = await compiler.compile(raw, o.colorCode, renderContext);
        this.allPrototypes.add(group);
        this.resolvedCache.set(key, group);
        return group;
      }
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
      const line = `1 ${o.colorCode} 0 0 0 1 0 0 0 1 0 0 0 1 ${ref}`;
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
      const text = normalizeBfcSource(
        "0 FILE __render__.ldr\n" +
          this.colorText +
          "\n" +
          context +
          "\n" +
          line +
          "\n" +
          projectSource +
          "\n" +
          library,
      );
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
      repairFaceNormals(group);
      group.traverse((object) => {
        if ((object as THREE.Mesh).isMesh) {
          if (renderContext.forceDoubleSided) {
            const mesh = object as THREE.Mesh;
            for (const material of Array.isArray(mesh.material)
              ? mesh.material
              : [mesh.material])
              material.side = THREE.DoubleSide;
          }
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      this.allPrototypes.add(group);
      this.resolvedCache.set(key, group);
      return group;
    })();
    this.cache.set(key, promise);
    return promise;
  }
  update(p: Project) {
    const snapshot = structuredClone(p);
    const epoch = ++this.updateEpoch;
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
        const physical = all.filter((o) => o.node.kind !== "geometry");
        ensure(
          physical.length <= 5000,
          "LIMIT_EXCEEDED",
          "Reference renderer budget is 5,000 part occurrences; document and exports remain available.",
        );
        ensure(
          all.length - physical.length <= 100000,
          "LIMIT_EXCEEDED",
          "Raw primitive rendering exceeds 100,000 source occurrences",
        );
        const variants = new Map<string, Occurrence>();
        for (const o of physical) {
          const context = occurrenceRenderContext(snapshot, o);
          variants.set(
            JSON.stringify([o.namespace, o.node.ref, o.colorCode, context]),
            o,
          );
        }
        ensure(
          variants.size <= 128,
          "LIMIT_EXCEEDED",
          "Reference renderer budget is 128 part/material variants.",
        );
        let sourceBytes = 0;
        const encoder = new TextEncoder();
        const contexts = new Set<string>();
        for (const o of all) {
          const context = occurrenceRenderContext(snapshot, o).source;
          if (!contexts.has(context)) {
            contexts.add(context);
            sourceBytes += encoder.encode(context).length;
          }
          if (o.node.kind === "geometry")
            sourceBytes += encoder.encode(
              occurrenceRawRecord(snapshot, o),
            ).length;
          ensure(
            sourceBytes <= 50 * 1024 * 1024,
            "LIMIT_EXCEEDED",
            "Geometry compilation exceeds its bounded source/context budget.",
          );
        }
        for (const o of variants.values()) {
          if (o.namespace !== "project") continue;
          sourceBytes += encoder.encode(
            dependencySource(snapshot, o.node.ref),
          ).length;
          ensure(
            sourceBytes <= 50 * 1024 * 1024,
            "LIMIT_EXCEEDED",
            "Custom geometry compilation exceeds its bounded dependency source budget.",
          );
        }
        const loaded: Array<{ o: Occurrence; prototype: THREE.Group }> = [];
        // Bound concurrent loader work and let input/source replacement interrupt
        // large raw-geometry imports without discarding any source occurrences.
        for (let offset = 0; offset < all.length; offset += 128) {
          if (this.disposed || epoch !== this.updateEpoch) return;
          loaded.push(
            ...(await Promise.all(
              all.slice(offset, offset + 128).map(async (o) => ({
                o,
                prototype: await this.prototype(o, snapshot),
              })),
            )),
          );
          if (offset + 128 < all.length)
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        if (this.disposed || epoch !== this.updateEpoch) return;
        this.instructionDimming.restore();
        this.layerGhost.restore();
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
          group.visible = this.instructionVisibility
            ? this.instructionVisibility.has(o.id)
            : o.visible;
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
                if (!mat.userData.rawPrimitiveShared) mat.dispose();
          });
          this.resolvedCache.delete(key);
          this.cache.delete(key);
          this.allPrototypes.delete(proto);
        }
        this.project = snapshot;
        this.applyLayerGhost();
        this.applyQuality(this.qualityProfile, true);
        this.root.visible = true;
        this.revision = snapshot.revision;
        this.error = undefined;
        this.select([]);
        this.invalidate();
      })
      .catch((e) => {
        if (this.disposed || epoch !== this.updateEpoch) return;
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
    // A newer update supersedes queued work, which then settles without rendering;
    // wait until no newer update was queued while this one was pending.
    let pending: Promise<void>;
    do {
      pending = this.pending;
      await this.withContext(pending);
    } while (pending !== this.pending);
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
  currentQuality() {
    return structuredClone(this.qualityProfile);
  }
  setQuality(name: QualityName, controls: Partial<QualityControls> = {}) {
    ensure(
      !this.captureActive,
      "INVALID_INPUT",
      "Wait for capture before changing render quality",
    );
    this.applyQuality(resolveQuality(name, controls));
    this.resize();
    return this.currentQuality();
  }
  private applyQuality(profile: RenderProfile, force = false) {
    if (
      !force &&
      JSON.stringify(profile) === JSON.stringify(this.qualityProfile)
    )
      return;
    this.qualityProfile = structuredClone(profile);
    this.applyPixelRatio();
    this.renderer.toneMapping =
      profile.toneMapping === "aces"
        ? THREE.ACESFilmicToneMapping
        : THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = profile.exposure;
    this.renderer.shadowMap.enabled = profile.shadows === "soft";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.keyLight.castShadow = profile.shadows === "soft";
    if (this.keyLight.shadow.mapSize.x !== profile.shadowMapSize) {
      this.keyLight.shadow.map?.dispose();
      this.keyLight.shadow.map = null;
      this.keyLight.shadow.mapSize.setScalar(profile.shadowMapSize);
    }
    for (const handle of this.handles.values())
      handle.traverse((object) => {
        if (!(object as THREE.LineSegments).isLineSegments) return;
        const conditional = !!(
          object as THREE.LineSegments
        ).geometry.getAttribute("control0");
        object.visible =
          profile.edges === "all" ||
          (profile.edges === "ordinary" && !conditional);
      });
    this.batches.rebuild(this.handles);
  }
  /** Continuous Play frames cap the backing store; phones report DPR 3. */
  private applyPixelRatio() {
    const ratio = Math.min(
      devicePixelRatio,
      this.qualityProfile.pixelRatioCap,
      this.playViewActive ? PLAY_PIXEL_RATIO_CAP : Infinity,
    );
    if (this.renderer.getPixelRatio() !== ratio)
      this.renderer.setPixelRatio(ratio);
  }
  private lightingManifest() {
    const lights: Record<string, unknown>[] = [];
    this.scene.updateMatrixWorld(true);
    this.scene.traverse((object) => {
      const light = object as THREE.Light;
      if (!light.isLight) return;
      const directional = light as THREE.DirectionalLight;
      const hemisphere = light as THREE.HemisphereLight;
      lights.push({
        type: light.type,
        name: light.name,
        color: light.color.getHexString(),
        intensity: light.intensity,
        position: conversion(
          light.getWorldPosition(new THREE.Vector3()).toArray() as Vec3,
        ),
        ...(hemisphere.isHemisphereLight
          ? { groundColor: hemisphere.groundColor.getHexString() }
          : {}),
        ...(directional.isDirectionalLight
          ? {
              target: conversion(
                directional.target
                  .getWorldPosition(new THREE.Vector3())
                  .toArray() as Vec3,
              ),
              shadow: {
                enabled: light.castShadow,
                mapSize: directional.shadow.mapSize.toArray(),
                bias: directional.shadow.bias,
                normalBias: directional.shadow.normalBias,
                camera: {
                  near: directional.shadow.camera.near,
                  far: directional.shadow.camera.far,
                  left: directional.shadow.camera.left,
                  right: directional.shadow.camera.right,
                  top: directional.shadow.camera.top,
                  bottom: directional.shadow.camera.bottom,
                },
              },
            }
          : {}),
      });
    });
    return { space: "ldraw", lights, environment: null };
  }
  private drawScene() {
    if (this.batchingEnabled)
      this.batches.render(this.renderer, this.scene, this.camera);
    else {
      this.batches.root.visible = false;
      this.renderer.render(this.scene, this.camera);
    }
  }
  invalidate() {
    if (this.raf || this.disposed || this.lost) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      if (!this.lost && !this.disposed) this.drawScene();
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
  /** Counts explicit camera replacements so demand-driven Play frames reapply theirs. */
  get cameraChanges() {
    return this.cameraChangeCount;
  }
  setCamera(spec: CameraSpec) {
    ensure(
      !this.captureActive,
      "INVALID_INPUT",
      "Wait for the current capture before changing the camera",
    );
    validateRequest("camera", spec);
    this.cameraChangeCount++;
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
  /** A bounded, opening-preserving collision snapshot in public LDraw coordinates. */
  async playGeometry(selection?: { include?: string[]; exclude?: string[] }) {
    ensure(
      !this.transformDragging,
      "INVALID_INPUT",
      "Finish or cancel the transform gesture before entering Play",
    );
    await this.ready();
    this.root.updateMatrixWorld(true);
    // Typed, amortised-growth buffers: large worlds have millions of corners, and
    // per-corner arrays/vectors made entering Play allocation-bound.
    let vertices = new Float32Array(1 << 16),
      indices = new Uint32Array(1 << 16),
      vertexFloats = 0,
      indexCount = 0;
    const grow = <T extends Float32Array | Uint32Array>(
      array: T,
      need: number,
    ) => {
      if (need <= array.length) return array;
      let size = array.length;
      while (size < need) size *= 2;
      const next = new (array.constructor as { new (n: number): T })(size);
      next.set(array);
      return next;
    };
    const min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity];
    const warnings: string[] = [];
    let overBudget = false;
    const include = selection?.include ? new Set(selection.include) : undefined;
    const exclude = new Set(selection?.exclude ?? []);
    if (include)
      ensure(
        [...include].every((id) => this.handles.has(id)),
        "INVALID_INPUT",
        "Unknown moving collider occurrence",
      );
    for (const [id, group] of this.handles) {
      if ((include && !include.has(id)) || exclude.has(id)) continue;
      group.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh || overBudget) return;
        const geometry = mesh.geometry,
          position = geometry.getAttribute("position");
        if (!position) return;
        const index = geometry.index;
        const count = index ? index.count : position.count;
        if (indexCount + count > 3_000_000) {
          overBudget = true;
          return;
        }
        const offset = vertexFloats / 3;
        vertices = grow(vertices, vertexFloats + position.count * 3);
        const e = mesh.matrixWorld.elements;
        for (let i = 0; i < position.count; i++) {
          const x = position.getX(i),
            y = position.getY(i),
            z = position.getZ(i);
          const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
          // Three world space to public LDraw coordinates (conversion()).
          const px = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w,
            py = -(e[1] * x + e[5] * y + e[9] * z + e[13]) * w,
            pz = -(e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
          vertices[vertexFloats++] = px;
          vertices[vertexFloats++] = py;
          vertices[vertexFloats++] = pz;
          if (px < min[0]) min[0] = px;
          if (px > max[0]) max[0] = px;
          if (py < min[1]) min[1] = py;
          if (py > max[1]) max[1] = py;
          if (pz < min[2]) min[2] = pz;
          if (pz > max[2]) max[2] = pz;
        }
        const mirrored = mesh.matrixWorld.determinant() < 0;
        indices = grow(indices, indexCount + count);
        for (let i = 0; i + 2 < count; i += 3) {
          const a = index ? index.getX(i) : i;
          const b = index ? index.getX(i + 1) : i + 1;
          const c = index ? index.getX(i + 2) : i + 2;
          indices[indexCount++] = offset + a;
          indices[indexCount++] = offset + (mirrored ? c : b);
          indices[indexCount++] = offset + (mirrored ? b : c);
        }
      });
    }
    if (overBudget) {
      warnings.push(
        "Collision mesh exceeds one million triangles. Fly mode remains available.",
      );
      vertexFloats = indexCount = 0;
    }
    if (
      this.project &&
      occurrences(this.project).some(
        (o) =>
          (!include || include.has(o.id)) &&
          !exclude.has(o.id) &&
          o.namespace === "missing",
      )
    ) {
      warnings.push(
        "Missing parts have no collision geometry. Use Fly to inspect this incomplete world.",
      );
      vertexFloats = indexCount = 0;
    }
    const empty = min[0] > max[0];
    return {
      revision: this.revision,
      vertices: vertices.slice(0, vertexFloats),
      indices: indices.slice(0, indexCount),
      unsupported: warnings.length > 0,
      bounds: {
        min: (empty ? [0, 0, 0] : min) as Vec3,
        max: (empty ? [0, 0, 0] : max) as Vec3,
      },
      warnings,
    };
  }
  selectRegion(polygon: Point2[], mode: RegionMode) {
    ensure(
      !this.captureActive,
      "CAPTURE_BUSY",
      "Wait for capture before selecting a region",
    );
    this.scene.updateMatrixWorld(true);
    return selectRenderedRegion(
      this.renderer,
      this.camera,
      this.handles,
      polygon,
      mode,
    );
  }
  get transformDragging() {
    return this.transformHandles?.dragging ?? false;
  }
  transformHitTest(clientX: number, clientY: number) {
    return this.transformHandles?.hitTest(clientX, clientY) ?? false;
  }
  bindTransformHandles(options: TransformHandleOptions) {
    ensure(
      !this.captureActive,
      "CAPTURE_BUSY",
      "Wait for capture before transforming",
    );
    this.transformHandles?.dispose();
    this.transformHandles = undefined;
    ensure(
      options.occurrenceIds.length > 0,
      "INVALID_INPUT",
      "Select a part to show transform handles",
    );
    this.scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3();
    for (const id of options.occurrenceIds) {
      const group = this.handles.get(id);
      ensure(group, "INVALID_INPUT", "Selection is not ready in the renderer");
      bounds.union(new THREE.Box3().setFromObject(group));
    }
    const pivot = conversion(
      bounds.getCenter(new THREE.Vector3()).toArray() as Vec3,
    );
    const handles = new TransformHandles(
      this.renderer.domElement,
      this.scene,
      () => this.camera,
      this.controls,
      pivot,
      options,
      () => this.invalidate(),
    );
    this.transformHandles = handles;
    return {
      cancel: () => handles.cancel(),
      dispose: () => {
        handles.dispose();
        if (this.transformHandles === handles)
          this.transformHandles = undefined;
      },
    };
  }
  beginTransientPose() {
    ensure(
      !this.captureActive,
      "CAPTURE_BUSY",
      "Wait for capture before starting a transform preview",
    );
    const matrices = new Map(
      [...this.handles].map(([id, group]) => [id, group.matrix.clone()]),
    );
    return () => {
      for (const [id, matrix] of matrices) {
        const group = this.handles.get(id);
        if (group) {
          group.matrix.copy(matrix);
          group.updateMatrixWorld(true);
        }
      }
      if (!this.batches.setDynamic([])) this.batches.rebuild(this.handles);
      this.invalidate();
    };
  }
  applyTransientPose(transforms: Record<string, Transform>) {
    ensure(
      !this.captureActive,
      "INVALID_INPUT",
      "Wait for capture before changing the mechanism pose",
    );
    const ids = Object.keys(transforms);
    ensure(
      ids.every((id) => this.handles.has(id)),
      "INVALID_INPUT",
      "Mechanism references an unknown occurrence",
    );
    // Moving occurrences draw live from their handles, so later poses only update
    // matrices instead of re-merging every static batch each frame.
    const dynamic = this.batches.dynamicIds;
    if (ids.some((id) => !dynamic.has(id)))
      this.batches.setDynamic([...dynamic, ...ids]);
    for (const [id, transform] of Object.entries(transforms)) {
      const group = this.handles.get(id)!;
      const b = transform.basis,
        p = transform.position;
      group.matrix.set(
        b[0],
        b[1],
        b[2],
        p[0],
        b[3],
        b[4],
        b[5],
        p[1],
        b[6],
        b[7],
        b[8],
        p[2],
        0,
        0,
        0,
        1,
      );
      group.updateMatrixWorld(true);
    }
    this.invalidate();
  }
  beginPlayView(includedOccurrenceIds?: string[]) {
    const included = new Set(includedOccurrenceIds ?? this.handles.keys());
    ensure(
      [...included].every((id) => this.handles.has(id)),
      "INVALID_INPUT",
      "Play includes an unknown occurrence",
    );
    this.playIncludedIds = included;
    this.playViewActive = true;
    this.applyPixelRatio();
    // Batches key on materials, so only a material restore needs a re-merge; the
    // visibility changes below are detected by the batches themselves.
    const materialsChanged =
      this.instructionDimming.active || this.layerGhost.active;
    this.instructionDimming.restore();
    this.layerGhost.restore();
    if (materialsChanged) this.batches.rebuild(this.handles);
    const camera = this.currentCamera();
    const visible = new Map(
      [...this.handles].map(([id, g]) => [id, g.visible]),
    );
    const grid = this.grid.visible,
      selection = this.selection.visible,
      transformVisible = this.transformHandles?.helper.visible;
    this.controls.enabled = false;
    this.grid.visible = false;
    this.selection.visible = false;
    if (this.transformHandles) this.transformHandles.helper.visible = false;
    this.clearGhost();
    for (const [id, group] of this.handles) group.visible = included.has(id);
    return () => {
      for (const [id, value] of visible) {
        const group = this.handles.get(id);
        if (group) group.visible = value;
      }
      this.grid.visible = grid;
      this.selection.visible = selection;
      if (this.transformHandles && transformVisible !== undefined)
        this.transformHandles.helper.visible = transformVisible;
      this.playViewActive = false;
      this.playIncludedIds = undefined;
      this.applyPixelRatio();
      this.applyLayerGhost();
      if (this.layerGhost.active || this.instructionDimming.active)
        this.batches.rebuild(this.handles);
      this.controls.enabled = true;
      this.setCamera(camera);
    };
  }
  /** Update a moving camera without reallocating the camera or invoking orbit constraints. */
  playCamera(spec: CameraSpec) {
    if (this.captureActive) return;
    if (!(this.camera instanceof THREE.PerspectiveCamera)) this.setCamera(spec);
    this.cameraSpec = structuredClone(spec);
    const camera = this.camera as THREE.PerspectiveCamera;
    camera.fov = spec.fovDeg || 65;
    camera.near = spec.near;
    camera.far = spec.far;
    camera.position.fromArray(conversion(spec.position));
    camera.up.fromArray(conversion(spec.up));
    this.controls.target.fromArray(conversion(spec.target));
    camera.lookAt(this.controls.target);
    camera.updateProjectionMatrix();
    this.invalidate();
  }
  fit() {
    const box = new THREE.Box3().setFromObject(this.root);
    if (box.isEmpty()) {
      this.setCamera(defaultCamera);
      return;
    }
    const radius = box.getSize(new THREE.Vector3()).length() / 2;
    const center = box.getCenter(new THREE.Vector3());
    const aspect = Math.max(
      0.1,
      this.element.clientWidth / this.element.clientHeight,
    );
    const vertical = THREE.MathUtils.degToRad(45) / 2;
    const limitingAngle = Math.min(
      vertical,
      Math.atan(Math.tan(vertical) * aspect),
    );
    const distance = (radius / Math.sin(limitingAngle)) * 1.12;
    this.setCamera({
      ...defaultCamera,
      position: conversion(
        center
          .clone()
          .add(
            new THREE.Vector3(0.8, 0.65, 0.9)
              .normalize()
              .multiplyScalar(distance),
          )
          .toArray() as Vec3,
      ),
      target: conversion(center.toArray() as Vec3),
      span: radius * 2.3,
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
  private sectionSpec: SectionSpec | null = null;
  /** Section cut (spec §20.2) along one LDraw axis. The kept side is below a height
   * (y, LDraw −Y is up), or behind/left of a vertical cut (x, z); `flip` keeps the other
   * side. An authoring aid only; captures record the plane in their clipping manifest. */
  setSectionPlane(spec: SectionSpec | null) {
    ensure(
      spec === null ||
        (["x", "y", "z"].includes(spec.axis) && Number.isFinite(spec.at)),
      "INVALID_INPUT",
      "A section needs an axis (x, y or z) and a finite LDU position.",
    );
    this.sectionSpec = spec && { ...spec, flip: !!spec.flip };
    this.renderer.clippingPlanes = spec ? [sectionPlane(spec)] : [];
    this.invalidate();
  }
  /** Horizontal cut: hide everything above LDraw height `h`. */
  setSection(h: number | null) {
    this.setSectionPlane(h === null ? null : { axis: "y", at: h });
  }
  get section() {
    return this.sectionSpec?.axis === "y" && !this.sectionSpec.flip
      ? this.sectionSpec.at
      : null;
  }
  get sectionPlane() {
    return this.sectionSpec;
  }
  /** LDraw extent of the visible model along an axis. */
  modelRange(axis: "x" | "y" | "z"): { min: number; max: number } | null {
    this.scene.updateMatrixWorld(true);
    const box = new THREE.Box3();
    for (const g of this.handles.values()) if (g.visible) box.expandByObject(g);
    if (box.isEmpty()) return null;
    const round = (v: number) => Math.round(v * 1e4) / 1e4 || 0;
    // World → LDraw: (x, −y, −z).
    const [lo, hi] =
      axis === "x"
        ? [box.min.x, box.max.x]
        : axis === "y"
          ? [-box.max.y, -box.min.y]
          : [-box.max.z, -box.min.z];
    return { min: round(lo), max: round(hi) };
  }
  /** LDraw heights of the model's top and bottom (top < bottom, since −Y is up). */
  modelHeightRange(): { top: number; bottom: number } | null {
    const r = this.modelRange("y");
    return r && { top: r.min, bottom: r.max };
  }
  private aboveSection(point: THREE.Vector3) {
    const plane = this.renderer.clippingPlanes[0];
    return !!plane && plane.distanceToPoint(point) < -1e-3;
  }
  /** First visible model surface under a screen point, in LDraw coordinates. */
  pickPoint(x: number, y: number): Vec3 | null {
    this.scene.updateMatrixWorld(true);
    for (const hit of this.ray(x, y).intersectObjects(
      [...this.handles.values()].filter((g) => g.visible),
      true,
    )) {
      if (this.aboveSection(hit.point)) continue;
      return conversion(hit.point.toArray() as Vec3);
    }
    return null;
  }
  private measureOverlay?: THREE.Group;
  /** Draw a measurement between LDraw points (an overlay, never part of the model). */
  setMeasurement(points: Vec3[]) {
    if (this.measureOverlay) {
      this.scene.remove(this.measureOverlay);
      this.measureOverlay.traverse((o) => {
        const d = o as THREE.Line;
        d.geometry?.dispose();
        (d.material as THREE.Material | undefined)?.dispose();
      });
      this.measureOverlay = undefined;
    }
    if (points.length) {
      const world = points.map((p) => new THREE.Vector3(...conversion(p)));
      const group = new THREE.Group();
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(world),
        new THREE.LineBasicMaterial({ color: 0xffb020, depthTest: false }),
      );
      const dots = new THREE.Points(
        new THREE.BufferGeometry().setFromPoints(world),
        new THREE.PointsMaterial({
          color: 0xffd166,
          size: 10,
          sizeAttenuation: false,
          depthTest: false,
        }),
      );
      line.renderOrder = dots.renderOrder = 1000;
      group.add(line, dots);
      this.measureOverlay = group;
      this.scene.add(group);
    }
    this.invalidate();
  }
  pick(x: number, y: number) {
    this.scene.updateMatrixWorld(true);
    const intersections = this.ray(x, y).intersectObjects(
      [...this.handles.values()].filter((g) => g.visible),
      true,
    );
    for (const hit of intersections) {
      if (this.aboveSection(hit.point)) continue;
      let obj: THREE.Object3D | null = hit.object;
      while (obj && !obj.userData.occurrenceId) obj = obj.parent;
      if (obj?.userData.occurrenceId)
        return obj.userData.occurrenceId as string;
    }
    return null;
  }
  /** Intersects only authored triangle meshes, preserving their complete world affine transform. */
  pickFace(
    x: number,
    y: number,
    selectedIds?: ReadonlySet<string>,
    settings?: Workplane,
  ): { occurrenceId: string; plane: Workplane } | null {
    this.scene.updateMatrixWorld(true);
    const ray = this.ray(x, y);
    const handles = [...this.handles]
      .filter(
        ([id, g]) => g.visible && (!selectedIds?.size || selectedIds.has(id)),
      )
      .map(([, g]) => g);
    for (const hit of ray.intersectObjects(handles, true)) {
      const mesh = hit.object as THREE.Mesh;
      if (!mesh.isMesh || !hit.face || this.aboveSection(hit.point)) continue;
      let object: THREE.Object3D | null = mesh,
        occurrenceId: string | undefined,
        visible = true;
      while (object) {
        if (!object.visible) visible = false;
        if (object.userData.occurrenceId)
          occurrenceId = object.userData.occurrenceId;
        object = object.parent;
      }
      if (!visible || !occurrenceId) continue;
      const positions = mesh.geometry.getAttribute("position");
      const point = (index: number) =>
        conversion(
          new THREE.Vector3()
            .fromBufferAttribute(positions, index)
            .applyMatrix4(mesh.matrixWorld)
            .toArray() as Vec3,
        );
      try {
        return {
          occurrenceId,
          plane: planeFromTriangle(
            point(hit.face.a),
            point(hit.face.b),
            point(hit.face.c),
            conversion(ray.ray.origin.toArray() as Vec3),
            settings,
          ),
        };
      } catch {
        continue;
      }
    }
    return null;
  }
  planeIntersection(x: number, y: number, plane: Workplane): Vec3 | null {
    validateWorkplane(plane);
    const n = new THREE.Vector3(...conversion(plane.normal)),
      origin = new THREE.Vector3(...conversion(planeOrigin(plane)));
    const point = this.ray(x, y).ray.intersectPlane(
      new THREE.Plane().setFromNormalAndCoplanarPoint(n, origin),
      new THREE.Vector3(),
    );
    return point ? conversion(point.toArray() as Vec3) : null;
  }
  setWorkplaneGuide(plane: Workplane) {
    validateWorkplane(plane);
    const basis = placeBasis(plane, 0),
      origin = planeOrigin(plane);
    const p = conversion(
      origin.map((n, i) => n + plane.normal[i] * 0.1) as Vec3,
    );
    const u = conversion([basis[0], basis[3], basis[6]]),
      down = conversion([basis[1], basis[4], basis[7]]),
      v = conversion([basis[2], basis[5], basis[8]]);
    this.grid.matrixAutoUpdate = false;
    const scale = plane.grid / 20;
    this.grid.matrix.set(
      u[0] * scale,
      down[0],
      v[0] * scale,
      p[0],
      u[1] * scale,
      down[1],
      v[1] * scale,
      p[1],
      u[2] * scale,
      down[2],
      v[2] * scale,
      p[2],
      0,
      0,
      0,
      1,
    );
    this.grid.updateMatrixWorld(true);
    this.invalidate();
  }
  workplane(x: number, y: number, elevation: number): Vec3 | null {
    const point = this.ray(x, y).ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 1, 0), elevation),
      new THREE.Vector3(),
    );
    return point ? conversion(point.toArray() as Vec3) : null;
  }
  private applyLayerGhost() {
    // Undo nested treatments in reverse order before replacing shared materials.
    this.instructionDimming.restore();
    const ids = new Set(
      !this.playViewActive &&
      this.project &&
      this.ghostLayerId &&
      this.project.layers[this.ghostLayerId]
        ? occurrences(this.project)
            .filter((o) => o.layerId !== this.ghostLayerId)
            .map((o) => o.id)
        : [],
    );
    this.layerGhost.apply(this.handles, ids);
    if (!this.playViewActive && this.instructionNewIds)
      this.instructionDimming.apply(
        this.handles,
        new Set(
          [...this.handles.keys()].filter(
            (id) => !this.instructionNewIds!.has(id),
          ),
        ),
      );
  }
  ghostOtherLayers(activeLayerId: string | null) {
    this.ghostLayerId = activeLayerId;
    // React may publish a view preference while shader compilation is pending.
    // Keep capture materials frozen; its finally block applies the latest value.
    if (this.captureActive) return;
    this.applyLayerGhost();
    this.batches.rebuild(this.handles);
    this.invalidate();
  }
  showStep(ids: string[] | null, newIds?: string[]) {
    this.instructionVisibility = ids ? new Set(ids) : null;
    this.instructionNewIds = ids && newIds ? new Set(newIds) : null;
    if (this.captureActive) return;
    this.applyLayerGhost();
    this.batches.rebuild(this.handles);
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
    ensure(
      !this.transformDragging,
      "INVALID_INPUT",
      "Finish or cancel the transform gesture before capture",
    );
    validateRequest("render", request);
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
      ["all", "current", "layers", "occurrences"].includes(
        request.visibility.mode,
      ),
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
      savedInstructionVisibility = this.instructionVisibility,
      savedVisible = new Map(
        [...this.handles].map(([id, g]) => [id, g.visible]),
      ),
      background = this.scene.background,
      grid = this.grid.visible,
      selection = this.selection.visible,
      transformVisible = this.transformHandles?.helper.visible,
      target = this.renderer.getRenderTarget(),
      controlsEnabled = this.controls.enabled,
      savedQuality = this.currentQuality();
    const captureProfile = resolveQuality(
      request.quality,
      request.qualityControls,
    );
    let captureLighting: ReturnType<SceneAdapter["lightingManifest"]>;
    let captureStats: typeof this.renderer.info.render;
    const rt = new THREE.WebGLRenderTarget(request.width, request.height, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      colorSpace: THREE.SRGBColorSpace,
    });
    const pixels = new Uint8Array(request.width * request.height * 4);
    const capturedRevision = this.revision,
      capturedContext = this.contextEpoch;
    ensure(
      !this.captureActive,
      "INVALID_INPUT",
      "Another capture is in progress",
    );
    this.captureActive = true;
    this.controls.enabled = false;
    try {
      this.instructionDimming.restore();
      this.layerGhost.restore();
      this.applyQuality(captureProfile);
      captureLighting = this.lightingManifest();
      const selectedOccurrences = new Set(
        request.visibility.occurrenceIds || [],
      );
      if (request.visibility.mode === "occurrences")
        ensure(
          [...selectedOccurrences].every((id) => this.handles.has(id)),
          "INVALID_INPUT",
          "Capture contains unknown occurrence IDs",
        );
      for (const o of occurrences(p)) {
        const obj = this.handles.get(o.id)!;
        obj.visible =
          (!this.playIncludedIds || this.playIncludedIds.has(o.id)) &&
          (request.visibility.mode === "all" ||
            (request.visibility.mode === "current"
              ? this.playViewActive || o.visible
              : request.visibility.mode === "occurrences"
                ? selectedOccurrences.has(o.id)
                : !!request.visibility.layerIds?.includes(o.layerId)));
      }
      if (request.instructionNewIds) {
        const additions = new Set(request.instructionNewIds);
        ensure(
          [...additions].every((id) => this.handles.has(id)),
          "INVALID_INPUT",
          "Instruction additions contain unknown occurrence IDs",
        );
        this.instructionDimming.apply(
          this.handles,
          new Set([...this.handles.keys()].filter((id) => !additions.has(id))),
        );
      }
      this.batches.rebuild(this.handles);
      this.grid.visible = false;
      this.selection.visible = false;
      if (this.transformHandles) this.transformHandles.helper.visible = false;
      this.ghost.visible = false;
      this.scene.background =
        request.background.type === "transparent"
          ? null
          : new THREE.Color(request.background.color || "#ffffff");
      this.aspect(request.width / request.height);
      await this.withContext(this.compileForCapture());
      ensure(
        !this.lost &&
          !this.renderer.getContext().isContextLost() &&
          capturedContext === this.contextEpoch,
        "WEBGL_UNAVAILABLE",
        "Graphics context changed during capture",
      );
      ensure(
        this.revision === capturedRevision,
        "REVISION_CONFLICT",
        "Document changed during capture",
      );
      this.renderer.setRenderTarget(rt);
      this.drawScene();
      captureStats = { ...this.renderer.info.render };
      this.renderer.readRenderTargetPixels(
        rt,
        0,
        0,
        request.width,
        request.height,
        pixels,
      );
      ensure(
        !this.renderer.getContext().isContextLost(),
        "WEBGL_UNAVAILABLE",
        "Graphics context was lost during readback",
      );
    } finally {
      this.captureActive = false;
      this.applyLayerGhost();
      this.batches.rebuild(this.handles);
      this.applyQuality(savedQuality);
      this.controls.enabled = controlsEnabled;
      this.renderer.setRenderTarget(target);
      rt.dispose();
      for (const [id, visible] of savedVisible) {
        const g = this.handles.get(id);
        if (g) g.visible = visible;
      }
      if (
        !this.playViewActive &&
        this.instructionVisibility !== savedInstructionVisibility
      ) {
        const latestVisible =
          this.instructionVisibility ??
          new Set(
            occurrences(this.project!)
              .filter((o) => o.visible)
              .map((o) => o.id),
          );
        for (const [id, group] of this.handles)
          group.visible = latestVisible.has(id);
      }
      this.scene.background = background;
      this.grid.visible = grid;
      this.selection.visible = selection;
      if (this.transformHandles && transformVisible !== undefined)
        this.transformHandles.helper.visible = transformVisible;
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
        appVersion: "brick-editor@0.1.0",
        assetHashes: Object.fromEntries(
          await Promise.all(
            Object.entries(p.assets).map(async ([name, data]) => [
              name,
              await sha256(data),
            ]),
          ),
        ),
        camera,
        request,
        warnings: p.diagnostics,
        approximate: p.diagnostics.length > 0,
        graphics: this.renderer
          .getContext()
          .getParameter(this.renderer.getContext().RENDERER),
        stats: captureStats!,
        profile: captureProfile,
        lighting: captureLighting!,
        clipping: {
          space: "renderer-world",
          planes: this.renderer.clippingPlanes.map((plane) => ({
            normal: plane.normal.toArray(),
            constant: plane.constant,
          })),
          localClippingEnabled: this.renderer.localClippingEnabled,
        },
        output: {
          width: request.width,
          height: request.height,
          colorSpace: this.renderer.outputColorSpace,
          toneMapping: captureProfile.toneMapping,
          exposure: captureProfile.exposure,
        },
        capabilities: {
          maxTextureSize: this.renderer.capabilities.maxTextureSize,
          maxSamples: this.renderer.capabilities.maxSamples,
          webgl2: true,
        },
      },
    };
  }
  dispose() {
    this.disposed = true;
    this.contextWork.abort();
    this.transformHandles?.dispose();
    this.transformHandles = undefined;
    this.instructionDimming.restore();
    this.layerGhost.restore();
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
    materials.forEach((m) => {
      if (!m.userData.rawPrimitiveShared) m.dispose();
    });
    this.rawCompiler?.dispose();
    this.rawCompiler = undefined;
    this.select([]);
    this.grid.geometry.dispose();
    (this.grid.material as THREE.Material).dispose();
    this.batches.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
