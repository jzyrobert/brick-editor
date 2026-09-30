import * as THREE from "three";

/**
 * Lightweight occurrence handles.
 *
 * Every placed part used to own a cloned Object3D tree (render group → part
 * group → mesh + edge lines + conditional lines), about 10 KB of JS heap and
 * 60 µs to create each, although the render batches draw everything. A handle
 * is now a small record: the occurrence ID, its compiled prototype, a matrix,
 * a visibility flag and the view treatments applied to it. The prototype's
 * drawables are described once per prototype (`drawableTemplates`), and
 * picking, bounds, collision, region selection and the batches work from the
 * record plus those templates.
 *
 * A real Object3D tree is created only where one has to be drawn or moved on
 * its own (`OccurrenceHandles.materialize`): moving mechanism parts (the
 * batches' dynamic set) and the reference renderer. It follows the record
 * (matrix, visibility, treatments, edge mode) while it exists.
 */

export type Drawable = THREE.Mesh | THREE.LineSegments;
export type Materials = THREE.Material | THREE.Material[];
export type EdgeMode = "all" | "ordinary" | "none";

/** One drawable of a compiled prototype, as every occurrence of it draws it. */
export type DrawableTemplate = {
  /** The prototype's own drawable (shared geometry and base material). */
  readonly object: Drawable;
  /** Drawable space → prototype root space. */
  readonly local: THREE.Matrix4;
  readonly mesh: boolean;
  /** A conditional-line set (LDraw type 5 lines). */
  readonly conditional: boolean;
  /** Visible along its path inside the prototype. */
  readonly shown: boolean;
};

const templateCache = new WeakMap<THREE.Object3D, DrawableTemplate[]>();

/**
 * The drawables of a prototype in traversal order (the order a clone of it
 * traverses in), with their matrices relative to the prototype root. The
 * root's own transform is replaced by each occurrence's matrix, as it was
 * when handles were clones.
 */
export function drawableTemplates(
  prototype: THREE.Object3D,
): readonly DrawableTemplate[] {
  let list = templateCache.get(prototype);
  if (list) return list;
  list = [];
  const visit = (
    object: THREE.Object3D,
    parent: THREE.Matrix4,
    shown: boolean,
  ) => {
    for (const child of object.children) {
      if (child.matrixAutoUpdate) child.updateMatrix();
      const local = new THREE.Matrix4().multiplyMatrices(parent, child.matrix);
      const visible = shown && child.visible;
      const drawable = child as Drawable;
      const mesh = !!(drawable as THREE.Mesh).isMesh;
      if (mesh || (drawable as THREE.LineSegments).isLineSegments)
        list!.push({
          object: drawable,
          local,
          mesh,
          conditional: !mesh && !!drawable.geometry.getAttribute("control0"),
          shown: visible,
        });
      visit(child, local, visible);
    }
  };
  visit(prototype, new THREE.Matrix4(), true);
  templateCache.set(prototype, list);
  return list;
}

/** A temporary material treatment (ghosted layer or floor, dimmed step). */
export interface Treatment {
  treat(materials: Materials): Materials;
}

/** View state shared by every handle of one scene. */
export class HandleStyle {
  edges: EdgeMode = "all";
  /** Whether a line set draws under the current edge mode. */
  lineShown(conditional: boolean) {
    return this.edges === "all" || (this.edges === "ordinary" && !conditional);
  }
}

const identityStyle = new HandleStyle();

export class OccurrenceHandle {
  /** Occurrence transform relative to the model root (plus any explode lift). */
  readonly matrix = new THREE.Matrix4();
  /** Treatments in the order they were applied; null when untreated. */
  treatments: Treatment[] | null = null;
  /** The materialized tree, while one is needed (see materialize()). */
  object: THREE.Group | null = null;
  private shownFlag = true;
  constructor(
    readonly id: string,
    public prototype: THREE.Group,
    readonly style: HandleStyle = identityStyle,
  ) {}
  get visible() {
    return this.shownFlag;
  }
  set visible(value: boolean) {
    this.shownFlag = value;
    if (this.object) this.object.visible = value;
  }
  get drawables() {
    return drawableTemplates(this.prototype);
  }
  get rawPrimitive(): boolean {
    return !!this.prototype.userData.rawPrimitive;
  }
  /** Materials this occurrence draws a template with (after treatments). */
  materialsOf(template: DrawableTemplate): Materials {
    let materials: Materials = template.object.material;
    if (this.treatments)
      for (const treatment of this.treatments)
        materials = treatment.treat(materials);
    return materials;
  }
  /** Treated (see-through) drawables cast no shadow. */
  castsShadow(template: DrawableTemplate) {
    return !this.treatments && template.object.castShadow;
  }
  /** Whether a template draws, ignoring the handle's own visibility. */
  drawableShown(template: DrawableTemplate) {
    return (
      template.shown &&
      (template.mesh || this.style.lineShown(template.conditional))
    );
  }
  /** World matrix of a template: `world` is the model root's world matrix. */
  drawableMatrix(
    template: DrawableTemplate,
    world: THREE.Matrix4 | null,
    out: THREE.Matrix4,
  ) {
    out.multiplyMatrices(this.matrix, template.local);
    return world ? out.premultiply(world) : out;
  }
  /** The matrix changed: move the materialized tree with it. */
  moved() {
    const object = this.object;
    if (!object) return;
    object.matrix.copy(this.matrix);
    object.updateMatrixWorld(true);
  }
  /** Treatments or the edge mode changed: restyle the materialized tree. */
  restyle() {
    const object = this.object;
    if (!object) return;
    const templates = this.drawables;
    let i = 0;
    object.traverse((child) => {
      const drawable = child as Drawable;
      if (
        !(drawable as THREE.Mesh).isMesh &&
        !(drawable as THREE.LineSegments).isLineSegments
      )
        return;
      const template = templates[i++];
      if (!template) return;
      drawable.material = this.materialsOf(template);
      drawable.castShadow = this.castsShadow(template);
      if (!template.mesh)
        drawable.visible =
          template.object.visible && this.style.lineShown(template.conditional);
    });
  }
  /** World-space bounds of every drawable, as Box3.expandByObject computes
   * them for a tree (geometry boxes, not exact, visible or not). */
  expandBox(box: THREE.Box3, world: THREE.Matrix4 | null) {
    for (const template of this.drawables) {
      const geometry = template.object.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      this.drawableMatrix(template, world, scratchMatrix);
      box.union(
        scratchBox.copy(geometry.boundingBox!).applyMatrix4(scratchMatrix),
      );
    }
    return box;
  }
}

const scratchMatrix = new THREE.Matrix4();
const scratchBox = new THREE.Box3();

/**
 * `object.clone(true)` for compiled part trees, without the throwaway default
 * geometry and material every Mesh/Line constructor allocates when cloning.
 */
export function cloneTree<T extends THREE.Object3D>(source: T): T {
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

/**
 * The occurrence handles of one scene, by occurrence ID (a read-only Map view
 * plus placement and materialization). Materialized trees are children of
 * `parent` (the model root).
 */
export class OccurrenceHandles
  implements ReadonlyMap<string, OccurrenceHandle>
{
  readonly style = new HandleStyle();
  private map = new Map<string, OccurrenceHandle>();
  constructor(readonly parent: THREE.Object3D) {}
  get size() {
    return this.map.size;
  }
  get(id: string) {
    return this.map.get(id);
  }
  has(id: string) {
    return this.map.has(id);
  }
  keys() {
    return this.map.keys();
  }
  values() {
    return this.map.values();
  }
  entries() {
    return this.map.entries();
  }
  forEach(
    callback: (
      value: OccurrenceHandle,
      key: string,
      map: ReadonlyMap<string, OccurrenceHandle>,
    ) => void,
  ) {
    this.map.forEach((value, key) => callback(value, key, this));
  }
  [Symbol.iterator]() {
    return this.map[Symbol.iterator]();
  }
  /** The handle of `id` for this prototype: reused when it already draws that
   * prototype, else (re)created (a materialized tree is rebuilt). */
  place(id: string, prototype: THREE.Group) {
    let handle = this.map.get(id);
    if (handle && handle.prototype === prototype) return handle;
    const wasMaterialized = !!handle?.object;
    if (handle) this.release(handle);
    handle = new OccurrenceHandle(id, prototype, this.style);
    this.map.set(id, handle);
    if (wasMaterialized) this.materialize(handle);
    return handle;
  }
  delete(id: string) {
    const handle = this.map.get(id);
    if (!handle) return false;
    this.release(handle);
    return this.map.delete(id);
  }
  /** Create the handle's real Object3D tree (in `parent`), following its
   * matrix, visibility, treatments and the edge mode. */
  materialize(handle: OccurrenceHandle) {
    if (handle.object) return handle.object;
    const group = cloneTree(handle.prototype);
    group.userData = { occurrenceId: handle.id, prototype: handle.prototype };
    group.matrixAutoUpdate = false;
    handle.object = group;
    group.visible = handle.visible;
    handle.restyle();
    this.parent.add(group);
    handle.moved();
    return group;
  }
  /** Drop a materialized tree (its geometry and materials are shared). */
  release(handle: OccurrenceHandle) {
    if (!handle.object) return;
    handle.object.removeFromParent();
    handle.object = null;
  }
  /** Change the edge mode; materialized trees follow. */
  setEdges(edges: EdgeMode) {
    if (this.style.edges === edges) return false;
    this.style.edges = edges;
    for (const handle of this.map.values()) if (handle.object) handle.restyle();
    return true;
  }
}

/** Show `box` in a BoxHelper (the corner layout BoxHelper.update() writes). */
export function writeBoxHelper(helper: THREE.BoxHelper, box: THREE.Box3) {
  if (box.isEmpty()) return helper;
  const { min, max } = box;
  const position = helper.geometry.getAttribute(
    "position",
  ) as THREE.BufferAttribute;
  position.array.set([
    max.x,
    max.y,
    max.z,
    min.x,
    max.y,
    max.z,
    min.x,
    min.y,
    max.z,
    max.x,
    min.y,
    max.z,
    max.x,
    max.y,
    min.z,
    min.x,
    max.y,
    min.z,
    min.x,
    min.y,
    min.z,
    max.x,
    min.y,
    min.z,
  ]);
  position.needsUpdate = true;
  helper.geometry.computeBoundingSphere();
  return helper;
}
