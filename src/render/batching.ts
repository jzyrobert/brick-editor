import * as THREE from "three";
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
type Entry = { object: Drawable; matrix: THREE.Matrix4; occurrenceId: string };

/**
 * A render-only cache. Authoritative occurrence handles remain available unchanged
 * to picking, selection, collider extraction and source export. Add `root` beside
 * the handles under their common parent, and use render() for every draw/capture.
 * rebuild() is required after handles, transforms, prototypes or materials change.
 */
export class RenderBatches {
  readonly root = new THREE.Group();
  private handles = new Map<string, THREE.Group>();
  private signature = "";
  private generated: THREE.BufferGeometry[] = [];
  private instances: THREE.InstancedMesh[] = [];
  constructor() {
    this.root.name = "render-only occurrence batches";
  }
  rebuild(handles: ReadonlyMap<string, THREE.Group>) {
    this.handles = new Map(handles);
    this.signature = "";
    this.clear();
  }
  private clear() {
    this.root.clear();
    for (const geometry of this.generated) geometry.dispose();
    for (const mesh of this.instances) mesh.dispose();
    this.generated = [];
    this.instances = [];
  }
  private synchronize() {
    const visible = [...this.handles].filter(([, group]) => group.visible);
    const signature = JSON.stringify(visible.map(([id]) => id));
    if (signature === this.signature) return;
    this.clear();
    this.signature = signature;
    this.root.parent?.updateMatrixWorld(true);
    const parentInverse = new THREE.Matrix4()
      .copy(this.root.parent?.matrixWorld || new THREE.Matrix4())
      .invert();
    const buckets = new Map<string, Entry[]>();
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
    const saved = [...this.handles.values()].map(
      (group) => [group, group.visible] as const,
    );
    for (const [group] of saved) group.visible = false;
    try {
      renderer.render(scene, camera);
    } finally {
      for (const [group, visible] of saved) group.visible = visible;
    }
  }
  dispose() {
    this.clear();
    this.root.removeFromParent();
    this.handles.clear();
    this.signature = "";
  }
}
