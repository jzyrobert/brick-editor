import { test, expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gzipSync, strToU8 } from "fflate";

// Published gallery builds (docs/GALLERY-PLAN.md) in the Gallery mode. The
// gallery bucket is mocked: no test may reach the real one. Test servers are
// plain http, where the app reads the index only with `?galleryIndex=1`.
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
const IDS = MPD_SHAS.map((s) => s.slice(0, 12));
// 1 × 1 WebP: every render.
const WEBP = Buffer.from(
  "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA",
  "base64",
);
const R = (n: number) => String(n).repeat(64);
const TITLES = ["Hall of the red gate", "Pagoda court", "Harbour light"];

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
    id: IDS[i],
    prompt: i < 2 ? "japanese-buddhist-temple-2000" : "lighthouse-500",
    agent: i === 1 ? "codex/gpt-6-1-sol/low" : "claude/claude-opus-5-5/high",
    title: TITLES[i],
    mpd: MPD_SHAS[i],
    mpdBytes: strToU8(m).length,
    script: R(9),
    renders: { iso: R(1), front: R(2), "iso-back": R(3) },
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

test("shows published builds by brief and model, and opens one after checking it", async ({
  page,
}) => {
  const requests = await mockGallery(page);
  await page.goto("./?galleryIndex=1");
  await expect(
    page.getByRole("heading", { name: "One brief. Two takes." }),
  ).toBeVisible();
  await expect(
    page.getByText("The brief: “a japanese buddhist temple”"),
  ).toBeVisible();
  const responses = page.getByRole("region", {
    name: "Responses to the same prompt",
  });
  await expect(responses.getByRole("article")).toHaveCount(2);
  // Two models: no "another agent" placeholder; grouped by model.
  await expect(responses.locator(".gallery-response h2")).toHaveText(
    TITLES.slice(0, 2),
  );
  await expect(responses.getByRole("article").first()).toContainText(
    "Claude Opus 5.5High effort",
  );
  // Renders come from the bucket and follow the shared angle.
  const firstImage = responses.getByRole("img").first();
  await expect(firstImage).toHaveAttribute("src", `${ORIGIN}/r/${R(1)}.webp`);
  await page.getByRole("button", { name: "Front" }).click();
  await expect(firstImage).toHaveAttribute("src", `${ORIGIN}/r/${R(2)}.webp`);

  // The agent filter has one group per model.
  await page.getByRole("button", { name: "Agent settings" }).click();
  await page.getByRole("checkbox", { name: "Low effort" }).uncheck();
  await expect(responses.getByRole("article")).toHaveCount(1);
  await page.getByRole("checkbox", { name: "Low effort" }).check();

  // Another brief.
  await page
    .getByRole("group", { name: "Choose a prompt" })
    .getByRole("button", { name: /Lighthouse/ })
    .click();
  await expect(responses.locator(".gallery-response h2")).toHaveText([
    TITLES[2],
  ]);
  await page
    .getByRole("group", { name: "Choose a prompt" })
    .getByRole("button", { name: /Japanese buddhist temple/ })
    .click();

  await page
    .getByRole("button", { name: `Look closer at ${TITLES[0]}` })
    .click();
  await expect(
    page.getByRole("heading", { name: `${TITLES[0]}.` }),
  ).toBeVisible();
  const facts = page.locator(".gallery-detail-info dl");
  await expect(facts).toContainText("Time19 min");
  await expect(facts).toContainText("Cost$2.84");
  await page.getByRole("button", { name: "Explore this model" }).click();
  await expect(page.locator(".model-heading")).toContainText(TITLES[0], {
    timeout: 60000,
  });
  await expect(page.locator(".model-heading")).toContainText(
    "Claude Opus 5.5 · High effort · 2 parts",
  );
  expect(requests.filter((r) => !r.startsWith("/r/"))).toEqual([
    "/index.json",
    `/b/${MPD_SHAS[0]}.mpd.gz`,
  ]);
});

test("refuses a published build whose file does not match the index", async ({
  page,
}) => {
  await mockGallery(page, { corrupt: true });
  await page.goto(`./?galleryIndex=1&gallery=${IDS[1]}`);
  // `?gallery=<id>` opens that build's page.
  await expect(
    page.getByRole("heading", { name: `${TITLES[1]}.` }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore this model" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "does not match the gallery",
    { timeout: 60000 },
  );
});

test("keeps the built-in samples when the index is unavailable or not asked for", async ({
  page,
}) => {
  await mockGallery(page, { index: "offline" });
  await page.goto("./?galleryIndex=1");
  await expect(
    page.getByRole("heading", { name: "One temple. Five takes." }),
  ).toBeVisible();

  const other = await page.context().newPage();
  const requests = await mockGallery(other);
  await other.goto("./");
  await expect(
    other.getByRole("heading", { name: "One temple. Five takes." }),
  ).toBeVisible();
  // Plain http without the switch never reaches the bucket.
  await other.waitForTimeout(500);
  expect(requests).toEqual([]);
});

for (const viewport of [
  { width: 360, height: 600 },
  { width: 1080, height: 1800 },
  { width: 686, height: 411 },
])
  test(`published gallery fits ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await mockGallery(page);
    await page.goto("./?galleryIndex=1");
    await expect(
      page.getByRole("heading", { name: "One brief. Two takes." }),
    ).toBeVisible();
    await page.goto(`./?galleryIndex=1&gallery=${IDS[0]}`);
    await expect(
      page.getByRole("heading", { name: `${TITLES[0]}.` }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
