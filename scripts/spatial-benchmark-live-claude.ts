#!/usr/bin/env node
// Claude counterpart of spatial-benchmark-live.ts: the same manifests,
// GenerationSession, budgets, facts and isolated compiler, through the native
// Claude CLI channel (scripts/spatial-benchmark/claude-channel.ts). There is
// no quota reader for Claude; every scheduled case runs once, failures are
// retained and never retried. --cases runs only the named scheduled cases,
// for cases a host interruption left without an outcome; each is recorded.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { preflight } from "./spatial-benchmark";
import { validateManifest } from "./spatial-benchmark/manifest";
import { GenerationSession } from "./spatial-benchmark/session";
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
      !["--manifest", "--out", "--cases"].includes(argv[i]) ||
      !argv[i + 1] ||
      flags.has(argv[i])
    )
      throw new Error(
        "Claude live mode takes --manifest, --out and optional --cases",
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
          generationDir: join(nativeDir, "generation"),
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
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main(process.argv.slice(2)).catch((e) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  });
