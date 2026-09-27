import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";

test("shared links preview safely, dismiss without replacement and back up before confirmed opening", async ({
  page,
}) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    const a = window.brickEditor!,
      r = await a.project.import({ format: "template", template: "room" });
    await a.ready({ minRevision: r.revision });
  });
  await page.getByRole("button", { name: "Project", exact: true }).click();
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
  await expect(page.locator(".save-state")).toContainText("Saved revision");
  await page.getByRole("button", { name: "Build", exact: true }).click();
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
  const event = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Open shared model", exact: true })
    .click();
  const download = await event;
  const backup = JSON.parse(
    strFromU8(
      unzipSync(await readFile((await download.path())!))["project.json"],
    ),
  );
  expect(backup.models[backup.rootModelId].nodes).toHaveLength(40);
  await expect
    .poll(() =>
      page.evaluate(
        async () => (await window.brickEditor!.query()).occurrences.length,
      ),
    )
    .toBe(74);
  expect(new URL(page.url()).hash).toBe("");
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
  await expect(page.locator(".save-state")).toContainText("Saved revision");
  await page.getByRole("button", { name: "Project", exact: true }).click();
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
