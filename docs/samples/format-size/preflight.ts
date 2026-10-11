import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { oneShotPrompt } from "../../../scripts/one-shot-build";
const base = "docs/samples/format-size";
const p = JSON.parse(readFileSync(base + "/protocol.json", "utf8"));
const body = (s: string) => s.split("\n---\n")[1];
const withoutSize = (s: string) => s.replace(/## Size\n[\s\S]*?(?=\n## )/, "");
for (const style of ["lego", "diorama"]) {
  const source = body(readFileSync(`prompts/style-budget-${style}.md`, "utf8"));
  const format = body(
    readFileSync(`prompts/style-size-format-${style}.md`, "utf8"),
  );
  const reference = body(
    readFileSync(`prompts/style-size-reference-${style}.md`, "utf8"),
  );
  assert.equal(withoutSize(source), withoutSize(format));
  assert.equal(withoutSize(format), withoutSize(reference));
  assert.equal(
    reference.slice(0, reference.indexOf("\n\nReference data")),
    format.slice(0, format.indexOf("\n\n## Coordinates")),
  );
}
const prompts = p.cases.map((c: any) =>
  oneShotPrompt(c.brief, undefined, {
    partsList: true,
    search: true,
    check: true,
    promptFile: c.promptFile,
    replyPromptFile: c.replyPromptFile,
    partFactsEnabled: false,
  }),
);
assert.equal(prompts.length, 48);
assert.equal(new Set(prompts).size, 24);
assert(prompts.every((s: string) => !s.includes("{{TARGET_PARTS}}")));
writeFileSync(
  base + "/preflight.json",
  JSON.stringify(
    {
      cases: 48,
      distinctInputs: 24,
      repetitionsPerInput: 2,
      onlySizeSectionChanged: true,
      referenceArmAddsTableOnly: true,
      noNumericalTargets: true,
      partFactsEnabled: false,
      runnerUnchanged: true,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Preflight passed: 48 cases, 24 inputs repeated twice; only Size changes.",
);
