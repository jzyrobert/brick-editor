// Host-only quota reader. No turns, credit purchases or earned resets.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
export type QuotaWindow = {
  usedPercent: number;
  windowDurationMins: number;
  resetsAt: number | null;
};
export type Quota = {
  checkedAt: string;
  ordinaryUsageAllowed: boolean;
  windows: QuotaWindow[];
  weeklyRemaining: number;
  reached: boolean;
};
export async function readCodexQuota(
  binary = "/home/ubuntu/.local/bin/codex",
): Promise<Quota> {
  const child = spawn(binary, ["app-server", "--stdio"], {
    stdio: ["pipe", "pipe", "ignore"],
  });
  const lines = createInterface({ input: child.stdout });
  const pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  let id = 0;
  const timer = setTimeout(() => {
    for (const p of pending.values())
      p.reject(new Error("Codex quota request timed out"));
    child.kill();
  }, 30000);
  lines.on("line", (line) => {
    try {
      const v = JSON.parse(line),
        p = pending.get(v.id);
      if (p) {
        pending.delete(v.id);
        v.error
          ? p.reject(new Error(`Codex quota RPC error ${v.error.code}`))
          : p.resolve(v.result);
      }
    } catch {
      /* nonprotocol stdout is not exposed */
    }
  });
  child.on("error", (e) => {
    for (const p of pending.values()) p.reject(e);
  });
  const request = (method: string, params?: unknown) =>
    new Promise<unknown>((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      child.stdin.write(
        JSON.stringify({
          id: n,
          method,
          ...(params === undefined ? {} : { params }),
        }) + "\n",
      );
    });
  try {
    await request("initialize", {
      clientInfo: { name: "brick_benchmark_quota", version: "1" },
      capabilities: { experimentalApi: true },
    });
    child.stdin.write(JSON.stringify({ method: "initialized" }) + "\n");
    const raw = (await request("account/rateLimits/read")) as {
      ordinaryUsageAllowed?: boolean;
      rateLimitsByLimitId?: Record<
        string,
        {
          primary?: QuotaWindow;
          secondary?: QuotaWindow;
          rateLimitReachedType?: string | null;
          spendControlReached?: boolean;
        }
      >;
      rateLimits?: {
        primary?: QuotaWindow;
        secondary?: QuotaWindow;
        rateLimitReachedType?: string | null;
      };
    };
    const buckets = raw.rateLimitsByLimitId
      ? Object.values(raw.rateLimitsByLimitId)
      : raw.rateLimits
        ? [raw.rateLimits]
        : [];
    const windows = buckets.flatMap((b) =>
      [b.primary, b.secondary].filter((w): w is QuotaWindow => !!w),
    );
    const weekly = windows.filter((w) => w.windowDurationMins === 10080);
    if (!weekly.length || weekly.some((w) => !Number.isFinite(w.usedPercent)))
      throw new Error("Weekly Codex quota is unavailable; generation blocked");
    return {
      checkedAt: new Date().toISOString(),
      ordinaryUsageAllowed: raw.ordinaryUsageAllowed !== false,
      windows,
      weeklyRemaining: Math.min(...weekly.map((w) => 100 - w.usedPercent)),
      reached:
        buckets.some((b) => !!b.rateLimitReachedType) ||
        windows.some((w) => w.usedPercent >= 100),
    };
  } finally {
    clearTimeout(timer);
    lines.close();
    child.stdin.end();
    child.kill("SIGTERM");
  }
}
export function quotaAllowsNext(q: Quota, largestObservedDrop = 0) {
  const reserve = Math.max(5, 2 * largestObservedDrop);
  return (
    q.ordinaryUsageAllowed &&
    !q.reached &&
    q.windows.every((w) => 100 - w.usedPercent > reserve)
  );
}
