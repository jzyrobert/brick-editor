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
import { indexPrototypeGeometry } from "./geometry-index";
import {
  explodeLifts,
  floorFocusSets,
  liftAt,
  occurrenceBottoms,
  type BottomCache,
} from "../edit/floors";
import {
  architectureOf,
  sortedFloors,
  type FloorFocus,
} from "../core/architecture";
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
import {
  resolveLook,
  lookUsesPipeline,
  classifyFinish,
  parseFlakeMaterials,
  FINISH_PARAMETERS,
  LOOK_LIGHTING,
  type FlakeSpec,
  type LookControls,
  type LookName,
  type RenderLook,
} from "./look";
import {
  LookPipeline,
  jitterOffset,
  applyFlakes,
  removeFlakes,
} from "./look-pipeline";
import type { ResourceProfileName } from "../core/resource-profile";
import { checkRenderBudget, renderBudget } from "./render-budget";
import {
  PHOTO_SCHEDULE,
  choosePhotoRenderer,
  nextTilesPerFrame,
  photoDenoise,
  photoProgress,
  traceMeshes,
  traceSignature,
  type PhotoRendererChoice,
} from "./photo-policy";
import type { PhotoTracer, TraceSource } from "./photo-tracer";
import {
  boxProxy,
  collisionProxy,
  keepsOpenings,
  partTitle,
} from "../play/collision-proxy";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { LDrawLoader } from "./vendor/LDrawLoader.js";
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
import { fullLibraryLock, fullSource } from "../catalog/full-library";
import { PartCompiler, type PartCompileStats } from "./part-compiler";
import { parseLDraw, PART_COMPILER_VERSION } from "./part-compile-core";
import { rebuildPart, unpackPart } from "./part-record";
import {
  GeometryCache,
  geometryCacheKey,
  openIndexedDbStore,
} from "./geometry-cache";
import { TimeSlicer } from "./scheduling";
import { prepareFullLibrary } from "../catalog/full-library-loader";
import { directReferences } from "../catalog/full-pack";
import installedBounds from "../catalog/bounds.json";
import { canonical } from "../ldraw/path";
import { sha256, stable } from "../core/hash";
/** Play renders continuously; cap its drawing buffer below phone DPRs of 2-3. */
export const PLAY_PIXEL_RATIO_CAP = 1.5;
/** Phones draw a large moving view at this density and restore it at rest. */
export const MOTION_PIXEL_RATIO_CAP = 1.25;
/** A view counts as at rest this long after its last motion event. */
export const MOTION_IDLE_MS = 180;
/** A photo still starts path tracing once the view has been still this long. */
export const PHOTO_IDLE_MS = 220;
/** Refinement of a photo still, for the "Refining photo… n%" toast. */
export type PhotoProgressReport = {
  phase: "preparing" | "refining" | "done";
  percent: number;
  samples: number;
  target: number;
  renderer: "path" | "raster";
  /** Why the path tracer is not used, when it is not. */
  note: string | null;
};
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
  /** Shading look for this capture; defaults to "standard" so captures stay reproducible. */
  look?: LookName;
  lookControls?: Partial<LookControls>;
  /** Keep these additions opaque while dimming all other captured occurrences. */
  instructionNewIds?: string[];
  strict?: boolean;
};
export { explodeLifts };
function disposeTexture(texture: THREE.Texture | undefined) {
  texture?.dispose();
  return undefined;
}
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
type TextStyle = "guide" | "focus" | "label" | "dim";
const TEXT_STYLES: Record<TextStyle, { bg: string; fg: string; line: string }> =
  {
    guide: { bg: "rgba(29,34,48,0.78)", fg: "#cfe8ff", line: "#8ec9ff" },
    focus: { bg: "rgba(29,34,48,0.9)", fg: "#f4f1ea", line: "#5bb56a" },
    label: {
      bg: "rgba(29,34,48,0.9)",
      fg: "#f4f1ea",
      line: "rgba(244,241,234,0.35)",
    },
    dim: {
      bg: "rgba(29,34,48,0.45)",
      fg: "rgba(244,241,234,0.6)",
      line: "rgba(244,241,234,0.2)",
    },
  };
/** Screen-facing text for guides and room labels, kept at a constant on-screen size. */
function textSprite(text: string, style: TextStyle) {
  const scale = 2,
    cssHeight = 24,
    font = `600 ${13 * scale}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const canvas = document.createElement("canvas"),
    ctx = canvas.getContext("2d")!;
  ctx.font = font;
  const height = cssHeight * scale,
    width = Math.ceil(ctx.measureText(text).width + 20 * scale);
  canvas.width = width;
  canvas.height = height;
  const colors = TEXT_STYLES[style];
  ctx.font = font;
  ctx.fillStyle = colors.bg;
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.roundRect(scale, scale, width - 2 * scale, height - 2 * scale, 8 * scale);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = colors.fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, height / 2 + scale);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  sprite.center.set(0.5, 0); // stands on its anchor point
  sprite.renderOrder = 1001;
  sprite.frustumCulled = false;
  sprite.userData = { text };
  const aspect = width / height,
    at = new THREE.Vector3();
  sprite.onBeforeRender = (renderer, _scene, camera) => {
    const target = renderer.getRenderTarget();
    // Live labels keep a fixed CSS size; captures scale as on a 900px-tall view.
    const viewCss = target
      ? 900
      : renderer.domElement.height / renderer.getPixelRatio();
    let viewHeight: number;
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const c = camera as THREE.PerspectiveCamera;
      sprite.getWorldPosition(at).applyMatrix4(c.matrixWorldInverse);
      viewHeight =
        2 *
        Math.max(-at.z, 1e-3) *
        Math.tan(THREE.MathUtils.degToRad(c.fov) / 2);
    } else {
      const c = camera as THREE.OrthographicCamera;
      viewHeight = (c.top - c.bottom) / c.zoom;
    }
    const h = (cssHeight / Math.max(1, viewCss)) * viewHeight;
    sprite.scale.set(h * aspect, h, 1);
    sprite.updateMatrixWorld(true);
  };
  return sprite;
}
/** Sentinel main colour for shared part geometry. It is not an LDConfig code, so
 * no official part draws it as a fixed colour: every material in this code is
 * exactly the inherited main colour (16) or its edges (24). */
const SHARED_MAIN_CODE = "9900016";
const SHARED_MAIN_COLOUR = `0 !COLOUR Brick_Editor_Shared_Main CODE ${SHARED_MAIN_CODE} VALUE #808080 EDGE #333333`;
type MainMaterials = {
  face?: THREE.Material;
  edge?: THREE.Material;
  conditional?: THREE.Material;
};
/** Face, edge and conditional-line materials drawn in `code` (any code when
 * omitted), classified by the loader's object and material kinds. */
function mainMaterials(group: THREE.Object3D, code?: string): MainMaterials {
  const found: MainMaterials = {};
  group.traverse((object) => {
    const drawable = object as THREE.Mesh | THREE.LineSegments;
    if (!drawable.material) return;
    for (const material of Array.isArray(drawable.material)
      ? drawable.material
      : [drawable.material]) {
      if (code !== undefined && material.userData.code !== code) continue;
      if ((drawable as THREE.Mesh).isMesh) found.face ??= material;
      else if ((material as THREE.ShaderMaterial).isShaderMaterial)
        found.conditional ??= material;
      else if ((drawable as THREE.LineSegments).isLineSegments)
        found.edge ??= material;
    }
  });
  return found;
}
/** Longest stretch of model loading work in one main-thread task. */
const LOAD_SLICE_MS = 12;
/** Persistent compiled-geometry budget per resource profile. */
const GEOMETRY_CACHE_BYTES: Record<ResourceProfileName, number> = {
  desktop: 128 * 1024 * 1024,
  mobile: 48 * 1024 * 1024,
};
/** Diagnostic URL switches: `geometryCache=0`, `compileWorkers=0|N`,
 * `progressive=0`. */
const loadOption = (name: string) =>
  typeof location === "undefined"
    ? null
    : new URLSearchParams(location.search).get(name);
let geometryCache: GeometryCache | undefined;
/** One persistent geometry cache per page (`?geometryCache=0` disables it). */
function sharedGeometryCache() {
  if (loadOption("geometryCache") === "0") return undefined;
  return (geometryCache ??= new GeometryCache(
    openIndexedDbStore(),
    GEOMETRY_CACHE_BYTES.desktop,
  ));
}
/** SHA-256 of compile inputs, shared across updates (bounded, oldest out). */
const compilationKeys = new Map<string, Promise<string>>();
function compilationKey(source: string) {
  let value = compilationKeys.get(source);
  if (value) {
    // Refresh recency.
    compilationKeys.delete(source);
  } else {
    value = sha256(source);
    value.catch(() => compilationKeys.delete(source));
  }
  compilationKeys.set(source, value);
  if (compilationKeys.size > 512)
    compilationKeys.delete(compilationKeys.keys().next().value!);
  return value;
}
export type LoadProgress = {
  /** Distinct part/colour variants compiled so far, and in all. */
  done: number;
  total: number;
};
/**
 * `object.clone(true)` for compiled part trees, without the throwaway default
 * geometry and material every Mesh/Line constructor allocates when cloning
 * (about a third of the time to create 20,000 occurrence handles).
 */
function cloneTree<T extends THREE.Object3D>(source: T): T {
  let copy: THREE.Object3D;
  const mesh = source as unknown as THREE.Mesh;
  const lines = source as unknown as THREE.LineSegments & {
    isConditionalLine?: boolean;
  };
  if (
    mesh.isMesh &&
    !(source as unknown as THREE.InstancedMesh).isInstancedMesh &&
    !(source as unknown as THREE.SkinnedMesh).isSkinnedMesh
  )
    copy = new THREE.Mesh(mesh.geometry, mesh.material).copy(mesh, false);
  else if (lines.isLineSegments) {
    copy = new THREE.LineSegments(lines.geometry, lines.material).copy(
      lines,
      false,
    );
    if (lines.isConditionalLine)
      (copy as typeof lines).isConditionalLine = true;
  } else if ((source as unknown as THREE.Group).isGroup)
    copy = new THREE.Group().copy(source, false);
  else copy = source.clone(false);
  for (const child of source.children) copy.add(cloneTree(child));
  return copy as T;
}
const triangleCounts = new WeakMap<THREE.Object3D, number>();
/** Surface triangles one occurrence of this prototype draws (memoized). */
function prototypeTriangleCount(prototype: THREE.Object3D) {
  let count = triangleCounts.get(prototype);
  if (count === undefined) {
    count = 0;
    prototype.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const geometry = mesh.geometry;
      count! += Math.floor(
        (geometry.index?.count ??
          geometry.getAttribute("position")?.count ??
          0) / 3,
      );
    });
    triangleCounts.set(prototype, count);
  }
  return count;
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
  /** Pinned official definitions by canonical name, each as a `0 FILE` block. */
  private libraryBlocks = new Map<string, string>();
  private colorText = "";
  private rawCompiler?: RawPrimitiveCompiler;
  private updateEpoch = 0;
  /** Off-main-thread part compiler (workers + persistent cache), on demand. */
  private compiler?: PartCompiler;
  /** Paces main-thread compile work: see onMain(). */
  private mainSlicer = new TimeSlicer(LOAD_SLICE_MS);
  private mainQueue: Promise<unknown> = Promise.resolve();
  /** Model loading progress for the HUD; null when no load is in progress. */
  onProgress?: (progress: LoadProgress | null) => void;
  private knownColors = new Set<string>();
  private resolvedCache = new Map<string, THREE.Group>();
  /** The last project passed to update(), rendered or refused. */
  private requested?: Project;
  private reducedNotice = false;
  private renderUsage?: {
    profile: ResourceProfileName;
    partOccurrences: number;
    rawOccurrences: number;
    variants: number;
    prototypeTriangles: number;
    sceneTriangles: number;
  };
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
  /** `?batchCells=<LDU>` splits large buckets into spatial cells (a
   * diagnostic for measuring culling granularity; off by default). */
  private batches = new RenderBatches({
    cellSize: Math.max(
      0,
      Number(new URLSearchParams(location.search).get("batchCells")) || 0,
    ),
  });
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
  private hemisphereLight!: THREE.HemisphereLight;
  private fillLight!: THREE.DirectionalLight;
  private look = resolveLook("standard");
  private lookResourceProfile: ResourceProfileName = "desktop";
  private pipeline?: LookPipeline;
  private environmentMap?: THREE.Texture;
  private flakeSpecs?: Map<string, FlakeSpec>;
  /** Transparent plane that only shows shadows (and AO) under the model. */
  private shadowGround: THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial>;
  /** Index of the next accumulated sample of a still view (photo look). */
  private stillSample = 0;
  private refineRaf = 0;
  private lookStats = { passes: 1, samples: 0 };
  /** World-space model bounds (grown) that limit ambient occlusion. */
  private aoBox = new THREE.Box3();
  /** Path tracer for photo stills: loaded and created on first use, freed with
   * the look (see photo-tracer.ts). */
  private photo?: PhotoTracer;
  private photoModule?: Promise<typeof import("./photo-tracer")>;
  /** Restarted by every invalidate(); a pending refinement checks it. */
  private photoToken = 0;
  private photoTimer?: ReturnType<typeof setTimeout>;
  private photoRaf = 0;
  private photoLastFrame = 0;
  /** The view the tracer's accumulated samples belong to. */
  private photoViewKey = "";
  /** The last tapped model point: the photo look focuses there. */
  private photoFocusPoint: THREE.Vector3 | null = null;
  private photoReportKey = "";
  /** How the last photo still was (or is being) rendered. */
  private photoInfo: {
    renderer: "path" | "raster";
    reason: string | null;
    triangles: number;
    samples: number;
    buildMs: number;
  } = {
    renderer: "raster",
    reason: null,
    triangles: 0,
    samples: 0,
    buildMs: 0,
  };
  onPhotoProgress?: (progress: PhotoProgressReport | null) => void;
  /** Whether the next draw must re-render a cached shadow map. */
  private shadowDirty = true;
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
    this.hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xa4adb2, 3);
    this.scene.add(this.hemisphereLight);
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
    this.fillLight = fill;
    fill.position.set(-300, 150, -200);
    this.scene.add(fill);
    this.scene.add(sun.target);
    this.grid = new THREE.GridHelper(2000, 100, 0xaab6bd, 0xd1d9de);
    this.grid.position.y = -0.1;
    this.scene.add(this.grid);
    this.annotations.name = "architectural-annotations";
    this.scene.add(this.annotations);
    this.shadowGround = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShadowMaterial({ opacity: 0.3, depthWrite: true }),
    );
    this.shadowGround.name = "shadow ground";
    this.shadowGround.rotation.x = -Math.PI / 2;
    this.shadowGround.receiveShadow = true;
    this.shadowGround.visible = false;
    this.scene.add(this.shadowGround);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 50000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    // Orbiting moves only the camera, so a cached shadow map stays valid.
    this.controls.addEventListener("change", () => {
      // A programmatic camera jump (setCamera) is one still frame, not motion.
      if (!this.cameraJump) this.noteMotion();
      this.invalidate({ cameraOnly: true });
    });
    this.controls.addEventListener("start", () => {
      this.motionHeld = true;
    });
    this.controls.addEventListener("end", () => {
      this.motionHeld = false;
      if (this.moving) this.noteMotion();
    });
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
    cancelAnimationFrame(this.refineRaf);
    this.refineRaf = 0;
    this.stopPhoto();
    // The tracer's textures and targets do not survive a loss.
    this.photo?.dispose();
    this.photo = undefined;
    this.photoViewKey = "";
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
    // Render-target contents (the prefiltered environment) do not survive a loss.
    this.environmentMap?.dispose();
    this.environmentMap = undefined;
    if (this.look.environment === "room")
      this.scene.environment = this.ensureEnvironment();
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
    const manifest = JSON.parse(manifestText) as {
      files: { path: string; sha256: string; bytes: number }[];
      bundle: { path: string; sha256: string; bytes: number };
    };
    // One request: the bundle is every listed file's exact bytes in manifest
    // order, and its hash is pinned through the manifest hash checked above.
    const r = await fetch(base + manifest.bundle.path);
    ensure(r.ok, "REFERENCE_MISSING", "Library bundle unavailable");
    const bundle = new Uint8Array(await r.arrayBuffer());
    ensure(
      bundle.length === manifest.bundle.bytes &&
        bundle.length === manifest.files.reduce((sum, f) => sum + f.bytes, 0) &&
        (await sha256(bundle)) === manifest.bundle.sha256,
      "INVALID_INPUT",
      "Library bundle hash mismatch",
    );
    const decoder = new TextDecoder();
    let offset = 0;
    const sources = manifest.files.map((f) => {
      const text = decoder.decode(bundle.subarray(offset, offset + f.bytes));
      offset += f.bytes;
      return { path: f.path, text };
    });
    this.libraryBlocks = new Map(
      sources
        .filter((s) => s.path !== "LDConfig.ldr")
        .map((s) => {
          const name = s.path.replace(/^(parts|p)\//, "");
          return [name, "0 FILE " + name + "\n" + s.text];
        }),
    );
    this.colourLines = undefined;
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
  private colourLines?: Map<string, string>;
  /**
   * The LDConfig `!COLOUR` definitions a compile can use: codes referenced by
   * any type 1–5 line of its source, plus main (16) and edge (24). The loader
   * builds face, edge and conditional-line materials for every definition it
   * reads, so passing all ~320 colours to each part compile dominated the cost
   * of loading many part/colour variants. Undefined codes still fall back to
   * the loader's missing-colour material, exactly as before.
   */
  private colourDefinitions(source: string) {
    if (!this.colourLines) {
      this.colourLines = new Map();
      for (const l of this.colorText.split("\n")) {
        const code = /\sCODE\s+(\d+)/.exec(l)?.[1];
        if (code) this.colourLines.set(code, l);
      }
    }
    const used = new Set(["16", "24"]);
    for (const m of source.matchAll(/^\s*[1-5]\s+(\d+)\s/gm)) used.add(m[1]);
    const out: string[] = [];
    for (const code of used) {
      const l = this.colourLines.get(code);
      if (l) out.push(l);
    }
    return out.join("\n");
  }
  /**
   * Official definitions one compile can reach: every file referenced by the
   * source and its pinned transitive dependencies (bounds.json), minus names the
   * project defines itself. Parsing only this closure keeps a part compile
   * independent of the pack size; anything unresolved still fails loudly.
   */
  private libraryClosure(source: string, exclude: Set<string>) {
    const direct = installedBounds.dependencies.direct as Record<
      string,
      string[]
    >;
    const keep = new Map<string, string>();
    const visit = (name: string) => {
      if (keep.has(name) || exclude.has(name)) return;
      const curated = this.libraryBlocks.get(name);
      if (curated) {
        keep.set(name, curated);
        for (const dep of direct[name] ?? []) visit(dep);
        return;
      }
      // Complete official pack: definitions loaded on demand (full-library.ts).
      const text = fullSource(name);
      if (text === undefined) return;
      keep.set(name, "0 FILE " + name + "\n" + text);
      for (const dep of directReferences(text)) visit(dep);
    };
    for (const match of source.matchAll(
      /^\s*1\s+\S+(?:\s+\S+){12}\s+(.+?)\s*$/gm,
    )) {
      try {
        visit(canonical(match[1]));
      } catch {
        /* Unsafe names resolve nothing; the loader reports them. */
      }
    }
    return [...keep.values()].join("\n");
  }
  /**
   * Runs one unit of main-thread compile work (a loader parse, a rebuild from
   * a compiled record) after the previous one, ending the task first once the
   * slice budget is spent. Loader parses are chains of microtasks that never
   * yield on their own; without this, compiling many parts was one long task.
   */
  private onMain<T>(work: () => Promise<T> | T): Promise<T> {
    const run = this.mainQueue.then(async () => {
      if (this.mainSlicer.due) await this.mainSlicer.yield();
      return work();
    });
    this.mainQueue = run.catch(() => {});
    return run;
  }
  private partCompiler() {
    if (!this.compiler) {
      const cores =
        typeof navigator === "undefined"
          ? 2
          : navigator.hardwareConcurrency || 2;
      const workers =
        loadOption("compileWorkers") === "0"
          ? undefined
          : () =>
              new Worker(
                new URL("../workers/part-compile.worker.ts", import.meta.url),
                { type: "module" },
              );
      this.compiler = new PartCompiler({
        size: this.compileWorkerCount(cores),
        createWorker: workers,
        cache: sharedGeometryCache(),
      });
    }
    return this.compiler;
  }
  /** Leave a core for the page; phones get at most two workers. */
  private compileWorkerCount(cores = navigator.hardwareConcurrency || 2) {
    const requested = Number(loadOption("compileWorkers"));
    if (requested > 0) return Math.min(8, requested);
    return Math.max(
      1,
      Math.min(this.lookResourceProfile === "mobile" ? 2 : 4, cores - 2),
    );
  }
  /** Where compiled geometry came from (workers, persistent cache, main thread). */
  compileStats(): PartCompileStats & {
    cache?: GeometryCache["stats"] & { bytes: number; maxBytes: number };
  } {
    const cache = sharedGeometryCache();
    return {
      ...(this.compiler?.stats ?? {
        diskHits: 0,
        workerCompiles: 0,
        mainThread: 0,
        workerMs: 0,
        workers: 0,
      }),
      ...(cache
        ? {
            cache: {
              ...cache.stats,
              bytes: cache.bytes,
              maxBytes: cache.maxBytes,
            },
          }
        : {}),
    };
  }
  private async prototype(
    o: Occurrence,
    p: Project,
    renderContext = occurrenceRenderContext(p, o),
  ): Promise<THREE.Group> {
    const source =
      o.namespace === "project" && o.node.kind !== "geometry"
        ? dependencySource(p, o.node.ref)
        : "";
    const context = renderContext.source;
    const raw = o.node.kind === "geometry" ? occurrenceRawRecord(p, o) : "";
    const fingerprint = await compilationKey(
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
        const group = await this.onMain(() =>
          compiler.compile(raw, o.colorCode, renderContext),
        );
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
      // Official parts share one compiled geometry across colours (spec §13.2):
      // the part compiles once with a sentinel main colour, and each colour
      // variant is a clone that binds that colour's loader materials.
      const group =
        o.namespace === "official" && !renderContext.forceDoubleSided
          ? await this.colourVariant(o, context, fingerprint)
          : await this.onMain(() =>
              this.compilePart(
                o,
                p,
                source,
                context,
                o.colorCode,
                renderContext.forceDoubleSided,
              ),
            );
      this.allPrototypes.add(group);
      this.resolvedCache.set(key, group);
      return group;
    })();
    this.cache.set(key, promise);
    return promise;
  }
  /** The self-contained loader source that compiles one part (or project
   * submodel) reference in `colorCode`: colour definitions, render context,
   * the reference, project definitions and the official closure. */
  private partSource(
    o: Occurrence,
    p: Project | undefined,
    source: string,
    context: string,
    colorCode: string,
  ) {
    const ref =
      o.namespace === "project"
        ? p?.models[o.node.ref]?.name || o.node.ref
        : o.node.ref;
    const line = `1 ${colorCode} 0 0 0 1 0 0 0 1 0 0 0 1 ${ref}`;
    const projectSource = source.replace(/\n0 NOFILE\s*$/, "");
    const localNames = new Set(
      Object.values(p?.models ?? {}).map((m) => m.name.toLowerCase()),
    );
    const library = this.libraryClosure(
      context + "\n" + line + "\n" + projectSource,
      o.namespace === "project" ? localNames : new Set<string>(),
    );
    return normalizeBfcSource(
      "0 FILE __render__.ldr\n" +
        (colorCode === SHARED_MAIN_CODE ? SHARED_MAIN_COLOUR + "\n" : "") +
        this.colourDefinitions(
          context + "\n" + line + "\n" + projectSource + "\n" + library,
        ) +
        "\n" +
        context +
        "\n" +
        line +
        "\n" +
        projectSource +
        "\n" +
        library,
    );
  }
  /** Compile one part (or project submodel) reference in `colorCode` on the
   * main thread. Callers run it through onMain(). */
  private async compilePart(
    o: Occurrence,
    p: Project | undefined,
    source: string,
    context: string,
    colorCode: string,
    forceDoubleSided: boolean,
  ) {
    const { group, dependencyFailure } = await parseLDraw(
      this.partSource(o, p, source, context, colorCode),
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
    return this.finishPrototype(group, forceDoubleSided);
  }
  private finishPrototype(group: THREE.Group, forceDoubleSided: boolean) {
    group.traverse((object) => {
      // Loader metadata (file names, categories, building steps) is unused,
      // and Object3D.clone() JSON-copies user data for every object of every
      // occurrence handle.
      object.userData = {};
      if ((object as THREE.Mesh).isMesh) {
        if (forceDoubleSided) {
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
    return group;
  }
  /** Compiled once per official part and render context, in the sentinel colour. */
  private sharedBases = new Map<
    string,
    Promise<{ group: THREE.Group; main: MainMaterials }>
  >();
  /** Loader materials of one colour in one render context. */
  private palettes = new Map<string, Promise<MainMaterials>>();
  private resolvedBases = new Map<string, THREE.Group>();
  private resolvedPalettes = new Set<MainMaterials>();
  private async colourVariant(
    o: Occurrence,
    context: string,
    fingerprint: string,
  ) {
    const baseKey = JSON.stringify([o.node.ref, fingerprint]);
    let base = this.sharedBases.get(baseKey);
    if (!base) {
      base = this.compileBase(o, context, fingerprint).then((group) => {
        this.resolvedBases.set(baseKey, group);
        return { group, main: mainMaterials(group, SHARED_MAIN_CODE) };
      });
      this.sharedBases.set(baseKey, base);
      base.catch(() => this.sharedBases.delete(baseKey));
    }
    const [{ group: compiled, main }, colour] = await Promise.all([
      base,
      this.palette(o.colorCode, context, fingerprint),
    ]);
    const swap = new Map<THREE.Material, THREE.Material>();
    if (main.face && colour.face) swap.set(main.face, colour.face);
    if (main.edge && colour.edge) swap.set(main.edge, colour.edge);
    if (main.conditional && colour.conditional)
      swap.set(main.conditional, colour.conditional);
    return this.onMain(() => {
      const group = cloneTree(compiled);
      group.traverse((object) => {
        const drawable = object as THREE.Mesh;
        if (!drawable.material) return;
        drawable.material = Array.isArray(drawable.material)
          ? drawable.material.map((m) => swap.get(m) ?? m)
          : (swap.get(drawable.material) ?? drawable.material);
      });
      return group;
    });
  }
  /** Face, edge and conditional-line materials of `colorCode` in one render
   * context, shared by every prototype that draws that colour there. The
   * sentinel palette carries the shared-geometry main colour. */
  private palette(
    colorCode: string,
    context: string,
    fingerprint: string,
    sentinel = false,
  ) {
    const paletteKey = sentinel
      ? JSON.stringify(["sentinel", fingerprint])
      : JSON.stringify([colorCode, fingerprint]);
    let palette = this.palettes.get(paletteKey);
    if (!palette) {
      palette = this.onMain(() =>
        this.compilePalette(
          colorCode,
          context,
          sentinel ? SHARED_MAIN_COLOUR : "",
        ),
      ).then((m) => {
        this.resolvedPalettes.add(m);
        return m;
      });
      this.palettes.set(paletteKey, palette);
      palette.catch(() => this.palettes.delete(paletteKey));
    }
    return palette;
  }
  /**
   * The shared (sentinel-colour) geometry of an official part. Compile
   * workers build it off the main thread, or the persistent cache supplies
   * it; the main thread only wraps the record's buffers in Three objects with
   * the render context's shared palette materials. Falls back to a main-thread
   * compile when workers are unavailable or the part needs file-local colours.
   */
  private async compileBase(
    o: Occurrence,
    context: string,
    fingerprint: string,
  ): Promise<THREE.Group> {
    const key = geometryCacheKey({
      compiler: PART_COMPILER_VERSION,
      library: libraryLock.manifestSha256,
      fullLibrary: fullLibraryLock.manifestSha256,
      ref: o.node.ref,
      context: fingerprint + ":" + SHARED_MAIN_CODE,
    });
    const buffer = await this.partCompiler().compile(key, () =>
      this.partSource(o, undefined, "", context, SHARED_MAIN_CODE),
    );
    ensure(!this.disposed, "WEBGL_UNAVAILABLE", "The renderer was closed");
    if (!buffer)
      return this.onMain(() =>
        this.compilePart(o, undefined, "", context, SHARED_MAIN_CODE, false),
      );
    const { header } = unpackPart(buffer);
    const palettes = new Map<string, MainMaterials>();
    await Promise.all(
      header.codes.map(async (code) =>
        palettes.set(
          code,
          await (code === SHARED_MAIN_CODE
            ? this.palette(code, context, fingerprint, true)
            : this.palette(code, context, fingerprint)),
        ),
      ),
    );
    return this.onMain(() => {
      const group = rebuildPart(buffer, (slot) => {
        const material = palettes.get(slot.code)?.[slot.kind];
        ensure(
          material,
          "REFERENCE_MISSING",
          "Colour materials could not be built for colour " + slot.code,
        );
        return material;
      });
      ensure(
        group.children.length > 0,
        "REFERENCE_MISSING",
        "Part compilation produced no geometry: " + o.node.ref,
      );
      return this.finishPrototype(group, false);
    });
  }
  /** The face, edge and conditional-line materials the loader builds for
   * `colorCode` (a one-triangle swatch referenced in that colour), after any
   * extra colour `definitions`. */
  private async compilePalette(
    colorCode: string,
    context: string,
    definitions = "",
  ) {
    const loader = new LDrawLoader(new THREE.LoadingManager());
    loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
    loader.setMaterials([]);
    const line = `1 ${colorCode} 0 0 0 1 0 0 0 1 0 0 0 1 __swatch__.dat`;
    const text = [
      "0 FILE __palette__.ldr",
      ...(definitions ? [definitions] : []),
      this.colourDefinitions(context + "\n" + line),
      context,
      line,
      "0 FILE __swatch__.dat",
      "0 BFC CERTIFY CCW",
      "3 16 0 0 0 1 0 0 0 0 1",
      "2 24 0 0 0 1 0 0",
      "5 24 0 0 0 0 0 1 1 0 0 0 1 1",
    ].join("\n");
    loader.setFileMap({
      "__palette__.ldr": "__palette__.ldr",
      "__swatch__.dat": "__swatch__.dat",
    });
    const group = await new Promise<THREE.Group>((resolve, reject) =>
      (
        loader.parse as unknown as (
          text: string,
          resolve: (g: THREE.Group) => void,
          reject: (e: unknown) => void,
        ) => void
      )(text, resolve, reject),
    );
    const found = mainMaterials(group);
    ensure(
      !!found.face && !!found.edge && !!found.conditional,
      "REFERENCE_MISSING",
      "Colour materials could not be built for colour " + colorCode,
    );
    // Only the materials are kept; the swatch geometry is discarded.
    group.traverse((object) => (object as THREE.Mesh).geometry?.dispose());
    return found;
  }
  /** Dispose compiled prototypes no handle (or the ghost) uses, keeping the
   * newest few (the profile's retained count) so undo/redo and colour toggles
   * do not recompile. After a refusal, the refused model's own prototypes are
   * not retained. Colour variants share geometry and palette materials, so a
   * resource is disposed only once nothing retained still draws with it. */
  private evictPrototypes(refused?: ReadonlySet<THREE.Group>) {
    const inUse = new Set(
      [...this.handles.values()].map((g) => g.userData.prototype),
    );
    if (this.ghost.userData.prototype) inUse.add(this.ghost.userData.prototype);
    const budget = renderBudget(this.lookResourceProfile);
    const retain = budget.retainedUnusedPrototypes;
    let unused = 0;
    for (const proto of this.resolvedCache.values())
      if (!inUse.has(proto)) unused++;
    const evicted: THREE.Object3D[] = [];
    // Oldest first: Map iteration follows insertion order.
    for (const [key, proto] of this.resolvedCache) {
      if (unused <= retain && !refused?.size) break;
      if (inUse.has(proto)) continue;
      if (unused <= retain && !refused?.has(proto)) continue;
      unused--;
      evicted.push(proto);
      this.resolvedCache.delete(key);
      this.cache.delete(key);
      this.allPrototypes.delete(proto);
    }
    // Shared bases are bounded like variants; each variant keeps its own
    // references, so dropping a base never removes what is drawn.
    const bases = [...this.resolvedBases];
    for (const [key, group] of bases.slice(
      0,
      Math.max(0, bases.length - budget.variants),
    )) {
      this.resolvedBases.delete(key);
      this.sharedBases.delete(key);
      evicted.push(group);
    }
    if (!evicted.length) return;
    const live = new Set<unknown>();
    const collect = (group: THREE.Object3D) =>
      group.traverse((object) => {
        const drawable = object as THREE.Mesh;
        if (drawable.geometry) live.add(drawable.geometry);
        if (drawable.material)
          for (const m of Array.isArray(drawable.material)
            ? drawable.material
            : [drawable.material])
            live.add(m);
      });
    for (const proto of this.resolvedCache.values()) collect(proto);
    for (const base of this.resolvedBases.values()) collect(base);
    for (const colour of this.resolvedPalettes)
      for (const m of Object.values(colour)) live.add(m);
    for (const proto of evicted)
      proto.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry && !live.has(mesh.geometry)) mesh.geometry.dispose();
        if (mesh.material)
          for (const mat of Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material])
            if (!mat.userData.rawPrimitiveShared && !live.has(mat))
              mat.dispose();
      });
  }
  /** Interactive views of a very large scene on the phone profile draw without
   * conditional edges and at ≤ 1.5× pixel density; captures are unaffected. */
  private get reducedQuality() {
    return (
      !this.captureActive &&
      (this.renderUsage?.sceneTriangles ?? 0) >
        renderBudget(this.lookResourceProfile).reducedQualityTriangles
    );
  }
  /** Whether frames drawn while the view moves may leave out edges and (on
   * phones) pixel density: a large scene, and never during a capture. */
  private get motionReducible() {
    return (
      !this.captureActive &&
      (this.renderUsage?.sceneTriangles ?? 0) >
        renderBudget(this.lookResourceProfile).motionReductionTriangles
    );
  }
  /** Pointer held on the orbit controls (a drag in progress). */
  private motionHeld = false;
  private cameraJump = false;
  private moving = false;
  private motionTimer?: ReturnType<typeof setTimeout>;
  /** The last interactive frame was drawn reduced (edges/density). */
  private reducedFrame = false;
  /** Something moved the view: draw reduced until it has been still for
   * MOTION_IDLE_MS, then redraw once at full quality. */
  private noteMotion() {
    this.moving = true;
    clearTimeout(this.motionTimer);
    this.motionTimer = setTimeout(() => this.settleMotion(), MOTION_IDLE_MS);
  }
  private settleMotion() {
    this.motionTimer = undefined;
    // A drag in progress stays reduced even if it pauses; releasing it
    // restarts the idle timer.
    if (this.motionHeld) return;
    this.moving = false;
    if (this.reducedFrame) this.invalidate({ cameraOnly: true });
  }
  /** Vertices before/after indexing new prototypes, and the time it took. */
  private geometryIndexStats = { ms: 0, before: 0, after: 0 };
  private indexedPrototypes = new WeakSet<THREE.Object3D>();
  private indexPrototypes(prototypes: Iterable<THREE.Object3D>) {
    const start = performance.now();
    let before = 0,
      after = 0;
    for (const prototype of prototypes) {
      if (this.indexedPrototypes.has(prototype)) continue;
      this.indexedPrototypes.add(prototype);
      // Raw primitives are baked into merged batches; leave them as compiled.
      if (prototype.userData.rawPrimitive) continue;
      const result = indexPrototypeGeometry(prototype);
      before += result.before;
      after += result.after;
    }
    if (before)
      this.geometryIndexStats = {
        ms: Math.round(performance.now() - start),
        before,
        after,
      };
  }
  /** Measured size of the last rendered model against its profile budget. */
  renderBudgetStatus() {
    return {
      profile: this.lookResourceProfile,
      reducedQuality: this.reducedQuality,
      motion: {
        reducible: this.motionReducible,
        moving: this.moving,
        reducedFrame: this.reducedFrame,
      },
      budget: renderBudget(this.lookResourceProfile),
      usage: this.renderUsage,
      lastFrame: this.lastFrameStats,
      geometryIndex: { ...this.geometryIndexStats },
      batches: this.batches.stats(),
    };
  }
  /**
   * Render `p`. The renderer keeps its own snapshot; a caller that hands over
   * a project it will never mutate (a fresh copy from the editor) passes
   * `owned` to skip that deep copy — a few hundred ms for 20,000 parts.
   */
  update(p: Project, options: { owned?: boolean } = {}) {
    const snapshot = options.owned ? p : structuredClone(p);
    this.requested = snapshot;
    const epoch = ++this.updateEpoch;
    this.pending = this.pending
      .catch(() => {})
      .then(() => this.applyUpdate(snapshot, epoch))
      .catch((e) => {
        if (this.disposed || epoch !== this.updateEpoch) return;
        this.error = e;
        this.root.visible = false;
        this.invalidate();
        this.report(e instanceof Error ? e.message : String(e));
        throw e;
      })
      .finally(() => {
        if (epoch === this.updateEpoch) this.onProgress?.(null);
      });
    this.pending.catch(() => {});
    return this.pending;
  }
  /** Fit the camera to the next newly opened model as soon as its first
   * parts are drawn (the UI still fits the complete model once it is ready,
   * and withdraws the request with `false` when the open ends). */
  requestFitOnFirstParts(on = true) {
    this.fitOnFirstParts = on;
  }
  private fitOnFirstParts = false;
  private cloneHandle(o: Occurrence, prototype: THREE.Group) {
    const group = cloneTree(prototype);
    group.userData = { occurrenceId: o.id, prototype };
    group.matrixAutoUpdate = false;
    return group;
  }
  /** Create (or reuse) the handle of one occurrence and place it. */
  private placeHandle(
    o: Occurrence,
    prototype: THREE.Group,
    prepared?: THREE.Group,
  ) {
    let group = this.handles.get(o.id);
    if (!group || group.userData.prototype !== prototype) {
      if (group) this.root.remove(group);
      group = prepared ?? this.cloneHandle(o, prototype);
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
    const lift = this.explodeLift.get(o.id);
    if (lift) group.matrix.elements[13] -= lift;
    group.visible =
      (this.instructionVisibility
        ? this.instructionVisibility.has(o.id)
        : o.visible) && !this.floorHidden.has(o.id);
    group.updateMatrixWorld(true);
  }
  /**
   * Compile and draw one project snapshot. Work is split into tasks of about
   * LOAD_SLICE_MS (see onMain) and official part geometry compiles in workers,
   * so input and frames keep flowing while a large model loads. A newly
   * opened model is drawn progressively as its parts compile (most used part
   * variants first); edits of the open model swap in all at once.
   */
  private async applyUpdate(snapshot: Project, epoch: number) {
    await this.load;
    ensure(
      snapshot.library.manifestSha256 === libraryLock.manifestSha256,
      "REFERENCE_MISSING",
      "Pinned library is unavailable",
    );
    // Official parts outside the curated pack: fetch (or read from the
    // offline cache) and verify their definitions before compiling.
    const fullLibraryProblem = await prepareFullLibrary(snapshot);
    if (fullLibraryProblem) this.report(fullLibraryProblem);
    const current = () => !this.disposed && epoch === this.updateEpoch;
    if (!current()) return;
    const started = performance.now();
    const slicer = this.mainSlicer;
    slicer.reset();
    const yieldsBefore = slicer.yields;
    /** Ends the task when its budget is spent; false once superseded. */
    const pace = async () => {
      if (slicer.due) await slicer.yield();
      return current();
    };
    const all = occurrences(snapshot),
      keep = new Set(all.map((o) => o.id));
    const physical = all.filter((o) => o.node.kind !== "geometry");
    const profile = this.lookResourceProfile;
    checkRenderBudget(profile, {
      partOccurrences: physical.length,
      rawOccurrences: all.length - physical.length,
    });
    // Each occurrence's render context, once (it also keys its prototype).
    const contexts = new Array<ReturnType<typeof occurrenceRenderContext>>(
      all.length,
    );
    /** Occurrence indices of each distinct part/colour variant. */
    const variants = new Map<string, number[]>();
    const rawIndices: number[] = [];
    for (let i = 0; i < all.length; i++) {
      const o = all[i];
      const context = (contexts[i] = occurrenceRenderContext(snapshot, o));
      if (o.node.kind === "geometry") rawIndices.push(i);
      else {
        const key = JSON.stringify([
          o.namespace,
          o.node.ref,
          o.colorCode,
          context,
        ]);
        const list = variants.get(key);
        if (list) list.push(i);
        else variants.set(key, [i]);
      }
      if ((i & 255) === 255 && !(await pace())) return;
    }
    checkRenderBudget(profile, { variants: variants.size });
    let sourceBytes = 0;
    const encoder = new TextEncoder();
    const seenContexts = new Set<string>();
    for (let i = 0; i < all.length; i++) {
      const context = contexts[i].source;
      if (!seenContexts.has(context)) {
        seenContexts.add(context);
        sourceBytes += encoder.encode(context).length;
      }
      if (all[i].node.kind === "geometry")
        sourceBytes += encoder.encode(
          occurrenceRawRecord(snapshot, all[i]),
        ).length;
      ensure(
        sourceBytes <= 50 * 1024 * 1024,
        "LIMIT_EXCEEDED",
        "Geometry compilation exceeds its bounded source/context budget.",
      );
      if ((i & 255) === 255 && !(await pace())) return;
    }
    for (const [first] of variants.values()) {
      const o = all[first];
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
    // Request every distinct prototype once, most used variants first, so the
    // compile workers finish what shows the most parts soonest.
    const loaded = new Array<
      { o: Occurrence; prototype: THREE.Group } | undefined
    >(all.length);
    const progress: LoadProgress = {
      done: 0,
      total: variants.size + rawIndices.length,
    };
    /** Loaded occurrences not yet drawn progressively. */
    const arrived: number[] = [];
    const waits: Promise<void>[] = [];
    const request = (indices: number[]) => {
      const first = indices[0];
      waits.push(
        this.prototype(all[first], snapshot, contexts[first]).then(
          (prototype) => {
            for (const i of indices) loaded[i] = { o: all[i], prototype };
            arrived.push(...indices);
            progress.done++;
          },
        ),
      );
    };
    const order = [...variants.values()].sort((a, b) => b.length - a.length);
    for (let v = 0; v < order.length; v++) {
      request(order[v]);
      if ((v & 31) === 31 && !(await pace())) return;
    }
    for (let r = 0; r < rawIndices.length; r++) {
      request([rawIndices[r]]);
      if ((r & 31) === 31 && !(await pace())) return;
    }
    const everything = Promise.all(waits);
    let finished = false;
    everything.then(
      () => (finished = true),
      () => (finished = true),
    );
    // A newly opened model is drawn as its parts arrive; the open model's
    // edits keep showing the previous state until everything is ready.
    const fresh =
      !this.handles.size || !this.project || this.project.id !== snapshot.id;
    const budget = renderBudget(profile);
    const shown: number[] = [];
    let progressive = fresh && loadOption("progressive") !== "0",
      shownTriangles = 0,
      shownPrototypeTriangles = 0,
      lastFlush = 0,
      flushCost = 0,
      flushFrame = 0,
      lastReport = 0;
    const shownPrototypes = new Set<THREE.Group>();
    // A fence left by an earlier load (or a lost context) says nothing now.
    if (this.gpuFence && !this.lost)
      (this.renderer.getContext() as WebGL2RenderingContext).deleteSync(
        this.gpuFence,
      );
    this.gpuFence = undefined;
    while (!finished) {
      await Promise.race([
        everything.catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 100)),
      ]);
      if (!current()) return;
      if (finished) break;
      const now = performance.now();
      if (now - started > 250 && now - lastReport > 200) {
        lastReport = now;
        this.onProgress?.({ ...progress });
      }
      // Draw what has compiled: first after a short delay (a fast load swaps
      // in at once), then when the drawn set would at least double (else
      // after a second), never so often that redrawing partial scenes
      // (placement, batching, the frame) costs more than a fifth of the load,
      // and only once the GPU has finished the previous partial frame.
      if (shown.length && !this.gpuFence && this.frameStats.frames > flushFrame)
        this.gpuFence = this.markGpu();
      if (
        !progressive ||
        !arrived.length ||
        now - started < 150 ||
        !this.gpuCaughtUp() ||
        (shown.length &&
          now - lastFlush <
            Math.max(
              4 * (flushCost + this.frameStats.cpuMs),
              arrived.length >= shown.length ? 250 : 1000,
            ))
      )
        continue;
      const flushStart = performance.now();
      if (!shown.length) {
        // First parts of a newly opened model: take the previous one down.
        this.instructionDimming.restore();
        this.layerGhost.restore();
        for (const [id, g] of this.handles)
          if (!keep.has(id)) {
            this.root.remove(g);
            this.handles.delete(id);
          }
        const exploded = this.explodeGap
          ? explodeLifts(snapshot, this.explodeGap)
          : { lifts: new Map<string, number>(), levels: [] };
        this.explodeLift = exploded.lifts;
        this.explodeLevels = exploded.levels;
        this.computeFloorFocus(snapshot);
        this.select([]);
        this.root.visible = true;
      }
      const batch = arrived.splice(0);
      // Index new prototypes' triangles before any handle clones or draws
      // them (records from the compile workers arrive indexed already).
      this.indexPrototypes(batch.map((i) => loaded[i]!.prototype));
      for (let n = 0; n < batch.length; n++) {
        const { o, prototype } = loaded[batch[n]]!;
        // Never draw more than the profile's budgets allow while loading: a
        // model that turns out over budget is refused (and hidden) at the end.
        const triangles = prototypeTriangleCount(prototype);
        const unique = shownPrototypes.has(prototype) ? 0 : triangles;
        if (
          shownTriangles + triangles > budget.sceneTriangles ||
          shownPrototypeTriangles + unique > budget.prototypeTriangles
        ) {
          progressive = false;
          break;
        }
        shownTriangles += triangles;
        shownPrototypeTriangles += unique;
        shownPrototypes.add(prototype);
        this.placeHandle(o, prototype);
        shown.push(batch[n]);
        if ((n & 63) === 63 && !(await pace())) return;
      }
      this.batches.rebuild(this.handles);
      this.tuneMaterials();
      this.applyQuality(this.qualityProfile, true);
      if (this.fitOnFirstParts) {
        this.fitOnFirstParts = false;
        this.fit();
      }
      this.invalidate();
      lastFlush = performance.now();
      flushCost = lastFlush - flushStart;
      flushFrame = this.frameStats.frames;
    }
    await everything;
    if (!current()) return;
    // Geometry budgets need compiled prototypes; refuse before touching the
    // scene so an over-budget model is never drawn (beyond budget-checked
    // parts shown while loading, which a refusal takes down again).
    let sceneTriangles = 0,
      prototypeTriangles = 0;
    const counted = new Set<THREE.Group>();
    const geometries = new Set<THREE.BufferGeometry>();
    for (let i = 0; i < loaded.length; i++) {
      const { prototype } = loaded[i]!;
      sceneTriangles += prototypeTriangleCount(prototype);
      if (counted.has(prototype)) continue;
      counted.add(prototype);
      // Colour variants share geometry: count each geometry once.
      prototype.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh || geometries.has(mesh.geometry)) return;
        geometries.add(mesh.geometry);
        prototypeTriangles += Math.floor(
          (mesh.geometry.index?.count ??
            mesh.geometry.getAttribute("position")?.count ??
            0) / 3,
        );
      });
    }
    const usage = {
      partOccurrences: physical.length,
      rawOccurrences: all.length - physical.length,
      variants: variants.size,
      prototypeTriangles,
      sceneTriangles,
    };
    try {
      checkRenderBudget(profile, usage);
    } catch (e) {
      for (const i of shown) {
        const id = all[i].id;
        const g = this.handles.get(id);
        if (g) this.root.remove(g);
        this.handles.delete(id);
      }
      if (shown.length) this.batches.rebuild(this.handles);
      this.evictPrototypes(counted);
      throw e;
    }
    // Render-side post-process (frame cost, not compilation): index each
    // new prototype's triangles once, before any handle clones it.
    this.indexPrototypes(loaded.map((entry) => entry!.prototype));
    // Clone new handles ahead of the swap (the costly part, paced); the swap
    // below then only places them.
    const prepared = new Map<string, THREE.Group>();
    if (!fresh)
      for (let i = 0; i < loaded.length; i++) {
        const { o, prototype } = loaded[i]!;
        const g = this.handles.get(o.id);
        if (!g || g.userData.prototype !== prototype)
          prepared.set(o.id, this.cloneHandle(o, prototype));
        if ((i & 63) === 63 && !(await pace())) return;
      }
    this.renderUsage = { profile, ...usage };
    if (this.reducedQuality && !this.reducedNotice)
      this.report(
        "Large model on a phone: conditional edge lines are hidden and pixel density is reduced while viewing. Every part is drawn; captures keep full quality.",
      );
    this.reducedNotice = this.reducedQuality;
    this.instructionDimming.restore();
    this.layerGhost.restore();
    for (const [id, g] of this.handles)
      if (!keep.has(id)) {
        this.root.remove(g);
        this.handles.delete(id);
      }
    const exploded = this.explodeGap
      ? explodeLifts(snapshot, this.explodeGap)
      : { lifts: new Map<string, number>(), levels: [] };
    this.explodeLift = exploded.lifts;
    this.explodeLevels = exploded.levels;
    this.computeFloorFocus(snapshot);
    for (let i = 0; i < loaded.length; i++) {
      const { o, prototype } = loaded[i]!;
      this.placeHandle(o, prototype, prepared.get(o.id));
      // A newly opened model is already on screen part by part; an edit
      // swaps in within one task.
      if (fresh && (i & 63) === 63 && !(await pace())) return;
    }
    this.evictPrototypes();
    // The handle set and prototypes changed: reclassify the batches once.
    // Later view changes (quality, look, treatments, steps) only refill them.
    this.batches.rebuild(this.handles);
    this.project = snapshot;
    this.tuneMaterials();
    this.applyLayerGhost();
    this.rebuildAnnotations();
    this.applyQuality(this.qualityProfile, true);
    this.fitLookToModel();
    if (this.fitOnFirstParts) {
      this.fitOnFirstParts = false;
      this.fit();
    }
    this.root.visible = true;
    this.revision = snapshot.revision;
    this.error = undefined;
    this.select([]);
    this.invalidate();
    this.lastLoad = {
      ms: Math.round(performance.now() - started),
      variants: variants.size,
      progressive: shown.length > 0,
      tasks: slicer.yields - yieldsBefore,
    };
  }
  /** A fence behind the last progressive frame's GPU commands. */
  private gpuFence?: WebGLSync | null;
  private markGpu() {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const fence = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) ?? null;
    gl.flush();
    return fence;
  }
  /**
   * Whether the GPU has finished the last progressive frame, without waiting
   * for it. Software rasterizers can fall seconds behind; the next partial
   * frame's first synchronous call (a shader link) would then block the
   * page until they caught up.
   */
  private gpuCaughtUp() {
    const fence = this.gpuFence;
    if (!fence) return true;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (
      !this.lost &&
      gl.getSyncParameter(fence, gl.SYNC_STATUS) !== gl.SIGNALED
    )
      return false;
    gl.deleteSync(fence);
    this.gpuFence = undefined;
    return true;
  }
  /** Timing of the last completed update (diagnostics). */
  lastLoad?: {
    ms: number;
    variants: number;
    progressive: boolean;
    tasks: number;
  };
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
  currentLook() {
    return structuredClone(this.look);
  }
  /** Diagnostics for the last interactive frame: full-screen passes and still samples. */
  get lookFrameStats() {
    return { ...this.lookStats };
  }
  setLook(name: LookName, controls: Partial<LookControls> = {}) {
    ensure(
      !this.captureActive,
      "INVALID_INPUT",
      "Wait for capture before changing the render look",
    );
    this.applyLook(resolveLook(name, controls, this.lookResourceProfile));
    return this.currentLook();
  }
  /** Phones degrade look defaults (see resolveLook); re-resolves the current look. */
  setLookResourceProfile(profile: ResourceProfileName) {
    if (profile === this.lookResourceProfile) return;
    this.lookResourceProfile = profile;
    // The photo tracer's schedule (tiles, bounces) follows the profile.
    if (!this.captureActive) this.releasePhoto(true);
    this.compiler?.setSize(this.compileWorkerCount());
    void sharedGeometryCache()?.setMaxBytes(GEOMETRY_CACHE_BYTES[profile]);
    // Renderer budgets follow the profile: re-assess the current model, so a
    // stricter profile refuses it (nothing drawn) and a looser one draws it.
    if (this.requested) this.update(this.requested).catch(() => {});
    if (this.captureActive) return;
    this.applyLook(resolveLook(this.look.name, {}, profile));
  }
  private applyLook(look: RenderLook, refreshTreatments = true) {
    if (JSON.stringify(look) === JSON.stringify(this.look)) return;
    this.look = structuredClone(look);
    const ibl = look.environment === "room";
    this.scene.environment = ibl ? this.ensureEnvironment() : null;
    // Image-based light replaces most of the flat hemisphere fill.
    this.scene.environmentIntensity = LOOK_LIGHTING.environment;
    this.hemisphereLight.intensity = ibl ? LOOK_LIGHTING.hemisphere : 3;
    this.keyLight.intensity = ibl ? LOOK_LIGHTING.key : 3;
    this.fillLight.intensity = ibl ? LOOK_LIGHTING.fill : 1.5;
    this.shadowGround.visible = look.ground === "shadow";
    const gridMaterial = this.grid.material as THREE.LineBasicMaterial;
    gridMaterial.transparent = look.ground === "shadow";
    gridMaterial.opacity = look.ground === "shadow" ? 0.45 : 1;
    gridMaterial.needsUpdate = true;
    this.tuneMaterials();
    // Ghost/dimming clones copy material parameters when they are applied.
    if (refreshTreatments) this.applyLayerGhost();
    this.fitLookToModel();
    this.applyQuality(this.qualityProfile, true);
    if (!ibl) this.environmentMap = disposeTexture(this.environmentMap);
    if (!lookUsesPipeline(look)) {
      this.pipeline?.dispose();
      this.pipeline = undefined;
    }
    // A capture switches looks temporarily; keep the tracer until it ends.
    if (look.renderer !== "path" && !this.captureActive) this.releasePhoto();
    this.invalidate();
  }
  private ensureEnvironment() {
    if (!this.environmentMap) {
      const generator = new THREE.PMREMGenerator(this.renderer);
      const room = new RoomEnvironment();
      this.environmentMap = generator.fromScene(room, 0.04).texture;
      room.dispose();
      generator.dispose();
    }
    return this.environmentMap;
  }
  /** Tune (or restore) LDrawLoader finish materials in place. In-place tuning keeps
   * batching keys, prototype sharing and ghost/dimming treatments unchanged. */
  private tuneMaterials() {
    const plastic = this.look.materials === "plastic";
    const flakes = this.colorText
      ? (this.flakeSpecs ??= parseFlakeMaterials(this.colorText))
      : new Map<string, FlakeSpec>();
    const seen = new Set<THREE.Material>();
    for (const group of this.allPrototypes)
      group.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        for (const material of Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material]) {
          if (seen.has(material)) continue;
          seen.add(material);
          const standard = material as THREE.MeshStandardMaterial;
          if (!standard.isMeshStandardMaterial) continue;
          const base = (standard.userData.lookBase ??= {
            roughness: standard.roughness,
            metalness: standard.metalness,
            envMapIntensity: standard.envMapIntensity,
          }) as {
            roughness: number;
            metalness: number;
            envMapIntensity: number;
          };
          const flaked = !!standard.userData.lookFlake;
          if (!plastic) {
            standard.roughness = base.roughness;
            standard.metalness = base.metalness;
            standard.envMapIntensity = base.envMapIntensity;
            if (flaked) removeFlakes(standard);
            continue;
          }
          const finish = classifyFinish({
            name: standard.name,
            roughness: base.roughness,
            metalness: base.metalness,
            transparent: standard.transparent,
            emissive: standard.emissive,
          });
          const parameters = FINISH_PARAMETERS[finish];
          standard.roughness = parameters.roughness;
          standard.metalness = parameters.metalness;
          standard.envMapIntensity = parameters.envMapIntensity;
          const flake = flakes.get(standard.name.toLowerCase());
          if (flake && !flaked) applyFlakes(standard, flake);
        }
      });
  }
  /** Fit the key light's shadow camera and the shadow ground to the model. The
   * standard look keeps its original fixed ±1500 LDU shadow frustum. */
  private fitLookToModel() {
    const sun = this.keyLight;
    const camera = sun.shadow.camera;
    if (this.look.shadows !== "soft" && this.look.ground !== "shadow") {
      sun.position.set(250, 600, 300);
      sun.target.position.set(0, 0, 0);
      sun.shadow.normalBias = 0.2;
      camera.near = 0.5;
      camera.far = 5000;
      camera.left = camera.bottom = -1500;
      camera.right = camera.top = 1500;
    } else {
      const box = new THREE.Box3();
      this.root.updateMatrixWorld(true);
      for (const group of this.handles.values()) box.expandByObject(group);
      if (box.isEmpty())
        box.set(new THREE.Vector3(-80, 0, -80), new THREE.Vector3(80, 48, 80));
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const radius = Math.max(sphere.radius, 40);
      const direction = new THREE.Vector3(250, 600, 300).normalize();
      sun.target.position.copy(sphere.center);
      sun.position.copy(sphere.center).addScaledVector(direction, radius * 3);
      camera.left = camera.bottom = -radius * 1.1;
      camera.right = camera.top = radius * 1.1;
      camera.near = radius * 1.5;
      camera.far = radius * 4.5;
      sun.shadow.normalBias = 0.2;
      this.shadowGround.position.set(
        sphere.center.x,
        box.min.y - 0.05,
        sphere.center.z,
      );
      this.shadowGround.scale.setScalar(radius * 16);
      this.aoBox.copy(box).expandByScalar(radius * 0.12);
    }
    camera.updateProjectionMatrix();
    sun.target.updateMatrixWorld();
  }
  private applyQuality(profile: RenderProfile, force = false) {
    if (
      !force &&
      JSON.stringify(profile) === JSON.stringify(this.qualityProfile)
    )
      return;
    this.qualityProfile = structuredClone(profile);
    this.applyPixelRatio();
    const toneMapping =
      this.look.toneMapping === "quality"
        ? profile.toneMapping
        : this.look.toneMapping;
    this.renderer.toneMapping =
      toneMapping === "aces"
        ? THREE.ACESFilmicToneMapping
        : toneMapping === "agx"
          ? THREE.AgXToneMapping
          : THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure =
      profile.exposure * this.look.exposureScale;
    // A look may raise shadows and hide edges; it never changes the stored profile.
    const shadows = this.look.shadows === "soft" ? "soft" : profile.shadows;
    const shadowMapSize =
      this.look.shadows === "soft"
        ? Math.max(
            profile.shadowMapSize,
            this.look.resourceProfile === "mobile" ? 1024 : 2048,
          )
        : profile.shadowMapSize;
    let edges = this.look.edges === "hidden" ? "none" : profile.edges;
    // Very large scenes on phones: conditional lines cost four projections per
    // vertex and are about half of all edge segments. Captures keep them.
    if (edges === "all" && this.reducedQuality) edges = "ordinary";
    this.renderer.shadowMap.enabled = shadows === "soft";
    // Phones filter forced look shadows with plain PCF (fewer taps per pixel).
    this.renderer.shadowMap.type =
      this.look.shadows === "soft" && this.look.resourceProfile === "mobile"
        ? THREE.PCFShadowMap
        : THREE.PCFSoftShadowMap;
    this.keyLight.castShadow = shadows === "soft";
    if (this.keyLight.shadow.mapSize.x !== shadowMapSize) {
      this.keyLight.shadow.map?.dispose();
      this.keyLight.shadow.map = null;
      this.keyLight.shadow.mapSize.setScalar(shadowMapSize);
    }
    for (const handle of this.handles.values())
      handle.traverse((object) => {
        if (!(object as THREE.LineSegments).isLineSegments) return;
        const conditional = !!(
          object as THREE.LineSegments
        ).geometry.getAttribute("control0");
        object.visible =
          edges === "all" || (edges === "ordinary" && !conditional);
      });
    this.batches.refresh();
  }
  /** Continuous Play frames cap the backing store; phones report DPR 3. A
   * large scene on a phone drops further while its view moves. */
  private applyPixelRatio(reduceMotion = this.reducedFrame) {
    const ratio = Math.min(
      devicePixelRatio,
      this.qualityProfile.pixelRatioCap,
      this.playViewActive || this.reducedQuality
        ? PLAY_PIXEL_RATIO_CAP
        : Infinity,
      reduceMotion && this.lookResourceProfile === "mobile"
        ? MOTION_PIXEL_RATIO_CAP
        : Infinity,
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
  /** Draw the scene into the current render target (the canvas when none). */
  private drawDirect() {
    // Shadows (a look's forced shadows or the photo quality profile) re-render
    // the shadow map only after a scene change, not for every orbit or Play
    // camera frame (the shadow pass doubles the draw calls).
    const shadowMap = this.renderer.shadowMap;
    shadowMap.autoUpdate = false;
    if (
      shadowMap.enabled &&
      this.keyLight.castShadow &&
      (this.shadowDirty || !this.keyLight.shadow.map)
    ) {
      shadowMap.needsUpdate = true;
      this.shadowPasses++;
    }
    this.shadowDirty = false;
    if (this.batchingEnabled)
      this.batches.render(this.renderer, this.scene, this.camera);
    else {
      this.batches.root.visible = false;
      this.renderer.render(this.scene, this.camera);
    }
  }
  /** The look as drawn right now: continuous Play frames never accumulate, and
   * phones also drop AO while playing. */
  private interactiveLook(): LookControls {
    if (!this.playViewActive) return this.look;
    return {
      ...this.look,
      samples: 1,
      renderer: "raster",
      ambientOcclusion:
        this.look.resourceProfile === "mobile"
          ? "off"
          : this.look.ambientOcclusion,
    };
  }
  /** Last interactive frame: main-thread submission time and draw statistics. */
  /** Shadow-map renders requested so far (diagnostics: camera-only frames
   * reuse the cached map). */
  private shadowPasses = 0;
  private frameStats = {
    frames: 0,
    cpuMs: 0,
    calls: 0,
    triangles: 0,
    lines: 0,
    shadowPasses: 0,
  };
  get lastFrameStats() {
    return { ...this.frameStats };
  }
  private drawScene() {
    // Adaptive quality while the view moves: edges (ordinary and conditional)
    // are left out by toggling their batch objects, and phones lower the
    // pixel density; the next still frame restores both. Captures never pass
    // through here.
    const reduce = this.moving && this.motionReducible;
    this.reducedFrame = reduce;
    this.batches.setLinesSuppressed(reduce);
    this.applyPixelRatio(reduce);
    const info = this.renderer.info;
    info.autoReset = false;
    info.reset();
    const start = performance.now();
    try {
      this.drawSceneFrame();
    } finally {
      this.frameStats = {
        frames: this.frameStats.frames + 1,
        cpuMs: performance.now() - start,
        calls: info.render.calls,
        triangles: info.render.triangles,
        lines: info.render.lines,
        shadowPasses: this.shadowPasses,
      };
      info.autoReset = true;
    }
  }
  private drawSceneFrame() {
    const look = this.interactiveLook();
    if (!lookUsesPipeline(look)) {
      this.lookStats = { passes: 1, samples: 0 };
      this.drawDirect();
      return;
    }
    let note: string | null = null;
    if (look.renderer === "path") {
      const trace = this.photoTrace(look);
      if (trace.choice.renderer === "path") {
        this.drawPhotoFrame(look, trace);
        return;
      }
      note = trace.choice.reason;
      this.photoInfo = {
        renderer: "raster",
        reason: note,
        triangles: trace.triangles,
        samples: 0,
        buildMs: 0,
      };
    }
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const accumulate = look.samples > 1;
    const sample = accumulate ? this.stillSample : 0;
    this.drawLookFrame(look, null, size.x, size.y, sample, {
      aoScale: 0.5,
      msaa: this.look.resourceProfile === "mobile" ? 2 : 4,
    });
    this.lookStats = {
      passes: this.pipeline!.lastPasses,
      samples: accumulate ? sample + 1 : 0,
    };
    if (accumulate) {
      this.photoInfo.samples = sample + 1;
      this.reportPhoto({
        phase: sample + 1 < look.samples ? "refining" : "done",
        percent: photoProgress(sample + 1, look.samples),
        samples: sample + 1,
        target: look.samples,
        renderer: "raster",
        note,
      });
    } else if (look.renderer !== "path") this.reportPhoto(null);
    if (accumulate && sample + 1 < look.samples) {
      // Refine a still view one jittered sample per frame; any change restarts.
      this.refineRaf = requestAnimationFrame(() => {
        this.refineRaf = 0;
        if (this.lost || this.disposed || this.raf || this.captureActive)
          return;
        this.stillSample++;
        this.drawScene();
      });
    }
  }
  private reportPhoto(progress: PhotoProgressReport | null) {
    const key = progress
      ? `${progress.phase}:${progress.percent}:${progress.renderer}`
      : "";
    if (key === this.photoReportKey) return;
    this.photoReportKey = key;
    this.onPhotoProgress?.(progress && { ...progress });
  }
  /** Colour grade of the look (photo), for the pipeline's composite. */
  private lookGrade(look: LookControls) {
    return look.grade === "film" ? { contrast: 0.25, saturation: 1.15 } : null;
  }
  /** What a path-traced still of the current view would contain, and whether the
   * tracer takes it (see choosePhotoRenderer). */
  private photoTrace(look: LookControls) {
    this.root.updateMatrixWorld(true);
    const visible = [...this.handles.values()].filter((group) => group.visible);
    const { meshes, triangles } = traceMeshes(visible);
    const gl = this.renderer;
    const choice: PhotoRendererChoice = choosePhotoRenderer({
      look,
      support: {
        floatRenderTargets: gl.extensions.has("EXT_color_buffer_float"),
        maxTextureSize: gl.capabilities.maxTextureSize,
      },
      triangles,
      triangleBudget: renderBudget(this.lookResourceProfile).photoTriangles,
      profile: this.lookResourceProfile,
      sectionCut: this.renderer.clippingPlanes.length > 0,
      play: this.playViewActive,
    });
    const bounds = new THREE.Box3();
    for (const mesh of meshes) bounds.expandByObject(mesh, false);
    // A scene environment (ground, props) composes with Photo by flagging its
    // objects `userData.photoStage`: they are traced instead of the studio sweep.
    const staged = traceMeshes(
      this.scene.children.filter((child) => child.userData.photoStage),
    ).meshes;
    for (const mesh of staged)
      for (const material of Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material])
        material.userData.photoStage = true;
    const backdrop: "studio" | "floor" | "scene" = staged.length
      ? "scene"
      : look.backdrop === "floor"
        ? "floor"
        : "studio";
    const key =
      traceSignature([...meshes, ...staged]) +
      "|" +
      backdrop +
      "|" +
      bounds.min
        .toArray()
        .concat(bounds.max.toArray())
        .map((v) => Math.round(v * 16))
        .join(",");
    return {
      meshes: [...meshes, ...staged],
      triangles,
      choice,
      key,
      bounds,
      backdrop,
    };
  }
  private traceSources(meshes: readonly THREE.Mesh[]): TraceSource[] {
    return meshes.map((mesh) => ({
      mesh,
      geometry: mesh.geometry,
      matrix: mesh.matrixWorld.clone(),
      materials: Array.isArray(mesh.material) ? mesh.material : [mesh.material],
    }));
  }
  /** Focus distance for depth of field: the last tapped point, else the centre
   * of the visible model (its bounds), else the orbit target. */
  private photoFocusDistance(bounds: THREE.Box3) {
    const camera = this.camera;
    camera.updateMatrixWorld();
    const origin = camera.getWorldPosition(new THREE.Vector3());
    const forward = camera.getWorldDirection(new THREE.Vector3());
    if (this.photoFocusPoint) {
      const distance = this.photoFocusPoint.clone().sub(origin).dot(forward);
      if (distance > camera.near) return distance;
    }
    if (!bounds.isEmpty()) {
      const distance = bounds
        .getCenter(new THREE.Vector3())
        .sub(origin)
        .dot(forward);
      if (distance > camera.near) return distance;
    }
    return Math.max(
      camera.near,
      this.controls.target.clone().sub(origin).dot(forward),
    );
  }
  private photoBackground(): THREE.Color | null {
    return this.scene.background instanceof THREE.Color
      ? this.scene.background
      : null;
  }
  private photoView(
    look: LookControls,
    width: number,
    height: number,
    bounds: THREE.Box3,
  ) {
    const camera = this.camera;
    const target = this.controls.target;
    const position = camera.getWorldPosition(new THREE.Vector3());
    return {
      camera,
      width,
      height,
      focusDistance: this.photoFocusDistance(bounds),
      depthOfField: look.depthOfField,
      azimuth: Math.atan2(position.x - target.x, position.z - target.z),
    };
  }
  private photoViewSignature(
    view: ReturnType<SceneAdapter["photoView"]>,
    key: string,
  ) {
    const round = (v: number) => Math.round(v * 1000) / 1000;
    return JSON.stringify([
      key,
      view.width,
      view.height,
      round(view.focusDistance),
      view.depthOfField,
      round(view.azimuth),
      view.camera.matrixWorld.elements.map(round),
      view.camera.projectionMatrix.elements.map(round),
      this.photoBackground()?.getHexString() ?? null,
    ]);
  }
  private loadPhotoTracer() {
    this.photoModule ??= import("./photo-tracer");
    return this.photoModule;
  }
  private async ensurePhoto() {
    const module = await this.loadPhotoTracer();
    this.photo ??= new module.PhotoTracer(
      this.renderer,
      PHOTO_SCHEDULE[this.lookResourceProfile],
    );
    return this.photo;
  }
  /** Stop refining a photo still (it resumes on the next still frame). */
  private stopPhoto() {
    this.photoToken++;
    clearTimeout(this.photoTimer);
    this.photoTimer = undefined;
    cancelAnimationFrame(this.photoRaf);
    this.photoRaf = 0;
    this.photoLastFrame = 0;
  }
  /** Free the tracer's BVH, textures and targets (look changed away from photo). */
  private releasePhoto(dispose = false) {
    this.stopPhoto();
    if (dispose) {
      this.photo?.dispose();
      this.photo = undefined;
    } else this.photo?.trim();
    this.photoViewKey = "";
    this.reportPhoto(null);
  }
  /**
   * An interactive photo frame. A still view that the tracer has already refined
   * is presented from its samples; otherwise a realistic raster frame is drawn
   * now and path tracing starts once the view has been still for PHOTO_IDLE_MS.
   */
  private drawPhotoFrame(
    look: LookControls,
    trace: ReturnType<SceneAdapter["photoTrace"]>,
  ) {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const photo = this.photo;
    const view = this.photoView(look, size.x, size.y, trace.bounds);
    const viewKey = this.photoViewSignature(view, trace.key);
    const schedule = PHOTO_SCHEDULE[this.lookResourceProfile];
    const current =
      !!photo &&
      photo.hasScene(trace.key) &&
      viewKey === this.photoViewKey &&
      !photo.compiling;
    if (current && photo.samples >= schedule.displaySamples) {
      this.presentPhoto(look);
      if (photo.samples < look.pathSamples) this.schedulePhoto(look, trace, 0);
      return;
    }
    this.drawLookFrame({ ...look, samples: 1 }, null, size.x, size.y, 0, {
      aoScale: 0.5,
      msaa: this.look.resourceProfile === "mobile" ? 2 : 4,
    });
    this.lookStats = { passes: this.pipeline!.lastPasses, samples: 0 };
    this.schedulePhoto(look, trace, current ? 0 : PHOTO_IDLE_MS);
  }
  private schedulePhoto(
    look: LookControls,
    trace: ReturnType<SceneAdapter["photoTrace"]>,
    delay: number,
  ) {
    const token = this.photoToken;
    clearTimeout(this.photoTimer);
    this.photoTimer = setTimeout(() => {
      this.photoTimer = undefined;
      void this.startPhoto(token, look, trace).catch((error) => {
        if (token !== this.photoToken) return;
        this.photoInfo.reason =
          "Path tracing failed (" +
          (error instanceof Error ? error.message : String(error)) +
          "); showing the realistic frame.";
        this.reportPhoto(null);
      });
    }, delay);
  }
  private photoCurrent(token: number) {
    return (
      token === this.photoToken &&
      !this.lost &&
      !this.disposed &&
      !this.captureActive &&
      !this.raf
    );
  }
  private async startPhoto(
    token: number,
    look: LookControls,
    trace: ReturnType<SceneAdapter["photoTrace"]>,
  ) {
    if (!this.photoCurrent(token)) return;
    // A drag in progress (finger or button held) is not a still view yet.
    if (this.motionHeld) {
      this.schedulePhoto(look, trace, PHOTO_IDLE_MS);
      return;
    }
    const target = look.pathSamples;
    const report = (phase: PhotoProgressReport["phase"], samples: number) =>
      this.reportPhoto({
        phase,
        percent: phase === "preparing" ? 0 : photoProgress(samples, target),
        samples,
        target,
        renderer: "path",
        note: null,
      });
    if (!this.photo?.hasScene(trace.key)) report("preparing", 0);
    const photo = await this.ensurePhoto();
    if (!this.photoCurrent(token)) return;
    if (!photo.hasScene(trace.key)) {
      const built = await photo.prepare(
        trace.key,
        () => this.traceSources(trace.meshes),
        { backdrop: trace.backdrop, bounds: trace.bounds },
      );
      if (!built || !this.photoCurrent(token)) return;
    }
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const view = this.photoView(look, size.x, size.y, trace.bounds);
    const viewKey = this.photoViewSignature(view, trace.key);
    const background = photo.setBackground(this.photoBackground());
    if (viewKey !== this.photoViewKey || background) {
      photo.setView(view);
      photo.reset();
      this.photoViewKey = viewKey;
    }
    this.photoInfo = {
      renderer: "path",
      reason: null,
      triangles: photo.triangles,
      samples: photo.samples,
      buildMs: photo.buildMs,
    };
    photo.compile();
    const frame = () => {
      this.photoRaf = 0;
      if (!this.photoCurrent(token)) return;
      if (photo.compiling) {
        report("preparing", 0);
        this.photoRaf = requestAnimationFrame(frame);
        return;
      }
      const now = performance.now();
      if (this.photoLastFrame)
        photo.tilesPerFrame = nextTilesPerFrame(
          photo.tilesPerFrame,
          now - this.photoLastFrame,
          photo.totalTiles,
        );
      this.photoLastFrame = now;
      photo.step(
        Math.min(
          photo.tilesPerFrame,
          Math.ceil((target - photo.samples) * photo.totalTiles),
        ),
      );
      photo.sync();
      const samples = Math.floor(photo.samples);
      this.photoInfo.samples = samples;
      if (photo.samples >= photo.schedule.displaySamples)
        this.presentPhoto(look);
      if (photo.samples >= target) {
        this.photoLastFrame = 0;
        report("done", samples);
        return;
      }
      report("refining", samples);
      this.photoRaf = requestAnimationFrame(frame);
    };
    this.photoRaf = requestAnimationFrame(frame);
  }
  /** Tone-map the traced still to the canvas, then draw the editing overlays
   * (selection, gizmos, measurements) over it. */
  private presentPhoto(look: LookControls) {
    const photo = this.photo!;
    const pipeline = (this.pipeline ??= new LookPipeline());
    const info = this.renderer.info;
    info.autoReset = false;
    pipeline.presentImage({
      renderer: this.renderer,
      texture: photo.texture,
      target: null,
      background: this.photoBackground(),
      vignette: look.vignette,
      grade: this.lookGrade(look),
      denoise: photoDenoise(photo.samples),
    });
    this.lookStats = { passes: 1, samples: Math.floor(photo.samples) };
    const scene = this.scene;
    const children = scene.children;
    const overlays = children.filter(
      (child) =>
        child !== this.root &&
        child !== this.grid &&
        child !== this.shadowGround &&
        child !== this.keyLight.target &&
        !(child as THREE.Light).isLight,
    );
    const background = scene.background;
    const autoClear = this.renderer.autoClear;
    try {
      scene.children = overlays;
      scene.background = null;
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(scene, this.camera);
    } finally {
      scene.children = children;
      scene.background = background;
      this.renderer.autoClear = autoClear;
    }
  }
  /** Photo-look diagnostics: how the last still was rendered. */
  get photoStats() {
    return { ...this.photoInfo };
  }
  /** Path-trace a capture: the same tracer, stage and lens as the interactive
   * still, at the capture size, for exactly `pathSamples` samples (stable noise,
   * so a capture of the same view repeats). Yields between tiles. */
  private async capturePathTraced(
    look: LookControls,
    trace: ReturnType<SceneAdapter["photoTrace"]>,
    target: THREE.WebGLRenderTarget,
    width: number,
    height: number,
    background: THREE.Color | null,
    context: number,
  ) {
    const alive = () =>
      ensure(
        !this.lost && context === this.contextEpoch,
        "WEBGL_UNAVAILABLE",
        "Graphics context changed during capture",
      );
    const photo = await this.withContext(this.ensurePhoto());
    // The interactive still restarts after the capture.
    this.photoViewKey = "";
    await this.withContext(
      photo.prepare(trace.key, () => this.traceSources(trace.meshes), {
        backdrop: trace.backdrop,
        bounds: trace.bounds,
      }),
    );
    alive();
    photo.setBackground(background);
    photo.setView(this.photoView(look, width, height, trace.bounds));
    photo.compile();
    while (photo.compiling) {
      await new Promise((resolve) => setTimeout(resolve, 16));
      alive();
    }
    photo.reset();
    let last = performance.now();
    while (photo.samples < look.pathSamples) {
      photo.step(1);
      photo.sync();
      if (performance.now() - last > 40) {
        // Keep the page responsive during a long trace.
        await new Promise((resolve) => setTimeout(resolve, 0));
        alive();
        last = performance.now();
      }
    }
    const pipeline = (this.pipeline ??= new LookPipeline());
    pipeline.presentImage({
      renderer: this.renderer,
      texture: photo.texture,
      target,
      background,
      vignette: look.vignette,
      grade: this.lookGrade(look),
      denoise: photoDenoise(photo.samples),
    });
    return {
      calls: 0,
      triangles: photo.triangles,
      points: 0,
      lines: 0,
      frame: 0,
    };
  }
  /** One frame of the HDR look pipeline, jittered (camera sub-pixel offset and key
   * light position) when it is a later sample of an accumulated still. */
  private drawLookFrame(
    look: LookControls,
    target: THREE.WebGLRenderTarget | null,
    width: number,
    height: number,
    sample: number,
    options: { aoScale: number; msaa: number; afterDraw?: () => void },
  ) {
    const pipeline = (this.pipeline ??= new LookPipeline());
    const accumulate = look.samples > 1;
    const camera = this.camera;
    const key = this.keyLight.position.clone();
    if (accumulate && sample > 0) {
      this.shadowDirty = true;
      const [jx, jy] = jitterOffset(sample);
      camera.setViewOffset(width, height, jx, jy, width, height);
      // Spread the key light over a disc for area-light penumbrae.
      const [u, v] = jitterOffset(sample + 7);
      const radius = key.distanceTo(this.keyLight.target.position) * 0.04;
      const side = new THREE.Vector3(1, 0, 0),
        up = new THREE.Vector3(0, 0, 1);
      this.keyLight.position
        .addScaledVector(side, u * 2 * radius)
        .addScaledVector(up, v * 2 * radius);
    }
    try {
      pipeline.render({
        renderer: this.renderer,
        scene: this.scene,
        camera,
        draw: () => {
          this.drawDirect();
          options.afterDraw?.();
        },
        target,
        width,
        height,
        ao: look.ambientOcclusion === "gtao",
        aoScale: options.aoScale,
        aoBox: this.aoBox,
        vignette: look.vignette,
        sample,
        accumulate,
        msaa: options.msaa,
        grade: this.lookGrade(look),
      });
    } finally {
      if (accumulate && sample > 0) {
        camera.clearViewOffset();
        // The next frame needs the shadow map of the unjittered light again.
        this.shadowDirty = true;
      }
      this.keyLight.position.copy(key);
    }
  }
  invalidate(options: { cameraOnly?: boolean } = {}) {
    if (this.disposed || this.lost) return;
    if (!options.cameraOnly) this.shadowDirty = true;
    // Any change restarts the still accumulation.
    this.stillSample = 0;
    // A path-traced still pauses; the next frame resumes it if nothing it
    // depends on changed (a selection change keeps its samples).
    this.stopPhoto();
    if (this.refineRaf) {
      cancelAnimationFrame(this.refineRaf);
      this.refineRaf = 0;
    }
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      // A capture owns the renderer; its cleanup redraws the view.
      if (!this.lost && !this.disposed && !this.captureActive) this.drawScene();
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
    this.cameraJump = true;
    try {
      this.controls.update();
    } finally {
      this.cameraJump = false;
    }
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
  private occurrenceList?: { project: Project; list: Occurrence[] };
  /** Expanded occurrences of the rendered project (computed once per update). */
  private projectOccurrences() {
    if (!this.project) return [];
    if (this.occurrenceList?.project !== this.project)
      this.occurrenceList = {
        project: this.project,
        list: occurrences(this.project),
      };
    return this.occurrenceList.list;
  }
  private collisionProxies = new Map<
    string,
    { detail: Float32Array; box: Float32Array; openings: boolean } | null
  >();
  /** Simplified part-space collision shapes of an official part (cached per
   * part; null when it cannot be expanded, so the rendered mesh is used):
   * stud-free polygons, and its bounding box for the coarsest level. */
  private collisionProxy(ref: string) {
    let proxy = this.collisionProxies.get(ref);
    if (proxy === undefined) {
      const read = (name: string) =>
        this.libraryBlocks.get(name) ?? fullSource(name);
      const detail = collisionProxy(read, ref);
      proxy = detail
        ? {
            detail,
            box: boxProxy(detail),
            openings: keepsOpenings(partTitle(read(ref) ?? "")),
          }
        : null;
      this.collisionProxies.set(ref, proxy);
    }
    return proxy ?? undefined;
  }
  async playGeometry(selection?: { include?: string[]; exclude?: string[] }) {
    ensure(
      !this.transformDragging,
      "INVALID_INPUT",
      "Finish or cancel the transform gesture before entering Play",
    );
    await this.ready();
    // Only the included handles need fresh world matrices (a door rig asks for
    // one part; walking the whole scene per request made entry quadratic).
    this.root.updateWorldMatrix(true, false);
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
    const append = (
      e: ArrayLike<number>,
      vertexCount: number,
      read: (i: number, axis: number) => number,
      count: number,
      index: THREE.BufferAttribute | null,
    ) => {
      if (indexCount + count > 3_000_000) {
        overBudget = true;
        return;
      }
      const offset = vertexFloats / 3;
      vertices = grow(vertices, vertexFloats + vertexCount * 3);
      for (let i = 0; i < vertexCount; i++) {
        const x = read(i, 0),
          y = read(i, 1),
          z = read(i, 2);
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
      const m = e;
      const mirrored =
        m[0] * (m[5] * m[10] - m[6] * m[9]) -
          m[4] * (m[1] * m[10] - m[2] * m[9]) +
          m[8] * (m[1] * m[6] - m[2] * m[5]) <
        0;
      indices = grow(indices, indexCount + count);
      for (let i = 0; i + 2 < count; i += 3) {
        const a = index ? index.getX(i) : i;
        const b = index ? index.getX(i + 1) : i + 1;
        const c = index ? index.getX(i + 2) : i + 2;
        indices[indexCount++] = offset + a;
        indices[indexCount++] = offset + (mirrored ? c : b);
        indices[indexCount++] = offset + (mirrored ? b : c);
      }
    };
    const selected = [...this.handles].filter(
      ([id]) => !((include && !include.has(id)) || exclude.has(id)),
    );
    for (const [, group] of selected) group.updateMatrixWorld(true);
    // A world whose rendered surface exceeds the collision budget collides with
    // simplified official parts instead of refusing to walk (collision-proxy.ts):
    // first without studs and underside tubes; if that is still over budget,
    // parts without openings (not doors or arches) become their bounding boxes.
    const BUDGET = 1_000_000;
    let surface = 0;
    for (const [, group] of selected)
      surface += prototypeTriangleCount(group.userData.prototype ?? group);
    const byId =
      surface > BUDGET && this.project
        ? new Map(this.projectOccurrences().map((o) => [o.id, o]))
        : undefined;
    const proxyOf = (id: string) => {
      const occurrence = byId?.get(id);
      return occurrence?.namespace === "official" &&
        occurrence.node.kind !== "geometry"
        ? this.collisionProxy(occurrence.node.ref)
        : undefined;
    };
    let boxes = false;
    if (byId) {
      let detailed = 0;
      for (const [id, group] of selected) {
        const proxy = proxyOf(id);
        detailed += proxy
          ? proxy.detail.length / 9
          : prototypeTriangleCount(group.userData.prototype ?? group);
      }
      boxes = detailed > BUDGET;
    }
    let simplified = 0,
      boxed = 0;
    for (const [id, group] of selected) {
      if (overBudget) break;
      const found = proxyOf(id);
      const proxy =
        found && (boxes && !found.openings ? found.box : found.detail);
      if (found && proxy) {
        let frame: THREE.Object3D | undefined;
        group.traverse((object) => {
          if (!frame && (object as THREE.Mesh).isMesh) frame = object;
        });
        if (frame) {
          simplified++;
          if (proxy === found.box) boxed++;
          append(
            frame.matrixWorld.elements,
            proxy.length / 3,
            (i, axis) => proxy[i * 3 + axis],
            proxy.length / 3,
            null,
          );
          continue;
        }
      }
      group.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh || overBudget) return;
        const geometry = mesh.geometry,
          position = geometry.getAttribute("position");
        if (!position) return;
        const index = geometry.index;
        append(
          mesh.matrixWorld.elements,
          position.count,
          (i, axis) =>
            axis === 0
              ? position.getX(i)
              : axis === 1
                ? position.getY(i)
                : position.getZ(i),
          index ? index.count : position.count,
          index,
        );
      });
    }
    if (overBudget) {
      warnings.push(
        "Collision mesh exceeds one million triangles. Fly mode remains available.",
      );
      vertexFloats = indexCount = 0;
    }
    const missing = this.project
      ? [
          ...new Set(
            this.projectOccurrences()
              .filter(
                (o) =>
                  (!include || include.has(o.id)) &&
                  !exclude.has(o.id) &&
                  o.namespace === "missing",
              )
              .map((o) => o.node.ref),
          ),
        ]
      : [];
    if (missing.length) {
      // Name the parts: a generic "collision unavailable" gave no way forward.
      const names =
        missing.slice(0, 3).join(", ") + (missing.length > 3 ? ", …" : "");
      warnings.push(
        `${missing.length} part type${missing.length === 1 ? " is" : "s are"} missing (${names}), so the world may have gaps and walking is off. ` +
          "Reconnect and enter Play again if they are official parts, or replace them in Build. Fly still works.",
      );
      vertexFloats = indexCount = 0;
    }
    const empty = min[0] > max[0];
    const unsupported = warnings.length > 0;
    // Informational: the world stays walkable with simplified parts.
    if (simplified && !unsupported)
      warnings.push(
        `This large world collides with simplified shapes for ${simplified.toLocaleString("en-US")} official parts (studs and underside tubes omitted${boxed ? `; ${boxed.toLocaleString("en-US")} parts without doorways or arches as their bounding boxes` : ""}) to stay within the collision budget.`,
      );
    return {
      revision: this.revision,
      vertices: vertices.slice(0, vertexFloats),
      indices: indices.slice(0, indexCount),
      unsupported,
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
      () => {
        if (this.transformHandles?.dragging) this.noteMotion();
        this.invalidate();
      },
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
      if (!this.batches.setDynamic([])) this.batches.refresh();
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
    if (materialsChanged) this.batches.refresh();
    const camera = this.currentCamera();
    const visible = new Map(
      [...this.handles].map(([id, g]) => [id, g.visible]),
    );
    const grid = this.grid.visible,
      selection = this.selection.visible,
      transformVisible = this.transformHandles?.helper.visible;
    const annotations = this.annotations.visible;
    this.controls.enabled = false;
    this.grid.visible = false;
    this.selection.visible = false;
    this.annotations.visible = false;
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
      this.annotations.visible = annotations;
      if (this.transformHandles && transformVisible !== undefined)
        this.transformHandles.helper.visible = transformVisible;
      this.playViewActive = false;
      this.playIncludedIds = undefined;
      this.applyPixelRatio();
      this.applyLayerGhost();
      if (this.layerGhost.active || this.instructionDimming.active)
        this.batches.refresh();
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
    // Only the camera moved: a cached shadow map stays valid. Play marks pose
    // and figure changes itself (invalidate without cameraOnly).
    this.noteMotion();
    this.invalidate({ cameraOnly: true });
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
  private explodeGap = 0;
  private explodeLift = new Map<string, number>();
  /** Exploded view (spec §20.2): lift the model's floors apart by `gap` LDU each.
   * Render-only; the document and exports are unchanged. Returns the group count. */
  setExplode(gap: number) {
    ensure(
      Number.isFinite(gap) && gap >= 0 && gap <= 4000,
      "INVALID_INPUT",
      "Explode gap must be 0–4000 LDU.",
    );
    this.explodeGap = gap;
    const next =
      gap && this.project
        ? explodeLifts(this.project, gap)
        : { lifts: new Map<string, number>(), groups: 0 };
    for (const [id, group] of this.handles) {
      const before = this.explodeLift.get(id) ?? 0,
        after = next.lifts.get(id) ?? 0;
      if (before === after) continue;
      group.matrix.elements[13] += before - after;
      group.updateMatrixWorld(true);
    }
    this.explodeLift = next.lifts;
    this.explodeLevels = "levels" in next ? next.levels : [];
    this.batches.refresh();
    this.rebuildAnnotations();
    this.invalidate();
    return next.groups;
  }
  get exploded() {
    return this.explodeGap;
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
    // Parts wholly beyond the cut are left out of the instance arrays.
    this.batches.setClipPlane(this.renderer.clippingPlanes[0] ?? null);
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
  /** Handle-local bounds of each prototype's meshes (shared by its clones). */
  private pickBounds = new WeakMap<THREE.Object3D, THREE.Box3 | null>();
  private pickRootMatrix?: THREE.Matrix4;
  /** Handles keep their world matrices current as they move (see RenderBatches);
   * a pick only needs the camera and, once, the model root. Forcing a
   * scene-wide matrix update per pick cost milliseconds at 20,000 parts. */
  private syncPickMatrices() {
    this.camera.updateMatrixWorld();
    this.root.updateWorldMatrix(true, false);
    if (!this.pickRootMatrix?.equals(this.root.matrixWorld)) {
      this.root.updateMatrixWorld(true);
      this.pickRootMatrix = this.root.matrixWorld.clone();
    }
  }
  private handleBounds(group: THREE.Group) {
    const key =
      (group.userData.prototype as THREE.Object3D | undefined) ?? group;
    if (this.pickBounds.has(key)) return this.pickBounds.get(key)!;
    const inverse = group.matrixWorld.clone().invert();
    const box = new THREE.Box3(),
      part = new THREE.Box3(),
      relative = new THREE.Matrix4();
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      relative.multiplyMatrices(inverse, mesh.matrixWorld);
      box.union(part.copy(mesh.geometry.boundingBox!).applyMatrix4(relative));
    });
    const bounds = box.isEmpty() ? null : box;
    this.pickBounds.set(key, bounds);
    return bounds;
  }
  /**
   * Nearest accepted triangle-mesh hit among the handles `include` admits.
   * Broadphase: each handle's cached local box, entered along the ray; handles
   * are then tested nearest-first and the search stops once the best hit lies
   * before the next box. Lines are never tested (they are drawn over faces).
   */
  private raycastHandles(
    ray: THREE.Raycaster,
    include: (id: string, group: THREE.Group) => boolean,
    accept: (hit: THREE.Intersection, id: string) => boolean = () => true,
  ): { hit: THREE.Intersection; id: string } | null {
    this.syncPickMatrices();
    const inverse = new THREE.Matrix4(),
      local = new THREE.Ray(),
      entry = new THREE.Vector3();
    const candidates: Array<{ id: string; group: THREE.Group; near: number }> =
      [];
    for (const [id, group] of this.handles) {
      if (!include(id, group)) continue;
      const box = this.handleBounds(group);
      if (!box) continue;
      local
        .copy(ray.ray)
        .applyMatrix4(inverse.copy(group.matrixWorld).invert());
      if (!local.intersectBox(box, entry)) continue;
      candidates.push({
        id,
        group,
        near: entry.applyMatrix4(group.matrixWorld).distanceTo(ray.ray.origin),
      });
    }
    candidates.sort((a, b) => a.near - b.near);
    let best: { hit: THREE.Intersection; id: string } | null = null;
    const hits: THREE.Intersection[] = [];
    for (const candidate of candidates) {
      if (best && best.hit.distance <= candidate.near) break;
      hits.length = 0;
      candidate.group.traverse((object) => {
        if ((object as THREE.Mesh).isMesh) object.raycast(ray, hits);
      });
      hits.sort((a, b) => a.distance - b.distance);
      for (const hit of hits) {
        if (best && hit.distance >= best.hit.distance) break;
        if (accept(hit, candidate.id)) {
          best = { hit, id: candidate.id };
          break;
        }
      }
    }
    return best;
  }
  /** First visible model surface under a screen point, in LDraw coordinates. */
  pickPoint(x: number, y: number): Vec3 | null {
    const found = this.raycastHandles(
      this.ray(x, y),
      (_, group) => group.visible,
      (hit) => !this.aboveSection(hit.point),
    );
    return found && conversion(found.hit.point.toArray() as Vec3);
  }
  /** First visible surface under a screen point: its occurrence, point and outward face
   * normal, all in LDraw coordinates (−Y is up). */
  pickSurface(
    x: number,
    y: number,
  ): { occurrenceId: string; point: Vec3; normal: Vec3 } | null {
    const ray = this.ray(x, y);
    const found = this.raycastHandles(
      ray,
      (_, group) => group.visible,
      (hit) => !this.aboveSection(hit.point) && !!hit.face,
    );
    if (!found) return null;
    const { hit } = found;
    const normal = hit
      .face!.normal.clone()
      .transformDirection(hit.object.matrixWorld);
    // Face toward the viewer (double-sided or reversed winding reports either side).
    if (normal.dot(ray.ray.direction) > 0) normal.negate();
    return {
      occurrenceId: found.id,
      point: conversion(hit.point.toArray() as Vec3),
      normal: conversion(normal.toArray() as Vec3),
    };
  }
  private explodeLevels: number[] = [];
  private floorFocusSpec: FloorFocus | null = null;
  private floorHidden = new Set<string>();
  private floorGhosted = new Set<string>();
  private bottomsCache?: { project: Project; bottoms: Map<string, number> };
  private bottomParts: BottomCache = new Map();
  private guidesShown = false;
  private labelsShown = false;
  private annotations = new THREE.Group();
  private computeFloorFocus(p = this.project) {
    this.floorHidden = new Set();
    this.floorGhosted = new Set();
    const focus = this.floorFocusSpec;
    if (!p || !focus) return;
    if (this.bottomsCache?.project !== p)
      this.bottomsCache = {
        project: p,
        bottoms: occurrenceBottoms(p, undefined, this.bottomParts),
      };
    const sets = floorFocusSets(p, focus, this.bottomsCache.bottoms);
    // A focused floor that was removed from the document releases the focus.
    if (sets.index < 0) {
      this.floorFocusSpec = null;
      return;
    }
    this.floorHidden = sets.hidden;
    this.floorGhosted = sets.ghosted;
  }
  /** Editor visibility: the instruction step (or layer visibility) minus hidden floors. */
  private applyVisibility() {
    if (!this.project || this.playViewActive) return;
    const base =
      this.instructionVisibility ??
      new Set(
        occurrences(this.project)
          .filter((o) => o.visible)
          .map((o) => o.id),
      );
    for (const [id, group] of this.handles)
      group.visible = base.has(id) && !this.floorHidden.has(id);
  }
  /** Floor focus (spec §20.2): show one floor, hide the floors above it (such as the
   * roof) and ghost the floors below. A view setting: nothing is deleted or reordered,
   * and editing still applies to the whole document. */
  setFloorFocus(focus: FloorFocus | null) {
    ensure(
      focus === null ||
        (typeof focus?.floorId === "string" &&
          typeof focus.ghostBelow === "boolean" &&
          Object.keys(focus).every(
            (k) => k === "floorId" || k === "ghostBelow",
          )),
      "INVALID_INPUT",
      "Floor focus needs { floorId, ghostBelow } or null.",
    );
    if (focus && this.project)
      ensure(
        architectureOf(this.project).floors.some((f) => f.id === focus.floorId),
        "INVALID_INPUT",
        "Unknown floor: " + focus.floorId,
      );
    this.floorFocusSpec = focus && { ...focus };
    // A running capture keeps its materials; its cleanup applies the latest focus.
    if (this.captureActive) return this.floorFocus;
    this.computeFloorFocus();
    this.applyVisibility();
    this.applyLayerGhost();
    this.batches.refresh();
    this.rebuildAnnotations();
    this.invalidate();
    return this.floorFocus;
  }
  get floorFocus() {
    return {
      focus: this.floorFocusSpec && { ...this.floorFocusSpec },
      hidden: this.floorHidden.size,
      ghosted: this.floorGhosted.size,
    };
  }
  /** Show floor-height guide planes and/or room labels (overlays, never geometry). */
  setAnnotations(options: { floorGuides?: boolean; roomLabels?: boolean }) {
    ensure(
      options &&
        Object.entries(options).every(
          ([k, v]) =>
            ["floorGuides", "roomLabels"].includes(k) && typeof v === "boolean",
        ),
      "INVALID_INPUT",
      "Annotations take floorGuides and roomLabels booleans.",
    );
    if (options.floorGuides !== undefined)
      this.guidesShown = options.floorGuides;
    if (options.roomLabels !== undefined) this.labelsShown = options.roomLabels;
    this.rebuildAnnotations();
    this.invalidate();
    return this.annotationState;
  }
  get annotationState() {
    return {
      floorGuides: this.guidesShown,
      roomLabels: this.labelsShown,
      drawn: this.annotationCounts(),
    };
  }
  private annotationCounts() {
    let guides = 0,
      labels = 0;
    if (this.annotations.visible)
      for (const child of this.annotations.children) {
        if (child.userData.kind === "floor-guide") guides++;
        if (child.userData.kind === "room-label") labels++;
      }
    return { guides, labels };
  }
  private clearAnnotations() {
    for (const child of [...this.annotations.children]) {
      this.annotations.remove(child);
      child.traverse((o) => {
        const d = o as THREE.Mesh;
        d.geometry?.dispose();
        const materials = d.material
          ? Array.isArray(d.material)
            ? d.material
            : [d.material]
          : [];
        for (const m of materials) {
          (m as THREE.SpriteMaterial).map?.dispose();
          m.dispose();
        }
      });
    }
  }
  /** Rebuild guide planes and labels for the rendered document and current view aids. */
  private rebuildAnnotations() {
    this.clearAnnotations();
    const p = this.project;
    if (!p || (!this.guidesShown && !this.labelsShown)) return;
    const a = architectureOf(p),
      floors = sortedFloors(a.floors);
    const focus = this.floorFocusSpec,
      focusIndex = focus ? floors.findIndex((f) => f.id === focus.floorId) : -1;
    const lift = (y: number) =>
      this.explodeGap ? liftAt(y, this.explodeLevels, this.explodeGap) : 0;
    if (this.guidesShown && floors.length) {
      this.root.updateMatrixWorld(true);
      const box = new THREE.Box3();
      for (const g of this.handles.values()) box.expandByObject(g);
      if (box.isEmpty())
        box.set(
          new THREE.Vector3(-200, 0, -200),
          new THREE.Vector3(200, 0, 200),
        );
      const margin = 40,
        width = box.max.x - box.min.x + margin * 2,
        depth = box.max.z - box.min.z + margin * 2,
        cx = (box.min.x + box.max.x) / 2,
        cz = (box.min.z + box.max.z) / 2;
      floors.forEach((floor, i) => {
        if (focusIndex >= 0 && i > focusIndex) return;
        const current = i === focusIndex,
          color = current ? 0x5bb56a : 0x8ec9ff;
        const worldY = -(floor.y - lift(floor.y));
        const guide = new THREE.Group();
        guide.userData = { kind: "floor-guide", floorId: floor.id };
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: current ? 0.16 : 0.08,
            depthWrite: false,
            side: THREE.DoubleSide,
            toneMapped: false,
          }),
        );
        const edge = new THREE.LineSegments(
          new THREE.EdgesGeometry(plane.geometry),
          new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: 0.85,
            toneMapped: false,
          }),
        );
        plane.renderOrder = edge.renderOrder = 900;
        guide.add(plane, edge);
        guide.position.set(cx, worldY, cz);
        const tag = textSprite(floor.name, current ? "focus" : "guide");
        tag.position.set(box.min.x - margin, worldY, box.max.z + margin);
        this.annotations.add(guide, tag);
      });
    }
    if (this.labelsShown)
      for (const label of a.labels) {
        // Untied labels (index −2) stay visible whatever floor is in focus.
        const index = label.floorId
          ? floors.findIndex((f) => f.id === label.floorId)
          : -2;
        if (focusIndex >= 0 && index > focusIndex) continue;
        const dim = focusIndex >= 0 && index >= -1 && index < focusIndex;
        const [x, y, z] = label.position;
        const sprite = textSprite(label.text, dim ? "dim" : "label");
        sprite.userData = {
          ...sprite.userData,
          kind: "room-label",
          id: label.id,
        };
        sprite.position.fromArray(conversion([x, y - lift(y), z]));
        this.annotations.add(sprite);
      }
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
    const found = this.raycastHandles(
      this.ray(x, y),
      (_, group) => group.visible,
      (hit) => !this.aboveSection(hit.point),
    );
    // The photo look focuses on the last tapped part.
    if (found) this.photoFocusPoint = found.hit.point.clone();
    return found?.id ?? null;
  }
  /** Intersects only authored triangle meshes, preserving their complete world affine transform. */
  pickFace(
    x: number,
    y: number,
    selectedIds?: ReadonlySet<string>,
    settings?: Workplane,
  ): { occurrenceId: string; plane: Workplane } | null {
    const ray = this.ray(x, y);
    let plane: Workplane | undefined;
    const found = this.raycastHandles(
      ray,
      (id, g) => g.visible && (!selectedIds?.size || selectedIds.has(id)),
      (hit) => {
        const mesh = hit.object as THREE.Mesh;
        if (!hit.face || this.aboveSection(hit.point)) return false;
        for (
          let object: THREE.Object3D | null = mesh;
          object;
          object = object.parent
        )
          if (!object.visible) return false;
        const positions = mesh.geometry.getAttribute("position");
        const point = (index: number) =>
          conversion(
            new THREE.Vector3()
              .fromBufferAttribute(positions, index)
              .applyMatrix4(mesh.matrixWorld)
              .toArray() as Vec3,
          );
        try {
          plane = planeFromTriangle(
            point(hit.face.a),
            point(hit.face.b),
            point(hit.face.c),
            conversion(ray.ray.origin.toArray() as Vec3),
            settings,
          );
          return true;
        } catch {
          return false;
        }
      },
    );
    return found && plane ? { occurrenceId: found.id, plane } : null;
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
    if (!this.playViewActive) for (const id of this.floorGhosted) ids.add(id);
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
    this.batches.refresh();
    this.invalidate();
  }
  showStep(ids: string[] | null, newIds?: string[]) {
    this.instructionVisibility = ids ? new Set(ids) : null;
    this.instructionNewIds = ids && newIds ? new Set(newIds) : null;
    if (this.captureActive) return;
    this.applyLayerGhost();
    this.batches.refresh();
    this.applyVisibility();
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
      savedVisible = new Map(
        [...this.handles].map(([id, g]) => [id, g.visible]),
      ),
      background = this.scene.background,
      grid = this.grid.visible,
      selection = this.selection.visible,
      transformVisible = this.transformHandles?.helper.visible,
      target = this.renderer.getRenderTarget(),
      controlsEnabled = this.controls.enabled,
      savedQuality = this.currentQuality(),
      savedLook = this.currentLook();
    const captureProfile = resolveQuality(
      request.quality,
      request.qualityControls,
    );
    const captureLook = resolveLook(
      request.look ?? "standard",
      request.lookControls,
      this.lookResourceProfile,
    );
    let captureLighting: ReturnType<SceneAdapter["lightingManifest"]>;
    let captureStats: typeof this.renderer.info.render;
    let capturedFloorFocus: FloorFocus | null = null,
      capturedAnnotations = { guides: 0, labels: 0 };
    let capturePhoto: {
      renderer: "path" | "raster";
      reason: string | null;
      samples: number;
      triangles: number;
      buildMs?: number;
    } | null = null;
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
    // Captures keep full detail whatever the interactive view last drew.
    this.batches.setLinesSuppressed(false);
    try {
      this.instructionDimming.restore();
      this.layerGhost.restore();
      this.applyLook(captureLook, false);
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
          // Floor focus (spec §20.2) hides upper floors unless IDs are explicit.
          (request.visibility.mode === "occurrences" ||
            !this.floorHidden.has(o.id)) &&
          (request.visibility.mode === "all" ||
            (request.visibility.mode === "current"
              ? this.playViewActive || o.visible
              : request.visibility.mode === "occurrences"
                ? selectedOccurrences.has(o.id)
                : !!request.visibility.layerIds?.includes(o.layerId)));
      }
      if (this.floorGhosted.size && !this.playViewActive)
        this.layerGhost.apply(this.handles, this.floorGhosted);
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
      this.batches.refresh();
      this.grid.visible = false;
      this.selection.visible = false;
      if (this.transformHandles) this.transformHandles.helper.visible = false;
      this.ghost.visible = false;
      this.scene.background =
        request.background.type === "transparent"
          ? null
          : new THREE.Color(request.background.color || "#ffffff");
      this.aspect(request.width / request.height);
      this.shadowDirty = true;
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
      const photoTrace =
        captureLook.renderer === "path" ? this.photoTrace(captureLook) : null;
      capturePhoto = {
        renderer: photoTrace?.choice.renderer ?? "raster",
        reason: photoTrace?.choice.reason ?? null,
        samples: 0,
        triangles: photoTrace?.triangles ?? 0,
      };
      if (photoTrace?.choice.renderer === "path") {
        captureStats = await this.capturePathTraced(
          captureLook,
          photoTrace,
          rt,
          request.width,
          request.height,
          request.background.type === "transparent"
            ? null
            : new THREE.Color(request.background.color || "#ffffff"),
          capturedContext,
        );
        capturePhoto.samples = captureLook.pathSamples;
        capturePhoto.buildMs = Math.round(this.photo?.buildMs ?? 0);
      } else if (lookUsesPipeline(captureLook)) {
        if (captureLook.samples > 1) capturePhoto.samples = captureLook.samples;
        // Accumulated captures anti-alias through jitter; single frames use MSAA.
        const samples = captureLook.samples;
        for (let sample = 0; sample < samples; sample++) {
          if (sample && sample % 4 === 0) {
            // Yield so a long accumulation keeps the page responsive.
            await new Promise((resolve) => setTimeout(resolve, 0));
            ensure(
              !this.lost && capturedContext === this.contextEpoch,
              "WEBGL_UNAVAILABLE",
              "Graphics context changed during capture",
            );
          }
          this.drawLookFrame(
            captureLook,
            rt,
            request.width,
            request.height,
            sample,
            {
              aoScale: 1,
              msaa: samples > 1 ? 0 : 4,
              afterDraw: () => {
                if (sample === 0)
                  captureStats = { ...this.renderer.info.render };
              },
            },
          );
        }
      } else {
        this.renderer.setRenderTarget(rt);
        this.drawDirect();
        captureStats = { ...this.renderer.info.render };
      }
      capturedFloorFocus = this.floorFocusSpec && { ...this.floorFocusSpec };
      capturedAnnotations = this.annotationCounts();
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
      this.computeFloorFocus();
      this.applyLook(savedLook, false);
      this.applyLayerGhost();
      this.batches.refresh();
      this.applyQuality(savedQuality);
      this.controls.enabled = controlsEnabled;
      this.renderer.setRenderTarget(target);
      rt.dispose();
      for (const [id, visible] of savedVisible) {
        const g = this.handles.get(id);
        if (g) g.visible = visible;
      }
      if (!this.playViewActive) {
        // Pick up step or floor-focus changes requested while the capture ran.
        this.applyVisibility();
        this.rebuildAnnotations();
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
        look: captureLook,
        ...(captureLook.name === "photo" && capturePhoto
          ? { photo: capturePhoto }
          : {}),
        lighting: captureLighting!,
        clipping: {
          space: "renderer-world",
          planes: this.renderer.clippingPlanes.map((plane) => ({
            normal: plane.normal.toArray(),
            constant: plane.constant,
          })),
          localClippingEnabled: this.renderer.localClippingEnabled,
        },
        architecture: {
          floorFocus: capturedFloorFocus,
          floorGuides: capturedAnnotations.guides,
          roomLabels: capturedAnnotations.labels,
        },
        output: {
          width: request.width,
          height: request.height,
          colorSpace: this.renderer.outputColorSpace,
          toneMapping:
            captureLook.toneMapping === "quality"
              ? captureProfile.toneMapping
              : captureLook.toneMapping,
          exposure: captureProfile.exposure * captureLook.exposureScale,
          // Only the look pipeline tone-maps captures; direct captures are linear sRGB.
          toneMapped: lookUsesPipeline(captureLook),
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
    clearTimeout(this.motionTimer);
    this.contextWork.abort();
    this.compiler?.dispose();
    this.transformHandles?.dispose();
    this.transformHandles = undefined;
    this.instructionDimming.restore();
    this.layerGhost.restore();
    this.clearGhost();
    this.clearAnnotations();
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.refineRaf);
    this.releasePhoto(true);
    this.pipeline?.dispose();
    this.pipeline = undefined;
    this.environmentMap = disposeTexture(this.environmentMap);
    this.shadowGround.geometry.dispose();
    this.shadowGround.material.dispose();
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
