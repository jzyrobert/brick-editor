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
type Entry = {
  object: Drawable;
  matrix: THREE.Matrix4;
  occurrenceId: string;
  /** Baked only as a draw-call optimization; may still render unmerged. */
  optional?: boolean;
};

/**
 * A render-only cache. Authoritative occurrence handles remain available unchanged
 * to picking, selection, collider extraction and source export. Add `root` beside
 * the handles under their common parent, and use render() for every draw/capture.
 * rebuild() is required after handles, transforms, prototypes or materials change.
 */
export class RenderBatches {
  readonly root = new THREE.Group();
  private handles = new Map<string, THREE.Group>();
  /** Handles drawn through the batches, in `handles` order. */
  private batched: THREE.Group[] = [];
  private batchedSet = new Set<THREE.Object3D>();
  /** Occurrences drawn live from their own handles (moving transient poses). */
  private dynamic = new Set<string>();
  /** Visibility of `batched` when the batches were generated; undefined = stale. */
  private builtVisibility?: Uint8Array;
  private scratchVisibility = new Uint8Array(0);
  private traversal: THREE.Object3D[] = [];
  private generated: THREE.BufferGeometry[] = [];
  private instances: THREE.InstancedMesh[] = [];
  private instancedLines: InstancedLineSegments[] = [];
  constructor() {
    this.root.name = "render-only occurrence batches";
  }
  rebuild(handles: ReadonlyMap<string, THREE.Group>) {
    this.handles = new Map(handles);
    this.batched = [...this.handles]
      .filter(([id]) => !this.dynamic.has(id))
      .map(([, group]) => group);
    this.batchedSet = new Set(this.batched);
    this.builtVisibility = undefined;
    this.clear();
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
  /** Exact per-frame check without allocating: batches depend only on handle visibility. */
  private visibilityChanged() {
    const count = this.batched.length;
    if (this.scratchVisibility.length !== count)
      this.scratchVisibility = new Uint8Array(count);
    const current = this.scratchVisibility,
      built = this.builtVisibility;
    let changed = !built || built.length !== count;
    for (let i = 0; i < count; i++) {
      const visible = this.batched[i].visible ? 1 : 0;
      current[i] = visible;
      if (!changed && built![i] !== visible) changed = true;
    }
    return changed;
  }
  private clear() {
    this.root.clear();
    for (const geometry of this.generated) geometry.dispose();
    for (const mesh of this.instances) mesh.dispose();
    // Releases each instance buffer; the geometry is the prototype's own.
    for (const lines of this.instancedLines)
      lines.dispatchEvent({ type: "dispose" } as never);
    this.generated = [];
    this.instances = [];
    this.instancedLines = [];
  }
  private synchronize() {
    if (!this.visibilityChanged()) return;
    const visible = [...this.handles].filter(
      ([id, group]) => group.visible && !this.dynamic.has(id),
    );
    const signature = this.scratchVisibility.slice();
    this.clear();
    this.root.parent?.updateMatrixWorld(true);
    const parentInverse = new THREE.Matrix4()
      .copy(this.root.parent?.matrixWorld || new THREE.Matrix4())
      .invert();
    const buckets = new Map<string, Entry[]>();
    const rawBuckets = new Map<string, Entry[]>();
    for (const [occurrenceId, group] of visible) {
      group.updateMatrixWorld(true);
      group.traverse((object) => {
        const drawable = object as Drawable;
        if (
          !(drawable as THREE.Mesh).isMesh &&
          !(drawable as THREE.LineSegments).isLineSegments
        )
          return;
        let ancestor: THREE.Object3D | null = object;
        while (ancestor && ancestor !== group) {
          if (!ancestor.visible) return;
          ancestor = ancestor.parent;
        }
        const matrix = new THREE.Matrix4().multiplyMatrices(
          parentInverse,
          object.matrixWorld,
        );
        const materials = Array.isArray(drawable.material)
          ? drawable.material
          : [drawable.material];
        const raw = !!(
          group.userData.rawPrimitive ||
          group.userData.prototype?.userData.rawPrimitive
        );
        const opaque = materials.every((m) => !m.transparent);
        // Raw primitives, and opaque meshes whose sheared/reflected placement instancing
        // cannot represent, are baked into merged batches instead of one draw each.
        const rawEligible =
          (raw ||
            (opaque &&
              (drawable as THREE.Mesh).isMesh &&
              !canInstanceMatrix(matrix))) &&
          opaque &&
          Math.abs(matrix.determinant()) > 1e-12 &&
          Object.values(drawable.geometry.attributes).every(
            (a) =>
              !(a as THREE.InterleavedBufferAttribute)
                .isInterleavedBufferAttribute,
          ) &&
          Object.keys(drawable.geometry.morphAttributes).length === 0 &&
          drawable.geometry.drawRange.start === 0 &&
          drawable.geometry.drawRange.count === Infinity;
        if (rawEligible) {
          const key = [
            (drawable as THREE.Mesh).isMesh ? "mesh" : "line",
            rawLayout(drawable.geometry),
            ...materials.map((m) => m.uuid),
            drawable.renderOrder,
            drawable.castShadow,
            drawable.receiveShadow,
          ].join(":");
          const entries = rawBuckets.get(key) || [];
          entries.push({
            object: drawable,
            matrix,
            occurrenceId,
            optional: !raw,
          });
          rawBuckets.set(key, entries);
          return;
        }
        const eligible =
          materials.every((m) => !m.transparent) &&
          (!(drawable as THREE.Mesh).isMesh || canInstanceMatrix(matrix));
        if (!eligible) {
          this.fallback(drawable, matrix, occurrenceId);
          return;
        }
        const key = [
          (drawable as THREE.Mesh).isMesh ? "mesh" : "line",
          drawable.geometry.uuid,
          ...materials.map((m) => m.uuid),
          drawable.renderOrder,
        ].join(":");
        const entries = buckets.get(key) || [];
        entries.push({ object: drawable, matrix, occurrenceId });
        buckets.set(key, entries);
      });
    }
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
          this.fallback(entry.object, entry.matrix, entry.occurrenceId);
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
    for (const entries of buckets.values()) {
      const first = entries[0].object;
      if (entries.length < 2) {
        this.fallback(first, entries[0].matrix, entries[0].occurrenceId);
        continue;
      }
      if ((first as THREE.Mesh).isMesh) {
        const mesh = new THREE.InstancedMesh(
          first.geometry,
          first.material,
          entries.length,
        );
        entries.forEach((entry, i) => mesh.setMatrixAt(i, entry.matrix));
        mesh.instanceMatrix.needsUpdate = true;
        mesh.userData.occurrenceIds = entries.map((e) => e.occurrenceId);
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
        mesh.renderOrder = first.renderOrder;
        mesh.castShadow = first.castShadow;
        mesh.receiveShadow = first.receiveShadow;
        this.instances.push(mesh);
        this.root.add(mesh);
      } else if (
        (Array.isArray(first.material) ? first.material : [first.material])
          .map(supportsInstancedLines)
          .every(Boolean)
      ) {
        // One instanced draw per line bucket: memory stays one copy of the
        // part's lines plus a matrix per occurrence, instead of a baked copy
        // of every occurrence's (conditional) lines.
        const lines = instancedLineSegments(
          first.geometry,
          first.material,
          entries.map((entry) => entry.matrix),
        );
        lines.renderOrder = first.renderOrder;
        lines.userData.occurrenceIds = entries.map((e) => e.occurrenceId);
        this.instancedLines.push(lines);
        this.root.add(lines);
      } else {
        const geometries = entries.map((entry) =>
          transformLineGeometry(entry.object.geometry, entry.matrix),
        );
        const merged = mergeGeometries(geometries, false);
        geometries.forEach((g) => g.dispose());
        if (!merged) {
          for (const entry of entries)
            this.fallback(entry.object, entry.matrix, entry.occurrenceId);
          continue;
        }
        // Repeated geometry may contain multiple material groups.
        const stride =
          first.geometry.index?.count ||
          first.geometry.getAttribute("position").count;
        merged.clearGroups();
        const groups = first.geometry.groups;
        if (
          groups.length === 1 &&
          groups[0].start === 0 &&
          groups[0].count === stride
        ) {
          merged.addGroup(0, stride * entries.length, groups[0].materialIndex);
        } else {
          entries.forEach((_, i) =>
            groups.forEach((group) =>
              merged.addGroup(
                i * stride + group.start,
                group.count,
                group.materialIndex,
              ),
            ),
          );
        }
        merged.computeBoundingSphere();
        const lines = new THREE.LineSegments(merged, first.material);
        lines.renderOrder = first.renderOrder;
        lines.userData.occurrenceIds = entries.map((e) => e.occurrenceId);
        this.generated.push(merged);
        this.root.add(lines);
      }
    }
    this.builtVisibility = signature;
  }
  private mergeRaw(entries: Entry[]) {
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
        this.fallback(entry.object, entry.matrix, entry.occurrenceId),
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
    this.root.add(drawable);
  }
  private fallback(
    source: Drawable,
    matrix: THREE.Matrix4,
    occurrenceId: string,
  ) {
    const copy = source.clone(false) as Drawable;
    copy.matrixAutoUpdate = false;
    copy.matrix.copy(matrix);
    copy.visible = true;
    copy.userData = { ...copy.userData, occurrenceId };
    this.root.add(copy);
  }
  render(
    renderer: Pick<THREE.WebGLRenderer, "render">,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    this.synchronize();
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
  /** What the last built batches draw (diagnostics and budget tests). */
  stats() {
    const drawn = new Set<string>();
    let instancedMeshes = 0,
      instancedLines = 0,
      merged = 0,
      single = 0;
    for (const child of this.root.children) {
      const data = child.userData;
      if (data.occurrenceIds)
        for (const id of data.occurrenceIds as string[]) drawn.add(id);
      else if (data.occurrenceId) drawn.add(data.occurrenceId);
      if ((child as THREE.InstancedMesh).isInstancedMesh) {
        if ((child as THREE.LineSegments).isLineSegments) instancedLines++;
        else instancedMeshes++;
      } else if (data.occurrenceIds) merged++;
      else single++;
    }
    return {
      objects: this.root.children.length,
      instancedMeshes,
      instancedLines,
      merged,
      single,
      occurrencesDrawn: drawn.size,
      dynamic: this.dynamic.size,
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
  }
}
