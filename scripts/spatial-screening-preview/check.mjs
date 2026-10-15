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
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForFunction(
    () => document.querySelectorAll(".build").length === 64,
  );
  assert.equal(await page.locator(".build-shot").count(), 55);
  assert.equal(await page.locator(".failed").count(), 18);
  await page.uncheck("#failures");
  assert.equal(await page.locator(".build").count(), 46);
  await page.selectOption("#model", "luna");
  assert.equal(await page.locator(".build").count(), 8);
  await page.selectOption("#condition", "shape");
  assert.equal(await page.locator(".build").count(), 0);
  await page.selectOption("#condition", "all");
  await page.check("#failures");
  assert.equal(await page.locator(".build").count(), 16);
  await page
    .locator('[data-case="luna--canal-landing--control--1"] button')
    .click();
  assert(
    (await page.locator("#detail-content").textContent()).includes(
      "14 parts instead",
    ),
  );
  assert(
    (await page.locator("#detail-content").textContent()).includes(
      "excluded from compliant summaries",
    ),
  );
  assert.equal(await page.locator(".detail-views img").count(), 4);
  await page.keyboard.press("Escape");
  await page.selectOption("#model", "all");
  const data = JSON.parse(await readFile(join(root, "data.json"), "utf8"));
  assert.equal(data.cases.length, 64);
  for (const v of ["0", "1", "2", "3"]) {
    await page.selectOption("#view", v);
    assert(
      (
        await page.locator(".build-shot img").first().getAttribute("src")
      ).endsWith(`image-${v}.png`),
    );
  }
  await page.selectOption("#view", "0");
  for (const [width, height] of [
    [1440, 1000],
    [1080, 1800],
    [360, 600],
    [411, 685],
    [390, 844],
    [686, 411],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(base);
    await page.waitForFunction(
      () => document.querySelectorAll(".build").length === 64,
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${width} overflow`,
    );
    await page.screenshot({ path: join(out, `gallery-${width}.png`) });
    await page.locator(".build-shot").first().click();
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll(".detail-views img")).every(
        (i) => i.complete,
      ),
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({ path: join(out, `inspector-${width}.png`) });
    await page.keyboard.press("Escape");
  }
  assert.deepEqual(errors, []);
  await writeFile(
    join(out, "verification.json"),
    JSON.stringify(
      {
        cases: 64,
        rendered: 55,
        compliant: 46,
        images: 220,
        viewports: 6,
        errors,
      },
      null,
      2,
    ),
  );
  console.log("Preview browser verification passed");
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
