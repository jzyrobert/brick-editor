#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { preflight } from "./spatial-benchmark";
import { validateManifest } from "./spatial-benchmark/manifest";
import { GenerationSession } from "./spatial-benchmark/session";
import {
  agyChannel,
  validateAgyModel,
  AGY_TRANSPORT_VERSION,
} from "./spatial-benchmark/agy-channel";
import {
  readAgyQuota,
  quotaGate,
  quotaDrop,
  type AgyQuota,
} from "./spatial-benchmark/agy-quota";
import { hash, json } from "./spatial-benchmark/part-reference";

export async function main(argv: string[]) {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (
      !["--manifest", "--out", "--cases"].includes(argv[i]) ||
      !argv[i + 1] ||
      flags.has(argv[i])
    )
      throw new Error("Takes --manifest, --out and optional --cases");
    flags.set(argv[i], argv[i + 1]);
  }
  if (!flags.has("--manifest") || !flags.has("--out"))
    throw new Error("Explicit manifest and fresh output required");
  const m = validateManifest(
    JSON.parse(await readFile(resolve(flags.get("--manifest")!), "utf8")),
  );
  validateAgyModel(m.model);
  const out = resolve(flags.get("--out")!);
  const { cases: scheduled, worker, record } = await preflight(m, out);
  const only = flags.get("--cases")?.split(",");
  for (const id of only ?? [])
    if (!scheduled.some((c) => c.id === id))
      throw new Error(`Not scheduled: ${id}`);
  const cases = only ? scheduled.filter((c) => only.includes(c.id)) : scheduled;
  const sourceHashes: Record<string, string> = {};
  for (const name of [
    "scripts/spatial-benchmark-live-agy.ts",
    "scripts/spatial-benchmark/agy-channel.ts",
    "scripts/spatial-benchmark/agy-quota.ts",
  ]) {
    const bytes = await readFile(new URL("../" + name, import.meta.url));
    sourceHashes[name] = hash(bytes);
    await mkdir(resolve(out, "host-sources", name, ".."), { recursive: true });
    await writeFile(join(out, "host-sources", name), bytes);
  }
  await writeFile(
    join(out, "preflight.json"),
    JSON.stringify(
      {
        ...record,
        transport: AGY_TRANSPORT_VERSION,
        sourceHashes,
        selectedCases: only ?? null,
        runOrder: cases.map((c) => c.id),
        scheduled: cases.length,
        nativeTools:
          "deny-all PreToolUse hook; any attempted native tool fails case",
        serverOutputTokenCap:
          "not exposed; reported usage checked for each native response",
      },
      null,
      2,
    ) + "\n",
  );
  const results: unknown[] = [],
    quotas: unknown[] = [];
  let previous: AgyQuota | undefined,
    largestDrop = 0,
    infrastructureFailures = 0,
    stopReason: string | null = null;
  const save = async () => {
    await writeFile(
      join(out, "results.json"),
      JSON.stringify(
        {
          version: AGY_TRANSPORT_VERSION,
          planned: cases.length,
          completed: results.length,
          results,
          experimentallyEvaluated: false,
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      join(out, "quota.json"),
      JSON.stringify(quotas, null, 2) + "\n",
    );
    await writeFile(
      join(out, "run-status.json"),
      JSON.stringify(
        {
          planned: cases.length,
          completed: results.length,
          stopReason,
          largestObservedQuotaDrop: largestDrop,
        },
        null,
        2,
      ) + "\n",
    );
  };
  await save();
  for (const c of cases) {
    let quota: AgyQuota;
    try {
      quota = await readAgyQuota();
    } catch (e) {
      stopReason = `Quota unavailable: ${(e as Error).message}`;
      await save();
      break;
    }
    const gate = quotaGate(quota, m.model.id, largestDrop);
    quotas.push({ phase: "before", caseId: c.id, ...quota, gate });
    if (!gate.sufficient) {
      stopReason = "Insufficient quota for next case plus reserve";
      await save();
      break;
    }
    previous = quota;
    console.log(
      json({
        event: "starting-run",
        caseId: c.id,
        model: m.model,
        quota: gate,
      }),
    );
    const dir = join(out, c.id);
    await mkdir(dir);
    let runtime: Awaited<ReturnType<typeof agyChannel>> | undefined;
    const start = Date.now();
    const generation = new GenerationSession(
      m,
      c,
      dir,
      worker,
      async (request) => {
        runtime ??= await agyChannel({
          dir: join(out, c.id + "--transport"),
          model: m.model,
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
    results.push({
      caseId: c.id,
      ...result,
      seconds: Math.round((Date.now() - start) / 1000),
    });
    infrastructureFailures =
      result.status === "infrastructure-failure"
        ? infrastructureFailures + 1
        : 0;
    // Persist the result before requesting account quota, even if that read fails.
    await save();
    try {
      const after = await readAgyQuota();
      largestDrop = Math.max(
        largestDrop,
        quotaDrop(previous, after, m.model.id),
      );
      quotas.push({
        phase: "after",
        caseId: c.id,
        ...after,
        next: quotaGate(after, m.model.id, largestDrop),
      });
    } catch (e) {
      stopReason = `Post-run quota unavailable: ${(e as Error).message}`;
    }
    if (infrastructureFailures >= 3)
      stopReason = "Three consecutive infrastructure failures";
    await save();
    console.log(
      json({
        event: "completed-run",
        caseId: c.id,
        status: result.status,
        failure: result.failure,
        completed: results.length,
        planned: cases.length,
        stopReason,
      }),
    );
    if (stopReason) break;
  }
  console.log(
    json({
      event: "study-ended",
      completed: results.length,
      planned: cases.length,
      stopReason,
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
