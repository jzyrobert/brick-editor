import { test, expect, type Page } from "@playwright/test";

// "Snap together" building (docs/CONNECTORS.md, Connected building): on by
// default, Place accepts only parts that connect to studs, hinges or the
// ground; moves that would leave connected parts floating are refused. Off,
// placement is free as before.

test.describe.configure({ timeout: 180_000 });

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
 * Screen point of an LDraw point: the camera turns to look straight at it
 * from the direction of `cam` (eye minus target), so it lies at the canvas
 * centre whatever the field of view or aspect.
 */
async function screenOf(page: Page, cam: Camera, p: number[]) {
  await page.evaluate(
    ([c, point]) =>
      window.brickEditor!.camera.set({
        space: "ldraw",
        projection: "perspective",
        position: point.map((v, i) => v + c.position[i] - c.target[i]) as [
          number,
          number,
          number,
        ],
        target: point as [number, number, number],
        up: [0, -1, 0],
        fovDeg: 40,
        near: 1,
        far: 5000,
      }),
    [cam, p] as const,
  );
  await page.evaluate(() => window.brickEditor!.ready());
  const box = (await page.locator(".viewport canvas").boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
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
const count = (page: Page) =>
  page.evaluate(() => window.brickEditor!.query().then((q) => q.count));
const card = (page: Page) => page.locator(".placement-card");
const placeButton = (page: Page) =>
  card(page).getByRole("button", { name: "Place part", exact: true });
const snapSwitch = (page: Page) =>
  card(page).getByRole("switch", { name: "Snap together" });

// A brick imported floating (existing models are never refused) and one on
// the ground beside it; the camera looks along +z.
const FLOATING = [
  "0 FILE f.ldr",
  "1 4 0 -100 0 1 0 0 0 1 0 0 0 1 3001.dat",
  "1 1 200 -24 0 1 0 0 0 1 0 0 0 1 3001.dat",
].join("\n");
const VIEW: Camera = { position: [80, -260, -420], target: [80, -40, 0] };

test("on by default: a floating preview is refused and tinted; studs and the ground are accepted", async ({
  page,
}, testInfo) => {
  const errors = await setup(page, FLOATING, VIEW);
  await choose(page, "3001", /Brick 2 × 4 3001/);
  await page.getByRole("button", { name: "Yellow", exact: true }).click();
  await expect(snapSwitch(page)).toHaveAttribute("aria-checked", "true");
  // The default preview stands on the ground.
  await expect(placeButton(page)).toBeEnabled();
  // Beside the floating brick: nothing to connect to.
  const side = await screenOf(page, VIEW, [-20, -88, -20]);
  await page.mouse.click(side.x, side.y);
  await expect(card(page)).toHaveClass(/refused/);
  await expect(card(page)).toContainText(
    "Nothing to connect to here — move it onto studs or the ground.",
  );
  await expect(page.locator(".status-bar")).toContainText(
    "Nothing to connect to here",
  );
  await expect(placeButton(page)).toBeDisabled();
  expect(await values(page)).toEqual([-20, -100, -40]);
  await page.evaluate(() => window.brickEditor!.ready());
  await page.screenshot({
    path: testInfo.outputPath("desktop-refused-preview.png"),
  });
  const api = await page.evaluate(() =>
    window.brickEditor!.connectors.validatePlacement({
      part: "3001.dat",
      position: [-20, -100, -40],
    }),
  );
  expect(api).toMatchObject({ ok: false, reason: "floating" });
  // On top of the grounded brick: snapped to its studs and placeable.
  const top = await screenOf(page, VIEW, [200, -24, -18]);
  await page.mouse.click(top.x, top.y);
  await expect(page.locator(".status-bar")).toContainText(
    /Snapped to \d+ stud connection/,
  );
  await expect(card(page)).not.toHaveClass(/refused/);
  await page.evaluate(() => window.brickEditor!.ready());
  await page.screenshot({
    path: testInfo.outputPath("desktop-valid-preview.png"),
  });
  await placeButton(page).click();
  await expect.poll(() => count(page)).toBe(3);
  // On the ground.
  const ground = await screenOf(page, VIEW, [-100, -1, 60]);
  await page.mouse.click(ground.x, ground.y);
  await expect(placeButton(page)).toBeEnabled();
  expect((await values(page))[1]).toBe(-24);
  await placeButton(page).click();
  await expect.poll(() => count(page)).toBe(4);
  expect(errors).toEqual([]);
});

test("placing on a baseplate and a door into its frame work with Snap together on", async ({
  page,
}) => {
  const view: Camera = { position: [0, -300, -520], target: [0, -60, 0] };
  const errors = await setup(
    page,
    [
      "0 FILE b.ldr",
      "1 2 0 -4 0 1 0 0 0 1 0 0 0 1 3811.dat",
      "1 15 100 -148 0 1 0 0 0 1 0 0 0 1 60596.dat",
    ].join("\n"),
    view,
  );
  await choose(page, "3001", /Brick 2 × 4 3001/);
  const plate = await screenOf(page, view, [-100, -8, -40]);
  await page.mouse.click(plate.x, plate.y);
  await expect(page.locator(".status-bar")).toContainText(
    "Snapped to 8 stud connections",
  );
  await expect(placeButton(page)).toBeEnabled();
  await placeButton(page).click();
  await expect.poll(() => count(page)).toBe(3);
  await choose(page, "60616", /Door 1 × 4 × 6 Smooth/);
  const post = await screenOf(page, view, [62, -78, -10]);
  await page.mouse.click(post.x, post.y);
  await expect(page.locator(".status-bar")).toContainText(
    "Seated in the frame",
  );
  await expect(placeButton(page)).toBeEnabled();
  await placeButton(page).click();
  await expect.poll(() => count(page)).toBe(4);
  expect(errors).toEqual([]);
});

test("off: placement is free again, and the choice is remembered on this device", async ({
  page,
}) => {
  const errors = await setup(page, FLOATING, VIEW);
  await choose(page, "3001", /Brick 2 × 4 3001/);
  await snapSwitch(page).click();
  await expect(snapSwitch(page)).toHaveAttribute("aria-checked", "false");
  const side = await screenOf(page, VIEW, [-20, -88, -20]);
  await page.mouse.click(side.x, side.y);
  expect(await values(page)).toEqual([-20, -100, -40]);
  await expect(card(page)).not.toHaveClass(/refused/);
  await expect(placeButton(page)).toBeEnabled();
  await placeButton(page).click();
  await expect.poll(() => count(page)).toBe(3);
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(() => window.brickEditor!.ready());
  await choose(page, "3001", /Brick 2 × 4 3001/);
  await expect(snapSwitch(page)).toHaveAttribute("aria-checked", "false");
  await snapSwitch(page).click();
  await expect(snapSwitch(page)).toHaveAttribute("aria-checked", "true");
  expect(errors).toEqual([]);
});

async function selectAllAndOpenMove(page: Page) {
  const mobileInspector = page
    .getByRole("navigation", { name: "Mobile panels" })
    .getByRole("button", { name: "Inspector", exact: true });
  if (await mobileInspector.isVisible()) await mobileInspector.click();
  else
    await page
      .locator(".right-tabs")
      .getByRole("button", { name: "Inspector", exact: true })
      .click();
  await page.getByText("Selection tools", { exact: true }).click();
  await page
    .getByRole("button", { name: "Select editable parts", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Move handles", exact: true }),
  ).toBeVisible();
}

test("a move that would leave connected parts floating is refused", async ({
  page,
}) => {
  const errors = await setup(
    page,
    [
      "0 FILE m.ldr",
      "1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat",
      "1 1 0 -48 0 1 0 0 0 1 0 0 0 1 3001.dat",
    ].join("\n"),
    { position: [0, -300, -400], target: [0, -24, 0] },
  );
  await selectAllAndOpenMove(page);
  await expect(page.getByLabel(/Snap together: moved parts/)).toBeChecked();
  const before = await page.evaluate(() => window.brickEditor!.query());
  await page.getByText("Exact move and rotation", { exact: true }).click();
  // Lifting the stack off the ground: refused, nothing changes.
  await page.getByLabel("Move Y delta", { exact: true }).fill("-40");
  await page
    .getByRole("button", { name: "Apply exact move", exact: true })
    .click();
  await expect(page.locator(".status-bar")).toContainText(
    "Not moved: it would float",
  );
  expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
    before,
  );
  const verdict = await page.evaluate(
    (ids) => {
      const t = (y: number) => ({
        position: [0, y, 0] as [number, number, number],
        basis: [1, 0, 0, 0, 1, 0, 0, 0, 1] as [
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
        ],
      });
      return window.brickEditor!.connectors.validateMove({
        transforms: { [ids[0]]: t(-64), [ids[1]]: t(-88) },
      });
    },
    before.occurrences.map((o: { id: string }) => o.id),
  );
  expect(verdict).toMatchObject({ ok: false, heldBefore: true });
  // Sliding along the ground keeps it standing: applied.
  await page.getByLabel("Move Y delta", { exact: true }).fill("0");
  await page.getByLabel("Move X delta", { exact: true }).fill("40");
  await page
    .getByRole("button", { name: "Apply exact move", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.brickEditor!.query())).revision,
    )
    .toBe(before.revision + 1);
  // With Snap together off the lift is allowed.
  await page.getByLabel(/Snap together: moved parts/).uncheck();
  await page.getByLabel("Move X delta", { exact: true }).fill("0");
  await page.getByLabel("Move Y delta", { exact: true }).fill("-40");
  await page
    .getByRole("button", { name: "Apply exact move", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.brickEditor!.query())).revision,
    )
    .toBe(before.revision + 2);
  expect(errors).toEqual([]);
});

test("a handle drag that would leave a part floating springs back", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.project.import({
      format: "ldraw",
      text: "0 FILE h.ldr\n1 1 0 -48 0 1 0 0 0 1 0 0 0 1 3001.dat\n",
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
  // The imported brick floats; stand it on a grounded brick by API (commands
  // are never restricted by Snap together).
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    const q = await a.query();
    await a.dispatch({
      schemaVersion: 1,
      commandId: "base",
      expectedRevision: q.revision,
      type: "parts.add",
      payload: {
        layerId: "base",
        parts: [
          {
            ref: "3001.dat",
            colorCode: "4",
            transform: {
              position: [0, -24, 0],
              basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
            },
          },
        ],
      },
    });
    await a.ready();
  });
  const q0 = await page.evaluate(() => window.brickEditor!.query());
  const top = q0.occurrences.find(
    (o: { transform: { position: number[] } }) =>
      o.transform.position[1] === -48,
  )!;
  const base = q0.occurrences.find(
    (o: { transform: { position: number[] } }) =>
      o.transform.position[1] === -24,
  )!;
  // Select only the upper brick by tapping it from above.
  await page
    .getByRole("button", { name: "Select", exact: true })
    .first()
    .click();
  const r = (await page.locator(".viewport canvas").boundingBox())!;
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  const mobileInspector = page
    .getByRole("navigation", { name: "Mobile panels" })
    .getByRole("button", { name: "Inspector", exact: true });
  if (await mobileInspector.isVisible()) await mobileInspector.click();
  else
    await page
      .locator(".right-tabs")
      .getByRole("button", { name: "Inspector", exact: true })
      .click();
  await page.getByRole("button", { name: "Move handles", exact: true }).click();
  const start = {
    x: r.x + r.width / 2 + r.height / 8,
    y: r.y + r.height / 2,
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + r.height * 0.45, start.y, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator(".status-bar")).toContainText(
    "Not moved: it would float",
  );
  const q1 = await page.evaluate(() => window.brickEditor!.query());
  expect(q1.revision).toBe(q0.revision);
  expect(
    q1.occurrences.find((o: { id: string }) => o.id === top.id)!.transform,
  ).toEqual(top.transform);
  expect(base).toBeTruthy();
});

test("phone: the refusal reads in the card and every control stays on screen", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();
  const view: Camera = { position: [60, -300, -620], target: [60, -40, 0] };
  const errors = await setup(page, FLOATING, view);
  const hotbar = page.getByRole("navigation", { name: "Mobile panels" });
  if (!(await page.getByLabel("Search parts").isVisible()))
    await hotbar.getByRole("button", { name: "Parts", exact: true }).click();
  await choose(page, "3001", /Brick 2 × 4 3001/);
  await page.getByRole("button", { name: "Yellow", exact: true }).click();
  const close = page
    .locator(".mobile-sheet-head")
    .getByRole("button", { name: "Close" });
  if (await close.isVisible()) await close.click();
  const side = await screenOf(page, view, [-20, -88, -20]);
  await page.touchscreen.tap(side.x, side.y);
  await expect(card(page)).toHaveClass(/refused/);
  await expect(placeButton(page)).toBeDisabled();
  const check = async () => {
    for (const b of await card(page).getByRole("button").all()) {
      if (!(await b.isVisible())) continue;
      const r = (await b.boundingBox())!;
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(360);
      expect(r.height).toBeGreaterThanOrEqual(36);
    }
    const refusal = card(page).locator(".placement-refusal");
    if (await refusal.isVisible()) {
      // The whole reason shows (it wraps rather than being cut off).
      const clipped = await refusal.evaluate(
        (el) => el.scrollWidth > el.clientWidth + 1,
      );
      expect(clipped).toBe(false);
    }
  };
  await check();
  await page.evaluate(() => window.brickEditor!.ready());
  await page.screenshot({
    path: testInfo.outputPath("phone-refused-preview.png"),
  });
  const top = await screenOf(page, view, [200, -24, -18]);
  await page.touchscreen.tap(top.x, top.y);
  await expect(page.locator(".status-bar")).toContainText(
    /Snapped to \d+ stud connection/,
  );
  await expect(placeButton(page)).toBeEnabled();
  await check();
  await page.evaluate(() => window.brickEditor!.ready());
  await page.screenshot({
    path: testInfo.outputPath("phone-valid-preview.png"),
  });
  expect(errors).toEqual([]);
  await context.close();
});
