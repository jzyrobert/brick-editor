// `npm run gallery:publish`: puts agent builds in the gallery
// (docs/GALLERY-PLAN.md §7). The owner runs it with a Cloudflare API token;
// there is no upload endpoint. Without --remote it is a dry run: files go to
// .local/gallery-out/ (the bucket's layout) and rows to a local D1 under
// .local/gallery-d1/, through the same SQL as a real publish.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync, strToU8 } from "fflate";
import type { Page } from "@playwright/test";
import {
  GALLERY_ORIGIN,
  GALLERY_RENDER,
  GALLERY_VIEWS,
  galleryAgentId,
  galleryAgentName,
  galleryBuildId,
  galleryIndexFromRows,
  galleryPromptId,
  type GalleryRenderKey,
  type GalleryRow,
} from "../src/catalog/gallery-index";
import type { Project } from "../src/core/types";
import { AppError, ensure } from "../src/core/types";

const root = fileURLToPath(new URL("../", import.meta.url));
const CONFIG = join(root, "wrangler.gallery.toml");
const BUCKET = "brick-gallery";
const DATABASE = "brick-gallery";
const IMMUTABLE = "public, max-age=31536000, immutable";
const SHORT = "public, max-age=60, s-maxage=60";

const HELP = `npm run gallery:publish -- <oneshot-dir>... [--prompt-id id] [--prompt-name "…"] [--only high,max] [--source label] [--remote]
npm run gallery:publish -- --script build.json --runner R --model M [--effort E] --brief "…" [--target-parts N] [--prompt-name "…"] [--remote]
npm run gallery:publish -- --hide <buildId> [--remote]
npm run gallery:publish -- --reindex [--remote]

  --generation id assigns a reviewed prompt-generation cohort (create its
  generations row first). --source remains the original run label.

  Compiles each accepted build (refusing any with errors), exports and gzips
  its MPD, renders ${GALLERY_VIEWS.join(", ")} (${GALLERY_RENDER.width} × ${GALLERY_RENDER.height}, ${GALLERY_RENDER.look} look, ${GALLERY_RENDER.backdrop} backdrop, WebP),
  names every file by its SHA-256, uploads the files, inserts the rows and
  rebuilds index.json. Builds already in the database are skipped.

  Without --remote: a dry run into .local/gallery-out/ and a local D1.
  --remote needs CLOUDFLARE_API_TOKEN (D1 Edit, R2 Edit) and the IDs in
  wrangler.gallery.toml.`;

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)

/** A SQL literal: strings quoted, numbers finite, null for undefined. */
export function sqlValue(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") {
    ensure(Number.isFinite(v), "INVALID_INPUT", `Not a finite number: ${v}`);
    return String(v);
  }
  return "'" + v.replace(/'/g, "''") + "'";
}
export function sqlInsert(
  table: string,
  row: Record<string, string | number | null | undefined>,
) {
  const keys = Object.keys(row);
  return `INSERT OR IGNORE INTO ${table} (${keys.join(", ")}) VALUES (${keys
    .map((k) => sqlValue(row[k]))
    .join(", ")});`;
}

export type OneShotResult = {
  effort?: string;
  runner?: string;
  model: string;
  targetParts?: number;
  accepted: boolean;
  attemptsUsed?: number;
  parts?: number;
  seconds?: number;
  tokens?: { output?: number; costUsd?: number };
};
export type Candidate = {
  label: string;
  scriptPath: string;
  brief: string;
  targetParts?: number;
  promptId: string;
  /** The prompt's short display name; set (or changed) when given. */
  promptName?: string;
  runner: string;
  model: string;
  effort?: string;
  agentId: string;
  agentName: string;
  source?: string;
  generation?: string;
  result?: OneShotResult;
};

/** The brief a one-shot run was given: the prompt's "Build request:" line. */
export function briefFromPrompt(prompt: string) {
  return prompt.match(/^Build request: (.+)$/m)?.[1].trim();
}

/** The accepted efforts of one `npm run oneshot` folder. Runs made before the
 * runner was recorded used Codex. */
export function oneShotCandidates(
  dir: string,
  read: (path: string) => string | undefined,
  list: (dir: string) => string[],
  o: {
    promptId?: string;
    promptName?: string;
    only?: string[];
    source?: string;
    generation?: string;
  } = {},
): { candidates: Candidate[]; skipped: string[] } {
  // Newer runs keep the prompt in each effort's folder.
  const prompt =
    read(join(dir, "prompt.md")) ??
    list(dir)
      .sort()
      .map((d) => read(join(dir, d, "prompt.md")))
      .find((p) => p !== undefined);
  ensure(prompt, "INVALID_INPUT", `${dir} has no prompt.md`);
  const brief = briefFromPrompt(prompt);
  ensure(brief, "INVALID_INPUT", `${dir}/prompt.md has no "Build request:"`);
  const candidates: Candidate[] = [],
    skipped: string[] = [];
  for (const effortDir of list(dir).sort()) {
    const raw = read(join(dir, effortDir, "result.json"));
    if (!raw) continue;
    const label = `${basename(dir)}/${effortDir}`;
    const result = JSON.parse(raw) as OneShotResult;
    const effort = result.effort ?? effortDir;
    if (o.only && !o.only.includes(effort) && !o.only.includes(effortDir))
      continue;
    if (!result.accepted) {
      skipped.push(`${label}: not accepted`);
      continue;
    }
    const scriptPath = join(dir, effortDir, "build.json");
    if (read(scriptPath) === undefined) {
      skipped.push(`${label}: no build.json`);
      continue;
    }
    const runner = result.runner ?? "codex";
    candidates.push({
      label,
      scriptPath,
      brief,
      targetParts: result.targetParts,
      promptId: o.promptId ?? galleryPromptId(brief, result.targetParts),
      promptName: o.promptName,
      runner,
      model: result.model,
      effort,
      agentId: galleryAgentId(runner, result.model, effort),
      agentName: galleryAgentName(result.model, effort),
      source: o.source ?? basename(dir),
      generation: o.generation,
      result,
    });
  }
  return { candidates, skipped };
}

export type Prepared = {
  candidate: Candidate;
  id: string;
  mpd: { sha: string; bytes: number; gz: Uint8Array };
  script: { sha: string; bytes: Uint8Array };
  report: { sha: string; bytes: Uint8Array };
  title?: string;
  parts: number;
  warnings: number;
  library: { release: string; hash: string };
};

/** The SQL that records published builds (after their files are uploaded). */
export function publishSql(
  builds: (Prepared & { renders: Partial<Record<GalleryRenderKey, string>> })[],
  now: number,
) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const b of builds) {
    const c = b.candidate;
    if (!seen.has("p:" + c.promptId)) {
      seen.add("p:" + c.promptId);
      out.push(
        sqlInsert("prompts", {
          id: c.promptId,
          brief: c.brief,
          target_parts: c.targetParts,
          name: c.promptName,
          arena: 1,
          created_at: now,
        }),
      );
      if (c.promptName)
        out.push(
          `UPDATE prompts SET name = ${sqlValue(c.promptName)} WHERE id = ${sqlValue(c.promptId)};`,
        );
    }
    if (!seen.has("a:" + c.agentId)) {
      seen.add("a:" + c.agentId);
      out.push(
        sqlInsert("agents", {
          id: c.agentId,
          runner: c.runner,
          model: c.model,
          effort: c.effort,
          display_name: c.agentName,
        }),
      );
    }
    const r = c.result;
    out.push(
      sqlInsert("builds", {
        id: b.id,
        prompt_id: c.promptId,
        agent_id: c.agentId,
        title: b.title,
        mpd_sha: b.mpd.sha,
        mpd_bytes: b.mpd.bytes,
        script_sha: b.script.sha,
        report_sha: b.report.sha,
        renders: JSON.stringify(b.renders),
        parts: b.parts,
        attempts: r?.attemptsUsed,
        seconds: r?.seconds,
        cost_usd:
          r?.tokens?.costUsd === undefined
            ? undefined
            : Math.round(r.tokens.costUsd * 100) / 100,
        output_tokens: r?.tokens?.output,
        source: c.source,
        generation_id: c.generation,
        library_release: b.library.release,
        library_hash: b.library.hash,
        warnings: b.warnings,
        created_at: now,
      }),
    );
  }
  return out.join("\n") + "\n";
}

export const INDEX_QUERY = `SELECT b.id AS build_id, b.prompt_id, p.name AS prompt_name, p.brief, p.target_parts, p.arena,
  b.agent_id, a.display_name, a.model, a.effort, b.title, b.mpd_sha, b.mpd_bytes, b.script_sha, b.report_sha,
  b.renders, b.parts, b.attempts, b.seconds, b.cost_usd, b.output_tokens, b.source,
  b.library_release, b.library_hash, b.warnings, b.created_at,
  g.id AS generation_id, g.name AS generation_name, g.description AS generation_description,
  g.sort_order AS generation_order, g.is_default AS generation_default
FROM builds b JOIN prompts p ON p.id = b.prompt_id JOIN agents a ON a.id = b.agent_id
LEFT JOIN generations g ON g.id = b.generation_id
WHERE b.hidden = 0`;

// ---------------------------------------------------------------------------
// Side effects: wrangler, files, the headless renderer

const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

function wrangler(args: string[], o: { quiet?: boolean } = {}) {
  return new Promise<string>((done, fail) => {
    const child = spawn(
      join(root, "node_modules/.bin/wrangler"),
      [...args, "--config", CONFIG],
      {
        cwd: root,
        env: {
          ...process.env,
          WRANGLER_SEND_METRICS: "false",
          FORCE_COLOR: "0",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let out = "",
      err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", fail);
    child.on("close", (code) => {
      if (code === 0) done(out);
      else
        fail(
          new AppError(
            "ERROR",
            `wrangler ${args.slice(0, 3).join(" ")} failed (${code}):\n${(err || out).trim().slice(-2000)}`,
          ),
        );
      if (!o.quiet && code === 0 && err.trim()) console.error(err.trim());
    });
  });
}

type Target = {
  remote: boolean;
  outDir: string;
  d1: string[];
  /** Files already published (skipped). */
  has(key: string): Promise<boolean>;
  put(key: string, file: string, type: string, cache: string): Promise<void>;
};

function target(remote: boolean): Target {
  const outDir = join(root, ".local/gallery-out");
  const d1 = remote
    ? ["--remote"]
    : ["--local", "--persist-to", join(root, ".local/gallery-d1")];
  if (remote) {
    ensure(
      !readFileSync(CONFIG, "utf8").includes(
        "00000000-0000-0000-0000-000000000000",
      ),
      "INVALID_INPUT",
      "wrangler.gallery.toml has no database_id: run the Cloudflare setup (docs/GALLERY-PLAN.md §3) first.",
    );
    ensure(
      process.env.CLOUDFLARE_API_TOKEN,
      "INVALID_INPUT",
      "Set CLOUDFLARE_API_TOKEN (D1 Edit and R2 Edit on this account).",
    );
  }
  return {
    remote,
    outDir,
    d1,
    async has(key) {
      if (!remote) return existsSync(join(outDir, key));
      const res = await fetch(`${GALLERY_ORIGIN}/${key}`, { method: "HEAD" });
      return res.ok;
    },
    async put(key, file, type, cache) {
      if (!remote) return; // The file is already in outDir.
      await wrangler(
        [
          "r2",
          "object",
          "put",
          `${BUCKET}/${key}`,
          "--file",
          file,
          "--content-type",
          type,
          "--cache-control",
          cache,
          "--remote",
        ],
        { quiet: true },
      );
    },
  };
}

async function d1Query<T>(t: Target, sql: string): Promise<T[]> {
  const out = await wrangler(
    ["d1", "execute", DATABASE, ...t.d1, "--json", "--command", sql],
    { quiet: true },
  );
  const results = JSON.parse(out) as { results: T[] }[];
  return results.at(-1)?.results ?? [];
}

async function migrate(t: Target) {
  await wrangler(["d1", "migrations", "apply", DATABASE, ...t.d1], {
    quiet: true,
  });
}

/** Writes a file into the bucket layout and uploads it unless present. */
async function store(
  t: Target,
  key: string,
  bytes: Uint8Array,
  type: string,
  cache = IMMUTABLE,
) {
  const file = join(t.outDir, key);
  await mkdir(join(file, ".."), { recursive: true });
  await writeFile(file, bytes);
  if (cache === IMMUTABLE && t.remote && (await t.has(key))) return;
  await t.put(key, file, type, cache);
}

export async function prepare(
  c: Candidate,
): Promise<Prepared & { project: Project; bounds: any }> {
  const [{ compileBuildScript }, { registerAgentData }, fullNode, full] =
    await Promise.all([
      import("../src/build-script/compile"),
      import("./build-script-cli"),
      import("./full-library-node"),
      import("../src/catalog/full-library"),
    ]);
  fullNode.registerFullLibraryFromDisk();
  registerAgentData();
  const scriptBytes = new Uint8Array(await readFile(c.scriptPath));
  const script = JSON.parse(new TextDecoder().decode(scriptBytes));
  const result = compileBuildScript(script, {
    check: true,
    targetParts: c.targetParts,
    occupancyFor: (refs) =>
      fullNode.fullLibraryOccupancy(refs.filter((r) => !full.curatedHas(r))),
  });
  const { report, project } = result;
  const errors = report.problems.filter((p) => p.severity === "error");
  ensure(
    report.ok && errors.length === 0 && project,
    "INVALID_INPUT",
    `${c.label} has ${errors.length} error(s): ${errors
      .slice(0, 3)
      .map((e) => e.message.split("\n")[0])
      .join("; ")}`,
  );
  const mpdBytes = strToU8(result.ldraw);
  const mpdSha = sha256(mpdBytes);
  const reportJson = strToU8(
    JSON.stringify(
      {
        gallery: 1,
        source: c.source,
        generation: c.generation,
        label: c.label,
        prompt: { id: c.promptId, brief: c.brief, targetParts: c.targetParts },
        agent: {
          id: c.agentId,
          runner: c.runner,
          model: c.model,
          effort: c.effort,
        },
        run: c.result,
        compile: {
          stats: report.stats,
          check: report.check,
          target: report.target,
          problems: report.problems,
        },
        render: GALLERY_RENDER,
      },
      null,
      2,
    ) + "\n",
  );
  return {
    candidate: c,
    project,
    bounds: report.bounds!.ldu,
    id: galleryBuildId(mpdSha),
    title: report.title || undefined,
    mpd: {
      sha: mpdSha,
      bytes: mpdBytes.length,
      // mtime 0: the same MPD always gzips to the same bytes.
      gz: gzipSync(mpdBytes, { level: 9, mtime: 0 }),
    },
    script: { sha: sha256(scriptBytes), bytes: scriptBytes },
    report: { sha: sha256(reportJson), bytes: reportJson },
    parts: report.stats.parts,
    warnings: report.problems.filter((p) => p.severity === "warning").length,
    library: {
      release: project.library.releaseId,
      hash: project.library.manifestSha256,
    },
  };
}

/** Renders every build's views in one headless page. */
export async function renderAll(
  builds: { id: string; project: Project; bounds: { min: any; max: any } }[],
): Promise<Map<string, Record<GalleryRenderKey, Uint8Array>>> {
  const [{ withHeadlessPage }, { viewCamera }, { encodeNative }] =
    await Promise.all([
      import("./headless"),
      import("../src/build-script/views"),
      import("../src/persistence/native"),
    ]);
  const out = new Map<string, Record<GalleryRenderKey, Uint8Array>>();
  if (!builds.length) return out;
  const { width, height } = GALLERY_RENDER;
  await withHeadlessPage(builds[0].project, async (page: Page) => {
    // tsx keeps function names with a `__name` helper the page lacks.
    await page.evaluate("window.__name = (f) => f");
    for (const b of builds) {
      const cameras = GALLERY_VIEWS.map((view) => ({
        view,
        camera: viewCamera(b.bounds, view, width / height),
      }));
      const shots = await page.evaluate(
        async ({ bytes, cameras, s }) => {
          const a = window.brickEditor!;
          const imported = await a.project.import({ format: "native", bytes });
          await a.ready({ minRevision: imported.revision, strict: true });
          const webp = async (blob: Blob, w: number, h: number) => {
            const bitmap = await createImageBitmap(blob, {
              resizeWidth: w,
              resizeHeight: h,
              resizeQuality: "high",
            });
            const canvas = new OffscreenCanvas(w, h);
            canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
            const out = await canvas.convertToBlob({
              type: "image/webp",
              quality: s.webpQuality,
            });
            const buffer = new Uint8Array(await out.arrayBuffer());
            let binary = "";
            for (let i = 0; i < buffer.length; i += 8192)
              binary += String.fromCharCode(...buffer.subarray(i, i + 8192));
            return btoa(binary);
          };
          const result: Record<string, string> = {};
          for (const { view, camera } of cameras) {
            await a.camera.set(camera);
            const q = await a.query();
            const { blob } = await a.render.image({
              revision: q.revision,
              width: s.width,
              height: s.height,
              format: "png",
              visibility: { mode: "all" },
              background: { type: "solid", color: s.background },
              quality: "photo",
              look: s.look as never,
              backdrop: s.backdrop as never,
              strict: true,
            });
            result[view] = await webp(blob, s.width, s.height);
          }
          return result;
        },
        {
          bytes: Array.from(await encodeNative(b.project)),
          cameras,
          s: GALLERY_RENDER,
        },
      );
      const images = {} as Record<GalleryRenderKey, Uint8Array>;
      for (const [k, v] of Object.entries(shots)) {
        const data = new Uint8Array(Buffer.from(v, "base64"));
        ensure(
          Buffer.from(data.subarray(8, 12)).toString() === "WEBP",
          "ERROR",
          `Not a WebP image: ${b.id} ${k}`,
        );
        images[k as GalleryRenderKey] = data;
      }
      out.set(b.id, images);
      console.log(`rendered ${b.id}`);
    }
  });
  return out;
}

async function reindex(t: Target) {
  const rows = await d1Query<GalleryRow>(t, INDEX_QUERY);
  const index = galleryIndexFromRows(rows, GALLERY_ORIGIN, new Date());
  await store(
    t,
    "index.json",
    strToU8(JSON.stringify(index) + "\n"),
    "application/json",
    SHORT,
  );
  console.log(
    `index.json: ${index.builds.length} build(s), ${index.prompts.length} prompt(s), ${index.agents.length} agent(s)`,
  );
}

function parseArgs(argv: string[]) {
  const flags = new Map<string, string>(),
    switches = new Set<string>(),
    positional: string[] = [];
  const valued = [
    "prompt-id",
    "prompt-name",
    "only",
    "source",
    "generation",
    "script",
    "runner",
    "model",
    "effort",
    "brief",
    "target-parts",
    "hide",
  ];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) positional.push(a);
    else if (valued.includes(a.slice(2))) {
      ensure(i + 1 < argv.length, "INVALID_INPUT", `${a} needs a value`);
      flags.set(a.slice(2), argv[++i]);
    } else if (["remote", "reindex", "help"].includes(a.slice(2)))
      switches.add(a.slice(2));
    else throw new AppError("INVALID_INPUT", `Unknown option ${a}\n${HELP}`);
  }
  return { flags, switches, positional };
}

export async function main(argv: string[]) {
  const { flags, switches, positional } = parseArgs(argv);
  if (
    switches.has("help") ||
    (!positional.length &&
      !flags.has("script") &&
      !flags.has("hide") &&
      !switches.has("reindex"))
  ) {
    console.log(HELP);
    return;
  }
  const t = target(switches.has("remote"));
  console.log(
    t.remote
      ? `Publishing to ${GALLERY_ORIGIN} and D1 ${DATABASE}`
      : `Dry run: files in ${t.outDir}, rows in a local D1 (add --remote to publish)`,
  );
  await migrate(t);
  if (flags.has("generation")) {
    const id = flags.get("generation")!;
    const rows = await d1Query<{ id: string }>(
      t,
      `SELECT id FROM generations WHERE id = ${sqlValue(id)}`,
    );
    ensure(
      rows.length === 1,
      "INVALID_INPUT",
      `Unknown prompt generation: ${id}. Create its reviewed generations row first.`,
    );
  }

  if (flags.has("hide")) {
    const id = flags.get("hide")!;
    ensure(
      /^[0-9a-f]{12}$/.test(id),
      "INVALID_INPUT",
      "--hide takes a build id",
    );
    await d1Query(t, `UPDATE builds SET hidden = 1 WHERE id = ${sqlValue(id)}`);
    console.log(`hid ${id}`);
    await reindex(t);
    return;
  }
  if (switches.has("reindex") && !positional.length && !flags.has("script")) {
    await reindex(t);
    return;
  }

  const candidates: Candidate[] = [];
  const read = (p: string) =>
    existsSync(p) ? readFileSync(p, "utf8") : undefined;
  const list = (d: string) =>
    readdirSync(d, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  for (const dir of positional) {
    const r = oneShotCandidates(resolve(dir), read, list, {
      promptId: flags.get("prompt-id"),
      promptName: flags.get("prompt-name"),
      only: flags.get("only")?.split(","),
      source: flags.get("source"),
      generation: flags.get("generation"),
    });
    for (const s of r.skipped) console.log(`skip ${s}`);
    candidates.push(...r.candidates);
  }
  if (flags.has("script")) {
    const brief = flags.get("brief"),
      model = flags.get("model"),
      runner = flags.get("runner");
    ensure(
      brief && model && runner,
      "INVALID_INPUT",
      "--script needs --runner, --model and --brief",
    );
    const targetParts = flags.has("target-parts")
      ? Number(flags.get("target-parts"))
      : undefined;
    ensure(
      targetParts === undefined || Number.isInteger(targetParts),
      "INVALID_INPUT",
      "--target-parts must be an integer",
    );
    const effort = flags.get("effort");
    candidates.push({
      label: flags.get("script")!,
      scriptPath: resolve(flags.get("script")!),
      brief,
      targetParts,
      promptId: flags.get("prompt-id") ?? galleryPromptId(brief, targetParts),
      promptName: flags.get("prompt-name"),
      runner,
      model,
      effort,
      agentId: galleryAgentId(runner, model, effort),
      agentName: galleryAgentName(model, effort),
      source: flags.get("source"),
      generation: flags.get("generation"),
    });
  }

  const known = new Set(
    (
      await d1Query<{ k: string }>(
        t,
        "SELECT prompt_id || ' ' || agent_id || ' ' || mpd_sha AS k FROM builds",
      )
    ).map((r) => r.k),
  );
  const ready: (Prepared & { project: Project; bounds: any })[] = [];
  const refused: string[] = [];
  for (const c of candidates) {
    try {
      const p = await prepare(c);
      if (known.has(`${c.promptId} ${c.agentId} ${p.mpd.sha}`)) {
        console.log(`skip ${c.label}: already published as ${p.id}`);
        continue;
      }
      ready.push(p);
      console.log(
        `ok ${c.label}: ${p.id}, ${p.parts} parts, ${p.warnings} warning(s), ${c.agentId}`,
      );
    } catch (e) {
      refused.push(`${c.label}: ${(e as Error).message}`);
      console.log(`refuse ${c.label}: ${(e as Error).message}`);
    }
  }
  const renders = await renderAll(
    ready.map((b) => ({ id: b.id, project: b.project, bounds: b.bounds })),
  );
  const published: Parameters<typeof publishSql>[0] = [];
  for (const b of ready) {
    const images = renders.get(b.id)!;
    const shas: Partial<Record<GalleryRenderKey, string>> = {};
    for (const [k, bytes] of Object.entries(images)) {
      const sha = sha256(bytes);
      shas[k as GalleryRenderKey] = sha;
      await store(t, `r/${sha}.webp`, bytes, "image/webp");
    }
    await store(t, `b/${b.mpd.sha}.mpd.gz`, b.mpd.gz, "application/gzip");
    await store(
      t,
      `s/${b.script.sha}.json`,
      b.script.bytes,
      "application/json",
    );
    await store(
      t,
      `p/${b.report.sha}.json`,
      b.report.bytes,
      "application/json",
    );
    published.push({ ...b, renders: shas });
  }
  if (published.length) {
    // Rows only after every file is up: the index never points at a gap.
    const sqlFile = join(t.outDir, "publish.sql");
    await mkdir(t.outDir, { recursive: true });
    await writeFile(
      sqlFile,
      publishSql(published, Math.floor(Date.now() / 1000)),
    );
    await wrangler(["d1", "execute", DATABASE, ...t.d1, "--file", sqlFile], {
      quiet: true,
    });
    console.log(`recorded ${published.length} build(s) (SQL in ${sqlFile})`);
  }
  await reindex(t);
  if (refused.length) {
    console.log(`\n${refused.length} refused:\n  ${refused.join("\n  ")}`);
    process.exitCode = 2;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main(process.argv.slice(2)).catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  });
