#!/usr/bin/env node
// Explicit Codex-subscription experiment entry point. No paid API fallback.
import {
  readFile,
  writeFile,
  mkdir,
  appendFile,
  readdir,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { preflight } from "./spatial-benchmark";
import { validateManifest } from "./spatial-benchmark/manifest";
import { GenerationSession } from "./spatial-benchmark/session";
import {
  codexChannel,
  CODEX_TRANSPORT_VERSION,
} from "./spatial-benchmark/codex-channel";
import {
  readCodexQuota,
  quotaAllowsNext,
  type Quota,
} from "./spatial-benchmark/codex-quota";
import { json, hash } from "./spatial-benchmark/part-reference";
const ROOT = new URL("../", import.meta.url);
export async function main(argv: string[]) {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (
      !["--manifest", "--out", "--authorised-cases"].includes(argv[i]) ||
      !argv[i + 1] ||
      flags.has(argv[i])
    )
      throw new Error(
        "Live mode takes --manifest, --out and --authorised-cases only",
      );
    flags.set(argv[i], argv[i + 1]);
  }
  if (
    !flags.has("--manifest") ||
    !flags.has("--out") ||
    !flags.has("--authorised-cases")
  )
    throw new Error(
      "Explicit manifest, fresh output and authorised case count required",
    );
  const m = validateManifest(
    JSON.parse(await readFile(resolve(flags.get("--manifest")!), "utf8")),
  );
  if (m.model.id !== "gpt-6.1-sol" || m.model.effort !== "high")
    throw new Error("Only authorised Sol 6.1 high runs are enabled");
  const out = resolve(flags.get("--out")!);
  const { cases, worker, record } = await preflight(m, out);
  const authorised = Number(flags.get("--authorised-cases"));
  if (
    !Number.isInteger(authorised) ||
    authorised < 1 ||
    authorised > cases.length
  )
    throw new Error("Invalid authorised case count");
  const sourceNames = [
    "scripts/spatial-benchmark-live.ts",
    "scripts/spatial-benchmark/codex-channel.ts",
    "scripts/spatial-benchmark/codex-quota.ts",
    "scripts/spatial-benchmark/codex-bridge.mjs",
  ];
  const sourceHashes: Record<string, string> = {};
  for (const name of sourceNames) {
    const bytes = await readFile(new URL(name, ROOT));
    sourceHashes[name] = hash(bytes);
    await mkdir(resolve(out, "host-sources", name, ".."), { recursive: true });
    await writeFile(join(out, "host-sources", name), bytes);
  }
  await writeFile(
    join(out, "live-protocol.json"),
    JSON.stringify(
      {
        version: CODEX_TRANSPORT_VERSION,
        authorisedCases: authorised,
        model: m.model,
        quotaReservePercent: 5,
        noCreditPurchases: true,
        noEarnedResets: true,
        sourceHashes,
        blindPolicies: m.conditions.map((c) => c.policy),
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    join(out, "preflight.json"),
    JSON.stringify(
      {
        ...record,
        transport: CODEX_TRANSPORT_VERSION,
        network:
          "native client has isolated network; only mounted Unix broker permits subscription text Responses endpoint",
        modelCalls: null,
        sourceHashes,
      },
      null,
      2,
    ) + "\n",
  );
  const results: unknown[] = [];
  let lastQuota: Quota | undefined,
    largestDrop = 0;
  const quotaLog = async (q: Quota, kind: string, caseId?: string) => {
    await appendFile(
      join(out, "quota.jsonl"),
      json({ kind, caseId, ...q }) + "\n",
    );
  };
  let stopReason: string | undefined;
  for (const c of cases.slice(0, authorised)) {
    const before = await readCodexQuota();
    await quotaLog(before, "before-run", c.id);
    if (!quotaAllowsNext(before, largestDrop)) {
      stopReason = `Quota gate: ${before.weeklyRemaining}% weekly remaining, largest observed run drop ${largestDrop}%`;
      break;
    }
    const dir = join(out, c.id);
    await mkdir(dir); // prepare native sidecar outside approved generation folder
    // GenerationSession requires a fresh directory. Native state stays in a sibling.
    const nativeDir = join(out, c.id + "--transport");
    await mkdir(nativeDir);
    await mkdir(join(nativeDir, "generation"));
    const runtime = await codexChannel({
      dir: nativeDir,
      generationDir: join(dir, "generation"),
      quota: readCodexQuota,
      notify: async (q) => {
        lastQuota = q;
        await quotaLog(q, "after-model-request", c.id);
      },
    });
    const generation = new GenerationSession(
      m,
      c,
      dir,
      worker,
      runtime.channel,
    );
    let result;
    try {
      result = await generation.run();
    } finally {
      await runtime.close();
    }
    const after = await readCodexQuota();
    await quotaLog(after, "after-run", c.id);
    lastQuota = after;
    const drop = Math.max(0, before.weeklyRemaining - after.weeklyRemaining);
    largestDrop = Math.max(largestDrop, drop);
    results.push({
      caseId: c.id,
      ...result,
      quotaBefore: before,
      quotaAfter: after,
      observedAccountDrop: drop,
    });
    await writeFile(
      join(out, "results.json"),
      JSON.stringify(
        {
          version: CODEX_TRANSPORT_VERSION,
          planned: cases.length,
          authorised,
          completed: results.length,
          results,
          lastQuota,
          experimentallyEvaluated: false,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      json({
        event: "completed-run",
        caseId: c.id,
        status: result.status,
        completed: results.length,
        authorised,
        weeklyRemaining: after.weeklyRemaining,
        observedAccountDrop: drop,
        quotaForecastNote: "Includes account activity outside this experiment",
      }),
    );
    if (result.status === "infrastructure-failure") {
      stopReason = "Infrastructure failure; no automatic retry";
      break;
    }
    if (!quotaAllowsNext(after, largestDrop)) {
      stopReason = `Quota gate stopped before next run: ${after.weeklyRemaining}% weekly remaining`;
      break;
    }
  }
  await writeFile(
    join(out, "run-status.json"),
    JSON.stringify(
      {
        completed: results.length,
        planned: cases.length,
        authorised,
        stopReason: stopReason ?? null,
        lastQuota,
        experimentallyEvaluated: false,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    json({
      event: "study-ended",
      completed: results.length,
      stopReason: stopReason ?? null,
      lastQuota,
    }),
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main(process.argv.slice(2)).catch((e) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  });
