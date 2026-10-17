#!/usr/bin/env node
// Convert frozen agy runs into the existing content-addressed gallery format.
// No model calls, source repairs or generation feedback. Renders are final only.
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import {
  prepare,
  renderAll,
  publishSql,
  sqlValue,
  type Candidate,
} from "./gallery-publish";
import { hash, json } from "./spatial-benchmark/part-reference";
import { validateManifest, type Manifest } from "./spatial-benchmark/manifest";
import { validateAgyModel } from "./spatial-benchmark/agy-channel";
import {
  decodeGalleryIndex,
  galleryAgentId,
  galleryAgentName,
  GALLERY_ORIGIN,
  type GalleryBuild,
  type GalleryRenderKey,
} from "../src/catalog/gallery-index";
import { verifyBundle } from "./publish-gallery-bundle";

const GENERATION = "e-reference-v2-20261014";
const read = async (p: string) => JSON.parse(await readFile(p, "utf8"));
type Run = {
  caseId: string;
  status: string;
  failure?: string;
  used: { repairs: number };
  seconds: number;
  files: Record<string, string>;
  referenceCoverage?: unknown;
};
export async function main(argv: string[]) {
  if (argv.length !== 4 || argv[0] !== "--runs" || argv[2] !== "--out")
    throw new Error(
      "Usage: prepare-spatial-gallery.ts --runs RUN1,RUN2 --out EMPTY_DIR",
    );
  const out = resolve(argv[3]);
  await mkdir(out, { recursive: true });
  assert.equal(
    (await readdir(out)).length,
    0,
    "Publication output must be fresh",
  );
  const response = await fetch(`${GALLERY_ORIGIN}/index.json`, {
    cache: "no-cache",
  });
  assert(response.ok, "Cannot read live gallery baseline");
  const beforeBytes = new Uint8Array(await response.arrayBuffer());
  const before = decodeGalleryIndex(
    JSON.parse(new TextDecoder().decode(beforeBytes)),
  );
  const index = structuredClone(before);
  const generation = index.generations?.find((g) => g.id === GENERATION);
  assert(generation, "Corrected-reference generation missing from baseline");
  await writeFile(join(out, "before-index.json"), beforeBytes);
  const prepared: Awaited<ReturnType<typeof prepare>>[] = [];
  const provenance: {
    folder: string;
    generation: string;
    promptSha256: string;
    scriptSha256: string;
    images: number;
  }[] = [];
  const outcomes: unknown[] = [];
  const seen = new Set<string>();
  for (const root of argv[1].split(",").map((p) => resolve(p))) {
    const manifest = validateManifest(
      await read(join(root, "manifest.json")),
    ) as Manifest;
    validateAgyModel(manifest.model);
    const preflight = await read(join(root, "preflight.json"));
    const runs: Run[] = (await read(join(root, "results.json"))).results;
    for (const run of runs) {
      const unique = manifest.model.id + "/" + run.caseId;
      assert(!seen.has(unique), `Duplicate case: ${unique}`);
      seen.add(unique);
      const task = manifest.tasks.find((t) =>
        run.caseId.startsWith(t.id + "--"),
      );
      assert(task, "Unscheduled result");
      const dir = join(root, run.caseId);
      for (const [file, sha] of Object.entries(run.files))
        assert.equal(
          hash(await readFile(join(dir, file))),
          sha,
          `Frozen file changed: ${file}`,
        );
      outcomes.push({ model: manifest.model, ...run });
      if (run.status !== "submitted") continue;
      const compilation = await read(join(dir, "compilation.json"));
      assert(
        compilation.script && compilation.report.ok,
        "Accepted source lacks valid compilation",
      );
      const prompt = before.prompts.find(
        (p) => p.brief === task.brief && p.targetParts === task.targetParts,
      );
      assert(prompt, `Existing gallery prompt missing: ${task.id}`);
      const shortModel = manifest.model.id.includes("argon")
        ? "argon"
        : "flash";
      const label = `${shortModel}-${task.id}`;
      const inputDir = join(out, "inputs", label);
      await mkdir(inputDir, { recursive: true });
      const scriptBytes = JSON.stringify(compilation.script, null, 2) + "\n";
      const filledPrompt = preflight.inputs.find(
        (i: { caseId: string }) => i.caseId === run.caseId,
      )?.prompt;
      assert(typeof filledPrompt === "string");
      await writeFile(join(inputDir, "build.json"), scriptBytes);
      await writeFile(join(inputDir, "prompt.md"), filledPrompt);
      provenance.push({
        folder: relative(process.cwd(), inputDir).replaceAll("\\", "/"),
        generation: GENERATION,
        promptSha256: hash(filledPrompt),
        scriptSha256: hash(scriptBytes),
        images: 0,
      });
      const native = join(root, run.caseId + "--transport");
      let output = 0;
      for (const f of (await readdir(native)).filter((f) =>
        /^turn-\d+\.result\.json$/.test(f),
      ))
        output = Math.max(
          output,
          (await read(join(native, f))).cumulativeOutputTokens,
        );
      const result = {
        model: manifest.model.id,
        runner: "agy",
        effort: manifest.model.effort,
        accepted: true,
        targetParts: task.targetParts,
        parts: compilation.report.stats.parts,
        seconds: run.seconds,
        attemptsUsed: 1 + run.used.repairs,
        tokens: { output },
        benchmark: {
          transport: preflight.transport,
          observationPolicy: "blind-mechanical",
          factsVersion: manifest.factsVersion,
          used: run.used,
          referenceCoverage: run.referenceCoverage,
          frozenFiles: run.files,
          serverOutputTokenCap: preflight.serverOutputTokenCap,
        },
      };
      await writeFile(
        join(inputDir, "result.json"),
        JSON.stringify(result, null, 2) + "\n",
      );
      const candidate: Candidate = {
        label,
        scriptPath: join(inputDir, "build.json"),
        brief: task.brief,
        targetParts: task.targetParts,
        promptId: prompt.id,
        promptName: prompt.name,
        runner: "agy",
        model: manifest.model.id,
        effort: manifest.model.effort,
        agentId: galleryAgentId(
          "agy",
          manifest.model.id,
          manifest.model.effort,
        ),
        agentName: galleryAgentName(manifest.model.id, manifest.model.effort),
        source: `gallery-reference-v2-agy-${label}`,
        generation: GENERATION,
        result,
      };
      const build = await prepare(candidate);
      assert.equal(
        build.mpd.sha,
        run.files["build.mpd"],
        `Publication changed frozen MPD: ${label}`,
      );
      assert(
        !before.builds.some((b) => b.id === build.id),
        "Build already published",
      );
      prepared.push(build);
      console.log(
        json({ event: "prepared", label, id: build.id, parts: build.parts }),
      );
    }
  }
  assert(prepared.length, "No accepted builds to publish");
  const renders = await renderAll(prepared);
  const files: {
    key: string;
    sha256: string;
    bytes: number;
    contentType: string;
  }[] = [];
  const put = async (key: string, bytes: Uint8Array, type: string) => {
    await mkdir(resolve(out, key, ".."), { recursive: true });
    await writeFile(join(out, key), bytes);
    if (!files.some((f) => f.key === key))
      files.push({
        key,
        sha256: hash(bytes),
        bytes: bytes.length,
        contentType: type,
      });
  };
  const now = Math.floor(Date.now() / 1000);
  const completed = [];
  for (const b of prepared) {
    const views = renders.get(b.id)!;
    assert(views, "Missing final renders");
    const renderHashes = {} as Record<GalleryRenderKey, string>;
    for (const [view, bytes] of Object.entries(views)) {
      const sha = hash(bytes);
      renderHashes[view as GalleryRenderKey] = sha;
      await put(`r/${sha}.webp`, bytes, "image/webp");
    }
    await put(`b/${b.mpd.sha}.mpd.gz`, b.mpd.gz, "application/gzip");
    await put(`s/${b.script.sha}.json`, b.script.bytes, "application/json");
    await put(`p/${b.report.sha}.json`, b.report.bytes, "application/json");
    completed.push({ ...b, renders: renderHashes });
    const c = b.candidate,
      r = c.result!;
    const entry: GalleryBuild = {
      id: b.id,
      prompt: c.promptId,
      agent: c.agentId,
      title: b.title,
      mpd: b.mpd.sha,
      mpdBytes: b.mpd.bytes,
      script: b.script.sha,
      report: b.report.sha,
      renders: renderHashes,
      parts: b.parts,
      warnings: b.warnings,
      attempts: r.attemptsUsed,
      seconds: r.seconds,
      outputTokens: r.tokens?.output,
      source: c.source,
      generation: GENERATION,
      library: b.library,
      created: new Date(now * 1000).toISOString().replace(/\.000Z$/, "Z"),
    };
    index.builds.push(JSON.parse(JSON.stringify(entry)));
    if (!index.agents.some((a) => a.id === c.agentId))
      index.agents.push({
        id: c.agentId,
        name: c.agentName,
        model: galleryAgentName(c.model),
        effort: c.effort,
      });
  }
  const description =
    generation.description +
    ` Gemini 3.8 Flash/high and Gemini 4 Argon/high were run through native agy on 17 October 2026: ${prepared.length} accepted builds from ${outcomes.length} completed cases. Inputs are fresh and render-blind; the native CLI cannot set a server output-token cap, so reported per-turn output is checked after completion. Failures remain archived.`;
  generation.description = description;
  index.generated = new Date(now * 1000).toISOString().replace(/\.000Z$/, "Z");
  index.builds.sort(
    (a, b) => b.created.localeCompare(a.created) || a.id.localeCompare(b.id),
  );
  index.agents.sort((a, b) => a.id.localeCompare(b.id));
  const sql =
    publishSql(completed, now) +
    `UPDATE generations SET description = ${sqlValue(description)} WHERE id = ${sqlValue(GENERATION)};\n`;
  const indexBytes = JSON.stringify(index, null, 2) + "\n";
  await writeFile(join(out, "publish.sql"), sql);
  await writeFile(join(out, "index.json"), indexBytes);
  await writeFile(
    join(out, "outcomes.json"),
    JSON.stringify(outcomes, null, 2) + "\n",
  );
  await writeFile(
    join(out, "manifest.json"),
    JSON.stringify(
      {
        v: 3,
        beforeIndexSha256: hash(beforeBytes),
        indexSha256: hash(indexBytes),
        defaultGeneration: index.generations!.find((g) => g.default)!.id,
        generations: index.generations!.map((g) => ({
          id: g.id,
          builds: index.builds.filter((b) => b.generation === g.id).length,
        })),
        inputs: provenance,
        before: before.builds.map((b) => b.id),
        after: index.builds.map((b) => b.id),
        files,
        sqlSha256: hash(sql),
      },
      null,
      2,
    ) + "\n",
  );
  verifyBundle(out);
  console.log(
    json({
      event: "publication-prepared",
      accepted: prepared.length,
      total: index.builds.length,
      files: files.length,
    }),
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main(process.argv.slice(2)).catch((e) => {
    console.error((e as Error).stack);
    process.exitCode = 1;
  });
