import { spawn, execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, basename, sep } from "node:path";
import { createInterface } from "node:readline";
import { json, hash } from "./part-reference";
import type { TextChannel } from "./session";
import { ModelBudgetFailure } from "./model-failure";

export const AGY_TRANSPORT_VERSION = "agy-native-cli/7";
export const AGY_SYSTEM_PROMPT =
  "You are a helpful assistant participating in a text-only JSON protocol. Return exactly one JSON object as ordinary response text. Never invoke native tools or functions. parts_search, part_info, check_build and brick.build are JSON messages handled by the external caller, not native function calls.";
export type AgyModel = { id: string; effort: string };
export function validateAgyModel(model: AgyModel) {
  if (
    !["gemini-3.8-flash-high", "gemini-4-argon-high"].includes(model.id) ||
    model.effort !== "high"
  )
    throw new Error(
      "Only Gemini 3.8 Flash/high and Gemini 4 Argon/high are authorised",
    );
  return model;
}
export type AgyEvent = {
  event: string;
  conversation_id?: string;
  init?: { model?: string; agent?: string; tools?: string[] };
  step_update?: {
    step_index?: number;
    state?: string;
    text_delta?: string;
    usage?: { output_tokens?: number };
    step_type?: string;
    tool_name?: string;
    subagent_info?: unknown;
  };
  result?: {
    status?: string;
    error?: string;
    response?: string;
    conversation_id?: string;
    usage?: { output_tokens?: number; thinking_tokens?: number };
  };
};
export const EMPTY_FUNCTION_ERROR =
  /^Your previous response contained an improperly formatted function call(?:: Malformed function call: Failed to parse function call: Function call is empty - no input to parse\.)?\r?\nPlease retry with a properly formatted function call\r?\nRetries remaining: \d+$/;
/** The CLI can report its empty-function parsing artifact after a complete
 * assistant response. Preserve that text, including malformed JSON or prose,
 * for the host's ordinary bounded protocol repair, just as for SUCCESS text.
 * Only DONE responses qualify; partial streams and unknown errors stay fatal.
 * Every tool attempt and per-provider-response token budget is checked first. */
export function selectAgyReply(result: AgyEvent["result"], completed?: string) {
  const recover =
    result?.status === "ERROR" &&
    EMPTY_FUNCTION_ERROR.test(result.error ?? "") &&
    typeof completed === "string" &&
    completed.trim().length > 0;
  if (
    (!recover && result?.status !== "SUCCESS") ||
    typeof result?.response !== "string"
  )
    throw new Error(`agy turn failed: ${result?.error ?? result?.status}`);
  return (completed ?? result.response).trim();
}
export function checkAgyOutputBudget(tokens: number | undefined, max: number) {
  if (typeof tokens !== "number" || !Number.isFinite(tokens) || tokens < 0)
    throw new Error("Missing native per-response token accounting");
  if (tokens > max)
    throw new ModelBudgetFailure(
      `Native model response used ${tokens} output tokens, exceeding the declared ${max}; agy exposes no server cap`,
    );
}
/** An observed agy response uses its tool/input envelope for a draft check.
 * Adapt only this unambiguous carrier; preserve the code and seed verbatim.
 * The host still validates and counts the normal check_build request. */
export function normalizeAgyEnvelope(text: string) {
  try {
    const value = JSON.parse(text);
    if (
      Object.keys(value).sort().join(",") === "input,tool" &&
      value.tool === "check_build" &&
      typeof value.input?.code === "string"
    )
      return {
        text: json({ check_build: value.input }),
        normalization: "check_build-tool-envelope",
        codeSha256: hash(value.input.code),
      };
  } catch {
    /* Ordinary malformed text goes to the unchanged repair protocol. */
  }
  return { text, normalization: null, codeSha256: undefined };
}
export function checkAgyEvent(e: AgyEvent, model: AgyModel) {
  if (
    e.event === "init" &&
    (e.init?.model !== model.id || e.init?.agent !== "brick-blind")
  )
    throw new Error("agy initialized a different model or agent");
  if (
    e.step_update?.step_type === "tool" ||
    e.step_update?.tool_name ||
    e.step_update?.subagent_info
  )
    throw new Error(
      "Native tool or subagent attempt violates blind generation",
    );
}

/** One persistent native CLI session per build. Only JSON feedback enters it.
 * agy currently advertises tools even for tools:[] on a primary custom agent.
 * A deny-all PreToolUse hook blocks execution; ANY tool attempt invalidates
 * the case. Its advertised tools and all events are retained as host evidence.
 * The CLI cannot set a server output-token cap: check reported usage on each
 * native response, record that limitation, and reject over-budget responses.
 */
export async function agyChannel(options: {
  dir: string;
  model: AgyModel;
  thread?: string;
  generationDir?: string;
}) {
  const model = validateAgyModel(options.model);
  if (!!options.thread !== !!options.generationDir)
    throw new Error(
      "Resuming requires both conversation ID and its original generation directory",
    );
  if (options.thread && !/^[a-f0-9-]{36}$/.test(options.thread))
    throw new Error("Invalid native conversation ID");
  const generationDir = options.generationDir
    ? resolve(options.generationDir)
    : await mkdtemp(join(tmpdir(), "brick-agy-"));
  if (options.generationDir) {
    if (
      !generationDir
        .toLowerCase()
        .startsWith((resolve(tmpdir()) + sep).toLowerCase()) ||
      !basename(generationDir).startsWith("brick-agy-")
    )
      throw new Error("Resume directory is not an isolated agy temporary root");
    const contents = await readdir(generationDir);
    if (
      !contents.includes(".git") ||
      !contents.includes(".agents") ||
      contents.some((n) => ![".git", ".agents"].includes(n))
    )
      throw new Error("Resume directory contains unexpected files");
  }
  await mkdir(join(generationDir, ".agents", "agents"), { recursive: true });
  execFileSync("git", ["init", "-q", generationDir]);
  await writeFile(
    join(generationDir, ".agents", "agents", "brick-blind.md"),
    `---\nname: brick-blind\ndescription: Text-only brick generation, with no native tools.\nmainAgent: true\nsubagent: false\ntools: []\nmcpServers: []\nskills: []\nplugins: []\ncommandExecutionPolicy: off\n---\n${AGY_SYSTEM_PROMPT}\n`,
  );
  await writeFile(
    join(generationDir, ".agents", "deny.cjs"),
    `process.stdout.write(JSON.stringify({decision:"deny",reason:"Native tools are forbidden in this text-only generation protocol."}));`,
  );
  await writeFile(
    join(generationDir, ".agents", "hooks.json"),
    JSON.stringify({
      "brick-blind-deny-native": {
        PreToolUse: [
          {
            matcher: "*",
            hooks: [
              {
                type: "command",
                command: `"${process.execPath}" deny.cjs`,
                timeout: 10,
              },
            ],
          },
        ],
      },
    }),
  );
  await mkdir(options.dir, { recursive: true });
  const args = [
    ...(options.thread ? ["--conversation", options.thread] : []),
    "--agent",
    "brick-blind",
    "--model",
    model.id,
    "--effort",
    model.effort,
    "--output-format",
    "stream-json",
    "--input-format",
    "stream-json",
    "--disable-slash-commands",
    "--print-timeout",
    "0",
  ];
  const env = { ...process.env };
  for (const k of Object.keys(env))
    if (/^(CODEX_|CLAUDE_|CLOUDFLARE_|GH_TOKEN$|GITHUB_TOKEN$)/.test(k))
      delete env[k];
  await writeFile(
    join(options.dir, "adapter.json"),
    json({
      version: AGY_TRANSPORT_VERSION,
      model,
      args,
      generationDir,
      resumedThread: options.thread ?? null,
      nativeTools: "advertised by CLI; deny-all hook; attempted use fails case",
      serverOutputTokenCap:
        "not exposed by agy; checked against reported per-response usage",
      systemPrompt: AGY_SYSTEM_PROMPT,
      hostManagedAuthentication: true,
    }) + "\n",
  );
  const child = spawn("agy", args, {
    cwd: generationDir,
    env,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  let stdout = "",
    stderr = "",
    turn = 0,
    previousOutput = 0;
  const responseSteps = new Map<number, string>();
  let lastCompleted: string | undefined;
  let nativeResponseSha256 = "";
  let nativeRecoveredError: string | null = null;
  let resultConversationId: string | undefined;
  let nativeNormalization: string | null = null;
  let selectedReplySha256 = "";
  let maxNativeResponseTokens = 0;
  const nativeMetrics: unknown[] = [];
  let pending:
    | {
        resolve: (text: string) => void;
        reject: (e: Error) => void;
        max: number;
      }
    | undefined;
  let fatal: Error | undefined;
  let initialized = false;
  let initResolve!: () => void, initReject!: (e: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    initResolve = resolve;
    initReject = reject;
  });
  const fail = (e: Error) => {
    fatal = e;
    pending?.reject(e);
    pending = undefined;
    initReject(e);
    child.kill();
  };
  child.stderr.on("data", (b) => {
    if (stderr.length < 100000) stderr += b;
  });
  child.stdout.on("data", (b) => {
    stdout += b;
    if (stdout.length > 16000000)
      fail(new Error("Native stream byte budget exceeded"));
  });
  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    try {
      const e = JSON.parse(line) as AgyEvent;
      checkAgyEvent(e, model);
      const step = e.step_update;
      if (
        step?.step_type === "agent_response" &&
        typeof step.step_index === "number"
      ) {
        const text =
          (responseSteps.get(step.step_index) ?? "") + (step.text_delta ?? "");
        responseSteps.set(step.step_index, text);
        if (step.state === "DONE" && pending) {
          nativeMetrics.push({
            turn,
            step: step.step_index,
            outputTokens: step.usage?.output_tokens,
          });
          checkAgyOutputBudget(step.usage?.output_tokens, pending.max);
          maxNativeResponseTokens = Math.max(
            maxNativeResponseTokens,
            step.usage!.output_tokens!,
          );
        }
        if (step.state === "DONE" && text.trim()) lastCompleted = text;
      }
      if (e.event === "init") {
        if (options.thread && e.conversation_id !== options.thread)
          throw new Error("agy resumed a different native conversation");
        initialized = true;
        initResolve();
      }
      if (e.event !== "result") return;
      if (!pending) throw new Error("Unsolicited native result");
      const result = e.result;
      if (options.thread && result?.conversation_id !== options.thread)
        throw new Error("agy changed the resumed conversation ID");
      resultConversationId = result?.conversation_id;
      const selected = selectAgyReply(result, lastCompleted);
      selectedReplySha256 = hash(selected);
      const normalized = normalizeAgyEnvelope(selected);
      const text = normalized.text;
      nativeNormalization = normalized.normalization;
      nativeRecoveredError = result?.status === "ERROR" ? result.error! : null;
      nativeMetrics.push({
        turn,
        status: result?.status,
        recoveredError: nativeRecoveredError,
      });
      nativeResponseSha256 = hash(result!.response!);
      const used = result!.usage?.output_tokens;
      if (typeof used !== "number" || used < previousOutput)
        throw new Error("Missing or invalid native token accounting");
      const delta = used - previousOutput;
      previousOutput = used;
      if (maxNativeResponseTokens === 0 && delta > 0)
        throw new Error("No native response accounting");
      const p = pending;
      pending = undefined;
      p.resolve(text);
    } catch (e) {
      fail(e as Error);
    }
  });
  child.on("error", fail);
  child.on("close", (code) => {
    if (!initialized || pending)
      fail(
        new Error(`agy exited before result (${code}): ${stderr.slice(-1000)}`),
      );
  });
  const startup = setTimeout(
    () => fail(new Error("agy startup timeout")),
    30000,
  );
  try {
    await ready;
  } finally {
    clearTimeout(startup);
  }
  const channel: TextChannel = async (request) => {
    validateAgyModel(request.model);
    if (request.model.id !== model.id)
      throw new Error("Request model differs from native session");
    if (fatal) throw fatal;
    request.signal.throwIfAborted();
    if (pending) throw new Error("Concurrent turns are forbidden");
    const last = request.messages.at(-1)!;
    if (last.role !== "user") throw new Error("Expected user message");
    ++turn;
    responseSteps.clear();
    lastCompleted = undefined;
    maxNativeResponseTokens = 0;
    const abort = () => fail(new Error("agy deadline exceeded"));
    request.signal.addEventListener("abort", abort, { once: true });
    try {
      const text = await new Promise<string>((resolve, reject) => {
        pending = { resolve, reject, max: request.maxOutputTokens };
        child.stdin.write(
          json({ event: "user", message: { content: last.content } }) + "\n",
        );
      });
      await writeFile(
        join(options.dir, `turn-${turn}.result.json`),
        json({
          turn,
          sha256: hash(text),
          bytes: Buffer.byteLength(text),
          cumulativeOutputTokens: previousOutput,
          nativeResponseSha256,
          nativeAssistantResponses: responseSteps.size,
          maxNativeResponseTokens,
          nativeRecoveredError,
          conversationId: resultConversationId,
          selectedReplySha256,
          nativeNormalization,
        }) + "\n",
      );
      return text;
    } finally {
      request.signal.removeEventListener("abort", abort);
    }
  };
  const close = async () => {
    child.stdin.end();
    if (child.exitCode === null && child.signalCode === null) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          child.kill();
          resolve();
        }, 3000);
        child.once("close", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    await writeFile(join(options.dir, "events.jsonl"), stdout);
    await writeFile(join(options.dir, "stderr.txt"), stderr);
    await writeFile(
      join(options.dir, "metrics.json"),
      JSON.stringify(nativeMetrics, null, 2) + "\n",
    );
  };
  return { channel, close };
}
