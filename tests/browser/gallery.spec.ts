import { test, expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gzipSync, strToU8 } from "fflate";

// The agent gallery (docs/GALLERY-PLAN.md). The gallery bucket is mocked:
// no test may reach the real one.
const ORIGIN = "https://gallery.bricks.robertj.in";
const lock = JSON.parse(readFileSync("src/catalog/data.json", "utf8"))
  .libraryLock as { releaseId: string; manifestSha256: string };
const sha = (b: Uint8Array | string) =>
  createHash("sha256").update(b).digest("hex");

const model = (colour: number) =>
  [
    "0 FILE main.ldr",
    "0 Test temple",
    "0 Name: main.ldr",
    `1 ${colour} 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat`,
    "1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3003.dat",
    "0 NOFILE",
    "",
  ].join("\n");
const MODELS = [model(4), model(1), model(14)];
const MPD_SHAS = MODELS.map((m) => sha(m));
// 1 × 1 WebP: every render.
const WEBP = Buffer.from(
  "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA",
  "base64",
);
const R = (n: number) => String(n).repeat(64);

const INDEX = {
  v: 1,
  generated: "2026-10-03T18:00:00Z",
  files: ORIGIN,
  prompts: [
    {
      id: "japanese-buddhist-temple-2000",
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
    { id: "claude/claude-opus-5-5/high", name: "Claude Opus 5.5 (high)" },
    { id: "codex/gpt-6-1-sol/low", name: "GPT-6.1-sol (low)" },
  ],
  builds: MODELS.map((m, i) => ({
    id: MPD_SHAS[i].slice(0, 12),
    prompt: i < 2 ? "japanese-buddhist-temple-2000" : "lighthouse-500",
    agent: i === 1 ? "codex/gpt-6-1-sol/low" : "claude/claude-opus-5-5/high",
    mpd: MPD_SHAS[i],
    mpdBytes: strToU8(m).length,
    script: R(9),
    renders: {
      iso: R(1),
      front: R(2),
      "iso-back": R(3),
      top: R(4),
      card: R(5),
    },
    parts: 2,
    warnings: i,
    attempts: 2,
    seconds: 1148,
    ...(i === 0 ? { costUsd: 2.84 } : {}),
    library: { release: lock.releaseId, hash: lock.manifestSha256 },
    created: "2026-10-03T18:00:00Z",
  })),
};

async function mockGallery(
  page: Page,
  o: { index?: "ok" | "offline"; corrupt?: boolean } = {},
) {
  const requests: string[] = [];
  await page.route(`${ORIGIN}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    if (path === "/index.json")
      return o.index === "offline"
        ? route.abort("internetdisconnected")
        : route.fulfill({
            json: INDEX,
            headers: { "Access-Control-Allow-Origin": "*" },
          });
    if (path.startsWith("/r/"))
      return route.fulfill({ body: WEBP, contentType: "image/webp" });
    const i = MPD_SHAS.findIndex((s) => path === `/b/${s}.mpd.gz`);
    if (i >= 0)
      return route.fulfill({
        body: Buffer.from(
          gzipSync(strToU8(o.corrupt ? model(2) : MODELS[i]), { mtime: 0 }),
        ),
        contentType: "application/gzip",
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    return route.fulfill({ status: 404, body: "Not found" });
  });
  return requests;
}

test("browses briefs and builds, filters by model and switches views", async ({
  page,
}) => {
  await mockGallery(page);
  await page.goto("./gallery.html");
  await expect(
    page.getByRole("heading", { name: "Agent gallery" }),
  ).toBeVisible();
  const temple = page.getByRole("link", {
    name: /A japanese buddhist temple\s*2 builds · aiming for 2,000 parts/,
  });
  await expect(temple).toBeVisible();
  await expect(page.getByRole("link", { name: /A lighthouse/ })).toBeVisible();

  // The model filter narrows the briefs, then the builds.
  const filter = page.getByLabel("Made by");
  await filter.selectOption({ label: "GPT-6.1-sol (low)" });
  await expect(page.getByRole("link", { name: /A lighthouse/ })).toHaveCount(0);
  await filter.selectOption({ label: "Any model" });

  await temple.click();
  await expect(page).toHaveURL(/#\/p\/japanese-buddhist-temple-2000$/);
  await expect(page).toHaveTitle(/a japanese buddhist temple/);
  const cards = page.locator(".gallery-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText("Claude Opus 5.5 (high)");
  await expect(cards.first()).toContainText("2 parts · 19 min · $2.84");
  await expect(cards.nth(1)).toContainText("1 warning");
  await page.getByLabel("Made by").selectOption({ label: "GPT-6.1-sol (low)" });
  await expect(cards).toHaveCount(1);
  await page.getByLabel("Made by").selectOption({ label: "Any model" });

  await cards.first().click();
  const id = MPD_SHAS[0].slice(0, 12);
  await expect(page).toHaveURL(new RegExp(`#/b/${id}$`));
  await expect(
    page.getByRole("heading", { name: "Claude Opus 5.5 (high)" }),
  ).toBeVisible();
  const image = page.locator(".gallery-figure img");
  await expect(image).toHaveAttribute("src", `${ORIGIN}/r/${R(1)}.webp`);
  await page.getByRole("button", { name: "Top" }).click();
  await expect(image).toHaveAttribute("src", `${ORIGIN}/r/${R(4)}.webp`);
  await expect(page.getByRole("button", { name: "Top" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("link", { name: "Look around in 3D" }),
  ).toHaveAttribute("href", `./?gallery=${id}`);
  await expect(
    page.getByRole("link", { name: "Build script (JSON)" }),
  ).toHaveAttribute("href", `${ORIGIN}/s/${R(9)}.json`);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download model (.mpd)" }).click();
  expect((await download).suggestedFilename()).toBe(
    `japanese-buddhist-temple-2000-${id}.mpd`,
  );

  // A removed build says so instead of failing.
  await page.goto("./gallery.html#/b/000000000000");
  await expect(page.getByRole("alert")).toContainText("not in the gallery");
});

test("says the gallery needs a connection when the index cannot load", async ({
  page,
}) => {
  await mockGallery(page, { index: "offline" });
  await page.goto("./gallery.html");
  await expect(page.getByRole("alert")).toContainText(
    "The gallery needs a connection.",
  );
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("opens a gallery build in the editor after checking it, and refuses a damaged one", async ({
  page,
}) => {
  const requests = await mockGallery(page);
  const id = MPD_SHAS[0].slice(0, 12);
  await page.goto(`./?gallery=${id}&automation=1`);
  await page.waitForFunction(() => !!window.brickEditor);
  const status = page.locator(".status-bar [role=status]");
  await expect(status).toContainText(
    "Opened a japanese buddhist temple by Claude Opus 5.5 (high) from the agent gallery",
    { timeout: 60000 },
  );
  // The parameter is dropped, so a reload does not ask again.
  expect(new URL(page.url()).searchParams.has("gallery")).toBe(false);
  const parts = await page.evaluate(
    async () => (await window.brickEditor!.query()).occurrences.length,
  );
  expect(parts).toBe(2);
  expect(requests).toEqual(["/index.json", `/b/${MPD_SHAS[0]}.mpd.gz`]);

  const other = await page.context().newPage();
  await mockGallery(other, { corrupt: true });
  await other.goto(`./?gallery=${MPD_SHAS[1].slice(0, 12)}`);
  await expect(other.locator(".status-bar [role=status]")).toContainText(
    "does not match the gallery",
    { timeout: 60000 },
  );
});

for (const viewport of [
  { width: 360, height: 600 },
  { width: 411, height: 685 },
  { width: 390, height: 844 },
  { width: 1080, height: 1800 },
  { width: 686, height: 411 },
  { width: 1440, height: 1000 },
])
  test(`gallery pages fit ${viewport.width}×${viewport.height} with 44px targets`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await mockGallery(page);
    for (const hash of [
      "#/",
      "#/p/japanese-buddhist-temple-2000",
      `#/b/${MPD_SHAS[0].slice(0, 12)}`,
    ]) {
      await page.goto("./gallery.html" + hash);
      await expect(page.locator(".gallery-main h1")).toBeVisible();
      const report = await page.evaluate(() => {
        const small = [
          ...document.querySelectorAll<HTMLElement>(
            "button, select, .gallery-bar a, .gallery-open, .gallery-crumbs a, .gallery-downloads a",
          ),
        ]
          .filter((e) => e.getBoundingClientRect().height < 44)
          .map((e) => e.textContent);
        return {
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          small,
        };
      });
      expect(report.overflow, hash).toBeLessThanOrEqual(0);
      expect(report.small, hash).toEqual([]);
    }
  });
