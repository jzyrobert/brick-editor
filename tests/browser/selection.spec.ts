import { test, expect } from "@playwright/test";
const source = `0 FILE main.ldr
0 BFC NOCERTIFY
4 4 -80 -40 -80 80 -40 -80 80 -40 80 -80 -40 80
4 1 -80 0 -80 80 0 -80 80 0 80 -80 0 80
4 2 150 0 -30 210 0 -30 210 0 30 150 0 30
0 NOFILE`;
test("box and lasso distinguish visible surfaces from through-selection, with touch-accessible add/remove and cancellation", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async (text) => {
    const a = window.brickEditor!;
    await a.project.import({ format: "ldraw", text });
    await a.ready({ strict: true });
    await a.camera.set({
      space: "ldraw",
      projection: "orthographic",
      position: [0, -600, 0],
      target: [0, 0, 0],
      up: [0, 0, -1],
      span: 500,
      fovDeg: 45,
      near: 0.5,
      far: 5000,
    });
  }, source);
  const before = await page.evaluate(() => window.brickEditor!.query());
  await page
    .locator(".right-tabs")
    .getByRole("button", { name: "Inspector", exact: true })
    .click();
  await page.getByText("Selection tools", { exact: true }).click();
  await page
    .getByLabel("Selection gesture", { exact: true })
    .selectOption("box");
  const rect = await page.locator(".viewport canvas").boundingBox();
  expect(rect).not.toBeNull();
  const cx = rect!.x + rect!.width / 2,
    cy = rect!.y + rect!.height / 2;
  const box = async () => {
    await page.mouse.move(cx - 15, cy - 15);
    await page.mouse.down();
    await page.mouse.move(cx + 15, cy + 15, { steps: 8 });
    await page.mouse.up();
  };
  await box();
  await expect(page.locator(".canvas-bottom")).toContainText("1 selected");
  await page
    .getByLabel("Selection depth", { exact: true })
    .selectOption("through");
  await box();
  await expect(page.locator(".canvas-bottom")).toContainText("2 selected");
  await page
    .getByLabel("Selection depth", { exact: true })
    .selectOption("visible");
  await page
    .getByLabel("Selection action", { exact: true })
    .selectOption("remove");
  await box();
  await expect(page.locator(".canvas-bottom")).toContainText("1 selected");
  await page
    .getByLabel("Selection action", { exact: true })
    .selectOption("add");
  await page
    .getByLabel("Selection gesture", { exact: true })
    .selectOption("lasso");
  await page.mouse.move(cx - 15, cy - 15);
  await page.mouse.down();
  await page.mouse.move(cx + 15, cy - 15, { steps: 4 });
  await page.mouse.move(cx + 15, cy + 15, { steps: 4 });
  await page.mouse.move(cx - 15, cy + 15, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator(".canvas-bottom")).toContainText("2 selected");
  await page
    .getByLabel("Selection action", { exact: true })
    .selectOption("replace");
  await page.mouse.move(cx - 15, cy - 15);
  await page.mouse.down();
  await page.mouse.move(cx + 15, cy + 15, { steps: 4 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator(".canvas-bottom")).toContainText("2 selected");
  await page
    .getByRole("button", { name: "Select editable parts", exact: true })
    .click();
  await expect(page.locator(".canvas-bottom")).toContainText("3 selected");
  expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
    before,
  );
});

for (const width of [360, 1080])
  test(`touch box selects with the sheet closed and a second finger cancels at ${width}`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height: width === 360 ? 800 : 1800 },
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await page.goto(`${baseURL}/?automation=1`);
      await page.waitForFunction(() => !!window.brickEditor);
      await page.evaluate(async (text) => {
        const a = window.brickEditor!;
        await a.project.import({ format: "ldraw", text });
        await a.ready({ strict: true });
        await a.camera.set({
          space: "ldraw",
          projection: "orthographic",
          position: [0, -600, 0],
          target: [0, 0, 0],
          up: [0, 0, -1],
          span: 500,
          fovDeg: 45,
          near: 0.5,
          far: 5000,
        });
      }, source);
      const mobile = page.getByRole("navigation", { name: "Mobile panels" });
      await mobile
        .getByRole("button", { name: "Inspector", exact: true })
        .click();
      await page.getByText("Selection tools", { exact: true }).click();
      await page
        .getByLabel("Selection gesture", { exact: true })
        .selectOption("box");
      await page
        .locator(".mobile-panel.mobile-open .mobile-sheet-head")
        .getByRole("button", { name: "Close" })
        .click();
      const rect = (await page.locator(".viewport canvas").boundingBox())!,
        cx = rect.x + rect.width / 2,
        cy = rect.y + rect.height / 2;
      const cdp = await context.newCDPSession(page);
      const touch = (
        type: "touchStart" | "touchMove" | "touchEnd" | "touchCancel",
        points: { x: number; y: number; id: number }[],
      ) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
      await touch("touchStart", [{ x: cx - 15, y: cy - 15, id: 1 }]);
      await touch("touchMove", [{ x: cx + 15, y: cy + 15, id: 1 }]);
      await touch("touchEnd", []);
      await expect(page.locator(".canvas-bottom")).toContainText("1 selected");
      const before = await page.evaluate(() => window.brickEditor!.query());
      const cameraBefore = await page.locator(".viewport canvas").screenshot({
        style:
          ".hud-top, .hud-el, .canvas-toolbar, .left-sidebar, .right-sidebar, .mode-card, .status-bar, .mobile-nav { visibility: hidden !important; }",
      });
      await touch("touchStart", [{ x: cx - 15, y: cy - 15, id: 1 }]);
      await touch("touchMove", [{ x: cx + 15, y: cy + 15, id: 1 }]);
      await touch("touchStart", [
        { x: cx + 15, y: cy + 15, id: 1 },
        { x: cx + 35, y: cy + 35, id: 2 },
      ]);
      await touch("touchMove", [
        { x: cx - 15, y: cy - 15, id: 1 },
        { x: cx + 65, y: cy + 65, id: 2 },
      ]);
      await touch("touchEnd", [{ x: cx + 65, y: cy + 65, id: 2 }]);
      await touch("touchEnd", []);
      await expect(page.locator(".canvas-bottom")).toContainText("1 selected");
      expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
        before,
      );
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      expect(
        (
          await page.locator(".viewport canvas").screenshot({
            style:
              ".hud-top, .hud-el, .canvas-toolbar, .left-sidebar, .right-sidebar, .mode-card, .status-bar, .mobile-nav { visibility: hidden !important; }",
          })
        ).equals(cameraBefore),
      ).toBe(false);
      await cdp.detach();
    } finally {
      await context.close();
    }
  });
