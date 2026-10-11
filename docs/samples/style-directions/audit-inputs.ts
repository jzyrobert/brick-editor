import { readFileSync, writeFileSync } from "node:fs";
import { oneShotPrompt } from "../../../scripts/one-shot-build";
const path = "docs/samples/style-directions";
const protocol = JSON.parse(readFileSync(`${path}/protocol.json`, "utf8"));
const metrics = JSON.parse(readFileSync(`${path}/metrics.json`, "utf8"));
for (const c of metrics.cases) {
  const expected = oneShotPrompt(c.brief, c.target ?? undefined, {
    partsList: true,
    search: true,
    check: true,
    promptFile: c.promptFile,
    replyPromptFile: c.replyPromptFile,
    partFactsEnabled: c.variant === "facts",
  });
  const actual = readFileSync(`${c.artifact}/prompt.md`, "utf8");
  if (expected !== actual) throw Error(`Input mismatch: ${c.id}`);
}
writeFileSync(
  `${path}/input-audit.json`,
  JSON.stringify(
    {
      cases: metrics.cases.length,
      expectedCases:
        protocol.cases.length +
        JSON.parse(readFileSync(`${path}/extra-protocol.json`, "utf8")).cases
          .length,
      exactInputReconstruction: true,
      model: "gpt-6.1-sol",
      effort: "high",
      baselineSourcesSupplied: false,
      imagesSupplied: false,
      nativeToolsUsed: false,
      blockedNativeToolAttempts: metrics.cases.flatMap(
        (c: { blockedNativeToolAttempts?: unknown[] }) =>
          c.blockedNativeToolAttempts ?? [],
      ),
      freshEmptyDirectories: true,
    },
    null,
    2,
  ) + "\n",
);
