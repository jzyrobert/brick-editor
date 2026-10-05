import { test, expect } from "@playwright/test";
import { openMenuTab, openMode } from "./helpers/mode";

test("shared links preview safely, dismiss without replacement and keep the saved build when opening", async ({
  page,
}) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    const a = window.brickEditor!,
      r = await a.project.import({ format: "template", template: "room" });
    await a.ready({ minRevision: r.revision });
  });
  await openMenuTab(page, "Project", "Export");
  await page
    .getByRole("button", { name: "Create share link", exact: true })
    .click();
  const textarea = page.getByLabel("Share link", { exact: true });
  await expect(textarea).toBeVisible();
  const url = new URL(await textarea.inputValue());
  expect(url.href.length).toBeLessThan(8192);
  expect(url.search).toBe("");
  url.search = "?automation=1";
  await page.evaluate(async () => {
    await window.brickEditor!.project.import({
      format: "template",
      template: "wall",
    });
  });
  await expect(textarea).toHaveCount(0);
  await expect(page.locator(".save-state")).toContainText(
    "Saved on this device · version",
  );
  await openMode(page, "Build");
  await page.goto(url.href);
  await page.waitForFunction(() => !!window.brickEditor);
  const dialog = page.getByRole("dialog", { name: "Shared model preview" });
  await expect(dialog).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        async () => (await window.brickEditor!.query()).occurrences.length,
      ),
    )
    .toBe(40);
  await dialog.getByRole("button", { name: "Keep my current build" }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "Open shared model", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(
    (await page.evaluate(() => window.brickEditor!.query())).occurrences,
  ).toHaveLength(40);
  await page.goto(url.href);
  await expect(dialog).toBeVisible();
  // The recovered wall is saved and unchanged, so opening the shared model
  // neither asks nor downloads anything; the wall stays in the saved list.
  let downloads = 0;
  page.on("download", () => downloads++);
  await dialog
    .getByRole("button", { name: "Open shared model", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Save your current build first?" }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        async () => (await window.brickEditor!.query()).occurrences.length,
      ),
    )
    .toBe(74);
  expect(new URL(page.url()).hash).toBe("");
  expect(downloads).toBe(0);
  await openMenuTab(page, "Project", "My builds");
  await page.getByRole("button", { name: "Refresh saved projects" }).click();
  await expect(
    page.locator(".saved-project").filter({ hasText: "Brick wall" }),
  ).toBeVisible();
});
test("a damaged share checksum is rejected without changing the recovered project", async ({
  page,
}) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    await window.brickEditor!.project.import({
      format: "template",
      template: "wall",
    });
  });
  await expect(page.locator(".save-state")).toContainText(
    "Saved on this device · version",
  );
  await openMenuTab(page, "Project", "Export");
  await page
    .getByRole("button", { name: "Create share link", exact: true })
    .click();
  const area = page.getByLabel("Share link", { exact: true });
  await expect(area).toBeVisible();
  const url = new URL(await area.inputValue()),
    fragment = new URLSearchParams(url.hash.slice(1));
  fragment.set("sha256", "0".repeat(64));
  url.hash = fragment.toString();
  url.search = "?automation=1";
  await page.goto(url.href);
  await expect(page.locator(".share-panel [role=status]")).toContainText(
    /checksum/i,
  );
  await expect(
    page.getByRole("dialog", { name: "Shared model preview" }),
  ).toHaveCount(0);
  expect(
    (await page.evaluate(() => window.brickEditor!.query())).occurrences,
  ).toHaveLength(40);
});
