import { defineConfig } from "@playwright/test";

/**
 * Browser acceptance tests run against the production bundle on software
 * WebGL (SwiftShader), which is CPU-bound, so tests run in parallel and are
 * split into three projects:
 *
 * - `main`: everything untagged; fully parallel.
 * - `heavy` (`@heavy`): path-traced Photo tests, each compiling the path
 *   tracing shader for about a minute; kept together so CI can give them
 *   their own shard.
 * - `perf` (`@perf`): tests that assert wall-clock budgets (longest task,
 *   physics tick time, selection latency); one at a time, and never
 *   alongside other tests (`npm run test:browser` runs them after the rest).
 *
 * `BROWSER_WORKERS` overrides the worker count (default: 1 on CI, half the
 * cores locally).
 */
const workers =
  Number(process.env.BROWSER_WORKERS) || (process.env.CI ? 1 : "50%");

export default defineConfig({
  testDir: "tests/browser",
  // Cleaned at the start of each run; scripts/test-browser.ts gives its
  // second (perf) phase a subdirectory so the first phase's traces survive.
  outputDir: process.env.BROWSER_OUTPUT_DIR ?? "test-results",
  // CI uses one worker to avoid competing software-GL renders. Keep the
  // existing timeouts and performance budgets; slow models set their own.
  timeout: 120000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  workers,
  use: {
    baseURL: "http://127.0.0.1:4175",
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      args: [
        "--no-sandbox",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
    trace: "retain-on-failure",
  },
  projects: [
    { name: "main", grepInvert: /@perf|@heavy/ },
    { name: "heavy", grep: /@heavy/ },
    { name: "perf", grep: /@perf/, workers: 1 },
  ],
  webServer: {
    command: "npm run preview -- --port 4175",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: true,
  },
  reporter: process.env.CI
    ? [["list"], ["blob"]]
    : [
        ["list"],
        [
          "json",
          {
            outputFile:
              process.env.BROWSER_RESULTS ??
              "test-results/browser-results.json",
          },
        ],
      ],
});
