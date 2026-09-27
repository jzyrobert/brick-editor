import { test, expect } from "@playwright/test";

test("fill worker API cancellation and stale preview refuse without authoring changes", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.ready();
    const q = await a.query();
    const request = {
      allowedRefs: ["3001.dat", "3005.dat"],
      orientations: [0, 90],
      columns: 6,
      rows: 4,
      colorCode: "4",
      origin: [0, -24, 0] as [number, number, number],
      layerId: "base",
      maxAdditions: 100,
    };
    const good = await a.fill.preview(request);
    const cancelled = await a.fill.startPreview(request);
    await a.jobs.cancel(cancelled.jobId);
    const cancelledError = await a.jobs.wait(cancelled.jobId).then(
      () => "",
      (e) => e.code,
    );
    const stale = await a.fill.startPreview(request);
    await a.dispatch({
      schemaVersion: 1,
      commandId: crypto.randomUUID(),
      expectedRevision: q.revision,
      type: "parts.add",
      payload: {
        layerId: request.layerId,
        parts: [
          {
            ref: "3005.dat",
            colorCode: "1",
            transform: {
              position: [1000, 0, 0],
              basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
            },
          },
        ],
        maxAdditions: 1,
      },
    });
    const staleError = await a.jobs.wait(stale.jobId).then(
      () => "",
      (e) => e.code,
    );
    return {
      covered: good.coveredCells,
      cancelledError,
      staleError,
      count: (await a.query()).occurrences.length - q.occurrences.length,
    };
  });
  expect(result).toEqual({
    covered: 24,
    cancelledError: "CANCELLED",
    staleError: "REVISION_CONFLICT",
    count: 1,
  });
});

for (const width of [360, 1080, 1440]) {
  test(`allowed-part masked fill commits and undoes at ${width}px`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width, height: width === 1080 ? 1800 : 1000 },
      hasTouch: width !== 1440,
    });
    const page = await context.newPage();
    try {
      await page.goto("/?automation=1");
      await page.waitForFunction(() => !!window.brickEditor);
      await page.evaluate(async () => {
        await window.brickEditor!.project.import({
          format: "template",
          template: "blank",
        });
        await window.brickEditor!.ready();
      });
      if (width !== 1440)
        await page
          .getByRole("navigation", { name: "Mobile panels" })
          .getByRole("button", { name: "Canvas", exact: true })
          .click();
      await page
        .getByRole("button", { name: "⊞ Rectangular fill", exact: true })
        .click();
      const dialog = page.getByRole("dialog", { name: "Rectangular fill" });
      await dialog.getByLabel("Fill using an allowed part set").check();
      await dialog.getByLabel("Columns", { exact: true }).fill("5");
      await dialog.getByLabel("Rows", { exact: true }).fill("3");
      await dialog.getByText("Optional cell mask", { exact: true }).click();
      await dialog.getByLabel("Fill cell mask").fill("11111\n10001\n11111");
      await dialog
        .getByRole("button", { name: "Preview fill", exact: true })
        .click();
      await expect(dialog).toContainText("12 of 12 eligible cells covered.");
      // Changing the mask must invalidate the old preview before it can be committed.
      await dialog.getByLabel("Fill cell mask").fill("bad");
      await expect(
        dialog.getByRole("button", { name: /^Commit .* parts$/ }),
      ).toHaveCount(0);
      await dialog
        .getByRole("button", { name: "Preview fill", exact: true })
        .click();
      await expect(
        dialog.getByRole("button", { name: "Preview fill", exact: true }),
      ).toBeEnabled();
      await dialog.getByLabel("Fill cell mask").fill("11111\n10001\n11111");
      await dialog
        .getByRole("button", { name: "Preview fill", exact: true })
        .click();
      await expect(dialog).toContainText("12 of 12 eligible cells covered.");
      const before = await page.evaluate(() => window.brickEditor!.query());
      await dialog.getByRole("button", { name: /^Commit .* parts$/ }).click();
      await expect(dialog).toBeHidden();
      const after = await page.evaluate(() => window.brickEditor!.query());
      expect(after.revision).toBe(before.revision + 1);
      await page.evaluate(async () => {
        const a = window.brickEditor!;
        await a.dispatch({
          schemaVersion: 1,
          commandId: crypto.randomUUID(),
          expectedRevision: (await a.query()).revision,
          type: "history.undo",
          payload: {},
        });
      });
      const restored = await page.evaluate(() => window.brickEditor!.query());
      expect(restored.occurrences).toEqual(before.occurrences);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    } finally {
      await context.close();
    }
  });
}
