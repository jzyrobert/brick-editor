import { expect, type Page } from "@playwright/test";

export type EditorMode =
  | "Build"
  | "Instructions"
  | "Photo"
  | "Play"
  | "Project";
/** The main Play mode and the four model tools share the current document. */
export async function openMode(page: Page, mode: EditorMode) {
  if (mode === "Play") {
    await page
      .getByRole("navigation", { name: "Main modes" })
      .getByRole("button", { name: "Play", exact: true })
      .click();
    await expect(page.locator(".app")).toHaveClass(/mode-play/);
    await expect(page.locator(".gallery-page")).toHaveCount(0);
    const settings = page.getByRole("button", {
      name: "Play settings",
      exact: true,
    });
    if (
      (await settings.isVisible()) &&
      (await settings.getAttribute("aria-expanded")) !== "true"
    )
      await settings.click();
    return;
  }
  const toggle = page.getByRole("button", { name: "Model tools", exact: true });
  if ((await toggle.getAttribute("aria-expanded")) !== "true")
    await toggle.click();
  await page
    .getByRole("navigation", { name: "Editor mode" })
    .getByRole("button", { name: mode, exact: true })
    .click();
}

/** Open a mode's menu at one of its tabs (src/ui/menus.ts), e.g.
 * `openMenuTab(page, "Project", "My builds")`. */
export async function openMenuTab(page: Page, mode: EditorMode, tab: string) {
  await openMode(page, mode);
  await page
    .locator(".mode-card")
    .getByRole("tab", { name: tab, exact: true })
    .click();
}

/** Project › New shows four templates until asked for all of them. */
export async function showAllTemplates(page: Page) {
  const more = page.getByRole("button", { name: /^Show all \d+ templates$/ });
  if (await more.isVisible()) await more.click();
}

/** The Inspector's Tools tab (on a phone, open the Inspector sheet first). */
export async function openTools(page: Page) {
  await page
    .locator(".right-tabs")
    .getByRole("button", { name: "Tools", exact: true })
    .click();
}

/** Back from Tools to the Inspector's properties. */
export async function openInspector(page: Page) {
  await page
    .locator(".right-tabs")
    .getByRole("button", { name: "Inspector", exact: true })
    .click();
}

/** One of the Inspector's tools (a drawer in the Tools tab), opened. */
export async function openTool(page: Page, name: string) {
  await openTools(page);
  const summary = page
    .locator(".menu-tools summary")
    .filter({ hasText: name })
    .first();
  const open = await summary.evaluate(
    (s) => (s.parentElement as HTMLDetailsElement).open,
  );
  if (!open) await summary.click();
}
