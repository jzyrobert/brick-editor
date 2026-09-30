import * as THREE from "three";
import { MeshBVH, SAH } from "three-mesh-bvh";
import { PathTracingRenderer } from "three-gpu-pathtracer/src/core/PathTracingRenderer.js";
import { PhysicalPathTracingMaterial } from "three-gpu-pathtracer/src/materials/pathtracing/PhysicalPathTracingMaterial.js";
import { GenerateMeshBVHWorker } from "three-mesh-bvh/src/workers/GenerateMeshBVHWorker.js";
import { treatmentBase } from "./batching";
import {
  PhotoSampler,
  decorrelatePixels,
  highestTupleIndex,
  tupleTextureSize,
} from "./photo-sampling";
import { classifyFinish } from "./look";
import {
  GUIDE_FRONT_ONLY,
  GUIDE_OPAQUE,
  GUIDE_SKIP,
  PhotoDenoiser,
  type GuideSlot,
} from "./photo-denoise";
import {
  estimateNoise,
  isNoiseCheckpoint,
  photoLens,
  type PhotoSchedule,
} from "./photo-policy";

/**
 * Path-traced stills for the photo look (three-gpu-pathtracer). A still view is
 * traced progressively on the GPU against a BVH of the visible model, lit by a
 * procedural studio environment and staged on a studio sweep; see
 * docs/RENDERING.md. The raster pipeline draws every moving frame, and remains
 * the fallback where path tracing is unavailable (see choosePhotoRenderer).
 */

type Panel = {
  /** Direction from the subject towards the light, camera frame (+Z = camera). */
  direction: [number, number, number];
  halfWidth: number;
  halfHeight: number;
  softness: number;
  radiance: [number, number, number];
};
/** Studio lighting in the camera frame: a large key softbox above camera left, a
 * dimmer fill to the right, two strip lights behind for rim highlights, and an
 * overhead soft light. The environment is rotated with the camera's azimuth. */
export const STUDIO_PANELS: readonly Panel[] = [
  {
    direction: [-0.62, 0.7, 0.36],
    halfWidth: 0.26,
    halfHeight: 0.2,
    softness: 0.05,
    radiance: [16, 15.3, 14.3],
  },
  {
    direction: [0.85, 0.3, 0.42],
    halfWidth: 0.5,
    halfHeight: 0.36,
    softness: 0.2,
    radiance: [0.9, 0.95, 1.05],
  },
  {
    direction: [0.72, 0.42, -0.55],
    halfWidth: 0.08,
    halfHeight: 0.5,
    softness: 0.04,
    radiance: [5, 5, 5],
  },
  {
    direction: [-0.78, 0.36, -0.52],
    halfWidth: 0.08,
    halfHeight: 0.5,
    softness: 0.04,
    radiance: [3.6, 3.6, 3.8],
  },
  {
    direction: [0, 1, 0],
    halfWidth: 0.6,
    halfHeight: 0.6,
    softness: 0.3,
    radiance: [0.7, 0.7, 0.7],
  },
];

/** Equirectangular studio radiance (linear RGBA float, row 0 = straight down),
 * in the pathtracer's convention: u = atan(z, x) / 2π + 0.5, v = 1 − acos(y) / π. */
export function studioEnvironmentData(
  width = 512,
  height = 256,
  panels: readonly Panel[] = STUDIO_PANELS,
) {
  const data = new Float32Array(width * height * 4);
  const frames = panels.map((panel) => {
    const c = new THREE.Vector3(...panel.direction).normalize();
    const up =
      Math.abs(c.y) > 0.99
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, c).normalize();
    const upward = new THREE.Vector3().crossVectors(c, right).normalize();
    return { panel, c, right, upward };
  });
  const d = new THREE.Vector3();
  const edge = (value: number, half: number, soft: number) => {
    const t = (half - Math.abs(value)) / Math.max(1e-6, soft) + 0.5;
    const s = Math.max(0, Math.min(1, t));
    return s * s * (3 - 2 * s);
  };
  for (let row = 0; row < height; row++) {
    const v = (row + 0.5) / height;
    const phi = (1 - v) * Math.PI;
    for (let column = 0; column < width; column++) {
      const u = (column + 0.5) / width;
      const theta = (u - 0.5) * 2 * Math.PI;
      d.set(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      );
      // Neutral studio walls: brighter towards the ceiling, dark below.
      const y = d.y;
      const wall = y >= 0 ? 0.07 + 0.1 * y : 0.03 + 0.04 * (1 + y);
      let r = wall,
        g = wall,
        b = wall * 1.02;
      for (const { panel, c, right, upward } of frames) {
        const facing = d.dot(c);
        if (facing <= 0.05) continue;
        const x = d.dot(right) / facing,
          z = d.dot(upward) / facing;
        const weight =
          edge(x, panel.halfWidth, panel.softness) *
          edge(z, panel.halfHeight, panel.softness);
        if (weight <= 0) continue;
        r += panel.radiance[0] * weight;
        g += panel.radiance[1] * weight;
        b += panel.radiance[2] * weight;
      }
      const i = (row * width + column) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 1;
    }
  }
  return data;
}

function equirectTexture(data: Float32Array, width: number, height: number) {
  const texture = new THREE.DataTexture(
    data,
    width,
    height,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/** Studio sweep (an infinity cove turned all the way round): a floor that curves
 * up into a wall, so the backdrop is seamless from every orbit angle. Faces point
 * inwards and are single-sided, so a camera outside the cove sees through it. */
export function studioBackdropGeometry(
  center: THREE.Vector3,
  radius: number,
  floorY: number,
  walls = true,
) {
  const r = Math.max(radius, 40);
  const floor = walls ? 3.2 * r : 40 * r;
  const cove = 3 * r;
  const points: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
  for (let i = 1; i <= 6; i++)
    points.push(new THREE.Vector2((floor * i) / 6, 0));
  if (walls) {
    for (let i = 1; i <= 16; i++) {
      const t = (i / 16) * (Math.PI / 2);
      points.push(
        new THREE.Vector2(
          floor + cove * Math.sin(t),
          cove - cove * Math.cos(t),
        ),
      );
    }
    points.push(new THREE.Vector2(floor + cove, cove + 6 * r));
  }
  // LatheGeometry faces point away from the axis for a profile listed outwards;
  // reverse it so the floor faces up and the walls face the subject.
  const geometry = new THREE.LatheGeometry(points.reverse(), 96);
  geometry.translate(center.x, floorY, center.z);
  return geometry;
}

/** Physically based material for a LDrawLoader material under the path tracer:
 * glossy ABS with a thin clear coat, refractive transparent plastic, metals.
 * View treatments (ghosting, dimming) keep their reduced opacity. */
export function pathMaterial(
  source: THREE.Material,
): THREE.MeshPhysicalMaterial {
  // Scene-environment ground and props: their own physical material if they
  // supply one, else a plain dielectric of their colour (no textures are traced).
  if (source.userData?.photoStage) {
    const own = source.userData.photoMaterial as
      | THREE.MeshPhysicalMaterial
      | undefined;
    if (own?.isMeshPhysicalMaterial) return own.clone();
    const standard = source as THREE.MeshStandardMaterial;
    return new THREE.MeshPhysicalMaterial({
      color: standard.color?.clone() ?? new THREE.Color(0.6, 0.6, 0.6),
      roughness: standard.roughness ?? 0.9,
      metalness: standard.metalness ?? 0,
      side: THREE.DoubleSide,
    });
  }
  const base = treatmentBase(source) as THREE.MeshStandardMaterial;
  const standard = base as THREE.MeshStandardMaterial;
  const color =
    (standard.color as THREE.Color | undefined)?.clone() ??
    new THREE.Color(0.8, 0.8, 0.8);
  const material = new THREE.MeshPhysicalMaterial({
    color,
    side: THREE.DoubleSide,
  });
  material.name = base.name;
  const original = (standard.userData?.lookBase ?? {
    roughness: standard.roughness ?? 0.3,
    metalness: standard.metalness ?? 0,
  }) as { roughness: number; metalness: number };
  const finish = standard.isMeshStandardMaterial
    ? classifyFinish({
        name: standard.name,
        roughness: original.roughness,
        metalness: original.metalness,
        transparent: standard.transparent,
        emissive: standard.emissive,
      })
    : "plastic";
  const set = (values: Partial<THREE.MeshPhysicalMaterial>) =>
    Object.assign(material, values);
  // ABS: a dielectric (IOR ≈ 1.53) with a glossy moulded skin.
  set({
    roughness: 0.32,
    metalness: 0,
    ior: 1.53,
    clearcoat: 0.45,
    clearcoatRoughness: 0.08,
  });
  switch (finish) {
    case "transparent":
    case "glitter":
      set({
        roughness: finish === "glitter" ? 0.12 : 0.03,
        clearcoat: 0,
        transmission: 1,
        ior: 1.52,
        thickness: 4,
      });
      // Light crosses a part's surface twice (in and out), each crossing tinted
      // by the colour: the square root keeps a dark transparent colour (trans
      // dark blue) at its own tint instead of turning black. No volume
      // absorption, which darkened thick plates further.
      material.color.setRGB(
        Math.sqrt(color.r),
        Math.sqrt(color.g),
        Math.sqrt(color.b),
      );
      break;
    case "chrome":
      set({ roughness: 0.05, metalness: 1, clearcoat: 0 });
      break;
    case "metal":
      set({ roughness: 0.26, metalness: 0.95, clearcoat: 0 });
      break;
    case "matte-metallic":
      set({ roughness: 0.5, metalness: 0.75, clearcoat: 0 });
      break;
    case "pearlescent":
      set({
        roughness: 0.3,
        metalness: 0.6,
        clearcoat: 0.6,
        clearcoatRoughness: 0.1,
      });
      break;
    case "rubber":
      set({ roughness: 0.85, clearcoat: 0, specularIntensity: 0.5 });
      break;
    case "speckle":
      set({ roughness: 0.4, clearcoat: 0.2 });
      break;
    case "luminous":
      material.emissive.copy(standard.emissive ?? new THREE.Color(0, 0, 0));
      material.emissiveIntensity = 1;
      break;
  }
  if (base !== source && source.transparent) {
    material.transparent = true;
    material.opacity = source.opacity;
    material.transmission = 0;
  }
  return material;
}

export type TraceSource = {
  mesh?: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  matrix: THREE.Matrix4;
  materials: Array<THREE.Material | undefined>;
};

/** Merge meshes into one world-space indexed geometry with a per-vertex material
 * index (a vertex shared by two materials is duplicated). */
export function mergeTraceGeometry(
  sources: readonly TraceSource[],
  slot: (material: THREE.Material) => number,
) {
  type Range = { start: number; end: number; slot: number };
  const plans: Array<{ source: TraceSource; ranges: Range[] }> = [];
  let vertexTotal = 0,
    indexTotal = 0;
  let stamp = new Int32Array(0);
  let generation = 0;
  const marks: Int32Array[] = [];
  for (const source of sources) {
    const geometry = source.geometry;
    const position = geometry.getAttribute("position");
    const index = geometry.index;
    const total = index ? index.count : position.count;
    const groups = geometry.groups.length
      ? geometry.groups
      : [{ start: 0, count: total, materialIndex: 0 }];
    const ranges: Range[] = [];
    if (stamp.length < position.count) stamp = new Int32Array(position.count);
    for (const group of groups) {
      const material =
        source.materials[group.materialIndex ?? 0] ?? source.materials[0];
      if (!material || !material.visible) continue;
      const start = group.start,
        end = Math.min(total, group.start + group.count);
      const count = end - start - ((end - start) % 3);
      if (count <= 0) continue;
      generation++;
      for (let i = start; i < start + count; i++) {
        const vertex = index ? index.getX(i) : i;
        if (stamp[vertex] !== generation) {
          stamp[vertex] = generation;
          vertexTotal++;
        }
      }
      indexTotal += count;
      ranges.push({ start, end: start + count, slot: slot(material) });
    }
    plans.push({ source, ranges });
  }
  void marks;
  const positions = new Float32Array(vertexTotal * 3);
  const normals = new Float32Array(vertexTotal * 3);
  const materialIndex = new Uint32Array(vertexTotal);
  const indices = new Uint32Array(indexTotal);
  const remap = new Int32Array(stamp.length);
  const seen = new Int32Array(stamp.length);
  let nextVertex = 0,
    nextIndex = 0;
  const point = new THREE.Vector3(),
    normal = new THREE.Vector3(),
    normalMatrix = new THREE.Matrix3();
  generation = 0;
  for (const { source, ranges } of plans) {
    const geometry = source.geometry;
    const position = geometry.getAttribute("position");
    const normalAttribute = geometry.getAttribute("normal");
    const index = geometry.index;
    normalMatrix.getNormalMatrix(source.matrix);
    const flip = source.matrix.determinant() < 0;
    for (const range of ranges) {
      generation++;
      for (let i = range.start; i < range.end; i += 3) {
        for (let corner = 0; corner < 3; corner++) {
          // Mirrored instances reverse the winding to keep faces outward.
          const offset = flip && corner > 0 ? 3 - corner : corner;
          const vertex = index ? index.getX(i + offset) : i + offset;
          if (seen[vertex] !== generation) {
            seen[vertex] = generation;
            remap[vertex] = nextVertex;
            point
              .fromBufferAttribute(position, vertex)
              .applyMatrix4(source.matrix);
            positions.set([point.x, point.y, point.z], nextVertex * 3);
            if (normalAttribute) {
              normal
                .fromBufferAttribute(normalAttribute, vertex)
                .applyMatrix3(normalMatrix)
                .normalize();
              normals.set([normal.x, normal.y, normal.z], nextVertex * 3);
            }
            materialIndex[nextVertex] = range.slot;
            nextVertex++;
          }
          indices[nextIndex++] = remap[vertex];
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute(
    "materialIndex",
    new THREE.BufferAttribute(materialIndex, 1),
  );
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  // Faces without authored normals (raw geometry) get flat ones.
  if (sources.some((s) => !s.geometry.getAttribute("normal")))
    fillMissingNormals(geometry);
  return geometry;
}

function fillMissingNormals(geometry: THREE.BufferGeometry) {
  const normals = geometry.getAttribute("normal") as THREE.BufferAttribute;
  const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
  const index = geometry.index!;
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  for (let i = 0; i < index.count; i += 3) {
    const ia = index.getX(i),
      ib = index.getX(i + 1),
      ic = index.getX(i + 2);
    if (
      normals.getX(ia) !== 0 ||
      normals.getY(ia) !== 0 ||
      normals.getZ(ia) !== 0
    )
      continue;
    a.fromBufferAttribute(positions, ia);
    b.fromBufferAttribute(positions, ib);
    c.fromBufferAttribute(positions, ic);
    const n = b.sub(a).cross(c.sub(a)).normalize();
    for (const v of [ia, ib, ic]) normals.setXYZ(v, n.x, n.y, n.z);
  }
}

export type PhotoStage = {
  /** "studio": a seamless cove; "floor": a large floor under the background colour;
   * "scene": no generated stage, the caller traces its own ground (a scene
   * environment's objects flagged `userData.photoStage`). */
  backdrop: "studio" | "floor" | "scene";
  /** World-space bounds of the model. */
  bounds: THREE.Box3;
};

export type PhotoView = {
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  focusDistance: number;
  depthOfField: number;
  /** Camera azimuth around the model (radians); the studio lights follow it. */
  azimuth: number;
  width: number;
  height: number;
};

const bvhOptions = { strategy: SAH, maxLeafTris: 1, indirect: true };
/** Above this many triangles the BVH is built in a worker (all model scenes:
 * even a small model's build would block input for a few hundred ms on a phone). */
const WORKER_TRIANGLES = 2_000;

/** How the denoiser sees a traced material: its albedo, and whether it is in the
 * guides at all (glass and see-through parts show what is behind them). */
export function guideSlot(
  material: THREE.MeshPhysicalMaterial,
  frontOnly = false,
): GuideSlot {
  const seeThrough =
    material.transmission > 0 ||
    (material.transparent && material.opacity < 0.6);
  return {
    color: material.color.clone(),
    flag: seeThrough ? GUIDE_SKIP : frontOnly ? GUIDE_FRONT_ONLY : GUIDE_OPAQUE,
  };
}

/**
 * Progressive path tracer for photo stills. Owns the BVH, the trace materials,
 * the studio environment and the accumulation targets; dispose() frees them.
 */
export class PhotoTracer {
  private tracer: PathTracingRenderer;
  private material = new PhysicalPathTracingMaterial();
  private environment: THREE.DataTexture;
  private backgroundTexture?: THREE.DataTexture;
  private geometry?: THREE.BufferGeometry;
  private traceMaterials: THREE.MeshPhysicalMaterial[] = [];
  private stageMaterial = new THREE.MeshPhysicalMaterial({
    side: THREE.FrontSide,
  });
  private worker?: GenerateMeshBVHWorker;
  private workerFailed = false;
  private sceneKey: string | null = null;
  private backgroundKey = "";
  private building: Promise<boolean> | null = null;
  private buildEpoch = 0;
  private compileStarted = false;
  private compileStart = 0;
  private denoiser: PhotoDenoiser;
  /** Denoise presented stills (off for captures too large for its targets). */
  denoise = true;
  /** The presented (denoised) image and the sample count it shows. */
  private presented: { samples: number; texture: THREE.Texture } | null = null;
  /** Tone-mapped probes of the presented still at checkpoints (noise). */
  private probes = new Map<number, Float32Array>();
  /** Estimated RMS noise of the presented still, 8-bit display levels. */
  noise = NaN;
  triangles = 0;
  /** Milliseconds spent building the last trace scene (merge + BVH). */
  buildMs = 0;
  /** Milliseconds the tracing shader took to compile (first still only). */
  compileMs = 0;
  tilesPerFrame: number;
  constructor(
    private renderer: THREE.WebGLRenderer,
    readonly schedule: PhotoSchedule,
  ) {
    this.tracer = new PathTracingRenderer(renderer);
    this.tracer.material = this.material;
    // The library compiles for the canvas (its tone mapping and colour
    // space), but traces into a linear float target: a second, different
    // program. Compile for the target that is drawn to.
    const tracer = this.tracer as unknown as {
      compileMaterial(): Promise<unknown>;
      _fsQuad: { _mesh: THREE.Mesh };
      _primaryTarget: THREE.WebGLRenderTarget;
    };
    tracer.compileMaterial = () => {
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(tracer._primaryTarget);
      try {
        return renderer.compileAsync(tracer._fsQuad._mesh, new THREE.Camera());
      } finally {
        renderer.setRenderTarget(previous);
      }
    };
    this.tracer.tiles.set(...schedule.tiles);
    // Deterministic noise: the same view and sample count give the same image.
    this.tracer.stableNoise = true;
    this.tilesPerFrame = schedule.tilesPerFrame;
    this.material.bounces = schedule.bounces;
    this.material.transmissiveBounces = schedule.transmissiveBounces;
    this.material.filterGlossyFactor = 0.5;
    // Random numbers: size the tuple texture so every tuple the shader reads
    // exists, and replace the library's sampler (see photo-sampling.ts). The
    // texture keeps its sampler while its size is unchanged, and the tracer
    // asks for the library's size before every sample: clamp that request.
    const stratified = this.material.uniforms.stratifiedTexture.value as {
      init(count: number, depth: number): void;
      sampler: unknown;
      image: { data: Float32Array };
    };
    const highest = highestTupleIndex(this.material.fragmentShader);
    const init = stratified.init.bind(stratified);
    const bounces = this.material.bounces + this.material.transmissiveBounces;
    stratified.init = (count: number, depth: number) => {
      const size = tupleTextureSize({ count, depth }, highest, bounces);
      init(size.count, size.depth);
    };
    stratified.init(20, bounces + 5);
    stratified.sampler = new PhotoSampler(stratified.image.data);
    this.material.fragmentShader = decorrelatePixels(
      this.material.fragmentShader,
    );
    this.environment = equirectTexture(studioEnvironmentData(), 512, 256);
    this.material.envMapInfo.updateFrom(this.environment);
    this.material.environmentIntensity = 1;
    this.denoiser = new PhotoDenoiser(renderer);
  }
  /** Whether a trace scene for `key` is built. */
  hasScene(key: string) {
    return this.sceneKey === key && !this.building;
  }
  get compiling() {
    const compiling = this.tracer.isCompiling;
    if (!compiling && this.compileStart) {
      this.compileMs = performance.now() - this.compileStart;
      this.compileStart = 0;
    }
    return compiling;
  }
  get samples() {
    return this.tracer.samples;
  }
  get texture() {
    return this.tracer.target.texture;
  }
  get totalTiles() {
    return this.schedule.tiles[0] * this.schedule.tiles[1];
  }
  /**
   * Build (or keep) the trace scene: merged world-space geometry of the given
   * sources and the studio stage, then its BVH (in a worker for large scenes).
   * Resolves false if a newer prepare() superseded this one.
   */
  prepare(
    key: string,
    sources: () => TraceSource[],
    stage: PhotoStage,
  ): Promise<boolean> {
    if (this.sceneKey === key) return this.building ?? Promise.resolve(true);
    const epoch = ++this.buildEpoch;
    this.sceneKey = key;
    const start = performance.now();
    const materials: THREE.MeshPhysicalMaterial[] = [this.stageMaterial];
    const slots = new Map<THREE.Material, number>();
    const slot = (material: THREE.Material) => {
      let index = slots.get(material);
      if (index === undefined) {
        index = materials.length;
        materials.push(pathMaterial(material));
        slots.set(material, index);
      }
      return index;
    };
    const list = sources();
    const sphere = stage.bounds.isEmpty()
      ? new THREE.Sphere(new THREE.Vector3(), 80)
      : stage.bounds.getBoundingSphere(new THREE.Sphere());
    const backdrop =
      stage.backdrop === "scene"
        ? null
        : studioBackdropGeometry(
            sphere.center,
            sphere.radius,
            stage.bounds.isEmpty() ? 0 : stage.bounds.min.y - 0.02,
            stage.backdrop === "studio",
          );
    if (backdrop)
      list.push({
        geometry: backdrop,
        matrix: new THREE.Matrix4(),
        materials: [this.stageMaterial],
      });
    const geometry = mergeTraceGeometry(list, (material) =>
      material === this.stageMaterial ? 0 : slot(material),
    );
    backdrop?.dispose();
    const triangles = geometry.index!.count / 3;
    const finish = (bvh: MeshBVH) => {
      if (epoch !== this.buildEpoch) return false;
      this.install(geometry, bvh, materials);
      this.triangles = triangles;
      this.buildMs = performance.now() - start;
      return true;
    };
    const useWorker =
      triangles > WORKER_TRIANGLES &&
      !this.workerFailed &&
      typeof Worker !== "undefined";
    const promise: Promise<boolean> = useWorker
      ? this.buildInWorker(geometry).then(
          (bvh) => finish(bvh),
          () => {
            this.workerFailed = true;
            return finish(new MeshBVH(geometry, bvhOptions));
          },
        )
      : new Promise<boolean>((resolve, reject) =>
          // Yield once so the "Preparing photo" status can paint first.
          setTimeout(() => {
            try {
              resolve(finish(new MeshBVH(geometry, bvhOptions)));
            } catch (error) {
              reject(error);
            }
          }, 0),
        );
    const building = promise
      .catch((error) => {
        // A failed build must not pass for a built scene next time.
        if (epoch === this.buildEpoch) this.sceneKey = null;
        throw error;
      })
      .finally(() => {
        if (this.building === building) this.building = null;
      });
    this.building = building;
    return building;
  }
  private buildInWorker(geometry: THREE.BufferGeometry) {
    try {
      this.worker ??= new GenerateMeshBVHWorker();
      const worker = this.worker as unknown as {
        worker: Worker | null;
        runTask(
          worker: Worker,
          geometry: THREE.BufferGeometry,
          options: Record<string, unknown>,
        ): Promise<MeshBVH>;
      };
      if (!worker.worker) throw new Error("BVH worker unavailable");
      // The worker takes (transfers) the buffers it is given: send copies of the
      // positions and indices, and keep the originals for the tracer.
      const light = new THREE.BufferGeometry();
      light.setAttribute("position", geometry.getAttribute("position").clone());
      light.setIndex(geometry.index!.clone());
      // runTask directly: the wrapper's generate() leaves a dangling rejected
      // promise (an unhandled rejection) when the worker fails to start.
      return worker.runTask(worker.worker, light, bvhOptions).then((bvh) => {
        if (!light.index || light.index.array.byteLength === 0)
          light.setIndex(geometry.index);
        return bvh;
      });
    } catch (error) {
      return Promise.reject(error);
    }
  }
  private install(
    geometry: THREE.BufferGeometry,
    bvh: MeshBVH,
    materials: THREE.MeshPhysicalMaterial[],
  ) {
    this.geometry?.dispose();
    this.traceMaterials.forEach((m) => m !== this.stageMaterial && m.dispose());
    this.geometry = geometry;
    this.traceMaterials = materials;
    const count = geometry.getAttribute("position").count;
    // The tracer reads tangents, uvs and vertex colours, which LDraw parts lack.
    const tangent = new THREE.BufferAttribute(new Float32Array(count * 4), 4);
    const uv = new THREE.BufferAttribute(new Float32Array(count * 2), 2);
    const color = new THREE.BufferAttribute(
      new Float32Array(count * 4).fill(1),
      4,
    );
    const material = this.material;
    material.bvh.updateFrom(bvh);
    material.attributesArray.updateFrom(
      geometry.getAttribute("normal") as THREE.BufferAttribute,
      tangent,
      uv,
      color,
    );
    material.materialIndexAttribute.updateFrom(
      geometry.getAttribute("materialIndex") as THREE.BufferAttribute,
    );
    this.denoiser.setGeometry(
      geometry,
      materials.map((m) => guideSlot(m, m === this.stageMaterial)),
    );
    // Only the BVH's GPU copy is needed from here on; drop CPU-side copies.
    geometry.deleteAttribute("normal");
    geometry.deleteAttribute("materialIndex");
    material.materials.updateFrom(materials, []);
    material.lights.updateFrom([], []);
    this.reset();
  }
  /**
   * Background colour (linear) behind the stage, or null for a transparent image:
   * the floor and cove then still block and bounce light but are cut out of the
   * image. Returns whether anything changed (the caller resets the still).
   */
  setBackground(background: THREE.Color | null) {
    const key = background ? background.getHexString() : "transparent";
    if (key === this.backgroundKey) return false;
    this.backgroundKey = key;
    const transparent = background === null;
    const stageMaterial = this.stageMaterial;
    // A light sweep tinted towards the background, with a soft sheen.
    stageMaterial.color
      .copy(background ?? new THREE.Color(1, 1, 1))
      .lerp(new THREE.Color(0.62, 0.62, 0.6), 0.35);
    stageMaterial.roughness = 0.42;
    stageMaterial.metalness = 0;
    stageMaterial.specularIntensity = 0.6;
    (stageMaterial as unknown as { matte: boolean }).matte = transparent;
    const material = this.material;
    // Always bind a background map (black when transparent) so switching between
    // solid and transparent captures does not recompile the tracing shader.
    const fill = background ?? new THREE.Color(0, 0, 0);
    const data = new Float32Array(4 * 2 * 4);
    for (let i = 0; i < 8; i++) data.set([fill.r, fill.g, fill.b, 1], i * 4);
    this.backgroundTexture?.dispose();
    this.backgroundTexture = equirectTexture(data, 4, 2);
    material.backgroundMap = this.backgroundTexture;
    material.backgroundAlpha = transparent ? 0 : 1;
    // Manual alpha blending when the image has transparency or float blending is
    // unavailable (mirrors WebGLPathTracer).
    this.tracer.alpha =
      transparent || !this.renderer.extensions.has("EXT_float_blend");
    if (this.traceMaterials.length) {
      material.materials.updateFrom(this.traceMaterials, []);
      this.denoiser.setSlot(0, guideSlot(stageMaterial, true));
    }
    this.reset();
    return true;
  }
  /** Point the tracer at a view; call reset() when it changed. */
  setView(view: PhotoView) {
    const width = Math.max(1, Math.round(view.width)),
      height = Math.max(1, Math.round(view.height));
    this.tracer.setSize(width, height);
    view.camera.updateMatrixWorld();
    this.tracer.setCamera(view.camera);
    const lens = photoLens(view.focusDistance, view.depthOfField);
    const perspective = (view.camera as THREE.PerspectiveCamera)
      .isPerspectiveCamera;
    const physical = this.material.physicalCamera;
    physical.focusDistance = lens.focusDistance;
    // bokehSize is the aperture diameter in millimetres of a metre-scale scene;
    // the shader scales it by 0.5e-3 to a radius in world units. A tiny, non-zero
    // aperture keeps the depth-of-field shader variant (no recompilation).
    physical.bokehSize = Math.max(
      1e-4,
      perspective ? lens.apertureRadius / 0.5e-3 : 0,
    );
    physical.apertureBlades = 6;
    physical.apertureRotation = 0.3;
    physical.anamorphicRatio = 1;
    this.material.environmentRotation.makeRotationY(view.azimuth).invert();
    if (this.denoise) {
      // Blur radius in pixels of a point at infinity: aperture radius over
      // the size of a pixel on the focus plane.
      const fov = (view.camera as THREE.PerspectiveCamera).fov ?? 45;
      const pixel =
        (2 * lens.focusDistance * Math.tan(THREE.MathUtils.degToRad(fov) / 2)) /
        height;
      this.denoiser.setLens(
        lens.focusDistance,
        perspective ? lens.apertureRadius / pixel : 0,
      );
      this.denoiser.setSize(width, height);
      this.denoiser.renderGuides(view.camera);
    } else this.denoiser.releaseTargets();
  }
  reset() {
    this.tracer.reset();
    this.denoiser.reset();
    this.presented = null;
    this.probes.clear();
    this.noise = NaN;
    // Restart the seeded sampler (photo-sampling.ts): the same view and sample
    // count then trace the same image (repeatable captures).
    const stratified = (
      this.material.uniforms.stratifiedTexture as {
        value: { reset(): void };
      }
    ).value;
    stratified.reset();
  }
  /** Start compiling the tracing shader for a camera and background before the
   * scene is built (the shader's variant depends only on them). */
  compileFor(
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
    background: THREE.Color | null,
  ) {
    if (this.compileStarted) return;
    this.setBackground(background);
    camera.updateMatrixWorld();
    this.tracer.setCamera(camera);
    // The depth-of-field variant is always compiled (see setView).
    const physical = this.material.physicalCamera;
    physical.bokehSize = Math.max(1e-4, physical.bokehSize);
    this.compile();
  }
  /** Start compiling the tracing shader (asynchronously where supported). */
  compile() {
    if (this.compileStarted) return;
    this.compileStarted = true;
    this.compileStart = performance.now();
    // Settle the shader's defines first, without compiling after each one:
    // the library compiles on every define change, which linked three
    // variants of the 115 KB shader before the one used (each one is the
    // slow part of a first still, seconds on a phone).
    const material = this.material;
    const dispatch = material.dispatchEvent;
    material.dispatchEvent = () => {};
    try {
      (material as unknown as { onBeforeRender(): void }).onBeforeRender();
    } finally {
      material.dispatchEvent = dispatch;
    }
    // One compile, through the asynchronous path (KHR_parallel_shader_compile
    // where available), of the variant that is drawn (see the constructor).
    material.needsUpdate = true;
    this.tracer.update();
  }
  /** Trace `tiles` tiles (a full sample is totalTiles tiles). */
  step(tiles = this.tilesPerFrame) {
    if (!this.primed) {
      // The first traced tile after compilation can still switch a shader
      // variant and leaves a biased (darker) accumulation behind: trace one
      // throwaway tile, then start clean. Later stills skip this.
      this.tracer.update();
      if (this.tracer.isCompiling) return;
      this.sync();
      this.primed = true;
      this.reset();
    }
    for (let i = 0; i < tiles; i++) {
      this.tracer.update();
      if (this.tracer.isCompiling) return;
      const samples = this.tracer.samples;
      if (this.denoise && this.denoiser.wantsSnapshot(samples))
        this.denoiser.snapshot(this.texture, samples);
      // Stop at a noise checkpoint so the caller presents (and measures) it.
      if (isNoiseCheckpoint(samples)) return;
    }
  }
  /**
   * The still to present: the accumulation, denoised. At noise checkpoints the
   * presented image is also probed and compared with an earlier checkpoint
   * (estimateNoise), which updates `noise`.
   */
  image(): THREE.Texture {
    if (!this.denoise) return this.texture;
    // Denoised once per whole sample: between them (a sample traced in
    // tiles over several frames) the last one is shown.
    const samples = this.tracer.samples;
    const whole = Math.floor(samples);
    if (this.presented?.samples === whole) return this.presented.texture;
    const texture = this.denoiser.denoise(this.texture, Math.max(1, whole));
    this.presented = { samples: whole, texture };
    if (isNoiseCheckpoint(samples) && !this.probes.has(samples)) {
      const probe = this.denoiser.probe(
        texture,
        this.renderer.toneMapping,
        this.renderer.toneMappingExposure,
      );
      let earlier = 0;
      for (const n of this.probes.keys())
        if (n * 2 <= samples && n > earlier) earlier = n;
      if (earlier)
        this.noise = estimateNoise(
          this.probes.get(earlier)!,
          probe,
          earlier,
          samples,
        );
      this.probes.set(samples, probe);
      // Later checkpoints compare with this one or a later one.
      for (const n of [...this.probes.keys()])
        if (n < earlier) this.probes.delete(n);
    }
    return texture;
  }
  /**
   * Wait for the traced tiles to finish on the GPU (a one-pixel readback). Called
   * once per refinement frame so tiles never queue up ahead of the GPU: input
   * stays responsive, and the frame interval measures real tracing cost.
   */
  sync() {
    const target = this.tracer.target;
    if (target.width < 1 || target.height < 1) return;
    this.renderer.readRenderTargetPixels(target, 0, 0, 1, 1, this.syncPixel);
  }
  private syncPixel = new Float32Array(4);
  private primed = false;
  /** Trace whole samples (captures). */
  sample(count = 1) {
    this.step(count * this.totalTiles);
  }
  releaseScene() {
    this.presented = null;
    this.buildEpoch++;
    this.building = null;
    this.sceneKey = null;
    this.geometry?.dispose();
    this.geometry = undefined;
  }
  /**
   * Free the model's BVH, vertex textures and the accumulation targets, but keep
   * the compiled tracing shader, so a later photo still or capture does not pay
   * for compilation again (the look left photo, or a one-off photo capture).
   */
  trim() {
    this.releaseScene();
    const backdrop = studioBackdropGeometry(new THREE.Vector3(), 40, 0, false);
    const geometry = mergeTraceGeometry(
      [
        {
          geometry: backdrop,
          matrix: new THREE.Matrix4(),
          materials: [this.stageMaterial],
        },
      ],
      () => 0,
    );
    backdrop.dispose();
    this.install(geometry, new MeshBVH(geometry, bvhOptions), [
      this.stageMaterial,
    ]);
    this.triangles = 0;
    this.tracer.setSize(1, 1);
    this.denoiser.releaseTargets();
  }
  dispose() {
    this.releaseScene();
    this.denoiser.dispose();
    this.worker?.dispose();
    this.worker = undefined;
    this.traceMaterials.forEach((m) => m.dispose());
    this.stageMaterial.dispose();
    this.environment.dispose();
    this.backgroundTexture?.dispose();
    this.tracer.dispose();
    this.material.dispose();
    const uniforms = this.material.uniforms as Record<
      string,
      { value: { dispose?: () => void } | null }
    >;
    for (const key of [
      "attributesArray",
      "materialIndexAttribute",
      "materials",
      "textures",
      "iesProfiles",
      "stratifiedOffsetTexture",
    ])
      uniforms[key]?.value?.dispose?.();
    this.material.envMapInfo.dispose();
    const bvh = uniforms.bvh?.value as unknown as Record<
      string,
      { dispose?: () => void }
    > | null;
    if (bvh) for (const value of Object.values(bvh)) value?.dispose?.();
  }
}
