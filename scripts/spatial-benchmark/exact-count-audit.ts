// Post-run task compliance, separate from the frozen runner's acceptance label.
export function exactCountAudit(expected: number, actual: number | null) {
  if (!Number.isSafeInteger(expected) || expected < 1)
    throw new Error("Invalid exact-count requirement");
  if (actual === null) return { status: "unknown" as const, expected, actual };
  if (!Number.isSafeInteger(actual) || actual < 0)
    throw new Error("Invalid measured count");
  return {
    status: actual === expected ? ("verified" as const) : ("invalid" as const),
    expected,
    actual,
  };
}
