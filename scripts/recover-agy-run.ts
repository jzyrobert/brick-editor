#!/usr/bin/env node
// Continue one frozen transport failure in its OWN agy conversation. Replay
// saved responses through the unchanged host protocol first, verifying every
// reconstructed request. No models are called during replay and no source is
// edited. Later checks/repairs resume only this original native session.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { preflight } from "./spatial-benchmark";
import { validateManifest } from "./spatial-benchmark/manifest";
import {
  GenerationSession,
  type TextMessage,
} from "./spatial-benchmark/session";
import {
  agyChannel,
  validateAgyModel,
  normalizeAgyEnvelope,
  checkAgyEvent,
  checkAgyOutputBudget,
  selectAgyReply,
  AGY_TRANSPORT_VERSION,
  type AgyEvent,
} from "./spatial-benchmark/agy-channel";
import {
  readAgyQuota,
  quotaGate,
  quotaDrop,
  observedAgyRunCost,
} from "./spatial-benchmark/agy-quota";
import { hash, json } from "./spatial-benchmark/part-reference";
const read = async (file: string) => JSON.parse(await readFile(file, "utf8"));
export async function main(args: string[]) {
  if (
    args.length !== 6 ||
    args[0] !== "--from" ||
    args[2] !== "--out" ||
    args[4] !== "--output-budget"
  )
    throw new Error("Takes --from RUN --out EMPTY_DIR --output-budget TOKENS");
  const from = resolve(args[1]),
    out = resolve(args[3]);
  const priorManifest = validateManifest(
    await read(join(from, "manifest.json")),
  );
  validateAgyModel(priorManifest.model);
  const prior = (await read(join(from, "results.json"))).results;
  assert.equal(prior.length, 1, "Recovery takes one completed case");
  const old = prior[0];
  assert(old.status !== "submitted", "Accepted builds must not be rerun");
  assert(
    /Your previous response contained an improperly formatted function call|Native model response used \d+ output tokens/.test(
      old.failure ?? "",
    ),
    "Not a recognised recoverable transport/budget failure",
  );
  const m = structuredClone(priorManifest);
  const budget = Number(args[5]);
  assert(
    Number.isInteger(budget) &&
      budget >= m.budgets.maxOutputTokens &&
      budget <= 128000,
    "Invalid explicit output budget",
  );
  m.budgets.maxOutputTokens = budget;
  m.budgets.totalMs -= old.seconds * 1000;
  assert(m.budgets.totalMs > 0, "Original run time budget exhausted");
  const previousQuota = await read(join(from, "quota.json"));
  const oldBefore = previousQuota.find(
      (q: { phase: string }) => q.phase === "before",
    ),
    oldAfter = previousQuota.find(
      (q: { phase: string }) => q.phase === "after",
    );
  const before = await readAgyQuota();
  const gate = quotaGate(
    before,
    m.model.id,
    oldBefore && oldAfter ? quotaDrop(oldBefore, oldAfter, m.model.id) : 0,
  );
  if (!gate.sufficient) {
    console.log(
      json({
        event: "recovery-quota-stop",
        model: m.model.id,
        caseId: old.caseId,
        gate,
      }),
    );
    return;
  }
  const original = join(from, old.caseId);
  for (const [file, sha] of Object.entries(old.files))
    assert.equal(
      hash(await readFile(join(original, file))),
      sha,
      `Frozen source changed: ${file}`,
    );
  const native = join(from, old.caseId + "--transport");
  const adapter = await read(join(native, "adapter.json"));
  const events = (await readFile(join(native, "events.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as AgyEvent);
  let lastComplete = "",
    lastResult: AgyEvent["result"],
    thread = "",
    maxTokens = 0;
  const fragments = new Map<number, string>();
  for (const e of events) {
    checkAgyEvent(e, m.model);
    if (e.event === "init") thread = e.conversation_id!;
    const s = e.step_update;
    if (s?.step_type === "agent_response" && typeof s.step_index === "number") {
      const text = (fragments.get(s.step_index) ?? "") + (s.text_delta ?? "");
      fragments.set(s.step_index, text);
      if (s.state === "DONE") {
        checkAgyOutputBudget(s.usage?.output_tokens, budget);
        maxTokens = Math.max(maxTokens, s.usage!.output_tokens!);
        if (text.trim()) lastComplete = text;
      }
    }
    if (e.event === "result") lastResult = e.result;
  }
  assert(
    thread && lastComplete,
    "No completed native response/conversation to recover",
  );
  // A raised budget can also recover a completed response that transport 3
  // stopped before the CLI emitted its result envelope.
  const rawRecovered =
    lastResult?.status === "ERROR"
      ? selectAgyReply(lastResult, lastComplete)
      : lastComplete.trim();
  const normalized = normalizeAgyEnvelope(rawRecovered);
  const recovered = normalized.text;
  assert(/^[{]/.test(recovered), "No JSON protocol response to recover");
  const audit = (await readFile(join(original, "audit.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const requests: TextMessage[][] = audit
    .filter((e) => e.kind === "channel-request")
    .map((e) => e.payload.messages);
  const replies: string[] = audit
    .filter((e) => e.kind === "model-output")
    .map((e) => e.payload.text);
  assert.equal(
    requests.length,
    replies.length + 1,
    "Expected one interrupted native response",
  );
  replies.push(recovered);
  const { cases, worker, record } = await preflight(m, out);
  const c = cases.find((c) => c.id === old.caseId);
  assert(c, "Unscheduled recovery case");
  const oldPreflight = await read(join(from, "preflight.json"));
  assert.equal(
    record.compilerBundleSha256,
    oldPreflight.compilerBundleSha256,
    "Compiler changed since original run",
  );
  const recovery = {
    from,
    originalStatus: old.status,
    originalFailure: old.failure,
    originalSeconds: old.seconds,
    originalManifestSha256: hash(json(priorManifest)),
    outputBudget: {
      before: priorManifest.budgets.maxOutputTokens,
      after: budget,
    },
    remainingTotalMs: m.budgets.totalMs,
    thread,
    replayedResponses: replies.length,
    recoveredResponseSha256: hash(recovered),
    rawRecoveredResponseSha256: hash(rawRecovered),
    envelopeNormalization: normalized.normalization,
    unchangedCodeSha256: normalized.codeSha256,
    nativeStreamSha256: hash(await readFile(join(native, "events.jsonl"))),
    maxPriorNativeResponseTokens: maxTokens,
    originalQuotaDrop: await observedAgyRunCost(from, m.model.id),
  };
  const sourceHashes: Record<string, string> = {};
  for (const name of [
    "scripts/recover-agy-run.ts",
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
        modelCalls: null,
        network:
          "saved text replay without model calls, then only the original host-authenticated agy conversation; compiler network namespace disabled",
        sourceHashes,
        recovery,
        selectedCases: [c.id],
        scheduled: 1,
      },
      null,
      2,
    ) + "\n",
  );
  const dir = join(out, c.id),
    transportDir = join(out, c.id + "--transport");
  await mkdir(dir);
  await mkdir(transportDir);
  await writeFile(
    join(transportDir, "inherited-usage.json"),
    json({
      cumulativeOutputTokens: lastResult?.usage?.output_tokens ?? 0,
      recovery,
    }) + "\n",
  );
  let index = 0,
    runtime: Awaited<ReturnType<typeof agyChannel>> | undefined;
  const start = Date.now();
  const generation = new GenerationSession(
    m,
    c,
    dir,
    worker,
    async (request) => {
      if (index < replies.length) {
        assert.equal(
          hash(json(request.messages)),
          hash(json(requests[index])),
          `Replayed request ${index + 1} differs from original`,
        );
        return replies[index++];
      }
      runtime ??= await agyChannel({
        dir: transportDir,
        model: m.model,
        thread,
        generationDir: adapter.generationDir,
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
  const elapsed = Math.round((Date.now() - start) / 1000);
  await writeFile(
    join(out, "results.json"),
    JSON.stringify(
      {
        version: AGY_TRANSPORT_VERSION,
        planned: 1,
        completed: 1,
        results: [
          { caseId: c.id, ...result, seconds: old.seconds + elapsed, recovery },
        ],
        experimentallyEvaluated: false,
      },
      null,
      2,
    ) + "\n",
  );
  let after;
  try {
    after = await readAgyQuota();
  } finally {
    await writeFile(
      join(out, "quota.json"),
      JSON.stringify(
        [
          { phase: "before", caseId: c.id, ...before, gate },
          ...(after ? [{ phase: "after", caseId: c.id, ...after }] : []),
        ],
        null,
        2,
      ) + "\n",
    );
  }
  await writeFile(
    join(out, "run-status.json"),
    json({
      completed: 1,
      planned: 1,
      stopReason: after ? null : "Post-recovery quota unavailable",
    }) + "\n",
  );
  console.log(
    json({
      event: "recovered-run",
      caseId: c.id,
      status: result.status,
      failure: result.failure,
      seconds: old.seconds + elapsed,
    }),
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main(process.argv.slice(2)).catch((e) => {
    console.error((e as Error).stack);
    process.exitCode = 1;
  });
