import { partSpec } from "../catalog/extended";
import type {
  InstructionPlan,
  Node,
  Occurrence,
  Project,
  Transform,
  Vec3,
} from "../core/types";

/**
 * Follow-along building guides (docs/INSTRUCTIONS.md): the step sequence the
 * instruction viewer walks through, derived from the loaded model without
 * changing it.
 *
 * - **Model steps.** A model whose files carry `0 STEP` / `0 ROTSTEP` lines
 *   (official LDraw OMR sets, LPub/LeoCAD/Studio exports) is followed as
 *   written, in every submodel as well as the main model.
 * - **Generated steps.** Anything else (the built-in samples, custom builds)
 *   gets steps made here: parts bottom-up by the height they stand at, a
 *   layer split into spatially compact runs, runs of 3–12 parts, small layers
 *   merged.
 * - **Sub-assemblies.** A submodel that is placed more than once, or placed
 *   away from its parent's origin, is a real sub-assembly: its steps come
 *   first as a *callout* (built on its own, from its first placement), then
 *   the parent step places every copy at once. A submodel placed once at the
 *   origin (a floor, a layer-like split) is built in place, its steps spliced
 *   into the parent's.
 * - **Authored plans.** Instruction plans saved in the project (the
 *   Instructions mode editor) can be followed too, as one flat sequence.
 *
 * The guide keeps every occurrence ID once. A step's view is the prefix of its
 * sequence (`sequences[s].ids.slice(0, step.end)`), so a 150,000-part model
 * costs one ID list per sequence, not one per step.
 */
export type GuideLot = { ref: string; colorCode: string; count: number };
export type GuideAssembly = { modelId: string; name: string; count: number };
export type GuideStep = {
  /** Sequence (main model or a callout) the step belongs to. */
  sequence: number;
  /** Length of the sequence's ID prefix shown once this step is done. */
  end: number;
  /** Occurrences this step introduces (every leaf of placed sub-assemblies). */
  added: string[];
  /** What moves together into place: one part, or one placed sub-assembly. */
  units: string[][];
  /** Loose parts this step needs (part × colour), largest count first. */
  lots: GuideLot[];
  /** Built sub-assemblies this step places. */
  assemblies: GuideAssembly[];
};
export type GuideSequence = {
  kind: "model" | "callout";
  modelId: string;
  name: string;
  /** Copies the parent places of this callout's sub-assembly. */
  instances: number;
  /** Nesting depth (0: the main model). */
  depth: number;
  ids: string[];
};
export type GuideSource = "model-steps" | "generated" | "plan";
export type Guide = {
  source: GuideSource;
  label: string;
  steps: GuideStep[];
  sequences: GuideSequence[];
  /** Occurrences in the guide (every leaf of the model once). */
  occurrences: number;
};
export type GuideOptions = {
  /** Most parts in a generated step (default 8). */
  maxPerStep?: number;
  /** Generated steps smaller than this merge with a neighbour (default 3). */
  minPerStep?: number;
};

const STEP_LINE = /^0\s+(?:STEP|ROTSTEP)(?:\s|$)/i;
/** One plate: layers closer than this share a step layer. */
const LAYER_LDU = 8;
/** Serpentine rows of four studs keep a layer's runs compact. */
const ROW_LDU = 80;

type Box = { min: Vec3; max: Vec3 };
const emptyBox = (): Box => ({
  min: [Infinity, Infinity, Infinity],
  max: [-Infinity, -Infinity, -Infinity],
});
function transformBox(t: Transform, box: Box, out: Box) {
  if (!Number.isFinite(box.min[0])) return out;
  const b = t.basis,
    p = t.position;
  for (let i = 0; i < 8; i++) {
    const x = i & 1 ? box.max[0] : box.min[0],
      y = i & 2 ? box.max[1] : box.min[1],
      z = i & 4 ? box.max[2] : box.min[2];
    for (let k = 0; k < 3; k++) {
      const v = p[k] + b[k * 3] * x + b[k * 3 + 1] * y + b[k * 3 + 2] * z;
      if (v < out.min[k]) out.min[k] = v;
      if (v > out.max[k]) out.max[k] = v;
    }
  }
  return out;
}
const isIdentity = (t: Transform) =>
  t.position.every((v) => Math.abs(v) < 1e-6) &&
  t.basis.every((v, i) => Math.abs(v - (i % 4 === 0 ? 1 : 0)) < 1e-6);

/** Loose parts of a set of occurrences, by part and colour. */
export function lotsOf(list: Iterable<Occurrence>): GuideLot[] {
  const lots = new Map<string, GuideLot>();
  for (const o of list) {
    if (o.node.kind !== "part") continue;
    const key = o.node.ref + "\u0000" + o.colorCode;
    const lot = lots.get(key);
    if (lot) lot.count++;
    else lots.set(key, { ref: o.node.ref, colorCode: o.colorCode, count: 1 });
  }
  return [...lots.values()].sort(
    (a, b) =>
      b.count - a.count ||
      a.ref.localeCompare(b.ref) ||
      a.colorCode.localeCompare(b.colorCode),
  );
}

/** Whether any model of the project splits its content with STEP lines. */
export function hasModelSteps(project: Project) {
  for (const model of Object.values(project.models))
    if (stepGroups(model.records, model.nodes)) return true;
  return false;
}

/** A model's nodes split at STEP/ROTSTEP lines (nodes without a source line
 * join the last step), or null when the file does not split it. */
function stepGroups(
  records: Project["models"][string]["records"],
  nodes: Node[],
): Node[][] | null {
  let boundaries = 0;
  for (const r of records) if (STEP_LINE.test(r.raw)) boundaries++;
  if (!boundaries) return null;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const groups: Node[][] = [];
  let group: Node[] = [];
  const placed = new Set<string>();
  for (const r of records) {
    if (STEP_LINE.test(r.raw)) {
      if (group.length) groups.push(group);
      group = [];
    } else if (r.nodeId) {
      const node = byId.get(r.nodeId);
      if (node && !placed.has(node.id)) {
        placed.add(node.id);
        group.push(node);
      }
    }
  }
  const unplaced = nodes.filter((n) => !placed.has(n.id));
  if (unplaced.length) group.push(...unplaced);
  if (group.length) groups.push(group);
  // A single trailing STEP splits nothing: generate steps instead.
  return groups.length > 1 ? groups : null;
}

type Unit = {
  node: Node;
  /** First leaf in the expansion order (index into occurrences). */
  start: number;
  leaves: number;
  kind: "part" | "inline" | "callout";
  box: Box;
};

/**
 * Derive the follow-along guide. `all` must be `occurrences(project)` (its
 * depth-first order locates every placed submodel's leaves as one range).
 */
export function deriveGuide(
  project: Project,
  all: readonly Occurrence[],
  options: GuideOptions & { plan?: InstructionPlan } = {},
): Guide {
  if (options.plan) return planGuide(options.plan, all);
  const maxPerStep = Math.max(1, Math.min(50, options.maxPerStep ?? 8));
  const minPerStep = Math.max(1, Math.min(maxPerStep, options.minPerStep ?? 3));
  const models = project.models;
  const leafMemo = new Map<string, number>();
  const leafCount = (modelId: string): number => {
    let n = leafMemo.get(modelId);
    if (n !== undefined) return n;
    n = 0;
    for (const node of models[modelId]?.nodes ?? [])
      n += node.kind === "submodel" ? leafCount(node.ref) : 1;
    leafMemo.set(modelId, n);
    return n;
  };
  // Placements of each submodel in the whole expansion.
  const instances = new Map<string, number>();
  const countInstances = (modelId: string, times: number) => {
    for (const node of models[modelId]?.nodes ?? [])
      if (node.kind === "submodel") {
        instances.set(node.ref, (instances.get(node.ref) ?? 0) + times);
        countInstances(node.ref, times);
      }
  };
  countInstances(project.rootModelId, 1);
  const boxMemo = new Map<string, Box>();
  const modelBox = (modelId: string): Box => {
    let box = boxMemo.get(modelId);
    if (box) return box;
    box = emptyBox();
    boxMemo.set(modelId, box);
    for (const node of models[modelId]?.nodes ?? [])
      transformBox(node.transform, nodeBox(node), box);
    return box;
  };
  const partBoxes = new Map<string, Box>();
  const nodeBox = (node: Node): Box => {
    if (node.kind === "submodel") return modelBox(node.ref);
    let box = partBoxes.get(node.ref);
    if (!box) {
      const b = bounds(node.ref);
      box = b
        ? { min: b.min as Vec3, max: b.max as Vec3 }
        : { min: [0, 0, 0], max: [0, 0, 0] };
      partBoxes.set(node.ref, box);
    }
    return box;
  };
  const sequences: GuideSequence[] = [];
  const steps: GuideStep[] = [];
  const built = new Set<string>();
  let authored = false;
  const name = (modelId: string) =>
    (models[modelId]?.name ?? modelId).replace(/\.(ldr|dat|mpd)$/i, "");

  const pushStep = (sequence: number, units: Unit[]) => {
    if (!units.length) return;
    const seq = sequences[sequence];
    const added: string[] = [];
    const moving: string[][] = [];
    const loose: Occurrence[] = [];
    const assemblies = new Map<string, GuideAssembly>();
    for (const unit of units) {
      const ids: string[] = [];
      for (let i = unit.start; i < unit.start + unit.leaves; i++) {
        const id = all[i].id;
        ids.push(id);
        added.push(id);
        seq.ids.push(id);
      }
      moving.push(ids);
      if (unit.kind === "part") loose.push(all[unit.start]);
      else {
        const a = assemblies.get(unit.node.ref) ?? {
          modelId: unit.node.ref,
          name: name(unit.node.ref),
          count: 0,
        };
        a.count++;
        assemblies.set(unit.node.ref, a);
      }
    }
    steps.push({
      sequence,
      end: seq.ids.length,
      added,
      units: moving,
      lots: lotsOf(loose),
      assemblies: [...assemblies.values()],
    });
  };

  /** Steps of one placed model's content (leaves from `start`). */
  const emitModel = (
    modelId: string,
    start: number,
    sequence: number,
    depth: number,
  ) => {
    const model = models[modelId];
    if (!model) return;
    const units: Unit[] = [];
    const unitOf = new Map<string, Unit>();
    let cursor = start;
    for (const node of model.nodes) {
      const leaves = node.kind === "submodel" ? leafCount(node.ref) : 1;
      const kind: Unit["kind"] =
        node.kind !== "submodel"
          ? "part"
          : leaves < 2
            ? "part"
            : (instances.get(node.ref) ?? 0) > 1 || !isIdentity(node.transform)
              ? "callout"
              : "inline";
      const unit: Unit = {
        node,
        start: cursor,
        leaves,
        kind,
        box: transformBox(node.transform, nodeBox(node), emptyBox()),
      };
      cursor += leaves;
      if (!leaves) continue;
      units.push(unit);
      unitOf.set(node.id, unit);
    }
    // Callouts come just before the step that places them.
    const flush = (group: Unit[]) => {
      if (!group.length) return;
      for (const unit of group) {
        if (unit.kind !== "callout" || built.has(unit.node.ref)) continue;
        built.add(unit.node.ref);
        const copies = group.filter(
          (u) => u.kind === "callout" && u.node.ref === unit.node.ref,
        ).length;
        sequences.push({
          kind: "callout",
          modelId: unit.node.ref,
          name: name(unit.node.ref),
          instances: copies,
          depth: depth + 1,
          ids: [],
        });
        emitModel(unit.node.ref, unit.start, sequences.length - 1, depth + 1);
      }
      pushStep(sequence, group);
    };
    const inline = (unit: Unit) =>
      emitModel(unit.node.ref, unit.start, sequence, depth);
    const groups = stepGroups(model.records, model.nodes);
    if (groups) {
      authored = true;
      for (const nodes of groups) {
        const group: Unit[] = [];
        for (const node of nodes) {
          const unit = unitOf.get(node.id);
          if (!unit) continue;
          // An in-place submodel's own steps belong to this step.
          if (unit.kind === "inline") inline(unit);
          else group.push(unit);
        }
        flush(group);
      }
      return;
    }
    for (const chunk of generatedSteps(units, maxPerStep, minPerStep))
      if (chunk.length === 1 && chunk[0].kind === "inline") inline(chunk[0]);
      else flush(chunk);
  };

  sequences.push({
    kind: "model",
    modelId: project.rootModelId,
    name: project.title || name(project.rootModelId),
    instances: 1,
    depth: 0,
    ids: [],
  });
  emitModel(project.rootModelId, 0, 0, 0);
  return {
    source: authored ? "model-steps" : "generated",
    label: authored ? "Steps from the model file" : "Generated steps",
    steps,
    sequences,
    occurrences: all.length,
  };
}

/** Generated steps of one model level: bottom-up layers, compact runs. */
function generatedSteps(
  units: Unit[],
  maxPerStep: number,
  minPerStep: number,
): Unit[][] {
  // LDraw −Y is up: the lowest unit has the largest bottom (max y).
  const layer = (u: Unit) =>
    Number.isFinite(u.box.max[1])
      ? Math.round(u.box.max[1] / LAYER_LDU)
      : Math.round(u.node.transform.position[1] / LAYER_LDU);
  const cx = (u: Unit) =>
    Number.isFinite(u.box.min[0])
      ? (u.box.min[0] + u.box.max[0]) / 2
      : u.node.transform.position[0];
  const cz = (u: Unit) =>
    Number.isFinite(u.box.min[2])
      ? (u.box.min[2] + u.box.max[2]) / 2
      : u.node.transform.position[2];
  const keyed = units.map((u, order) => {
    const row = Math.floor(cz(u) / ROW_LDU);
    return {
      u,
      order,
      layer: layer(u),
      row,
      // Serpentine: alternate rows run back the other way.
      along: row % 2 ? -cx(u) : cx(u),
    };
  });
  keyed.sort(
    (a, b) =>
      b.layer - a.layer ||
      a.row - b.row ||
      a.along - b.along ||
      a.order - b.order,
  );
  const chunks: Unit[][] = [];
  let i = 0;
  while (i < keyed.length) {
    // In-place submodels are their own block of steps.
    if (keyed[i].u.kind === "inline") {
      chunks.push([keyed[i].u]);
      i++;
      continue;
    }
    let j = i;
    while (
      j < keyed.length &&
      keyed[j].layer === keyed[i].layer &&
      keyed[j].u.kind !== "inline"
    )
      j++;
    const n = j - i,
      parts = Math.ceil(n / maxPerStep),
      size = Math.ceil(n / parts);
    for (let k = i; k < j; k += size)
      chunks.push(keyed.slice(k, Math.min(j, k + size)).map((e) => e.u));
    i = j;
  }
  // Merge small neighbouring runs (never across an in-place block).
  const merged: Unit[][] = [];
  for (const chunk of chunks) {
    const last = merged[merged.length - 1];
    const block = (c: Unit[]) => c.length === 1 && c[0].kind === "inline";
    if (
      last &&
      !block(last) &&
      !block(chunk) &&
      (last.length < minPerStep || chunk.length < minPerStep) &&
      last.length + chunk.length <= maxPerStep
    )
      last.push(...chunk);
    else merged.push([...chunk]);
  }
  return merged;
}

/** An authored instruction plan as one flat sequence. */
function planGuide(plan: InstructionPlan, all: readonly Occurrence[]): Guide {
  const byId = new Map(all.map((o) => [o.id, o]));
  const seq: GuideSequence = {
    kind: "model",
    modelId: "",
    name: plan.name,
    instances: 1,
    depth: 0,
    ids: [],
  };
  const steps: GuideStep[] = [];
  const seen = new Set<string>();
  for (const ids of plan.steps) {
    const added = ids.filter((id) => byId.has(id) && !seen.has(id));
    if (!added.length) continue;
    for (const id of added) {
      seen.add(id);
      seq.ids.push(id);
    }
    steps.push({
      sequence: 0,
      end: seq.ids.length,
      added,
      units: added.map((id) => [id]),
      lots: lotsOf(added.map((id) => byId.get(id)!)),
      assemblies: [],
    });
  }
  return {
    source: "plan",
    label: plan.name,
    steps,
    sequences: [seq],
    occurrences: seen.size,
  };
}

/** Occurrences drawn at a step: its sequence's prefix. */
export function stepView(guide: Guide, index: number): string[] {
  const step = guide.steps[index];
  if (!step) return [];
  return guide.sequences[step.sequence].ids.slice(0, step.end);
}

/** Occurrences of the step's sequence not built yet (the "later" context). */
export function laterParts(guide: Guide, index: number): string[] {
  const step = guide.steps[index];
  if (!step) return [];
  return guide.sequences[step.sequence].ids.slice(step.end);
}

/** Step number of every step within its own sequence (1-based) and the
 * sequence's step count, for "Step 3 of 7" inside a callout. */
export function sequencePositions(guide: Guide) {
  const counts = new Map<number, number>();
  const position = guide.steps.map((s) => {
    const n = (counts.get(s.sequence) ?? 0) + 1;
    counts.set(s.sequence, n);
    return n;
  });
  return { position, count: (sequence: number) => counts.get(sequence) ?? 0 };
}

const bounds = (ref: string) => partSpec(ref)?.bounds;
