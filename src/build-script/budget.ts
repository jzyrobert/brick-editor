// Part targets for build scripts: the accepted range round a target, and
// whether a compiled build fell outside it (docs/AGENT-BUILDING.md#limits).
import { AppError } from "../core/types";
import type { CompileReport } from "./compile";

/** The accepted part counts for a target: `leeway` percent (default 10)
 * either side, e.g. 4,000 → 3,600–4,400. */
export function partRange(target: number, leeway = 10) {
  if (!Number.isInteger(target) || target <= 0)
    throw new AppError(
      "INVALID_INPUT",
      "The part target must be a positive integer",
    );
  if (!Number.isFinite(leeway) || leeway < 0 || leeway > 100)
    throw new AppError("INVALID_INPUT", "The leeway must be 0–100 percent");
  // The epsilon keeps 3,000 × 0.9 from rounding up to 2,701.
  return {
    target,
    leeway,
    min: Math.ceil((target * (100 - leeway)) / 100 - 1e-9),
    max: Math.floor((target * (100 + leeway)) / 100 + 1e-9),
  };
}

/** Whether a build is outside its part range (then it should not be written
 * or applied). */
export function outsideBudget(report: CompileReport) {
  return report.problems.some(
    (p) => p.code === "over-budget" || p.code === "under-budget",
  );
}
