// Runs the browser acceptance tests against the built bundle (run
// `npm run build` first) in two phases, so the wall-clock budget tests never
// share the CPU with other tests:
//   1. the `main` and `heavy` projects, in parallel;
//   2. the `perf` project, one test at a time.
// Both phases always run; the exit code is non-zero when either fails.
// Arguments are passed to both phases (e.g. a spec path or `--grep`).
// `--quick` runs only the `main` project.
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const quick = args.includes("--quick");
const rest = args.filter((a) => a !== "--quick");

const first = {
  projects: quick ? ["main"] : ["main", "heavy"],
  env: { BROWSER_RESULTS: "test-results/browser-results.json" },
};
// Playwright cleans its output directory when a run starts, so the second
// phase writes below the first phase's directory instead of replacing it.
const perf = {
  projects: ["perf"],
  env: {
    BROWSER_RESULTS: "test-results/browser-results-perf.json",
    BROWSER_OUTPUT_DIR: "test-results/perf",
  },
};
const phases = quick ? [first] : [first, perf];

let failed = false;
for (const phase of phases) {
  const started = Date.now();
  const result = spawnSync(
    "npx",
    [
      "playwright",
      "test",
      ...phase.projects.map((p) => `--project=${p}`),
      "--pass-with-no-tests",
      ...rest,
    ],
    {
      stdio: "inherit",
      env: { ...process.env, ...phase.env },
    },
  );
  const minutes = ((Date.now() - started) / 60000).toFixed(1);
  console.log(
    `[test-browser] ${phase.projects.join("+")}: exit ${result.status} in ${minutes} min`,
  );
  if (result.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
