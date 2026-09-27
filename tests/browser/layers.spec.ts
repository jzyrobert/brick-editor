import { test, expect } from "@playwright/test";
test("layer UI reorders and explicitly reassigns or deletes members with undo and lock guards", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(() => window.brickEditor!.ready());
  await page.getByRole("button", { name: "Add layer", exact: true }).click();
  await page.locator(".layer-name").filter({ hasText: "Layer 2" }).click();
  await page.getByRole("button", { name: /Brick 2 × 4 3001/ }).click();
  await page.getByRole("button", { name: "Place part", exact: true }).click();
  await expect(page.locator(".canvas-bottom")).toContainText("1 parts");
  const part = await page.evaluate(
    async () => (await window.brickEditor!.query()).occurrences[0],
  );
  const actions = page.getByRole("region", { name: "Layer order and removal" });
  await actions.getByRole("button", { name: "Move layer up" }).click();
  await expect(page.locator(".layer-name").first()).toContainText("Layer 2");
  await page.getByRole("button", { name: "Lock Layer 2", exact: true }).click();
  await expect(
    actions.getByRole("button", { name: "Remove layer…" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Unlock Layer 2", exact: true })
    .click();
  await actions.getByRole("button", { name: "Remove layer…" }).click();
  await actions
    .getByRole("button", { name: "Move 1 parts and remove layer", exact: true })
    .click();
  await expect(page.locator(".layer-name")).toHaveCount(1);
  const moved = await page.evaluate(
    async () => (await window.brickEditor!.query()).occurrences[0],
  );
  expect(moved.id).toBe(part.id);
  expect(moved.transform).toEqual(part.transform);
  expect(moved.layerId).not.toBe(part.layerId);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".layer-name")).toHaveCount(2);
  await page.locator(".layer-name").filter({ hasText: "Layer 2" }).click();
  await actions.getByRole("button", { name: "Remove layer…" }).click();
  await actions
    .getByLabel("Delete this layer and its parts", { exact: true })
    .check();
  await actions
    .getByRole("button", { name: "Delete layer and 1 parts", exact: true })
    .click();
  expect(
    (await page.evaluate(() => window.brickEditor!.query())).occurrences,
  ).toHaveLength(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(
    (await page.evaluate(() => window.brickEditor!.query())).occurrences,
  ).toHaveLength(1);
});
