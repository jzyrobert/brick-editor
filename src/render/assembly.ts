import * as THREE from "three";
import {
  cloneTree,
  drawableTemplates,
  type OccurrenceHandle,
} from "./occurrence-handles";

/**
 * Assembly view of the instruction viewer (docs/INSTRUCTIONS.md): the parts
 * tray beside the model and the fly-in of a step's new parts.
 *
 * - The **tray** lays one copy of every part × colour the step needs on a
 *   flat "carpet" beside the new parts, in the orientation they will be
 *   placed, with a "×N" tag for repeated parts.
 * - The **fly-in** hops every new part from its tray spot along an arc into
 *   place, staggered; a placed sub-assembly drops in from above as one. The
 *   parts' own handles stay hidden until every flyer has landed, so the
 *   render batches draw the previous step unchanged (and still culled) during
 *   the animation and classify once when the step is complete.
 *
 * Everything here is a handful of cloned part trees (shared geometry and
 * materials) under the model root, in LDraw coordinates (−Y up).
 */
export type Box = { min: THREE.Vector3; max: THREE.Vector3 };

/** Rows of footprints (x by z, LDU) for the tray, left to right, front to
 * back, wrapping at `maxWidth`. Returns each item's centre offset from the
 * tray's centre, and the tray's size. */
export function trayLayout(
  sizes: ReadonlyArray<{ x: number; z: number }>,
  gap = 20,
  maxWidth?: number,
) {
  const area = sizes.reduce((n, s) => n + (s.x + gap) * (s.z + gap), 0);
  const widest = Math.max(0, ...sizes.map((s) => s.x + gap));
  const width = Math.max(widest, maxWidth ?? Math.sqrt(area) * 1.4);
  const rows: { items: number[]; depth: number; width: number }[] = [];
  let row = { items: [] as number[], depth: 0, width: 0 };
  sizes.forEach((s, i) => {
    const w = s.x + gap;
    if (row.items.length && row.width + w > width + 1e-6) {
      rows.push(row);
      row = { items: [], depth: 0, width: 0 };
    }
    row.items.push(i);
    row.width += w;
    row.depth = Math.max(row.depth, s.z + gap);
  });
  if (row.items.length) rows.push(row);
  const total = {
    x: Math.max(0, ...rows.map((r) => r.width)),
    z: rows.reduce((n, r) => n + r.depth, 0),
  };
  const offsets: { x: number; z: number }[] = new Array(sizes.length);
  let z = -total.z / 2;
  for (const r of rows) {
    let x = -r.width / 2;
    for (const i of r.items) {
      const w = sizes[i].x + gap;
      offsets[i] = { x: x + w / 2, z: z + r.depth / 2 };
      x += w;
    }
    z += r.depth;
  }
  return { offsets, size: total };
}

export const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Where a hopping part is at progress `s` (0–1): along the straight line
 * with an arc lifted by `hop` (LDraw −Y is up). */
export function hopPoint(
  from: THREE.Vector3,
  to: THREE.Vector3,
  s: number,
  hop: number,
  out = new THREE.Vector3(),
) {
  const e = easeInOut(Math.min(1, Math.max(0, s)));
  out.lerpVectors(from, to, e);
  out.y -= Math.sin(Math.PI * e) * hop;
  return out;
}
/** Arc height for a hop of `distance` LDU. */
export const hopHeight = (distance: number) => 30 + 0.25 * distance;

/** Start delay of each of `n` flyers (ms): even steps, the whole stagger
 * held under `window`. */
export function staggerDelays(n: number, step = 110, window = 1500) {
  const gap = n > 1 ? Math.min(step, window / (n - 1)) : 0;
  return Array.from({ length: n }, (_, i) => i * gap);
}
export const FLY_MS = 560;
/** Steps with more movers than this appear without a fly-in. */
export const MAX_FLYERS = 40;
export const MAX_FLYING_PARTS = 600;
/** Parts wider or deeper than this (LDU, 10 studs) are not laid on the tray. */
export const MAX_TRAY_PART = 200;

const prototypeBoxes = new WeakMap<THREE.Object3D, THREE.Box3>();
/** Part-space bounds of a compiled prototype (its drawables' geometry). */
export function prototypeBox(prototype: THREE.Object3D) {
  let box = prototypeBoxes.get(prototype);
  if (box) return box;
  box = new THREE.Box3();
  const part = new THREE.Box3();
  for (const t of drawableTemplates(prototype)) {
    const g = t.object.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    box.union(part.copy(g.boundingBox!).applyMatrix4(t.local));
  }
  prototypeBoxes.set(prototype, box);
  return box;
}
/** Bounds of a handle relative to the model root. */
export function handleBox(handle: OccurrenceHandle, out = new THREE.Box3()) {
  return out.copy(prototypeBox(handle.prototype)).applyMatrix4(handle.matrix);
}

export type AssemblyLot = { representative: string; count: number };
export type AssemblyRequest = {
  /** Movers: each a part or a placed sub-assembly (occurrence IDs). */
  units: string[][];
  /** Tray contents (one representative occurrence per part × colour). */
  lots: AssemblyLot[];
  /** The tray's side of the new parts: a horizontal LDraw direction. */
  side: THREE.Vector3;
  /** Handles of the parts drawn now (the tray is raised above them). */
  shown: Iterable<OccurrenceHandle>;
  tray: boolean;
  animate: boolean;
};

type Flyer = {
  object: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  delay: number;
  hop: number;
  /** The unit's handles, and their matrices relative to the unit origin. */
  matrices: THREE.Matrix4[];
};

export class AssemblyView {
  readonly group = new THREE.Group();
  private tray = new THREE.Group();
  private flyers: Flyer[] = [];
  private labels: THREE.Sprite[] = [];
  private carpet?: THREE.Mesh;
  private started = 0;
  private done?: () => void;
  /** Bounds of the tray (model-root space), when one is shown. */
  trayBox: THREE.Box3 | null = null;
  /** Movers the current step flew in (0: it appeared at once). */
  flown = 0;
  constructor() {
    this.group.name = "instruction assembly";
    this.tray.name = "instruction parts tray";
    this.group.add(this.tray);
  }
  get animating() {
    return this.flyers.length > 0;
  }
  /**
   * Show the tray and start the fly-in of a step. `landed` runs once every
   * flyer is in place (at once without an animation).
   */
  begin(
    handles: ReadonlyMap<string, OccurrenceHandle>,
    request: AssemblyRequest,
    landed: () => void,
  ) {
    this.clear();
    const added = new THREE.Box3();
    const scratch = new THREE.Box3();
    for (const unit of request.units)
      for (const id of unit) {
        const h = handles.get(id);
        if (h) added.union(handleBox(h, scratch));
      }
    const traySpots = new Map<string, THREE.Vector3>();
    if (request.tray && request.lots.length && !added.isEmpty())
      this.layTray(handles, request, added, traySpots);
    const movers = request.units.filter((u) => u.some((id) => handles.has(id)));
    const leaves = movers.reduce((n, u) => n + u.length, 0);
    if (
      !request.animate ||
      !movers.length ||
      movers.length > MAX_FLYERS ||
      leaves > MAX_FLYING_PARTS
    ) {
      landed();
      return;
    }
    const delays = staggerDelays(movers.length);
    const size = added.getSize(new THREE.Vector3()).length();
    movers.forEach((unit, i) => {
      const group = new THREE.Group();
      group.matrixAutoUpdate = false;
      const unitBox = new THREE.Box3();
      for (const id of unit) {
        const h = handles.get(id);
        if (h) unitBox.union(handleBox(h, scratch));
      }
      const to = unitBox.getCenter(new THREE.Vector3());
      const matrices: THREE.Matrix4[] = [];
      for (const id of unit) {
        const h = handles.get(id);
        if (!h) continue;
        const part = cloneTree(h.prototype);
        part.matrixAutoUpdate = false;
        // Relative to the unit's centre, so the unit moves as one.
        part.matrix
          .copy(h.matrix)
          .premultiply(
            new THREE.Matrix4().makeTranslation(-to.x, -to.y, -to.z),
          );
        matrices.push(part.matrix.clone());
        noShadows(part);
        group.add(part);
      }
      const lot = unit.length === 1 ? traySpots.get(unit[0]) : undefined;
      // Parts hop from their tray spot; sub-assemblies (and parts without
      // a tray) drop in from above.
      const from = lot
        ? lot.clone()
        : to.clone().add(new THREE.Vector3(0, -Math.max(80, size * 0.6), 0));
      group.matrix.makeTranslation(from.x, from.y, from.z);
      group.visible = false;
      this.group.add(group);
      this.flyers.push({
        object: group,
        from,
        to,
        delay: delays[i],
        hop: lot ? hopHeight(from.distanceTo(to)) : 0,
        matrices,
      });
    });
    this.flown = this.flyers.length;
    this.started = performance.now();
    this.done = landed;
  }
  /** Advance the fly-in; returns whether more frames are needed. */
  tick(now = performance.now()) {
    if (!this.flyers.length) return false;
    const t = now - this.started;
    const at = new THREE.Vector3();
    let moving = false;
    for (const f of this.flyers) {
      const s = (t - f.delay) / FLY_MS;
      f.object.visible = s > 0;
      if (s < 1) moving = true;
      hopPoint(f.from, f.to, s, f.hop, at);
      f.object.matrix.makeTranslation(at.x, at.y, at.z);
      f.object.matrixWorldNeedsUpdate = true;
    }
    if (!moving) this.finish();
    return moving;
  }
  /** Land every flyer now (skip the animation). */
  finish() {
    for (const f of this.flyers) f.object.removeFromParent();
    this.flyers = [];
    const done = this.done;
    this.done = undefined;
    done?.();
  }
  clear() {
    for (const f of this.flyers) f.object.removeFromParent();
    this.flyers = [];
    this.done = undefined;
    this.tray.clear();
    for (const l of this.labels) {
      l.material.map?.dispose();
      l.material.dispose();
    }
    this.labels = [];
    this.carpet?.geometry.dispose();
    (this.carpet?.material as THREE.Material | undefined)?.dispose();
    this.carpet = undefined;
    this.trayBox = null;
    this.flown = 0;
  }
  private layTray(
    handles: ReadonlyMap<string, OccurrenceHandle>,
    request: AssemblyRequest,
    added: THREE.Box3,
    spots: Map<string, THREE.Vector3>,
  ) {
    // Keep the placed orientation, at the origin. Baseplates and other big
    // parts stay off the tray (they drop in from above instead).
    const oriented = (id: string) =>
      prototypeBox(handles.get(id)!.prototype)
        .clone()
        .applyMatrix4(
          new THREE.Matrix4().extractRotation(handles.get(id)!.matrix),
        );
    const lots = request.lots.filter((l) => {
      if (!handles.has(l.representative)) return false;
      const b = oriented(l.representative);
      return (
        b.max.x - b.min.x <= MAX_TRAY_PART && b.max.z - b.min.z <= MAX_TRAY_PART
      );
    });
    if (!lots.length) return;
    const boxes = lots.map((l) => oriented(l.representative));
    const layout = trayLayout(
      boxes.map((b) => ({ x: b.max.x - b.min.x, z: b.max.z - b.min.z })),
    );
    // Beside the new parts, on the chosen side, at the height they rest at.
    const side = request.side.clone().setY(0);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    const alongX = Math.abs(side.x) >= Math.abs(side.z);
    const half = (b: THREE.Box3, x: boolean) =>
      (x ? b.max.x - b.min.x : b.max.z - b.min.z) / 2;
    const reach =
      half(added, alongX) + 40 + (alongX ? layout.size.x : layout.size.z) / 2;
    const centre = added.getCenter(new THREE.Vector3());
    const origin = new THREE.Vector3(
      alongX ? centre.x + Math.sign(side.x || 1) * reach : centre.x,
      added.max.y,
      alongX ? centre.z : centre.z + Math.sign(side.z || 1) * reach,
    );
    // Raise the tray above any shown part under its footprint.
    const foot = new THREE.Box3(
      new THREE.Vector3(
        origin.x - layout.size.x / 2,
        -Infinity,
        origin.z - layout.size.z / 2,
      ),
      new THREE.Vector3(
        origin.x + layout.size.x / 2,
        Infinity,
        origin.z + layout.size.z / 2,
      ),
    );
    const box = new THREE.Box3();
    let floor = origin.y;
    for (const h of request.shown) {
      handleBox(h, box);
      if (
        box.max.x > foot.min.x &&
        box.min.x < foot.max.x &&
        box.max.z > foot.min.z &&
        box.min.z < foot.max.z
      )
        floor = Math.min(floor, box.min.y - 4);
    }
    origin.y = floor;
    const carpet = new THREE.Mesh(
      new THREE.BoxGeometry(layout.size.x + 16, 2, layout.size.z + 16),
      new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 1 }),
    );
    carpet.position.set(origin.x, origin.y + 1, origin.z);
    carpet.name = "tray carpet";
    this.carpet = carpet;
    this.tray.add(carpet);
    // In the model root's own (LDraw) space, not world space.
    const trayBox = new THREE.Box3(
      new THREE.Vector3(
        origin.x - layout.size.x / 2 - 8,
        origin.y,
        origin.z - layout.size.z / 2 - 8,
      ),
      new THREE.Vector3(
        origin.x + layout.size.x / 2 + 8,
        origin.y + 2,
        origin.z + layout.size.z / 2 + 8,
      ),
    );
    lots.forEach((lot, i) => {
      const h = handles.get(lot.representative)!;
      const b = boxes[i];
      const o = layout.offsets[i];
      // Resting on the carpet: its bottom (largest y) at the carpet top.
      const at = new THREE.Vector3(
        origin.x + o.x - (b.min.x + b.max.x) / 2,
        origin.y - b.max.y,
        origin.z + o.z - (b.min.z + b.max.z) / 2,
      );
      const copy = cloneTree(h.prototype);
      copy.matrixAutoUpdate = false;
      copy.matrix.extractRotation(h.matrix).setPosition(at);
      noShadows(copy);
      this.tray.add(copy);
      trayBox.union(b.clone().translate(at));
      // Flyers of this lot start at its spot (their own centre there).
      const spot = new THREE.Vector3(
        origin.x + o.x,
        origin.y - (b.max.y - b.min.y) / 2,
        origin.z + o.z,
      );
      for (const unit of request.units)
        if (unit.length === 1) {
          const u = handles.get(unit[0]);
          if (u && u.prototype === h.prototype && !spots.has(unit[0]))
            spots.set(unit[0], spot);
        }
      if (lot.count > 1) {
        const label = countLabel(lot.count);
        this.labels.push(label);
        const height = Math.max(16, Math.min(40, (b.max.x - b.min.x) * 0.5));
        label.scale.set(height * 1.6, height, 1);
        label.position.set(
          origin.x + o.x + (b.max.x - b.min.x) / 2,
          origin.y - (b.max.y - b.min.y) - height * 0.4,
          origin.z + o.z - (b.max.z - b.min.z) / 2,
        );
        this.tray.add(label);
      }
    });
    this.trayBox = trayBox;
  }
}

function noShadows(object: THREE.Object3D) {
  object.traverse((o) => {
    o.castShadow = false;
  });
}

/** A "×N" tag (a sprite that always faces the viewer, drawn on top). */
function countLabel(count: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 60;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(29, 34, 48, 0.92)";
  ctx.beginPath();
  ctx.roundRect(2, 2, 92, 56, 16);
  ctx.fill();
  ctx.fillStyle = "#f4f1ea";
  ctx.font = "700 34px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("×" + count, 48, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    }),
  );
  sprite.renderOrder = 10;
  sprite.name = "tray count";
  return sprite;
}
