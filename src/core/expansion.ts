import { ensure, type Project } from "./types";
import { OCCURRENCE_PATH_MAX_DEPTH } from "./occurrence-id";

export type ExpansionMetrics = {
  leafCount: number;
  visitedNodes: number;
  /** Largest visited node path; an empty root has depth zero. */
  maxDepth: number;
  /** Entered model levels, including empty models and the root. */
  referenceDepth: number;
  /** UTF-16 code units in all retained leaf JSON path IDs. */
  retainedIdCharacters: number;
  /** UTF-16 code units when encoding every visited node, as occurrences does. */
  generatedIdCharacters: number;
  /** Number of node-ID references in retained leaf path arrays. */
  pathSlots: number;
};
export type ExpansionEstimate = {
  metrics: ExpansionMetrics;
  /** True means the reported value is ceiling + 1, not the exact total. */
  saturated: Record<keyof ExpansionMetrics, boolean>;
};
const keys: (keyof ExpansionMetrics)[] = [
  "leafCount",
  "visitedNodes",
  "maxDepth",
  "referenceDepth",
  "retainedIdCharacters",
  "generatedIdCharacters",
  "pathSlots",
];
const defaultCeiling = Number.MAX_SAFE_INTEGER - 1;

/** Pure source-DAG estimate. Does not validate unrelated document metadata or
 * physical-part dependency graphs, materialize occurrences, or enforce a UI
 * resource profile. Missing submodels/cycles/depth failures match expansion.
 * Arithmetic stays bounded even for exponentially shared source graphs. */
export function estimateExpansion(
  project: Pick<Project, "models" | "rootModelId">,
  options: { ceilings?: Partial<ExpansionMetrics> } = {},
): ExpansionEstimate {
  const ceilings = {} as ExpansionMetrics;
  for (const key of keys) {
    const value = options.ceilings?.[key] ?? defaultCeiling;
    ensure(
      Number.isSafeInteger(value) &&
        value >= 0 &&
        value < Number.MAX_SAFE_INTEGER,
      "INVALID_INPUT",
      "Expansion ceilings must be nonnegative safe integers below MAX_SAFE_INTEGER",
    );
    ceilings[key] = value;
  }
  // A common internal cap preserves cross-metric arithmetic: leaf counts feed
  // path lengths even when the caller's leaf-count ceiling is much smaller.
  const cap = BigInt(Math.max(...Object.values(ceilings))) + 1n;
  const add = (a: bigint, b: bigint) => (a >= cap - b ? cap : a + b);
  const mul = (a: bigint, b: bigint) =>
    a === 0n || b === 0n ? 0n : a > cap / b ? cap : a * b;
  type Summary = {
    leaves: bigint;
    visits: bigint;
    leafWeight: bigint;
    allWeight: bigint;
    slots: bigint;
    depth: number;
    referenceDepth: number;
  };
  const memo = new Map<string, Summary>();
  const active = new Set<string>();
  const walk = (id: string): Summary => {
    ensure(!active.has(id), "REFERENCE_CYCLE", "Cyclic model reference");
    ensure(
      active.size < OCCURRENCE_PATH_MAX_DEPTH,
      "LIMIT_EXCEEDED",
      "Reference depth exceeds 64",
    );
    const cached = memo.get(id);
    if (cached) {
      ensure(
        active.size + cached.referenceDepth <= OCCURRENCE_PATH_MAX_DEPTH,
        "LIMIT_EXCEEDED",
        "Reference depth exceeds 64",
      );
      return cached;
    }
    ensure(
      Object.hasOwn(project.models, id),
      "REFERENCE_MISSING",
      "Missing submodel " + id,
    );
    const model = project.models[id];
    active.add(id);
    const sum: Summary = {
      leaves: 0n,
      visits: 0n,
      leafWeight: 0n,
      allWeight: 0n,
      slots: 0n,
      depth: 0,
      referenceDepth: 1,
    };
    for (const node of model.nodes) {
      // Encode one segment once per stored node; never concatenate full paths.
      const weight = BigInt(JSON.stringify(node.id).length + 1);
      const child = node.kind === "submodel" ? walk(node.ref) : undefined;
      const leaves = child?.leaves ?? 1n;
      const visits = add(1n, child?.visits ?? 0n);
      sum.leaves = add(sum.leaves, leaves);
      sum.visits = add(sum.visits, visits);
      sum.leafWeight = add(
        sum.leafWeight,
        add(child?.leafWeight ?? 0n, mul(weight, leaves)),
      );
      sum.allWeight = add(
        sum.allWeight,
        add(child?.allWeight ?? 0n, mul(weight, visits)),
      );
      sum.slots = add(sum.slots, add(child?.slots ?? 0n, leaves));
      sum.depth = Math.max(sum.depth, 1 + (child?.depth ?? 0));
      sum.referenceDepth = Math.max(
        sum.referenceDepth,
        child ? 1 + child.referenceDepth : 1,
      );
    }
    active.delete(id);
    memo.set(id, sum);
    return sum;
  };
  const root = walk(project.rootModelId);
  const totals: Record<keyof ExpansionMetrics, bigint> = {
    leafCount: root.leaves,
    visitedNodes: root.visits,
    maxDepth: BigInt(root.depth),
    referenceDepth: BigInt(root.referenceDepth),
    retainedIdCharacters: add(root.leafWeight, root.leaves),
    generatedIdCharacters: add(root.allWeight, root.visits),
    pathSlots: root.slots,
  };
  const metrics = {} as ExpansionMetrics;
  const saturated = {} as ExpansionEstimate["saturated"];
  for (const key of keys) {
    const ceiling = BigInt(ceilings[key]);
    saturated[key] = totals[key] > ceiling;
    metrics[key] = Number(saturated[key] ? ceiling + 1n : totals[key]);
  }
  return { metrics, saturated };
}
