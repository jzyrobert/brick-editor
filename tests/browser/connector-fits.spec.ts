import { test, expect, type Page } from "@playwright/test";

// Connector fits in the Place tool: cycling with Next fit (button, N, Tab),
// hysteresis on repeated taps, side studs and doors seated in their frames.

type Camera = { position: number[]; target: number[] };
async function setup(page: Page, text: string, camera: Camera) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(
    (t) =>
      window
        .brickEditor!.project.import({ format: "ldraw", text: t })
        .then(() => window.brickEditor!.ready()),
    text,
  );
  await page.evaluate(
    (c) =>
      window.brickEditor!.camera.set({
        space: "ldraw",
        projection: "perspective",
        position: c.position as [number, number, number],
        target: c.target as [number, number, number],
        up: [0, -1, 0],
        fovDeg: 40,
        near: 1,
        far: 5000,
      }),
    camera,
  );
  return errors;
}
/**
 * Screen point of an LDraw point for a camera looking straight along +z from
 * `eye` (x to the right, −y up), vertical field of view 40°.
 */
async function screenOf(page: Page, eye: number[], p: number[]) {
  const box = (await page.locator(".viewport canvas").boundingBox())!;
  const depth = p[2] - eye[2];
  const t = Math.tan((20 * Math.PI) / 180);
  const ndcX = (p[0] - eye[0]) / (depth * t * (box.width / box.height));
  const ndcY = -(p[1] - eye[1]) / (depth * t);
  return {
    x: box.x + (box.width / 2) * (1 + ndcX),
    y: box.y + (box.height / 2) * (1 - ndcY),
  };
}
const values = (page: Page) =>
  Promise.all(
    ["X", "Y", "Z"].map(async (a) =>
      Number(
        await page
          .locator(".placement-card")
          .getByLabel("Place " + a)
          .inputValue(),
      ),
    ),
  );
const choose = async (page: Page, query: string, name: RegExp) => {
  await page.getByLabel("Search parts").fill(query);
  await page.getByRole("button", { name }).first().click();
};

test("Next fit cycles the connector fits; a repeated tap keeps the fit shown", async ({
  page,
}, testInfo) => {
  const errors = await setup(
    page,
    "0 FILE a.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
    {
      position: [0, -420, 160],
      target: [0, 0, 0],
    },
  );
  await choose(page, "3001", /Brick 2 × 4 3001/);
  const box = (await page.locator(".viewport canvas").boundingBox())!;
  const c = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.click(c.x, c.y);
  const status = page.locator(".status-bar");
  await expect(status).toContainText("Snapped to 8 stud connections");
  await expect(status).toContainText("Fit 1 of");
  expect(await values(page)).toEqual([0, -24, 0]);
  const next = page.getByRole("button", { name: "Next fit" });
  await expect(next).toContainText(/1\/\d/);
  const total = Number((await next.innerText()).split("/")[1]);
  expect(total).toBeGreaterThanOrEqual(3);
  await page.screenshot({ path: testInfo.outputPath("fit-1.png") });
  // Button, N and Tab each move to the next fit, all still connected.
  const seen = [JSON.stringify(await values(page))];
  await next.click();
  await expect(next).toContainText("2/" + total);
  seen.push(JSON.stringify(await values(page)));
  await page.locator(".viewport canvas").hover();
  await page.keyboard.press("n");
  await expect(next).toContainText("3/" + total);
  seen.push(JSON.stringify(await values(page)));
  await expect(status).toContainText(/Snapped to \d+ stud connection/);
  expect(new Set(seen).size).toBe(3);
  await page.screenshot({ path: testInfo.outputPath("fit-3.png") });
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.keyboard.press("Tab");
  await expect(next).toContainText((3 % total) + 1 + "/" + total);
  // Back on the first fit, taps a few pixels apart keep it (no flicker).
  await page.mouse.click(c.x, c.y);
  expect(await values(page)).toEqual([0, -24, 0]);
  for (const dx of [4, -4, 6]) {
    await page.mouse.click(c.x + dx, c.y + 3);
    expect(await values(page)).toEqual([0, -24, 0]);
  }
  expect(errors).toEqual([]);
});

test("tapping a side-stud brick's face turns a plate onto its side stud", async ({
  page,
}, testInfo) => {
  const eye = [0, 10, -300];
  const errors = await setup(
    page,
    "0 FILE s.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 87087.dat",
    { position: eye, target: [0, 10, 0] },
  );
  await choose(page, "3024", /Plate 1 × 1 3024/);
  // Tap the face beside the stud (the stud itself also works).
  const p = await screenOf(page, eye, [6, 3, -10]);
  await page.mouse.click(p.x, p.y);
  const status = page.locator(".status-bar");
  await expect(status).toContainText(
    "Turned onto the side studs: 1 stud connection",
  );
  expect(await values(page)).toEqual([0, 10, -18]);
  await page.screenshot({ path: testInfo.outputPath("side-stud-preview.png") });
  await page
    .locator(".placement-card")
    .getByRole("button", { name: "Place part", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => window.brickEditor!.query().then((q) => q.count)),
    )
    .toBe(2);
  const q = await page.evaluate(() => window.brickEditor!.query());
  const plate = q.occurrences.find((o) => o.node.ref === "3024.dat")!;
  // The plate's up axis (local −Y) points along the stud: world −z.
  const b = plate.transform.basis;
  expect([-b[1], -b[4], -b[7]].map((n) => Math.round(n) || 0)).toEqual([
    0, 0, -1,
  ]);
  const groups = await page.evaluate(() =>
    window.brickEditor!.connectors.groups(),
  );
  expect(groups.groups).toHaveLength(1);
  expect(groups.contacts).toBe(1);
  expect(errors).toEqual([]);
});

test("a door tapped onto its frame seats in the hinge; Next fit swaps the hinge side", async ({
  page,
}, testInfo) => {
  const eye = [0, 70, -520];
  const errors = await setup(
    page,
    "0 FILE d.ldr\n1 15 0 0 0 1 0 0 0 1 0 0 0 1 60596.dat",
    { position: eye, target: [0, 70, 0] },
  );
  await choose(page, "60616", /Door 1 × 4 × 6 Smooth/);
  // Tap the left post of the frame.
  const post = await screenOf(page, eye, [-38, 70, -10]);
  await page.mouse.click(post.x, post.y);
  const status = page.locator(".status-bar");
  await expect(status).toContainText("Seated in the frame");
  await expect(status).toContainText("2 hinge pins");
  expect(await values(page)).toEqual([-32, 0, 5]);
  await page.screenshot({ path: testInfo.outputPath("door-left-hinge.png") });
  const next = page.getByRole("button", { name: "Next fit" });
  await expect(next).toContainText("1/2");
  await next.click();
  expect(await values(page)).toEqual([32, 0, 5]);
  await page.screenshot({ path: testInfo.outputPath("door-right-hinge.png") });
  // Rotate also swaps the side for a door in a frame.
  await page
    .locator(".placement-card")
    .getByRole("button", { name: "Rotate placement" })
    .click();
  expect(await values(page)).toEqual([-32, 0, 5]);
  await page
    .locator(".placement-card")
    .getByRole("button", { name: "Place part", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => window.brickEditor!.query().then((q) => q.count)),
    )
    .toBe(2);
  const q = await page.evaluate(() => window.brickEditor!.query());
  const door = q.occurrences.find((o) => o.node.ref === "60616a.dat")!;
  expect(door.transform).toEqual({
    position: [-32, 0, 5],
    basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  });
  const groups = await page.evaluate(() =>
    window.brickEditor!.connectors.groups(),
  );
  expect(groups.groups).toHaveLength(1);
  // The Play agent's pivot comes from the same data.
  const part = await page.evaluate(() =>
    window.brickEditor!.connectors.part({ ref: "60616a.dat" }),
  );
  expect(part.hinge).toMatchObject({ axis: [0, -1, 0], pivot: [0, 70, 0] });
  await page.screenshot({ path: testInfo.outputPath("door-placed.png") });
  expect(errors).toEqual([]);
});

const look = (page: Page, target: number[], from: number[]) =>
  page.evaluate(
    ([t, f]) =>
      window.brickEditor!.camera.set({
        space: "ldraw",
        projection: "perspective",
        position: f as [number, number, number],
        target: t as [number, number, number],
        up: [0, -1, 0],
        fovDeg: 40,
        near: 1,
        far: 5000,
      }),
    [target, from],
  );

test("placed side-stud and door fits connect and read correctly from an angle", async ({
  page,
}, testInfo) => {
  const errors = await setup(
    page,
    [
      "0 FILE v.ldr",
      "1 4 0 0 0 1 0 0 0 1 0 0 0 1 87087.dat",
      "1 1 0 10 -18 1 0 0 0 0 -1 0 1 0 3024.dat",
      "1 15 120 -120 0 1 0 0 0 1 0 0 0 1 60596.dat",
      "1 4 88 -120 5 1 0 0 0 1 0 0 0 1 60616a.dat",
    ].join("\n"),
    { position: [-160, -160, -260], target: [40, -40, 0] },
  );
  const groups = await page.evaluate(() =>
    window.brickEditor!.connectors.groups(),
  );
  // Brick with its side plate, frame with its door: two connected groups.
  expect(groups.groups.map((g: string[]) => g.length)).toEqual([2, 2]);
  await page.evaluate(() => window.brickEditor!.ready());
  await page.screenshot({ path: testInfo.outputPath("fits-placed.png") });
  await look(page, [120, -50, 0], [-120, -140, -300]);
  await page.evaluate(() => window.brickEditor!.ready());
  await page.screenshot({ path: testInfo.outputPath("door-angle.png") });
  expect(errors).toEqual([]);
});

test("the phone placement card stays compact with Next fit", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 600 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const eye = [0, 70, -700];
  const errors = await setup(
    page,
    "0 FILE p.ldr\n1 15 0 0 0 1 0 0 0 1 0 0 0 1 60596.dat",
    { position: eye, target: [0, 70, 0] },
  );
  const hotbar = page.getByRole("navigation", { name: "Mobile panels" });
  if (!(await page.getByLabel("Search parts").isVisible()))
    await hotbar.getByRole("button", { name: "Parts", exact: true }).click();
  await choose(page, "60616", /Door 1 × 4 × 6 Smooth/);
  const close = page
    .locator(".mobile-sheet-head")
    .getByRole("button", { name: "Close" });
  if (await close.isVisible()) await close.click();
  const post = await screenOf(page, eye, [-38, 60, -10]);
  await page.touchscreen.tap(post.x, post.y);
  await expect(page.locator(".status-bar")).toContainText(
    "Seated in the frame",
  );
  const card = page.locator(".placement-card");
  const next = card.getByRole("button", { name: "Next fit" });
  await expect(next).toBeVisible();
  // Every control stays on screen and at a touch size.
  for (const b of await card.getByRole("button").all()) {
    if (!(await b.isVisible())) continue;
    const r = (await b.boundingBox())!;
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(360);
    expect(r.height).toBeGreaterThanOrEqual(36);
  }
  const box = (await card.boundingBox())!;
  expect(box.height).toBeLessThan(200);
  await page.screenshot({ path: testInfo.outputPath("phone-door-fit.png") });
  await next.tap();
  expect(await values(page)).toEqual([32, 0, 5]);
  expect(errors).toEqual([]);
  await context.close();
});
