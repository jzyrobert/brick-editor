import { expect, test } from "vitest";
import { join } from "node:path";
import {
  briefFromPrompt,
  oneShotCandidates,
  publishSql,
  sqlInsert,
  sqlValue,
  type Prepared,
} from "../../scripts/gallery-publish";

test("SQL literals are quoted and refuse non-finite numbers", () => {
  expect(sqlValue("it's")).toBe("'it''s'");
  expect(sqlValue(undefined)).toBe("NULL");
  expect(sqlValue(null)).toBe("NULL");
  expect(sqlValue(2.5)).toBe("2.5");
  expect(() => sqlValue(NaN)).toThrow();
  expect(sqlInsert("t", { a: "x'); DROP TABLE builds; --", b: 1 })).toBe(
    "INSERT OR IGNORE INTO t (a, b) VALUES ('x''); DROP TABLE builds; --', 1);",
  );
});

const files: Record<string, string> = {
  "run/prompt.md": "You are…\n\nBuild request: a japanese buddhist temple\n",
  "run/high/result.json": JSON.stringify({
    effort: "high",
    runner: "claude",
    model: "claude-opus-5-5",
    targetParts: 2000,
    accepted: true,
    attemptsUsed: 2,
    seconds: 1148,
    tokens: { output: 117537, costUsd: 2.8408 },
  }),
  "run/high/build.json": "{}",
  // Older runs did not record the runner: they used Codex.
  "run/low/result.json": JSON.stringify({
    effort: "low",
    model: "gpt-6.1-sol",
    targetParts: 2000,
    accepted: true,
  }),
  "run/low/build.json": "{}",
  "run/xhigh/result.json": JSON.stringify({
    effort: "xhigh",
    model: "gpt-6.1-sol",
    accepted: false,
  }),
  "run/max-runner-bug/result.json": JSON.stringify({
    effort: "max",
    runner: "claude",
    model: "claude-opus-5-5",
    accepted: true,
  }),
};
const read = (p: string) => files[p];
const list = () => ["xhigh", "low", "high", "max-runner-bug", "views"];

test("one-shot folders give accepted efforts with derived prompt and agent ids", () => {
  expect(briefFromPrompt(files["run/prompt.md"])).toBe(
    "a japanese buddhist temple",
  );
  const { candidates, skipped } = oneShotCandidates("run", read, list);
  expect(candidates.map((c) => [c.label, c.agentId, c.promptId])).toEqual([
    [
      "run/high",
      "claude/claude-opus-5-5/high",
      "japanese-buddhist-temple-2000",
    ],
    ["run/low", "codex/gpt-6-1-sol/low", "japanese-buddhist-temple-2000"],
  ]);
  expect(candidates[0]).toMatchObject({
    agentName: "Claude Opus 5.5 (high)",
    scriptPath: join("run", "high", "build.json"),
    source: "run",
  });
  expect(skipped).toEqual([
    "run/max-runner-bug: no build.json",
    "run/xhigh: not accepted",
  ]);
  const only = oneShotCandidates("run", read, list, {
    only: ["low"],
    promptId: "temple",
  });
  expect(only.candidates.map((c) => [c.label, c.promptId])).toEqual([
    ["run/low", "temple"],
  ]);
  expect(() => oneShotCandidates("nowhere", read, list)).toThrow(/prompt.md/);
});

test("publish SQL inserts each prompt and agent once, then the builds", () => {
  const { candidates } = oneShotCandidates("run", read, list);
  const build = (i: number, sha: string) =>
    ({
      candidate: candidates[i],
      id: sha.slice(0, 12),
      mpd: { sha, bytes: 100, gz: new Uint8Array() },
      script: { sha: "s".repeat(64), bytes: new Uint8Array() },
      report: { sha: "p".repeat(64), bytes: new Uint8Array() },
      parts: 1921,
      warnings: 1,
      library: { release: "lib", hash: "h" },
      renders: { iso: "r".repeat(64) },
    }) as Prepared & { renders: Record<string, string> };
  const sql = publishSql(
    [build(0, "a".repeat(64)), build(1, "b".repeat(64))],
    1_790_000_000,
  ).trim();
  const lines = sql.split("\n");
  expect(lines.filter((l) => l.includes("INTO prompts"))).toHaveLength(1);
  expect(lines.filter((l) => l.includes("INTO agents"))).toHaveLength(2);
  expect(lines.filter((l) => l.includes("INTO builds"))).toHaveLength(2);
  expect(lines.indexOf(lines.find((l) => l.includes("INTO builds"))!)).toBe(2);
  // Cost is rounded to cents; unknown values are NULL.
  expect(sql).toContain(", 2.84, 117537, 'run', 'lib', 'h', 1, 1790000000);");
  expect(lines.at(-1)).toContain(", NULL, NULL, 'run', 'lib', 'h', 1,");
});
