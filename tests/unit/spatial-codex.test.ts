import { expect, it } from "vitest";
import { hash } from "../../scripts/spatial-benchmark/part-reference";
import { modelPayload } from "../../scripts/spatial-benchmark/codex-channel";
import {
  quotaAllowsNext,
  type Quota,
} from "../../scripts/spatial-benchmark/codex-quota";
const q = (remaining: number): Quota => ({
  checkedAt: "now",
  ordinaryUsageAllowed: true,
  reached: false,
  weeklyRemaining: remaining,
  windows: [
    { usedPercent: 100 - remaining, windowDurationMins: 10080, resetsAt: null },
  ],
});
it("strips all native tools and pins the actual text-only request budget", () => {
  const raw = {
    model: "gpt-6.1-sol",
    reasoning: { effort: "high" },
    input: [
      { role: "user", content: [{ type: "input_text", text: "approved" }] },
    ],
    tools: [{ type: "web_search" }, { type: "image_generation" }],
    tool_choice: "auto",
  };
  expect(modelPayload(raw, 16000)).toMatchObject({
    tools: [],
    tool_choice: "none",
    max_output_tokens: 16000,
    store: false,
  });
  expect(raw.tools).toHaveLength(2);
});
it("rejects image/file input and an incorrect generating model/effort", () => {
  const raw = {
    model: "gpt-6.1-sol",
    reasoning: { effort: "high" },
    input: [{ type: "input_image", image_url: "data:forbidden" }],
  };
  expect(() => modelPayload(raw, 10)).toThrow("Non-text");
  expect(() => modelPayload({ ...raw, model: "different" }, 10)).toThrow(
    "model/effort",
  );
  expect(() =>
    modelPayload({ ...raw, reasoning: { effort: "low" } }, 10),
  ).toThrow("model/effort");
});
it("stops before weekly or short-window exhaustion with an observed-drop reserve", () => {
  expect(quotaAllowsNext(q(51))).toBe(true);
  expect(quotaAllowsNext(q(5))).toBe(false);
  expect(quotaAllowsNext(q(15), 8)).toBe(false);
  expect(quotaAllowsNext({ ...q(51), reached: true })).toBe(false);
  expect(quotaAllowsNext({ ...q(51), ordinaryUsageAllowed: false })).toBe(
    false,
  );
  expect(
    quotaAllowsNext({
      ...q(51),
      windows: [
        ...q(51).windows,
        { usedPercent: 98, windowDurationMins: 300, resetsAt: null },
      ],
    }),
  ).toBe(false);
});

it("only an evaluator with preverified image hashes can submit image inputs", () => {
  const bytes = Buffer.from("fixed-png-fixture"),
    image = "data:image/png;base64," + bytes.toString("base64");
  const raw = {
    model: "gpt-6.1-sol",
    reasoning: { effort: "high" },
    input: [{ type: "input_image", image_url: image }],
  };
  expect(() => modelPayload(raw, 16000)).toThrow("Non-text");
  expect(modelPayload(raw, 16000, new Set([hash(bytes)])).tools).toEqual([]);
  expect(() => modelPayload(raw, 16000, new Set(["other"]))).toThrow(
    "unapproved",
  );
  expect(() =>
    modelPayload({ ...raw, input: [] }, 16000, new Set([hash(bytes)])),
  ).toThrow("omitted");
});
