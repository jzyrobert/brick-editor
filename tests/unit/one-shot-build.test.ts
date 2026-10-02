import { describe, expect, it } from "vitest";
import {
  extractJson,
  oneShotPrompt,
  repairPrompt,
} from "../../scripts/one-shot-build";
import { partRange } from "../../src/build-script/budget";

describe("one-shot build runs", () => {
  it("asks for the JSON alone, without the tools section", () => {
    const text = oneShotPrompt(
      "a japanese buddhist temple",
      partRange(2000, 5),
    );
    expect(text).not.toMatch(
      /\{\{|When you can run tools|brick-cli|build\.json/,
    );
    expect(text).toContain(
      "Return ONLY one JSON object (no markdown, no commentary).",
    );
    expect(text).toContain("Accepted range: 1,900–2,100 parts.");
    expect(text.trimEnd()).toMatch(
      /Build request: a japanese buddhist temple$/,
    );
  });

  it("finds the JSON in a reply with fences, prose and braces in strings", () => {
    expect(
      extractJson('Here:\n```json\n{"a": "x}{", "b": {"c": [1]}}\n```\nDone {'),
    ).toEqual({ a: "x}{", b: { c: [1] } });
    expect(extractJson('{"a": 1,}  {"b": 2}')).toEqual({ b: 2 });
    expect(extractJson("no json here")).toBeUndefined();
  });

  it("sends the errors and the previous reply back", () => {
    const text = repairPrompt("PROMPT", "- overlap: …", '{"x":1}');
    expect(text.startsWith("PROMPT\n---")).toBe(true);
    expect(text).toContain("Reason:\n- overlap: …");
    expect(text).toContain("returning ONLY a corrected JSON object");
    expect(text.trimEnd().endsWith('{"x":1}')).toBe(true);
  });
});
