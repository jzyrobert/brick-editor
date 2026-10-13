#!/usr/bin/env node
// Summarise immutable runs and optional post-freeze blinded assessments.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { visualContrasts, type Score } from "./spatial-benchmark/analysis";
import { verifyFile } from "./spatial-benchmark/sandbox";
import { hash } from "./spatial-benchmark/part-reference";
export async function main(argv: string[]) {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (
      !["--runs", "--evaluation", "--out"].includes(argv[i]) ||
      !argv[i + 1] ||
      flags.has(argv[i])
    )
      throw new Error("Report takes --runs, optional --evaluation, --out");
    flags.set(argv[i], argv[i + 1]);
  }
  if (!flags.has("--runs") || !flags.has("--out"))
    throw new Error("Runs and output required");
  const runs = resolve(flags.get("--runs")!);
  const manifest = JSON.parse(
    await readFile(join(runs, "manifest.json"), "utf8"),
  );
  const resultBytes = await readFile(join(runs, "results.json"));
  const results = JSON.parse(resultBytes.toString());
  const mapping = flags.has("--evaluation")
    ? JSON.parse(
        await readFile(
          join(resolve(flags.get("--evaluation")!), "private-mapping.json"),
          "utf8",
        ),
      )
    : [];
  const assessments = flags.has("--evaluation")
    ? JSON.parse(
        await readFile(
          join(resolve(flags.get("--evaluation")!), "blind-scores.json"),
          "utf8",
        ),
      )
    : [];
  const rows: ({
    condition: string;
    status: string;
    infoCalls: number;
    visualTotal: number | null;
  } & Record<string, unknown>)[] = [];
  const visual: Score[] = [];
  for (const run of results.results) {
    for (const [file, sha] of Object.entries(run.files)) {
      if (!["submission.txt", "compilation.json", "build.mpd"].includes(file))
        throw new Error("Invalid frozen file");
      await verifyFile(join(runs, run.caseId, file), String(sha));
    }
    const task = manifest.tasks.find((t: { id: string }) =>
      run.caseId.startsWith(t.id + "--"),
    );
    const suffix = run.caseId.slice(task.id.length + 2);
    const condition = suffix.slice(0, suffix.lastIndexOf("--"));
    const compilation = run.files["compilation.json"]
      ? JSON.parse(
          await readFile(join(runs, run.caseId, "compilation.json"), "utf8"),
        )
      : null;
    const report = compilation?.report;
    const audit = (
      await readFile(join(runs, run.caseId, "audit.jsonl"), "utf8")
    )
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((s) => JSON.parse(s));
    const inspections = audit.filter((r) => r.kind === "part_info");
    const native = join(runs, run.caseId + "--transport", "native");
    const wire = (await readFile(join(native, "transport.jsonl"), "utf8"))
      .split("\n")
      .filter(Boolean)
      .map((s) => JSON.parse(s));
    const terminals = wire.filter(
      (r) =>
        r.kind === "model-stream-event" &&
        ["response.completed", "response.incomplete"].includes(r.payload.type),
    );
    const outputBudgetFailure = terminals.some(
      (r) =>
        r.payload.response?.incomplete_details?.reason === "max_output_tokens",
    );
    const usage: Record<string, number> = {};
    let usageRecords = 0;
    for (const file of await readdir(native))
      if (/^turn-\d+\.jsonl$/.test(file)) {
        for (const line of (await readFile(join(native, file), "utf8"))
          .split("\n")
          .filter(Boolean)) {
          const event = JSON.parse(line);
          if (event.type === "turn.completed" && event.usage) {
            usageRecords++;
            for (const [key, value] of Object.entries(event.usage))
              if (typeof value === "number")
                usage[key] = (usage[key] ?? 0) + value;
          }
        }
      }
    const streamUsage = terminals.flatMap((r) =>
      r.payload.response?.usage ? [r.payload.response.usage] : [],
    );
    if (streamUsage.length) {
      for (const key of Object.keys(usage)) delete usage[key];
      usageRecords = streamUsage.length;
      for (const u of streamUsage)
        for (const [key, value] of Object.entries({
          input_tokens: u.input_tokens,
          output_tokens: u.output_tokens,
          cached_input_tokens: u.input_tokens_details?.cached_tokens,
          cache_write_input_tokens: u.input_tokens_details?.cache_write_tokens,
          reasoning_output_tokens: u.output_tokens_details?.reasoning_tokens,
        }))
          if (typeof value === "number") usage[key] = (usage[key] ?? 0) + value;
    }
    const anonymous = mapping.find(
      (r: { caseId: string }) => r.caseId === run.caseId,
    );
    const assessment = anonymous
      ? assessments.find((r: { id: string }) => r.id === anonymous.id)
      : null;
    const total =
      assessment?.status === "assessed"
        ? Object.values(
            assessment.assessment.scores as Record<string, number>,
          ).reduce((a, b) => a + b, 0)
        : null;
    if (total !== null) visual.push({ task: task.id, condition, total });
    rows.push({
      caseId: run.caseId,
      task: task.id,
      condition,
      status: outputBudgetFailure ? "model-failure" : run.status,
      originalFrozenStatus: run.status,
      failureCategory: outputBudgetFailure ? "output-token-budget" : null,
      files: run.files,
      compilerAccepted: report?.ok ?? false,
      stats: report?.stats ?? null,
      construction: report?.check ?? null,
      problems: report?.problems ?? null,
      used: run.used,
      infoCalls: inspections.length,
      infoResponseBytes: inspections.reduce(
        (a, r) => a + (r.payload.bytes ?? 0),
        0,
      ),
      selectedFactCoverage: run.referenceCoverage ?? null,
      providerUsage: usageRecords ? usage : null,
      usageRecords,
      usageSource: streamUsage.length
        ? "Responses terminal events"
        : "native completed turns",
      providerRequestAttempts: wire.filter(
        (r) => r.kind === "effective-model-request",
      ).length,
      elapsedMs:
        run.quotaBefore && run.quotaAfter
          ? Date.parse(run.quotaAfter.checkedAt) -
            Date.parse(run.quotaBefore.checkedAt)
          : null,
      visualStatus: assessment?.status ?? "unevaluated",
      visualTotal: total,
      visualAssessment: assessment ?? null,
    });
  }
  const conditions = manifest.conditions.map((c: { id: string }) => {
    const values = rows.filter((r) => r.condition === c.id);
    const scores = values.flatMap((r) =>
      r.visualTotal === null ? [] : [r.visualTotal],
    );
    return {
      id: c.id,
      scheduled: manifest.tasks.length * manifest.repetitions,
      retained: values.length,
      submitted: values.filter((r) => r.status === "submitted").length,
      infrastructureFailures: values.filter(
        (r) => r.status === "infrastructure-failure",
      ).length,
      modelFailures: values.filter((r) => r.status === "model-failure").length,
      inspectionRuns: values.filter((r) => r.infoCalls > 0).length,
      infoCalls: values.reduce((a, r) => a + r.infoCalls, 0),
      visualAssessed: scores.length,
      visualMean24: scores.length
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : null,
    };
  });
  await writeFile(
    resolve(flags.get("--out")!),
    JSON.stringify(
      {
        version: "spatial-pilot-report/1",
        model: manifest.model,
        planned: results.planned,
        retained: rows.length,
        resultFileSha256: hash(resultBytes),
        conditions,
        visualContrasts: visualContrasts(visual),
        rows,
        limitations: [
          `One model family; fixed development briefs; ${manifest.repetitions} scheduled repetitions per condition.`,
          "One automated reviewer; no independent human agreement measured.",
          "Compiler acceptance and detected contacts do not establish physical buildability.",
          "Availability and returned facts are recorded; successful use is not inferred from retrieval.",
          "Token fields retain native meanings; unavailable usage is null. Account quota includes other activity.",
          "Views are not independent builds; failures and missing evaluations are retained.",
        ],
      },
      null,
      2,
    ) + "\n",
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main(process.argv.slice(2)).catch((e) => {
    console.error(String(e.message));
    process.exitCode = 1;
  });
