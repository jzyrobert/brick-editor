import { describe, expect, it } from "vitest";
import {
  errorsReason,
  extractJson,
  knowledge,
  oneShotPrompt,
  repairPrompt,
  searchRequest,
} from "../../scripts/one-shot-build";
import { searchForAgent } from "../../src/build-script/part-list";

describe("one-shot build runs", () => {
  it("asks for the JSON alone, without the tools section", () => {
    const text = oneShotPrompt("a japanese buddhist temple", 2000);
    expect(text).not.toMatch(
      /\{\{|When you can run tools|brick-cli|build\.json/,
    );
    expect(text).toContain(
      "Return ONLY one JSON object (no markdown, no commentary).",
    );
    // A target to aim at, with the rules for counting, and no pass mark.
    expect(text).toContain("- Target: 2,000 parts, counting every part");
    expect(text).toContain("### Counting parts");
    expect(text).not.toMatch(/Accepted range|refuses the build/);
    expect(text.trimEnd()).toMatch(
      /Build request: a japanese buddhist temple$/,
    );
  });

  it("lists the curated parts and describes the search tool when on", () => {
    const range = 2000;
    const listed = oneShotPrompt("a barn", range, { search: true });
    expect(listed).toContain("## Searching for parts");
    expect(listed).toContain('{"parts_search": [{"query": "stone lantern"}');
    expect(listed).toMatch(
      /\n- 3005 Brick 1 × 1 — 1×1 studs \(x×z\), 3 plates — all common colours/,
    );
    expect(listed).toContain(
      "- 61678 Curved Slope 4 × 1 — 1×4 studs (x×z), 3 plates —",
    );
    expect(listed).toContain(
      "- 6141 Round Plate 1 × 1 — 1×1 studs (x×z), 1 plate —",
    );
    expect(listed).toContain("## Geometry rules");
    expect(listed).toContain(
      "up to 10 search replies, each with up to 5 searches",
    );
    expect(listed).toContain("never guess a number");
    expect(listed.indexOf("## Searching for parts")).toBeLessThan(
      listed.indexOf("## Output"),
    );
    const bare = oneShotPrompt("a barn", range, { partsList: false });
    expect(bare).not.toMatch(/## Parts|## Searching|3005 Brick 1 × 1 —/);
    expect(bare).toContain("## How to build well");
  });

  it("tells search requests from answers", () => {
    expect(
      searchRequest('{"parts_search": {"query": "lantern", "limit": 3}}'),
    ).toEqual([{ query: "lantern", limit: 3 }]);
    expect(
      searchRequest(
        JSON.stringify({ parts_search: Array(7).fill({ query: "x" }) }),
      ),
    ).toHaveLength(5);
    expect(searchRequest('{"buildScript": 1, "sections": []}')).toBeUndefined();
    expect(searchRequest("no json")).toBeUndefined();
  });

  it("searches for an agent with sizes and colours in the results", () => {
    const out = searchForAgent({
      query: "slope",
      size: "1x2",
      colour: "dark red",
      available_in_colour: true,
      limit: 3,
    });
    expect(out.ids).toContain("3040b");
    expect(out.text).toMatch(
      /^3040b \| Slope 45° 2 × 1 \| 1×2 studs \(x×z\), 3 plates \| curated \| .* \| in dark red: verified$/m,
    );
    expect(searchForAgent({ size: "banana" }).text).toMatch(
      /^Search failed|No parts match/,
    );
  });

  it("measures part knowledge in a reply", () => {
    const script = {
      parts: { lamp: { find: "lamp post" }, tile: "3070b" },
      sections: [
        {
          ops: [
            { op: "place", part: "4073", colour: "red" },
            { op: "place", part: "@lamp" },
            { op: "scatter", parts: ["6255", "24866"] },
          ],
        },
      ],
    };
    const k = knowledge(script, {
      resolved: [{ find: "lamp post", ref: "2039.dat", name: "Lamp Post" }],
      problems: [
        { severity: "info", code: "part-moved", message: "4073 is old" },
        { severity: "error", code: "colour-unavailable", message: "no" },
      ],
    });
    expect(k.named).toEqual(["24866", "3070b", "4073", "6255"]);
    expect(k.notInList).toEqual(["4073"]);
    expect(k.finds).toEqual([
      { find: "lamp post", ref: "2039", name: "Lamp Post" },
    ]);
    expect(k.moved).toEqual(["4073 is old"]);
    expect(k.colourErrors).toEqual(["no"]);
    expect(
      knowledge({}, undefined, 'unknown part "9x9" (use {"find": "..."})')
        .unknownPart,
    ).toBe("9x9");
  });

  it("finds the JSON in a reply with fences, prose and braces in strings", () => {
    expect(
      extractJson('Here:\n```json\n{"a": "x}{", "b": {"c": [1]}}\n```\nDone {'),
    ).toEqual({ a: "x}{", b: { c: [1] } });
    expect(extractJson('{"a": 1,}  {"b": 2}')).toEqual({ b: 2 });
    expect(extractJson("no json here")).toBeUndefined();
  });

  it("states the size against the target with the errors", () => {
    expect(
      errorsReason(2137, 2000, [
        { code: "overlap", message: "a and b overlap", ops: ["x", "y"] },
        { code: "colour-unavailable", message: "not made in gold" },
      ]),
    ).toBe(
      "The script compiled to 2,137 parts (target 2,000: +137, +6.9%). Errors to fix:\n- overlap: a and b overlap [x, y]\n- colour-unavailable: not made in gold",
    );
    const many = Array.from({ length: 23 }, () => ({
      code: "overlap",
      message: "m",
    }));
    expect(errorsReason(1, 2, many)).toMatch(/\n- … 3 more errors$/);
  });

  it("sends the errors and the previous reply back", () => {
    const text = repairPrompt("PROMPT", "- overlap: …", '{"x":1}');
    expect(text.startsWith("PROMPT\n---")).toBe(true);
    expect(text).toContain("Reason:\n- overlap: …");
    expect(text).toContain("returning ONLY a corrected JSON object");
    expect(text.trimEnd().endsWith('{"x":1}')).toBe(true);
  });
});
