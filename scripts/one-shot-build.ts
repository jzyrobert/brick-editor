#!/usr/bin/env node
// One-shot build runs, the MineBench way: the build-agent prompt goes to a
// model once, and its reply must be the build script JSON alone. A reply that
// is not valid JSON, or that does not compile cleanly (overlaps, colours a part
// is not made in…), goes back with its errors ("return ONLY a corrected JSON
// object") up to --attempts times. The part target is guidance: any count is
// accepted, and how far the build lands from the target is recorded as a
// score. The prompt lists the curated parts (--parts-list) and the
// model may search parts (--search: it replies {"parts_search": …} and gets
// the results in the same session) but cannot compile or see renders. Accepted builds are rendered afterwards
// for review. docs/AGENT-BUILDING.md#one-shot-runs
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { partTarget, targetMiss, targetText } from "../src/build-script/budget";
import {
  promptPartList,
  searchForAgent,
  type SearchArgs,
} from "../src/build-script/part-list";
import { catalog } from "../src/catalog/catalog";
import { registerAgentData } from "./build-script-cli";
import { registerFullLibraryFromDisk } from "./full-library-node";
import { REPO, slug } from "./new-build-workspace";

const HELP = `npm run oneshot -- --target-parts N (--brief "…" | --brief-file f) --model M
    [--efforts low,medium,high,xhigh,max] [--attempts 5] [--out dir] [--views iso,front,iso-back]
    [--parts-list on|off] [--search on|off] [--runner codex|claude]
  Runs each reasoning effort in parallel through \`codex exec\` (or, with --runner claude,
  \`claude -p\` with --effort) with its tools turned off;
  --search on (default) lets it search parts by replying {"parts_search": …}. --parts-list on (default) puts the
  224 curated parts and their common colours in the prompt.
  --out  default ~/brick-builds/oneshot-<name>-<target>; one folder per effort, plus summary.md`;

/** Text below the first "---" line of a prompt file. */
function below(file: string) {
  const text = readFileSync(join(REPO, "prompts", file), "utf8");
  return text.slice(text.indexOf("\n---\n") + 5).trim();
}

const OUTPUT_LINE =
  "Return ONLY one JSON object (no markdown, no commentary). If the interface supports files, return it as `build.json`.";

const SEARCH_SECTION = `## Searching for parts

You cannot compile, render or run commands. Before you answer you may search the parts library (the curated parts and the complete official library): reply with ONLY a JSON object such as \`{"parts_search": [{"query": "stone lantern"}, {"query": "slope", "size": "1x2", "colour": "dark red", "available_in_colour": true}]}\` (up to 5 searches per reply; fields: query, size as WxD studs or WxDxH plates, category, colour, available_in_colour, limit). The results come back with each part's footprint (x × z at turn 0), height, how far its body reaches past the footprint when it does, and colours, and you can search again: up to 10 search replies, each with up to 5 searches, before you answer. Your answer is the build script JSON alone.`;

/** The build-agent prompt for one reply: brief, part target and (unless
 * turned off) the part list filled in; the search tool described when on.
 * The part list needs colour availability registered. */
export function oneShotPrompt(
  brief: string,
  target: number,
  { partsList = true, search = false } = {},
) {
  let text = below("build-agent.md");
  const tools = text.indexOf("\n## When you can run tools");
  const next = text.indexOf("\n## ", tools + 1);
  if (!text.includes(OUTPUT_LINE) || tools < 0 || next < 0)
    throw new Error("prompts/build-agent.md changed: update one-shot-build.ts");
  text = (text.slice(0, tools) + text.slice(next)).replace(
    OUTPUT_LINE,
    "Return ONLY one JSON object (no markdown, no commentary).",
  );
  registerAgentData(); // colour availability, for the part list
  if (partsList) text = text.replace("{{PARTS}}", () => promptPartList());
  else {
    const at = text.indexOf("\n## Parts\n");
    text = text.slice(0, at) + text.slice(text.indexOf("\n## ", at + 1));
  }
  if (search) {
    const first = text.indexOf("\n## ");
    text = `${text.slice(0, first)}\n\n${SEARCH_SECTION}\n${text.slice(first)}`;
  }
  const fmt = (n: number) => () => n.toLocaleString("en-US");
  return (
    text
      .replaceAll("{{TARGET_PARTS}}", fmt(target))
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

/** The reason a compiled reply goes back: its size against the target every
 * time (a repair should not have to guess whether its fixes moved the
 * count), then up to 20 errors with the ops that made them. */
export function errorsReason(
  parts: number,
  target: number,
  errors: { code: string; message: string; ops?: string[] }[],
) {
  return (
    `The script compiled to ${targetText(parts, target)}. Errors to fix:\n` +
    errors
      .slice(0, 20)
      .map(
        (p) =>
          `- ${p.code}: ${p.message}${p.ops?.length ? ` [${p.ops.join(", ")}]` : ""}`,
      )
      .join("\n") +
    (errors.length > 20 ? `\n- … ${errors.length - 20} more errors` : "")
  );
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
  /** What the provider says the calls cost (Claude Code reports it). */
  costUsd: number;
};
type Search = { args: SearchArgs; results: string[]; round: number };
/** What a reply shows about the model's part knowledge. */
type Knowledge = {
  /** Part numbers written in the script. */
  named: string[];
  /** Of those, the ones not in the prompt's part list. */
  notInList: string[];
  /** `{"find": …}` phrases and what each resolved to. */
  finds: { find: string; ref: string; name: string }[];
  /** Old numbers the compiler replaced. */
  moved: string[];
  /** Placed parts in colours they are not made in. */
  colourErrors: string[];
  /** A part number the compiler did not know (the compile stops at the first). */
  unknownPart?: string;
};
type Attempt = {
  attempt: number;
  seconds: number;
  usage: Usage;
  /** Every parts search it asked for, with the part numbers returned. */
  searches: Search[];
  /** Other tool calls the model made anyway (there should be none). */
  toolEvents: string[];
  /** Provider errors waited out and retried (not the model's doing). */
  providerRetries: { round: number; error: string }[];
  knowledge?: Knowledge;
  outcome: "accepted" | "no-json" | "invalid" | "errors" | "agent-failed";
  reason?: string;
  parts?: number;
};

function run(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  input?: string,
  env?: NodeJS.ProcessEnv,
) {
  return new Promise<{ code: number; stdout: string; stderr: string }>(
    (done) => {
      const child = spawn(cmd, args, {
        cwd,
        env: env && { ...process.env, ...env },
        stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      });
      if (input !== undefined) child.stdin!.end(input);
      let stdout = "",
        stderr = "";
      child.stdout!.on("data", (d) => (stdout += d));
      child.stderr!.on("data", (d) => (stderr += d));
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

const TSX = join(REPO, "node_modules/tsx/dist/cli.mjs");
/** Provider errors worth waiting out. */
const BUSY =
  /[^\n"]*(at capacity|rate.limit|overloaded|temporarily unavailable|stream disconnected)[^\n"]*/i;
/** Search rounds allowed in one attempt before the model must answer. */
const SEARCH_ROUNDS = 10;

function events(stdout: string, usage: Usage, toolEvents: string[]) {
  let thread: string | undefined;
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (e.type === "thread.started") thread = e.thread_id;
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
  return thread;
}

/** The searches a reply asks for ({"parts_search": {...} | [...]}), if any. */
export function searchRequest(text: string): SearchArgs[] | undefined {
  const json = extractJson(text) as { parts_search?: unknown } | undefined;
  const req = json?.parts_search;
  if (!req || typeof req !== "object") return undefined;
  return (Array.isArray(req) ? req : [req]).slice(0, 5) as SearchArgs[];
}

type Reply = Awaited<ReturnType<typeof run>> & { text: string };

/** Sends one message to the model, resuming `thread` when given, and adds
 * the tokens it used to `usage`. */
type Runner = {
  name: string;
  send(
    message: string,
    thread: string | undefined,
    usage: Usage,
    toolEvents: string[],
  ): Promise<Reply & { thread?: string }>;
  /** The log file for one round's raw output. */
  log: string;
};

/** `codex exec` with every Codex tool off; the reply is its last message. */
function codexRunner(
  model: string,
  effort: string,
  cwd: string,
  reply: string,
) {
  const common = [
    "--ignore-user-config",
    "--skip-git-repo-check",
    "-m",
    model,
    "-c",
    `model_reasoning_effort="${effort}"`,
    "-c",
    'web_search="disabled"',
    "-c",
    'sandbox_mode="read-only"',
    ...NO_TOOLS,
    "--json",
    "-o",
    reply,
  ];
  return {
    name: "codex",
    log: "codex.jsonl",
    async send(message, thread, usage, toolEvents) {
      if (existsSync(reply)) await writeFile(reply, "");
      const r = await run(
        "codex",
        thread
          ? ["exec", "resume", thread, ...common, message]
          : ["exec", ...common, message],
        cwd,
        3 * 60 * 60 * 1000,
      );
      return {
        ...r,
        thread: events(r.stdout, usage, toolEvents) ?? thread,
        text: existsSync(reply) ? readFileSync(reply, "utf8") : "",
      };
    },
  } satisfies Runner;
}

/** `claude -p` (Claude Code) with every tool off and no user customisation
 * (CLAUDE.md, memory, skills, plugins, hooks, MCP): Claude Code's own system
 * prompt and the message alone. The message goes in on stdin (a repair
 * message can pass the 128 kB argument limit). A reply that reaches the
 * output cap is continued by Claude Code in further turns, and its `result`
 * holds only the last one, so the reply is every assistant text joined. */
function claudeRunner(model: string, effort: string, cwd: string) {
  const common = [
    "-p",
    "--model",
    model,
    "--effort",
    effort,
    "--tools",
    "",
    "--safe-mode",
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--output-format",
    "stream-json",
    "--verbose",
  ];
  return {
    name: "claude",
    log: "claude.jsonl",
    async send(message, thread, usage, toolEvents) {
      const r = await run(
        "claude",
        thread ? ["--resume", thread, ...common] : common,
        cwd,
        3 * 60 * 60 * 1000,
        message,
        // Claude Code caps a reply below the model's limit by default.
        { CLAUDE_CODE_MAX_OUTPUT_TOKENS: "128000" },
      );
      let e: {
        session_id?: string;
        result?: string;
        is_error?: boolean;
        num_turns?: number;
        total_cost_usd?: number;
        usage?: {
          input_tokens?: number;
          cache_creation_input_tokens?: number;
          cache_read_input_tokens?: number;
          output_tokens?: number;
          output_tokens_details?: { thinking_tokens?: number };
        };
      } = {};
      const texts: string[] = [];
      for (const line of r.stdout.split("\n")) {
        if (!line.trim()) continue;
        try {
          const ev = JSON.parse(line);
          if (ev.type === "result") e = ev;
          if (ev.type === "assistant")
            for (const c of ev.message?.content ?? [])
              if (c.type === "text") texts.push(c.text);
              else if (c.type === "tool_use") toolEvents.push(c.name);
        } catch {
          // not an event line
        }
      }
      const u = e.usage ?? {};
      usage.cached += u.cache_read_input_tokens ?? 0;
      usage.input +=
        (u.input_tokens ?? 0) +
        (u.cache_creation_input_tokens ?? 0) +
        (u.cache_read_input_tokens ?? 0);
      usage.output += u.output_tokens ?? 0;
      usage.reasoning += u.output_tokens_details?.thinking_tokens ?? 0;
      usage.costUsd += e.total_cost_usd ?? 0;
      if ((e.num_turns ?? 1) > 1) toolEvents.push(`turns:${e.num_turns}`);
      return {
        ...r,
        code: e.is_error ? r.code || 1 : r.code,
        thread: e.session_id ?? thread,
        text: e.is_error ? "" : texts.join("") || (e.result ?? ""),
      };
    },
  } satisfies Runner;
}

/** One attempt: the message, then (with --search) as many search rounds as
 * the model asks for, each answered in the same session, until it replies
 * with something else. Every tool stays off. */
async function askAgent(
  prompt: string,
  runner: "codex" | "claude",
  model: string,
  effort: string,
  dir: string,
  n: number,
  search: boolean,
) {
  const empty = join(dir, "empty");
  await mkdir(empty, { recursive: true });
  const agent =
    runner === "claude"
      ? claudeRunner(model, effort, empty)
      : codexRunner(model, effort, empty, join(dir, `attempt-${n}.reply.md`));
  const usage: Usage = {
    input: 0,
    cached: 0,
    output: 0,
    reasoning: 0,
    costUsd: 0,
  };
  const toolEvents: string[] = [];
  const searches: Search[] = [];
  const retries: { round: number; error: string }[] = [];
  const started = Date.now();
  let thread: string | undefined,
    message = prompt,
    text = "",
    code = 0,
    stderr = "";
  for (let round = 0; ; round++) {
    let r: Awaited<ReturnType<Runner["send"]>>;
    // The provider being busy is not the model's failure: wait and send the
    // same message again (1, 2, 4, 8, 16 minutes).
    for (let tries = 0; ; tries++) {
      r = await agent.send(message, thread, usage, toolEvents);
      const busy = r.code !== 0 && BUSY.exec(`${r.stdout}\n${r.stderr}`)?.[0];
      if (!busy || tries >= 5) break;
      retries.push({ round, error: busy });
      thread = r.thread;
      await new Promise((done) => setTimeout(done, 60_000 * 2 ** tries));
    }
    const suffix = round ? `.${round}` : "";
    await writeFile(join(dir, `attempt-${n}${suffix}.${agent.log}`), r.stdout);
    await writeFile(
      join(dir, `attempt-${n}${suffix}.${agent.name}.stderr`),
      r.stderr,
    );
    if (agent.name === "claude")
      await writeFile(join(dir, `attempt-${n}.reply.md`), r.text);
    thread = r.thread;
    code = r.code;
    stderr = r.stderr;
    text = r.text;
    if (code !== 0 || !search) break;
    const asked = searchRequest(text);
    if (!asked || !thread) break;
    if (round >= SEARCH_ROUNDS) {
      message = "No more searches. Answer now with ONLY the build script JSON.";
      if (round > SEARCH_ROUNDS) break;
      continue;
    }
    const answers = asked.map((args) => {
      const out = searchForAgent(args);
      searches.push({ args, results: out.ids, round: round + 1 });
      return `### ${JSON.stringify(args)}\n${out.text}`;
    });
    await writeFile(
      join(dir, `attempt-${n}.searches.jsonl`),
      searches.map((x) => JSON.stringify(x)).join("\n") + "\n",
    );
    message = `Search results:\n\n${answers.join("\n\n")}\n\nSearch again (${SEARCH_ROUNDS - round - 1} search replies left) or answer with ONLY the build script JSON.`;
  }
  return {
    code,
    searches,
    retries,
    text,
    seconds: Math.round((Date.now() - started) / 1000),
    usage,
    toolEvents,
    stderr,
  };
}

const CLI = [TSX, join(REPO, "scripts/brick-cli.ts")];

const LISTED = new Set(
  Object.keys(catalog).map((id) => id.replace(/\.dat$/, "")),
);

/** Part numbers written in a script: `part` fields, `parts` lists and aliases
 * (phrases and @aliases are not numbers). */
function namedParts(script: unknown) {
  const out = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === "string" && !v.startsWith("@") && !/\s/.test(v))
      out.add(v.toLowerCase().replace(/\.dat$/, ""));
  };
  const walk = (v: unknown, key?: string) => {
    if (Array.isArray(v)) {
      if (key === "parts") v.forEach(add);
      v.forEach((x) => walk(x));
    } else if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v)) {
        if (k === "part") add(x);
        if (k === "parts" && x && typeof x === "object" && !Array.isArray(x))
          Object.values(x).forEach(add);
        walk(x, k);
      }
  };
  walk(script);
  return [...out].sort();
}

/** Part knowledge in one reply: numbers named, finds, fixes and errors. */
export function knowledge(
  script: unknown,
  report?: { resolved?: Knowledge["finds"]; problems?: Problem[] },
  reason?: string,
): Knowledge {
  const named = namedParts(script);
  const problems = report?.problems ?? [];
  const unknown = reason?.match(/unknown part "([^"]+)"/);
  return {
    named,
    notInList: named.filter((p) => !LISTED.has(p)),
    finds: (report?.resolved ?? []).map(({ find, ref, name }) => ({
      find,
      ref: ref.replace(/\.dat$/, ""),
      name,
    })),
    moved: problems
      .filter((p) => p.code === "part-moved")
      .map((p) => p.message),
    colourErrors: problems
      .filter((p) => p.code === "colour-unavailable")
      .map((p) => p.message),
    ...(unknown ? { unknownPart: unknown[1] } : {}),
  };
}

async function compile(
  dir: string,
  n: number | "final",
  target: number,
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
      String(target),
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
    target: number;
    attempts: number;
    out: string;
    views: string;
    search: boolean;
    runner: "codex" | "claude";
  },
) {
  const dir = join(o.out, effort);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "prompt.md"), o.prompt);
  const attempts: Attempt[] = [];
  let message = o.prompt,
    accepted = false;
  for (let n = 1; n <= o.attempts && !accepted; n++) {
    const ask = await askAgent(
      message,
      o.runner,
      o.model,
      effort,
      dir,
      n,
      o.search,
    );
    const a: Attempt = {
      attempt: n,
      seconds: ask.seconds,
      usage: ask.usage,
      searches: ask.searches,
      toolEvents: ask.toolEvents,
      providerRetries: ask.retries,
      outcome: "agent-failed",
    };
    attempts.push(a);
    if (ask.code !== 0 || !ask.text.trim()) {
      a.reason = `${o.runner} exited ${ask.code}: ${ask.stderr.trim().slice(-500)}`;
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
      const c = await compile(dir, n, o.target);
      a.knowledge = knowledge(json, c.report, c.reason);
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
        reason = errorsReason(a.parts ?? 0, o.target, errors);
      }
    }
    a.reason = reason;
    message = repairPrompt(o.prompt, reason, ask.text);
  }
  const final = attempts.at(-1);
  if (accepted && o.views) {
    await mkdir(join(dir, "views"), { recursive: true });
    await compile(dir, "final", o.target, [
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
    runner: o.runner,
    model: o.model,
    targetParts: o.target,
    accepted,
    attemptsUsed: attempts.length,
    parts: accepted ? final?.parts : undefined,
    /** How far the accepted build landed from the target: the size score. */
    targetMiss:
      accepted && final?.parts !== undefined
        ? targetMiss(final.parts, o.target)
        : undefined,
    seconds: attempts.reduce((s, a) => s + a.seconds, 0),
    tokens: {
      input: total("input"),
      cached: total("cached"),
      output: total("output"),
      reasoning: total("reasoning"),
      ...(o.runner === "claude" ? { costUsd: total("costUsd") } : {}),
    },
    searches: attempts.reduce((s, a) => s + a.searches.length, 0),
    knowledge: final?.knowledge,
    attempts,
  };
  await writeFile(
    join(dir, "result.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    `${effort}: ${accepted ? `accepted, ${targetText(final?.parts ?? 0, o.target)}` : "not accepted"} after ${attempts.length} attempt(s), ${result.seconds} s`,
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
        "brief",
        "brief-file",
        "model",
        "efforts",
        "attempts",
        "out",
        "views",
        "name",
        "parts-list",
        "search",
        "runner",
      ].includes(key)
    )
      throw new Error(`Unknown flag ${argv[i]}\n${HELP}`);
    if (argv[i + 1] === undefined)
      throw new Error(`Missing value for ${argv[i]}`);
    flags.set(key, argv[++i]);
  }
  const target = partTarget(Number(flags.get("target-parts")));
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
      `~/brick-builds/oneshot-${slug(flags.get("name") ?? brief)}-${target}`
    ).replace(/^~(?=$|\/)/, homedir()),
  );
  await mkdir(out, { recursive: true });
  const onOff = (key: string) => {
    const v = flags.get(key) ?? "on";
    if (v !== "on" && v !== "off") throw new Error(`--${key} takes on or off`);
    return v === "on";
  };
  const partsList = onOff("parts-list"),
    search = onOff("search");
  const runner = flags.get("runner") ?? "codex";
  if (runner !== "codex" && runner !== "claude")
    throw new Error("--runner takes codex or claude");
  registerFullLibraryFromDisk();
  registerAgentData();
  const prompt = oneShotPrompt(brief, target, { partsList, search });
  const views = flags.get("views") ?? "iso,front,iso-back";
  const results = await Promise.all(
    efforts.map((e) =>
      runEffort(e, {
        prompt,
        model,
        target,
        attempts,
        out,
        views,
        search,
        runner,
      }),
    ),
  );
  // "+6.9%": how far a count is from the target.
  const miss = (parts?: number) => {
    if (parts === undefined) return "–";
    const p = targetMiss(parts, target).percent;
    return `${parts.toLocaleString("en-US")} (${p > 0 ? "+" : p < 0 ? "−" : "±"}${Math.abs(p)}%)`;
  };
  const rows = results.map(
    (r) =>
      `| ${r.effort} | ${r.accepted ? "yes" : "no"} | ${miss(r.parts)} | ${miss(r.attempts[0]?.parts)} | ${r.attemptsUsed} | ${r.seconds} | ${r.tokens.output.toLocaleString("en-US")} (${r.tokens.reasoning.toLocaleString("en-US")} reasoning) | ${r.searches} | ${r.knowledge?.finds.length ?? "–"} | ${r.knowledge ? `${r.knowledge.named.length} (${r.knowledge.notInList.length})` : "–"} | ${r.attempts.reduce((s, a) => s + (a.knowledge?.colourErrors.length ?? 0), 0)} | ${r.attempts.map((a) => a.outcome).join(", ")} |`,
  );
  await writeFile(
    join(out, "summary.json"),
    JSON.stringify(
      {
        brief: brief.trim(),
        runner,
        model,
        targetParts: target,
        attempts,
        partsList,
        search,
        results,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    join(out, "summary.md"),
    `# ${brief.trim()} — ${model}, target ${target.toLocaleString("en-US")} parts\n\n` +
      "Parts are the accepted build's count and, after it, the first reply's (the model's own estimate), each with its distance from the target.\n\n" +
      "| effort | accepted | parts (vs target) | first reply | attempts | seconds | output tokens | searches | finds | numbers named (not listed) | colour errors | outcomes |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n" +
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
