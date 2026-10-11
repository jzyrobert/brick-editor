import { defineConfig } from "vitest/config";

// Wall-clock budgets run on a separate CI runner with one worker. Local
// `npm test` still discovers all three projects; select performance alone
// when measuring on a shared machine.
const performanceFiles = [
  "tests/unit/instruction-guide.test.ts",
  "tests/unit/load-skeleton.test.ts",
  "tests/unit/part-compile.test.ts",
  "tests/unit/parts-list.test.ts",
  "tests/unit/play-performance.test.ts",
];
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          exclude: performanceFiles,
        },
      },
      {
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          fileParallelism: false,
        },
      },
      {
        test: {
          name: "performance",
          include: performanceFiles,
          fileParallelism: false,
        },
      },
    ],
  },
});
