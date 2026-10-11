#!/usr/bin/env node
// No native agent CLIs. Paid model adapters are intentionally not enabled in v1.
import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  copyFile,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  validateManifest,
  schedule,
  effectivePrompt,
  payloadIdentity,
  type Manifest,
} from "./spatial-benchmark/manifest";
import { hash, json } from "./spatial-benchmark/part-reference";
import {
  ROOT,
  bundleCompiler,
  isolationProbe,
} from "./spatial-benchmark/sandbox";
import {
  GenerationSession,
  stageEvaluation,
} from "./spatial-benchmark/session";

const HELP = `npx tsx scripts/spatial-benchmark.ts --manifest file.json --out EMPTY_DIR --mode preflight|dry-run|replay
  preflight: validate, compose and archive exact inputs and implementation hashes; no model calls
  dry-run: preflight plus isolated compilation of a two-part transport probe; not model evidence
  replay: --responses file.json (case ID -> ordered text responses), fresh session per case
  Evaluation is a separate command: --mode stage --run RUN_DIR --out EMPTY_DIR
  Calibration scoring: --mode calibrate --run RUN_DIR --task TASK_ID --out EMPTY_DIR
  No image, reference, revision, native-tool, resume or live-provider options are accepted.
  Replay never invokes a model and retains every scheduled failure.`;
const SOURCES = [
  "prompts/build-agent.md",
  "prompts/brick-build.md",
  "prompts/build-agent-diorama.md",
  "prompts/brick-build-diorama.md",
  "scripts/one-shot-build.ts",
  "scripts/agent-part-facts.ts",
  "scripts/brick-build.ts",
  "scripts/full-library-node.ts",
  "src/build-script/part-list.ts",
  "src/build-script/part-search.ts",
  "src/build-script/spec.ts",
  "src/build-script/compile.ts",
  "src/build-script/pack.ts",
  "src/catalog/data.json",
  "src/catalog/bounds.json",
  "src/catalog/connectors.json",
  "src/catalog/full-library-lock.json",
  "src/catalog/full-connectors-lock.json",
  "src/catalog/color-availability.json",
  "package.json",
  "package-lock.json",
  "scripts/spatial-benchmark.ts",
  "scripts/spatial-benchmark/manifest.ts",
  "scripts/spatial-benchmark/part-reference.ts",
  "scripts/spatial-benchmark/session.ts",
  "scripts/spatial-benchmark/sandbox.ts",
  "scripts/spatial-benchmark/compile-worker.ts",
  "scripts/spatial-benchmark/calibration-evaluator.ts",
  "fixtures/spatial-benchmark/evaluator/witnesses.json",
];
export async function preflight(m: Manifest, out: string) {
  await mkdir(out, { recursive: true });
  if ((await readdir(out)).length)
    throw new Error("Output directory must be empty");
  const cases = schedule(m);
  const inputs = cases.map((c) => ({
    caseId: c.id,
    prompt: effectivePrompt(m, c),
    case: c,
  }));
  for (const input of inputs)
    if (Buffer.byteLength(input.prompt) > m.budgets.referenceBytes)
      throw new Error(`Initial reference budget exceeded: ${input.caseId}`);
  await mkdir(join(out, "host-sources"));
  const hashes: Record<string, string> = {};
  for (const file of SOURCES) {
    const bytes = await readFile(join(ROOT, file));
    hashes[file] = hash(bytes);
    await mkdir(resolve(out, "host-sources", file, ".."), { recursive: true });
    await copyFile(join(ROOT, file), join(out, "host-sources", file));
  }
  const worker = join(out, "compiler.mjs");
  const compilerBundleSha256 = await bundleCompiler(worker);
  const isolation = await isolationProbe(worker);
  const record = {
    version: m.version,
    manifest: m,
    manifestSha256: hash(json(m)),
    baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim(),
    dirty: execFileSync(
      "git",
      ["status", "--porcelain", "--untracked-files=normal"],
      { cwd: ROOT, encoding: "utf8" },
    ).trim(),
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    transport: "replay-only/v1",
    nativeTools: [],
    network:
      "compiler namespace disabled; no generation network channel in CLI v1",
    compilerBundleSha256,
    isolation,
    hashes,
    runOrder: cases.map((c) => c.id),
    inputs: inputs.map((i) => ({ ...i, ...payloadIdentity(i.prompt) })),
    scheduled: cases.length,
    modelCalls: 0,
  };
  await writeFile(
    join(out, "preflight.json"),
    JSON.stringify(record, null, 2) + "\n",
  );
  await writeFile(
    join(out, "manifest.json"),
    JSON.stringify(m, null, 2) + "\n",
  );
  return { cases, worker, record };
}
export async function main(argv: string[]) {
  if (argv.includes("--help")) {
    console.log(HELP);
    return;
  }
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (
      ![
        "--manifest",
        "--out",
        "--mode",
        "--responses",
        "--run",
        "--task",
      ].includes(argv[i]) ||
      !argv[i + 1] ||
      flags.has(argv[i])
    )
      throw new Error(`Forbidden/unknown option ${argv[i]}`);
    flags.set(argv[i], argv[i + 1]);
  }
  const mode = flags.get("--mode") ?? "preflight",
    out = resolve(flags.get("--out") ?? "");
  if (!flags.get("--out")) throw new Error("--out required");
  if (mode === "calibrate") {
    if (
      !flags.get("--run") ||
      !flags.get("--task") ||
      flags.has("--manifest") ||
      flags.has("--responses")
    )
      throw new Error("calibrate takes --run, --task and --out only");
    await mkdir(out, { recursive: true });
    if ((await readdir(out)).length)
      throw new Error("Evaluator output directory must be empty");
    const { evaluateCalibration } = await import(
      "./spatial-benchmark/calibration-evaluator"
    );
    const evaluation = await evaluateCalibration(
      resolve(flags.get("--run")!),
      flags.get("--task")!,
    );
    await writeFile(
      join(out, "evaluation.json"),
      JSON.stringify(evaluation, null, 2) + "\n",
    );
    console.log(json(evaluation));
    return;
  }
  if (mode === "stage") {
    if (
      !flags.get("--run") ||
      flags.has("--responses") ||
      flags.has("--manifest")
    )
      throw new Error("stage takes --run and --out only");
    await stageEvaluation(resolve(flags.get("--run")!), out);
    console.log(
      "Frozen artifacts copied to evaluator staging; generation cannot resume.",
    );
    return;
  }
  if (
    !["preflight", "dry-run", "replay"].includes(mode) ||
    !flags.has("--manifest") ||
    flags.has("--run") ||
    flags.has("--task") ||
    (mode === "replay") !== flags.has("--responses")
  )
    throw new Error("Invalid mode/options; see --help");
  const m = validateManifest(
    JSON.parse(await readFile(resolve(flags.get("--manifest")!), "utf8")),
  );
  const { cases, worker, record } = await preflight(m, out);
  if (mode === "preflight") {
    console.log(json({ scheduled: record.scheduled, modelCalls: 0, out }));
    return;
  }
  let replies: Record<string, string[]>;
  if (mode === "replay") {
    replies = JSON.parse(
      await readFile(resolve(flags.get("--responses")!), "utf8"),
    );
    if (
      !replies ||
      typeof replies !== "object" ||
      Array.isArray(replies) ||
      Object.entries(replies).some(
        ([id, v]) =>
          !cases.some((c) => c.id === id) ||
          !Array.isArray(v) ||
          v.some((t) => typeof t !== "string"),
      )
    )
      throw new Error("Invalid text-only replay file");
  } else
    replies = Object.fromEntries(
      cases.map((c) => [
        c.id,
        [
          json({
            tool: "brick.build",
            input: {
              code: `script({title:"Transport probe"});section("Probe",[place({part:"${c.task.aliases ? "p1" : "3001"}",at:[0,0,0],colour:4}),place({part:"${c.task.aliases ? "p1" : "3001"}",at:[0,3,0],colour:4})]);`,
              seed: m.buildSeed,
            },
          }),
        ],
      ]),
    );
  await writeFile(join(out, "replay.json"), json(replies) + "\n");
  const results = [];
  for (const c of cases) {
    let n = 0;
    const session = new GenerationSession(
      m,
      c,
      join(out, c.id),
      worker,
      async () => {
        const text = replies[c.id]?.[n++];
        if (text === undefined)
          throw new Error("Replay exhausted/missing scheduled case");
        return text;
      },
    );
    results.push({ caseId: c.id, ...(await session.run()) });
  }
  await writeFile(
    join(out, "results.json"),
    JSON.stringify(
      { mode, modelCalls: 0, experimentallyEvaluated: false, results },
      null,
      2,
    ) + "\n",
  );
  console.log(
    json({
      mode,
      scheduled: cases.length,
      statuses: results.map((r) => ({ id: r.caseId, status: r.status })),
      modelCalls: 0,
      out,
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
