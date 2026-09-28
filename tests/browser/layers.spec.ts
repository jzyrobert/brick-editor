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
  await actions.getByText("Layer options", { exact: true }).click();
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

test("layer duplication, folder promotion and ghosting preserve document contents", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(() => window.brickEditor!.ready());
  await page.getByRole("button", { name: /Brick 2 × 4 3001/ }).click();
  await page.getByRole("button", { name: "Place part", exact: true }).click();
  const actions = page.getByRole("region", { name: "Layer order and removal" });
  await actions.getByText("Organise with folders", { exact: true }).click();
  await actions.getByLabel("New folder name", { exact: true }).fill("Building");
  await actions
    .getByRole("button", { name: "Create folder", exact: true })
    .click();
  await actions
    .getByRole("combobox", { name: "Folder for active layer", exact: true })
    .selectOption({ label: "Building" });
  const before = await page.evaluate(() => window.brickEditor!.query());
  await actions.getByText("Layer options", { exact: true }).click();
  await actions
    .getByRole("button", { name: "Duplicate layer (1 parts)", exact: true })
    .click();
  await expect(page.locator(".layer-name")).toHaveCount(2);
  const after = await page.evaluate(() => window.brickEditor!.query());
  expect(after.occurrences).toHaveLength(2);
  expect(after.occurrences[1].transform).toEqual(
    before.occurrences[0].transform,
  );
  expect(after.occurrences[1].id).not.toBe(before.occurrences[0].id);
  await expect(
    actions.getByRole("combobox", {
      name: "Folder for active layer",
      exact: true,
    }),
  ).not.toHaveValue("");
  await actions
    .getByRole("button", { name: "Remove Building folder…", exact: true })
    .click();
  await actions
    .getByRole("button", {
      name: "Remove folder and keep contents",
      exact: true,
    })
    .click();
  expect(
    (await page.evaluate(() => window.brickEditor!.query())).occurrences,
  ).toEqual(after.occurrences);
  await expect(
    actions.getByRole("combobox", {
      name: "Folder for active layer",
      exact: true,
    }),
  ).toHaveValue("");
  await page.getByRole("button", { name: "Add layer", exact: true }).click();
  await page.locator(".layer-name").filter({ hasText: "Layer 3" }).click();
  const priorGhost = await page.evaluate(() => window.brickEditor!.query());
  const capture = () =>
    page.evaluate(async () => {
      const api = window.brickEditor!;
      await api.ready();
      const q = await api.query();
      const image = await api.render.image({
        revision: q.revision,
        width: 160,
        height: 120,
        format: "png",
        visibility: { mode: "all" },
        background: { type: "transparent" },
        quality: "fast",
        strict: true,
      });
      return Array.from(new Uint8Array(await image.blob.arrayBuffer()));
    });
  const opaqueCapture = await capture();
  const canvas = page.locator("canvas").first();
  const opaqueView = await canvas.screenshot();
  await actions.getByLabel("Ghost other layers", { exact: true }).check();
  await expect
    .poll(async () => (await canvas.screenshot()).equals(opaqueView))
    .toBe(false);
  expect(await capture()).toEqual(opaqueCapture);
  expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
    priorGhost,
  );
  await actions.getByLabel("Ghost other layers", { exact: true }).uncheck();
  expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
    priorGhost,
  );
});
