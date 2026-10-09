import type { Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gzipSync, strToU8 } from "fflate";
import type { GalleryIndex } from "../../../src/catalog/gallery-index";

// A mocked published gallery (docs/GALLERY-PLAN.md). The real bucket is
// never reached: every request to its origin is answered here. Test servers
// are plain http, where the app reads the index only with `?galleryIndex=1`.
export const GALLERY_ORIGIN = "https://gallery.bricks.robertj.in";
const lock = JSON.parse(readFileSync("src/catalog/data.json", "utf8"))
  .libraryLock as { releaseId: string; manifestSha256: string };
const sha = (b: Uint8Array | string) =>
  createHash("sha256").update(b).digest("hex");

export const galleryModel = (colour: number) =>
  [
    "0 FILE main.ldr",
    "0 Test temple",
    "0 Name: main.ldr",
    `1 ${colour} 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat`,
    "1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3003.dat",
    "0 NOFILE",
    "",
  ].join("\n");
const MODELS = [galleryModel(4), galleryModel(1), galleryModel(14)];
export const MPD_SHAS = MODELS.map((m) => sha(m));
export const BUILD_IDS = MPD_SHAS.map((s) => s.slice(0, 12));
export const TITLES = ["Hall of the red gate", "Pagoda court", "Harbour light"];
/** Render hashes: corner, front and back of each build. */
export const RENDER = (build: number, view: number) =>
  `${build}${view}`.padEnd(64, "a");
// 1 × 1 WebP: every render.
const WEBP = Buffer.from(
  "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA",
  "base64",
);

export const GALLERY_INDEX: GalleryIndex = {
  v: 1,
  generated: "2026-10-03T18:00:00Z",
  files: GALLERY_ORIGIN,
  prompts: [
    {
      id: "japanese-buddhist-temple-2000",
      name: "Japanese temple",
      brief: "a japanese buddhist temple",
      targetParts: 2000,
      arena: true,
    },
    {
      id: "lighthouse-500",
      brief: "a lighthouse",
      targetParts: 500,
      arena: true,
    },
  ],
  agents: [
    {
      id: "claude/claude-opus-5-5/high",
      name: "Claude Opus 5.5 (high)",
      model: "Claude Opus 5.5",
      effort: "high",
    },
    {
      id: "codex/gpt-6-1-sol/low",
      name: "GPT-6.1-Sol (low)",
      model: "GPT-6.1-Sol",
      effort: "low",
    },
  ],
  builds: MODELS.map((m, i) => ({
    id: BUILD_IDS[i],
    prompt: i < 2 ? "japanese-buddhist-temple-2000" : "lighthouse-500",
    agent: i === 1 ? "codex/gpt-6-1-sol/low" : "claude/claude-opus-5-5/high",
    title: TITLES[i],
    mpd: MPD_SHAS[i],
    mpdBytes: strToU8(m).length,
    script: "9".repeat(64),
    renders: {
      iso: RENDER(i, 0),
      front: RENDER(i, 1),
      "iso-back": RENDER(i, 2),
    },
    parts: 2,
    warnings: i,
    attempts: 2,
    seconds: 1148,
    ...(i === 0 ? { costUsd: 2.84 } : {}),
    source: "test-run",
    library: { release: lock.releaseId, hash: lock.manifestSha256 },
    created: "2026-10-03T18:00:00Z",
  })),
};

export async function mockGallery(
  page: Page,
  o: {
    index?: "ok" | "offline";
    model?: "ok" | "corrupt" | "down";
    collection?: GalleryIndex;
  } = {},
) {
  const requests: string[] = [];
  await page.route(`${GALLERY_ORIGIN}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    const cors = { "Access-Control-Allow-Origin": "*" };
    if (path === "/index.json")
      return o.index === "offline"
        ? route.abort("internetdisconnected")
        : route.fulfill({ json: o.collection ?? GALLERY_INDEX, headers: cors });
    if (path.startsWith("/r/"))
      return route.fulfill({ body: WEBP, contentType: "image/webp" });
    const i = MPD_SHAS.findIndex((s) => path === `/b/${s}.mpd.gz`);
    if (i >= 0) {
      if (o.model === "down")
        return route.fulfill({
          status: 503,
          body: "Unavailable",
          headers: cors,
        });
      return route.fulfill({
        body: Buffer.from(
          gzipSync(
            strToU8(o.model === "corrupt" ? galleryModel(2) : MODELS[i]),
            { mtime: 0 },
          ),
        ),
        contentType: "application/gzip",
        headers: cors,
      });
    }
    return route.fulfill({ status: 404, body: "Not found", headers: cors });
  });
  return requests;
}
