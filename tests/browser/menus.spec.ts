import { TEMPLATE_CARDS } from "../../src/catalog/template-names";
import { test, expect, type Page } from "@playwright/test";
import {
  openMenuTab,
  openMode,
  openTools,
  showAllTemplates,
} from "./helpers/mode";

/**
 * Section menus (src/ui/menus.ts): pinned actions over task tabs. Every tab
 * shows its sections without covering another HUD slot or leaving the
 * screen, on a phone on its side and on a desktop (hud-layout.spec covers
 * phones held upright), and the Inspector's Tools tab does the same.
 */
const SLOTS = [
  ".site-header",
  ".model-heading",
  ".model-tools-toggle",
  ".hud-top .workspace-tool-label",
  ".hud-top .header-actions > *",
  ".canvas-toolbar",
  ".mobile-nav",
  ".canvas-bottom",
  ".status-bar",
  ".view-controls",
  ".mobile-panel.mobile-open",
  ".mode-card",
];

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

const TABS = {
  Project: ["New", "My builds", "Export", "Settings"],
  Photo: ["Picture", "Saved views", "Quality"],
  Instructions: ["Step plans", "Publish"],
  Play: ["Mechanisms", "Layers & ground", "Keyboard"],
} as const;

for (const { name, viewport, touch } of [
  {
    name: "phone on its side",
    viewport: { width: 685, height: 411 },
    touch: true,
  },
  { name: "desktop", viewport: { width: 1440, height: 900 }, touch: false },
])
  test(`every menu tab opens without overlaps (${name})`, async ({
    browser,
  }) => {
    test.setTimeout(180000);
    const context = await browser.newContext({
      viewport,
      hasTouch: touch,
      isMobile: touch,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("./?automation=1");
    await page.waitForFunction(() => !!window.brickEditor);
    await page.evaluate(async () => {
      const a = window.brickEditor!;
      await a.project.import({ format: "template", template: "mechanisms" });
      const q = await a.query();
      await a.dispatch({
        schemaVersion: 1,
        commandId: crypto.randomUUID(),
        expectedRevision: q.revision,
        type: "instructions.layers",
        payload: { maxPerStep: 10 },
      });
      await a.ready();
    });
    const sheetClose = page
      .locator(".mobile-panel.mobile-open .mobile-sheet-head")
      .getByRole("button", { name: "Close" });
    if (await sheetClose.isVisible()) await sheetClose.click();
    const check = async (state: string) => {
      await page.waitForTimeout(250);
      expect(await collisions(page), state).toEqual([]);
    };
    for (const [mode, tabs] of Object.entries(TABS) as [
      keyof typeof TABS,
      readonly string[],
    ][]) {
      for (const tab of tabs) {
        // Keyboard settings only show with a keyboard and mouse.
        if (touch && tab === "Keyboard") {
          await expect(
            page.locator(".mode-card").getByRole("tab", { name: tab }),
          ).toBeHidden();
          continue;
        }
        await openMenuTab(page, mode, tab);
        const panel = page.locator(".mode-card").getByRole("tabpanel");
        await expect(panel).toBeVisible();
        await expect(panel).not.toBeEmpty();
        await check(`${mode} › ${tab}`);
      }
    }
    // The Inspector's Tools: a tab beside Inspector, drawers inside.
    await openMode(page, "Build");
    if (touch)
      await page
        .getByRole("navigation", { name: "Mobile panels" })
        .getByRole("button", { name: "Inspector", exact: true })
        .click();
    await openTools(page);
    const tools = page.locator(".menu-tools");
    await expect(tools).toBeVisible();
    for (const summary of await tools.locator("summary").all()) {
      await summary.click();
      await check(`Tools › ${await summary.textContent()}`);
    }
    expect(errors).toEqual([]);
    await context.close();
  });

test("menus remember their tab, keep templates short and return to the Inspector after selecting", async ({
  page,
}) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.project.import({ format: "template", template: "wall" });
    await a.ready();
  });
  // Project opens on New with four templates; the rest are a tap away.
  await openMode(page, "Project");
  const cards = page.locator(".mode-card .template-card");
  await expect(cards).toHaveCount(4);
  await showAllTemplates(page);
  await expect(cards).toHaveCount(TEMPLATE_CARDS.length);
  // Back in Project, the last tab is still open.
  await openMenuTab(page, "Project", "Settings");
  await openMode(page, "Build");
  await openMode(page, "Project");
  await expect(
    page.locator(".mode-card").getByRole("tab", { name: "Settings" }),
  ).toHaveAttribute("aria-selected", "true");
  // A selection made in Tools shows in the Inspector.
  await openMode(page, "Build");
  await openTools(page);
  await page
    .locator(".menu-tools summary", { hasText: "Selection tools" })
    .click();
  await page
    .getByRole("button", { name: "Select editable parts", exact: true })
    .click();
  await expect(page.locator(".selection-summary")).toBeVisible();
  await expect(page.locator(".menu-tools")).toBeHidden();
});
