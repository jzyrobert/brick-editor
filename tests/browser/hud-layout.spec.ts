import { playSourceState } from "./helpers/play-source-state";
import { realMechanismsFixture } from "./helpers/real-mechanisms";
import { test, expect, type Page } from "@playwright/test";
import { openMenuTab, openMode, openTool } from "./helpers/mode";
import {
  closeRemoteControls,
  dismissRotatePrompt,
  openRemoteControls,
} from "./helpers/play";

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
  ".site-header",
  ".model-heading",
  ".model-tools-toggle",
  ".hud-top .workspace-tool-label",
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

/** Wait for running one-shot CSS animations (sheets rising) to finish. */
const settle = (page: Page) =>
  page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );

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
    test.setTimeout(180000);
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
    // Let fades settle so a half-faded slot is not counted twice, and let a
    // rising sheet finish (a slow software-GL frame can outlast 300 ms).
    const check = async (state: string) => {
      await page.waitForTimeout(300);
      await settle(page);
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
        position: [-40, -560, 120],
        target: [-40, -192, 0],
        up: [0, -1, 0],
        fovDeg: 40,
        near: 1,
        far: 5000,
      }),
    );
    // Project the roof's stud surface after the camera update. The new header
    // changes the canvas height; fixed screen fractions no longer hit the roof.
    const point = await page.evaluate(async () => {
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
      const scene = window.__brickScene as {
        camera: {
          updateMatrixWorld: (force: boolean) => void;
          position: {
            constructor: new (
              x: number,
              y: number,
              z: number,
            ) => { project(c: unknown): { x: number; y: number } };
          };
        };
        renderer: { domElement: HTMLCanvasElement };
      };
      scene.camera.updateMatrixWorld(true);
      const p = new scene.camera.position.constructor(0, 216, 0).project(
        scene.camera,
      );
      const box = scene.renderer.domElement.getBoundingClientRect();
      return {
        x: box.left + ((p.x + 1) * box.width) / 2,
        y: box.top + ((1 - p.y) * box.height) / 2,
      };
    });
    await page.touchscreen.tap(point.x, point.y);
    await expect(button("Next fit")).toBeVisible();
    await check("placing with connector fits");
    await page.screenshot({
      path: test.info().outputPath("placement-fits.png"),
      animations: "disabled",
    });
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
    await openTool(page, "Selection tools");
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
    // The selection shows in the Inspector; Box select is back in Tools.
    await openTool(page, "Selection tools");
    await check("Tools tab");
    // Box select mode: the sheet steps aside for its chip of switches.
    await page.getByRole("button", { name: "Box or lasso select" }).click();
    await expect(page.getByRole("group", { name: "Box select" })).toBeVisible();
    await check("box select mode");
    await page
      .getByRole("group", { name: "Box select" })
      .getByRole("button", { name: "Done" })
      .click();

    // Every tab of every section menu.
    for (const mode of ["Instructions", "Photo", "Project", "Play"] as const) {
      await openMode(page, mode);
      await check(`${mode} menu`);
      const tabs = page.locator(".mode-card").getByRole("tab");
      for (const tab of await tabs.all()) {
        if (!(await tab.isVisible())) continue;
        const name = (await tab.textContent())!;
        await openMenuTab(page, mode, name);
        await check(`${mode} › ${name}`);
      }
    }
    expect(errors).toEqual([]);
    await context.close();
  });

// Every Play control slot. The look layer and the stick's thumb zone are
// full-area touch surfaces behind them, so they are not slots.
const PLAY_SLOTS = [
  ".play-status-slab",
  ".play-train",
  ".play-start-hint",
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
    await page.evaluate(async (realFixtureBytes: number[]) => {
      const a = window.brickEditor!;
      await a.project.import({ format: "native", bytes: realFixtureBytes });
      await a.ready();
    }, realFixture.bytes);
    const source = await playSourceState(page);
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
    // Nothing in reach: no action is offered at all, not even a greyed one.
    await page.evaluate(() =>
      window.brickEditor!.play.teleport({
        position: [400, -0.3, 400],
        policy: "safe",
      }),
    );
    await expect(page.locator(".play-interaction")).toHaveCount(0);
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
    // Remote controls are rarely needed: a pause-menu tile, not a HUD key.
    await openRemoteControls(page);
    await check("remote mechanism controls");
    await closeRemoteControls(page);
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
        position: [frame.position[0] - 90, -0.3, frame.position[2] + 40],
        policy: "safe",
      });
    });
    await page.getByRole("button", { name: "Drive from here" }).click();
    await expect(
      page.getByRole("button", { name: "Stop driving" }),
    ).toBeVisible();
    await check("controlling a vehicle");
    await page.screenshot({
      path: test
        .info()
        .outputPath(`play-hud-${viewport.width}x${viewport.height}.png`),
    });
    await page.evaluate(() => window.brickEditor!.play.exit());
    expect(await playSourceState(page)).toEqual(source);
    expect(errors).toEqual([]);
    await context.close();
  });

// The railway station sample adds the train slab under the top row.
for (const viewport of [
  { width: 360, height: 600 },
  { width: 600, height: 360 },
  { width: 800, height: 360 },
])
  test(`Train controls never overlap at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }) => {
    test.setTimeout(180000);
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
      await a.project.import({ format: "template", template: "train" });
      await a.ready();
    });
    const slots = PLAY_SLOTS;
    const check = async (state: string) => {
      await page.waitForTimeout(300);
      expect(await collisions(page, slots), state).toEqual([]);
    };
    await openMode(page, "Play");
    await page.getByRole("button", { name: "Enter Play", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible({
      timeout: 60000,
    });
    await dismissRotatePrompt(page);
    await expect(page.locator(".play-train")).toBeVisible();
    // At rest the train is one chip (status and Go); the rest is a drawer.
    await expect(page.locator(".play-train-drawer")).toHaveCount(0);
    await check("train stopped");
    // The sample hint gives way to Drag to look after six seconds. Exercise
    // that real timed state before its own six-second lifetime can expire.
    await page.getByRole("button", { name: "Start the train" }).tap();
    // Capture opacity and both rectangles in one browser frame: a slow host
    // must not turn the assertion into a check after the hint has disappeared.
    const hintGeometry = await (
      await page.waitForFunction(
        () => {
          const hint = document.querySelector(".play-look-hint"),
            train = document.querySelector(".play-train");
          if (!hint || !train || Number(getComputedStyle(hint).opacity) <= 0.5)
            return false;
          const h = hint.getBoundingClientRect(),
            t = train.getBoundingClientRect();
          return {
            x: Math.min(h.right, t.right) - Math.max(h.left, t.left),
            y: Math.min(h.bottom, t.bottom) - Math.max(h.top, t.top),
          };
        },
        undefined,
        { timeout: 15000 },
      )
    ).jsonValue();
    if (!hintGeometry)
      throw new Error("The visible look hint was not captured.");
    expect(
      Math.min(hintGeometry.x, hintGeometry.y),
      "train running with the visible timed look hint",
    ).toBeLessThanOrEqual(1);
    await check("train running with the timed look hint");
    await page.getByRole("button", { name: "Stop the train" }).tap();
    const chip = page.locator("button.play-train-chip");
    await chip.tap();
    await expect(chip).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByRole("button", { name: "Ride along" }),
    ).toBeVisible();
    await check("train drawer open");
    await chip.tap();
    await expect(page.locator(".play-train-drawer")).toHaveCount(0);
    // Beside the locomotive the action says what it does: Drive train rides
    // in the cab with the drawer open; walking controls step aside.
    const loco = await page.evaluate(
      async () =>
        (await window.brickEditor!.play.snapshot()).trains!.trains[0].position,
    );
    await page.evaluate(
      (p) =>
        window.brickEditor!.play.teleport({
          position: [p[0], -0.3, p[2] - 120],
          policy: "safe",
        }),
      loco,
    );
    await page.getByRole("button", { name: "Drive train" }).tap();
    await expect(page.locator(".play-status")).toContainText("Riding");
    await expect(page.locator(".play-train-drawer")).toBeVisible();
    await expect(page.locator(".play-stick")).toHaveCount(0);
    await expect(page.locator(".play-actions")).toHaveCount(0);
    await check("driving the train");
    await page.getByRole("button", { name: "Get off train" }).tap();
    await expect(page.locator(".play-stick")).toBeVisible();
    await expect(page.locator(".play-train-drawer")).toHaveCount(0);
    // The train pulls off the points; beside them their action joins the HUD.
    await page.getByRole("button", { name: "Start the train" }).tap();
    await page.evaluate(() => window.brickEditor!.play.stepTicks(600));
    await check("train running");
    const points = await page.evaluate(
      async () =>
        (await window.brickEditor!.play.snapshot()).trains!.switches[0]
          .position,
    );
    await page.evaluate(
      (p) =>
        window.brickEditor!.play.teleport({
          position: [p[0], -0.3, p[2] - 110],
          policy: "safe",
        }),
      points,
    );
    await expect(page.locator(".play-interaction .play-prompt")).toBeEnabled();
    await check("near the points");
    await chip.tap();
    await page.getByRole("button", { name: "Ride along" }).tap();
    await check("riding along");
    await page.screenshot({
      path: test
        .info()
        .outputPath(`play-train-hud-${viewport.width}x${viewport.height}.png`),
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
      for (const selector of selectors.flatMap((s) =>
        s === ".site-header" ? [".site-header button"] : [s],
      ))
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
      // The canvas fills the workspace below the persistent primary header,
      // including its side and bottom insets.
      const canvas = document
        .querySelector(".viewport canvas")!
        .getBoundingClientRect();
      if (
        Math.abs(canvas.left) > 1 ||
        Math.abs(
          canvas.top -
            document.querySelector(".site-header")!.getBoundingClientRect()
              .bottom,
        ) > 1 ||
        Math.abs(canvas.right - innerWidth) > 1 ||
        Math.abs(canvas.bottom - innerHeight) > 1
      )
        found.push("the canvas does not fill the workspace");
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
    await shot("placing");
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

const realFixture = realMechanismsFixture();
