import { ensure, type Project } from "./types";
import { estimateExpansion, type ExpansionMetrics } from "./expansion";

export type ExpansionOptions = {
  profile?: "desktop" | "mobile";
  limits?: Partial<ExpansionMetrics>;
  /** Trusted caller has shown resource estimates and obtained deliberate consent.
   * This option is never read from imported project content. */
  acknowledgeDerivedImpact?: boolean;
};
const Mi = 1024 * 1024;
/** Character budgets count encoded UTF-16 code units, not bytes or actual heap. */
export const EXPANSION_PROFILES = Object.freeze({
  desktop: Object.freeze({
    leafCount: 100000,
    visitedNodes: 200000,
    maxDepth: 64,
    referenceDepth: 64,
    retainedIdCharacters: 64 * Mi,
    generatedIdCharacters: 128 * Mi,
    pathSlots: 6400000,
  }),
  mobile: Object.freeze({
    leafCount: 25000,
    visitedNodes: 200000,
    maxDepth: 64,
    referenceDepth: 64,
    retainedIdCharacters: 16 * Mi,
    generatedIdCharacters: 32 * Mi,
    pathSlots: 1600000,
  }),
});
/** Desktop overrides may expand character budgets, never established graph caps. */
export const EXPANSION_HARD_LIMITS = Object.freeze({
  ...EXPANSION_PROFILES.desktop,
  retainedIdCharacters: 512 * Mi,
  generatedIdCharacters: 1024 * Mi,
});
export function expansionLimits(
  options: ExpansionOptions = {},
): ExpansionMetrics {
  const profile = options.profile ?? "desktop";
  ensure(
    profile === "desktop" || profile === "mobile",
    "INVALID_INPUT",
    "Unknown expansion resource profile",
  );
  const defaults = EXPANSION_PROFILES[profile];
  const limits: ExpansionMetrics = { ...defaults };
  for (const key of Object.keys(
    options.limits ?? {},
  ) as (keyof ExpansionMetrics)[]) {
    const value = options.limits![key];
    ensure(
      Object.hasOwn(defaults, key) &&
        Number.isSafeInteger(value) &&
        value! >= 0 &&
        value! <= EXPANSION_HARD_LIMITS[key],
      "INVALID_INPUT",
      "Invalid or excessive expansion resource limit",
      { resource: key },
    );
    ensure(
      value! <= defaults[key] ||
        (profile === "desktop" && options.acknowledgeDerivedImpact === true),
      "INVALID_INPUT",
      "Raising derived resource limits requires an acknowledged desktop override",
      { resource: key },
    );
    limits[key] = value!;
  }
  return limits;
}
export function assertExpansionResource(
  resource: keyof ExpansionMetrics,
  required: number,
  limits: ExpansionMetrics,
  phase: "preflight" | "traversal",
) {
  ensure(
    required <= limits[resource],
    "LIMIT_EXCEEDED",
    `Expanded ${resource} exceeds the derived resource budget`,
    {
      resource,
      limit: limits[resource],
      requiredAtLeast: required,
      phase,
      unit: resource.endsWith("Characters") ? "UTF-16 code units" : "count",
    },
  );
}
/** Guard only: callers still charge incrementally before allocating derived data. */
export function preflightExpansion(
  project: Pick<Project, "models" | "rootModelId">,
  limits: ExpansionMetrics,
) {
  const estimate = estimateExpansion(project, { ceilings: limits });
  for (const key of Object.keys(limits) as (keyof ExpansionMetrics)[])
    assertExpansionResource(key, estimate.metrics[key], limits, "preflight");
  return estimate;
}
