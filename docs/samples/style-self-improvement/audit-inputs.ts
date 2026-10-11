import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { oneShotPrompt } from "../../../scripts/one-shot-build";
import { registerAgentData } from "../../../scripts/build-script-cli";
registerAgentData();
const root = resolve(".");
const round = Number(process.argv[2]);
const sha = (file: string) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");
const base = JSON.parse(
  readFileSync("docs/samples/style-self-improvement/baseline.json", "utf8"),
);
const metrics = JSON.parse(
  readFileSync(
    `docs/samples/style-self-improvement/round-${round}/metrics.json`,
    "utf8",
  ),
);
const changes = JSON.parse(
  readFileSync(
    `docs/samples/style-self-improvement/round-${round}/changes.json`,
    "utf8",
  ),
);
for (const c of base.cases) {
  if (
    sha(`${c.source}/build.js`) !== c.sourceSha256 ||
    sha(`${c.source}/prompt.md`) !== c.promptSha256
  )
    throw Error(`Baseline changed ${c.id}`);
}
for (const c of metrics.cases) {
  const promptFile = `style-loop-${round}-${c.style}.md`;
  const replyPromptFile =
    c.style === "lego" ? "brick-build.md" : "brick-build-diorama.md";
  const expected = oneShotPrompt(c.brief, c.target, {
    partsList: true,
    search: true,
    check: true,
    promptFile,
    replyPromptFile,
  });
  const actual = readFileSync(`${c.artifact}/prompt.md`, "utf8");
  if (expected !== actual) throw Error(`Input mismatch ${c.id}`);
  if (
    sha(`prompts/${promptFile}`) !== changes.promptHashes[c.style] ||
    sha(`prompts/${replyPromptFile}`) !== changes.replyHashes[c.style]
  )
    throw Error(`Frozen prompt changed ${c.id}`);
  if (sha(`${c.artifact}/build.js`) !== c.sourceSha256)
    throw Error(`Source changed ${c.id}`);
}
if (sha("scripts/one-shot-build.ts") !== changes.scriptSha256)
  throw Error("Script changed");
const audit = {
  round,
  cases: metrics.cases.length,
  complete: metrics.complete,
  exactInputReconstruction: true,
  frozenPromptsUnchanged: true,
  baselineSourcesAndPromptsUnchanged: true,
  acceptedSourcesUnchanged: true,
  scriptUnchanged: true,
};
writeFileSync(
  `docs/samples/style-self-improvement/round-${round}/input-audit.json`,
  JSON.stringify(audit, null, 2) + "\n",
);
console.log(audit);
