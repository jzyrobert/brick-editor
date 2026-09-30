/**
 * Loading skeleton: while a newly opened model's parts compile, every
 * occurrence is drawn as a translucent box of its part's real bounds, and the
 * model is revealed from the ground up (or in instruction-step order) as the
 * compiled parts replace their boxes.
 *
 * The whole skeleton is one instanced draw of a 12-triangle box: per instance
 * three scaled axis columns and a centre (the part's local bounds carried
 * through its placement) plus a reveal rank. Revealing a part only rewrites its
 * rank, one float, so hiding boxes as parts arrive costs a small buffer upload
 * per partial frame, however large the model.
 */
import * as THREE from "three";
import type { Bounds } from "../core/spatial";
import type { Occurrence, Project, Vec3 } from "../core/types";

/** Box drawn for a part whose bounds are unknown: a 1 × 1 brick body (LDraw, −Y up). */
export const FALLBACK_BOX: Bounds = { min: [-10, 0, -10], max: [10, 24, 10] };
/** Floats per instance in `RevealPlan.boxes`: three scaled axes and a centre. */
export const BOX_FLOATS = 12;

export type RevealPlan = {
  /** Reveal rank of each occurrence (0 is revealed first). */
  rank: Uint32Array;
  /** Occurrence indices in reveal order (`order[rank[i]] === i`). */
  order: Uint32Array;
  /** Per occurrence: box x, y and z axes scaled to its size, then its centre,
   * in the model's LDraw space (BOX_FLOATS each). */
  boxes: Float32Array;
  /** LDraw bounds of every box. */
  min: Vec3;
  max: Vec3;
  /** Whether the order follows an instruction plan's steps. */
  bySteps: boolean;
};

/**
 * Step of each occurrence in the model's instruction plan (the imported LDraw
 * steps, else the first plan), or null when no plan has at least two steps.
 * Occurrences the plan leaves out come after its last step.
 */
export function occurrenceSteps(
  project: Project,
  all: readonly Occurrence[],
): Int32Array | null {
  const plans = project.instructionPlans ?? {};
  const plan =
    plans.imported ??
    Object.values(plans).find((candidate) => candidate.steps.length > 1);
  if (!plan || plan.steps.length < 2) return null;
  const stepOf = new Map<string, number>();
  plan.steps.forEach((ids, step) => {
    for (const id of ids) if (!stepOf.has(id)) stepOf.set(id, step);
  });
  const steps = new Int32Array(all.length);
  let placed = 0;
  for (let i = 0; i < all.length; i++) {
    const step = stepOf.get(all[i].id);
    if (step !== undefined) placed++;
    steps[i] = step ?? plan.steps.length;
  }
  // A plan that covers almost none of the model says little about its order.
  return placed * 4 >= all.length ? steps : null;
}

const INDEX_BITS = 2 ** 18,
  HEIGHT_BITS = 2 ** 21,
  STEP_LIMIT = 4095;

/**
 * Where each occurrence's box is and the order to reveal them in: by
 * instruction step when the model has steps, then from the ground up (largest
 * LDraw Y of the box first, since −Y is up), then in document order.
 * `localBounds` gives an occurrence's part bounds in its own space (null when
 * unknown: FALLBACK_BOX is drawn). `pace` is called every 1,024 occurrences and
 * may end the task; it returns false to abandon the plan.
 */
export async function planReveal(
  all: readonly Occurrence[],
  localBounds: (o: Occurrence) => Bounds | null,
  steps: Int32Array | null = null,
  pace?: () => Promise<boolean>,
): Promise<RevealPlan | null> {
  const n = all.length;
  const boxes = new Float32Array(n * BOX_FLOATS);
  const bottoms = new Float64Array(n);
  const min: Vec3 = [Infinity, Infinity, Infinity],
    max: Vec3 = [-Infinity, -Infinity, -Infinity];
  let lowest = -Infinity;
  const c = new Float64Array(3),
    h = new Float64Array(3);
  for (let i = 0; i < n; i++) {
    const o = all[i];
    const local = localBounds(o) ?? FALLBACK_BOX;
    const b = o.transform.basis,
      p = o.transform.position;
    for (let k = 0; k < 3; k++) {
      c[k] = (local.min[k] + local.max[k]) / 2;
      // A hair inside the part, so neighbouring boxes read as separate parts.
      h[k] = Math.max(0.5, (local.max[k] - local.min[k]) / 2 - 0.4);
    }
    // A mirrored placement would turn the box inside out; a box is symmetric,
    // so flipping one axis gives the same box with outward faces.
    const det =
      b[0] * (b[4] * b[8] - b[5] * b[7]) -
      b[1] * (b[3] * b[8] - b[5] * b[6]) +
      b[2] * (b[3] * b[7] - b[4] * b[6]);
    const flip = det < 0 ? -1 : 1;
    const at = i * BOX_FLOATS;
    for (let row = 0; row < 3; row++) {
      const r0 = b[row * 3],
        r1 = b[row * 3 + 1],
        r2 = b[row * 3 + 2];
      boxes[at + row] = r0 * 2 * h[0] * flip;
      boxes[at + 3 + row] = r1 * 2 * h[1];
      boxes[at + 6 + row] = r2 * 2 * h[2];
      const centre = r0 * c[0] + r1 * c[1] + r2 * c[2] + p[row];
      boxes[at + 9 + row] = centre;
      const reach =
        Math.abs(r0) * h[0] + Math.abs(r1) * h[1] + Math.abs(r2) * h[2];
      if (centre - reach < min[row]) min[row] = centre - reach;
      if (centre + reach > max[row]) max[row] = centre + reach;
      if (row === 1) {
        bottoms[i] = centre + reach;
        if (bottoms[i] > lowest) lowest = bottoms[i];
      }
    }
    if ((i & 1023) === 1023 && pace && !(await pace())) return null;
  }
  // One numeric sort of packed keys (step, height above the lowest point in
  // whole LDU, index) instead of a comparator sort: about ten times faster
  // for 150,000 parts, short enough for one task.
  const order = new Uint32Array(n);
  if (n < INDEX_BITS) {
    const keys = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const step = steps ? Math.min(STEP_LIMIT, Math.max(0, steps[i])) : 0;
      const height = Math.min(
        HEIGHT_BITS - 1,
        Math.max(0, Math.round(lowest - bottoms[i])),
      );
      keys[i] = (step * HEIGHT_BITS + height) * INDEX_BITS + i;
    }
    keys.sort();
    for (let r = 0; r < n; r++) order[r] = keys[r] % INDEX_BITS;
  } else {
    const indices = Array.from({ length: n }, (_, i) => i);
    indices.sort(
      (a, b) =>
        (steps ? steps[a] - steps[b] : 0) || bottoms[b] - bottoms[a] || a - b,
    );
    order.set(indices);
  }
  const rank = new Uint32Array(n);
  for (let r = 0; r < n; r++) rank[order[r]] = r;
  if (!n) {
    min.fill(0);
    max.fill(0);
  }
  return { rank, order, boxes, min, max, bySteps: !!steps };
}

/**
 * Which arrived occurrences to reveal now so the model grows upward rather
 * than in compile order: those ranked below the number of occurrences arrived
 * so far. A part shared by the ground floor and the roof compiles once, but
 * its roof copies wait until the parts below them have arrived. Returns the
 * revealed indices and keeps the rest in `arrived`.
 */
export function takeRevealable(
  arrived: number[],
  rank: Uint32Array,
  arrivedTotal: number,
): number[] {
  const now: number[] = [],
    later: number[] = [];
  for (const i of arrived) (rank[i] < arrivedTotal ? now : later).push(i);
  arrived.length = 0;
  for (const i of later) arrived.push(i);
  return now;
}

/** Most boxes one skeleton draws: a larger model is drawn as boxes around
 * the parts in each cell of a grid (see skeletonInstances). */
export const SKELETON_BOX_LIMIT = 20_000;

export type SkeletonInstances = {
  /** Boxes in draw order (BOX_FLOATS each), top down: last revealed first. */
  boxes: Float32Array;
  /** Normalized reveal rank of each box (0 first), for the growth front. */
  ranks: Float32Array;
  /** Box of each occurrence (an index into `ranks`). */
  boxOf: Uint32Array;
  /** Occurrences each box stands for. */
  members: Uint32Array;
  /** Grid cell size (LDU), or 0 for one box per occurrence. */
  cell: number;
};

/**
 * The boxes a skeleton draws. Up to `limit` occurrences, one box each. Above
 * it, the occurrences are gathered into cells of a uniform grid, sized so no
 * more than `limit` cells are occupied, and each occupied cell is drawn as
 * the axis-aligned box around its parts: a silhouette that costs a phone GPU
 * (or a software rasterizer) a fraction of 150,000 boxes. A cell is revealed
 * with the first of its parts and hidden once all of them are drawn.
 */
export function skeletonInstances(
  plan: RevealPlan,
  limit = SKELETON_BOX_LIMIT,
): SkeletonInstances {
  const n = plan.rank.length;
  if (n <= limit) {
    const boxes = new Float32Array(n * BOX_FLOATS);
    const ranks = new Float32Array(n);
    const boxOf = new Uint32Array(n);
    const scale = n > 1 ? 1 / n : 0;
    for (let r = 0; r < n; r++) {
      const i = plan.order[r],
        slot = n - 1 - r;
      boxes.set(
        plan.boxes.subarray(i * BOX_FLOATS, (i + 1) * BOX_FLOATS),
        slot * BOX_FLOATS,
      );
      ranks[slot] = r * scale;
      boxOf[i] = slot;
    }
    return {
      boxes,
      ranks,
      boxOf,
      members: new Uint32Array(n).fill(1),
      cell: 0,
    };
  }
  const extent = [0, 1, 2].map((k) => Math.max(1, plan.max[k] - plan.min[k]));
  let size = Math.max(
    24,
    Math.cbrt((extent[0] * extent[1] * extent[2]) / limit),
  );
  const cellOf = new Uint32Array(n);
  let cells = new Map<number, number>();
  for (let attempt = 0; ; attempt++) {
    cells = new Map();
    const across = extent.map((e) => Math.floor(e / size) + 1);
    for (let i = 0; i < n; i++) {
      const at = i * BOX_FLOATS;
      const x = Math.floor((plan.boxes[at + 9] - plan.min[0]) / size),
        y = Math.floor((plan.boxes[at + 10] - plan.min[1]) / size),
        z = Math.floor((plan.boxes[at + 11] - plan.min[2]) / size);
      const key = (y * across[2] + z) * across[0] + x;
      let c = cells.get(key);
      if (c === undefined) cells.set(key, (c = cells.size));
      cellOf[i] = c;
    }
    if (cells.size <= limit || attempt > 12) break;
    size *= 1.25;
  }
  const g = cells.size;
  // Each cell: the box around its parts and its first reveal rank.
  const low = new Float64Array(g * 3).fill(Infinity),
    high = new Float64Array(g * 3).fill(-Infinity),
    first = new Uint32Array(g).fill(0xffffffff),
    members = new Uint32Array(g);
  for (let i = 0; i < n; i++) {
    const c = cellOf[i],
      at = i * BOX_FLOATS;
    members[c]++;
    if (plan.rank[i] < first[c]) first[c] = plan.rank[i];
    for (let k = 0; k < 3; k++) {
      const reach =
        (Math.abs(plan.boxes[at + k]) +
          Math.abs(plan.boxes[at + 3 + k]) +
          Math.abs(plan.boxes[at + 6 + k])) /
        2;
      const centre = plan.boxes[at + 9 + k];
      if (centre - reach < low[c * 3 + k]) low[c * 3 + k] = centre - reach;
      if (centre + reach > high[c * 3 + k]) high[c * 3 + k] = centre + reach;
    }
  }
  const byFirst = Array.from({ length: g }, (_, c) => c).sort(
    (a, b) => first[a] - first[b],
  );
  const boxes = new Float32Array(g * BOX_FLOATS),
    ranks = new Float32Array(g),
    slotOf = new Uint32Array(g),
    slotMembers = new Uint32Array(g);
  byFirst.forEach((c, r) => {
    const slot = g - 1 - r,
      at = slot * BOX_FLOATS;
    slotOf[c] = slot;
    slotMembers[slot] = members[c];
    ranks[slot] = first[c] / n;
    for (let k = 0; k < 3; k++) {
      // A hair inside the cell's parts, like a part's own box.
      const half = Math.max(0.5, (high[c * 3 + k] - low[c * 3 + k]) / 2 - 0.4);
      boxes[at + k * 4] = 2 * half;
      boxes[at + 9 + k] = (high[c * 3 + k] + low[c * 3 + k]) / 2;
    }
  });
  const boxOf = new Uint32Array(n);
  for (let i = 0; i < n; i++) boxOf[i] = slotOf[cellOf[i]];
  return { boxes, ranks, boxOf, members: slotMembers, cell: size };
}

/** Instances animated in growing upward; larger skeletons appear at once. */
export const SKELETON_ANIMATED_LIMIT = 40_000;
/** Length of the upward growth when the skeleton appears. */
export const SKELETON_GROW_MS = 700;

const vertexShader = /* glsl */ `
attribute vec3 aAxisX;
attribute vec3 aAxisY;
attribute vec3 aAxisZ;
attribute vec3 aCentre;
attribute float aRank;
uniform float uFront;
varying vec3 vUnit;
varying vec3 vSize;
varying vec3 vFaceNormal;
varying float vShade;
varying float vAppear;
void main() {
  // Revealed (negative rank) or not yet grown in: no fragments at all.
  float appear = clamp((uFront - aRank) * 10.0, 0.0, 1.0);
  if (aRank < 0.0 || appear <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec3 local = aCentre + aAxisX * position.x + aAxisY * position.y + aAxisZ * position.z;
  // Rise into place (LDraw +Y is down) while growing in.
  local.y += (1.0 - appear) * 16.0;
  vUnit = position;
  vSize = vec3(length(aAxisX), length(aAxisY), length(aAxisZ));
  vFaceNormal = normal;
  vec3 axis = aAxisX * normal.x + aAxisY * normal.y + aAxisZ * normal.z;
  vec3 world = normalize(mat3(modelMatrix) * axis);
  vShade = 0.7 + 0.3 * max(dot(world, normalize(vec3(0.35, 0.9, 0.25))), 0.0);
  vAppear = appear;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(local, 1.0);
}
`;
const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uEdge;
uniform float uOpacity;
varying vec3 vUnit;
varying vec3 vSize;
varying vec3 vFaceNormal;
varying float vShade;
varying float vAppear;
void main() {
  // Distance to the face's nearest edge in pixels: a one-pixel outline.
  vec3 d = (0.5 - abs(vUnit)) * vSize;
  vec3 px = d / max(fwidth(d), vec3(1e-4));
  px += abs(vFaceNormal) * 1e4;
  float line = 1.0 - clamp(min(px.x, min(px.y, px.z)) - 0.5, 0.0, 1.0);
  vec3 color = mix(uColor * vShade, uEdge, line * 0.85);
  gl_FragColor = vec4(color, mix(uOpacity, 0.75, line) * vAppear);
  #include <colorspace_fragment>
}
`;
let sharedMaterial: THREE.ShaderMaterial | undefined;
/** One material for every load, so its program links once per page. */
function skeletonMaterial() {
  return (sharedMaterial ??= new THREE.ShaderMaterial({
    name: "load skeleton",
    vertexShader,
    fragmentShader,
    uniforms: {
      uFront: { value: 1 },
      // Neutral blue-grey that reads on the blank canvas and on grass,
      // street and sand backdrops alike.
      uColor: { value: new THREE.Color("#b4c0c8") },
      uEdge: { value: new THREE.Color("#3f4b53") },
      uOpacity: { value: 0.45 },
    },
    transparent: true,
    depthWrite: true,
    toneMapped: false,
  }));
}

export function prefersReducedMotion() {
  try {
    return (
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return false;
  }
}

/** The drawn skeleton of one load. */
export class LoadSkeleton {
  readonly mesh: THREE.Mesh<
    THREE.InstancedBufferGeometry,
    THREE.ShaderMaterial
  >;
  private ranks: THREE.InstancedBufferAttribute;
  /** Box of each occurrence, and parts each box still waits for. */
  private readonly boxOf: Uint32Array;
  private readonly remaining: Uint32Array;
  /** Boxes drawn, and the grid cell size when parts share boxes (else 0). */
  readonly boxCount: number;
  readonly cell: number;
  private grownAt: number;
  private revealedCount = 0;
  private readonly total: number;
  constructor(
    plan: RevealPlan,
    options: { now: number; animate: boolean; limit?: number },
  ) {
    const n = plan.rank.length;
    this.total = n;
    const box = new THREE.BoxGeometry(1, 1, 1);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setIndex(box.getIndex());
    geometry.setAttribute("position", box.getAttribute("position"));
    geometry.setAttribute("normal", box.getAttribute("normal"));
    // Instances run top down (last revealed first): seen from above, as a
    // model usually is, upper boxes fill the depth buffer first and the
    // boxes below them are rejected before blending (overdraw is what a
    // large skeleton costs a phone GPU or a software rasterizer).
    const instances = skeletonInstances(plan, options.limit);
    const slots = instances.boxes;
    const count = instances.ranks.length;
    this.boxOf = instances.boxOf;
    this.remaining = instances.members.slice();
    this.boxCount = count;
    this.cell = instances.cell;
    const boxes = new THREE.InstancedInterleavedBuffer(slots, BOX_FLOATS);
    geometry.setAttribute(
      "aAxisX",
      new THREE.InterleavedBufferAttribute(boxes, 3, 0),
    );
    geometry.setAttribute(
      "aAxisY",
      new THREE.InterleavedBufferAttribute(boxes, 3, 3),
    );
    geometry.setAttribute(
      "aAxisZ",
      new THREE.InterleavedBufferAttribute(boxes, 3, 6),
    );
    geometry.setAttribute(
      "aCentre",
      new THREE.InterleavedBufferAttribute(boxes, 3, 9),
    );
    // Normalized rank, so the growth front runs 0 → 1 whatever the size.
    this.ranks = new THREE.InstancedBufferAttribute(instances.ranks, 1);
    this.ranks.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aRank", this.ranks);
    geometry.instanceCount = count;
    this.mesh = new THREE.Mesh(geometry, skeletonMaterial());
    this.mesh.name = "load skeleton";
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = this.mesh.receiveShadow = false;
    // Same LDraw → world turn as the model root.
    this.mesh.rotation.x = Math.PI;
    this.mesh.onBeforeRender = (
      _renderer,
      _scene,
      _camera,
      _geometry,
      material,
    ) => {
      // A pass with an override material (ambient occlusion's normals) has
      // no per-box attributes: draw no instances there.
      geometry.instanceCount = material === this.mesh.material ? count : 0;
      this.mesh.material.uniforms.uFront.value = this.front(performance.now());
    };
    this.grownAt = options.animate ? options.now + SKELETON_GROW_MS : 0;
  }
  /** Instances in all, and those replaced by their parts. */
  get instances() {
    return this.total;
  }
  get revealed() {
    return this.revealedCount;
  }
  /** Growth front: 0 → 1.1 while growing in (the last boxes need a margin to
   * fade in fully), then past every rank. */
  front(now: number) {
    if (!this.grownAt || now >= this.grownAt) return 2;
    return 1.1 * (1 - (this.grownAt - now) / SKELETON_GROW_MS);
  }
  /** Whether frames must keep coming for the growth animation. */
  animating(now: number) {
    return !!this.grownAt && now < this.grownAt;
  }
  /** Hide the boxes of occurrences (indices into the planned list) whose
   * parts are now drawn. */
  reveal(indices: readonly number[]) {
    if (!indices.length) return;
    const array = this.ranks.array as Float32Array;
    let lo = Infinity,
      hi = -1;
    for (const i of indices) {
      const slot = this.boxOf[i];
      if (array[slot] < 0 || this.remaining[slot] === 0) continue;
      this.revealedCount++;
      // A shared box goes once every part it stands for is drawn.
      if (--this.remaining[slot]) continue;
      array[slot] = -1;
      if (slot < lo) lo = slot;
      if (slot > hi) hi = slot;
    }
    if (hi < 0) return;
    this.ranks.clearUpdateRanges();
    this.ranks.addUpdateRange(lo, hi - lo + 1);
    this.ranks.needsUpdate = true;
  }
  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
  }
}
