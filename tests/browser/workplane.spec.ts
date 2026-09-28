import { expect, test } from "@playwright/test";
for (const size of [
  { width: 1440, height: 1000, touch: false },
  { width: 1080, height: 1800, touch: true },
]) {
  test(`workplanes use real faces and configurable free/grid placement at ${size.width}px`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      viewport: size,
      hasTouch: size.touch,
    });
    const page = await context.newPage();
    try {
      await page.goto(`${baseURL}/?automation=1`);
      await page.waitForFunction(() => !!window.brickEditor);
      await page.evaluate(async () => {
        const a = window.brickEditor!;
        await a.project.import({
          format: "ldraw",
          text: "0 BFC NOCERTIFY\n4 4 -120 -120 0 120 -120 0 120 120 0 -120 120 0",
        });
        await a.ready({ strict: true });
        await a.camera.set({
          space: "ldraw",
          projection: "orthographic",
          fovDeg: 45,
          position: [0, 0, 400],
          target: [0, 0, 0],
          up: [0, -1, 0],
          span: 400,
          near: 0.5,
          far: 5000,
        });
      });
      const open = async () => {
        if (size.touch)
          await page
            .getByRole("navigation", { name: "Mobile panels" })
            .getByRole("button", { name: "Inspector", exact: true })
            .click();
        else
          await page
            .locator(".right-tabs")
            .getByRole("button", { name: "Inspector", exact: true })
            .click();
        // Workplane settings live in a drawer under More tools.
        const drawer = page.locator("details.workplane-drawer");
        if (!(await drawer.evaluate((d) => (d as HTMLDetailsElement).open)))
          await drawer.getByText("Workplane and grid", { exact: true }).click();
      };
      const tap = async (x: number, y: number) => {
        if (size.touch) await page.touchscreen.tap(x, y);
        else await page.mouse.click(x, y);
      };
      await open();
      const panel = page.getByRole("region", { name: "Workplane settings" });
      const before = await page.evaluate(() => window.brickEditor!.query());
      await panel
        .getByRole("button", { name: "Pick a model face", exact: true })
        .click();
      let rect = (await page.locator(".viewport canvas").boundingBox())!;
      await tap(rect.x + rect.width / 2 + 20, rect.y + rect.height / 2 + 20);
      await open();
      await panel.getByText("Numerical plane", { exact: true }).click();
      await expect(
        panel.getByLabel("Plane normal Z", { exact: true }),
      ).toHaveValue("1");
      expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
        before,
      );
      await panel.getByLabel("Plane origin X", { exact: true }).fill("3");
      await panel.getByLabel("Plane origin Y", { exact: true }).fill("5");
      await panel.getByLabel("Plane origin Z", { exact: true }).fill("7");
      await panel
        .getByRole("button", { name: "Apply numerical plane", exact: true })
        .click();
      await panel
        .getByLabel("Plane elevation (LDU)", { exact: true })
        .fill("-8");
      await panel.getByLabel("Grid increment (LDU)", { exact: true }).fill("5");
      await panel
        .getByLabel("Rotation increment (degrees)", { exact: true })
        .fill("15");
      if (size.touch)
        await page
          .getByRole("navigation", { name: "Mobile panels" })
          .getByRole("button", { name: "Parts", exact: true })
          .click();
      await page.getByRole("button", { name: /Brick 2 × 4 3001/ }).click();
      if (size.touch)
        await page
          .locator(".mobile-panel.mobile-open .mobile-sheet-head")
          .getByRole("button", { name: "Close" })
          .click();
      rect = (await page.locator(".viewport canvas").boundingBox())!;
      await tap(rect.x + rect.width / 2 + 17, rect.y + rect.height / 2 + 12);
      await expect(page.getByLabel("Place Z", { exact: true })).toHaveValue(
        "39",
      );
      const x = Number(
          await page.getByLabel("Place X", { exact: true }).inputValue(),
        ),
        y = Number(
          await page.getByLabel("Place Y", { exact: true }).inputValue(),
        );
      expect((x - 3) / 5).toBeCloseTo(Math.round((x - 3) / 5));
      expect((y - 5) / 5).toBeCloseTo(Math.round((y - 5) / 5));
      await page
        .getByRole("button", { name: "Rotate placement", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Place part", exact: true })
        .click();
      const grid = await page.evaluate(() => window.brickEditor!.query());
      expect(grid.occurrences).toHaveLength(2);
      const t = grid.occurrences[1].transform;
      expect(t.position[2]).toBeCloseTo(39);
      expect(t.basis[1]).toBeCloseTo(0);
      expect(t.basis[4]).toBeCloseTo(0);
      expect(t.basis[7]).toBeCloseTo(-1);
      expect(t.basis[0]).toBeCloseTo(Math.cos(Math.PI / 12));
      await open();
      await panel.getByLabel("Free placement", { exact: true }).check();
      if (size.touch)
        await page
          .locator(".mobile-panel.mobile-open .mobile-sheet-head")
          .getByRole("button", { name: "Close" })
          .click();
      await tap(rect.x + rect.width / 2 + 17, rect.y + rect.height / 2 + 12);
      const freeX = Number(
        await page.getByLabel("Place X", { exact: true }).inputValue(),
      );
      expect(
        Math.abs((freeX - 3) / 5 - Math.round((freeX - 3) / 5)),
      ).toBeGreaterThan(0.01);
      expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
        grid,
      );
    } finally {
      await context.close();
    }
  });
}
