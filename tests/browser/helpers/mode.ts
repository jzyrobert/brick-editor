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
