import { execFile } from "node:child_process";
export type AgyQuota = {
  at: string;
  raw: string;
  geminiWeekly: number;
  geminiFiveHour: number;
  argonWeekly: number;
};
export function parseAgyQuota(raw: string): AgyQuota {
  const rows = raw
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split("\t"));
  const get = (group: string, label: string) => {
    const value = rows.find((r) => r[0] === group && r[1] === label)?.[2];
    if (!value || !/^\d+(?:\.\d+)?%$/.test(value))
      throw new Error(`Missing quota: ${group}/${label}`);
    const n = parseFloat(value);
    if (n < 0 || n > 100) throw new Error("Invalid quota percentage");
    return n;
  };
  return {
    at: new Date().toISOString(),
    raw,
    geminiWeekly: get("Gemini Models", "Weekly Limit Remaining"),
    geminiFiveHour: get("Gemini Models", "Five Hour Limit Remaining"),
    argonWeekly: get("Gemini 4 Argon", "Gemini 4 Argon Weekly Limit"),
  };
}
export async function readAgyQuota(): Promise<AgyQuota> {
  const raw = await new Promise<string>((resolve, reject) =>
    execFile(
      "agy",
      ["-p", "/usage"],
      { timeout: 30000, windowsHide: true },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    ),
  );
  return parseAgyQuota(raw);
}
export function quotaRemaining(q: AgyQuota, model: string) {
  return Math.min(
    q.geminiWeekly,
    q.geminiFiveHour,
    ...(model.includes("argon") ? [q.argonWeekly] : []),
  );
}
/** Compare each counter independently: the limiting pool can change between
 * readings, so subtracting their minima can understate real consumption. */
export function quotaDrop(before: AgyQuota, after: AgyQuota, model: string) {
  return Math.max(
    0,
    before.geminiWeekly - after.geminiWeekly,
    before.geminiFiveHour - after.geminiFiveHour,
    ...(model.includes("argon")
      ? [before.argonWeekly - after.argonWeekly]
      : []),
  );
}
/** Percentages are rounded by agy. Keep 5pp in reserve and budget at least
 * 5pp for the next run, increasing that to 1.5x the largest observed drop +2.
 * This is an estimate, not a provider guarantee of the next run's cost. */
export function quotaGate(q: AgyQuota, model: string, largestDrop = 0) {
  const estimatedNext = Math.max(5, Math.ceil(largestDrop * 1.5 + 2));
  return {
    remaining: quotaRemaining(q, model),
    reserve: 5,
    estimatedNext,
    sufficient: quotaRemaining(q, model) >= 5 + estimatedNext,
  };
}
