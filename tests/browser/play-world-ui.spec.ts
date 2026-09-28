import { test, expect } from "@playwright/test";
import { openMode } from "./helpers/mode";
for (const viewport of [
  { width: 360, height: 800 },
  { width: 1080, height: 1800 },
])
  test(`Play world layers are explicit and independent of editor visibility at ${viewport.width}px`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ viewport, hasTouch: true }),
      page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.goto(`${baseURL}/?automation=1`);
      await page.waitForFunction(() => !!window.brickEditor);
      const layerId = await page.evaluate(async () => {
        const a = window.brickEditor!;
        await a.project.import({ format: "template", template: "wall" });
        await a.ready();
        const q = await a.query(),
          layerId = q.occurrences[0].layerId;
        await a.dispatch({
          schemaVersion: 1,
          commandId: crypto.randomUUID(),
          expectedRevision: q.revision,
          type: "layers.update",
          payload: { layerId, name: "Wall", visible: false },
        });
        await a.ready();
        return layerId;
      });
      const before = await page.evaluate(() => window.brickEditor!.query());
      await openMode(page, "Play");
      await page.getByText("World included in Play", { exact: true }).click();
      await expect(
        page.getByRole("checkbox", {
          name: "Wall · hidden in editor",
          exact: true,
        }),
      ).toBeChecked();
      await expect(
        page.getByRole("checkbox", {
          name: "Temporary ground plane",
          exact: true,
        }),
      ).toBeChecked();
      await page
        .getByRole("button", { name: "Enter Play", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Pause", exact: true }),
      ).toBeVisible();
      const defaultProfile = await page.evaluate(() =>
        window.brickEditor!.play.snapshot().then((s) => s.worldProfile),
      );
      expect(defaultProfile.excludedLayerIds).toEqual([]);
      expect(defaultProfile.includedOccurrenceIds).toHaveLength(40);
      await page
        .getByRole("button", { name: "Exit Play", exact: true })
        .click();
      await openMode(page, "Play");
      await page.getByText("World included in Play", { exact: true }).click();
      await page
        .getByRole("checkbox", { name: "Wall · hidden in editor", exact: true })
        .uncheck();
      await page
        .getByRole("button", { name: "Enter Play", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Pause", exact: true }),
      ).toBeVisible();
      const excluded = await page.evaluate(() =>
        window.brickEditor!.play.snapshot().then((s) => s.worldProfile),
      );
      expect(excluded.excludedLayerIds).toEqual([layerId]);
      expect(excluded.includedOccurrenceIds).toEqual([]);
      await page
        .getByRole("button", { name: "Exit Play", exact: true })
        .click();
      expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
        before,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
