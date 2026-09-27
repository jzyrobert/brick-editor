import { occurrences } from "../core/document";
import { AppError, type Project, type InstructionPlan } from "../core/types";
import type { ExpansionOptions } from "../core/expansion-policy";

export type ImportedStepsResult =
  | { status: "absent" }
  | { status: "derived"; plan: InstructionPlan }
  | { status: "deferred"; diagnostic: Project["diagnostics"][number] };

/** Derive a root source STEP plan without changing source or authored plans.
 * A caller may retry with a trusted resource profile after a deferred result. */
export function deriveImportedSteps(
  project: Project,
  options: ExpansionOptions = {},
): ImportedStepsResult {
  const root = project.models[project.rootModelId];
  const boundary = /^0\s+(?:STEP|ROTSTEP)(?:\s|$)/i;
  if (!root.records.some((record) => boundary.test(record.raw)))
    return { status: "absent" };
  let all;
  try {
    all = occurrences(project, options);
  } catch (error) {
    if (!(error instanceof AppError) || error.code !== "LIMIT_EXCEEDED")
      throw error;
    return {
      status: "deferred",
      diagnostic: {
        code: "INSTRUCTION_DERIVATION_DEFERRED",
        severity: "warning",
        message:
          "Source STEP/ROTSTEP records are retained. Editable steps were not generated because expansion exceeds the active resource limit.",
        occurrenceIds: [],
        details: {
          cause: error.code,
          message: error.message,
          limit: error.details,
        },
      },
    };
  }
  // Index once instead of filtering every occurrence for every source record.
  const byRoot = new Map<string, string[]>();
  for (const occurrence of all) {
    const key = occurrence.path[0];
    let ids = byRoot.get(key);
    if (!ids) byRoot.set(key, (ids = []));
    ids.push(occurrence.id);
  }
  const steps: string[][] = [];
  let step: string[] = [];
  for (const record of root.records) {
    if (boundary.test(record.raw)) {
      if (step.length) steps.push(step);
      step = [];
    } else if (record.nodeId) {
      for (const id of byRoot.get(record.nodeId) ?? []) step.push(id);
    }
  }
  if (step.length) steps.push(step);
  return {
    status: "derived",
    plan: { name: "Imported steps (rotation metadata retained)", steps },
  };
}
