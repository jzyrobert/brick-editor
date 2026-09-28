import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { openMode } from "./helpers/mode";
test("explicit offline installation reloads at its deployed base path and provides parts, Play, inventory and PDF", async ({
  page,
  context,
}) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const base = new URL("./", page.url()).href;
  await openMode(page, "Project");
  await page
    .getByRole("button", { name: "Download / check for updates", exact: true })
    .click();
  await expect(page.getByText(/Ready offline\./)).toBeVisible({
    timeout: 45000,
  });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  expect(
    await page.evaluate(
      async () => (await navigator.serviceWorker.ready).scope,
    ),
  ).toBe(base);
  await context.setOffline(true);
  try {
    await page.reload();
    await page.waitForFunction(() => !!window.brickEditor);
    const result = await page.evaluate(async () => {
      const a = window.brickEditor!,
        imported = await a.project.import({
          format: "template",
          template: "room",
        });
      await a.ready({ minRevision: imported.revision, strict: true });
      await a.camera.fit();
      const play = await a.play.enter({ locomotion: "fly-noclip" });
      await a.play.exit();
      const q = await a.query(),
        inventory = await a.inventory.preview({
          expectedRevision: q.revision,
          format: "bricklink-wanted-xml",
          scope: { kind: "all" },
        });
      return {
        count: q.occurrences.length,
        ready: play.collisionReady,
        inventory: inventory.resolvedPhysicalUnitCount,
      };
    });
    expect(result).toEqual({ count: 74, ready: true, inventory: 74 });
    await openMode(page, "Instructions");
    await page
      .getByRole("button", { name: "Generate layer steps", exact: true })
      .click();
    const publication = page.getByRole("region", {
      name: "Publish instructions",
    });
    await publication.getByLabel("Image size").selectOption("640");
    const event = page.waitForEvent("download");
    await publication
      .getByRole("button", { name: "Download publication" })
      .click();
    const download = await event,
      pdf = await PDFDocument.load(await readFile((await download.path())!));
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(3);
  } finally {
    await context.setOffline(false);
  }
});
