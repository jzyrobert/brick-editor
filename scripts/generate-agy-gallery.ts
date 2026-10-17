#!/usr/bin/env node
// Serial, resumable schedule of the six existing gallery briefs. Every new
// case gets a fresh directory/session; reuse is only for this same schedule's
// completed, hash-verified cases (including the initial Flash pilot).
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import {
  readAgyQuota,
  quotaGate,
  quotaDrop,
  type AgyQuota,
} from "./spatial-benchmark/agy-quota";
import { hash, json } from "./spatial-benchmark/part-reference";
import { validateManifest } from "./spatial-benchmark/manifest";
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const read = async (file: string) => JSON.parse(await readFile(file, "utf8"));
export function sameCompletedAgyManifest(actual: unknown, requested: unknown) {
  const a = validateManifest(actual),
    b = validateManifest(requested);
  // The native CLI never received this unenforceable server-cap setting.
  // Retain completed lower-budget cases when only that host guard is raised.
  return (
    a.budgets.maxOutputTokens <= b.budgets.maxOutputTokens &&
    a.budgets.totalMs <= b.budgets.totalMs &&
    isDeepStrictEqual(
      {
        ...a,
        budgets: {
          ...a.budgets,
          maxOutputTokens: b.budgets.maxOutputTokens,
          totalMs: b.budgets.totalMs,
        },
      },
      b,
    )
  );
}
export async function main(argv: string[]) {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (
      !["--out", "--pilot"].includes(argv[i]) ||
      !argv[i + 1] ||
      flags.has(argv[i])
    )
      throw new Error("Takes --out and optional --pilot");
    flags.set(argv[i], argv[i + 1]);
  }
  if (!flags.has("--out")) throw new Error("Explicit schedule output required");
  const out = resolve(flags.get("--out")!);
  await mkdir(out, { recursive: true });
  const completed: unknown[] = [],
    quotas: unknown[] = [],
    skipped: unknown[] = [];
  const largestDrop = { flash: 0, argon: 0 };
  const stoppedModels = new Map<string, string>();
  let stopReason: string | null = null;
  const save = () =>
    writeFile(
      join(out, "schedule.json"),
      JSON.stringify(
        {
          planned: 12,
          completed: completed.length,
          results: completed,
          quotas,
          largestDrop,
          skipped,
          stopReason,
        },
        null,
        2,
      ) + "\n",
    );
  for (const task of [
    "pelican",
    "piplup",
    "temple",
    "destroyer",
    "dragon",
    "ewok",
  ]) {
    for (const model of ["flash", "argon"] as const) {
      const caseId = task + "--reference-v2--1";
      const manifestPath = join(
        ROOT,
        "fixtures/spatial-benchmark/studies/gallery-reference-v2-agy",
        model + ".json",
      );
      const manifest = await read(manifestPath);
      const dir =
        model === "flash" && task === "pelican" && flags.has("--pilot")
          ? resolve(flags.get("--pilot")!)
          : join(out, `${model}-${task}`);
      if (stoppedModels.has(model) && !existsSync(dir)) {
        skipped.push({ model, task, reason: stoppedModels.get(model) });
        await save();
        continue;
      }
      if (existsSync(dir)) {
        if (!existsSync(join(dir, "results.json")))
          throw new Error(`Incomplete existing output: ${dir}`);
        const results = await read(join(dir, "results.json"));
        if (
          results.completed !== 1 ||
          results.results[0]?.caseId !== caseId ||
          !sameCompletedAgyManifest(
            await read(join(dir, "manifest.json")),
            manifest,
          )
        )
          throw new Error(`Existing case is incomplete or differs: ${dir}`);
      } else {
        let quota: AgyQuota;
        try {
          quota = await readAgyQuota();
        } catch (e) {
          stopReason = `Quota unavailable: ${(e as Error).message}`;
          await save();
          return;
        }
        const gate = quotaGate(quota, manifest.model.id, largestDrop[model]);
        quotas.push({ caseId, model, ...quota, gate });
        if (!gate.sufficient) {
          const reason = "Insufficient quota for next run plus reserve";
          stoppedModels.set(model, reason);
          skipped.push({ model, task, reason, gate });
          await save();
          console.log(json({ event: "model-quota-stop", model, gate }));
          continue;
        }
        await save();
        const code = await new Promise<number | null>((done, fail) => {
          const child = spawn(
            process.execPath,
            [
              join(ROOT, "node_modules/tsx/dist/cli.mjs"),
              join(ROOT, "scripts/spatial-benchmark-live-agy.ts"),
              "--manifest",
              manifestPath,
              "--out",
              dir,
              "--cases",
              caseId,
            ],
            {
              cwd: ROOT,
              env: process.env,
              stdio: ["ignore", "inherit", "inherit"],
              windowsHide: true,
            },
          );
          child.on("error", fail);
          child.on("close", done);
        });
        if (code !== 0) {
          stopReason = `Generation host exited ${code}`;
          await save();
          return;
        }
      }
      const runs = await read(join(dir, "results.json"));
      const result = runs.results[0];
      if (!result) {
        stopReason =
          (await read(join(dir, "run-status.json"))).stopReason ??
          "Run did not complete";
        await save();
        return;
      }
      for (const [file, sha] of Object.entries(result.files))
        if (hash(await readFile(join(dir, caseId, file))) !== sha)
          throw new Error(`Frozen artifact changed: ${dir}/${file}`);
      const readings = (await read(join(dir, "quota.json"))) as (AgyQuota & {
        phase: string;
      })[];
      const before = readings.find((q) => q.phase === "before"),
        after = readings.find((q) => q.phase === "after");
      if (!before || !after) {
        stopReason = "Missing per-run quota readings";
        await save();
        return;
      }
      largestDrop[model] = Math.max(
        largestDrop[model],
        quotaDrop(before, after, manifest.model.id),
      );
      completed.push({
        model,
        task,
        dir,
        status: result.status,
        failure: result.failure ?? null,
        seconds: result.seconds,
      });
      await save();
      if (
        model === "flash" &&
        task === "pelican" &&
        result.status !== "submitted"
      ) {
        stopReason = "Flash pilot did not produce an accepted build";
        await save();
        return;
      }
      if (
        completed.slice(-3).length === 3 &&
        completed
          .slice(-3)
          .every(
            (r) =>
              (r as { status: string }).status === "infrastructure-failure",
          )
      ) {
        stopReason = "Three consecutive infrastructure failures";
        await save();
        return;
      }
    }
  }
  if (skipped.length)
    stopReason =
      "Quota reserve reached for one or more models; other eligible cases completed";
  await save();
  console.log(
    json({
      event: "gallery-schedule-ended",
      completed: completed.length,
      skipped: skipped.length,
      stopReason,
    }),
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main(process.argv.slice(2)).catch((e) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  });
