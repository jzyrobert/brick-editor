import { test, expect } from "@playwright/test";
import { openMode } from "./helpers/mode";
test("keyboard clipboard shares UI state, protects text input and supports persistent remapping", async ({
  page,
}) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    await window.brickEditor!.project.import({
      format: "template",
      template: "wall",
    });
    await window.brickEditor!.ready({ strict: true });
  });
  await page
    .locator(".right-tabs")
    .getByRole("button", { name: "Inspector", exact: true })
    .click();
  await page.getByText("Selection tools", { exact: true }).click();
  await page
    .getByRole("button", { name: "Select editable parts", exact: true })
    .click();
  await page.keyboard.press("Control+c");
  await expect(
    page.getByRole("button", { name: "Paste in place", exact: true }),
  ).toBeEnabled();
  await expect(
    page
      .locator(".tool-segment")
      .getByRole("button", { name: "Paint", exact: true }),
  ).not.toHaveClass(/active/);
  await page.keyboard.press("Control+v");
  await expect(page.locator(".canvas-bottom")).toContainText("80 parts");
  await page.keyboard.press("Control+z");
  await expect(page.locator(".canvas-bottom")).toContainText("40 parts");
  await page
    .getByRole("button", { name: "Select editable parts", exact: true })
    .click();
  await page.keyboard.press("Control+x");
  await expect(page.locator(".canvas-bottom")).toContainText("0 parts");
  await page.keyboard.press("Control+v");
  await expect(page.locator(".canvas-bottom")).toContainText("40 parts");
  await page.keyboard.press("g");
  await expect(
    page.getByRole("button", { name: "Move handles", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("r");
  await expect(
    page.getByRole("button", { name: "Rotate handles", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("v");
  await expect(
    page.getByRole("button", { name: "Rotate handles", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  const title = page.getByLabel("Project title");
  await title.focus();
  await title.press("Control+a");
  await title.press("Backspace");
  await title.press("v");
  await expect(title).toHaveValue("v");
  await expect(page.locator(".canvas-bottom")).toContainText("40 parts");
  await openMode(page, "Project");
  await page.getByText("Keyboard shortcuts", { exact: true }).click();
  await page.getByLabel("Paint tool shortcut").fill("P");
  await page
    .getByRole("button", { name: "Apply shortcuts", exact: true })
    .click();
  await openMode(page, "Build");
  await page.keyboard.press("p");
  await expect(
    page
      .locator(".tool-segment")
      .getByRole("button", { name: "Paint", exact: true }),
  ).toHaveClass(/active/);
  await page.reload();
  await page.waitForFunction(() => !!window.brickEditor);
  await page
    .locator(".tool-segment")
    .getByRole("button", { name: "Select", exact: true })
    .click();
  await page.keyboard.press("p");
  await expect(
    page
      .locator(".tool-segment")
      .getByRole("button", { name: "Paint", exact: true }),
  ).toHaveClass(/active/);
});
