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

const phases: { projects: string[]; results: string }[] = quick
  ? [{ projects: ["main"], results: "test-results/browser-results.json" }]
  : [
      {
        projects: ["main", "heavy"],
        results: "test-results/browser-results.json",
      },
      { projects: ["perf"], results: "test-results/browser-results-perf.json" },
    ];

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
      env: { ...process.env, BROWSER_RESULTS: phase.results },
    },
  );
  const minutes = ((Date.now() - started) / 60000).toFixed(1);
  console.log(
    `[test-browser] ${phase.projects.join("+")}: exit ${result.status} in ${minutes} min`,
  );
  if (result.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
