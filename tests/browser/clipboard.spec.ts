import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("clipboard UI copies, previews arrays without changes, commits and transfers a portable fragment", async ({
  page,
  context,
}) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.project.import({
      format: "ldraw",
      text: "0 One brick\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
    });
    await a.ready({ strict: true });
    await a.camera.set({
      space: "ldraw",
      projection: "perspective",
      position: [100, -150, 200],
      target: [0, -12, 0],
      up: [0, -1, 0],
      fovDeg: 45,
      near: 0.5,
      far: 10000,
    });
  });
  const viewport = page.locator(".viewport"),
    box = (await viewport.boundingBox())!;
  await viewport.click({ position: { x: box.width / 2, y: box.height / 2 } });
  const tools = page.locator(".clipboard-tools");
  await expect(
    tools.getByRole("button", { name: "Copy", exact: true }),
  ).toBeEnabled();
  await tools.getByRole("button", { name: "Copy", exact: true }).click();
  await tools
    .getByRole("button", { name: "Paste in place", exact: true })
    .click();
  expect(
    (await page.evaluate(() => window.brickEditor!.query())).occurrences,
  ).toHaveLength(2);
  await tools.getByText("Linear or circular array", { exact: true }).click();
  await tools.getByLabel("New copies", { exact: true }).fill("2");
  const before = await page.evaluate(() => window.brickEditor!.query());
  await tools.getByRole("button", { name: "Preview array count" }).click();
  expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
    before,
  );
  await tools.getByRole("button", { name: "Commit array" }).click();
  expect(
    (await page.evaluate(() => window.brickEditor!.query())).occurrences,
  ).toHaveLength(4);
  await tools
    .getByRole("combobox", { name: "Pattern", exact: true })
    .selectOption("circular");
  await tools.getByLabel("New copies", { exact: true }).fill("1");
  await tools.getByLabel("Angle per copy (degrees)").fill("90");
  await tools.getByRole("button", { name: "Preview array count" }).click();
  await tools.getByRole("button", { name: "Commit array" }).click();
  expect(
    (await page.evaluate(() => window.brickEditor!.query())).occurrences,
  ).toHaveLength(6);
  await tools.getByRole("button", { name: "Copy", exact: true }).click();
  await tools.getByText("Portable clipboard", { exact: true }).click();
  const event = page.waitForEvent("download");
  await tools
    .getByRole("button", { name: "Save fragment", exact: true })
    .click();
  const bytes = await readFile((await (await event).path())!);
  await tools.getByRole("button", { name: "Cut", exact: true }).click();
  expect(
    (await page.evaluate(() => window.brickEditor!.query())).occurrences,
  ).toHaveLength(4);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(
    (await page.evaluate(() => window.brickEditor!.query())).occurrences,
  ).toHaveLength(6);
  const other = await context.newPage();
  await other.goto("./?automation=1");
  await other.waitForFunction(() => !!window.brickEditor);
  await other.evaluate(async () => {
    await window.brickEditor!.project.import({
      format: "template",
      template: "blank",
    });
  });
  await other
    .locator(".right-tabs")
    .getByRole("button", { name: "Inspector", exact: true })
    .click();
  const otherTools = other.locator(".clipboard-tools");
  await otherTools.getByText("Portable clipboard", { exact: true }).click();
  await otherTools.locator('input[type="file"]').setInputFiles({
    name: "portable.brickfragment",
    mimeType: "application/json",
    buffer: bytes,
  });
  await expect(otherTools.getByRole("status")).toHaveText(
    "Fragment ready to paste",
  );
  await otherTools
    .getByRole("button", { name: "Paste in place", exact: true })
    .click();
  const pasted = (await other.evaluate(() => window.brickEditor!.query()))
    .occurrences;
  expect(pasted).toHaveLength(2);
  expect(
    pasted.every((o) => o.node.ref === "3001.dat" && o.colorCode === "4"),
  ).toBe(true);
  await other.close();
});
