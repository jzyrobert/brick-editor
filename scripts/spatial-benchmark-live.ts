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
import { verifyFile } from "./spatial-benchmark/sandbox";
const ROOT = new URL("../", import.meta.url);
export async function main(argv: string[]) {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (
      ![
        "--manifest",
        "--out",
        "--authorised-cases",
        "--remaining-from",
      ].includes(argv[i]) ||
      !argv[i + 1] ||
      flags.has(argv[i])
    )
      throw new Error(
        "Live mode takes --manifest, --out, --authorised-cases and optional --remaining-from",
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
  const { cases: originalCases, worker, record } = await preflight(m, out);
  let cases = originalCases;
  let continuation: unknown = null;
  if (flags.has("--remaining-from")) {
    const prior = resolve(flags.get("--remaining-from")!);
    const oldManifest = validateManifest(
      JSON.parse(await readFile(join(prior, "manifest.json"), "utf8")),
    );
    if (hash(json(oldManifest)) !== hash(json(m)))
      throw new Error("Continuation requires an identical manifest");
    const status = JSON.parse(
      await readFile(join(prior, "run-status.json"), "utf8"),
    );
    const oldPreflight = JSON.parse(
      await readFile(join(prior, "preflight.json"), "utf8"),
    );
    if (
      hash(json(oldPreflight.inputs)) !== hash(json(record.inputs)) ||
      oldPreflight.compilerBundleSha256 !== record.compilerBundleSha256
    )
      throw new Error(
        "Continuation changed effective prompts or compiler; requires a separate experiment",
      );
    const bytes = await readFile(join(prior, "results.json"));
    const old = JSON.parse(bytes.toString());
    const ids = old.results.map((r: { caseId: string }) => r.caseId);
    if (
      !status.stopReason ||
      status.planned !== originalCases.length ||
      status.completed !== ids.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id: string) => !originalCases.some((c) => c.id === id))
    )
      throw new Error(
        "Invalid stopped study boundary; completed or failed cases cannot be repeated",
      );
    for (const r of old.results)
      for (const [file, sha] of Object.entries(r.files)) {
        if (!["submission.txt", "compilation.json", "build.mpd"].includes(file))
          throw new Error("Invalid frozen file");
        await verifyFile(join(prior, r.caseId, file), String(sha));
      }
    cases = originalCases.filter((c) => !ids.includes(c.id));
    continuation = {
      version: "unexecuted-case-continuation/1",
      prior,
      priorResultsSha256: hash(bytes),
      priorManifestSha256: hash(json(oldManifest)),
      retainedPriorCaseIds: ids,
      selectedCaseIds: cases.map((c) => c.id),
      retryFailedCases: false,
      resumeNativeThreads: false,
    };
    await writeFile(join(out, "continuation.json"), json(continuation) + "\n");
  }
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
    "scripts/spatial-benchmark/model-failure.ts",
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
        continuation,
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
        originalScheduled: originalCases.length,
        scheduled: cases.length,
        runOrder: cases.map((c) => c.id),
        continuation,
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
  await writeFile(
    join(out, "results.json"),
    json({
      version: CODEX_TRANSPORT_VERSION,
      planned: cases.length,
      authorised,
      completed: 0,
      results: [],
      lastQuota: null,
      experimentallyEvaluated: false,
    }) + "\n",
  );
  for (const c of cases.slice(0, authorised)) {
    const before = await readCodexQuota().catch((e) => {
      stopReason = `Quota unavailable before next case: ${String(e.message)}`;
      return null;
    });
    if (!before) break;
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
    // Initialise inside the session's channel callback, so even a launch failure
    // is sealed and retained by GenerationSession without a model retry.
    let runtime: Awaited<ReturnType<typeof codexChannel>> | undefined;
    const generation = new GenerationSession(
      m,
      c,
      dir,
      worker,
      async (request) => {
        runtime ??= await codexChannel({
          dir: nativeDir,
          generationDir: join(dir, "generation"),
          quota: readCodexQuota,
          notify: async (q) => {
            lastQuota = q;
            await quotaLog(q, "after-model-request", c.id);
          },
        });
        return runtime.channel(request);
      },
    );
    let result;
    try {
      result = await generation.run();
    } finally {
      await runtime?.close();
    }
    const after = await readCodexQuota().catch((e) => {
      stopReason = `Quota unavailable after frozen case: ${String(e.message)}`;
      return null;
    });
    if (after) {
      await quotaLog(after, "after-run", c.id);
      lastQuota = after;
    }
    const drop = after
      ? Math.max(0, before.weeklyRemaining - after.weeklyRemaining)
      : null;
    if (drop !== null) largestDrop = Math.max(largestDrop, drop);
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
        weeklyRemaining: after?.weeklyRemaining ?? null,
        observedAccountDrop: drop,
        quotaForecastNote: "Includes account activity outside this experiment",
      }),
    );
    if (!after) break;
    if (result.status === "infrastructure-failure") {
      stopReason = "Infrastructure failure; no automatic retry";
      break;
    }
    if (!quotaAllowsNext(after, largestDrop)) {
      stopReason = `Quota gate stopped before next run: ${after.weeklyRemaining}% weekly remaining`;
      break;
    }
  }
  if (!stopReason && authorised < cases.length && results.length === authorised)
    stopReason =
      "Authorised case limit reached; remaining scheduled cases were not executed";
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
