import * as THREE from "three";
import { verifiedConnectors } from "../catalog/connectors";
import type { Vec3 } from "../core/types";
import {
  treatmentBase,
  type DrawVariant,
  type VariantProvider,
} from "./batching";
import {
  classifyGeometry,
  cullGeometry,
  keptPrimitives,
  shellBox,
  type GeometryClasses,
  type HiddenParts,
  type ShellBox,
  type StudAxis,
} from "./hidden-geometry";
import {
  computeOcclusion,
  type OcclusionItem,
  type OcclusionResult,
  type OcclusionStats,
} from "./occlusion";
import {
  drawableTemplates,
  type DrawableTemplate,
  type OccurrenceHandle,
} from "./occurrence-handles";

/**
 * Connects hidden-geometry culling (hidden-geometry.ts, occlusion.ts) to the
 * render batches (docs/PERFORMANCE-MINEBENCH.md). Official part prototypes are
 * registered with their part reference; whenever the batches classify, the
 * occlusion of every batched handle is computed from the handles' matrices,
 * and each drawable is offered its culled variants. The batches decide per
 * fill which variant is exact for the current view (see DrawVariant).
 *
 * `?hiddenCull=0` turns culling off for comparisons.
 */
type PartShape = {
  studs: StudAxis[];
  antistuds: StudAxis[];
  box: ShellBox | null;
};

/** Parts above this many triangles skip the closed-shell test (its cost
 * grows with triangles; such parts are never plain bricks). */
const SHELL_TEST_TRIANGLES = 20_000;

const partRefs = new WeakMap<THREE.Object3D, string>();
/** Mark a compiled official part prototype with its part reference. */
export function registerPartPrototype(prototype: THREE.Object3D, ref: string) {
  partRefs.set(prototype, ref);
}

const shapes = new WeakMap<THREE.Object3D, PartShape | null>();
/** By shared (colour-independent) geometry. */
const sharedShapes = new WeakMap<THREE.BufferGeometry, PartShape | null>();
const classes = new WeakMap<
  THREE.BufferGeometry,
  { shape: PartShape; classes: GeometryClasses }
>();

const IDENTITY = new THREE.Matrix4();
const UP_OPENING = new THREE.Vector3(0, 1, 0);

const meshTemplates = (prototype: THREE.Object3D) =>
  drawableTemplates(prototype).filter((t) => t.mesh);

/** Connector and closed-shell data of a registered prototype (memoized per
 * shared geometry), or null. */
export function prototypeShape(prototype: THREE.Object3D): PartShape | null {
  const known = shapes.get(prototype);
  if (known !== undefined) return known;
  const ref = partRefs.get(prototype);
  const meshes = meshTemplates(prototype);
  const first = meshes[0]?.object.geometry;
  if (first && sharedShapes.has(first)) {
    const shared = sharedShapes.get(first)!;
    shapes.set(prototype, shared);
    return shared;
  }
  let shape: PartShape | null = null;
  const connectors = ref ? verifiedConnectors(ref) : null;
  // Classification works in part space: drawables must not be offset.
  const local = drawableTemplates(prototype).every((t) =>
    t.local.equals(IDENTITY),
  );
  if (connectors && local) {
    const axis = (kind: string) =>
      connectors
        .filter((c) => c.kind === kind)
        .map((c) => ({ p: c.p as Vec3, axis: c.axis as Vec3 }));
    const studs = axis("stud"),
      antistuds = axis("antistud");
    const geometries = meshes.map((t) => t.object.geometry);
    const triangles = geometries.reduce(
      (n, g) =>
        n + (g.index?.count ?? g.getAttribute("position")?.count ?? 0) / 3,
      0,
    );
    const box =
      antistuds.length && triangles <= SHELL_TEST_TRIANGLES
        ? shellBox(geometries, studs)
        : null;
    if (studs.length || box) shape = { studs, antistuds, box };
  }
  shapes.set(prototype, shape);
  if (first) sharedShapes.set(first, shape);
  return shape;
}

function classesOf(template: DrawableTemplate, shape: PartShape) {
  const geometry = template.object.geometry;
  const known = classes.get(geometry);
  if (known && known.shape === shape) return known.classes;
  const result = classifyGeometry(
    geometry,
    !template.mesh,
    shape.studs,
    shape.box,
  );
  classes.set(geometry, { shape, classes: result });
  return result;
}

const opaqueCache = new WeakMap<THREE.Object3D, boolean>();
/** Every material of the prototype is opaque (untreated). */
export function opaquePrototype(prototype: THREE.Object3D) {
  let solid = opaqueCache.get(prototype);
  if (solid !== undefined) return solid;
  solid = true;
  for (const t of meshTemplates(prototype))
    for (const m of Array.isArray(t.object.material)
      ? t.object.material
      : [t.object.material]) {
      const base = treatmentBase(m);
      if (base.transparent || base.opacity < 1 || base.alphaTest > 0)
        solid = false;
    }
  opaqueCache.set(prototype, solid);
  return solid;
}

/** Occlusion input for one placed prototype (matrix relative to the model root). */
export function occlusionItem(
  id: string,
  matrix: THREE.Matrix4,
  prototype: THREE.Object3D,
): OcclusionItem | null {
  if (!partRefs.has(prototype)) return null;
  const shape = prototypeShape(prototype);
  if (!shape) return null;
  const e = matrix.elements;
  return {
    id,
    basis: [e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]],
    position: [e[12], e[13], e[14]],
    opaque: opaquePrototype(prototype),
    studs: shape.studs,
    antistuds: shape.antistuds,
    box: shape.box,
  };
}

const shapeIds = new WeakMap<object, number>();
let nextShapeId = 1;
const shapeId = (o: object) => {
  let id = shapeIds.get(o);
  if (!id) shapeIds.set(o, (id = nextShapeId++));
  return id;
};
/** Order-sensitive hash of everything occlusion depends on. */
function signature(items: readonly OcclusionItem[]) {
  let h = 0x811c9dc5 ^ items.length;
  const mix = (v: number) => {
    h = Math.imul(h ^ (v | 0), 0x01000193);
    h = Math.imul(h ^ ((v * 1024) | 0), 0x01000193);
  };
  for (const item of items) {
    for (let i = 0; i < item.id.length; i++) mix(item.id.charCodeAt(i));
    for (const v of item.basis) mix(v);
    for (const v of item.position) mix(v);
    mix(item.opaque ? 1 : 2);
    mix(shapeId(item.studs));
    mix(item.box ? shapeId(item.box) : 0);
  }
  return h;
}
let last: {
  key: number;
  count: number;
  result: ReturnType<typeof computeOcclusion>;
} | null = null;
/**
 * computeOcclusion, reusing the last result for the same placements: the
 * renderer's budget check and the batches' classification of one model see
 * the same parts, so a load computes it once.
 */
export function occlusionOf(items: readonly OcclusionItem[]) {
  const key = signature(items);
  if (last && last.key === key && last.count === items.length)
    return last.result;
  const result = computeOcclusion(items);
  last = { key, count: items.length, result };
  return result;
}

export class HiddenGeometryView implements VariantProvider {
  private hidden = new Map<string, OcclusionResult>();
  lastStats: OcclusionStats | null = null;
  begin(batched: ReadonlyArray<readonly [string, OccurrenceHandle]>) {
    const items: OcclusionItem[] = [];
    for (const [id, handle] of batched) {
      // See-through (treated) parts hide nothing, and keep all of their own
      // geometry (the batches draw them unculled).
      if (!handle.visible || handle.treatments) continue;
      const item = occlusionItem(id, handle.matrix, handle.prototype);
      if (item) items.push(item);
    }
    const { hidden, stats } = occlusionOf(items);
    this.hidden = hidden;
    this.lastStats = stats;
  }
  variant(
    handle: OccurrenceHandle,
    template: DrawableTemplate,
  ): DrawVariant | undefined {
    const prototype = handle.prototype;
    if (!partRefs.has(prototype) || !opaquePrototype(prototype)) return;
    const shape = prototypeShape(prototype);
    if (!shape) return;
    const geometry = template.object.geometry;
    const classes = classesOf(template, shape);
    const cull = (h: HiddenParts) =>
      cullGeometry(geometry, !template.mesh, classes, h);
    const hidden = this.hidden.get(handle.id);
    const out: DrawVariant = {};
    if (hidden) {
      out.plain = hidden.enclosed ? null : cull(hidden);
      if (out.plain === geometry) delete out.plain;
    }
    if (shape.box && !hidden?.cavity) {
      out.closed = cull({ studs: [], cavity: true });
      out.plainClosed = hidden?.enclosed
        ? null
        : cull({ studs: hidden?.studs ?? [], cavity: true });
      out.opening = {
        normal: UP_OPENING,
        point: new THREE.Vector3(0, shape.box.max[1], 0),
      };
    }
    return out.plain !== undefined || out.opening ? out : undefined;
  }
  /** Triangles one placement draws in the plain view with its opening in
   * sight (budgets count this view-independent worst case). */
  static keptTriangles(
    prototype: THREE.Object3D,
    hidden: OcclusionResult | undefined,
  ) {
    let total = 0;
    const shape = hidden && prototypeShape(prototype);
    for (const t of meshTemplates(prototype)) {
      const g = t.object.geometry;
      const all = Math.floor(
        (g.index?.count ?? g.getAttribute("position")?.count ?? 0) / 3,
      );
      if (!hidden || !shape) total += all;
      else if (!hidden.enclosed)
        total += keptPrimitives(classesOf(t, shape), hidden);
    }
    return total;
  }
}
