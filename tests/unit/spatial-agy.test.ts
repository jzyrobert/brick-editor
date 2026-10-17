import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { sameCompletedAgyManifest } from "../../scripts/generate-agy-gallery";
import {
  checkAgyEvent,
  validateAgyModel,
  selectAgyReply,
  checkAgyOutputBudget,
  normalizeAgyEnvelope,
  AGY_STREAM_INTERRUPTION,
} from "../../scripts/spatial-benchmark/agy-channel";
import {
  parseAgyQuota,
  quotaGate,
  quotaDrop,
  observedAgyRunCost,
} from "../../scripts/spatial-benchmark/agy-quota";
const model = { id: "gemini-3.8-flash-high", effort: "high" };
it("adapts a draft-check carrier without changing its code, seed or check semantics", () => {
  const code = 'script({title:"A"});\nsection("x", []);';
  const normalized = normalizeAgyEnvelope(
    JSON.stringify({ tool: "check_build", input: { code, seed: 1 } }),
  );
  expect(JSON.parse(normalized.text)).toEqual({
    check_build: { code, seed: 1 },
  });
  expect(normalized.normalization).toBe("check_build-tool-envelope");
  expect(
    normalizeAgyEnvelope('{"tool":"run_command","input":{"code":"x"}}')
      .normalization,
  ).toBe(null);
  expect(
    normalizeAgyEnvelope(
      '{"tool":"check_build","input":{"code":"x"},"extra":true}',
    ).normalization,
  ).toBe(null);
});
it("preserves completed lower-cap cases while refusing changes to generation inputs", () => {
  const requested = JSON.parse(
    readFileSync(
      "fixtures/spatial-benchmark/studies/gallery-reference-v2-agy/flash.json",
      "utf8",
    ),
  );
  const completed = structuredClone(requested);
  completed.budgets.maxOutputTokens = 32768;
  completed.budgets.totalMs -= 1000;
  expect(sameCompletedAgyManifest(completed, requested)).toBe(true);
  completed.tasks[0].brief += " changed";
  expect(sameCompletedAgyManifest(completed, requested)).toBe(false);
});
const emptyFunctionError =
  "Your previous response contained an improperly formatted function call: Malformed function call: Failed to parse function call: Function call is empty - no input to parse.\nPlease retry with a properly formatted function call\nRetries remaining: 3";
it("recovers a completed protocol object after only the exact stream-interruption diagnostic", () => {
  const text = '{"check_build":{"code":"x","seed":1}}';
  const r = { status: "ERROR", error: AGY_STREAM_INTERRUPTION, response: text };
  expect(selectAgyReply(r, text)).toBe(text);
  for (const invalid of [
    '{"check_build":',
    "prose",
    '{"tool":"read_file","input":{}}',
  ])
    expect(() => selectAgyReply(r, invalid)).toThrow();
  expect(() =>
    selectAgyReply({ ...r, error: "network unavailable" }, text),
  ).toThrow();
});
it("passes concatenated complete protocol responses unchanged to bounded host repair", () => {
  const text =
    '{"check_build":{"code":"brace } and \\\"quote"}}\n{"tool":"brick.build","input":{"code":"x"}}';
  const result = { status: "ERROR", error: emptyFunctionError, response: text };
  expect(selectAgyReply(result, text)).toBe(text);
  expect(selectAgyReply(result, text + " prose")).toBe(text + " prose");
});
it("preserves completed text for normal host repair only after the exact native artifact", () => {
  const r = {
    status: "ERROR",
    error: emptyFunctionError,
    response: '{"parts_search":[]}',
  };
  expect(selectAgyReply(r, r.response)).toBe(r.response);
  const malformedDeclaredRequest =
    '{"tool":"check_build","input":{"code":"x"}}';
  expect(
    selectAgyReply(
      { ...r, response: malformedDeclaredRequest },
      malformedDeclaredRequest,
    ),
  ).toBe(malformedDeclaredRequest);
  expect(
    selectAgyReply(
      {
        ...r,
        error:
          "Your previous response contained an improperly formatted function call\nPlease retry with a properly formatted function call\nRetries remaining: 3",
      },
      r.response,
    ),
  ).toBe(r.response);
  for (const text of [
    "unfinished JSON {",
    '{"tool":"run_command","input":{}}',
    "<text>ordinary prose",
  ])
    expect(selectAgyReply(r, text)).toBe(text);
  expect(() => selectAgyReply(r)).toThrow();
  expect(() => selectAgyReply(r, " ")).toThrow();
  expect(() =>
    selectAgyReply({ ...r, error: "quota exhausted" }, r.response),
  ).toThrow();
  expect(() => checkAgyOutputBudget(34101, 32768)).toThrow("exceeding");
  expect(() => checkAgyOutputBudget(undefined, 32768)).toThrow("accounting");
  expect(() => checkAgyOutputBudget(32768, 32768)).not.toThrow();
});
it("uses the last completed native response without accepting errored turns", () => {
  expect(
    selectAgyReply(
      { status: "SUCCESS", response: '{"old":1}\n{"new":2}' },
      '{"new":2}',
    ),
  ).toBe('{"new":2}');
  expect(() =>
    selectAgyReply(
      { status: "ERROR", error: "malformed function", response: '{"ok":true}' },
      '{"ok":true}',
    ),
  ).toThrow("malformed function");
});
it("pins authorised Gemini models and rejects native tool/subagent events", () => {
  expect(validateAgyModel(model)).toBe(model);
  expect(() => validateAgyModel({ ...model, effort: "medium" })).toThrow();
  expect(() =>
    checkAgyEvent(
      { event: "init", init: { model: "different", agent: "brick-blind" } },
      model,
    ),
  ).toThrow();
  expect(() =>
    checkAgyEvent(
      {
        event: "step_update",
        step_update: { step_type: "tool", tool_name: "view_file" },
      },
      model,
    ),
  ).toThrow();
  expect(() =>
    checkAgyEvent(
      { event: "step_update", step_update: { subagent_info: {} } },
      model,
    ),
  ).toThrow();
  expect(() =>
    checkAgyEvent(
      {
        event: "init",
        init: { model: model.id, agent: "brick-blind", tools: ["view_file"] },
      },
      model,
    ),
  ).not.toThrow();
});
const raw = (weekly = 70, five = 60, argon = 40) =>
  `Gemini Models\tWeekly Limit Remaining\t${weekly}%\t2026-10-24T00:00:00Z\nGemini Models\tFive Hour Limit Remaining\t${five}%\t2026-10-17T05:00:00Z\nGemini 4 Argon\tGemini 4 Argon Weekly Limit\t${argon}%\t2026-10-24T00:00:00Z\n`;
it("includes the original run in continuation cost and refuses cyclic history", async () => {
  const root = await mkdtemp(join(tmpdir(), "agy-quota-test-"));
  try {
    const original = join(root, "original"),
      continued = join(root, "continued");
    await mkdir(original);
    await mkdir(continued);
    await writeFile(
      join(original, "quota.json"),
      JSON.stringify([
        { phase: "before", ...parseAgyQuota(raw(100, 100, 100)) },
        { phase: "after", ...parseAgyQuota(raw(100, 100, 90)) },
      ]),
    );
    await writeFile(
      join(original, "results.json"),
      JSON.stringify({ results: [{}] }),
    );
    await writeFile(
      join(continued, "quota.json"),
      JSON.stringify([
        { phase: "before", ...parseAgyQuota(raw(100, 100, 85)) },
        { phase: "after", ...parseAgyQuota(raw(100, 100, 83)) },
      ]),
    );
    await writeFile(
      join(continued, "results.json"),
      JSON.stringify({ results: [{ recovery: { from: original } }] }),
    );
    expect(await observedAgyRunCost(continued, "gemini-4-argon-high")).toBe(12);
    await writeFile(
      join(original, "results.json"),
      JSON.stringify({ results: [{ recovery: { from: continued } }] }),
    );
    await expect(
      observedAgyRunCost(continued, "gemini-4-argon-high"),
    ).rejects.toThrow("Cyclic");
  } finally {
    if (!root.startsWith(resolve(tmpdir()) + sep))
      throw new Error("Unexpected temporary test path");
    await rm(root, { recursive: true, force: true });
  }
});
it("measures each quota pool when the limiting counter changes", () => {
  const before = parseAgyQuota(raw(99, 98, 99)),
    after = parseAgyQuota(raw(99, 98, 92));
  expect(quotaDrop(before, after, "gemini-4-argon-high")).toBe(7);
  expect(quotaDrop(before, after, model.id)).toBe(0);
});
it("requires every quota counter and gates Argon on both shared and separate limits", () => {
  const q = parseAgyQuota(raw(70, 60, 9));
  expect(quotaGate(q, model.id).sufficient).toBe(true);
  expect(quotaGate(q, "gemini-4-argon-high").sufficient).toBe(false);
  expect(quotaGate(parseAgyQuota(raw(70, 9, 90)), model.id).sufficient).toBe(
    false,
  );
  expect(() =>
    parseAgyQuota("Gemini Models\tWeekly Limit Remaining\t100%\n"),
  ).toThrow("Missing quota");
  expect(() => parseAgyQuota(raw(101))).toThrow("Invalid quota");
});
it("raises the next-run estimate after observed consumption and retains its reserve", () => {
  expect(quotaGate(parseAgyQuota(raw(20, 20, 20)), model.id, 10)).toEqual({
    remaining: 20,
    reserve: 5,
    estimatedNext: 17,
    sufficient: false,
  });
  expect(quotaGate(parseAgyQuota(raw(10, 10, 10)), model.id).sufficient).toBe(
    true,
  );
});
