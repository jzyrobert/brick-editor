import type { Page } from "@playwright/test";

export type EditorMode =
  | "Build"
  | "Instructions"
  | "Photo"
  | "Play"
  | "Project";
/** Switch editor mode as a user would: on phones the current mode is a chip that
 * opens the switcher, so open it first when the target mode is not shown. */
export async function openMode(page: Page, mode: EditorMode) {
  const nav = page.getByRole("navigation", { name: "Editor mode" });
  const button = nav.getByRole("button", { name: mode, exact: true });
  if (!(await button.isVisible())) await nav.locator("button.active").click();
  await button.click();
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
