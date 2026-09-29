import { test, expect, type Locator, type Page } from "@playwright/test";
import { openMode } from "./helpers/mode";

/** CSS custom properties of a thumbnail (sheet, tint mask, tint). */
const thumbVars = (thumb: Locator) =>
  thumb.evaluate((el) => {
    const s = (el as HTMLElement).style;
    return {
      sheet: s.getPropertyValue("--sheet"),
      mask: s.getPropertyValue("--thumb"),
      tint: s.getPropertyValue("--tint"),
      glass: el.classList.contains("glass"),
      printed: el.classList.contains("printed"),
    };
  });

async function browseAll(page: Page) {
  const panel = page.locator(".left-sidebar");
  await panel.getByRole("button", { name: /^All LDraw parts/ }).click();
  await expect(
    panel.getByRole("group", { name: "Filter LDraw parts" }),
  ).toBeVisible();
  return panel;
}

test("the complete library shows real thumbnails, browses by category and loads lazily", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const sheets: string[] = [];
  page.on("request", (r) => {
    if (/\/thumbnails\/ldraw-full-[^/]+\/sheets\//.test(r.url()))
      sheets.push(r.url());
  });
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  // Nothing of the thumbnail pack is fetched for the curated catalogue.
  expect(sheets).toEqual([]);
  const panel = await browseAll(page);
  const filters = panel.getByRole("group", { name: "Filter LDraw parts" });
  await filters.getByRole("button", { name: "Brick", exact: true }).click();
  await expect(panel.locator(".parts-heading").first()).toContainText("Brick");
  const cards = panel.locator(".full-library .part-card");
  await expect(cards.first()).toBeVisible({ timeout: 20000 });
  // One page of cards at first; more arrive when the end scrolls into view.
  const first = await cards.count();
  expect(first).toBeLessThanOrEqual(60);
  const more = panel.getByRole("button", { name: /^Show more/ });
  await expect(more).toBeVisible();
  await more.click();
  await expect.poll(() => cards.count()).toBeGreaterThan(first);
  // Every card of the category shows its own rendering from the atlas.
  const thumb = cards.first().locator(".part-thumb.atlas.loaded");
  await expect(thumb).toBeVisible({ timeout: 20000 });
  const vars = await thumbVars(thumb);
  expect(vars.sheet).toMatch(/^url\("blob:/);
  // A plain part is tinted through its own silhouette.
  expect(vars.mask).toBe(vars.sheet);
  // Only the sheets (and print masks) of cards near the screen are fetched,
  // each once: cards further down the list are still waiting.
  expect(new Set(sheets).size).toBe(sheets.length);
  expect(
    await panel.locator(".full-library .part-thumb.atlas:not(.loaded)").count(),
  ).toBeGreaterThan(0);
  await filters.getByRole("button", { name: "Catalogue" }).click();
  await expect(
    panel.getByRole("group", { name: "Filter parts" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("print variants fold under their base part and keep their print untinted", async ({
  page,
}) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const panel = await browseAll(page);
  await page.getByLabel("Search parts").fill("973");
  const torso = panel.locator(".full-library .part-card-wrap", {
    has: page.locator("#part-973\\.dat"),
  });
  await expect(torso).toBeVisible({ timeout: 20000 });
  // Hundreds of printed torsos are one card with a variants button.
  const variants = torso.getByRole("button", {
    name: /^Show \d+ print and sticker variants of Minifig Torso/,
  });
  await expect(variants).toBeVisible();
  const n = Number((await variants.textContent())!.replace("+", ""));
  expect(n).toBeGreaterThan(500);
  await expect(panel.locator("#part-973p1a\\.dat")).toHaveCount(0);
  await variants.click();
  await expect(panel.getByText(/^Prints of Minifig Torso/)).toBeVisible();
  const printed = panel.locator(".part-thumb.atlas.loaded.printed").first();
  await expect(printed).toBeVisible({ timeout: 20000 });
  const vars = await thumbVars(printed);
  // The tint layer is masked to the body only: a separate mask sheet.
  expect(vars.mask).toMatch(/^url\("blob:/);
  expect(vars.mask).not.toBe(vars.sheet);
  await panel.getByRole("button", { name: "All results" }).click();
  await expect(torso).toBeVisible();
});

test("thumbnails follow the held colour, and a transparent colour shows glass", async ({
  page,
}) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const panel = page.locator(".left-sidebar");
  await page.getByLabel("Search parts").fill("glass for window");
  const pane = panel.locator("#part-60601\\.dat .part-thumb");
  await expect(pane).toHaveClass(/loaded/);
  // Curated glass is rendered opaque, so a solid colour shows solid.
  expect(await thumbVars(pane)).toMatchObject({
    tint: "#c91a09",
    glass: false,
  });
  await panel.getByRole("button", { name: "Clear", exact: true }).click();
  expect(await thumbVars(pane)).toMatchObject({
    tint: "#eef3f5",
    glass: true,
  });
  // The same for complete-library parts (and any part, not only glass).
  await panel
    .getByRole("region", { name: "All LDraw parts" })
    .getByRole("button", { name: "Search every official LDraw part" })
    .click();
  const atlas = panel.locator(".full-library .part-thumb.atlas").first();
  await expect(atlas).toHaveClass(/loaded/, { timeout: 20000 });
  expect((await thumbVars(atlas)).glass).toBe(true);
  await panel.getByRole("button", { name: "Blue", exact: true }).click();
  expect(await thumbVars(atlas)).toMatchObject({
    tint: "#0055bf",
    glass: false,
  });
});

test("complete-library thumbnails seen once show offline", async ({
  page,
  context,
}) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  // Install the offline app snapshot (the thumbnail pack is not precached).
  await openMode(page, "Project");
  await page
    .getByRole("button", { name: "Download / check for updates", exact: true })
    .click();
  await expect(page.getByText(/Ready offline\./)).toBeVisible({
    timeout: 45000,
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await openMode(page, "Build");
  let panel = await browseAll(page);
  await page.getByLabel("Search parts").fill("dome 4");
  const dome = panel.locator("#part-86500\\.dat .part-thumb.atlas");
  await expect(dome).toHaveClass(/loaded/, { timeout: 20000 });
  await context.setOffline(true);
  try {
    await page.reload();
    await page.waitForFunction(() => !!window.brickEditor);
    panel = await browseAll(page);
    await page.getByLabel("Search parts").fill("dome 4");
    // Part list, index and sheet all come from the verified local cache.
    await expect(dome).toHaveClass(/loaded/, { timeout: 20000 });
    expect((await thumbVars(dome)).sheet).toMatch(/^url\("blob:/);
  } finally {
    await context.setOffline(false);
  }
});
