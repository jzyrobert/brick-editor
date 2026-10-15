#!/usr/bin/env node
// Combine ended execution phases without changing any frozen source or status.
import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { validateManifest } from "./spatial-benchmark/manifest";
import { hash, json } from "./spatial-benchmark/part-reference";
import { verifyFile } from "./spatial-benchmark/sandbox";
export async function main(argv: string[]) {
  const phases: string[] = [];
  let out: string | undefined;
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i + 1]) throw new Error("Pool requires --phase paths and --out");
    if (argv[i] === "--phase") phases.push(resolve(argv[i + 1]));
    else if (argv[i] === "--out" && !out) out = resolve(argv[i + 1]);
    else throw new Error("Unknown or duplicate pool flag");
  }
  if (!out || !phases.length)
    throw new Error("Pool requires phases and output");
  const seen = new Set<string>();
  const results: Record<string, unknown>[] = [];
  const provenance = [];
  let manifest: ReturnType<typeof validateManifest> | undefined;
  let reference: Record<string, unknown> | undefined;
  let lastQuota: unknown = null;
  // Validate the entire pool before copying anything or launching an evaluator.
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const m = validateManifest(
      JSON.parse(await readFile(join(phase, "manifest.json"), "utf8")),
    );
    const p = JSON.parse(await readFile(join(phase, "preflight.json"), "utf8"));
    const status = JSON.parse(
      await readFile(join(phase, "run-status.json"), "utf8"),
    );
    const bytes = await readFile(join(phase, "results.json"));
    const r = JSON.parse(bytes.toString());
    if (status.completed !== status.planned && !status.stopReason)
      throw new Error("A phase is still generating");
    if (status.completed !== r.results.length)
      throw new Error("Phase result count mismatch");
    if (
      manifest &&
      (hash(json(manifest)) !== hash(json(m)) ||
        hash(json(reference!.inputs)) !== hash(json(p.inputs)) ||
        reference!.compilerBundleSha256 !== p.compilerBundleSha256)
    )
      throw new Error("Pool changes inputs or compiler");
    manifest ??= m;
    reference ??= p;
    for (const run of r.results) {
      if (
        seen.has(run.caseId) ||
        !(reference!.runOrder as string[]).includes(run.caseId)
      )
        throw new Error("Repeated or unknown case in pool");
      seen.add(run.caseId);
      for (const [file, sha] of Object.entries(run.files)) {
        if (!["submission.txt", "compilation.json", "build.mpd"].includes(file))
          throw new Error("Invalid frozen file");
        await verifyFile(join(phase, run.caseId, file), String(sha));
      }
      results.push({
        ...run,
        executionPhase: i + 1,
        phaseTransport: r.version,
      });
    }
    lastQuota = r.lastQuota ?? lastQuota;
    provenance.push({
      phase,
      index: i + 1,
      resultsSha256: hash(bytes),
      status,
      sourceHashes: p.sourceHashes,
    });
  }
  await mkdir(out);
  await cp(join(phases[0], "compiler.mjs"), join(out, "compiler.mjs"));
  await cp(
    join(phases[0], "compiler.mjs.inputs.json"),
    join(out, "compiler.mjs.inputs.json"),
  );
  await writeFile(join(out, "manifest.json"), json(manifest) + "\n");
  await writeFile(
    join(out, "preflight.json"),
    json({ ...reference, pool: provenance }) + "\n",
  );
  for (let i = 0; i < phases.length; i++) {
    await cp(
      join(phases[i], "host-sources"),
      join(out, "phase-sources", String(i + 1)),
      { recursive: true },
    );
    for (const r of results.filter((r) => r.executionPhase === i + 1)) {
      const id = String(r.caseId);
      await cp(join(phases[i], id), join(out, id), { recursive: true });
      await cp(
        join(phases[i], id + "--transport"),
        join(out, id + "--transport"),
        { recursive: true },
      );
    }
  }
  const planned = (reference!.runOrder as string[]).length;
  await writeFile(
    join(out, "results.json"),
    json({
      version: "execution-phase-pool/1",
      planned,
      completed: results.length,
      results,
      lastQuota,
      experimentallyEvaluated: false,
    }) + "\n",
  );
  await writeFile(
    join(out, "run-status.json"),
    json({
      planned,
      completed: results.length,
      stopReason:
        results.length === planned
          ? null
          : "Ended phases pooled; unexecuted scheduled cases remain",
      lastQuota,
      experimentallyEvaluated: false,
    }) + "\n",
  );
  await writeFile(join(out, "pool-provenance.json"), json(provenance) + "\n");
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
