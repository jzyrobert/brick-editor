#!/usr/bin/env node
// Post-freeze renderer and blinded reviewer. Never passed a generation channel.
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { importLDraw } from "../src/ldraw/io";
import { registerFullLibraryFromDisk } from "./full-library-node";
import { viewCamera, type BuildView } from "../src/build-script/views";
import { hash, json } from "./spatial-benchmark/part-reference";
import { verifyFile, ROOT } from "./spatial-benchmark/sandbox";
import { codexChannel } from "./spatial-benchmark/codex-channel";
import { reviewEligible } from "./spatial-benchmark/analysis";
import {
  readCodexQuota,
  quotaAllowsNext,
} from "./spatial-benchmark/codex-quota";
import { withHeadlessPage } from "./headless";
const AXES = [
  "recognition",
  "proportions",
  "composition",
  "contours",
  "fidelity",
  "multi-view consistency",
];
export async function main(argv: string[]) {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (
      !["--runs", "--protocol", "--out", "--mode"].includes(argv[i]) ||
      !argv[i + 1]
    )
      throw new Error(
        "Evaluator takes --runs, --protocol, --out, --mode render|review",
      );
    flags.set(argv[i], argv[i + 1]);
  }
  if (
    ["--runs", "--protocol", "--out", "--mode"].some(
      (key) => !flags.has(key),
    ) ||
    !["render", "review"].includes(flags.get("--mode")!)
  )
    throw new Error("All evaluator flags and a valid mode are required");
  const runs = resolve(flags.get("--runs")!),
    out = resolve(flags.get("--out")!),
    protocol = JSON.parse(
      await readFile(resolve(flags.get("--protocol")!), "utf8"),
    ),
    mode = flags.get("--mode");
  reviewEligible("submitted", protocol.scoreEligibility);
  const manifest = JSON.parse(
      await readFile(join(runs, "manifest.json"), "utf8"),
    ),
    status = JSON.parse(await readFile(join(runs, "run-status.json"), "utf8"));
  if (status.completed !== status.planned && !status.stopReason)
    throw new Error(
      "Generation must finish or stop at a recorded boundary before evaluation",
    );
  for (const [file, sha] of Object.entries(protocol.sourceHashes))
    await verifyFile(join(ROOT, file), String(sha));
  const results = JSON.parse(
    await readFile(join(runs, "results.json"), "utf8"),
  ).results;
  const ordered = [...results].sort((a, b) =>
    hash("blind-presentation-v1:" + a.caseId).localeCompare(
      hash("blind-presentation-v1:" + b.caseId),
    ),
  );
  if (mode === "render") {
    await mkdir(out, { recursive: false });
    await writeFile(
      join(out, "protocol.json"),
      JSON.stringify(protocol, null, 2) + "\n",
    );
    const mapping = [];
    registerFullLibraryFromDisk();
    for (let index = 0; index < ordered.length; index++) {
      const run = ordered[index],
        id = `candidate-${String(index + 1).padStart(3, "0")}`,
        source = join(runs, run.caseId),
        dir = join(out, id);
      await mkdir(dir);
      for (const [file, sha] of Object.entries(run.files))
        await verifyFile(join(source, file), String(sha));
      const task = manifest.tasks.find((t: { id: string; brief: string }) =>
        run.caseId.startsWith(t.id + "--"),
      );
      const row = {
        id,
        caseId: run.caseId,
        brief: task.brief,
        task: task.id,
        status: run.status,
        images: [] as { file: string; sha256: string; view: string }[],
        renderFailure: null as string | null,
        cameras: [] as {
          view: BuildView;
          camera: ReturnType<typeof viewCamera>;
        }[],
      };
      try {
        if (run.files["build.mpd"]) {
          const compilation = JSON.parse(
              await readFile(join(source, "compilation.json"), "utf8"),
            ),
            ldraw = await readFile(join(source, "build.mpd"), "utf8");
          const project = importLDraw(ldraw, "anonymous.mpd");
          const cameras = protocol.views.map((view: BuildView) => ({
            view,
            camera: viewCamera(
              compilation.report.bounds.ldu,
              view,
              protocol.width / protocol.height,
            ),
          }));
          row.cameras = cameras;
          const shots = await withHeadlessPage(project, (page) =>
            page.evaluate(
              async ({ cameras, width, height, look, backdrop }) => {
                const api = window.brickEditor!,
                  shots: { view: string; bytes: number[] }[] = [];
                for (const c of cameras) {
                  await api.camera.set(c.camera);
                  const q = await api.query();
                  const image = await api.render.image({
                    revision: q.revision,
                    width,
                    height,
                    format: "png",
                    visibility: { mode: "all" },
                    background: { type: "solid", color: "#ffffff" },
                    quality: "photo",
                    strict: true,
                    look,
                    backdrop,
                  });
                  shots.push({
                    view: c.view,
                    bytes: Array.from(
                      new Uint8Array(await image.blob.arrayBuffer()),
                    ),
                  });
                }
                return shots;
              },
              {
                cameras,
                width: protocol.width,
                height: protocol.height,
                look: protocol.look,
                backdrop: protocol.backdrop,
              },
            ),
          );
          for (let i = 0; i < shots.length; i++) {
            const file = `image-${i}.png`,
              bytes = Buffer.from(shots[i].bytes);
            await writeFile(join(dir, file), bytes);
            row.images.push({ file, sha256: hash(bytes), view: shots[i].view });
          }
        }
      } catch (e) {
        row.renderFailure = String((e as Error).message);
      }
      mapping.push(row);
      await writeFile(
        join(out, "private-mapping.json"),
        JSON.stringify(mapping, null, 2) + "\n",
      );
      console.log(json({ rendered: id, images: row.images.length }));
    }
    return;
  }
  if (mode !== "review") throw new Error("Unknown evaluator mode");
  const mapping = JSON.parse(
    await readFile(join(out, "private-mapping.json"), "utf8"),
  );
  // Archive the actual review implementation before inspecting any candidate.
  const sources = [
    "scripts/spatial-benchmark-evaluate.ts",
    "scripts/spatial-benchmark/analysis.ts",
    "scripts/spatial-benchmark/codex-channel.ts",
    "scripts/spatial-benchmark/codex-quota.ts",
    "scripts/spatial-benchmark/codex-bridge.mjs",
  ];
  const sourceHashes: Record<string, string> = {};
  await mkdir(join(out, "review-sources"));
  for (const file of sources) {
    const bytes = await readFile(join(ROOT, file));
    sourceHashes[file] = hash(bytes);
    await writeFile(
      join(out, "review-sources", file.split("/").at(-1)!),
      bytes,
    );
  }
  await writeFile(
    join(out, "review-protocol.json"),
    json({
      version: "spatial-blind-review/1",
      sourceHashes,
      protocolSha256: hash(json(protocol)),
      reviewer: { model: "gpt-6.1-sol", effort: "high" },
      imagesReturnToGeneration: false,
      automatedReviewers: 1,
    }) + "\n",
  );
  const scores = [];
  let largestDrop = 0;
  for (const row of mapping) {
    if (!reviewEligible(row.status, protocol.scoreEligibility)) {
      scores.push({ id: row.id, status: "unevaluated-invalid-submission" });
      await writeFile(
        join(out, "blind-scores.json"),
        JSON.stringify(scores, null, 2) + "\n",
      );
      continue;
    }
    const quota = await readCodexQuota();
    if (!quotaAllowsNext(quota, largestDrop)) {
      console.log(
        json({ stop: "quota", weeklyRemaining: quota.weeklyRemaining }),
      );
      break;
    }
    if (row.images.length !== 4) {
      scores.push({ id: row.id, status: "unevaluated-no-render" });
      await writeFile(
        join(out, "blind-scores.json"),
        JSON.stringify(scores, null, 2) + "\n",
      );
      continue;
    }
    const dir = join(out, row.id),
      review = join(dir, "review");
    await mkdir(review);
    const generation = join(review, "generation");
    await mkdir(generation);
    const images = [];
    for (let i = 0; i < row.images.length; i++) {
      const image = row.images[i];
      await verifyFile(join(dir, image.file), image.sha256);
      const file = join(generation, `image-${i}.png`);
      await copyFile(join(dir, image.file), file);
      images.push({ file, sha256: image.sha256 });
    }
    const adapter = await codexChannel({
      dir: review,
      evaluationImages: images,
      quota: readCodexQuota,
      notify: async (q) =>
        writeFile(
          join(review, `quota-${q.checkedAt.replaceAll(":", "-")}.json`),
          JSON.stringify(q, null, 2),
        ),
    });
    const model = {
      id: "gpt-6.1-sol",
      effort: "high",
      sampling: { temperature: null, topP: null, seed: null },
    };
    const first =
      'This is a visual evaluation of one anonymous LEGO build shown from four fixed views. No generating model, source, condition, title or intended subject is supplied. Identify what it depicts from the images alone. Return ONLY JSON {"guesses":["..."],"confidence":0.0,"visible_features":["..."]}. Confidence is 0 to 1. Do not infer physical buildability.';
    try {
      const recognition = await adapter.channel({
        messages: [{ role: "user", content: first }],
        model,
        maxOutputTokens: 8000,
        signal: AbortSignal.timeout(600000),
      });
      await writeFile(join(review, "recognition.txt"), recognition);
      const recognitionData = JSON.parse(recognition);
      if (
        !Array.isArray(recognitionData.guesses) ||
        !recognitionData.guesses.every((v: unknown) => typeof v === "string") ||
        typeof recognitionData.confidence !== "number" ||
        !Number.isFinite(recognitionData.confidence) ||
        recognitionData.confidence < 0 ||
        recognitionData.confidence > 1
      )
        throw new Error("Invalid recognition result");
      const second = `The exact requested brief is: ${json(row.brief)}. Retain your original unlabelled recognition judgement. Score these axes independently from 0 to 4: ${json(AXES)}. Anchors: 0 absent/severely wrong; 1 weak with substantial defects; 2 partly successful with clear defects; 3 clear/coherent with minor defects; 4 strong/coherent across views. Exposed studs, symmetry, angular forms and smooth surfaces are valid. Do not reward piece count or presume mechanically sound connections. Return ONLY JSON {"scores":{${AXES.map((a) => json(a) + ":0").join(",")}},"observations":["concrete image evidence"],"limitations":["..."]}.`;
      const assessment = await adapter.channel({
        messages: [
          { role: "user", content: first },
          { role: "assistant", content: recognition },
          { role: "user", content: second },
        ],
        model,
        maxOutputTokens: 12000,
        signal: AbortSignal.timeout(600000),
      });
      await writeFile(join(review, "assessment.txt"), assessment);
      const data = JSON.parse(assessment);
      if (
        !data.scores ||
        Object.keys(data.scores).length !== AXES.length ||
        AXES.some(
          (a) =>
            !Number.isInteger(data.scores?.[a]) ||
            data.scores[a] < 0 ||
            data.scores[a] > 4,
        )
      )
        throw new Error("Invalid assessment scores");
      const after = await readCodexQuota();
      largestDrop = Math.max(
        largestDrop,
        quota.weeklyRemaining - after.weeklyRemaining,
      );
      scores.push({
        id: row.id,
        status: "assessed",
        recognition: recognitionData,
        assessment: data,
        weeklyRemaining: after.weeklyRemaining,
      });
      console.log(
        json({
          reviewed: row.id,
          count: scores.length,
          weeklyRemaining: after.weeklyRemaining,
        }),
      );
    } catch (e) {
      scores.push({
        id: row.id,
        status: "review-failure",
        reason: String((e as Error).message),
      });
    } finally {
      await adapter.close();
    }
    await writeFile(
      join(out, "blind-scores.json"),
      JSON.stringify(scores, null, 2) + "\n",
    );
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main(process.argv.slice(2)).catch((e) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  });
