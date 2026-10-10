#!/usr/bin/env node
// Publish an already reviewed gallery bundle; generation never runs in CI.
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isDeepStrictEqual } from "node:util";
import { join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";
import {
  decodeGalleryIndex,
  GALLERY_VIEWS,
  galleryAgentName,
  galleryIndexFromRows,
  type GalleryIndex,
  type GalleryRow,
} from "../src/catalog/gallery-index";
import { INDEX_QUERY } from "./gallery-publish";

type Manifest = {
  v?: 2;
  defaultGeneration?: string;
  generations?: { id: string; builds: number }[];
  indexSha256?: string;
  inputs?: {
    folder: string;
    generation: string;
    promptSha256: string;
    scriptSha256: string;
    images: number;
  }[];
  before: string[];
  after: string[];
  files: { key: string; sha256: string; bytes: number; contentType: string }[];
  sqlSha256: string;
};
const hash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const same = (a: string[], b: string[]) =>
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

/** The live database must match the reviewed data, not just its visible IDs. */
export function verifyLiveIndex(actual: GalleryIndex, reviewed: GalleryIndex) {
  const stable = (index: GalleryIndex) =>
    JSON.parse(JSON.stringify({ ...index, generated: "" }));
  if (!isDeepStrictEqual(stable(actual), stable(reviewed)))
    throw new Error("Live gallery metadata differs from the reviewed index");
}

export function verifyBundle(dir: string) {
  const manifest: Manifest = JSON.parse(
    readFileSync(join(dir, "manifest.json"), "utf8"),
  );
  const index = decodeGalleryIndex(
    JSON.parse(readFileSync(join(dir, "index.json"), "utf8")),
  );
  const history = manifest.v === 2;
  if (history) {
    if (
      hash(readFileSync(join(dir, "index.json"))) !== manifest.indexSha256 ||
      !same(
        index.builds.map((b) => b.id),
        manifest.after,
      ) ||
      new Set(manifest.after).size !== manifest.after.length ||
      ![...manifest.before, ...manifest.after].every((id) =>
        /^[0-9a-f]{12}$/.test(id),
      ) ||
      !manifest.before.every((id) => manifest.after.includes(id))
    )
      throw new Error("Unexpected gallery generation roster");
    const generations = index.generations ?? [];
    const featured = generations.filter((g) => g.default);
    if (
      featured.length !== 1 ||
      featured[0].id !== manifest.defaultGeneration ||
      !same(
        generations.map((g) => g.id),
        manifest.generations?.map((g) => g.id) ?? [],
      ) ||
      manifest.generations?.some(
        (g) =>
          !Number.isInteger(g.builds) ||
          g.builds < 1 ||
          index.builds.filter((b) => b.generation === g.id).length !== g.builds,
      ) ||
      index.builds.some((b) => !generations.some((g) => g.id === b.generation))
    )
      throw new Error("Unexpected prompt generation metadata");
    const current = index.builds.filter((b) => b.generation === featured[0].id);
    const expected = [
      "codex/gpt-6-1-sol/high",
      "codex/gpt-6-astra/high",
      "claude/claude-opus-5-5/high",
    ];
    const prompts = new Set(current.map((b) => b.prompt));
    if (
      prompts.size !== 6 ||
      current.length !== 18 ||
      [...prompts].some(
        (id) =>
          !same(
            current.filter((b) => b.prompt === id).map((b) => b.agent),
            expected,
          ),
      )
    )
      throw new Error(
        "Latest E must include three high-effort models for every brief",
      );
    if (!manifest.inputs?.length)
      throw new Error("Missing text-only input provenance");
    for (const input of manifest.inputs) {
      if (
        !/^docs\/samples\/lego-style-study\/[a-z0-9/-]+$/.test(input.folder) ||
        input.images !== 0 ||
        !generations.some((g) => g.id === input.generation) ||
        hash(readFileSync(resolve(input.folder, "prompt.md"))) !==
          input.promptSha256 ||
        hash(readFileSync(resolve(input.folder, "build.json"))) !==
          input.scriptSha256
      )
        throw new Error("Text-only input provenance changed");
    }
  }
  if (
    !history &&
    (index.builds.length !== 18 ||
      index.prompts.length !== 6 ||
      index.agents.length !== 3 ||
      !same(
        index.builds.map((b: { id: string }) => b.id),
        manifest.after,
      ) ||
      new Set(manifest.after).size !== 18 ||
      new Set(manifest.before).size !== 12 ||
      ![...manifest.before, ...manifest.after].every((id) =>
        /^[0-9a-f]{12}$/.test(id),
      ))
  )
    throw new Error("Unexpected gallery replacement roster");
  const expectedAgents = [
    "codex/gpt-6-1-sol/high",
    "codex/gpt-6-astra/high",
    "claude/claude-opus-5-5/high",
  ];
  if (
    !history &&
    (!same(
      index.agents.map((a) => a.id),
      expectedAgents,
    ) ||
      index.prompts.some(
        (p) =>
          !same(
            index.builds.filter((b) => b.prompt === p.id).map((b) => b.agent),
            expectedAgents,
          ),
      ))
  )
    throw new Error("Each prompt must have all three high-effort E models");
  if (hash(readFileSync(join(dir, "publish.sql"))) !== manifest.sqlSha256)
    throw new Error("Publication SQL checksum changed");
  const files = new Map(manifest.files.map((f) => [f.key, f]));
  if (files.size !== manifest.files.length)
    throw new Error("Duplicate file keys");
  for (const f of manifest.files) {
    if (!/^[bsrp]\/[0-9a-f]{64}\.(json|webp|mpd\.gz)$/.test(f.key))
      throw new Error("Invalid content-addressed file key");
    const bytes = readFileSync(join(dir, f.key));
    const content = f.key.startsWith("b/") ? gunzipSync(bytes) : bytes;
    if (
      bytes.length !== f.bytes ||
      hash(bytes) !== f.sha256 ||
      hash(content) !== f.key.slice(2, 66)
    )
      throw new Error(`File checksum changed: ${f.key}`);
  }
  for (const b of index.builds) {
    const keys = [
      `b/${b.mpd}.mpd.gz`,
      `s/${b.script}.json`,
      `p/${b.report}.json`,
      ...GALLERY_VIEWS.map((v) => `r/${b.renders[v]}.webp`),
    ];
    if (!keys.every((k) => files.has(k)))
      throw new Error(`Missing files for ${b.id}`);
    const report = JSON.parse(
      readFileSync(join(dir, `p/${b.report}.json`), "utf8"),
    );
    if (
      !report.run?.accepted ||
      report.agent.id !== b.agent ||
      galleryAgentName(report.agent.model) !==
        index.agents.find((a) => a.id === b.agent)?.model ||
      report.run.model !== report.agent.model ||
      report.compile.stats.parts !== b.parts ||
      (!history &&
        (report.source !== "E:text-only:original-source-revision" ||
          report.agent.effort !== "high")) ||
      (history &&
        report.generation !== undefined &&
        report.generation !== b.generation) ||
      report.compile.problems.some(
        (p: { severity: string }) => p.severity === "error",
      )
    )
      throw new Error(`Build is not accepted: ${b.id}`);
  }
  return { manifest, index };
}

export async function main(args: string[]) {
  if (!args[0] || args.slice(1).some((a) => a !== "--remote"))
    throw new Error(
      "Usage: tsx scripts/publish-gallery-bundle.ts <bundle-dir> [--remote]",
    );
  const dir = resolve(args[0]);
  const { manifest, index: reviewed } = verifyBundle(dir);
  console.log(
    `Verified ${manifest.after.length} builds and ${manifest.files.length} files`,
  );
  if (!args.includes("--remote")) return;
  if (
    !process.env.CLOUDFLARE_API_TOKEN ||
    (process.env.GITHUB_ACTIONS && process.env.GITHUB_REF !== "refs/heads/main")
  )
    throw new Error(
      "Remote publishing requires an owner credential and main in CI",
    );
  const env = {
    ...process.env,
    FORCE_COLOR: "0",
    WRANGLER_SEND_METRICS: "false",
  };
  const wrangler = resolve("node_modules/wrangler/bin/wrangler.js");
  const config = resolve("wrangler.gallery.toml");
  const command = (a: string[]) =>
    execFileSync(process.execPath, [wrangler, ...a, "--config", config], {
      env,
      encoding: "utf8",
      maxBuffer: 8_000_000,
    });
  command(["d1", "migrations", "apply", "brick-gallery", "--remote"]);
  const visibleIds = () =>
    JSON.parse(
      command([
        "d1",
        "execute",
        "brick-gallery",
        "--remote",
        "--json",
        "--command",
        "SELECT id FROM builds WHERE hidden = 0",
      ]),
    )
      .at(-1)
      .results.map((r: { id: string }) => r.id) as string[];
  const current = visibleIds();
  if (!same(current, manifest.before) && !same(current, manifest.after))
    throw new Error(
      "Visible gallery changed since review; refusing to hide other builds",
    );
  const queue = [...manifest.files];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let f = queue.shift(); f; f = queue.shift()) {
        const file = f;
        await new Promise<void>((done, fail) => {
          const child = spawn(
            process.execPath,
            [
              wrangler,
              "r2",
              "object",
              "put",
              `brick-gallery/${file.key}`,
              "--file",
              join(dir, file.key),
              "--content-type",
              file.contentType,
              "--cache-control",
              "public, max-age=31536000, immutable",
              "--remote",
              "--config",
              config,
            ],
            { env, stdio: ["ignore", "pipe", "pipe"] },
          );
          let stderr = "";
          child.stdout.resume();
          child.stderr.on("data", (d) => (stderr += String(d)));
          child.on("error", fail);
          child.on("close", (code) =>
            code === 0 ? done() : fail(new Error(stderr.slice(-1500))),
          );
        });
        console.log(`Uploaded ${file.key}`);
      }
    }),
  );
  // Visibility changes only after all immutable assets are uploaded.
  const latest = visibleIds();
  if (!same(latest, manifest.before) && !same(latest, manifest.after))
    throw new Error(
      "Visible gallery changed during upload; refusing publication",
    );
  if (same(latest, manifest.before))
    command([
      "d1",
      "execute",
      "brick-gallery",
      "--remote",
      "--file",
      join(dir, "publish.sql"),
    ]);
  const rows: GalleryRow[] = JSON.parse(
    command([
      "d1",
      "execute",
      "brick-gallery",
      "--remote",
      "--json",
      "--command",
      INDEX_QUERY,
    ]),
  ).at(-1).results;
  const actual = galleryIndexFromRows(rows, reviewed.files, new Date());
  verifyLiveIndex(actual, reviewed);
  const temporary = mkdtempSync(join(tmpdir(), "brick-gallery-index-"));
  try {
    const file = join(temporary, "index.json");
    writeFileSync(file, JSON.stringify(actual) + "\n");
    command([
      "r2",
      "object",
      "put",
      "brick-gallery/index.json",
      "--remote",
      "--file",
      file,
      "--content-type",
      "application/json",
      "--cache-control",
      "public, max-age=60, s-maxage=60",
    ]);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  const after = visibleIds();
  if (!same(after, manifest.after))
    throw new Error("Published roster does not match the reviewed bundle");
  console.log(
    `Published ${manifest.after.length} reviewed builds${manifest.v === 2 ? "; latest E is featured and history remains browsable" : "; the earlier builds are retained as hidden history"}`,
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
