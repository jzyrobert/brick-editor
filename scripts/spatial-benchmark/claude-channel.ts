import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { hash, json } from "./part-reference";
import type { TextChannel } from "./session";
import { ModelBudgetFailure } from "./model-failure";

// Native Claude Code CLI transport for the render-blind harness. Unlike the
// Codex broker it cannot see or rewrite the HTTP payload, because the host
// manages Claude authentication. Claude Code's own system prompt is replaced
// by a neutral one: with tools off, the default prompt's tool-call guidance
// made models prefix protocol JSON with invented <invoke> markup, which the
// session counts as protocol violations (version 1). Tools are turned off,
// safe mode and an empty MCP configuration are enforced, the client starts in
// an empty directory with this session's identity scrubbed from its
// environment, and every streamed event is checked for tool use before the
// reply is returned.
export const CLAUDE_TRANSPORT_VERSION = "claude-native-cli/3";
export const CLAUDE_SYSTEM_PROMPT = "You are a helpful assistant.";
export type ClaudeModel = { id: string; effort: string };
export function validateClaudeModel(model: ClaudeModel) {
  if (
    ![
      ["claude-haiku-5-5", "high"],
      ["claude-sonnet-5-5", "high"],
      ["claude-opus-5-5", "high"],
      ["claude-fable-5-1", "medium"],
    ].some(([id, effort]) => model.id === id && model.effort === effort)
  )
    throw new Error("Unsupported authorised benchmark model/effort");
  return model;
}
/** Variables that would tie the client to the calling session or load
 * repository instructions; removed from the child's environment. */
export const CLAUDE_SCRUBBED_ENV = [
  "CLAUDE_CODE_SESSION_ID",
  "CLAUDE_CODE_REMOTE_SESSION_ID",
  "CLAUDECODE",
  "CLAUDE_CODE_CHILD_SESSION",
  "CLAUDE_CODE_SYNC_SESSION_REFS",
  "CLAUDE_CODE_TEE_SDK_STDOUT",
  "CLAUDE_EFFORT",
  "CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD",
  "CLAUDE_ADDITIONAL_DIRECTORIES",
];
export function claudeArgs(model: ClaudeModel, thread?: string) {
  validateClaudeModel(model);
  return [
    ...(thread ? ["--resume", thread] : []),
    "-p",
    "--model",
    model.id,
    "--effort",
    model.effort,
    "--tools",
    "",
    "--safe-mode",
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--system-prompt",
    CLAUDE_SYSTEM_PROMPT,
    "--output-format",
    "stream-json",
    "--verbose",
  ];
}
/** Checks one stream-json event; throws on any tool use. */
export function checkClaudeEvent(e: {
  type?: string;
  message?: { content?: { type?: string }[] };
}) {
  for (const part of e.message?.content ?? [])
    if (
      part?.type &&
      !["text", "thinking", "redacted_thinking"].includes(part.type)
    )
      throw new Error(`Native content ${part.type} violates transport`);
}
export async function claudeChannel(options: {
  dir: string;
  generationDir: string;
  model: ClaudeModel;
}) {
  const model = validateClaudeModel(options.model);
  const privateDir = join(options.dir, "native");
  await mkdir(privateDir, { recursive: true });
  const env = { ...process.env };
  for (const k of CLAUDE_SCRUBBED_ENV) delete env[k];
  await writeFile(
    join(privateDir, "adapter.json"),
    json({
      version: CLAUDE_TRANSPORT_VERSION,
      purpose: "blind-generation",
      args: claudeArgs(model),
      scrubbedEnv: CLAUDE_SCRUBBED_ENV,
      tools: [],
      cwd: "empty generation directory",
      systemPrompt: CLAUDE_SYSTEM_PROMPT,
    }),
  );
  let thread: string | undefined,
    turn = 0;
  const channel: TextChannel = async (request) => {
    if (request.model.id !== model.id || request.model.effort !== model.effort)
      throw new Error("Request model/effort differs from declared run");
    request.signal.throwIfAborted();
    const message = request.messages.at(-1)!;
    if (message.role !== "user")
      throw new Error("Channel expects a user message last");
    const child = spawn("claude", claudeArgs(model, thread), {
      cwd: options.generationDir,
      env: {
        ...env,
        CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(request.maxOutputTokens),
      },
      stdio: ["pipe", "pipe", "pipe"],
      detached: true,
    });
    const n = ++turn;
    let output = "",
      stderr = "",
      bytes = 0;
    child.stdout.on("data", (b) => {
      bytes += b.length;
      if (bytes > 8000000) child.kill();
      else output += b;
    });
    child.stderr.on("data", (b) => {
      if (stderr.length < 30000) stderr += b;
    });
    const abort = () => {
      try {
        process.kill(-child.pid!, "SIGKILL");
      } catch {
        child.kill();
      }
    };
    request.signal.addEventListener("abort", abort, { once: true });
    child.stdin.on("error", () => {});
    child.stdin.end(message.content);
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    request.signal.removeEventListener("abort", abort);
    await writeFile(join(privateDir, `turn-${n}.jsonl`), output);
    await writeFile(join(privateDir, `turn-${n}.stderr.txt`), stderr);
    let result:
      | {
          result?: string;
          is_error?: boolean;
          stop_reason?: string;
          api_error?: string;
          session_id?: string;
          modelUsage?: Record<string, unknown>;
        }
      | undefined;
    for (const line of output.split("\n")) {
      if (!line.trim()) continue;
      let e;
      try {
        e = JSON.parse(line);
      } catch {
        continue;
      }
      checkClaudeEvent(e);
      if (e.type === "result") result = e;
    }
    if (!result || code !== 0 || result.is_error) {
      // The CLI reports an exhausted output cap as an API error after its
      // own retries, not as a stop reason (version 2 misfiled it as an
      // infrastructure failure).
      if (
        result?.stop_reason === "max_tokens" ||
        result?.api_error === "max_output_tokens"
      )
        throw new ModelBudgetFailure(
          "Declared output-token budget exhausted before a final answer",
        );
      throw new Error(
        `Native Claude turn failed (${code}); inspect host stderr`,
      );
    }
    if (result.stop_reason === "max_tokens")
      throw new ModelBudgetFailure(
        "Declared output-token budget exhausted before a final answer",
      );
    // Claude Code may use a small model for its own housekeeping; the
    // declared model must be the one that answered.
    if (!result.modelUsage || !(model.id in result.modelUsage))
      throw new Error("Declared model did not answer this turn");
    thread = result.session_id;
    const text = result.result ?? "";
    await writeFile(
      join(privateDir, `turn-${n}.result.json`),
      json({ session: thread, sha256: hash(text), bytes: text.length }),
    );
    return text;
  };
  return {
    channel,
    close: async () => {},
  };
}
