import { test, expect, type Page } from "@playwright/test";
import { openTool } from "./helpers/mode";
async function setup(page: Page) {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.project.import({
      format: "ldraw",
      text: "0 Original transform fixture\n1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat\n",
    });
    await a.ready({ strict: true });
    await a.camera.set({
      space: "ldraw",
      projection: "orthographic",
      position: [0, -600, 0],
      target: [0, -12, 0],
      up: [0, 0, 1],
      span: 500,
      fovDeg: 45,
      near: 0.5,
      far: 5000,
    });
  });
  const mobileInspector = page
    .getByRole("navigation", { name: "Mobile panels" })
    .getByRole("button", { name: "Inspector", exact: true });
  if (await mobileInspector.isVisible()) await mobileInspector.click();
  else
    await page
      .locator(".right-tabs")
      .getByRole("button", { name: "Inspector", exact: true })
      .click();
  await openTool(page, "Selection tools");
  await page
    .getByRole("button", { name: "Select editable parts", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Move handles", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Move handles", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Move handles", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
}
async function axisPoint(page: Page, coarse = false) {
  const r = (await page.locator(".viewport canvas").boundingBox())!;
  return {
    x: r.x + r.width / 2 + (r.height / 8) * (coarse ? 1.4 : 1),
    y: r.y + r.height / 2,
  };
}
test("desktop transform drag previews, cancels, commits once and supports exact numeric alternatives", async ({
  page,
}) => {
  await setup(page);
  const original = await page.evaluate(() => window.brickEditor!.query());
  let start = await axisPoint(page);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 60, start.y, { steps: 8 });
  await expect(
    page.getByRole("button", { name: "Cancel transform", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
    original,
  );
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
    original,
  );
  start = await axisPoint(page);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 90, start.y, { steps: 10 });
  expect(
    (await page.evaluate(() => window.brickEditor!.query())).revision,
  ).toBe(original.revision);
  await page.mouse.up();
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.brickEditor!.query())).revision,
    )
    .toBe(original.revision + 1);
  const moved = await page.evaluate(() => window.brickEditor!.query());
  expect(moved.occurrences[0].transform.position[0]).toBeGreaterThan(20);
  await page.evaluate(async () => {
    const a = window.brickEditor!,
      q = await a.query();
    await a.dispatch({
      schemaVersion: 1,
      commandId: "undo-gizmo",
      expectedRevision: q.revision,
      type: "history.undo",
      payload: {},
    });
    await a.ready();
  });
  expect(
    (await page.evaluate(() => window.brickEditor!.query())).occurrences,
  ).toEqual(original.occurrences);
  await page.getByText("Exact move and rotation", { exact: true }).click();
  await page.getByLabel("Move X delta", { exact: true }).fill("13.25");
  await page
    .getByRole("button", { name: "Apply exact move", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.brickEditor!.query())).occurrences[0]
          .transform.position[0],
    )
    .toBe(13.25);
});
test("1080×1800 touch transform commits one gesture and a second pointer cancels the next preview", async ({
  browser,
}) => {
  const context = await browser.newContext({
      viewport: { width: 1080, height: 1800 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 1,
    }),
    page = await context.newPage();
  await setup(page);
  await page
    .locator(".right-sidebar .mobile-sheet-head")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  const original = await page.evaluate(() => window.brickEditor!.query()),
    start = await axisPoint(page, true),
    cdp = await context.newCDPSession(page);
  const touch = (
    type: "touchStart" | "touchMove" | "touchEnd",
    points: Array<{ x: number; y: number; id: number }>,
  ) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
  await touch("touchStart", [{ ...start, id: 1 }]);
  await touch("touchMove", [{ x: start.x + 80, y: start.y, id: 1 }]);
  expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
    original,
  );
  await touch("touchEnd", []);
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.brickEditor!.query())).revision,
    )
    .toBe(original.revision + 1);
  await page.evaluate(async () => {
    const a = window.brickEditor!,
      q = await a.query();
    await a.dispatch({
      schemaVersion: 1,
      commandId: "undo-touch-transform",
      expectedRevision: q.revision,
      type: "history.undo",
      payload: {},
    });
    await a.ready();
  });
  const beforeCancel = await page.evaluate(() => window.brickEditor!.query()),
    again = await axisPoint(page, true);
  await touch("touchStart", [{ ...again, id: 2 }]);
  await touch("touchMove", [{ x: again.x + 50, y: again.y, id: 2 }]);
  await touch("touchStart", [
    { x: again.x + 50, y: again.y, id: 2 },
    { x: again.x - 100, y: again.y + 70, id: 3 },
  ]);
  await touch("touchMove", [
    { x: again.x + 70, y: again.y + 20, id: 2 },
    { x: again.x - 130, y: again.y + 80, id: 3 },
  ]);
  await touch("touchEnd", []);
  expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
    beforeCancel,
  );
  await context.close();
});
