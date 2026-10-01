import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { openMode } from "./helpers/mode";

/**
 * The follow-along step viewer and the parts list (docs/INSTRUCTIONS.md):
 * model STEP lines with a sub-assembly callout, generated steps for a sample,
 * the fly-in and tray, keyboard and buttons, culling of step views, phone
 * portrait and landscape layouts, and the parts list with its CSV.
 */
// Software GL on a busy machine: the castle and house sample steps redraw slowly.
test.describe.configure({ timeout: 240000 });
type Scene = {
  guideState: {
    active: boolean;
    animating: boolean;
    shown: number;
    held: number;
    flown: number;
    ghosted: number;
    tray: { min: number[]; max: number[] } | null;
    limited: string[];
  };
  renderBudgetStatus(): {
    batches: { plainView: boolean; reclassified: number; culled: number };
  };
};
const scene = (page: Page) =>
  page.evaluate(() => {
    const s = window.__brickScene as unknown as Scene;
    return { guide: s.guideState, batches: s.renderBudgetStatus().batches };
  });

const stepped = `0 FILE main.ldr
0 Stepped model
1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 4 80 0 0 1 0 0 0 1 0 0 0 1 3001.dat
0 STEP
1 16 0 -24 0 1 0 0 0 1 0 0 0 1 wing.ldr
1 16 0 -24 60 1 0 0 0 1 0 0 0 1 wing.ldr
0 STEP
1 14 40 -48 0 1 0 0 0 1 0 0 0 1 3003.dat
0 STEP
0 FILE wing.ldr
0 Wing
1 2 0 0 0 1 0 0 0 1 0 0 0 1 3020.dat
0 STEP
1 2 0 -8 0 1 0 0 0 1 0 0 0 1 3024.dat
1 2 20 -8 0 1 0 0 0 1 0 0 0 1 3024.dat
`;

async function load(page: Page, input: { text?: string; template?: string }) {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async (input) => {
    const a = window.brickEditor!;
    if (input.template)
      await a.project.import({
        format: "template",
        template: input.template as never,
      });
    else await a.project.import({ format: "ldraw", text: input.text! });
    await a.ready({ strict: true });
  }, input);
}
async function openSteps(page: Page) {
  await openMode(page, "Instructions");
  await page.getByRole("button", { name: "Build it step by step" }).click();
  await expect(page.getByRole("region", { name: "Build steps" })).toBeVisible();
}
/** Wait for the fly-in and camera move to end. */
const settled = (page: Page) =>
  page.waitForFunction(
    () => !(window.__brickScene as unknown as Scene).guideState.animating,
  );

test("follows model STEP lines with a sub-assembly callout", async ({
  page,
}) => {
  await load(page, { text: stepped });
  await openSteps(page);
  const steps = page.getByRole("region", { name: "Build steps" });
  const title = steps.locator(".guide-title");
  await expect(title).toContainText("Step 1");
  await expect(title).toContainText("/ 3");
  await expect(
    steps.getByLabel("Parts for this step").locator("li"),
  ).toHaveCount(1);
  await expect(
    steps.getByLabel("Parts for this step").locator("li").first(),
  ).toHaveAttribute("aria-label", /2 × Brick 2 [x×] 4, Red/);
  await settled(page);
  let state = await scene(page);
  expect(state.guide).toMatchObject({ active: true, shown: 2, held: 0 });
  // Step views cull against the parts they show.
  expect(state.batches.plainView).toBe(true);
  // The wing callout: built alone, from its first copy.
  await page.keyboard.press("ArrowRight");
  await expect(title).toContainText("Sub-assembly");
  await expect(title).toContainText("1/2");
  await expect(steps.locator(".guide-need-title")).toHaveText("Build 2 × wing");
  await settled(page);
  expect((await scene(page)).guide.shown).toBe(1);
  await steps.getByRole("button", { name: "Next step" }).click();
  await settled(page);
  expect((await scene(page)).guide.shown).toBe(3);
  // The main step placing both wings.
  await steps.getByRole("button", { name: "Next step" }).click();
  await expect(title).toContainText("Step 2");
  await expect(steps.locator(".guide-assembly")).toHaveAttribute(
    "aria-label",
    "2 × sub-assembly wing",
  );
  await settled(page);
  state = await scene(page);
  expect(state.guide.shown).toBe(2 + 6);
  expect(state.batches.plainView).toBe(true);
  // Back, then End and Escape.
  await page.keyboard.press("ArrowLeft");
  await expect(title).toContainText("Sub-assembly");
  await page.keyboard.press("End");
  await expect(title).toContainText("Step 3");
  await expect(steps.getByRole("button", { name: "Finish" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Build steps" })).toHaveCount(
    0,
    { timeout: 30000 },
  );
  expect((await scene(page)).guide.active).toBe(false);
});

test("generated steps fly parts in from a tray beside the model", async ({
  page,
}) => {
  await load(page, { template: "castle" });
  await openSteps(page);
  const steps = page.getByRole("region", { name: "Build steps" });
  await settled(page);
  await steps.getByRole("button", { name: "Next step" }).click();
  // The step's parts flew in from a tray (held back from the batches
  // until they landed).
  await expect
    .poll(async () => (await scene(page)).guide.flown, {
      timeout: 60000,
    })
    .toBeGreaterThan(0);
  expect((await scene(page)).guide.tray).not.toBeNull();
  await settled(page);
  const after = await scene(page);
  expect(after.guide.held).toBe(0);
  expect(after.batches.plainView).toBe(true);
  // The scrubber jumps without animating.
  const scrubber = steps.getByRole("slider", { name: "Step" });
  await scrubber.fill("10");
  await expect(steps.locator(".guide-title")).toContainText("Step 11");
  // Views jumped to by the scrubber are culled too.
  await expect
    .poll(async () => (await scene(page)).batches.plainView, {
      timeout: 60000,
    })
    .toBe(true);
  await expect
    .poll(async () => (await scene(page)).guide.held, {
      timeout: 60000,
    })
    .toBe(0);
  // Later parts shown faintly.
  await steps.getByRole("button", { name: "Step options" }).click();
  await page.getByLabel("Show later parts faintly").check();
  await expect
    .poll(async () => (await scene(page)).guide.ghosted, {
      timeout: 60000,
    })
    .toBeGreaterThan(0);
  await page.getByLabel("Show later parts faintly").uncheck();
  await expect
    .poll(async () => (await scene(page)).guide.ghosted, {
      timeout: 60000,
    })
    .toBe(0);
});

test("reduced motion shows each step at once", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await load(page, { text: stepped });
  await openSteps(page);
  await page.keyboard.press("ArrowRight");
  const state = await scene(page);
  expect(state.guide.animating).toBe(false);
  expect(state.guide.held).toBe(0);
  await context.close();
});

/** Visible overlay pieces that overlap each other or leave the screen. */
const overlaps = (page: Page) =>
  page.evaluate(() => {
    const pieces = [
      ".guide-top .guide-key",
      ".guide-title",
      ".guide-panel",
    ].flatMap((s) => [...document.querySelectorAll(s)]);
    const boxes = pieces.map((el) => ({
      name: el.className,
      r: el.getBoundingClientRect(),
    }));
    const found: string[] = [];
    for (const { name, r } of boxes)
      if (
        r.left < 0 ||
        r.top < 0 ||
        r.right > innerWidth ||
        r.bottom > innerHeight
      )
        found.push(name + " leaves the screen");
    boxes.forEach((a, i) =>
      boxes.slice(i + 1).forEach((b) => {
        const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (x > 1 && y > 1) found.push(`${a.name} covers ${b.name}`);
      }),
    );
    // Nothing of the editor HUD shows through.
    for (const s of [
      ".hud-top",
      ".mobile-nav",
      ".canvas-toolbar",
      ".mode-card",
    ])
      for (const el of document.querySelectorAll(s))
        if (getComputedStyle(el).display !== "none") found.push(s + " shown");
    return found;
  });

for (const viewport of [
  { width: 360, height: 600, name: "phone-portrait-small" },
  { width: 411, height: 685, name: "phone-portrait" },
  { width: 686, height: 411, name: "phone-landscape" },
])
  test(`step viewer layout at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport,
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2.625,
    });
    const page = await context.newPage();
    await load(page, { template: "house" });
    await openSteps(page);
    await settled(page);
    expect(await overlaps(page)).toEqual([]);
    // Every control is reachable at touch size.
    for (const name of [
      "Close steps",
      "Parts list",
      "Step options",
      "Next step",
      "Previous step",
    ]) {
      const box = (await page.getByRole("button", { name }).boundingBox())!;
      expect(box.height, name).toBeGreaterThanOrEqual(44);
    }
    // A quick flick left on the model steps forward.
    const canvas = (await page.locator(".viewport canvas").boundingBox())!;
    const y = canvas.y + canvas.height * 0.3;
    const cdp = await context.newCDPSession(page);
    // Event times are given, so a slow machine still sends a 150 ms flick.
    const start = Date.now() / 1000;
    const touch = (
      type: "touchStart" | "touchMove" | "touchEnd",
      x: number,
      at: number,
    ) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        timestamp: start + at,
        touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }],
      });
    await touch("touchStart", canvas.x + canvas.width * 0.55, 0);
    await touch("touchMove", canvas.x + canvas.width * 0.35, 0.05);
    await touch("touchMove", canvas.x + canvas.width * 0.15, 0.1);
    await touch("touchEnd", canvas.x + canvas.width * 0.15, 0.15);
    await expect(page.locator(".guide-title")).toContainText("Step 2");
    await settled(page);
    expect(await overlaps(page)).toEqual([]);
    await page.getByRole("button", { name: "Step options" }).click();
    const menu = (await page.locator(".guide-menu").boundingBox())!;
    expect(menu.x).toBeGreaterThanOrEqual(0);
    expect(menu.x + menu.width).toBeLessThanOrEqual(viewport.width);
    expect(menu.y + menu.height).toBeLessThanOrEqual(viewport.height);
    await context.close();
  });

test("parts list counts, searches and exports every part", async ({ page }) => {
  await load(page, { text: stepped });
  await page.getByRole("button", { name: "Export" }).click();
  await page.getByRole("button", { name: /Parts list/ }).click();
  const dialog = page.getByRole("dialog", { name: "Parts list" });
  await expect(dialog.locator(".parts-list-total")).toHaveText(
    "9 parts · 4 kinds",
  );
  await dialog.getByLabel("Group").selectOption("colour");
  await expect(dialog.locator("h3")).toHaveText([
    /Green\s*6/,
    /Red\s*2/,
    /Yellow\s*1/,
  ]);
  await dialog.getByLabel("Search parts").fill("plate 1 x 1");
  await expect(dialog.locator("li")).toHaveCount(1);
  await expect(dialog.locator("li .parts-list-count")).toHaveText("×4");
  await dialog.getByLabel("Search parts").fill("");
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download CSV" }).click();
  const csv = (await readFile((await (await download).path())!, "utf8"))
    .replace(/^﻿/, "")
    .split("\r\n");
  expect(csv[0]).toBe("Part,Name,Category,LDraw colour,Colour,Quantity");
  expect(csv.filter(Boolean)).toHaveLength(5);
  expect(csv.find((l) => l.startsWith("3024,"))).toMatch(
    /^3024,Plate 1 × 1,[^,]+,2,Green,4$/,
  );
  const rb = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Rebrickable CSV" }).click();
  const rbCsv = await readFile((await (await rb).path())!, "utf8");
  expect(rbCsv.split("\r\n")[0]).toBe("Part,Color,Quantity");
  expect(rbCsv).toContain("3001,4,2");
  await dialog.getByRole("button", { name: "Close parts list" }).click();
  await expect(dialog).toHaveCount(0);
});
