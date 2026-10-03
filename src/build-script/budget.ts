// Part targets for build scripts: a target is guidance, not a pass mark. A
// build of any size compiles; the report says how far it landed from the
// target, which is how a build is judged on size (docs/AGENT-BUILDING.md#limits).
import { AppError } from "../core/types";
import type { CompileReport } from "./compile";

/** Checks a part target: a positive integer. */
export function partTarget(target: number) {
  if (!Number.isInteger(target) || target <= 0)
    throw new AppError(
      "INVALID_INPUT",
      "The part target must be a positive integer",
    );
  return target;
}

/** How far a part count is from its target: e.g. 2,137 for 2,000 is +137,
 * +6.9%. */
export function targetMiss(parts: number, target: number) {
  const difference = parts - target;
  return {
    target,
    parts,
    difference,
    percent: Math.round((difference / target) * 1000) / 10,
  };
}

/** "2,137 parts (target 2,000: +137, +6.9%)". */
export function targetText(parts: number, target?: number) {
  const fmt = (n: number) => n.toLocaleString("en-US");
  if (target === undefined) return `${fmt(parts)} parts`;
  const m = targetMiss(parts, target);
  const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "±");
  return `${fmt(parts)} parts (target ${fmt(target)}: ${sign(m.difference)}${fmt(Math.abs(m.difference))}, ${sign(m.percent)}${Math.abs(m.percent)}%)`;
}

/** Whether a build is over its script's hard cap, `limits.maxParts` (then it
 * should not be written or applied). */
export function outsideBudget(report: CompileReport) {
  return report.problems.some((p) => p.code === "over-budget");
}
