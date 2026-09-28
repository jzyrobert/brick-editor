import { test, expect, type Page } from "@playwright/test";

// A 2 × 4 brick off the world grid (x 5, z 3) and a loose 1 × 1 elsewhere: only
// connector snapping, not grid stacking, can seat a new brick on its studs.
const source = `0 FILE c.ldr
1 4 5 -24 3 1 0 0 0 1 0 0 0 1 3001.dat
1 14 200 -24 200 1 0 0 0 1 0 0 0 1 3005.dat`;

async function setup(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(
    (text) =>
      window
        .brickEditor!.project.import({ format: "ldraw", text })
        .then(() => window.brickEditor!.ready()),
    source,
  );
  await page.evaluate(() =>
    window.brickEditor!.camera.set({
      space: "ldraw",
      projection: "perspective",
      position: [5, -420, 160],
      target: [5, -24, 3],
      up: [0, -1, 0],
      fovDeg: 40,
      near: 1,
      far: 5000,
    }),
  );
  return errors;
}
const centre = async (page: Page) => {
  const box = (await page.locator(".viewport canvas").boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test("placing a brick on an off-grid brick snaps to its studs, turns, connects and selects the assembly", async ({
  page,
}, testInfo) => {
  const errors = await setup(page);
  const place = page.locator(".placement-card");
  await page.getByRole("button", { name: /Brick 2 × 4 3001/ }).click();
  const c = await centre(page);
  await page.mouse.click(c.x, c.y);
  const status = page.locator(".status-bar");
  await expect(status).toContainText("stacked on top");
  await expect(status).toContainText("Snapped to 8 stud connections");
  // The world grid alone would give x 0/20, z 0/20; the studs say 5 and 3.
  await expect(place.getByLabel("Place X")).toHaveValue("5");
  await expect(place.getByLabel("Place Y")).toHaveValue("-48");
  await expect(place.getByLabel("Place Z")).toHaveValue("3");
  await page.screenshot({ path: testInfo.outputPath("snapped-preview.png") });
  // A 90° turn keeps the preview on the brick and on its stud lattice.
  await place.getByRole("button", { name: "Rotate placement" }).click();
  await expect(place.getByLabel("Place Y")).toHaveValue("-48");
  const turned = await Promise.all(
    ["X", "Z"].map(async (a) =>
      Number(await place.getByLabel("Place " + a).inputValue()),
    ),
  );
  expect((((turned[0] - 5) % 10) + 10) % 10).toBe(0);
  expect((((turned[1] - 3) % 10) + 10) % 10).toBe(0);
  await place.getByRole("button", { name: "Place part", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => window.brickEditor!.query().then((q) => q.count)),
    )
    .toBe(3);

  // Verified connectivity: the two bricks connect, the 1 × 1 floats.
  const health = await page.evaluate(() => window.brickEditor!.health.check());
  const connectivity = health.checks.find((k) => k.id === "connectivity")!;
  expect(connectivity).toMatchObject({
    status: "warning",
    basis: "exact",
    count: 1,
  });
  const q = await page.evaluate(() => window.brickEditor!.query());
  const loose = q.occurrences.find((o) => o.node.ref === "3005.dat")!;
  expect(connectivity.occurrenceIds).toEqual([loose.id]);
  const groups = await page.evaluate(() =>
    window.brickEditor!.connectors.groups(),
  );
  expect(groups.groups.map((g: string[]) => g.length)).toEqual([2, 1]);
  expect(groups.contacts).toBe(4); // the turned brick crosses on 4 studs

  // Connected-assembly selection from the Inspector's selection tools.
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.mouse.click(c.x, c.y);
  await expect(page.locator(".canvas-bottom")).toContainText("1 selected");
  await page
    .locator(".right-tabs")
    .getByRole("button", { name: "Inspector", exact: true })
    .click();
  await page.getByText("Selection tools", { exact: true }).click();
  await page.getByRole("button", { name: "Select connected" }).click();
  await expect(page.locator(".canvas-bottom")).toContainText("2 selected");
  await expect(status).toContainText("Selected 2 connected parts");
  const selected = await page.evaluate(() =>
    window.brickEditor!.query({ selection: true }),
  );
  expect(selected.occurrences.map((o) => o.node.ref).sort()).toEqual([
    "3001.dat",
    "3001.dat",
  ]);
  const api = await page.evaluate(
    (id) => window.brickEditor!.connectors.connected({ occurrenceIds: [id] }),
    loose.id,
  );
  expect(api.occurrenceIds).toEqual([loose.id]);
  await page.screenshot({
    path: testInfo.outputPath("connected-selection.png"),
  });
  expect(errors).toEqual([]);
});

test("a stud workplane sits on the tapped stud and follows its part", async ({
  page,
}) => {
  const errors = await setup(page);
  await page
    .locator(".right-tabs")
    .getByRole("button", { name: "Inspector", exact: true })
    .click();
  const drawer = page.locator("details.workplane-drawer");
  await drawer.getByText("Workplane and grid", { exact: true }).click();
  const panel = page.getByRole("region", { name: "Workplane settings" });
  await panel.getByRole("button", { name: "Pick a stud", exact: true }).click();
  const c = await centre(page);
  await page.mouse.click(c.x, c.y);
  await expect(page.locator(".status-bar")).toContainText(
    "Workplane set on the stud",
  );
  await page
    .locator(".right-tabs")
    .getByRole("button", { name: "Inspector", exact: true })
    .click();
  if (!(await drawer.evaluate((d) => (d as HTMLDetailsElement).open)))
    await drawer.getByText("Workplane and grid", { exact: true }).click();
  await panel.getByText("Numerical plane", { exact: true }).click();
  // The brick's top (stud base) is at y −24; the origin is a stud-cell corner.
  await expect(panel.getByLabel("Plane origin Y", { exact: true })).toHaveValue(
    "-24",
  );
  const x = Number(
    await panel.getByLabel("Plane origin X", { exact: true }).inputValue(),
  );
  const z = Number(
    await panel.getByLabel("Plane origin Z", { exact: true }).inputValue(),
  );
  expect((((x - 5) % 20) + 20) % 20).toBe(0);
  expect((((z - 3) % 20) + 20) % 20).toBe(0);
  await expect(panel.getByLabel("Plane normal Y", { exact: true })).toHaveValue(
    "-1",
  );
  expect(errors).toEqual([]);
});

test("tap-to-place on a phone shows the snapped preview", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = await setup(page);
  await page
    .getByRole("navigation", { name: "Mobile panels" })
    .getByRole("button", { name: "Parts", exact: true })
    .click();
  await page.getByRole("button", { name: /Brick 2 × 4 3001/ }).click();
  const close = page
    .locator(".mobile-sheet-head")
    .getByRole("button", { name: "Close" });
  if (await close.isVisible()) await close.click();
  const c = await centre(page);
  await page.touchscreen.tap(c.x, c.y);
  await expect(page.locator(".status-bar")).toContainText(
    "Snapped to 8 stud connections",
  );
  await expect(
    page.locator(".placement-card").getByLabel("Place X"),
  ).toHaveValue("5");
  await page.screenshot({ path: testInfo.outputPath("phone-snapped.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await context.close();
});
