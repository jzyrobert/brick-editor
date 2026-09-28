import { test, expect, type Page } from "@playwright/test";
import { openMode } from "./helpers/mode";

// Three storeys as submodels, so floors, explode and the section cut all have work to do.
const house = `0 FILE house.ldr
1 16 0 0 0 1 0 0 0 1 0 0 0 1 ground.ldr
1 16 0 -96 0 1 0 0 0 1 0 0 0 1 upper.ldr
1 16 0 -192 0 1 0 0 0 1 0 0 0 1 roof.ldr
0 FILE ground.ldr
1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 4 80 0 0 1 0 0 0 1 0 0 0 1 3001.dat
0 FILE upper.ldr
1 1 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
0 FILE roof.ldr
1 14 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat`;

// Every floating HUD slot; none may cover another or leave the screen.
const SLOTS = [
  ".hud-top .mode-tabs:not(.open)",
  ".hud-top .header-actions > *",
  ".canvas-toolbar",
  ".tool-more-menu",
  ".mobile-nav",
  ".canvas-bottom",
  ".status-bar",
  ".placement-card",
  ".view-controls",
  ".mobile-panel.mobile-open",
  ".mode-card",
  ".measure-chip",
];

/** Pairs of visible HUD slots whose boxes intersect, plus slots cut off by the screen edge. */
const collisions = (page: Page) =>
  page.evaluate((selectors) => {
    const shown = (el: Element | null): boolean => {
      for (; el; el = el.parentElement) {
        const s = getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden") return false;
        if (Number(s.opacity) < 0.05) return false;
      }
      return true;
    };
    const slots = selectors.flatMap((selector) =>
      [...document.querySelectorAll(selector)]
        .filter(shown)
        .map((el) => ({ selector, el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 1 && r.height > 1),
    );
    const found: string[] = [];
    for (const { selector, r } of slots)
      if (
        r.left < -1 ||
        r.top < -1 ||
        r.right > innerWidth + 1 ||
        r.bottom > innerHeight + 1
      )
        found.push(`${selector} leaves the screen`);
    slots.forEach((a, i) =>
      slots.slice(i + 1).forEach((b) => {
        if (a.el.contains(b.el) || b.el.contains(a.el)) return;
        const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (x > 1 && y > 1) found.push(`${a.selector} covers ${b.selector}`);
      }),
    );
    return found;
  }, SLOTS);

for (const viewport of [
  { width: 360, height: 600 },
  { width: 411, height: 685 },
])
  test(`HUD slots never overlap at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport, hasTouch: true });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("./?automation=1");
    await page.waitForFunction(() => !!window.brickEditor);
    await page.evaluate(
      (text) =>
        window
          .brickEditor!.project.import({ format: "ldraw", text })
          .then(() => window.brickEditor!.ready()),
      house,
    );
    const sheetClose = page
      .locator(".mobile-panel.mobile-open .mobile-sheet-head")
      .getByRole("button", { name: "Close" });
    if (await sheetClose.isVisible()) await sheetClose.click();
    const button = (name: string) =>
      page.getByRole("button", { name, exact: true });
    const hotbar = page.getByRole("navigation", { name: "Mobile panels" });
    // Let fades settle so a half-faded slot is not counted twice.
    const check = async (state: string) => {
      await page.waitForTimeout(300);
      expect(await collisions(page), state).toEqual([]);
    };

    await check("idle");
    await button("Place").click();
    await check("placing");
    // A tap on a brick offers several connector fits: the card gains Next fit.
    await page.evaluate(() =>
      window.brickEditor!.camera.set({
        space: "ldraw",
        projection: "perspective",
        position: [0, -560, 120],
        target: [0, -192, 0],
        up: [0, -1, 0],
        fovDeg: 40,
        near: 1,
        far: 5000,
      }),
    );
    const canvas = (await page.locator(".viewport canvas").boundingBox())!;
    await page.touchscreen.tap(
      canvas.x + canvas.width / 2,
      canvas.y + canvas.height / 2,
    );
    await expect(button("Next fit")).toBeVisible();
    await check("placing with connector fits");
    await button("Place part").click();
    await expect(page.locator(".status-bar.fresh")).toBeVisible();
    await check("placing with a status message");
    await button("Cancel").click();

    await button("More tools").click();
    await check("more tools menu");
    await button("Measure").click();
    await check("measuring");
    await button("Select").click();

    await button("Camera views").click();
    await check("camera views");
    await button("Cut").click();
    await button("Section cut").click();
    await check("section cut with its message");
    await button("Section cut").click();
    await button("Floors").click();
    await button("Detect floors").click();
    await check("floors");
    await button("Look").click();
    await check("look");
    await button("Camera views").click();

    for (const sheet of ["Parts", "Layers", "Inspector"]) {
      await hotbar.getByRole("button", { name: sheet, exact: true }).click();
      await check(`${sheet} sheet`);
      await hotbar.getByRole("button", { name: sheet, exact: true }).click();
    }
    await hotbar
      .getByRole("button", { name: "Inspector", exact: true })
      .click();
    await page.getByText("Selection tools", { exact: true }).click();
    await button("Select editable parts").click();
    await check("inspector with a selection and a message");
    await page
      .locator(".mobile-panel.mobile-open")
      .getByRole("button", { name: "Expand panel" })
      .click();
    await check("full-height sheet with a message");
    await page
      .locator(".mobile-panel.mobile-open")
      .getByRole("button", { name: "Collapse panel" })
      .click();
    await hotbar
      .getByRole("button", { name: "Inspector", exact: true })
      .click();

    for (const mode of ["Instructions", "Photo", "Project", "Play"] as const) {
      await openMode(page, mode);
      await check(`${mode} card`);
    }
    expect(errors).toEqual([]);
    await context.close();
  });
