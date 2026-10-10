#!/usr/bin/env node
// Reproducible exploratory comparisons on the six current gallery briefs. No publishing.
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

const repo = fileURLToPath(new URL("../", import.meta.url));
const briefs = {
  pelican: ["a pelican riding a bicycle", 800],
  piplup: ["piplup", 1000],
  temple: ["a japanese buddhist temple", 2000],
  destroyer: ["imperial star destroyer", 5000],
  dragon: ["a dragon", 1000],
  ewok: ["ewok inspired version of the classic 1970s lego space sets", 3000],
} as const;
const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(`npx tsx scripts/evaluate-build-style.ts
  [--cases object-pelican,studied-pelican,object-piplup,studied-piplup]
  [--out .local/lego-study/runs] [--concurrency 1–4]
  [--model gpt-6.1-sol] (effort is always high)
  [--runner codex|claude] (default codex)
  [--revise-from directory --source-variant studied]
  [--revision-feedback text|images] (default text; images are historical only)
  [--reference-images a.png,b.png]
Variants: creative, object, studied, finished, contextual, economical. Subjects: pelican, piplup, temple,
destroyer, dragon, ewok. Default model is gpt-6.1-sol. No publishing.`);
  process.exit(0);
}
for (let i = 0; i < args.length; i += 2) {
  if (
    ![
      "--cases",
      "--out",
      "--concurrency",
      "--revise-from",
      "--source-variant",
      "--reference-images",
      "--revision-feedback",
      "--model",
      "--runner",
    ].includes(args[i]) ||
    !args[i + 1]
  )
    throw new Error(`Unknown or incomplete argument ${args[i]}; see --help`);
}
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1];
};
const reviseFrom = flag("revise-from", "");
const model = flag("model", "gpt-6.1-sol");
const runner = flag("runner", "codex");
if (!["codex", "claude"].includes(runner))
  throw new Error("--runner must be codex or claude");
const referenceImages = flag("reference-images", "");
const revisionFeedback = flag("revision-feedback", "text");
if (!["text", "images"].includes(revisionFeedback))
  throw new Error("--revision-feedback must be text or images");
if (referenceImages && reviseFrom)
  throw new Error("Choose references or a revision, not both");
if (runner === "claude" && (referenceImages || revisionFeedback === "images"))
  throw new Error("Claude study runs require text-only input");
const sourceVariant = flag("source-variant", "");
if (
  sourceVariant &&
  ![
    "object",
    "studied",
    "finished",
    "creative",
    "contextual",
    "economical",
    "original",
  ].includes(sourceVariant)
)
  throw new Error("Unknown --source-variant");
const out = resolve(flag("out", ".local/lego-study/runs"));
const cases = flag(
  "cases",
  "object-pelican,studied-pelican,object-piplup,studied-piplup",
)
  .split(",")
  .map((id) => {
    const [variant, subject] = id.split("-");
    if (
      id.split("-").length !== 2 ||
      ![
        "object",
        "studied",
        "finished",
        "creative",
        "contextual",
        "economical",
      ].includes(variant) ||
      !(subject in briefs)
    )
      throw new Error(`Unknown case ${id}`);
    const [brief, target] = briefs[subject as keyof typeof briefs];
    return { id, variant, subject, brief, target };
  });
if (
  cases.some((c) => c.variant === "economical") &&
  (referenceImages || revisionFeedback === "images")
)
  throw new Error("The economical experiment requires text-only input");
const concurrency = Number(flag("concurrency", "3"));
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4)
  throw new Error("--concurrency must be 1–4");
await mkdir(out, { recursive: true });
await writeFile(
  join(
    out,
    `plan-${createHash("sha256")
      .update(cases.map((c) => c.id).join(","))
      .digest("hex")
      .slice(0, 8)}.json`,
  ),
  JSON.stringify(
    {
      model,
      runner,
      effort: "high",
      concurrency,
      reviseFrom,
      referenceImages,
      sourceVariant,
      revisionFeedback,
      cases,
    },
    null,
    2,
  ) + "\n",
);
const queue = [...cases];
let failed = 0;
await Promise.all(
  Array.from({ length: Math.min(concurrency, cases.length) }, async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      const dir = join(out, c.id);
      await mkdir(dir, { recursive: true });
      const result = join(dir, "high/result.json");
      let previous;
      try {
        previous = JSON.parse(await readFile(result, "utf8"));
      } catch {
        /* no accepted result */
      }
      if (previous && (previous.model !== model || previous.runner !== runner))
        throw new Error(
          `Existing result uses ${previous.runner}/${previous.model}, requested ${runner}/${model}`,
        );
      if (previous?.accepted) {
        console.log(`SKIP accepted ${c.id}`);
        continue;
      }
      let requestArgs = ["--brief", c.brief];
      if (referenceImages) {
        const images = referenceImages.split(",").map((file) => resolve(file));
        const request = `${c.brief}

The attached images are public LDraw versions of official Creator birds,
used only as construction and surface-style references. They demonstrate
freestanding feet, coherent shaped head/beak/wing assemblies, selective
studs and compact internal structure. Build the requested subject afresh;
do not copy the reference birds' species, palette, proportions or exact model.
Preserve the requested subject's anatomy and characteristic silhouette.
Use available real shaping parts to make continuous skin instead of a
stepped voxel mass with a few curved decorations. Retain deliberate studs
where useful. Optional supports must be compact; no generic scenery slab.
`;
        const file = join(dir, "reference-request.md");
        await writeFile(file, request);
        await writeFile(
          join(dir, "reference.json"),
          JSON.stringify(
            await Promise.all(
              images.map(async (file) => ({
                file,
                sha256: createHash("sha256")
                  .update(await readFile(file))
                  .digest("hex"),
              })),
            ),
            null,
            2,
          ) + "\n",
        );
        requestArgs = ["--brief-file", file, "--images", images.join(",")];
      }
      if (reviseFrom) {
        const sourceRoot = resolve(
          reviseFrom,
          `${sourceVariant || c.variant}-${c.subject}`,
        );
        const parent = existsSync(join(sourceRoot, "high/build.js"))
          ? join(sourceRoot, "high")
          : sourceRoot;
        const source = await readFile(join(parent, "build.js"), "utf8");
        const images =
          revisionFeedback === "text"
            ? []
            : existsSync(join(parent, "views/build-iso.png"))
              ? ["iso", "front", "iso-back", "top"].map((view) =>
                  join(parent, "views", `build-${view}.png`),
                )
              : ["iso", "front", "iso-back"].map((view) =>
                  join(parent, `${view}.webp`),
                );
        const preservation = ["contextual", "economical"].includes(c.variant)
          ? `
The supplied draft's concept is preferred. Preserve its meaningful components,
distinctive palette, overall arrangement, theme and interactions. Improve the
construction of that concept; do not substitute a new type of model or simplify
away its setting. Internally list the features that must survive before editing.
Support decisions are separate from composition: a meaningful environment may
use local plate-built patches, paths and foundations, with independent coherent
modules where appropriate. Remove or reshape only generic ground/support mass
that is unnecessary, preserving terrain/water/routes that establish the scene.
Finish smooth manufactured surfaces while retaining intended natural texture.
`
          : "";
        // Every case gets the same critique, with no hand-authored coordinates.
        const request = `${c.brief}

This is a construction revision of an accepted draft, not a new concept contest.
${images.length ? `The attached images show the draft from three-quarter, front and back${images.length === 4 ? " and top" : ""}. Inspect the actual images before editing.` : "No images are supplied. Reason spatially from the source, coordinates and part metadata; no visual feedback is available during generation."}
Internally identify the three most important construction defects, then revise
the supplied source to address them.
Keep the subject recognizable and improve its existing concept. Judge its
silhouette, proportions, support footprint and surface construction in all
views. Remove unnecessary scenery slabs; keep compact supports only where
needed. Finish visible skin with coherent shaping parts and selective tiles;
retain purposeful texture and connection studs. A smooth staircase remains
a stepped silhouette, so improve the transitions rather than merely hiding
studs. Check the revised code for overlaps, colour availability and part count.
Do not add disconnected decorative parts just to approach the part target.
Reply through the same parts_search, check_build and brick.build protocols.
${preservation}

Accepted draft source:
\`\`\`js
${source}
\`\`\`
`;
        const file = join(dir, "revision-request.md");
        await writeFile(file, request);
        await writeFile(
          join(dir, "revision.json"),
          JSON.stringify(
            {
              parent,
              sourceSha256: createHash("sha256").update(source).digest("hex"),
              images,
              feedback: revisionFeedback,
            },
            null,
            2,
          ) + "\n",
        );
        requestArgs = ["--brief-file", file];
        if (images.length) requestArgs.push("--images", images.join(","));
      }
      const command = [
        join(repo, "node_modules/tsx/dist/cli.mjs"),
        join(repo, "scripts/one-shot-build.ts"),
        "--model",
        model,
        "--runner",
        runner,
        "--efforts",
        "high",
        "--attempts",
        "5",
        ...requestArgs,
        "--target-parts",
        String(c.target),
        "--prompt",
        `build-agent-${c.variant}.md`,
        "--reply-prompt",
        c.variant === "creative"
          ? "brick-build-legacy.md"
          : c.variant === "economical"
            ? "brick-build-economical.md"
            : "brick-build-object.md",
        "--parts-list",
        "on",
        "--search",
        "on",
        "--check",
        "on",
        "--views",
        "iso,front,iso-back,top",
        "--out",
        dir,
      ];
      console.log(`START ${c.id}`);
      const log: string[] = [];
      const code = await new Promise<number>((done) => {
        const child = spawn(process.execPath, command, {
          cwd: repo,
          env: { ...process.env, FORCE_COLOR: "0" },
          stdio: ["ignore", "pipe", "pipe"],
        });
        child.stdout.on("data", (d) => {
          log.push(String(d));
          process.stdout.write(d);
        });
        child.stderr.on("data", (d) => log.push(String(d)));
        child.on("error", (error) => {
          log.push(String(error));
          done(1);
        });
        child.on("close", (exit) => done(exit ?? 1));
      });
      await writeFile(join(dir, "run.log"), log.join(""));
      console.log(`FINISH ${c.id} exit=${code}`);
      if (code !== 0) failed++;
    }
  }),
);
if (failed) process.exitCode = 1;
