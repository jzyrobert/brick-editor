// A focused static-preview check. Own ephemeral server, no app or model calls.
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, join, extname, sep } from "node:path";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const root = resolve(process.argv[2]);
const out = resolve(process.argv[3]);
await mkdir(out, { recursive: true });
const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".ttf": "font/ttf",
};
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(
    new URL(req.url, "http://localhost").pathname,
  );
  const file = resolve(
    root,
    "." + (pathname === "/" ? "/index.html" : pathname),
  );
  if (!file.startsWith(root + sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const bytes = await readFile(file);
    res.writeHead(200, {
      "content-type": types[extname(file)] ?? "application/octet-stream",
    });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const errors = [],
  remote = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (!r.url().startsWith(base)) remote.push(r.url());
  });
  await page.goto(base);
  await page.waitForFunction(
    () => document.querySelectorAll(".build-shot").length === 42,
  );
  const data = JSON.parse(await readFile(join(root, "data.json"), "utf8"));
  assert.equal(data.cases.length, 112);
  assert.equal(data.cases.filter((c) => c.images.length).length, 82);
  assert.equal(
    data.cases.reduce((n, c) => n + c.images.length, 0),
    328,
  );
  // Check every image, including those lazy-loaded below the viewport.
  const dimensions = await page.evaluate(
    async (paths) => {
      const results = [];
      for (let i = 0; i < paths.length; i += 12) {
        results.push(
          ...(await Promise.all(
            paths.slice(i, i + 12).map(
              (src) =>
                new Promise((resolve, reject) => {
                  const image = new Image();
                  image.onload = () =>
                    resolve([image.naturalWidth, image.naturalHeight]);
                  image.onerror = () => reject(Error(src));
                  image.src = src;
                }),
            ),
          )),
        );
      }
      return results;
    },
    data.cases.flatMap((c) => c.images),
  );
  assert(dimensions.every(([w, h]) => w === 1280 && h === 960));
  await page.check("#failures");
  assert.equal(await page.locator(".build").count(), 72);
  assert.equal(await page.locator(".failed").count(), 30);
  await page.selectOption("#subject", "destroyer");
  assert.equal(await page.locator(".build").count(), 12);
  await page.selectOption("#condition", "shape");
  assert.equal(await page.locator(".build").count(), 3);
  await page.uncheck("#failures");
  assert.equal(await page.locator(".build").count(), 0);
  assert(await page.locator(".empty").isVisible());
  await page.selectOption("#condition", "all");
  await page.selectOption("#subject", "all");
  for (const view of ["0", "1", "2", "3"]) {
    await page.selectOption("#view", view);
    assert(
      await page
        .locator(".build-shot img")
        .first()
        .getAttribute("src")
        .then((s) => s.endsWith(`image-${view}.png`)),
    );
  }
  await page.selectOption("#view", "0");
  await page.locator(".build-shot").first().click();
  assert(await page.locator("dialog[open]").isVisible());
  assert.equal(await page.locator(".detail-views img").count(), 4);
  const title = await page.locator("#detail-title").textContent();
  await page.click("#next");
  assert.notEqual(await page.locator("#detail-title").textContent(), title);
  await page.click("#previous");
  assert.equal(await page.locator("#detail-title").textContent(), title);
  await page.screenshot({ path: join(out, "inspector-desktop.png") });
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog[open]").count(), 0);
  await page.click("#calibration-tab");
  assert.equal(await page.locator(".build-shot").count(), 40);
  await page.locator(".build-shot").first().click();
  assert(
    await page
      .locator("#detail-content")
      .textContent()
      .then((s) => s.includes("calibration relationships")),
  );
  await page.click("#close");
  await page.click("#creative-tab");
  const sizes = [
    [1440, 1000],
    [1080, 1800],
    [360, 600],
    [411, 685],
    [390, 844],
    [686, 411],
  ];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.reload();
    await page.waitForFunction(
      () => document.querySelectorAll(".build-shot").length === 42,
    );
    await page
      .locator(".build-shot img")
      .first()
      .evaluate((img) => img.decode());
    await page.evaluate(() => document.fonts.ready);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Page overflow at ${width}`,
    );
    const shot =
      width === 1440
        ? "desktop.png"
        : width === 390
          ? "mobile.png"
          : `viewport-${width}.png`;
    await page.screenshot({ path: join(out, shot) });
    if (width === 390) {
      await page.locator(".build-shot").first().click();
      await page.screenshot({ path: join(out, "inspector-mobile.png") });
      assert(await page.locator("#close").isVisible());
      await page.click("#close");
      await page.locator("#filter-panel summary").click();
      await page.selectOption("#subject", "piplup");
      assert(
        await page
          .locator(".subject-head h2")
          .first()
          .textContent()
          .then((s) => s === "Piplup"),
      );
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  await writeFile(
    join(out, "verification.json"),
    JSON.stringify(
      {
        cases: 112,
        completedBuilds: 82,
        failedCases: 30,
        images: 328,
        imageSize: [1280, 960],
        viewports: sizes,
        filters: true,
        emptyState: true,
        dialogNavigation: true,
        keyboardEscape: true,
        pageErrors: errors,
        thirdPartyRequests: remote,
      },
      null,
      2,
    ),
  );
  console.log(
    "Verified 112 cases, 82 builds, 328 images, all controls and six viewport sizes.",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
