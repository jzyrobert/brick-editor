import { expect, it } from "vitest";
import { balanceFiles, fileTimings } from "../../scripts/ci-shards";

it("balances slow files while covering renamed/new files exactly once", () => {
  const files = ["a", "b", "c", "d", "new"].map((file) => ({ file, tests: 1 }));
  const history = Object.fromEntries(
    [90000, 80000, 10000, 10000].map((durationMs, i) => [
      files[i].file,
      { tests: 1, durationMs },
    ]),
  );
  history.deleted = { tests: 100, durationMs: 1000000 };
  const shards = balanceFiles(files, history, 2);
  expect(shards.flatMap((s) => s.files).sort()).toEqual(
    files.map((f) => f.file).sort(),
  );
  expect(Math.max(...shards.map((s) => s.durationMs))).toBe(105000);
  expect(shards.reduce((n, s) => n + s.tests, 0)).toBe(5);
  expect(balanceFiles([...files].reverse(), history, 2)).toEqual(shards);
});

it("adjusts estimates when the live file gains tests and rejects duplicate coverage", () => {
  expect(
    balanceFiles(
      [{ file: "a", tests: 3 }],
      { a: { tests: 2, durationMs: 20000 } },
      1,
    )[0].durationMs,
  ).toBe(30000);
  expect(() =>
    balanceFiles(
      [
        { file: "a", tests: 1 },
        { file: "a", tests: 2 },
      ],
      {},
      2,
    ),
  ).toThrow(/Duplicate/);
  expect(() => balanceFiles([], {}, 0)).toThrow(/positive integer/);
});

it("collects nested suites and only the selected project from fresh discovery or completed results", () => {
  const report = {
    suites: [
      {
        suites: [
          {
            specs: [
              {
                file: "look.spec.ts",
                tests: [
                  { projectName: "main", results: [{ duration: 10 }] },
                  { projectName: "heavy", results: [{ duration: 900 }] },
                  { projectName: "main" },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  expect(fileTimings(report, "main")).toEqual({
    "look.spec.ts": { tests: 2, durationMs: 10 },
  });
});
