export type FileTiming = { tests: number; durationMs: number };
export type ShardFile = { file: string; tests: number };
export type JsonSuite = {
  suites?: JsonSuite[];
  specs?: {
    file: string;
    tests: {
      projectName: string;
      results?: { duration: number }[];
    }[];
  }[];
};

/** Read fresh discovery or a merged Playwright JSON report. Only observed
 * files determine coverage; historical timings influence scheduling alone. */
export function fileTimings(report: JsonSuite, project: string) {
  const files: Record<string, FileTiming> = {};
  const visit = (suite: JsonSuite) => {
    for (const spec of suite.specs ?? [])
      for (const test of spec.tests)
        if (test.projectName === project) {
          const row = (files[spec.file] ??= { tests: 0, durationMs: 0 });
          row.tests++;
          row.durationMs += (test.results ?? []).reduce(
            (sum, result) => sum + result.duration,
            0,
          );
        }
    for (const child of suite.suites ?? []) visit(child);
  };
  visit(report);
  return files;
}

/** Longest estimated file first, placed into the lightest shard. Keep whole
 * files together so future serial describes/beforeAll fixtures stay together. */
export function balanceFiles(
  files: ShardFile[],
  history: Record<string, FileTiming>,
  shardCount: number,
) {
  if (!Number.isInteger(shardCount) || shardCount < 1)
    throw new Error("Shard count must be a positive integer");
  if (new Set(files.map((f) => f.file)).size !== files.length)
    throw new Error("Duplicate discovered test file");
  const shards = Array.from({ length: shardCount }, () => ({
    files: [] as string[],
    tests: 0,
    durationMs: 0,
  }));
  const weighted = files.map((f) => {
    const old = history[f.file];
    const perTest =
      old && old.tests > 0 && old.durationMs > 0
        ? old.durationMs / old.tests
        : 15000;
    return { ...f, durationMs: Math.max(1, f.tests * perTest) };
  });
  weighted.sort(
    (a, b) =>
      b.durationMs - a.durationMs ||
      (a.file < b.file ? -1 : a.file > b.file ? 1 : 0),
  );
  for (const file of weighted) {
    const shard = shards.reduce((a, b) =>
      b.durationMs < a.durationMs ? b : a,
    );
    shard.files.push(file.file);
    shard.tests += file.tests;
    shard.durationMs += file.durationMs;
  }
  for (const shard of shards) shard.files.sort();
  return shards;
}
