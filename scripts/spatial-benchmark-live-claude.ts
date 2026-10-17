#!/usr/bin/env node
// Claude counterpart of spatial-benchmark-live.ts: the same manifests,
// GenerationSession, budgets, facts and isolated compiler, through the native
// Claude CLI channel (scripts/spatial-benchmark/claude-channel.ts). There is
// no quota reader for Claude; every scheduled case runs once, failures are
// retained and never retried. --cases runs only the named scheduled cases,
// for cases a host interruption left without an outcome; each is recorded.
// --continue-from resumes one case that ended by asking for a check beyond
// its budget: the same native session gets FINAL_NOTICE, with the run-wide
// budgets it already used.
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { preflight } from "./spatial-benchmark";
import { validateManifest } from "./spatial-benchmark/manifest";
import {
  GenerationSession,
  FINAL_NOTICE,
  type Counters,
  type TextMessage,
} from "./spatial-benchmark/session";
import type { Manifest, ScheduledCase } from "./spatial-benchmark/manifest";
import {
  claudeChannel,
  validateClaudeModel,
  CLAUDE_TRANSPORT_VERSION,
} from "./spatial-benchmark/claude-channel";
import { json, hash } from "./spatial-benchmark/part-reference";
const ROOT = new URL("../", import.meta.url);
export async function main(argv: string[]) {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (
      !["--manifest", "--out", "--cases", "--continue-from"].includes(
        argv[i],
      ) ||
      !argv[i + 1] ||
      flags.has(argv[i])
    )
      throw new Error(
        "Claude live mode takes --manifest, --out and optional --cases or --continue-from",
      );
    flags.set(argv[i], argv[i + 1]);
  }
  if (!flags.has("--manifest") || !flags.has("--out"))
    throw new Error("Explicit manifest and fresh output required");
  const m = validateManifest(
    JSON.parse(await readFile(resolve(flags.get("--manifest")!), "utf8")),
  );
  validateClaudeModel(m.model);
  const out = resolve(flags.get("--out")!);
  const { cases: scheduled, worker, record } = await preflight(m, out);
  const only = flags.get("--cases")?.split(",");
  for (const id of only ?? [])
    if (!scheduled.some((c) => c.id === id))
      throw new Error(`Not a scheduled case: ${id}`);
  const cases = only ? scheduled.filter((c) => only.includes(c.id)) : scheduled;
  const prior = flags.has("--continue-from")
    ? await priorCase(resolve(flags.get("--continue-from")!), cases, m)
    : undefined;
  const sourceNames = [
    "scripts/spatial-benchmark-live-claude.ts",
    "scripts/spatial-benchmark/claude-channel.ts",
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
    join(out, "preflight.json"),
    JSON.stringify(
      {
        ...record,
        transport: CLAUDE_TRANSPORT_VERSION,
        network:
          "native Claude CLI with host-managed authentication; tools off, no MCP, empty working directory",
        modelCalls: null,
        sourceHashes,
        scheduled: cases.length,
        runOrder: cases.map((c) => c.id),
        selectedCases: only ?? null,
        continuation: prior
          ? { from: prior.from, thread: prior.thread, message: FINAL_NOTICE }
          : null,
      },
      null,
      2,
    ) + "\n",
  );
  const results: unknown[] = [];
  const save = () =>
    writeFile(
      join(out, "results.json"),
      JSON.stringify(
        {
          version: CLAUDE_TRANSPORT_VERSION,
          planned: cases.length,
          completed: results.length,
          results,
          experimentallyEvaluated: false,
        },
        null,
        2,
      ) + "\n",
    );
  await save();
  for (const c of cases) {
    const dir = join(out, c.id);
    await mkdir(dir);
    // Native state stays in a sibling of the session's fresh directory.
    const nativeDir = join(out, c.id + "--transport");
    await mkdir(join(nativeDir, "generation"), { recursive: true });
    let runtime: Awaited<ReturnType<typeof claudeChannel>> | undefined;
    const started = Date.now();
    const generation = new GenerationSession(
      m,
      c,
      dir,
      worker,
      async (request) => {
        runtime ??= await claudeChannel({
          dir: nativeDir,
          // A resumed native session lives under the directory it began in.
          generationDir: prior?.generationDir ?? join(nativeDir, "generation"),
          model: m.model,
          thread: prior?.thread,
        });
        return runtime.channel(request);
      },
    );
    let result;
    try {
      result = await generation.run(
        prior && {
          messages: prior.messages,
          used: prior.used,
          message: FINAL_NOTICE,
        },
      );
    } finally {
      await runtime?.close();
    }
    results.push({
      caseId: c.id,
      ...result,
      seconds: Math.round((Date.now() - started) / 1000),
    });
    await save();
    console.log(
      json({
        event: "completed-run",
        caseId: c.id,
        status: result.status,
        completed: results.length,
        planned: cases.length,
      }),
    );
  }
  await writeFile(
    join(out, "run-status.json"),
    JSON.stringify(
      {
        completed: results.length,
        planned: cases.length,
        stopReason: null,
        experimentallyEvaluated: false,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(json({ event: "study-ended", completed: results.length }));
}
/** The conversation, used budgets and native session of one frozen case that
 * ended by asking for a check beyond its budget. */
async function priorCase(from: string, cases: ScheduledCase[], m: Manifest) {
  if (cases.length !== 1)
    throw new Error("--continue-from needs exactly one case in --cases");
  const c = cases[0];
  const priorManifest = validateManifest(
    JSON.parse(await readFile(join(from, "manifest.json"), "utf8")),
  );
  if (hash(json(priorManifest)) !== hash(json(m)))
    throw new Error("Continuation requires the identical manifest");
  const r = JSON.parse(
    await readFile(join(from, "results.json"), "utf8"),
  ).results.find((x: { caseId: string }) => x.caseId === c.id);
  if (
    r?.status !== "model-failure" ||
    r.failure !== "Run-wide checks budget exhausted"
  )
    throw new Error("Only a case that asked for an extra check can continue");
  let messages: TextMessage[] = [],
    last = "";
  for (const line of (
    await readFile(join(from, c.id, "audit.jsonl"), "utf8")
  ).split("\n")) {
    if (!line) continue;
    const e = JSON.parse(line);
    if (e.kind === "channel-request") messages = e.payload.messages;
    if (e.kind === "model-output") last = e.payload.text;
  }
  messages = [...messages, { role: "assistant", content: last }];
  const native = join(from, c.id + "--transport", "native");
  const turns = (await readdir(native))
    .filter((f) => f.endsWith(".result.json"))
    .sort((a, b) => parseInt(a.slice(5)) - parseInt(b.slice(5)));
  const thread: string = JSON.parse(
    await readFile(join(native, turns.at(-1)!), "utf8"),
  ).session;
  return {
    from,
    thread,
    messages,
    used: r.used as Counters,
    generationDir: join(from, c.id + "--transport", "generation"),
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main(process.argv.slice(2)).catch((e) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  });
