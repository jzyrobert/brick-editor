import * as THREE from "three";
import { ensure } from "../core/types";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { IdSource } from "./region-selection";
import type { DrawableTemplate, OccurrenceHandle } from "./occurrence-handles";

/** Transform conditional-line control points and vectors along with ordinary geometry. */
export function transformLineGeometry(
  source: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
) {
  const geometry = source.clone();
  geometry.applyMatrix4(matrix);
  for (const name of ["control0", "control1"]) {
    const attribute = geometry.getAttribute(name);
    if (attribute) attribute.applyMatrix4(matrix);
  }
  const direction = geometry.getAttribute("direction");
  if (direction) {
    const linear = new THREE.Matrix3().setFromMatrix4(matrix);
    const vector = new THREE.Vector3();
    for (let i = 0; i < direction.count; i++) {
      vector.fromBufferAttribute(direction, i).applyMatrix3(linear);
      direction.setXYZ(i, vector.x, vector.y, vector.z);
    }
  }
  return geometry;
}

/** Bake affine meshes without changing source geometry. Three normally flips front-face
 * state for reflected object matrices; after baking we must reverse each triangle. */
export function transformTriangleGeometry(
  source: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
) {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  geometry.applyMatrix4(matrix);
  if (matrix.determinant() < 0) {
    for (const attribute of Object.values(geometry.attributes)) {
      const buffer = attribute as THREE.BufferAttribute;
      for (let vertex = 0; vertex + 2 < buffer.count; vertex += 3) {
        for (let component = 0; component < buffer.itemSize; component++) {
          const a = (vertex + 1) * buffer.itemSize + component;
          const b = (vertex + 2) * buffer.itemSize + component;
          const value = buffer.array[a];
          buffer.array[a] = buffer.array[b];
          buffer.array[b] = value;
        }
      }
    }
  }
  return geometry;
}

/**
 * LDraw conditional lines test their control points in clip space. Instanced
 * drawing must move the endpoints, direction and control points with the same
 * instance matrix, so the shader applies `instanceMatrix` to each point before
 * `modelViewMatrix` when (and only when) three compiles it for an instanced
 * object. Non-instanced draws of the same material are unchanged. Returns false
 * when the shader is not the expected loader shader (callers then merge).
 */
export function supportsInstancedLines(material: THREE.Material): boolean {
  const shader = material as THREE.ShaderMaterial;
  if (!shader.isShaderMaterial)
    return !!(material as THREE.LineBasicMaterial).isLineBasicMaterial;
  if (shader.userData.instancedLines !== undefined)
    return shader.userData.instancedLines;
  const source = shader.vertexShader;
  const pattern = /modelViewMatrix \* vec4\( ([^;]*?), 1\.0 \)/g;
  const matches = source.match(pattern)?.length ?? 0;
  const ok =
    source.includes("attribute vec3 control0;") &&
    source.includes("void main()") &&
    matches === 5 &&
    !/\bmodelViewMatrix\b(?! \* vec4\()/.test(source.split("void main()")[1]);
  shader.userData.instancedLines = ok;
  if (!ok) return false;
  shader.vertexShader = source
    .replace(
      "void main()",
      [
        "#ifdef USE_INSTANCING",
        "#define LDRAW_INSTANCE( v ) ( instanceMatrix * ( v ) )",
        "#else",
        "#define LDRAW_INSTANCE( v ) ( v )",
        "#endif",
        "void main()",
      ].join("\n"),
    )
    .replace(pattern, "modelViewMatrix * LDRAW_INSTANCE( vec4( $1, 1.0 ) )");
  shader.needsUpdate = true;
  return true;
}

/**
 * A LineSegments drawn with three's instanced path: the renderer binds
 * `instanceMatrix` and issues one instanced draw for objects flagged
 * `isInstancedMesh`, whatever their primitive mode. Line materials apply the
 * instance matrix through three's `project_vertex` chunk (basic line material)
 * or `supportsInstancedLines` (conditional lines).
 */
export type InstancedLineSegments = THREE.LineSegments & {
  isInstancedMesh: true;
  instanceMatrix: THREE.InstancedBufferAttribute;
  instanceColor: null;
  morphTexture: null;
  count: number;
  boundingSphere: THREE.Sphere;
};
export function instancedLineSegments(
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  matrices: THREE.Matrix4[],
): InstancedLineSegments {
  const lines = new THREE.LineSegments(
    geometry,
    material,
  ) as InstancedLineSegments;
  const array = new Float32Array(matrices.length * 16);
  matrices.forEach((m, i) => m.toArray(array, i * 16));
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  const local = geometry.boundingSphere!;
  const bounds = new THREE.Box3();
  const sphere = new THREE.Sphere();
  for (const m of matrices) {
    sphere.copy(local).applyMatrix4(m);
    bounds.expandByPoint(sphere.center.clone().addScalar(sphere.radius));
    bounds.expandByPoint(sphere.center.clone().subScalar(sphere.radius));
  }
  Object.assign(lines, {
    isInstancedMesh: true,
    instanceMatrix: new THREE.InstancedBufferAttribute(array, 16),
    instanceColor: null,
    morphTexture: null,
    count: matrices.length,
    boundingSphere: bounds.getBoundingSphere(new THREE.Sphere()),
  });
  return lines;
}

export const RAW_BATCH_LIMITS = Object.freeze({
  chunkVertices: 65536,
  vertices: 2_000_000,
  bytes: 128 * 1024 * 1024,
});

function rawLayout(geometry: THREE.BufferGeometry) {
  return Object.entries(geometry.attributes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, attribute]) =>
      [
        name,
        attribute.itemSize,
        attribute.normalized,
        attribute.array.constructor.name,
      ].join("/"),
    )
    .join("|");
}

/** Three's instanced normal path does not represent arbitrary shear or reflection. */
export function canInstanceMatrix(matrix: THREE.Matrix4) {
  if (matrix.determinant() <= 1e-12) return false;
  const e = matrix.elements;
  const x = Math.hypot(e[0], e[1], e[2]),
    y = Math.hypot(e[4], e[5], e[6]),
    z = Math.hypot(e[8], e[9], e[10]);
  const scale = Math.max(x * y, x * z, y * z, 1);
  return (
    Math.max(
      Math.abs(e[0] * e[4] + e[1] * e[5] + e[2] * e[6]),
      Math.abs(e[0] * e[8] + e[1] * e[9] + e[2] * e[10]),
      Math.abs(e[4] * e[8] + e[5] * e[9] + e[6] * e[10]),
    ) <=
    1e-8 * scale
  );
}

type Drawable = THREE.Mesh | THREE.LineSegments;
type Materials = THREE.Material | THREE.Material[];

/**
 * View treatments (layer ghosting, instruction dimming) swap a handle's shared
 * material for a temporary clone. The batches key their structure on the
 * clone's base material, so applying or removing a treatment only refills
 * instance arrays instead of rebuilding every batch.
 */
const treatmentBases = new WeakMap<THREE.Material, THREE.Material>();
export function registerTreatment(
  clone: THREE.Material,
  original: THREE.Material,
) {
  treatmentBases.set(clone, treatmentBase(original));
}
export function treatmentBase(material: THREE.Material): THREE.Material {
  return treatmentBases.get(material) ?? material;
}
/** A temporary treatment (ghosted layer or floor, dimmed step) is in use. */
export function isTreated(material: THREE.Material) {
  return treatmentBases.has(material);
}
const firstMaterial = (materials: Materials) =>
  Array.isArray(materials) ? materials[0] : materials;
const materialList = (materials: Materials) =>
  Array.isArray(materials) ? materials : [materials];

/** What classifying a template needs that does not depend on the occurrence
 * (computed once per prototype drawable, not once per slot). */
type TemplateInfo = {
  material: Materials;
  geometry: THREE.BufferGeometry;
  opaque: boolean;
  /** Bakeable apart from the occurrence matrix's determinant. */
  bakeable: boolean;
  linesInstanceable: boolean;
  /** Bucket key of an instanceable slot. */
  key: string;
};
const templateInfos = new WeakMap<DrawableTemplate, TemplateInfo>();
function opaque(materials: Materials) {
  if (!Array.isArray(materials)) return !treatmentBase(materials).transparent;
  for (const m of materials) if (treatmentBase(m).transparent) return false;
  return true;
}
function templateInfo(template: DrawableTemplate): TemplateInfo {
  const drawable = template.object;
  let info = templateInfos.get(template);
  if (
    info &&
    info.material === drawable.material &&
    info.geometry === drawable.geometry &&
    info.opaque === opaque(drawable.material)
  )
    return info;
  const bases = materialList(drawable.material).map(treatmentBase);
  const geometry = drawable.geometry;
  info = {
    material: drawable.material,
    geometry,
    opaque: opaque(drawable.material),
    bakeable:
      bases.every((m) => !m.transparent) &&
      Object.values(geometry.attributes).every(
        (a) =>
          !(a as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute,
      ) &&
      Object.keys(geometry.morphAttributes).length === 0 &&
      geometry.drawRange.start === 0 &&
      geometry.drawRange.count === Infinity,
    linesInstanceable: !template.mesh && bases.every(supportsInstancedLines),
    key: [
      template.mesh ? "mesh" : "line",
      geometry.uuid,
      ...bases.map((m) => m.uuid),
      drawable.renderOrder,
    ].join(":"),
  };
  templateInfos.set(template, info);
  return info;
}
/** A drawable of an occurrence handle, as the batches classified it. */
type Slot = {
  /** The prototype's drawable (geometry, base material, render order). */
  object: Drawable;
  template: DrawableTemplate;
  handle: OccurrenceHandle;
  occurrenceId: string;
  /** Baked only as a draw-call optimization; may still render unmerged. */
  optional?: boolean;
};
/** Same materials (treatments return a fresh array for multi-material drawables). */
function sameMaterials(a: Materials | undefined, b: Materials) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
    return false;
  return a.every((m, i) => m === b[i]);
}

/** A baked (merged) slot with its matrix and drawn materials. */
type RawEntry = Slot & {
  matrix: THREE.Matrix4;
  materials: Materials;
  castShadow: boolean;
};

/** Instanced draw of one bucket under one treatment (material set). */
type InstancedDraw = (THREE.InstancedMesh | InstancedLineSegments) & {
  userData: { occurrenceIds: string[] };
};

/** Slots drawn together: a whole bucket, or one spatial cell of it. Its
 * draws are allocated once with room for every slot. */
type SlotGroup = {
  lines: boolean;
  slots: Slot[];
  /** One draw per treatment in use (untreated, ghosted, dimmed …). */
  draws: InstancedDraw[];
};

/**
 * Repeated geometry + base material(s) + render order. Visibility, treatment,
 * transform and section changes only rewrite instance matrices and counts.
 */
type Bucket = SlotGroup & {
  /** A bucket of one slot draws a plain copy instead (exact sorting). */
  single?: Drawable;
  /** The same slots split by spatial cell (large buckets only), drawn
   * instead of the whole bucket while cells are in use. */
  cells?: SlotGroup[];
};

export type BatchOptions = {
  /** Split buckets that span several cells of this size (parent-space units,
   * LDU) into one draw per cell, so frustum culling and transparent sorting
   * work per region. 0 disables (unless `adaptiveCells`). */
  cellSize: number;
  /** Only buckets with at least this many slots are split into cells. */
  cellMinSlots: number;
  /**
   * Also prepare cells (sized from the model's extent when `cellSize` is 0),
   * but draw them only while setCellsActive(true): cells multiply draw calls
   * in whole-model views and pay off when most of the model is outside the
   * view (Play, a camera inside the model).
   */
  adaptiveCells: boolean;
};

export const DEFAULT_BATCH_OPTIONS: Readonly<BatchOptions> = Object.freeze({
  cellSize: 0,
  cellMinSlots: 64,
  adaptiveCells: false,
});

/** Adaptive cells: the model's largest extent spans about this many cells,
 * none smaller than MIN_CELL_LDU. */
export const ADAPTIVE_CELLS_ACROSS = 6;
/** Adaptive cells split only buckets drawing at least this many triangles
 * (or line segments) in all: culling small buckets saves less than their
 * extra draw calls cost. */
export const ADAPTIVE_CELL_MIN_PRIMITIVES = 16384;
/** Adaptive cells split buckets (heaviest first) into at most this many
 * cell groups in all. */
export const MAX_CELL_GROUPS = 1024;
/** Longest a deferred rebuild keeps drawing the previous fill. */
const MAX_DEFER_MS = 3000;
export const MIN_CELL_LDU = 160;

const scratchMatrix = new THREE.Matrix4();
const scratchSphere = new THREE.Sphere();
const scratchPlane = new THREE.Plane();
const scratchVector = new THREE.Vector3();
const scratchFrustum = new THREE.Frustum();

/**
 * A render-only cache of occurrence handles (lightweight records, see
 * occurrence-handles.ts), which stay authoritative for picking, selection,
 * collider extraction and export. Add `root` under the model root the handle
 * matrices are relative to, and use render() for every draw/capture.
 *
 * rebuild() is required after the handle set, prototypes or the dynamic set
 * change. Everything else — handle visibility (steps, floor focus), the edge
 * mode, treatments (ghosting, dimming) and handle matrices (explode) — is
 * applied by refilling the existing instance arrays: call refresh(), or just
 * change handle visibility, which is detected per frame. Dynamic handles are
 * not batched; their owner draws them (materialized trees).
 */
export class RenderBatches {
  readonly root = new THREE.Group();
  private handles = new Map<string, OccurrenceHandle>();
  /** Handles drawn through the batches, in `handles` order. */
  private batched: Array<[string, OccurrenceHandle]> = [];
  /** Occurrences drawn live from their own handles (moving transient poses). */
  private dynamic = new Set<string>();
  /** Visibility of `batched` when the batches were last filled; undefined = stale. */
  private builtVisibility?: Uint8Array;
  private scratchVisibility = new Uint8Array(0);
  private structureStale = true;
  private fillStale = true;
  private buckets: Bucket[] = [];
  /** Instanced line draws (hidden, without a refill, while the view moves). */
  private lineDraws: InstancedDraw[] = [];
  /** Single-copy lines; `userData.filled` is their visibility at rest. */
  private lineSingles: Drawable[] = [];
  /** Baked section: raw primitives and sheared/reflected opaque drawables. */
  private rawSlots: Slot[] = [];
  private rawState = new Float32Array(0);
  private rawMaterials: Materials[] = [];
  private rawObjects: THREE.Object3D[] = [];
  private generated: THREE.BufferGeometry[] = [];
  private linesSuppressed = false;
  private clipPlane: THREE.Plane | null = null;
  private options: BatchOptions;
  private cellsActive = false;
  /** Cell size of the current structure (0: no cells). */
  private builtCellSize = 0;
  private counters = { structures: 0, fills: 0, rawMerges: 0, drawables: 0 };
  constructor(options: Partial<BatchOptions> = {}) {
    this.root.name = "render-only occurrence batches";
    this.options = { ...DEFAULT_BATCH_OPTIONS, ...options };
  }
  rebuild(
    handles:
      | ReadonlyMap<string, OccurrenceHandle>
      | Iterable<[string, OccurrenceHandle]>,
    options: { defer?: boolean } = {},
  ) {
    // Deferred: frames keep drawing the previous instance arrays until
    // prepare() (bounded, in case the owner never calls it).
    this.deferredUntil = options.defer ? performance.now() + MAX_DEFER_MS : 0;
    this.handles = new Map(handles);
    this.batched = [...this.handles].filter(([id]) => !this.dynamic.has(id));
    this.builtVisibility = undefined;
    this.structureStale = true;
    // A deferred rebuild keeps the old draws on screen until it is built.
    if (!options.defer) this.clear();
  }
  /** Draw large buckets per spatial cell (adaptive cells only). Switching
   * refills the instance arrays; nothing is rebuilt. */
  setCellsActive(active: boolean) {
    if (this.cellsActive === active) return false;
    this.cellsActive = active;
    if (this.options.adaptiveCells && this.builtCellSize > 0)
      this.fillStale = true;
    return true;
  }
  /** Whether large buckets are drawn per cell right now. */
  get cellsInUse() {
    return (
      this.builtCellSize > 0 &&
      (!this.options.adaptiveCells || this.cellsActive)
    );
  }
  /** Classify now (keeping a deferred rebuild's old draws until prepare()),
   * so a caller can split classification and filling into separate tasks. */
  build() {
    if (this.structureStale) this.buildStructure();
  }
  /** Classify and fill now (what the next draw would do first), so a caller
   * can do it in a task of its own ahead of the frame. */
  prepare(decideCells?: () => boolean) {
    this.deferredUntil = 0;
    // Classify first, so the cell decision (culledShare) sees the new
    // structure and the one fill already draws what the next frame needs.
    if (this.structureStale) this.buildStructure();
    if (decideCells) this.setCellsActive(decideCells());
    this.synchronize();
  }
  /** A rebuild waits for prepare(): until then draws reuse the last fill. */
  private deferredUntil = 0;
  /** Whether `root` still holds the draws of a structure being replaced. */
  get deferred() {
    return this.deferredUntil > 0 && this.structureStale;
  }
  /** Visibility, treatment materials or transforms of existing handles changed:
   * refill the instance arrays on the next draw (no new GPU objects). */
  refresh() {
    this.fillStale = true;
  }
  /**
   * Leave these occurrences out of the batches: their owner draws them live
   * (materialized), so a moving pose only updates their matrices. Changing the
   * set rebuilds once.
   */
  setDynamic(ids: Iterable<string>) {
    const next = new Set(ids);
    if (
      next.size === this.dynamic.size &&
      [...next].every((id) => this.dynamic.has(id))
    )
      return false;
    this.dynamic = next;
    this.rebuild(this.handles);
    return true;
  }
  get dynamicIds(): ReadonlySet<string> {
    return this.dynamic;
  }
  /** Hide (or restore) instanced lines without refilling anything: the
   * interactive view drops edges while it moves. Captures never set this. */
  setLinesSuppressed(suppressed: boolean) {
    this.linesSuppressed = suppressed;
  }
  get linesHidden() {
    return this.linesSuppressed;
  }
  /** Skip instances wholly on the clipped side of a world-space section plane
   * (the renderer's clipping still cuts the parts that straddle it). */
  setClipPlane(plane: THREE.Plane | null) {
    const same =
      plane && this.clipPlane
        ? plane.normal.equals(this.clipPlane.normal) &&
          plane.constant === this.clipPlane.constant
        : plane === this.clipPlane;
    if (same) return;
    this.clipPlane = plane && plane.clone();
    this.fillStale = true;
  }
  /** Exact per-frame check without allocating: handle visibility drives the fill. */
  private visibilityChanged() {
    const count = this.batched.length;
    if (this.scratchVisibility.length !== count)
      this.scratchVisibility = new Uint8Array(count);
    const current = this.scratchVisibility,
      built = this.builtVisibility;
    let changed = !built || built.length !== count;
    for (let i = 0; i < count; i++) {
      const visible = this.batched[i][1].visible ? 1 : 0;
      current[i] = visible;
      if (!changed && built![i] !== visible) changed = true;
    }
    return changed;
  }
  private clearRaw() {
    for (const object of this.rawObjects) object.removeFromParent();
    for (const geometry of this.generated) geometry.dispose();
    this.rawObjects = [];
    this.generated = [];
  }
  private clear(keepDraws = false) {
    this.clearRaw();
    for (const bucket of this.buckets)
      for (const group of [bucket, ...(bucket.cells ?? [])])
        for (const draw of group.draws) {
          // A rebuild reuses draws of the same geometry (their objects and
          // instance buffers) instead of allocating them again.
          if (keepDraws) {
            const key = (group.lines ? "l:" : "m:") + draw.geometry.uuid;
            const list = this.pool.get(key);
            if (list) list.push(draw);
            else this.pool.set(key, [draw]);
          } else RenderBatches.disposeDraw(draw);
        }
    if (!keepDraws) this.drainPool();
    this.root.clear();
    this.buckets = [];
    this.lineDraws = [];
    this.lineSingles = [];
    this.rawSlots = [];
    this.rawState = new Float32Array(0);
    this.rawMaterials = [];
  }
  /** Classify every drawable of every batched handle, visible or not. */
  private buildStructure() {
    this.structureStale = false;
    this.fillStale = true;
    this.counters.structures++;
    this.clear(true);
    this.poolOpen = true;
    const keyed = new Map<string, Slot[]>();
    /** Parent-space position of each instanceable slot, for cells. */
    const positions = new Map<Slot, [number, number, number]>();
    const extent = new THREE.Box3();
    for (const [occurrenceId, handle] of this.batched) {
      const raw = handle.rawPrimitive;
      for (const template of handle.drawables) {
        const drawable = template.object;
        const slot: Slot = {
          object: drawable,
          template,
          handle,
          occurrenceId,
        };
        const matrix = handle.drawableMatrix(template, null, scratchMatrix);
        const info = templateInfo(template);
        const mesh = template.mesh;
        const bakeable =
          info.bakeable && Math.abs(matrix.determinant()) > 1e-12;
        const instanceable = mesh
          ? canInstanceMatrix(matrix)
          : info.linesInstanceable;
        // Raw primitives, and opaque drawables instancing cannot represent
        // (sheared/reflected meshes, custom line shaders), are baked into
        // merged batches instead of one draw each.
        if (bakeable && (raw || !instanceable)) {
          slot.optional = !raw;
          this.rawSlots.push(slot);
          continue;
        }
        const key = !instanceable
          ? "single:" + occurrenceId + ":" + drawable.uuid
          : info.key;
        if (instanceable) {
          const e = matrix.elements;
          positions.set(slot, [e[12], e[13], e[14]]);
          extent.expandByPoint(scratchVector.set(e[12], e[13], e[14]));
        }
        const slots = keyed.get(key);
        if (slots) slots.push(slot);
        else keyed.set(key, [slot]);
      }
    }
    let cellSize = this.options.cellSize;
    if (cellSize <= 0 && this.options.adaptiveCells && !extent.isEmpty()) {
      const size = extent.getSize(scratchVector);
      cellSize = Math.max(
        MIN_CELL_LDU,
        Math.max(size.x, size.y, size.z) / ADAPTIVE_CELLS_ACROSS,
      );
    }
    this.builtCellSize = 0;
    const regions = new Map<string, { box: THREE.Box3; weight: number }>();
    const candidates: Array<{
      bucket: Bucket;
      cells: Map<string, Slot[]>;
      perInstance: number;
      weight: number;
    }> = [];
    for (const slots of keyed.values()) {
      const lines = !(slots[0].object as THREE.Mesh).isMesh;
      const bucket: Bucket = { lines, slots, draws: [] };
      // Cells only for large buckets: small ones stay one draw however
      // spread, and adaptive cells only split buckets with enough primitives
      // for culling to outweigh the extra draws.
      const geometry = slots[0].object.geometry;
      const perInstance = lines
        ? (geometry.index?.count ??
            geometry.getAttribute("position")?.count ??
            0) / 2
        : (geometry.index?.count ??
            geometry.getAttribute("position")?.count ??
            0) / 3;
      if (
        cellSize > 0 &&
        slots.length >= this.options.cellMinSlots &&
        positions.has(slots[0]) &&
        (!this.options.adaptiveCells ||
          slots.length * perInstance >= ADAPTIVE_CELL_MIN_PRIMITIVES)
      ) {
        const cells = new Map<string, Slot[]>();
        for (const slot of slots) {
          const p = positions.get(slot)!;
          const key =
            Math.floor(p[0] / cellSize) +
            "," +
            Math.floor(p[1] / cellSize) +
            "," +
            Math.floor(p[2] / cellSize);
          const cell = cells.get(key);
          if (cell) cell.push(slot);
          else cells.set(key, [slot]);
        }
        if (cells.size > 1)
          candidates.push({
            bucket,
            cells,
            perInstance,
            weight: slots.length * perInstance,
          });
      }
      if (slots.length === 1) {
        const copy = slots[0].object.clone(false) as Drawable;
        copy.matrixAutoUpdate = false;
        copy.userData = {
          ...copy.userData,
          occurrenceId: slots[0].occurrenceId,
        };
        copy.visible = false;
        if (lines) this.lineSingles.push(copy);
        bucket.single = copy;
        this.root.add(copy);
      }
      this.buckets.push(bucket);
    }
    // The heaviest buckets are split first, up to a bounded number of cell
    // groups: every split group is an extra draw (and more with treatments).
    let groups = 0;
    candidates.sort((a, b) => b.weight - a.weight);
    for (const { bucket, cells, perInstance } of candidates) {
      if (this.options.adaptiveCells && groups + cells.size > MAX_CELL_GROUPS)
        continue;
      groups += cells.size;
      const geometry = bucket.slots[0].object.geometry;
      if (!geometry.boundingSphere) geometry.computeBoundingSphere();
      const radius = geometry.boundingSphere!.radius;
      bucket.cells = [];
      for (const [key, slots] of cells) {
        bucket.cells.push({ lines: bucket.lines, slots, draws: [] });
        // What each grid cell holds, for culledShare().
        let region = regions.get(key);
        if (!region)
          regions.set(key, (region = { box: new THREE.Box3(), weight: 0 }));
        for (const slot of slots) {
          const p = positions.get(slot)!;
          region.box.expandByPoint(
            scratchVector.set(p[0] - radius, p[1] - radius, p[2] - radius),
          );
          region.box.expandByPoint(
            scratchVector.set(p[0] + radius, p[1] + radius, p[2] + radius),
          );
          region.weight += perInstance;
        }
      }
      this.builtCellSize = cellSize;
    }
    this.rawState = new Float32Array(this.rawSlots.length * 17).fill(NaN);
    this.rawMaterials = new Array(this.rawSlots.length);
    this.regions = this.builtCellSize > 0 ? [...regions.values()] : [];
  }
  /** Occupied grid cells of the split buckets, with the primitives they hold
   * (parent space). */
  private regions: Array<{ box: THREE.Box3; weight: number }> = [];
  /**
   * The share (0–1) of the split buckets' primitives in grid cells wholly
   * outside `camera`'s view: what drawing per cell would cull. 0 without
   * cells. Cheap (one box test per occupied cell), so an owner can decide
   * per frame whether cells pay for their extra draws.
   */
  culledShare(camera: THREE.Camera) {
    if (this.structureStale || !this.regions.length) return 0;
    camera.updateMatrixWorld();
    const parent = this.root.parent;
    parent?.updateWorldMatrix(true, false);
    scratchMatrix
      .multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      .multiply(parent?.matrixWorld ?? new THREE.Matrix4());
    scratchFrustum.setFromProjectionMatrix(scratchMatrix);
    let total = 0,
      culled = 0;
    for (const region of this.regions) {
      total += region.weight;
      if (!scratchFrustum.intersectsBox(region.box)) culled += region.weight;
    }
    return total ? culled / total : 0;
  }
  /** Whether a drawable draws: its handle is visible, and it is shown in its
   * prototype and under the edge mode. */
  private static shown(slot: Slot) {
    return slot.handle.visible && slot.handle.drawableShown(slot.template);
  }
  /** Draws of the previous structure, by geometry, for reuse. */
  private pool = new Map<string, InstancedDraw[]>();
  /** Releases a draw's instance buffer; the geometry is the prototype's own. */
  private static disposeDraw(draw: InstancedDraw) {
    (draw as THREE.Object3D).dispatchEvent({ type: "dispose" } as never);
  }
  private drainPool() {
    for (const list of this.pool.values())
      for (const draw of list) RenderBatches.disposeDraw(draw);
    this.pool.clear();
  }
  private newDraw(bucket: SlotGroup, materials: Materials): InstancedDraw {
    const source = bucket.slots[0].object;
    const capacity = bucket.slots.length;
    const pooled = this.pool.get(
      (bucket.lines ? "l:" : "m:") + source.geometry.uuid,
    );
    const index =
      pooled?.findIndex((d) => d.instanceMatrix.count >= capacity) ?? -1;
    if (index >= 0) {
      const draw = pooled!.splice(index, 1)[0];
      draw.material = materials;
      draw.count = 0;
      draw.visible = true;
      draw.renderOrder = source.renderOrder;
      draw.userData = { occurrenceIds: [] };
      if (bucket.lines) this.lineDraws.push(draw);
      this.root.add(draw);
      return draw;
    }
    let draw: InstancedDraw;
    if (!bucket.lines) {
      draw = new THREE.InstancedMesh(
        source.geometry,
        materials,
        capacity,
      ) as unknown as InstancedDraw;
    } else {
      draw = instancedLineSegments(
        source.geometry,
        materials,
        [],
      ) as InstancedDraw;
      draw.instanceMatrix = new THREE.InstancedBufferAttribute(
        new Float32Array(capacity * 16),
        16,
      );
      this.lineDraws.push(draw);
    }
    draw.count = 0;
    draw.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    draw.renderOrder = source.renderOrder;
    draw.userData = { occurrenceIds: [] };
    this.root.add(draw);
    return draw;
  }
  /** Rewrite every bucket's instance arrays from the handles' current state. */
  private fill() {
    this.fillStale = false;
    this.counters.fills++;
    const parent = this.root.parent;
    parent?.updateWorldMatrix(true, false);
    const parentInverse = new THREE.Matrix4()
      .copy(parent?.matrixWorld || new THREE.Matrix4())
      .invert();
    // The world-space section plane in the batches' (parent) space.
    const clip = this.clipPlane
      ? scratchPlane.copy(this.clipPlane).applyMatrix4(parentInverse)
      : null;
    const culled = (sphere: THREE.Sphere) =>
      !!clip && clip.distanceToPoint(sphere.center) < -sphere.radius;
    const matrix = new THREE.Matrix4();
    const cells = this.cellsInUse;
    let written = 0;
    for (const bucket of this.buckets) {
      const geometry = bucket.slots[0].object.geometry;
      if (!geometry.boundingSphere) geometry.computeBoundingSphere();
      const local = geometry.boundingSphere!;
      if (bucket.single) {
        const slot = bucket.slots[0],
          copy = bucket.single;
        slot.handle.drawableMatrix(slot.template, null, matrix);
        const visible =
          RenderBatches.shown(slot) &&
          !culled(scratchSphere.copy(local).applyMatrix4(matrix));
        copy.visible = visible;
        copy.userData.filled = visible;
        copy.matrix.copy(matrix);
        copy.matrixWorldNeedsUpdate = true;
        copy.material = slot.handle.materialsOf(slot.template);
        copy.castShadow = slot.handle.castsShadow(slot.template);
        copy.receiveShadow = slot.object.receiveShadow;
        if (visible) written++;
        continue;
      }
      if (bucket.cells)
        for (const group of cells ? [bucket] : bucket.cells)
          RenderBatches.emptyGroup(group);
      for (const group of cells && bucket.cells ? bucket.cells : [bucket])
        written += this.fillGroup(group, local, culled, matrix);
    }
    written += this.fillRaw(culled);
    this.counters.drawables = written;
    // Draws the new structure did not take back are released.
    if (this.poolOpen) {
      this.poolOpen = false;
      this.drainPool();
    }
  }
  private poolOpen = false;
  /** Hide a group's draws (the other representation of a celled bucket). */
  private static emptyGroup(group: SlotGroup) {
    for (const draw of group.draws) {
      draw.count = 0;
      draw.visible = false;
      draw.userData.occurrenceIds = [];
    }
  }
  /** Rewrite one group's instance arrays; returns the drawables written. */
  private fillGroup(
    group: SlotGroup,
    local: THREE.Sphere,
    culled: (sphere: THREE.Sphere) => boolean,
    matrix: THREE.Matrix4,
  ) {
    let written = 0;
    for (const draw of group.draws) {
      draw.count = 0;
      draw.userData.occurrenceIds = [];
    }
    let used = 0;
    const bounds: number[][] = [];
    for (const slot of group.slots) {
      if (!RenderBatches.shown(slot)) continue;
      slot.handle.drawableMatrix(slot.template, null, matrix);
      scratchSphere.copy(local).applyMatrix4(matrix);
      if (culled(scratchSphere)) continue;
      const materials = slot.handle.materialsOf(slot.template);
      const representative = firstMaterial(materials);
      // Treatments are few (untreated, ghosted, dimmed): a linear scan.
      let index = 0;
      while (
        index < used &&
        firstMaterial(group.draws[index].material as Materials) !==
          representative
      )
        index++;
      if (index === used) {
        if (index === group.draws.length)
          group.draws.push(this.newDraw(group, materials));
        const draw = group.draws[index];
        draw.material = materials;
        if (group.lines)
          materialList(materials).forEach(supportsInstancedLines);
        draw.castShadow = slot.handle.castsShadow(slot.template);
        draw.receiveShadow = slot.object.receiveShadow;
        bounds[index] = [
          Infinity,
          Infinity,
          Infinity,
          -Infinity,
          -Infinity,
          -Infinity,
        ];
        used++;
      }
      const draw = group.draws[index];
      matrix.toArray(draw.instanceMatrix.array, draw.count * 16);
      draw.count++;
      draw.userData.occurrenceIds.push(slot.occurrenceId);
      const b = bounds[index],
        c = scratchSphere.center,
        r = scratchSphere.radius;
      if (c.x - r < b[0]) b[0] = c.x - r;
      if (c.y - r < b[1]) b[1] = c.y - r;
      if (c.z - r < b[2]) b[2] = c.z - r;
      if (c.x + r > b[3]) b[3] = c.x + r;
      if (c.y + r > b[4]) b[4] = c.y + r;
      if (c.z + r > b[5]) b[5] = c.z + r;
      written++;
    }
    group.draws.forEach((draw, i) => {
      draw.visible = draw.count > 0;
      if (!draw.count) return;
      const attribute = draw.instanceMatrix;
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(0, draw.count * 16);
      attribute.needsUpdate = true;
      const b = bounds[i];
      const sphere = (draw.boundingSphere ??= new THREE.Sphere());
      sphere.center.set(
        (b[0] + b[3]) / 2,
        (b[1] + b[4]) / 2,
        (b[2] + b[5]) / 2,
      );
      sphere.radius = scratchVector
        .set(b[3] - b[0], b[4] - b[1], b[5] - b[2])
        .multiplyScalar(0.5)
        .length();
      if ((draw as THREE.InstancedMesh).isMesh)
        (draw as THREE.InstancedMesh).boundingBox = null;
    });
    return written;
  }
  /** Re-merge the baked section only when one of its slots changed. */
  private fillRaw(culled: (sphere: THREE.Sphere) => boolean) {
    const state = this.rawState;
    let changed = false,
      count = 0;
    const matrix = new THREE.Matrix4();
    const visible: boolean[] = [];
    const materials: Materials[] = [];
    this.rawSlots.forEach((slot, i) => {
      slot.handle.drawableMatrix(slot.template, null, matrix);
      let shown = RenderBatches.shown(slot);
      if (shown) {
        const geometry = slot.object.geometry;
        if (!geometry.boundingSphere) geometry.computeBoundingSphere();
        if (
          culled(
            scratchSphere.copy(geometry.boundingSphere!).applyMatrix4(matrix),
          )
        )
          shown = false;
      }
      visible.push(shown);
      if (shown) count++;
      const offset = i * 17;
      if (state[offset] !== (shown ? 1 : 0)) changed = true;
      state[offset] = shown ? 1 : 0;
      for (let k = 0; k < 16; k++) {
        const value = Math.fround(matrix.elements[k]);
        if (state[offset + 1 + k] !== value) {
          changed = true;
          state[offset + 1 + k] = value;
        }
      }
      const drawn = (materials[i] = slot.handle.materialsOf(slot.template));
      if (!sameMaterials(this.rawMaterials[i], drawn)) {
        changed = true;
        this.rawMaterials[i] = drawn;
      }
    });
    if (!changed) return count;
    this.counters.rawMerges++;
    this.clearRaw();
    const rawBuckets = new Map<string, RawEntry[]>();
    this.rawSlots.forEach((slot, i) => {
      if (!visible[i]) return;
      const drawable = slot.object;
      const list = materialList(materials[i]);
      const entry: RawEntry = {
        ...slot,
        matrix: slot.handle.drawableMatrix(
          slot.template,
          null,
          new THREE.Matrix4(),
        ),
        materials: materials[i],
        castShadow: slot.handle.castsShadow(slot.template),
      };
      // A treated (ghosted/dimmed) raw drawable is transparent: drawn alone.
      if (list.some((m) => m.transparent)) {
        this.single(entry);
        return;
      }
      const key = [
        (drawable as THREE.Mesh).isMesh ? "mesh" : "line",
        rawLayout(drawable.geometry),
        ...list.map((m) => m.uuid),
        drawable.renderOrder,
        entry.castShadow,
        drawable.receiveShadow,
      ].join(":");
      const entries = rawBuckets.get(key) || [];
      entries.push(entry);
      rawBuckets.set(key, entries);
    });
    let rawVertices = 0,
      rawBytes = 0;
    for (const entries of rawBuckets.values()) {
      let chunk: RawEntry[] = [],
        chunkVertices = 0;
      for (const entry of entries) {
        const geometry = entry.object.geometry;
        const vertices =
          geometry.index?.count || geometry.getAttribute("position").count;
        const bytes = Object.values(geometry.attributes).reduce(
          (sum, a) => sum + vertices * a.itemSize * a.array.BYTES_PER_ELEMENT,
          0,
        );
        if (
          entry.optional &&
          (rawVertices + vertices > RAW_BATCH_LIMITS.vertices ||
            rawBytes + bytes > RAW_BATCH_LIMITS.bytes)
        ) {
          this.single(entry);
          continue;
        }
        rawVertices += vertices;
        rawBytes += bytes;
        ensure(
          rawVertices <= RAW_BATCH_LIMITS.vertices &&
            rawBytes <= RAW_BATCH_LIMITS.bytes,
          "LIMIT_EXCEEDED",
          "Raw render batches exceed two million vertices or 128 MiB of generated attributes.",
        );
        if (
          chunk.length &&
          chunkVertices + vertices > RAW_BATCH_LIMITS.chunkVertices
        ) {
          this.mergeRaw(chunk);
          chunk = [];
          chunkVertices = 0;
        }
        chunk.push(entry);
        chunkVertices += vertices;
      }
      if (chunk.length) this.mergeRaw(chunk);
    }
    return count;
  }
  private synchronize() {
    if (this.structureStale) this.buildStructure();
    if (this.visibilityChanged()) this.fillStale = true;
    if (!this.fillStale) return;
    this.builtVisibility = this.scratchVisibility.slice();
    this.fill();
  }
  private mergeRaw(entries: RawEntry[]) {
    const first = entries[0].object;
    const mesh = !!(first as THREE.Mesh).isMesh;
    const geometries = entries.map((entry) =>
      mesh
        ? transformTriangleGeometry(entry.object.geometry, entry.matrix)
        : transformLineGeometry(entry.object.geometry, entry.matrix),
    );
    let merged: THREE.BufferGeometry | null;
    try {
      merged = mergeGeometries(geometries, false);
    } finally {
      geometries.forEach((geometry) => geometry.dispose());
    }
    if (!merged) {
      entries.forEach((entry) => this.single(entry));
      return;
    }
    merged.clearGroups();
    // Material-array groups use cumulative primitive counts, never a fixed first-face stride.
    let offset = 0;
    const groups: Array<{
      start: number;
      count: number;
      materialIndex: number;
    }> = [];
    for (const entry of entries) {
      const source = entry.object.geometry;
      const count =
        source.index?.count || source.getAttribute("position").count;
      const sourceGroups = source.groups.length
        ? source.groups
        : [{ start: 0, count, materialIndex: 0 }];
      for (const group of sourceGroups) {
        const start = offset + group.start,
          materialIndex = group.materialIndex || 0,
          groupCount = Math.max(0, Math.min(group.count, count - group.start));
        const previous = groups.at(-1);
        if (
          previous &&
          previous.materialIndex === materialIndex &&
          previous.start + previous.count === start
        )
          previous.count += groupCount;
        else groups.push({ start, count: groupCount, materialIndex });
      }
      offset += count;
    }
    for (const group of groups)
      merged.addGroup(group.start, group.count, group.materialIndex);
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    const drawable = mesh
      ? new THREE.Mesh(merged, entries[0].materials)
      : new THREE.LineSegments(merged, entries[0].materials);
    drawable.renderOrder = first.renderOrder;
    drawable.castShadow = entries[0].castShadow;
    drawable.receiveShadow = first.receiveShadow;
    drawable.userData = {
      occurrenceIds: entries.map((entry) => entry.occurrenceId),
      // Vertices each entry contributes, in order (ID pass entry attribute).
      vertexCounts: entries.map(
        (entry) =>
          entry.object.geometry.index?.count ||
          entry.object.geometry.getAttribute("position").count,
      ),
      rawPrimitiveBatch: true,
    };
    this.generated.push(merged);
    this.rawObjects.push(drawable);
    this.root.add(drawable);
  }
  private single(entry: RawEntry) {
    const copy = entry.object.clone(false) as Drawable;
    copy.matrixAutoUpdate = false;
    copy.matrix.copy(entry.matrix);
    copy.material = entry.materials;
    copy.castShadow = entry.castShadow;
    copy.visible = true;
    copy.userData = { ...copy.userData, occurrenceId: entry.occurrenceId };
    this.rawObjects.push(copy);
    this.root.add(copy);
  }
  render(
    renderer: Pick<THREE.WebGLRenderer, "render">,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    if (!this.deferredUntil || performance.now() > this.deferredUntil) {
      this.deferredUntil = 0;
      this.synchronize();
    }
    const suppressed = this.linesSuppressed;
    for (const draw of this.lineDraws)
      draw.visible = draw.count > 0 && !suppressed;
    for (const copy of this.lineSingles)
      copy.visible = copy.userData.filled && !suppressed;
    // Handles are records outside the scene graph: the draw's traversal
    // reaches only the batches and materialized (dynamic) trees.
    renderer.render(scene, camera);
  }
  /**
   * The triangle drawables the batches draw right now, with the occurrence of
   * each instance or merged entry, for the selection ID pass. Lines are left
   * out, and so are drawables `skip` rejects (ghosted treatments).
   */
  idSources(skip: (materials: THREE.Material[]) => boolean): IdSource[] {
    this.synchronize();
    const sources: IdSource[] = [];
    for (const child of this.root.children) {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !child.visible) continue;
      if (skip(materialList(mesh.material))) continue;
      const data = child.userData;
      if ((child as THREE.InstancedMesh).isInstancedMesh) {
        const draw = child as THREE.InstancedMesh;
        if (draw.count > 0)
          sources.push({
            kind: "instanced",
            object: draw,
            occurrenceIds: data.occurrenceIds,
          });
      } else if (data.rawPrimitiveBatch)
        sources.push({
          kind: "merged",
          object: mesh,
          occurrenceIds: data.occurrenceIds,
          vertexCounts: data.vertexCounts,
        });
      else if (data.occurrenceId)
        sources.push({
          kind: "single",
          object: mesh,
          occurrenceId: data.occurrenceId,
        });
    }
    return sources;
  }
  /** What the last filled batches draw (diagnostics and budget tests). */
  stats() {
    const drawn = new Set<string>();
    let instancedMeshes = 0,
      instancedLines = 0,
      merged = 0,
      single = 0,
      objects = 0;
    for (const child of this.root.children) {
      const lineDraw =
        (child as THREE.InstancedMesh).isInstancedMesh &&
        (child as THREE.LineSegments).isLineSegments;
      // Suppressed lines still count: they are drawn again at rest.
      const filled = lineDraw
        ? (child as InstancedDraw).count > 0
        : (child.userData.filled ?? child.visible);
      if (!filled) continue;
      objects++;
      const data = child.userData;
      if (data.occurrenceIds)
        for (const id of data.occurrenceIds as string[]) drawn.add(id);
      else if (data.occurrenceId) drawn.add(data.occurrenceId);
      if ((child as THREE.InstancedMesh).isInstancedMesh) {
        if (lineDraw) instancedLines++;
        else instancedMeshes++;
      } else if (data.occurrenceIds) merged++;
      else single++;
    }
    return {
      objects,
      instancedMeshes,
      instancedLines,
      merged,
      single,
      occurrencesDrawn: drawn.size,
      dynamic: this.dynamic.size,
      linesSuppressed: this.linesSuppressed,
      buckets: this.buckets.length,
      cells: this.buckets.reduce((n, b) => n + (b.cells?.length ?? 0), 0),
      cellSize: Math.round(this.builtCellSize),
      cellsInUse: this.cellsInUse,
      ...this.counters,
    };
  }
  dispose() {
    this.clear();
    this.root.removeFromParent();
    this.handles.clear();
    this.batched = [];
    this.dynamic.clear();
    this.builtVisibility = undefined;
    this.structureStale = true;
  }
}
