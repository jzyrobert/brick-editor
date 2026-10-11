import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { balanceFiles, fileTimings, type FileTiming } from "./ci-shards";

const [project, shardArg, ...extra] = process.argv.slice(2);
const timingsPath = new URL("./ci-browser-timings.json", import.meta.url);
if (project === "update") {
  const report = JSON.parse(readFileSync(shardArg, "utf8"));
  const sourceRun = extra[0];
  if (!sourceRun || report.stats.unexpected || report.stats.flaky)
    throw new Error("Use a successful, non-flaky report and its CI run URL");
  writeFileSync(
    timingsPath,
    JSON.stringify(
      {
        sourceRun,
        files: Object.fromEntries(
          Object.entries(fileTimings(report, "main")).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        ),
      },
      null,
      2,
    ) + "\n",
  );
  process.exit(0);
}
const match = /^(\d+)\/(\d+)$/.exec(shardArg ?? "");
if (
  !["main", "heavy", "perf"].includes(project) ||
  !match ||
  Number(match[1]) < 1 ||
  Number(match[1]) > Number(match[2])
)
  throw new Error(
    "Usage: tsx scripts/ci-browser.ts main|heavy|perf 1/8 [Playwright options]",
  );
const current = Number(match[1]);
const total = Number(match[2]);
const planOnly = extra.includes("--plan-only");
const options = extra.filter((arg) => arg !== "--plan-only");
let selection = ["--shard=" + shardArg];
if (project === "main") {
  const listed = spawnSync(
    "npx",
    [
      "playwright",
      "test",
      "--project=main",
      ...options,
      "--list",
      "--reporter=json",
    ],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  if (listed.status !== 0)
    throw new Error(listed.stderr || listed.stdout || String(listed.error));
  const discovered = fileTimings(JSON.parse(listed.stdout), "main");
  const history = JSON.parse(readFileSync(timingsPath, "utf8")).files as Record<
    string,
    FileTiming
  >;
  const shards = balanceFiles(
    Object.entries(discovered).map(([file, row]) => ({
      file,
      tests: row.tests,
    })),
    history,
    total,
  );
  const selected = shards[current - 1];
  if (!selected.files.length) throw new Error("Empty browser shard");
  const directory = process.env.RUNNER_TEMP ?? ".local";
  mkdirSync(directory, { recursive: true });
  const path = join(
    directory,
    "browser-main-" + current + "-of-" + total + ".txt",
  );
  writeFileSync(
    path,
    selected.files.map((file) => "[main] › " + file).join("\n") + "\n",
  );
  selection = ["--test-list", path];
  console.log(JSON.stringify({ shard: shardArg, ...selected }));
}
if (!planOnly) {
  const result = spawnSync(
    "npx",
    ["playwright", "test", "--project=" + project, ...selection, ...options],
    { stdio: "inherit" },
  );
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
