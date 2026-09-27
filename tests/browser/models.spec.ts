import { test, expect } from "@playwright/test";
for (const width of [360, 1080, 1440]) {
  test(`submodel creation and explicit shared preview preserve selection at ${width}px`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      viewport: {
        width,
        height: width === 360 ? 800 : width === 1080 ? 1800 : 1000,
      },
      hasTouch: width !== 1440,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(`${baseURL}/?automation=1`);
      await page.waitForFunction(() => !!window.brickEditor);
      await page.evaluate(async () => {
        await window.brickEditor!.project.import({
          format: "ldraw",
          text: "1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat\n1 1 80 -24 0 1 0 0 0 1 0 0 0 1 3001.dat",
        });
        await window.brickEditor!.ready({ strict: true });
      });
      await (
        width === 1440
          ? page.locator(".right-tabs")
          : page.getByRole("navigation", { name: "Mobile panels" })
      )
        .getByRole("button", { name: "Inspector", exact: true })
        .click();
      await page.getByText("Selection tools", { exact: true }).click();
      await page
        .getByRole("button", { name: "Select editable parts", exact: true })
        .click();
      const before = await page.evaluate(() => window.brickEditor!.query());
      await page
        .getByText("Submodels and shared editing", { exact: true })
        .click();
      await page
        .getByLabel("Submodel name", { exact: true })
        .fill("Mobile assembly");
      await page.getByLabel("Parent-local pivot X", { exact: true }).fill("20");
      await page
        .getByRole("button", { name: "Make submodel", exact: true })
        .click();
      await expect(page.locator(".model-tools")).toContainText(
        "Submodel created",
      );
      const after = await page.evaluate(() => window.brickEditor!.query());
      expect(after.revision).toBe(before.revision + 1);
      expect(after.occurrences.map((o) => o.transform)).toEqual(
        before.occurrences.map((o) => o.transform),
      );
      expect(after.occurrences.map((o) => o.id)).not.toEqual(
        before.occurrences.map((o) => o.id),
      );
      await expect(page.locator(".canvas-bottom")).toContainText("2 selected");
      await page.getByText("Edit shared definition", { exact: true }).click();
      await page.getByLabel("LDraw colour code", { exact: true }).fill("14");
      await page
        .getByRole("button", { name: "Preview shared impact", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Apply to all 2 occurrences",
          exact: true,
        }),
      ).toBeEnabled();
      expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
        after,
      );
      await page.getByLabel("LDraw colour code", { exact: true }).fill("2");
      await expect(
        page.getByRole("button", {
          name: "Apply to all 2 occurrences",
          exact: true,
        }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Preview shared impact", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: "Apply to all 2 occurrences",
          exact: true,
        })
        .click();
      const recoloured = await page.evaluate(() => window.brickEditor!.query());
      expect(recoloured.occurrences.map((o) => o.colorCode)).toEqual([
        "2",
        "2",
      ]);
      expect(recoloured.revision).toBe(after.revision + 1);
      await page.evaluate(async () => {
        const a = window.brickEditor!,
          q = await a.query();
        await a.dispatch({
          schemaVersion: 1,
          commandId: crypto.randomUUID(),
          expectedRevision: q.revision,
          type: "history.undo",
          payload: {},
        });
      });
      const undone = await page.evaluate(() => window.brickEditor!.query());
      expect(undone.occurrences).toEqual(after.occurrences);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
