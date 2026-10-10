// Published gallery builds (docs/GALLERY-PLAN.md): types, ids and the checks
// shared by the publish script and the app's Gallery mode. Published files
// are static objects on one origin (a public R2 bucket) listed by its
// `index.json`; nothing here talks to a server of ours. The built-in samples
// (gallery.ts) are what Gallery shows when the index is unavailable. Kept free
// of the catalogue: callers pass the library locks they accept.
import { Gunzip } from "fflate";
import { sha256 } from "../core/hash";
import { AppError, ensure } from "../core/types";

/** Where the gallery's files live (also in the CSP of both pages). */
export const GALLERY_ORIGIN = "https://gallery.bricks.robertj.in";

/** The views Gallery offers (GALLERY_ANGLES in gallery.ts). */
export const GALLERY_VIEWS = ["iso", "front", "iso-back"] as const;
export type GalleryView = (typeof GALLERY_VIEWS)[number];
export type GalleryRenderKey = GalleryView;

/** Render settings every published build shares, so builds compare fairly;
 * the Realistic look on white matches the built-in samples' pictures. */
export const GALLERY_RENDER = {
  width: 1280,
  height: 960,
  look: "realistic",
  backdrop: "blank",
  background: "#ffffff",
  webpQuality: 0.86,
} as const;

/** Whether this page reads the published index. Local and test servers
 * (plain http) never reach the real bucket unless asked with
 * `?galleryIndex=1`; browser tests mock the origin and ask. */
export function galleryIndexEnabled(
  where: Pick<Location, "protocol" | "search">,
) {
  return (
    where.protocol === "https:" ||
    new URLSearchParams(where.search).get("galleryIndex") === "1"
  );
}

export type GalleryPrompt = {
  id: string;
  /** A short display name ("Pelican on a bicycle"); the brief otherwise. */
  name?: string;
  brief: string;
  targetParts?: number;
  arena: boolean;
};
/** `name` is the full label; `model` and `effort` are its parts
 * ("GPT-6.1-Sol", "low"). */
export type GalleryAgent = {
  id: string;
  name: string;
  model?: string;
  effort?: string;
};
export type GalleryLibrary = { release: string; hash: string };
/** A reviewed cohort: prompt version and starting conditions, independent of
 * the model and subject. The default is chosen explicitly, not by run date. */
export type GalleryGeneration = {
  id: string;
  name: string;
  description: string;
  order: number;
  default?: boolean;
};
export type GalleryBuild = {
  id: string;
  prompt: string;
  agent: string;
  /** The build script's own title. */
  title?: string;
  /** SHA-256 of the uncompressed MPD; the file is `b/<mpd>.mpd.gz`. */
  mpd: string;
  mpdBytes: number;
  script?: string;
  report?: string;
  renders: Partial<Record<GalleryRenderKey, string>>;
  parts: number;
  warnings: number;
  attempts?: number;
  seconds?: number;
  costUsd?: number;
  outputTokens?: number;
  /** A label for the batch the build came from (e.g. the one-shot run). */
  source?: string;
  generation?: string;
  library: GalleryLibrary;
  created: string;
};
export type GalleryIndex = {
  v: 1;
  generated: string;
  files: string;
  prompts: GalleryPrompt[];
  agents: GalleryAgent[];
  /** Optional for indexes published before generation browsing. */
  generations?: GalleryGeneration[];
  builds: GalleryBuild[];
};

const SHA = /^[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9._/-]{0,119}$/;

/** A build's public id: the first 12 hex digits of its MPD hash. */
export const galleryBuildId = (mpdSha: string) => mpdSha.slice(0, 12);

const slug = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** "a japanese buddhist temple", 2000 → "japanese-buddhist-temple-2000". */
export function galleryPromptId(brief: string, targetParts?: number) {
  const words = slug(brief).replace(/^(a|an|the)-/, "");
  ensure(words.length > 0, "INVALID_INPUT", "The brief has no words");
  return (words.slice(0, 60).replace(/-+$/, "") +
    (targetParts ? `-${targetParts}` : "")) as string;
}

/** "claude", "claude-opus-5-5", "high" → "claude/claude-opus-5-5/high". */
export function galleryAgentId(runner: string, model: string, effort?: string) {
  const id = [runner, model, effort]
    .filter((p): p is string => !!p)
    .map(slug)
    .join("/");
  ensure(ID.test(id), "INVALID_INPUT", `Unusable agent id: ${id}`);
  return id;
}

const MODEL_NAMES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [
    /^claude-([a-z]+)-(\d+)-(\d+)$/,
    (m) => `Claude ${cap(m[1])} ${m[2]}.${m[3]}`,
  ],
  [
    /^gpt-(.+)$/,
    (m) => `GPT-${m[1].replace(/-([a-z])/g, (_, c) => "-" + c.toUpperCase())}`,
  ],
];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** A plain display name: "Claude Opus 5.5 (high)", "GPT-6.1-Sol (low)". */
export function galleryAgentName(model: string, effort?: string) {
  let name = model;
  for (const [re, f] of MODEL_NAMES) {
    const m = model.match(re);
    if (m) {
      name = f(m);
      break;
    }
  }
  return effort ? `${name} (${effort})` : name;
}

export const galleryFileUrl = (
  files: string,
  kind: "b" | "s" | "r" | "p",
  sha: string,
) =>
  `${files.replace(/\/+$/, "")}/${kind}/${sha}.${
    kind === "b" ? "mpd.gz" : kind === "r" ? "webp" : "json"
  }`;

/** Checks the shape of `index.json` (it is fetched from another origin) and
 * drops builds whose prompt or agent is missing. */
export function decodeGalleryIndex(raw: unknown): GalleryIndex {
  const bad = () =>
    new AppError("INVALID_INPUT", "The gallery index is invalid");
  if (!raw || typeof raw !== "object") throw bad();
  const r = raw as Partial<GalleryIndex>;
  if (
    r.v !== 1 ||
    typeof r.generated !== "string" ||
    typeof r.files !== "string" ||
    !/^https:\/\/[^/]+/.test(r.files) ||
    !Array.isArray(r.prompts) ||
    !Array.isArray(r.agents) ||
    !Array.isArray(r.builds)
  )
    throw bad();
  const prompts = r.prompts.filter(
    (p) =>
      p &&
      ID.test(p.id) &&
      typeof p.brief === "string" &&
      (p.name === undefined || typeof p.name === "string"),
  );
  const agents = r.agents.filter(
    (a) => a && ID.test(a.id) && typeof a.name === "string",
  );
  const generations = (
    Array.isArray(r.generations) ? r.generations : []
  ).filter(
    (g) =>
      g &&
      typeof g.id === "string" &&
      ID.test(g.id) &&
      g.id !== "latest" &&
      typeof g.name === "string" &&
      typeof g.description === "string" &&
      Number.isFinite(g.order) &&
      (g.default === undefined || typeof g.default === "boolean"),
  );
  const generationIds = new Set(generations.map((g) => g.id));
  if (
    generationIds.size !== generations.length ||
    generations.filter((g) => g.default).length > 1
  )
    throw bad();
  const promptIds = new Set(prompts.map((p) => p.id)),
    agentIds = new Set(agents.map((a) => a.id));
  const builds = r.builds.filter(
    (b) =>
      b &&
      /^[0-9a-f]{12}$/.test(b.id) &&
      SHA.test(b.mpd) &&
      b.id === galleryBuildId(b.mpd) &&
      Number.isInteger(b.mpdBytes) &&
      Number.isInteger(b.parts) &&
      promptIds.has(b.prompt) &&
      agentIds.has(b.agent) &&
      (b.generation === undefined || generationIds.has(b.generation)) &&
      b.renders &&
      Object.values(b.renders).every(
        (s) => typeof s === "string" && SHA.test(s),
      ) &&
      b.library &&
      typeof b.library.release === "string" &&
      typeof b.library.hash === "string",
  );
  const featured = generations.find((g) => g.default);
  if (featured && !builds.some((b) => b.generation === featured.id))
    throw bad();
  return {
    ...(r as GalleryIndex),
    prompts,
    agents,
    builds,
    ...(generations.length ? { generations } : { generations: undefined }),
  };
}

/** Index rows → `index.json`. Rows come from D1 (see migrations/), newest
 * build first; prompts and agents without visible builds are left out. */
export type GalleryRow = {
  build_id: string;
  prompt_id: string;
  prompt_name: string | null;
  brief: string;
  target_parts: number | null;
  arena: number;
  agent_id: string;
  display_name: string;
  model: string;
  effort: string | null;
  title: string | null;
  mpd_sha: string;
  mpd_bytes: number;
  script_sha: string | null;
  report_sha: string | null;
  renders: string;
  parts: number;
  attempts: number | null;
  seconds: number | null;
  cost_usd: number | null;
  output_tokens: number | null;
  source: string | null;
  library_release: string;
  library_hash: string;
  warnings: number;
  created_at: number;
  generation_id?: string | null;
  generation_name?: string | null;
  generation_description?: string | null;
  generation_order?: number | null;
  generation_default?: number | null;
};
export function galleryIndexFromRows(
  rows: GalleryRow[],
  files: string,
  generated: Date,
): GalleryIndex {
  const sorted = [...rows].sort(
    (a, b) =>
      b.created_at - a.created_at || a.build_id.localeCompare(b.build_id),
  );
  const prompts = new Map<string, GalleryPrompt>(),
    agents = new Map<string, GalleryAgent>(),
    generations = new Map<string, GalleryGeneration>();
  const opt = <T>(v: T | null) => (v === null ? undefined : v);
  const builds = sorted.map((r): GalleryBuild => {
    if (
      r.generation_id &&
      r.generation_name &&
      !generations.has(r.generation_id)
    )
      generations.set(r.generation_id, {
        id: r.generation_id,
        name: r.generation_name,
        description: r.generation_description ?? "",
        order: r.generation_order ?? 0,
        ...(r.generation_default ? { default: true } : {}),
      });
    if (!prompts.has(r.prompt_id))
      prompts.set(r.prompt_id, {
        id: r.prompt_id,
        ...(r.prompt_name ? { name: r.prompt_name } : {}),
        brief: r.brief,
        ...(r.target_parts ? { targetParts: r.target_parts } : {}),
        arena: !!r.arena,
      });
    if (!agents.has(r.agent_id))
      agents.set(r.agent_id, {
        id: r.agent_id,
        name: r.display_name,
        model: galleryAgentName(r.model),
        ...(r.effort ? { effort: r.effort } : {}),
      });
    const b: GalleryBuild = {
      id: r.build_id,
      prompt: r.prompt_id,
      agent: r.agent_id,
      title: opt(r.title),
      mpd: r.mpd_sha,
      mpdBytes: r.mpd_bytes,
      script: opt(r.script_sha),
      report: opt(r.report_sha),
      renders: JSON.parse(r.renders),
      parts: r.parts,
      warnings: r.warnings,
      attempts: opt(r.attempts),
      seconds: opt(r.seconds),
      costUsd: opt(r.cost_usd),
      outputTokens: opt(r.output_tokens),
      source: opt(r.source),
      generation: r.generation_id ?? undefined,
      library: { release: r.library_release, hash: r.library_hash },
      created: new Date(r.created_at * 1000)
        .toISOString()
        .replace(/\.\d{3}Z$/, "Z"),
    };
    for (const k of Object.keys(b) as (keyof GalleryBuild)[])
      if (b[k] === undefined) delete b[k];
    return b;
  });
  const byName = <T extends { id: string }>(m: Map<string, T>) =>
    [...m.values()].sort((a, b) => a.id.localeCompare(b.id));
  return {
    v: 1,
    generated: generated.toISOString().replace(/\.\d{3}Z$/, "Z"),
    files,
    prompts: byName(prompts),
    agents: byName(agents),
    ...(generations.size
      ? {
          generations: [...generations.values()].sort(
            (a, b) => b.order - a.order || a.id.localeCompare(b.id),
          ),
        }
      : {}),
    builds,
  };
}

/** Inflates a gzip member, refusing to grow past `maxBytes`. */
export function gunzipBounded(bytes: Uint8Array, maxBytes: number) {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const gunzip = new Gunzip((data) => {
    size += data.length;
    ensure(
      size <= maxBytes,
      "LIMIT_EXCEEDED",
      "This build is over this device's import limit.",
    );
    chunks.push(data);
  });
  for (let i = 0; i < bytes.length; i += 65536)
    gunzip.push(bytes.subarray(i, i + 65536), i + 65536 >= bytes.length);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/** Checks a downloaded build against its index entry: size, hash and library
 * release. Returns the MPD text. */
export async function verifyGalleryBuild(
  build: GalleryBuild,
  gz: Uint8Array,
  o: {
    maxBytes: number;
    locks: { releaseId: string; manifestSha256: string }[];
  },
) {
  ensure(
    build.mpdBytes <= o.maxBytes,
    "LIMIT_EXCEEDED",
    "This build is over this device's import limit.",
  );
  ensure(
    o.locks.some(
      (l) =>
        l.releaseId === build.library.release &&
        l.manifestSha256 === build.library.hash,
    ),
    "REFERENCE_MISSING",
    "This build needs a parts library version this app no longer has.",
  );
  let bytes: Uint8Array;
  try {
    bytes = gunzipBounded(gz, Math.min(o.maxBytes, build.mpdBytes));
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError("INVALID_INPUT", "The build file is damaged.");
  }
  ensure(
    bytes.length === build.mpdBytes && (await sha256(bytes)) === build.mpd,
    "INVALID_INPUT",
    "The build file does not match the gallery (checksum mismatch).",
  );
  return new TextDecoder().decode(bytes);
}

/** `index.json`, fresh from the network (the CDN caches it for a minute). */
export async function fetchGalleryIndex(origin = GALLERY_ORIGIN) {
  let res: Response;
  try {
    res = await fetch(`${origin}/index.json`, { cache: "no-cache" });
  } catch {
    throw new AppError(
      "NETWORK_UNAVAILABLE",
      "The gallery needs a connection.",
    );
  }
  ensure(
    res.ok,
    "NETWORK_UNAVAILABLE",
    `The gallery is unavailable (HTTP ${res.status}). Try again later.`,
  );
  return decodeGalleryIndex(await res.json());
}

export const galleryCacheName = "brick-editor-gallery-v1";

let indexLoad: Promise<GalleryIndex> | undefined;
/** The published index, once per page (a failed load is retried next call). */
export function loadGalleryIndex() {
  indexLoad ??= fetchGalleryIndex().catch((e) => {
    indexLoad = undefined;
    throw e;
  });
  return indexLoad;
}

/** One build's MPD, verified. Builds are immutable, so a copy opened before
 * comes from this device's cache (and opens offline). */
export async function fetchGalleryModel(
  build: GalleryBuild,
  files: string,
  o: Parameters<typeof verifyGalleryBuild>[2],
) {
  const url = galleryFileUrl(files, "b", build.mpd);
  let cache: Cache | undefined;
  try {
    cache =
      typeof caches === "undefined"
        ? undefined
        : await caches.open(galleryCacheName);
  } catch {
    cache = undefined;
  }
  const hit = await cache?.match(url).catch(() => undefined);
  if (hit) {
    try {
      return await verifyGalleryBuild(
        build,
        new Uint8Array(await hit.arrayBuffer()),
        o,
      );
    } catch {
      await cache!.delete(url).catch(() => false);
    }
  }
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new AppError(
      "NETWORK_UNAVAILABLE",
      "The gallery needs a connection. Builds you have opened before also open offline.",
    );
  }
  ensure(
    res.ok,
    "NETWORK_UNAVAILABLE",
    `The gallery is unavailable (HTTP ${res.status}). Try again later.`,
  );
  const gz = new Uint8Array(await res.arrayBuffer());
  const text = await verifyGalleryBuild(build, gz, o);
  await cache
    ?.put(
      url,
      new Response(gz, { headers: { "Content-Type": "application/gzip" } }),
    )
    .catch(() => {}); // Quota: still opens, just not offline.
  return text;
}

/** "84 s", "19 min". */
export const galleryDuration = (seconds: number) =>
  seconds < 90
    ? `${seconds} s`
    : `${Math.round(seconds / 60).toLocaleString("en-US")} min`;

/** Plain stats for cards: "1,921 parts · 19 min · $2.84". */
export function galleryStats(b: GalleryBuild) {
  const out = [`${b.parts.toLocaleString("en-US")} parts`];
  if (b.seconds !== undefined) out.push(galleryDuration(b.seconds));
  if (b.costUsd !== undefined) out.push(`$${b.costUsd.toFixed(2)}`);
  return out.join(" · ");
}
