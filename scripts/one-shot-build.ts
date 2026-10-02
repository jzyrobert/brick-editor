#!/usr/bin/env node
// One-shot build runs, the MineBench way: the build-agent prompt goes to a
// model once, and its reply must be the build script JSON alone. A reply that
// is not valid JSON, or that does not compile cleanly within the part range,
// goes back with its errors ("return ONLY a corrected JSON object") up to
// --attempts times. The model has no tools and sees no renders; accepted
// builds are rendered afterwards for review. docs/AGENT-BUILDING.md#one-shot-runs
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { partRange } from "../src/build-script/budget";
import { REPO, slug } from "./new-build-workspace";

type Range = ReturnType<typeof partRange>;

const HELP = `npm run oneshot -- --target-parts N [--leeway 10] (--brief "…" | --brief-file f) --model M
    [--efforts low,medium,high,xhigh,max] [--attempts 5] [--out dir] [--views iso,front,iso-back]
  Runs each reasoning effort in parallel through \`codex exec\` with its tools turned off.
  --out  default ~/brick-builds/oneshot-<name>-<target>; one folder per effort, plus summary.md`;

/** Text below the first "---" line of a prompt file. */
function below(file: string) {
  const text = readFileSync(join(REPO, "prompts", file), "utf8");
  return text.slice(text.indexOf("\n---\n") + 5).trim();
}

const OUTPUT_LINE =
  "Return ONLY one JSON object (no markdown, no commentary). If the interface supports files, return it as `build.json`.";

/** The build-agent prompt without tools: brief and part range filled in. */
export function oneShotPrompt(brief: string, range: Range) {
  let text = below("build-agent.md");
  const tools = text.indexOf("\n## When you can run tools");
  const next = text.indexOf("\n## ", tools + 1);
  if (!text.includes(OUTPUT_LINE) || tools < 0 || next < 0)
    throw new Error("prompts/build-agent.md changed: update one-shot-build.ts");
  text = (text.slice(0, tools) + text.slice(next)).replace(
    OUTPUT_LINE,
    "Return ONLY one JSON object (no markdown, no commentary).",
  );
  const fmt = (n: number) => () => n.toLocaleString("en-US");
  return (
    text
      .replaceAll("{{TARGET_PARTS}}", fmt(range.target))
      .replaceAll("{{MIN_PARTS}}", fmt(range.min))
      .replaceAll("{{MAX_PARTS}}", fmt(range.max))
      .replaceAll("{{BRIEF}}", () => brief.trim()) + "\n"
  );
}

/** The follow-up for an invalid reply, after MineBench's repair prompt. */
export function repairPrompt(prompt: string, reason: string, previous: string) {
  return `${prompt}
---

Your previous output was invalid.
Reason:
${reason}

Fix it by returning ONLY a corrected JSON object.

Previous output:
${previous}
`;
}

/** The first JSON object in a reply (code fences and prose around it allowed). */
export function extractJson(text: string): unknown {
  for (
    let start = text.indexOf("{");
    start >= 0;
    start = text.indexOf("{", start + 1)
  ) {
    let depth = 0,
      inString = false,
      escaped = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
      } else if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          break;
        }
      }
    }
  }
  return undefined;
}

type Usage = {
  input: number;
  cached: number;
  output: number;
  reasoning: number;
};
type Attempt = {
  attempt: number;
  seconds: number;
  usage: Usage;
  /** Tool calls the model made anyway (there should be none). */
  toolEvents: string[];
  outcome: "accepted" | "no-json" | "invalid" | "errors" | "agent-failed";
  reason?: string;
  parts?: number;
};

function run(cmd: string, args: string[], cwd: string, timeoutMs: number) {
  return new Promise<{ code: number; stdout: string; stderr: string }>(
    (done) => {
      const child = spawn(cmd, args, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "",
        stderr = "";
      child.stdout.on("data", (d) => (stdout += d));
      child.stderr.on("data", (d) => (stderr += d));
      const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
      child.on("close", (code) => {
        clearTimeout(timer);
        done({ code: code ?? 1, stdout, stderr });
      });
    },
  );
}

// Every tool Codex offers, off: the reply has to come from reasoning alone.
const NO_TOOLS = [
  "shell_tool",
  "unified_exec",
  "multi_agent",
  "browser_use",
  "browser_use_external",
  "computer_use",
  "apps",
  "image_generation",
  "in_app_browser",
  "code_mode_host",
  "goals",
  "skill_search",
  "tool_suggest",
  "sleep_tool",
].flatMap((f) => ["--disable", f]);

async function askCodex(
  prompt: string,
  model: string,
  effort: string,
  dir: string,
  n: number,
) {
  const empty = join(dir, "empty");
  await mkdir(empty, { recursive: true });
  const reply = join(dir, `attempt-${n}.reply.md`);
  const started = Date.now();
  const r = await run(
    "codex",
    [
      "exec",
      "--ignore-user-config",
      "--skip-git-repo-check",
      "-s",
      "read-only",
      "-m",
      model,
      "-c",
      `model_reasoning_effort="${effort}"`,
      "-c",
      'web_search="disabled"',
      ...NO_TOOLS,
      "-C",
      empty,
      "--json",
      "-o",
      reply,
      prompt,
    ],
    empty,
    3 * 60 * 60 * 1000,
  );
  await writeFile(join(dir, `attempt-${n}.codex.jsonl`), r.stdout);
  await writeFile(join(dir, `attempt-${n}.codex.stderr`), r.stderr);
  const usage: Usage = { input: 0, cached: 0, output: 0, reasoning: 0 };
  const toolEvents: string[] = [];
  for (const line of r.stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (e.type === "turn.completed" && e.usage) {
        usage.input += e.usage.input_tokens ?? 0;
        usage.cached += e.usage.cached_input_tokens ?? 0;
        usage.output += e.usage.output_tokens ?? 0;
        usage.reasoning += e.usage.reasoning_output_tokens ?? 0;
      }
      const t = e.item?.type;
      if (
        e.type === "item.completed" &&
        t &&
        !["agent_message", "reasoning", "error"].includes(t)
      )
        toolEvents.push(t);
    } catch {
      // not an event line
    }
  }
  return {
    code: r.code,
    text: existsSync(reply) ? readFileSync(reply, "utf8") : "",
    seconds: Math.round((Date.now() - started) / 1000),
    usage,
    toolEvents,
    stderr: r.stderr,
  };
}

const CLI = [
  join(REPO, "node_modules/tsx/dist/cli.mjs"),
  join(REPO, "scripts/brick-cli.ts"),
];

async function compile(
  dir: string,
  n: number | "final",
  range: Range,
  extra: string[] = [],
) {
  const name = n === "final" ? "build" : `attempt-${n}`;
  const r = await run(
    process.execPath,
    [
      ...CLI,
      "build",
      "--script",
      `${name}.json`,
      "--output",
      `${name}.mpd`,
      "--target-parts",
      String(range.target),
      "--leeway",
      String(range.leeway),
      "--json",
      ...extra,
    ],
    dir,
    30 * 60 * 1000,
  );
  try {
    return { report: JSON.parse(r.stdout) };
  } catch {
    const line = r.stderr
      .trim()
      .split("\n")
      .reverse()
      .find((l) => l.startsWith("{"));
    let reason = r.stderr.trim().slice(-2000) || "The compiler failed";
    try {
      const e = JSON.parse(line ?? "");
      reason = `${e.code}: ${e.message}`;
    } catch {
      // keep the raw text
    }
    return { reason };
  }
}

type Problem = {
  severity: string;
  code: string;
  message: string;
  ops?: string[];
};

async function runEffort(
  effort: string,
  o: {
    prompt: string;
    model: string;
    range: Range;
    attempts: number;
    out: string;
    views: string;
  },
) {
  const dir = join(o.out, effort);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "prompt.md"), o.prompt);
  const attempts: Attempt[] = [];
  let message = o.prompt,
    accepted = false;
  for (let n = 1; n <= o.attempts && !accepted; n++) {
    const ask = await askCodex(message, o.model, effort, dir, n);
    const a: Attempt = {
      attempt: n,
      seconds: ask.seconds,
      usage: ask.usage,
      toolEvents: ask.toolEvents,
      outcome: "agent-failed",
    };
    attempts.push(a);
    if (ask.code !== 0 || !ask.text.trim()) {
      a.reason = `codex exited ${ask.code}: ${ask.stderr.trim().slice(-500)}`;
      break; // the agent itself failed: not something a repair prompt fixes
    }
    const json = extractJson(ask.text);
    let reason: string;
    if (json === undefined) {
      a.outcome = "no-json";
      reason = "Could not find a valid JSON object in the response";
    } else {
      await writeFile(
        join(dir, `attempt-${n}.json`),
        JSON.stringify(json, null, 1) + "\n",
      );
      const c = await compile(dir, n, o.range);
      if (!c.report) {
        a.outcome = "invalid";
        reason = c.reason!;
      } else {
        a.parts = c.report.stats?.parts;
        const errors = (c.report.problems as Problem[]).filter(
          (p) => p.severity === "error",
        );
        if (c.report.ok) {
          a.outcome = "accepted";
          accepted = true;
          await copyFile(
            join(dir, `attempt-${n}.json`),
            join(dir, "build.json"),
          );
          break;
        }
        a.outcome = "errors";
        reason =
          errors
            .slice(0, 20)
            .map(
              (p) =>
                `- ${p.code}: ${p.message}${p.ops?.length ? ` [${p.ops.join(", ")}]` : ""}`,
            )
            .join("\n") +
          (errors.length > 20 ? `\n- … ${errors.length - 20} more errors` : "");
      }
    }
    a.reason = reason;
    message = repairPrompt(o.prompt, reason, ask.text);
  }
  const final = attempts.at(-1);
  if (accepted && o.views) {
    await mkdir(join(dir, "views"), { recursive: true });
    await compile(dir, "final", o.range, [
      "--render",
      "views/build.png",
      "--views",
      o.views,
    ]);
  }
  const total = (k: keyof Usage) =>
    attempts.reduce((s, a) => s + a.usage[k], 0);
  const result = {
    effort,
    model: o.model,
    targetParts: o.range.target,
    leeway: o.range.leeway,
    minParts: o.range.min,
    maxParts: o.range.max,
    accepted,
    attemptsUsed: attempts.length,
    parts: accepted ? final?.parts : undefined,
    seconds: attempts.reduce((s, a) => s + a.seconds, 0),
    tokens: {
      input: total("input"),
      cached: total("cached"),
      output: total("output"),
      reasoning: total("reasoning"),
    },
    attempts,
  };
  await writeFile(
    join(dir, "result.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    `${effort}: ${accepted ? `accepted, ${final?.parts} parts` : "not accepted"} after ${attempts.length} attempt(s), ${result.seconds} s`,
  );
  return result;
}

async function main(argv: string[]) {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, "");
    if (key === "help" || !argv[i].startsWith("--")) {
      console.log(HELP);
      return key === "help" ? 0 : 1;
    }
    if (
      ![
        "target-parts",
        "leeway",
        "brief",
        "brief-file",
        "model",
        "efforts",
        "attempts",
        "out",
        "views",
        "name",
      ].includes(key)
    )
      throw new Error(`Unknown flag ${argv[i]}\n${HELP}`);
    if (argv[i + 1] === undefined)
      throw new Error(`Missing value for ${argv[i]}`);
    flags.set(key, argv[++i]);
  }
  const range = partRange(
    Number(flags.get("target-parts")),
    Number(flags.get("leeway") ?? 10),
  );
  const file = flags.get("brief-file");
  const brief = flags.get("brief") ?? (file ? readFileSync(file, "utf8") : "");
  const model = flags.get("model");
  if (!brief.trim() || !model)
    throw new Error(`Give --brief (or --brief-file) and --model\n${HELP}`);
  const attempts = Number(flags.get("attempts") ?? 5);
  if (!Number.isInteger(attempts) || attempts < 1)
    throw new Error("--attempts must be 1 or more");
  const efforts = (flags.get("efforts") ?? "low,medium,high,xhigh,max")
    .split(",")
    .filter(Boolean);
  const out = resolve(
    (
      flags.get("out") ??
      `~/brick-builds/oneshot-${slug(flags.get("name") ?? brief)}-${range.target}`
    ).replace(/^~(?=$|\/)/, homedir()),
  );
  await mkdir(out, { recursive: true });
  const prompt = oneShotPrompt(brief, range);
  const views = flags.get("views") ?? "iso,front,iso-back";
  const results = await Promise.all(
    efforts.map((e) =>
      runEffort(e, { prompt, model, range, attempts, out, views }),
    ),
  );
  const rows = results.map(
    (r) =>
      `| ${r.effort} | ${r.accepted ? "yes" : "no"} | ${r.parts?.toLocaleString("en-US") ?? "–"} | ${r.attemptsUsed} | ${r.seconds} | ${r.tokens.output.toLocaleString("en-US")} (${r.tokens.reasoning.toLocaleString("en-US")} reasoning) | ${r.attempts.map((a) => a.outcome).join(", ")} |`,
  );
  await writeFile(
    join(out, "summary.json"),
    JSON.stringify(
      { brief: brief.trim(), model, range, attempts, results },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    join(out, "summary.md"),
    `# ${brief.trim()} — ${model}, ${range.min}–${range.max} parts (target ${range.target} ± ${range.leeway}%)\n\n` +
      "| effort | accepted | parts | attempts | seconds | output tokens | outcomes |\n| --- | --- | --- | --- | --- | --- | --- |\n" +
      rows.join("\n") +
      "\n",
  );
  console.log(`\n${join(out, "summary.md")}`);
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main(process.argv.slice(2)).then(
    (code) => (process.exitCode = code),
    (e: Error) => {
      console.error(e.message);
      process.exitCode = 1;
    },
  );
