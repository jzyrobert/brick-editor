import { test, expect, type Page } from "@playwright/test";
import { openMode } from "./helpers/mode";
import { dismissRotatePrompt } from "./helpers/play";

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
const collisions = (page: Page, list: string[] = SLOTS) =>
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
  }, list);

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
    // Browsing every LDraw part (rendered thumbnails, variant buttons) keeps
    // the same sheet layout.
    await hotbar.getByRole("button", { name: "Parts", exact: true }).click();
    const partsSheet = page.locator(".mobile-panel.mobile-open");
    await partsSheet.getByRole("button", { name: /^All LDraw parts/ }).click();
    await expect(
      partsSheet.locator(".full-library .part-thumb.atlas.loaded").first(),
    ).toBeVisible({ timeout: 20000 });
    await check("Parts sheet browsing every LDraw part");
    await partsSheet.getByRole("button", { name: "Catalogue" }).click();
    await hotbar.getByRole("button", { name: "Parts", exact: true }).click();
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

// Every Play control slot. The look layer and the stick's thumb zone are
// full-area touch surfaces behind them, so they are not slots.
const PLAY_SLOTS = [
  ".play-status-slab",
  ".play-mechanism-key",
  ".play-mechanism",
  ".play-stick",
  ".play-actions",
  ".play-interaction",
  ".play-menu",
  ".play-message",
  ".play-look-hint",
];

for (const viewport of [
  { width: 360, height: 600 },
  { width: 600, height: 360 },
  { width: 800, height: 360 },
])
  test(`Play controls never overlap at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }) => {
    test.setTimeout(120000);
    const context = await browser.newContext({
      viewport,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("./?automation=1");
    await page.waitForFunction(() => !!window.brickEditor);
    await page.evaluate(async () => {
      const a = window.brickEditor!;
      await a.project.import({ format: "template", template: "mechanisms" });
      await a.ready();
    });
    const button = (name: string) =>
      page.getByRole("button", { name, exact: true });
    const check = async (state: string, list = PLAY_SLOTS) => {
      await page.waitForTimeout(300);
      expect(await collisions(page, list), state).toEqual([]);
    };
    const portrait = viewport.height > viewport.width;
    await openMode(page, "Play");
    await button("Enter Play").click();
    await expect(button("Pause")).toBeVisible({ timeout: 30000 });
    const rotate = page.getByRole("dialog", {
      name: "Rotate your phone for the best view",
    });
    // Only a phone held upright is asked to rotate.
    await expect(rotate).toHaveCount(portrait ? 1 : 0);
    if (portrait) {
      await check("rotate prompt", [".play-rotate-card"]);
      await dismissRotatePrompt(page);
      await expect(rotate).toHaveCount(0);
    }
    await check("walking");
    // Beside the door: its action appears above the action cluster.
    await page.evaluate(() =>
      window.brickEditor!.play.teleport({
        position: [20, -0.3, 45],
        policy: "safe",
      }),
    );
    await expect(
      page.getByRole("button", { name: "Open joint" }),
    ).toBeVisible();
    await check("near a door");
    await page.evaluate(() =>
      window.brickEditor!.play.setLocomotion("fly-noclip"),
    );
    await expect(button("Down")).toBeVisible();
    await check("flying");
    await page.evaluate(() => window.brickEditor!.play.setLocomotion("walk"));
    await page
      .getByRole("button", { name: "Remote mechanism controls" })
      .click();
    await expect(page.locator(".play-mechanism")).toBeVisible();
    await check("remote mechanism controls");
    await button("Back to nearby actions").click();
    await button("Pause").click();
    await expect(page.locator(".play-menu")).toBeVisible();
    await check("pause menu");
    await button("Resume exploring").click();
    // Remote vehicle control swaps the actions for the vehicle's own.
    await page.evaluate(async () => {
      const api = window.brickEditor!,
        report = await api.play.snapshot(),
        frame = report.mechanisms!.vehicle.groupFrames.chassis;
      return api.play.teleport({
        position: [frame.position[0], -0.3, frame.position[2] + 60],
        policy: "safe",
      });
    });
    await page.getByRole("button", { name: "Control vehicle" }).click();
    await expect(
      page.getByRole("button", { name: "Release vehicle" }),
    ).toBeVisible();
    await check("controlling a vehicle");
    await page.screenshot({
      path: test
        .info()
        .outputPath(`play-hud-${viewport.width}x${viewport.height}.png`),
    });
    await page.evaluate(() => window.brickEditor!.play.exit());
    expect(errors).toEqual([]);
    await context.close();
  });

// Notched phones: the page runs edge to edge (viewport-fit=cover). Playwright
// cannot emulate safe-area insets, so the test sets the --safe-* tokens that
// default to env(safe-area-inset-*) (src/ui/tokens.css).
type Insets = { top: number; right: number; bottom: number; left: number };
/** Sheets and menus whose background runs under the insets by design; only
 * their content (the box inside their padding) must clear them. */
const EDGE_SHEETS = [".mobile-panel.mobile-open", ".mode-card", ".play-menu"];
const insetViolations = (page: Page, insets: Insets, list: string[]) =>
  page.evaluate(
    ({ insets, selectors, sheets }) => {
      const shown = (el: Element | null): boolean => {
        for (; el; el = el.parentElement) {
          const s = getComputedStyle(el);
          if (s.display === "none" || s.visibility === "hidden") return false;
          if (Number(s.opacity) < 0.05) return false;
        }
        return true;
      };
      const found: string[] = [];
      for (const selector of selectors)
        for (const el of document.querySelectorAll(selector)) {
          if (!shown(el)) continue;
          const r = el.getBoundingClientRect();
          if (r.width <= 1 || r.height <= 1) continue;
          const s = getComputedStyle(el);
          const pad = sheets.some((sheet) => el.matches(sheet))
            ? {
                top: parseFloat(s.paddingTop),
                right: parseFloat(s.paddingRight),
                bottom: parseFloat(s.paddingBottom),
                left: parseFloat(s.paddingLeft),
              }
            : { top: 0, right: 0, bottom: 0, left: 0 };
          const box = {
            top: r.top + pad.top,
            right: r.right - pad.right,
            bottom: r.bottom - pad.bottom,
            left: r.left + pad.left,
          };
          if (box.top < insets.top - 1)
            found.push(`${selector} under the top inset`);
          if (box.left < insets.left - 1)
            found.push(`${selector} under the left inset`);
          if (box.right > innerWidth - insets.right + 1)
            found.push(`${selector} under the right inset`);
          if (box.bottom > innerHeight - insets.bottom + 1)
            found.push(`${selector} under the bottom inset`);
        }
      // The canvas alone fills the whole screen, insets included.
      const canvas = document
        .querySelector(".viewport canvas")!
        .getBoundingClientRect();
      if (
        Math.abs(canvas.left) > 1 ||
        Math.abs(canvas.top) > 1 ||
        Math.abs(canvas.right - innerWidth) > 1 ||
        Math.abs(canvas.bottom - innerHeight) > 1
      )
        found.push("the canvas does not fill the screen");
      return found;
    },
    { insets, selectors: list, sheets: EDGE_SHEETS },
  );

for (const { name, viewport, insets } of [
  {
    name: "portrait",
    viewport: { width: 411, height: 686 },
    insets: { top: 44, right: 0, bottom: 34, left: 0 },
  },
  {
    name: "landscape",
    viewport: { width: 686, height: 411 },
    insets: { top: 0, right: 44, bottom: 21, left: 44 },
  },
])
  test(`notched phone (${name}): editor and Play HUD clear the safe areas`, async ({
    browser,
  }) => {
    test.setTimeout(150000);
    const context = await browser.newContext({
      viewport,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("./?automation=1");
    await page.waitForFunction(() => !!window.brickEditor);
    expect(
      await page.locator('meta[name="viewport"]').getAttribute("content"),
    ).toContain("viewport-fit=cover");
    await page.addStyleTag({
      content: `:root { --safe-top: ${insets.top}px; --safe-right: ${insets.right}px; --safe-bottom: ${insets.bottom}px; --safe-left: ${insets.left}px; }`,
    });
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
    const shot = (state: string) =>
      page.screenshot({
        path: test.info().outputPath(`notched-${name}-${state}.png`),
      });
    const check = async (state: string, list = SLOTS) => {
      await page.waitForTimeout(300);
      expect(await insetViolations(page, insets, list), state).toEqual([]);
      expect(await collisions(page, list), state).toEqual([]);
    };
    await check("idle");
    await shot("editor");
    await button("Place").click();
    await check("placing");
    await button("Cancel").click();
    await button("Camera views").click();
    await check("camera views");
    await button("Camera views").click();
    await hotbar.getByRole("button", { name: "Parts", exact: true }).click();
    await check("parts sheet");
    await shot("parts");
    await hotbar.getByRole("button", { name: "Parts", exact: true }).click();
    await openMode(page, "Project");
    await check("project card");
    await openMode(page, "Play");
    await check("play card");
    await button("Enter Play").click();
    await expect(button("Pause")).toBeVisible({ timeout: 30000 });
    await dismissRotatePrompt(page);
    await check("walking", PLAY_SLOTS);
    await page.evaluate(() =>
      window.brickEditor!.play.setCameraMode("third-person"),
    );
    await page.waitForTimeout(500);
    await shot("play");
    await button("Pause").click();
    await check("pause menu", PLAY_SLOTS);
    await page.evaluate(() => window.brickEditor!.play.exit());
    expect(errors).toEqual([]);
    await context.close();
  });
