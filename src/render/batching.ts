import * as THREE from "three";
import { ensure } from "../core/types";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

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
  const x = new THREE.Vector3(e[0], e[1], e[2]);
  const y = new THREE.Vector3(e[4], e[5], e[6]);
  const z = new THREE.Vector3(e[8], e[9], e[10]);
  const scale = Math.max(
    x.length() * y.length(),
    x.length() * z.length(),
    y.length() * z.length(),
    1,
  );
  return (
    Math.max(Math.abs(x.dot(y)), Math.abs(x.dot(z)), Math.abs(y.dot(z))) <=
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
const firstMaterial = (materials: Materials) =>
  Array.isArray(materials) ? materials[0] : materials;
const materialList = (materials: Materials) =>
  Array.isArray(materials) ? materials : [materials];

/** A drawable of an occurrence handle, as the batches classified it. */
type Slot = {
  object: Drawable;
  group: THREE.Group;
  occurrenceId: string;
  /** Baked only as a draw-call optimization; may still render unmerged. */
  optional?: boolean;
};

/** Instanced draw of one bucket under one treatment (material set). */
type InstancedDraw = (THREE.InstancedMesh | InstancedLineSegments) & {
  userData: { occurrenceIds: string[] };
};

/**
 * Repeated geometry + base material(s) + render order (+ spatial cell). Its
 * draws are allocated once with room for every slot; visibility, treatment,
 * transform and section changes only rewrite instance matrices and counts.
 */
type Bucket = {
  lines: boolean;
  slots: Slot[];
  /** One draw per treatment in use (untreated, ghosted, dimmed …). */
  draws: InstancedDraw[];
  /** A bucket of one slot draws a plain copy instead (exact sorting). */
  single?: Drawable;
};

export type BatchOptions = {
  /** Split buckets that span several cells of this size (parent-space units,
   * LDU) into one draw per cell, so frustum culling and transparent sorting
   * work per region. 0 disables. */
  cellSize: number;
  /** Only buckets with at least this many slots are split into cells. */
  cellMinSlots: number;
};

export const DEFAULT_BATCH_OPTIONS: Readonly<BatchOptions> = Object.freeze({
  cellSize: 0,
  cellMinSlots: 64,
});

const scratchMatrix = new THREE.Matrix4();
const scratchSphere = new THREE.Sphere();
const scratchPlane = new THREE.Plane();
const scratchVector = new THREE.Vector3();

/**
 * A render-only cache. Authoritative occurrence handles remain available unchanged
 * to picking, selection, collider extraction and source export. Add `root` beside
 * the handles under their common parent, and use render() for every draw/capture.
 *
 * rebuild() is required after the handle set, prototypes or the dynamic set
 * change. Everything else — handle and child-drawable visibility (steps, floor
 * focus, edge modes), treatment materials (ghosting, dimming) and handle
 * transforms (explode) — is applied by refilling the existing instance arrays:
 * call refresh(), or just change handle visibility, which is detected per frame.
 */
export class RenderBatches {
  readonly root = new THREE.Group();
  private handles = new Map<string, THREE.Group>();
  /** Handles drawn through the batches, in `handles` order. */
  private batched: Array<[string, THREE.Group]> = [];
  private batchedSet = new Set<THREE.Object3D>();
  /** Occurrences drawn live from their own handles (moving transient poses). */
  private dynamic = new Set<string>();
  /** Visibility of `batched` when the batches were last filled; undefined = stale. */
  private builtVisibility?: Uint8Array;
  private scratchVisibility = new Uint8Array(0);
  private traversal: THREE.Object3D[] = [];
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
  private counters = { structures: 0, fills: 0, rawMerges: 0, drawables: 0 };
  constructor(options: Partial<BatchOptions> = {}) {
    this.root.name = "render-only occurrence batches";
    this.options = { ...DEFAULT_BATCH_OPTIONS, ...options };
  }
  rebuild(handles: ReadonlyMap<string, THREE.Group>) {
    this.handles = new Map(handles);
    this.batched = [...this.handles].filter(([id]) => !this.dynamic.has(id));
    this.batchedSet = new Set(this.batched.map(([, group]) => group));
    this.builtVisibility = undefined;
    this.structureStale = true;
    this.clear();
  }
  /** Visibility, treatment materials or transforms of existing handles changed:
   * refill the instance arrays on the next draw (no new GPU objects). */
  refresh() {
    this.fillStale = true;
  }
  /**
   * Draw these occurrences from their live handles instead of the merged batches, so
   * a moving pose only updates their matrices. Changing the set rebuilds once.
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
  private clear() {
    this.clearRaw();
    // Releases each instance buffer; the geometry is the prototype's own.
    for (const bucket of this.buckets)
      for (const draw of bucket.draws)
        (draw as THREE.Object3D).dispatchEvent({ type: "dispose" } as never);
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
    this.clear();
    const parent = this.root.parent;
    parent?.updateMatrixWorld(true);
    const parentInverse = new THREE.Matrix4()
      .copy(parent?.matrixWorld || new THREE.Matrix4())
      .invert();
    const keyed = new Map<string, Slot[]>();
    const cellSize = this.options.cellSize;
    for (const [occurrenceId, group] of this.batched) {
      group.updateMatrixWorld(true);
      group.traverse((object) => {
        const drawable = object as Drawable;
        if (
          !(drawable as THREE.Mesh).isMesh &&
          !(drawable as THREE.LineSegments).isLineSegments
        )
          return;
        const slot: Slot = { object: drawable, group, occurrenceId };
        const matrix = scratchMatrix.multiplyMatrices(
          parentInverse,
          object.matrixWorld,
        );
        const bases = materialList(drawable.material).map(treatmentBase);
        const mesh = !!(drawable as THREE.Mesh).isMesh;
        const raw = !!(
          group.userData.rawPrimitive ||
          group.userData.prototype?.userData.rawPrimitive
        );
        const bakeable =
          bases.every((m) => !m.transparent) &&
          Math.abs(matrix.determinant()) > 1e-12 &&
          Object.values(drawable.geometry.attributes).every(
            (a) =>
              !(a as THREE.InterleavedBufferAttribute)
                .isInterleavedBufferAttribute,
          ) &&
          Object.keys(drawable.geometry.morphAttributes).length === 0 &&
          drawable.geometry.drawRange.start === 0 &&
          drawable.geometry.drawRange.count === Infinity;
        const instanceable = mesh
          ? canInstanceMatrix(matrix)
          : bases.every(supportsInstancedLines);
        // Raw primitives, and opaque drawables instancing cannot represent
        // (sheared/reflected meshes, custom line shaders), are baked into
        // merged batches instead of one draw each.
        if (bakeable && (raw || !instanceable)) {
          slot.optional = !raw;
          this.rawSlots.push(slot);
          return;
        }
        let key = !instanceable
          ? "single:" + drawable.uuid
          : [
              mesh ? "mesh" : "line",
              drawable.geometry.uuid,
              ...bases.map((m) => m.uuid),
              drawable.renderOrder,
            ].join(":");
        if (instanceable && cellSize > 0) {
          const e = matrix.elements;
          key +=
            "@" +
            Math.floor(e[12] / cellSize) +
            "," +
            Math.floor(e[13] / cellSize) +
            "," +
            Math.floor(e[14] / cellSize);
        }
        const slots = keyed.get(key);
        if (slots) slots.push(slot);
        else keyed.set(key, [slot]);
      });
    }
    // Cells only for large buckets: small ones stay one draw however spread.
    const wholes = new Map<string, Slot[]>();
    if (cellSize > 0)
      for (const [key, slots] of keyed) {
        const at = key.lastIndexOf("@");
        if (at < 0) continue;
        const base = key.slice(0, at);
        const whole = wholes.get(base);
        if (whole) whole.push(...slots);
        else wholes.set(base, [...slots]);
      }
    const groups: Slot[][] = [];
    for (const [key, slots] of keyed) {
      const at = cellSize > 0 ? key.lastIndexOf("@") : -1;
      if (at < 0) {
        groups.push(slots);
        continue;
      }
      const base = key.slice(0, at);
      const whole = wholes.get(base);
      if (!whole) continue;
      if (whole.length >= this.options.cellMinSlots) groups.push(slots);
      else {
        groups.push(whole);
        wholes.delete(base);
      }
    }
    for (const slots of groups) {
      const lines = !(slots[0].object as THREE.Mesh).isMesh;
      const bucket: Bucket = { lines, slots, draws: [] };
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
    this.rawState = new Float32Array(this.rawSlots.length * 17).fill(NaN);
    this.rawMaterials = new Array(this.rawSlots.length);
  }
  /** Whether a drawable and its ancestors up to its handle are visible. */
  private static shown(slot: Slot) {
    let object: THREE.Object3D | null = slot.object;
    while (object && object !== slot.group) {
      if (!object.visible) return false;
      object = object.parent;
    }
    return slot.group.visible;
  }
  private newDraw(bucket: Bucket, materials: Materials): InstancedDraw {
    const source = bucket.slots[0].object;
    const capacity = bucket.slots.length;
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
    let written = 0;
    for (const bucket of this.buckets) {
      const geometry = bucket.slots[0].object.geometry;
      if (!geometry.boundingSphere) geometry.computeBoundingSphere();
      const local = geometry.boundingSphere!;
      if (bucket.single) {
        const slot = bucket.slots[0],
          copy = bucket.single;
        matrix.multiplyMatrices(parentInverse, slot.object.matrixWorld);
        const visible =
          RenderBatches.shown(slot) &&
          !culled(scratchSphere.copy(local).applyMatrix4(matrix));
        copy.visible = visible;
        copy.userData.filled = visible;
        copy.matrix.copy(matrix);
        copy.matrixWorldNeedsUpdate = true;
        copy.material = slot.object.material;
        copy.castShadow = slot.object.castShadow;
        copy.receiveShadow = slot.object.receiveShadow;
        if (visible) written++;
        continue;
      }
      for (const draw of bucket.draws) {
        draw.count = 0;
        draw.userData.occurrenceIds = [];
      }
      let used = 0;
      const bounds: number[][] = [];
      for (const slot of bucket.slots) {
        if (!RenderBatches.shown(slot)) continue;
        matrix.multiplyMatrices(parentInverse, slot.object.matrixWorld);
        scratchSphere.copy(local).applyMatrix4(matrix);
        if (culled(scratchSphere)) continue;
        const materials = slot.object.material;
        const representative = firstMaterial(materials);
        // Treatments are few (untreated, ghosted, dimmed): a linear scan.
        let index = 0;
        while (
          index < used &&
          firstMaterial(bucket.draws[index].material as Materials) !==
            representative
        )
          index++;
        if (index === used) {
          if (index === bucket.draws.length)
            bucket.draws.push(this.newDraw(bucket, materials));
          const draw = bucket.draws[index];
          draw.material = materials;
          if (bucket.lines)
            materialList(materials).forEach(supportsInstancedLines);
          draw.castShadow = slot.object.castShadow;
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
        const draw = bucket.draws[index];
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
      bucket.draws.forEach((draw, i) => {
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
    }
    written += this.fillRaw(parentInverse, culled);
    this.counters.drawables = written;
  }
  /** Re-merge the baked section only when one of its slots changed. */
  private fillRaw(
    parentInverse: THREE.Matrix4,
    culled: (sphere: THREE.Sphere) => boolean,
  ) {
    const state = this.rawState;
    let changed = false,
      count = 0;
    const matrix = new THREE.Matrix4();
    const visible: boolean[] = [];
    this.rawSlots.forEach((slot, i) => {
      matrix.multiplyMatrices(parentInverse, slot.object.matrixWorld);
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
      if (this.rawMaterials[i] !== slot.object.material) {
        changed = true;
        this.rawMaterials[i] = slot.object.material;
      }
    });
    if (!changed) return count;
    this.counters.rawMerges++;
    this.clearRaw();
    type Entry = Slot & { matrix: THREE.Matrix4 };
    const rawBuckets = new Map<string, Entry[]>();
    this.rawSlots.forEach((slot, i) => {
      if (!visible[i]) return;
      const drawable = slot.object;
      const materials = materialList(drawable.material);
      const entry: Entry = {
        ...slot,
        matrix: new THREE.Matrix4().multiplyMatrices(
          parentInverse,
          drawable.matrixWorld,
        ),
      };
      // A treated (ghosted/dimmed) raw drawable is transparent: drawn alone.
      if (materials.some((m) => m.transparent)) {
        this.single(drawable, entry.matrix, slot.occurrenceId);
        return;
      }
      const key = [
        (drawable as THREE.Mesh).isMesh ? "mesh" : "line",
        rawLayout(drawable.geometry),
        ...materials.map((m) => m.uuid),
        drawable.renderOrder,
        drawable.castShadow,
        drawable.receiveShadow,
      ].join(":");
      const entries = rawBuckets.get(key) || [];
      entries.push(entry);
      rawBuckets.set(key, entries);
    });
    let rawVertices = 0,
      rawBytes = 0;
    for (const entries of rawBuckets.values()) {
      let chunk: Entry[] = [],
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
          this.single(entry.object, entry.matrix, entry.occurrenceId);
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
  private mergeRaw(entries: Array<Slot & { matrix: THREE.Matrix4 }>) {
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
      entries.forEach((entry) =>
        this.single(entry.object, entry.matrix, entry.occurrenceId),
      );
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
      ? new THREE.Mesh(merged, first.material)
      : new THREE.LineSegments(merged, first.material);
    drawable.renderOrder = first.renderOrder;
    drawable.castShadow = first.castShadow;
    drawable.receiveShadow = first.receiveShadow;
    drawable.userData = {
      occurrenceIds: entries.map((entry) => entry.occurrenceId),
      rawPrimitiveBatch: true,
    };
    this.generated.push(merged);
    this.rawObjects.push(drawable);
    this.root.add(drawable);
  }
  private single(
    source: Drawable,
    matrix: THREE.Matrix4,
    occurrenceId: string,
  ) {
    const copy = source.clone(false) as Drawable;
    copy.matrixAutoUpdate = false;
    copy.matrix.copy(matrix);
    copy.visible = true;
    copy.userData = { ...copy.userData, occurrenceId };
    this.rawObjects.push(copy);
    this.root.add(copy);
  }
  render(
    renderer: Pick<THREE.WebGLRenderer, "render">,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    this.synchronize();
    const suppressed = this.linesSuppressed;
    for (const draw of this.lineDraws)
      draw.visible = draw.count > 0 && !suppressed;
    for (const copy of this.lineSingles)
      copy.visible = copy.userData.filled && !suppressed;
    // Batched handles are represented by `root`, so leave them out of the draw's scene
    // traversal entirely. Hiding them was not enough: three still walks and recomposes
    // every hidden descendant's matrix each frame. Their parent links are untouched and
    // their world matrices stay maintained by the explicit updates that move them.
    const parent = this.root.parent;
    if (!parent) {
      renderer.render(scene, camera);
      return;
    }
    const children = parent.children;
    const traversal = this.traversal;
    traversal.length = 0;
    for (const child of children)
      if (!this.batchedSet.has(child)) traversal.push(child);
    parent.children = traversal;
    try {
      renderer.render(scene, camera);
    } finally {
      parent.children = children;
      traversal.length = 0;
    }
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
      ...this.counters,
    };
  }
  dispose() {
    this.clear();
    this.root.removeFromParent();
    this.handles.clear();
    this.batched = [];
    this.batchedSet.clear();
    this.dynamic.clear();
    this.builtVisibility = undefined;
    this.structureStale = true;
  }
}
