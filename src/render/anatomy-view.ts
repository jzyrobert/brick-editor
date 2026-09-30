import * as THREE from "three";
import type { Occurrence, Project } from "../core/types";
import {
  anatomyGroups,
  anatomyOffset,
  planAnatomy,
  type AnatomyBasis,
  type AnatomyDirection,
  type AnatomyPlan,
  type Vec3,
} from "./anatomy";
import { drawableTemplates, type OccurrenceHandle } from "./occurrence-handles";

/** Time for the whole take-apart (or put-together) timeline, ms. */
export const ANATOMY_MS = 1800;
/** Longest frame step the timeline takes: a very slow frame slows the
 * animation instead of skipping most of it. */
const MAX_STEP_MS = 200;

export type AnatomyGroupStatus = {
  key: string;
  name: string;
  parts: number;
  role: "anchor" | "mover" | "stays";
  direction: AnatomyDirection | null;
  /** Travel at the current spread, LDU. */
  distance: number;
  mirror: string | null;
};
export type AnatomyStatus = {
  on: boolean;
  /** Timeline position: 0 assembled, 1 fully apart. */
  progress: number;
  /** Travel scale: 1 is just clear, up to 3. */
  spread: number;
  guides: boolean;
  /** The isolated group's key, if any. */
  focus: string | null;
  basis: AnatomyBasis | null;
  groups: AnatomyGroupStatus[];
  movers: number;
  /** Milliseconds the last plan took (grouping, bounds and directions). */
  planMs: number;
};
export type AnatomyInputOptions = {
  on?: boolean;
  spread?: number;
  guides?: boolean;
  focus?: string | null;
  /** false jumps straight to the end of the timeline. Default true. */
  animate?: boolean;
};

/** What the view needs from its renderer. */
export type AnatomyHost = {
  readonly handles: ReadonlyMap<string, OccurrenceHandle>;
  /** The model root (LDraw space): guides are drawn under it. */
  readonly parent: THREE.Object3D;
  project(): Project | undefined;
  occurrences(): readonly Occurrence[];
  /** Handle matrices changed: refill the batches and draw (motion: a frame
   * of an animation). */
  moved(motion: boolean): void;
  /** The isolated group changed: re-apply see-through treatments. */
  restyle(): void;
  /** State visible to the UI changed. */
  notify(): void;
};

const localBoxes = new WeakMap<THREE.Object3D, THREE.Box3>();
/** A prototype's bounds in its own space (all drawables, as fit() measures). */
function localBox(prototype: THREE.Group) {
  let box = localBoxes.get(prototype);
  if (!box) {
    box = new THREE.Box3();
    for (const t of drawableTemplates(prototype)) {
      const g = t.object.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      if (g.boundingBox && !g.boundingBox.isEmpty())
        box.union(g.boundingBox.clone().applyMatrix4(t.local));
    }
    localBoxes.set(prototype, box);
  }
  return box;
}

/** An occurrence's LDraw box at its home placement (from its transform). */
function homeBox(
  o: Occurrence,
  handle: OccurrenceHandle | undefined,
  out: Float64Array,
  at: number,
) {
  const b = o.transform.basis,
    p = o.transform.position;
  const box = handle ? localBox(handle.prototype) : null;
  if (!box || box.isEmpty()) {
    for (let k = 0; k < 3; k++) out[at + k] = out[at + 3 + k] = p[k];
    return;
  }
  const c = [
      (box.min.x + box.max.x) / 2,
      (box.min.y + box.max.y) / 2,
      (box.min.z + box.max.z) / 2,
    ],
    e = [
      (box.max.x - box.min.x) / 2,
      (box.max.y - box.min.y) / 2,
      (box.max.z - box.min.z) / 2,
    ];
  for (let r = 0; r < 3; r++) {
    const centre =
      p[r] + b[r * 3] * c[0] + b[r * 3 + 1] * c[1] + b[r * 3 + 2] * c[2];
    const extent =
      Math.abs(b[r * 3]) * e[0] +
      Math.abs(b[r * 3 + 1]) * e[1] +
      Math.abs(b[r * 3 + 2]) * e[2];
    out[at + r] = centre - extent;
    out[at + 3 + r] = centre + extent;
  }
}

/**
 * The Anatomy exploded view on a renderer's occurrence handles: plans once per
 * model state, then moves only handle translations (no rebuild, no document
 * change). See docs/ANATOMY.md.
 */
export class AnatomyView {
  private on = false;
  private suspended = false;
  private spread = 1;
  private guides = true;
  private focus: string | null = null;
  private progress = 0;
  private plan: AnatomyPlan | null = null;
  private planned: Project | null = null;
  private planMs = 0;
  /** Occurrence IDs per plan group, and their home translations. */
  private members: string[][] = [];
  private homes: Float64Array[] = [];
  /** Group offsets written to the handles (3 per group). */
  private applied = new Float64Array(0);
  private groupOf = new Map<string, number>();
  private raf = 0;
  private last = 0;
  private waiters: Array<() => void> = [];
  private guideLines: THREE.LineSegments | null = null;
  constructor(private readonly host: AnatomyHost) {}

  /** Whether any group is away from home (or on its way). */
  get active() {
    return this.progress > 0 || (this.on && !this.suspended);
  }
  get isOn() {
    return this.on;
  }

  status(): AnatomyStatus {
    const plan = this.plan;
    return {
      on: this.on,
      progress: Math.round(this.progress * 1000) / 1000,
      spread: this.spread,
      guides: this.guides,
      focus: this.focus,
      basis: plan?.basis ?? null,
      movers: plan?.movers ?? 0,
      planMs: this.planMs,
      groups:
        plan?.groups.map((g) => ({
          key: g.key,
          name: g.name,
          parts: g.parts,
          role: g.role,
          direction: g.direction,
          distance: Math.round(g.distance * this.spread * 10) / 10,
          mirror: g.mirror,
        })) ?? [],
    };
  }

  /** Change the view. Turning it on plans the groups (once per model state);
   * a model with nothing to take apart stays off (`movers` is 0). */
  set(input: AnatomyInputOptions) {
    if (input.spread !== undefined) {
      this.spread = Math.min(3, Math.max(0.25, input.spread));
    }
    if (input.guides !== undefined) this.guides = input.guides;
    if (input.on !== undefined && input.on !== this.on) {
      this.on = input.on;
      if (this.on) {
        this.ensurePlan();
        if (!this.plan?.movers) this.on = false;
      } else this.focus = null;
    }
    if (input.focus !== undefined) {
      const next =
        input.focus && this.plan?.groups.some((g) => g.key === input.focus)
          ? input.focus
          : null;
      if (next !== this.focus) {
        this.focus = next;
        this.host.restyle();
      }
    }
    if (input.on === false && this.focus === null) this.host.restyle();
    if (input.animate === false) {
      this.progress = this.target();
      this.stop();
      this.apply(false);
    } else if (input.spread !== undefined && this.progress > 0) {
      this.apply(false);
    }
    this.run();
    this.updateGuides();
    this.host.notify();
    return this.status();
  }

  /** Suspend (Play: at once) or resume (animated) without losing the setting. */
  suspend(suspended: boolean) {
    if (this.suspended === suspended) return;
    this.suspended = suspended;
    if (suspended && this.progress > 0) {
      // Play builds its world from the placed parts: back home at once.
      this.stop();
      this.progress = 0;
      this.apply(false);
      this.updateGuides();
    }
    this.run();
  }

  /** Resolves when the timeline has reached its target. */
  settled() {
    if (!this.raf) return Promise.resolve();
    return new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  /** LDraw bounds of the model fully apart at the current spread (null
   * without a plan). */
  explodedBox(): { min: Vec3; max: Vec3 } | null {
    const plan = this.plan;
    if (!plan || !plan.movers) return null;
    const min = [...plan.box.min] as Vec3,
      max = [...plan.box.max] as Vec3;
    for (const g of plan.groups) {
      const off = anatomyOffset(g, 1, this.spread);
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], g.box.min[k] + off[k]);
        max[k] = Math.max(max[k], g.box.max[k] + off[k]);
      }
    }
    return { min, max };
  }

  /** The group of an occurrence (for taps). */
  groupOfOccurrence(id: string) {
    const i = this.groupOf.get(id);
    return i === undefined ? null : (this.plan?.groups[i] ?? null);
  }

  /** Occurrences drawn see-through while a group is isolated. */
  ghosted(): Set<string> | null {
    if (!this.focus || !this.on || !this.plan) return null;
    const index = this.plan.groups.findIndex((g) => g.key === this.focus);
    if (index < 0) return null;
    const out = new Set<string>();
    this.members.forEach((ids, i) => {
      if (i !== index) for (const id of ids) out.add(id);
    });
    return out;
  }

  /** The handles were re-placed at home for a new document state. `fresh`: a
   * different model — the view turns off. Otherwise it re-plans and puts the
   * groups back where the timeline says, without animating. */
  replaced(fresh: boolean) {
    this.applied.fill(0);
    if (fresh) {
      this.reset();
      return;
    }
    if (!this.plan) return;
    const focus = this.focus;
    this.plan = null;
    this.planned = null;
    if (!this.on && !this.progress) {
      this.members = [];
      this.homes = [];
      this.groupOf.clear();
      this.updateGuides();
      return;
    }
    this.ensurePlan();
    const plan = this.plan as AnatomyPlan | null;
    if (!plan?.movers) {
      this.reset();
      return;
    }
    if (focus && !plan.groups.some((g) => g.key === focus)) this.focus = null;
    this.apply(false);
    this.updateGuides();
    this.host.notify();
  }

  /** Back to assembled and off at once (a new model, or the floor explode). */
  reset() {
    this.stop();
    const moved = this.progress > 0;
    this.on = false;
    this.focus = null;
    this.progress = 0;
    if (moved && this.plan) this.apply(false);
    this.plan = null;
    this.planned = null;
    this.members = [];
    this.homes = [];
    this.applied = new Float64Array(0);
    this.groupOf.clear();
    this.updateGuides();
    this.host.restyle();
    this.host.notify();
  }

  dispose() {
    this.stop();
    this.guideLines?.removeFromParent();
    this.guideLines?.geometry.dispose();
    (this.guideLines?.material as THREE.Material | undefined)?.dispose();
    this.guideLines = null;
  }

  private target() {
    return this.on && !this.suspended ? 1 : 0;
  }

  private ensurePlan() {
    const project = this.host.project();
    if (!project) return;
    if (this.plan && this.planned === project) return;
    const started = performance.now();
    const all = this.host.occurrences();
    const handles = this.host.handles;
    const boxes = new Float64Array(all.length * 6);
    all.forEach((o, i) => homeBox(o, handles.get(o.id), boxes, i * 6));
    const found = anatomyGroups(project, all, (_, i) =>
      boxes.subarray(i * 6, i * 6 + 6),
    );
    this.planned = project;
    if (!found) {
      this.plan = null;
      this.planMs = Math.round(performance.now() - started);
      return;
    }
    const index = new Map<string, number>();
    all.forEach((o, i) => index.set(o.id, i));
    this.members = found.groups.map((g) => g.ids);
    this.homes = found.groups.map((g) => {
      const home = new Float64Array(g.ids.length * 3);
      g.ids.forEach((id, n) =>
        home.set(all[index.get(id)!].transform.position, n * 3),
      );
      return home;
    });
    this.groupOf.clear();
    found.groups.forEach((g, i) => {
      for (const id of g.ids) this.groupOf.set(id, i);
    });
    this.plan = planAnatomy(
      found.basis,
      found.groups.map((g) => {
        const own = new Float64Array(g.ids.length * 6);
        g.ids.forEach((id, n) => {
          const i = index.get(id)!;
          own.set(boxes.subarray(i * 6, i * 6 + 6), n * 6);
        });
        return { ...g, boxes: own };
      }),
    );
    this.applied = new Float64Array(found.groups.length * 3);
    this.planMs = Math.round(performance.now() - started);
  }

  private run() {
    if (this.raf || this.progress === this.target()) {
      if (!this.raf) this.resolve();
      return;
    }
    if (this.target() > 0) this.ensurePlan();
    if (!this.plan) {
      this.progress = 0;
      this.resolve();
      return;
    }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.step);
  }

  private step = (now: number) => {
    this.raf = 0;
    const target = this.target();
    const dt = Math.min(MAX_STEP_MS, Math.max(0, now - this.last));
    this.last = now;
    const rate = dt / ANATOMY_MS;
    this.progress =
      target > this.progress
        ? Math.min(target, this.progress + rate)
        : Math.max(target, this.progress - rate);
    const done = this.progress === target;
    this.apply(!done);
    if (done) {
      this.updateGuides();
      this.resolve();
      this.host.notify();
      return;
    }
    this.raf = requestAnimationFrame(this.step);
  };

  private stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resolve();
  }

  private resolve() {
    const waiters = this.waiters;
    this.waiters = [];
    for (const w of waiters) w();
  }

  /** Write every group's offset for the current timeline into its handles:
   * home + offset, so assembling restores the exact home translation. */
  private apply(motion: boolean) {
    const plan = this.plan;
    if (!plan) return;
    let changed = false;
    plan.groups.forEach((group, i) => {
      if (!group.direction) return;
      const off = anatomyOffset(group, this.progress, this.spread);
      const a = this.applied;
      if (
        a[i * 3] === off[0] &&
        a[i * 3 + 1] === off[1] &&
        a[i * 3 + 2] === off[2]
      )
        return;
      a.set(off, i * 3);
      changed = true;
      const ids = this.members[i],
        home = this.homes[i];
      for (let n = 0; n < ids.length; n++) {
        const handle = this.host.handles.get(ids[n]);
        if (!handle) continue;
        const e = handle.matrix.elements;
        e[12] = home[n * 3] + off[0];
        e[13] = home[n * 3 + 1] + off[1];
        e[14] = home[n * 3 + 2] + off[2];
        handle.moved();
      }
    });
    if (!changed) return;
    this.updateGuides();
    this.host.moved(motion);
  }

  /** Thin lines from each moved group's home centre to where it is now. */
  private updateGuides() {
    const plan = this.plan;
    const points: number[] = [];
    if (plan && this.guides && this.progress > 0)
      plan.groups.forEach((g, i) => {
        if (!g.direction) return;
        const a = this.applied;
        if (!a[i * 3] && !a[i * 3 + 1] && !a[i * 3 + 2]) return;
        const c = [0, 1, 2].map((k) => (g.box.min[k] + g.box.max[k]) / 2);
        points.push(
          c[0],
          c[1],
          c[2],
          c[0] + a[i * 3],
          c[1] + a[i * 3 + 1],
          c[2] + a[i * 3 + 2],
        );
      });
    if (!points.length) {
      if (this.guideLines) this.guideLines.visible = false;
      return;
    }
    if (!this.guideLines) {
      this.guideLines = new THREE.LineSegments(
        new THREE.BufferGeometry(),
        new THREE.LineDashedMaterial({
          color: 0x4a90d9,
          dashSize: 6,
          gapSize: 6,
          transparent: true,
          opacity: 0.8,
          depthTest: false,
        }),
      );
      this.guideLines.name = "anatomy guides";
      this.guideLines.renderOrder = 10;
      this.guideLines.userData.helper = true;
      this.host.parent.add(this.guideLines);
    }
    const geometry = this.guideLines.geometry;
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(points, 3),
    );
    this.guideLines.computeLineDistances();
    geometry.computeBoundingSphere();
    this.guideLines.visible = true;
  }
}
