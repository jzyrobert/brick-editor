import { test, expect } from "@playwright/test";
import { openMenuTab, openMode } from "./helpers/mode";
for (const viewport of [
  { width: 360, height: 800 },
  { width: 1080, height: 1800 },
])
  test(`instruction dimming preserves visible earlier parts, camera and authored state at ${viewport.width}px`, async ({
    browser,
    baseURL,
  }, testInfo) => {
    const context = await browser.newContext({ viewport, hasTouch: true }),
      page = await context.newPage();
    try {
      await page.goto(`${baseURL}/?automation=1`);
      await page.waitForFunction(() => !!window.brickEditor);
      await page.evaluate(async () => {
        const api = window.brickEditor!;
        await api.project.import({ format: "template", template: "wall" });
        await api.ready();
        await api.camera.fit();
      });
      await openMode(page, "Instructions");
      await page
        .getByRole("button", { name: "One step per layer", exact: true })
        .click();
      await page
        .getByRole("slider", { name: "Instruction step", exact: true })
        .fill("1");
      const before = await page.evaluate(() => window.brickEditor!.query());
      const shot = async () => {
        await page.evaluate(async () => {
          await window.brickEditor!.ready();
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
        });
        return page.locator(".viewport canvas").screenshot({
          animations: "disabled",
          style:
            ".mode-card,.canvas-label,.canvas-bottom,.canvas-toolbar,.view-toolbar,.hud-top,.hud-el,.left-sidebar,.right-sidebar,.status-bar,.mobile-nav { visibility:hidden !important; }",
        });
      };
      const capture = (dim: boolean, onlyNew = false) =>
        page.evaluate(
          async ({ dim, onlyNew }) => {
            const api = window.brickEditor!,
              q = await api.query(),
              ids = q.occurrences.map((o) => o.id),
              additions = ids.slice(10, 20);
            const image = await api.render.image({
              revision: q.revision,
              width: 320,
              height: 240,
              format: "png",
              visibility: {
                mode: "occurrences",
                occurrenceIds: onlyNew ? additions : ids.slice(0, 20),
              },
              background: { type: "solid", color: "#ffffff" },
              quality: "fast",
              strict: true,
              ...(dim ? { instructionNewIds: additions } : {}),
            });
            return Array.from(new Uint8Array(await image.blob.arrayBuffer()));
          },
          { dim, onlyNew },
        );
      const normal = await shot(),
        opaqueCapture = await capture(false);
      // The dimming switch sits with publishing; the preview keeps showing.
      await openMenuTab(page, "Instructions", "Publish");
      const checkbox = page.getByRole("checkbox", {
        name: "Dim previous parts in preview and publication",
        exact: true,
      });
      await checkbox.check();
      const dimmed = await shot();
      expect(dimmed.equals(normal)).toBe(false);
      await testInfo.attach("normal-step-preview", {
        body: normal,
        contentType: "image/png",
      });
      await testInfo.attach("dimmed-step-preview", {
        body: dimmed,
        contentType: "image/png",
      });
      expect(await capture(false)).toEqual(opaqueCapture);
      const dimCapture = await capture(true);
      expect(dimCapture).not.toEqual(opaqueCapture);
      expect(dimCapture).not.toEqual(await capture(false, true));
      expect((await shot()).equals(dimmed)).toBe(true);
      expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
        before,
      );
      await checkbox.uncheck();
      expect((await shot()).equals(normal)).toBe(true);
    } finally {
      await context.close();
    }
  });
