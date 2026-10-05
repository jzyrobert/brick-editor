import { expect, type Page } from "@playwright/test";

/**
 * Tap Enter Play as a player would. On a phone held upright Play first asks
 * to rotate to landscape; tests carry on in portrait, as a player may.
 */
export async function enterPlay(page: Page, name = "Enter Play") {
  await page.getByRole("button", { name, exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await dismissRotatePrompt(page);
}

export async function dismissRotatePrompt(page: Page) {
  const portrait = page.getByRole("button", {
    name: "Keep portrait",
  });
  if (await portrait.isVisible()) await portrait.click();
}

/** Exit Play lives in the pause menu: open it first when Play is running. */
export async function exitPlay(page: Page) {
  const exit = page.getByRole("button", { name: "Exit Play", exact: true });
  if (!(await exit.isVisible()))
    await page.getByRole("button", { name: "Pause", exact: true }).click();
  await exit.click();
}

/** Open usable mechanism controls directly from the active Play HUD; the pause menu retains the same action. */
export async function openRemoteControls(page: Page) {
  const controls = page.getByRole("button", {
    name: "Open mechanism controls",
    exact: true,
  });
  if (await controls.isVisible()) {
    await controls.click();
    await expect(page.locator(".play-mechanism")).toBeVisible();
    return;
  }
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page
    .locator(".play-menu .play-tile")
    .filter({ hasText: /controls$/ })
    .click();
  await expect(page.locator(".play-mechanism")).toBeVisible();
}

/** Close the remote controls panel: nearby actions come back. */
export async function closeRemoteControls(page: Page) {
  await page.locator(".play-mechanism .play-mechanism-close").click();
  await expect(page.locator(".play-mechanism")).toHaveCount(0);
}

/** Camera and movement switches live in the pause menu; this opens it, runs
 * the change and resumes. */
export async function fromPauseMenu(page: Page, button: string) {
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: button, exact: true }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
}
