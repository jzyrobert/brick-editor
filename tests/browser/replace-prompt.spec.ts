import { test, expect, type Page } from "@playwright/test";
import { openMode } from "./helpers/mode";

/** A 40-brick build that has been changed since it was opened. */
async function changedBuild(page: Page, title: string) {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async (title) => {
    const a = window.brickEditor!;
    await a.project.import({ format: "template", template: "wall" });
    const s = await a.project.status();
    await a.dispatch({
      schemaVersion: 1,
      commandId: crypto.randomUUID(),
      expectedRevision: s.revision,
      type: "project.rename",
      payload: { title },
    });
    await a.ready();
  }, title);
  await expect(page.getByLabel("Project title")).toHaveValue(title);
}
/** Opening a few-hundred-part template compiles its parts on the main thread;
 * software WebGL on the test VM takes several seconds. */
const LOAD = 60000;
test.describe.configure({ timeout: 180000 });
const savedRow = (page: Page, title: string) =>
  page.locator(".saved-project").filter({ hasText: title });
const count = (page: Page) =>
  page.evaluate(
    async () => (await window.brickEditor!.query()).occurrences.length,
  );

test.describe("replacing a changed build asks to save or discard it", () => {
  let downloads = 0;
  test.beforeEach(({ page }) => {
    downloads = 0;
    page.on("download", () => downloads++);
  });
  test.afterEach(() => {
    // Nothing is ever downloaded automatically any more.
    expect(downloads).toBe(0);
  });

  test("Save keeps the old build in the saved list", async ({ page }) => {
    await changedBuild(page, "Keep this wall");
    await openMode(page, "Project");
    await page.getByRole("button", { name: "House with garden" }).click();
    const dialog = page.getByRole("dialog", {
      name: "Save your current build first?",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("the House with garden template");
    await expect(dialog).toContainText("“Keep this wall”");
    // Keyboard: the primary action has focus and Tab stays in the dialog.
    await expect(
      dialog.getByRole("button", { name: "Save and continue" }),
    ).toBeFocused();
    for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
    await expect(
      dialog.getByRole("button", { name: "Save and continue" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0, { timeout: LOAD });
    await expect(page.getByLabel("Project title")).toHaveValue(
      "House with garden",
      { timeout: LOAD },
    );
    await openMode(page, "Project");
    await page.getByRole("button", { name: "Refresh saved projects" }).click();
    await expect(savedRow(page, "Keep this wall")).toBeVisible();
    // Reopening it: the house is untouched, so no prompt; the wall is intact.
    await savedRow(page, "Keep this wall")
      .getByRole("button", { name: "Open saved project" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByLabel("Project title")).toHaveValue(
      "Keep this wall",
    );
    expect(await count(page)).toBe(40);
  });

  test("Discard replaces the build without saving it", async ({ page }) => {
    await changedBuild(page, "Throw this away");
    await openMode(page, "Project");
    await page.getByRole("button", { name: "Small castle" }).click();
    const dialog = page.getByRole("dialog", {
      name: "Save your current build first?",
    });
    await dialog.getByRole("button", { name: "Discard" }).click();
    await expect(dialog).toHaveCount(0, { timeout: LOAD });
    await expect(page.getByLabel("Project title")).toHaveValue("Small castle", {
      timeout: LOAD,
    });
    await expect(page.locator(".save-state")).toHaveText(/^Saved revision/);
    await openMode(page, "Project");
    await page.getByRole("button", { name: "Refresh saved projects" }).click();
    await expect(savedRow(page, "Small castle")).toBeVisible();
    await expect(savedRow(page, "Throw this away")).toHaveCount(0);
  });

  test("Cancel and Escape keep the current build", async ({ page }) => {
    await changedBuild(page, "Still here");
    await openMode(page, "Project");
    const card = page.getByRole("button", { name: "Roadster car" });
    await card.click();
    const dialog = page.getByRole("dialog", {
      name: "Save your current build first?",
    });
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByLabel("Project title")).toHaveValue("Still here");
    expect(await count(page)).toBe(40);
    await card.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByLabel("Project title")).toHaveValue("Still here");
    // Opening a file asks too.
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: "one-brick.ldr",
        mimeType: "text/plain",
        buffer: Buffer.from("1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat\n"),
      });
    await expect(dialog).toContainText("“one-brick.ldr”");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByLabel("Project title")).toHaveValue("Still here");
  });

  test("works on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await changedBuild(page, "Phone build");
    await openMode(page, "Project");
    const card = page.getByRole("button", { name: "House with garden" });
    await card.scrollIntoViewIfNeeded();
    await card.click();
    const dialog = page.getByRole("dialog", {
      name: "Save your current build first?",
    });
    await expect(dialog).toBeVisible();
    await page.screenshot({
      path: "test-results/templates/replace-prompt-390.png",
    });
    // Every action is inside the viewport and at least 44 px tall.
    for (const name of ["Save and continue", "Discard", "Cancel"]) {
      const box = (await dialog.getByRole("button", { name }).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      expect(box.y + box.height).toBeLessThanOrEqual(844);
    }
    await dialog.getByRole("button", { name: "Save and continue" }).click();
    await expect(page.getByLabel("Project title")).toHaveValue(
      "House with garden",
      { timeout: LOAD },
    );
  });
});
