import { createServer } from "node:http";
import { spawn } from "node:child_process";
import {
  mkdir,
  readFile,
  writeFile,
  appendFile,
  mkdtemp,
  rm,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { hash, json } from "./part-reference";
import { ROOT } from "./sandbox";
import type { TextChannel } from "./session";
import type { Quota } from "./codex-quota";
import { quotaAllowsNext } from "./codex-quota";
import { ModelBudgetFailure } from "./model-failure";

export const CODEX_DISABLED = [
  "shell_tool",
  "unified_exec",
  "multi_agent",
  "multi_agent_v2",
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
  "view_image",
  "hooks",
  "plugins",
  "memories",
  "workspace_dependencies",
  "realtime_conversation",
  "in_app_local_automation",
  "unbounded_connection_retries",
];
export const CODEX_TRANSPORT_VERSION = "codex-guarded-broker/4";
export function modelPayload(
  raw: Record<string, unknown>,
  maxOutputTokens: number,
  approvedImages?: ReadonlySet<string>,
) {
  if (
    raw.model !== "gpt-6.1-sol" ||
    (raw.reasoning as { effort?: string })?.effort !== "high"
  )
    throw new Error("Native client model/effort differs from declared run");
  const receivedImages = new Set<string>();
  const inspect = (v: unknown): void => {
    if (Array.isArray(v)) {
      for (const x of v) inspect(x);
      return;
    }
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (o.type === "input_image") {
      if (
        !approvedImages ||
        typeof o.image_url !== "string" ||
        !o.image_url.startsWith("data:image/png;base64,") ||
        !approvedImages.has(
          hash(
            Buffer.from(
              o.image_url.slice("data:image/png;base64,".length),
              "base64",
            ),
          ),
        )
      )
        throw new Error("Non-text or unapproved evaluator image input denied");
      receivedImages.add(
        hash(
          Buffer.from(
            o.image_url.slice("data:image/png;base64,".length),
            "base64",
          ),
        ),
      );
      return;
    }
    if (typeof o.type === "string" && /image|audio|file|video/.test(o.type))
      throw new Error("Non-text input denied");
    for (const x of Object.values(o)) inspect(x);
  };
  inspect(raw.input);
  if (
    approvedImages &&
    [...approvedImages].some((sha) => !receivedImages.has(sha))
  )
    throw new Error("Required frozen evaluator image omitted by native client");
  return {
    ...raw,
    tools: [],
    tool_choice: "none",
    max_output_tokens: maxOutputTokens,
    store: false,
  };
}
export async function codexChannel(options: {
  dir: string;
  generationDir?: string;
  evaluationImages?: { file: string; sha256: string }[];
  quota: () => Promise<Quota>;
  notify: (q: Quota) => Promise<void>;
  fetchImpl?: typeof fetch;
  credentials?: () => Promise<{ accessToken: string; accountId: string }>;
}) {
  const { dir } = options;
  const approvedImages = options.evaluationImages
    ? new Set(options.evaluationImages.map((i) => i.sha256))
    : undefined;
  if (options.evaluationImages)
    for (const image of options.evaluationImages) {
      if (hash(await readFile(image.file)) !== image.sha256)
        throw new Error("Frozen evaluator image changed");
    }
  await mkdir(dir, { recursive: true });
  const privateDir = join(dir, "native");
  await mkdir(privateDir);
  await mkdir(join(privateDir, "client-home", ".codex"), { recursive: true });
  // Credential-free client configuration. Auth is injected by the host broker.
  const socketDir = await mkdtemp(join(tmpdir(), "brick-model-broker-"));
  const socket = join(socketDir, "transport.sock");
  const log = async (kind: string, payload: unknown) =>
    appendFile(
      join(privateDir, "transport.jsonl"),
      json({ kind, payload }) + "\n",
    );
  let largestDrop = 0,
    lastQuota: Quota | undefined,
    limit = 16000,
    thread: string | undefined,
    turn = 0;
  let activeRequests = 0;
  let upstreamAbort: AbortController | undefined;
  let transportFailure: string | undefined;
  let outputBudgetExhausted = false;
  const getCredentials =
    options.credentials ??
    (async () => {
      const auth = JSON.parse(
        await readFile(
          join(
            process.env.CODEX_HOME ?? join(homedir(), ".codex"),
            "auth.json",
          ),
          "utf8",
        ),
      );
      if (
        auth.auth_mode !== "chatgpt" ||
        !auth.tokens?.access_token ||
        !auth.tokens?.account_id
      )
        throw new Error(
          "Codex ChatGPT subscription authentication required; no API-key fallback",
        );
      return {
        accessToken: auth.tokens.access_token as string,
        accountId: auth.tokens.account_id as string,
      };
    });
  const server = createServer(async (request, response) => {
    try {
      if (request.method !== "POST" || request.url !== "/responses") {
        await log("denied-route", {
          method: request.method,
          path: request.url,
        });
        response.writeHead(403);
        response.end("Undeclared route");
        return;
      }
      if (++activeRequests > 1)
        throw new Error(
          "Undeclared native retry denied; no automatic infrastructure retries",
        );
      const quota = await options.quota();
      await log("quota-before-request", quota);
      if (lastQuota && quota.weeklyRemaining < lastQuota.weeklyRemaining)
        largestDrop = Math.max(
          largestDrop,
          lastQuota.weeklyRemaining - quota.weeklyRemaining,
        );
      lastQuota = quota;
      if (!quotaAllowsNext(quota, largestDrop))
        throw new Error(
          `Weekly quota gate stopped generation: ${quota.weeklyRemaining}% remaining`,
        );
      let bytes = Buffer.alloc(0);
      for await (const chunk of request) {
        bytes = Buffer.concat([bytes, Buffer.from(chunk)]);
        if (bytes.length > (approvedImages ? 16000000 : 4000000))
          throw new Error("Model request byte budget exceeded");
      }
      if (request.headers["content-encoding"] === "gzip")
        bytes = gunzipSync(bytes);
      const payload = modelPayload(
        JSON.parse(bytes.toString()),
        limit,
        approvedImages,
      );
      await log("effective-model-request", {
        payload,
        sha256: hash(json(payload)),
        bytes: Buffer.byteLength(json(payload)),
      });
      const credentials = await getCredentials();
      const upstream = await (options.fetchImpl ?? fetch)(
        "https://chatgpt.com/backend-api/codex/responses",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${credentials.accessToken}`,
            "ChatGPT-Account-ID": credentials.accountId,
            originator: "codex_cli_rs",
            "User-Agent": "codex_cli_rs/0.162.1",
          },
          body: json(payload),
          signal: upstreamAbort?.signal,
        },
      );
      if (!upstream.ok || !upstream.body)
        throw new Error(`Subscription model transport HTTP ${upstream.status}`);
      response.writeHead(200, { "content-type": "text/event-stream" });
      const decoder = new TextDecoder();
      let buffer = "",
        size = 0;
      const reader = upstream.body.getReader();
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        const chunk = next.value;
        size += chunk.length;
        if (size > 8000000)
          throw new Error("Model response byte budget exceeded");
        buffer += decoder.decode(chunk, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          if (line.startsWith("data: ") && line.slice(6) !== "[DONE]") {
            const event = JSON.parse(line.slice(6));
            if (
              event.type === "response.incomplete" &&
              event.response?.incomplete_details?.reason === "max_output_tokens"
            )
              outputBudgetExhausted = true;
            const items = [
              ...(event.item ? [event.item] : []),
              ...(event.response?.output ?? []),
            ];
            const forbidden = items.find(
              (item) =>
                item?.type && !["message", "reasoning"].includes(item.type),
            );
            if (forbidden) {
              await log("denied-native-output", { type: forbidden.type });
              throw new Error(
                "Undeclared native tool output blocked before dispatch",
              );
            }
            await log("model-stream-event", event);
          }
          response.write(line + "\n");
        }
      }
      if (buffer) response.write(buffer);
      const after = await options.quota();
      largestDrop = Math.max(
        largestDrop,
        quota.weeklyRemaining - after.weeklyRemaining,
      );
      lastQuota = after;
      await log("quota-after-request", after);
      await options.notify(after);
      response.end();
    } catch (e) {
      transportFailure = String((e as Error).message);
      await log("transport-failure", { reason: transportFailure });
      if (!response.headersSent) response.writeHead(502);
      response.end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socket, resolve);
  });
  const binary = resolve(
    "/home/ubuntu/.codex/packages/standalone/current/bin/codex",
  );
  const runtime = dirname(process.execPath);
  await writeFile(
    join(privateDir, "adapter.json"),
    json({
      version: CODEX_TRANSPORT_VERSION,
      purpose: approvedImages ? "frozen-image-evaluation" : "blind-generation",
      approvedImages: options.evaluationImages?.map((i) => i.sha256) ?? [],
      binarySha256: hash(await readFile(binary)),
      disabled: CODEX_DISABLED,
      tools: [],
      upstream: "ChatGPT subscription Codex responses only",
      bridgeSha256: hash(
        await readFile(
          join(ROOT, "scripts/spatial-benchmark/codex-bridge.mjs"),
        ),
      ),
    }),
  );
  const channel: TextChannel = async (request) => {
    if (request.model.id !== "gpt-6.1-sol" || request.model.effort !== "high")
      throw new Error(
        "Only the authorised Sol 6.1 high configuration is enabled",
      );
    limit = request.maxOutputTokens;
    activeRequests = 0;
    transportFailure = undefined;
    outputBudgetExhausted = false;
    await rm(join(privateDir, "client-home", "reply.txt"), { force: true });
    upstreamAbort = new AbortController();
    request.signal.throwIfAborted();
    const args = thread ? ["exec", "resume", thread] : ["exec"];
    if (!thread && options.evaluationImages)
      for (let i = 0; i < options.evaluationImages.length; i++)
        args.push("--image", `/generation/image-${i}.png`);
    args.push(
      "--ignore-user-config",
      "--ignore-rules",
      "--skip-git-repo-check",
      "-m",
      "gpt-6.1-sol",
      "-c",
      'model_reasoning_effort="high"',
      "-c",
      'model_provider="benchmark"',
      "-c",
      'model_providers.benchmark={name="Subscription benchmark broker",wire_api="responses",requires_openai_auth=false,request_max_retries=0,stream_max_retries=0}',
      "-c",
      'web_search="disabled"',
      "-c",
      "project_doc_max_bytes=0",
      "-c",
      'sandbox_mode="read-only"',
      "-c",
      "mcp_servers={}",
    );
    args.push(
      ...CODEX_DISABLED.flatMap((f) => ["--disable", f]),
      "--json",
      "-o",
      "/client-home/reply.txt",
      "-",
    );
    const bwrap = [
      "--unshare-all",
      "--die-with-parent",
      "--new-session",
      "--clearenv",
      "--ro-bind",
      runtime,
      "/runtime",
      "--ro-bind",
      "/usr/lib",
      "/usr/lib",
      "--ro-bind",
      "/lib",
      "/lib",
      "--proc",
      "/proc",
      "--dev",
      "/dev",
      "--tmpfs",
      "/tmp",
      "--dir",
      "/client",
      "--ro-bind",
      binary,
      "/client/codex",
      "--ro-bind",
      join(ROOT, "scripts/spatial-benchmark/codex-bridge.mjs"),
      "/bridge.mjs",
      "--bind",
      join(privateDir, "client-home"),
      "/client-home",
      "--ro-bind",
      options.generationDir ?? join(dir, "generation"),
      "/generation",
      "--ro-bind",
      socket,
      "/transport.sock",
      "--chdir",
      "/generation",
      "/runtime/node",
      "/bridge.mjs",
      json({ args }),
    ];
    const child = spawn("bwrap", bwrap, {
      env: { PATH: "/usr/bin:/bin" },
      stdio: ["pipe", "pipe", "pipe"],
      detached: true,
    });
    const logFile = join(privateDir, `turn-${++turn}.jsonl`),
      errors = join(privateDir, `turn-${turn}.stderr.txt`);
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
      upstreamAbort?.abort();
      try {
        process.kill(-child.pid!, "SIGKILL");
      } catch {
        child.kill();
      }
    };
    request.signal.addEventListener("abort", abort, { once: true });
    child.stdin.on("error", () => {});
    child.stdin.end(request.messages.at(-1)!.content);
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    request.signal.removeEventListener("abort", abort);
    upstreamAbort?.abort();
    await writeFile(logFile, output);
    await writeFile(errors, stderr);
    if (outputBudgetExhausted)
      throw new ModelBudgetFailure(
        "Declared output-token budget exhausted before a final answer",
      );
    if (transportFailure)
      throw new Error(`Broker rejected turn: ${transportFailure}`);
    for (const line of output.split("\n")) {
      try {
        const e = JSON.parse(line);
        if (e.type === "thread.started") thread = e.thread_id;
        if (
          e.type === "item.completed" &&
          !["agent_message", "reasoning", "plan", "error"].includes(
            e.item?.type,
          )
        )
          throw new Error(
            `Native item ${e.item?.type} violates transport: ${e.item?.message ?? ""}`,
          );
      } catch (e) {
        if ((e as Error).message.includes("violates transport")) throw e;
      }
    }
    if (code !== 0)
      throw new Error(
        `Isolated Codex turn failed (${code}); inspect host stderr`,
      );
    return readFile(join(privateDir, "client-home", "reply.txt"), "utf8");
  };
  return {
    channel,
    close: async () => {
      upstreamAbort?.abort();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(socketDir, { recursive: true, force: true });
    },
  };
}
