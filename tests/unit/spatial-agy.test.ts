import { expect, it } from "vitest";
import {
  checkAgyEvent,
  validateAgyModel,
  selectAgyReply,
} from "../../scripts/spatial-benchmark/agy-channel";
import {
  parseAgyQuota,
  quotaGate,
} from "../../scripts/spatial-benchmark/agy-quota";
const model = { id: "gemini-3.8-flash-high", effort: "high" };
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
