import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const root = process.cwd(),
  dest = path.join(root, "docs/samples/style-directions");
const temp = await fs.mkdtemp(
  path.join(os.tmpdir(), "brick-portable-directions-"),
);
const browser = await chromium.launch({ headless: true });
const failures = [],
  requests = [],
  counts = [];
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => failures.push(String(e)));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  for (const subject of [
    "pelican",
    "piplup",
    "temple",
    "dragon",
    "destroyer",
    "ewok",
  ]) {
    await fs.copyFile(
      path.join(dest, subject + ".html"),
      path.join(temp, subject + ".html"),
    );
    await page.goto("file://" + path.join(temp, subject + ".html"));
    const expected = await page.evaluate(
      () =>
        Object.keys(JSON.parse(document.querySelector("#images").textContent))
          .length,
    );
    counts.push(expected);
    for (const view of ["iso", "front", "iso-back", "top"]) {
      await page.selectOption("#view", view);
      await page.waitForFunction(() =>
        [...document.querySelectorAll("[data-model]")].every(
          (img) => img.complete && img.naturalWidth === 1280,
        ),
      );
      if ((await page.locator("[data-model]").count()) !== expected)
        throw Error("Missing builds " + subject);
    }
    await page.selectOption("#style", "lego");
    if ((await page.locator("section:visible").count()) !== 1)
      throw Error("Style filter");
    await page.locator("[data-enlarge]:visible").first().click();
    await page.locator("dialog[open]").waitFor();
    await page.click("#close");
    await page.selectOption("#style", "all");
    for (const [width, height] of [
      [1440, 1000],
      [1080, 1800],
      [360, 600],
      [411, 685],
      [390, 844],
      [686, 411],
    ]) {
      await page.setViewportSize({ width, height });
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw Error(`Overflow ${subject} ${width}`);
    }
  }
  await fs.copyFile(
    path.join(dest, "index.html"),
    path.join(temp, "index.html"),
  );
  await page.goto("file://" + path.join(temp, "index.html"));
  for (const [width, height] of [
    [1440, 1000],
    [1080, 1800],
    [360, 600],
    [411, 685],
    [390, 844],
    [686, 411],
  ]) {
    await page.setViewportSize({ width, height });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw Error(`Overview overflow ${width}`);
  }
  if (failures.length || requests.length)
    throw Error(JSON.stringify({ failures, requests }));
  await fs.writeFile(
    path.join(dest, "preview-audit.json"),
    JSON.stringify(
      {
        standalonePages: 7,
        buildsPerPage: counts,
        views: 4,
        images: counts.reduce((a, b) => a + b, 0) * 4,
        complete: counts.every((n) => n === 14),
        externalRequests: 0,
        viewports: 6,
        styleFilter: true,
        fullSizeDialog: true,
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Portable preview checks passed");
} finally {
  await browser.close();
  await fs.rm(temp, { recursive: true, force: true });
}
