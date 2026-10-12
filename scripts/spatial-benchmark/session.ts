import { readFileSync } from "node:fs";
import {
  mkdir,
  writeFile,
  appendFile,
  readFile,
  readdir,
  chmod,
} from "node:fs/promises";
import { join } from "node:path";
import { searchParts, parseSize } from "../../src/build-script/part-search";
import { searchForAgent } from "../../src/build-script/part-list";
import { registerAgentData } from "../build-script-cli";
import { registerFullLibraryFromDisk } from "../full-library-node";
import { checkAnswer, errorsReason } from "../one-shot-build";
import { isBrickBuild } from "../brick-build";
import {
  partReference,
  FIELD_GUIDES,
  hash,
  json,
  type FactField,
} from "./part-reference";
import {
  effectivePrompt,
  aliasPayload,
  validateManifest,
  schedule,
  resolvePart,
  payloadIdentity,
  type Manifest,
  type ScheduledCase,
} from "./manifest";
import { isolatedCompile, verifyFile, type Compilation } from "./sandbox";
import { ModelBudgetFailure } from "./model-failure";

export type TextMessage = { role: "user" | "assistant"; content: string };
// A channel sees only an immutable text request. It receives no local tools,
// filesystem handles, session callback, compiler, evaluator or credentials.
export type TextChannel = (
  request: Readonly<{
    messages: readonly TextMessage[];
    model: Manifest["model"];
    maxOutputTokens: number;
    signal: AbortSignal;
  }>,
) => Promise<string>;
type Counters = {
  turns: number;
  searchCalls: number;
  infoCalls: number;
  referenceBytes: number;
  checks: number;
  repairs: number;
  compileMs: number;
};
export type FrozenRun = {
  state: "frozen";
  status: "submitted" | "model-failure" | "infrastructure-failure";
  files: Record<string, string>;
  used: Counters;
  referenceCoverage?: {
    part: string;
    available: FactField[];
    returned: FactField[];
    use: "not-inferred";
  }[];
  failure?: string;
};
const fields = (v: Record<string, unknown>, allowed: string[]) => {
  for (const k of Object.keys(v))
    if (!allowed.includes(k)) throw new Error(`Undeclared request field: ${k}`);
};
const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

export class GenerationSession {
  #state: "new" | "generating" | "frozen" = "new";
  #channel: TextChannel | undefined;
  #used: Counters = {
    turns: 0,
    searchCalls: 0,
    infoCalls: 0,
    referenceBytes: 0,
    checks: 0,
    repairs: 0,
    compileMs: 0,
  };
  #start = 0;
  #workerHash: string;
  #returned = new Map<string, Set<FactField>>();
  #messages: TextMessage[] = [];
  constructor(
    private readonly m: Manifest,
    private readonly c: ScheduledCase,
    private readonly dir: string,
    private readonly worker: string,
    channel: TextChannel,
  ) {
    this.m = structuredClone(validateManifest(m));
    const expected = schedule(this.m).find((v) => v.id === c.id);
    if (!expected || json(expected) !== json(c))
      throw new Error("Case differs from validated schedule");
    this.c = structuredClone(expected);
    this.#channel = channel;
    this.#workerHash = hash(readFileSync(worker));
  }
  private async audit(kind: string, payload: unknown) {
    await appendFile(
      join(this.dir, "audit.jsonl"),
      json({ sequence: this.#messages.length, kind, payload }) + "\n",
    );
  }
  private consume(key: keyof Counters, amount = 1) {
    if (this.#used[key] + amount > this.m.budgets[key])
      throw new Error(`Run-wide ${key} budget exhausted`);
    this.#used[key] += amount;
  }
  private reference(text: string) {
    this.consume("referenceBytes", Buffer.byteLength(text));
    return text;
  }
  private async logPayload(kind: string, request: unknown, response: string) {
    await this.audit(kind, { request, response, ...payloadIdentity(response) });
  }
  private async compile(code: string): Promise<Compilation> {
    if (Buffer.byteLength(code) > this.m.budgets.sourceBytes)
      return { failure: "Source byte budget exceeded" };
    const remaining = this.m.budgets.compileMs - this.#used.compileMs;
    if (remaining <= 0)
      throw new Error("Run-wide compiler compute budget exhausted");
    await verifyFile(this.worker, this.#workerHash);
    const start = Date.now();
    try {
      return await isolatedCompile(
        this.worker,
        {
          code,
          seed: this.m.buildSeed,
          target: this.c.task.targetParts,
          aliases: this.c.task.aliases,
        },
        Math.min(remaining, this.remainingTime()),
        this.m.budgets.compilerBytes,
      );
    } catch (e) {
      throw new Error(
        `Compiler infrastructure failure: ${(e as Error).message}`,
      );
    } finally {
      this.#used.compileMs += Date.now() - start;
    }
  }
  private remainingTime() {
    const left = this.m.budgets.totalMs - (Date.now() - this.#start);
    if (left <= 0) throw new Error("Run compute budget exhausted");
    return left;
  }
  private async feedback(result: Compilation, ordinal: number) {
    if (this.c.condition.policy === "blind-no-feedback")
      throw new Error("Candidate feedback forbidden");
    if (this.c.condition.policy === "legacy-control")
      return checkAnswer(ordinal, this.c.task.targetParts, {
        report: result.report,
        reason: result.failure,
      });
    return mechanicalFeedback(result, this.c.task, 20);
  }
  private async search(request: unknown) {
    const queries = Array.isArray(request) ? request : [request];
    if (queries.length < 1 || queries.length > 5)
      throw new Error("Search batch requires 1–5 queries");
    const answers = [];
    for (const q of queries) {
      this.consume("searchCalls");
      if (!obj(q)) throw new Error("Invalid search");
      fields(q, [
        "query",
        "size",
        "category",
        "colour",
        "available_in_colour",
        "limit",
      ]);
      for (const k of ["query", "size", "category", "colour"])
        if (q[k] !== undefined && typeof q[k] !== "string")
          throw new Error("Invalid search string");
      if (
        q.limit !== undefined &&
        (!Number.isInteger(q.limit) ||
          Number(q.limit) < 1 ||
          Number(q.limit) > 50)
      )
        throw new Error("Invalid search limit");
      let response: string;
      if (!this.c.task.palette.length && !this.c.task.aliases)
        response = searchForAgent(q).text; // exact legacy payload
      else {
        const allowed = new Set(this.c.task.palette);
        const candidates = searchParts({
          query: String(q.query ?? ""),
          category: q.category as string | undefined,
          ...(q.size ? { size: parseSize(String(q.size)) } : {}),
          colour: q.colour as string | undefined,
          availableInColour: !!q.available_in_colour,
          limit: 50000,
        })
          .filter((p) => allowed.has(p.id))
          .slice(0, Number(q.limit ?? 15));
        response = aliasPayload(
          candidates.map((p) => ({
            part: p.id,
            name: this.c.task.aliases ? null : p.name,
            nominal: {
              xStuds: p.size.w,
              zStuds: p.size.d,
              stackingPlates: p.size.h,
            },
          })),
          this.c.task,
        );
      }
      this.reference(response);
      await this.logPayload("parts_search", q, response);
      answers.push(response);
    }
    return answers.join("\n\n");
  }
  private async info(request: unknown) {
    this.consume("infoCalls");
    if (!obj(request)) throw new Error("Invalid part_info");
    fields(request, ["part_ids", "fields", "offset", "limit"]);
    if (
      !Array.isArray(request.part_ids) ||
      !request.part_ids.length ||
      request.part_ids.length > 8 ||
      !request.part_ids.every((p) => typeof p === "string")
    )
      throw new Error("part_info requires 1–8 IDs");
    const requested = request.fields ?? this.c.condition.facts;
    if (
      !Array.isArray(requested) ||
      requested.some((f) => !this.c.condition.facts.includes(f)) ||
      new Set(requested).size !== requested.length
    )
      throw new Error("Fact fields outside treatment");
    const response = aliasPayload(
      request.part_ids.map((p) => {
        const ref = resolvePart(p, this.c.task);
        if (this.c.task.palette.length && !this.c.task.palette.includes(ref))
          throw new Error("Part outside declared palette");
        return partReference(
          ref,
          requested as FactField[],
          Number(request.offset ?? 0),
          Number(request.limit ?? 16),
        );
      }),
      this.c.task,
    );
    this.reference(response);
    await this.logPayload("part_info", request, response);
    for (const p of request.part_ids) {
      const ref = resolvePart(p, this.c.task),
        seen = this.#returned.get(ref) ?? new Set<FactField>();
      for (const field of requested as FactField[]) seen.add(field);
      this.#returned.set(ref, seen);
    }
    return response;
  }
  async run(): Promise<FrozenRun> {
    if (this.#state !== "new")
      throw new Error("Generation cannot resume or re-enter");
    this.#state = "generating";
    this.#start = Date.now();
    await mkdir(this.dir, { recursive: true });
    if ((await readdir(this.dir)).length)
      throw new Error("Generation directory must be empty");
    await mkdir(join(this.dir, "generation"));
    let status: FrozenRun["status"] = "model-failure",
      failure: string | undefined,
      source = "",
      result: Compilation | undefined;
    try {
      registerFullLibraryFromDisk();
      registerAgentData();
      const prompt = effectivePrompt(this.m, this.c);
      if (this.c.condition.exposure === "automatic")
        for (const ref of this.c.task.palette)
          this.#returned.set(ref, new Set(this.c.condition.facts));
      // Initial text exposure counts as reference volume, including the baseline list.
      this.reference(prompt);
      await writeFile(join(this.dir, "generation", "input.txt"), prompt);
      await this.audit("effective-input", {
        prompt,
        ...payloadIdentity(prompt),
        case: this.c.id,
        compilerBundleSha256: this.#workerHash,
        policy: this.c.condition.policy,
        fields: this.c.condition.facts,
      });
      this.#messages = [{ role: "user", content: prompt }];
      for (;;) {
        this.consume("turns");
        await this.audit("channel-request", {
          messages: this.#messages,
          model: this.m.model,
          maxOutputTokens: this.m.budgets.maxOutputTokens,
          ...payloadIdentity(json(this.#messages)),
        });
        const channel = this.#channel!;
        const timer = new AbortController();
        const deadline = setTimeout(() => timer.abort(), this.remainingTime());
        let text: string;
        try {
          // Race also protects against a channel ignoring its abort signal.
          text = await Promise.race([
            channel(
              Object.freeze({
                messages: Object.freeze(
                  this.#messages.map((m) => Object.freeze({ ...m })),
                ),
                model: structuredClone(this.m.model),
                maxOutputTokens: this.m.budgets.maxOutputTokens,
                signal: timer.signal,
              }),
            ),
            new Promise<never>((_, reject) =>
              timer.signal.addEventListener(
                "abort",
                () => reject(new Error("Channel deadline exceeded")),
                { once: true },
              ),
            ),
          ]);
          if (typeof text !== "string")
            throw new Error("Text-only channel returned non-text data");
        } catch (e) {
          status =
            e instanceof ModelBudgetFailure
              ? "model-failure"
              : "infrastructure-failure";
          throw e;
        } finally {
          clearTimeout(deadline);
        }
        source = text;
        this.#messages.push({ role: "assistant", content: text });
        await writeFile(join(this.dir, `reply-${this.#used.turns}.txt`), text);
        await this.audit("model-output", { text, ...payloadIdentity(text) });
        if (Buffer.byteLength(text) > this.m.budgets.sourceBytes)
          throw new Error("Reply byte budget exceeded");
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = undefined;
        }
        let response: string;
        try {
          if (obj(parsed) && Object.hasOwn(parsed, "parts_search")) {
            fields(parsed, ["parts_search"]);
            response = await this.search(parsed.parts_search);
          } else if (obj(parsed) && Object.hasOwn(parsed, "part_info")) {
            fields(parsed, ["part_info"]);
            response = await this.info(parsed.part_info);
          } else if (obj(parsed) && Object.hasOwn(parsed, "check_build")) {
            fields(parsed, ["check_build"]);
            if (this.c.condition.policy === "blind-no-feedback") {
              await this.audit("denied", {
                request: parsed,
                reason: "Candidate feedback forbidden",
              });
              response =
                "Candidate feedback is unavailable. Submit the final brick.build call.";
            } else {
              this.consume("checks");
              if (
                !obj(parsed.check_build) ||
                typeof parsed.check_build.code !== "string"
              )
                throw new Error("Invalid check_build");
              fields(parsed.check_build, ["code", "seed"]);
              if (
                parsed.check_build.seed !== undefined &&
                parsed.check_build.seed !== this.m.buildSeed
              )
                throw new Error("Build seed differs from manifest");
              const checked = await this.compile(parsed.check_build.code);
              await this.audit("private-check-result", checked);
              response = await this.feedback(checked, this.#used.checks);
              await this.logPayload("candidate-feedback", parsed, response);
            }
          } else if (isBrickBuild(parsed)) {
            fields(parsed as unknown as Record<string, unknown>, [
              "tool",
              "input",
            ]);
            fields(parsed.input, ["code", "seed"]);
            if (
              parsed.input.seed !== undefined &&
              parsed.input.seed !== this.m.buildSeed
            )
              throw new Error("Build seed differs from manifest");
            if (this.c.condition.policy === "blind-no-feedback") {
              status = "submitted";
              break;
            }
            result = await this.compile(parsed.input.code);
            await this.audit("private-final-check", result);
            const invalid =
              !result.report?.ok ||
              inventoryProblems(result, this.c.task).length > 0;
            if (!invalid) {
              status = "submitted";
              break;
            }
            if (this.#used.repairs >= this.m.budgets.repairs) {
              failure = "Invalid final submission; repair budget exhausted";
              break;
            }
            this.consume("repairs");
            response =
              this.c.condition.policy === "legacy-control"
                ? result.report
                  ? errorsReason(
                      result.report.stats.parts,
                      this.c.task.targetParts,
                      result.report.problems.filter(
                        (p) => p.severity === "error",
                      ),
                    )
                  : `The code did not compile. ${result.failure}`
                : mechanicalFeedback(result, this.c.task, 20);
            await this.logPayload("repair-feedback", parsed, response);
            result = undefined;
          } else {
            await this.audit("denied", {
              request: parsed ?? text,
              reason: "Undeclared route or invalid submission",
            });
            if (this.c.condition.policy === "blind-no-feedback") {
              failure = "Invalid final response";
              break;
            }
            this.consume("repairs");
            response =
              "Invalid protocol. Return only a declared JSON request or the final brick.build call.";
          }
        } catch (e) {
          if (
            String((e as Error).message).startsWith(
              "Compiler infrastructure failure",
            )
          ) {
            status = "infrastructure-failure";
            throw e;
          }
          if (
            this.c.condition.policy === "blind-no-feedback" &&
            obj(parsed) &&
            (Object.hasOwn(parsed, "tool") ||
              Object.hasOwn(parsed, "check_build"))
          ) {
            failure = String((e as Error).message);
            await this.audit("denied", { request: parsed, error: failure });
            break;
          }
          await this.audit("denied", {
            request: parsed,
            error: String((e as Error).message),
          });
          // A denial reveals no compiler result, evaluator output or replacement pose.
          response = `Request denied: ${(e as Error).message}. Submit the final brick.build call.`;
          if (/budget/.test(response)) throw e;
        }
        if (Buffer.byteLength(response) > this.m.budgets.compilerBytes)
          throw new Error("Feedback output budget exhausted");
        this.#messages.push({ role: "user", content: response });
        await this.audit("model-input", {
          response,
          ...payloadIdentity(response),
        });
      }
    } catch (e) {
      failure = String((e as Error).message);
    } finally {
      this.#channel = undefined;
      this.#state = "frozen";
    }
    // Source identity is recorded BEFORE the final no-feedback compilation.
    const files: Record<string, string> = {};
    const save = async (name: string, text: string) => {
      await writeFile(join(this.dir, name), text, { flag: "wx" });
      files[name] = hash(text);
      await chmod(join(this.dir, name), 0o444);
    };
    await save("submission.txt", source);
    await this.audit("generation-closed", {
      status,
      sourceSha256: hash(source),
      used: this.#used,
    });
    if (!result && status === "submitted") {
      try {
        const call = JSON.parse(source);
        result = await this.compile(call.input.code);
      } catch (e) {
        status = "infrastructure-failure";
        failure = String((e as Error).message);
      }
    }
    if (result) {
      await save("compilation.json", json(result) + "\n");
      if (result.ldraw) await save("build.mpd", result.ldraw);
      if (!result.report?.ok || inventoryProblems(result, this.c.task).length) {
        status = "model-failure";
        failure ??= result.failure ?? "Submission failed benchmark validation";
      }
    }
    const referenceCoverage = (result?.report?.parts ?? [])
      .map((p) => p.ref)
      .filter((p, i, a) => a.indexOf(p) === i)
      .sort()
      .map((ref) => {
        const info = partReference(ref, [
          "shape",
          "connectors",
          "capabilities",
        ]);
        const available: FactField[] = [
          ...(info.shape?.physicalBounds.value ? ["shape" as const] : []),
          ...(info.connectors?.evidence === "known"
            ? ["connectors" as const]
            : []),
          "capabilities" as const,
        ];
        return {
          part: ref,
          available,
          returned: [...(this.#returned.get(ref) ?? [])],
          use: "not-inferred" as const,
        };
      });
    const frozen: FrozenRun = {
      referenceCoverage,
      state: "frozen",
      status,
      files,
      used: { ...this.#used },
      ...(failure ? { failure } : {}),
    };
    await writeFile(join(this.dir, "freeze.json"), json(frozen) + "\n", {
      flag: "wx",
    });
    return frozen;
  }
}
export function inventoryProblems(
  result: Compilation,
  task: ScheduledCase["task"],
) {
  const counts = new Map<string, number>();
  for (const p of result.report?.parts ?? [])
    counts.set(p.ref, (counts.get(p.ref) ?? 0) + p.count);
  const out: {
    property: string;
    status: "invalid";
    ref: string;
    count: number;
    maximum: number;
  }[] = [];
  for (const [ref, count] of counts) {
    const maximum =
      task.inventory?.[ref] ??
      (task.palette.length && !task.palette.includes(ref) ? 0 : Infinity);
    if (count > maximum)
      out.push({
        property: "inventory",
        status: "invalid",
        ref,
        count,
        maximum,
      });
  }
  return out;
}
export function mechanicalFeedback(
  result: Compilation,
  task: ScheduledCase["task"],
  limit: number,
) {
  const problems = (result.report?.problems ?? []).map((p, i) => ({
    id: `compiler:${i}:${p.code}`,
    sourceOperations: p.ops ?? [],
    property: p.code,
    status:
      p.code === "overlap"
        ? "uncertain"
        : p.severity === "error"
          ? "invalid"
          : "unknown",
    reason: p.message,
    evidence:
      "existing compiler/derived surface occupancy; no physical certification",
  }));
  const all = [...problems, ...inventoryProblems(result, task)];
  return json({
    version: "mechanical-feedback/1",
    compilerAccepted: result.report?.ok ?? false,
    failure: result.failure ?? null,
    records: all.slice(0, limit),
    total: all.length,
    omitted: Math.max(0, all.length - limit),
    coverage: result.report?.check ?? null,
    untested: [
      "clutch strength",
      "structural stability",
      "assembly order",
      "solid containment",
    ],
    rendererDerived: false,
  });
}

/** Evaluator gets disposable copies after generation is closed. Never a channel. */
export async function stageEvaluation(runDir: string, stageDir: string) {
  const frozen = JSON.parse(
    await readFile(join(runDir, "freeze.json"), "utf8"),
  ) as FrozenRun;
  if (frozen.state !== "frozen")
    throw new Error("Evaluator requires a frozen run");
  await mkdir(stageDir, { recursive: true });
  if ((await readdir(stageDir)).length)
    throw new Error("Evaluation staging directory must be empty");
  for (const [name, sha] of Object.entries(frozen.files)) {
    if (!["submission.txt", "compilation.json", "build.mpd"].includes(name))
      throw new Error("Invalid frozen artifact path");
    await verifyFile(join(runDir, name), sha);
    await writeFile(join(stageDir, name), await readFile(join(runDir, name)));
  }
  return frozen;
}
export async function evaluateFrozen(
  runDir: string,
  stageDir: string,
  evaluator: (stage: string) => Promise<void>,
) {
  const frozen = await stageEvaluation(runDir, stageDir);
  try {
    await evaluator(stageDir);
  } finally {
    for (const [name, sha] of Object.entries(frozen.files))
      await verifyFile(join(runDir, name), sha);
  }
}
