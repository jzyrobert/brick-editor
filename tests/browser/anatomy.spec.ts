import { expect, test, type Page } from "@playwright/test";

/** Open a sample through the automation API and wait until it is drawn. */
async function openSample(page: Page, template: string) {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async (template) => {
    const a = window.brickEditor!;
    await a.ready();
    const imported = await a.project.import({
      format: "template",
      template: template as never,
    });
    await a.ready({ minRevision: imported.revision });
    await a.camera.fit();
  }, template);
}

/** Wait until the anatomy timeline reaches `progress` (frames are slow on
 * SwiftShader, so this can take a while). */
const settle = (page: Page, progress: number) =>
  expect
    .poll(
      () =>
        page.evaluate(
          async () => (await window.brickEditor!.render.anatomy.get()).progress,
        ),
      { timeout: 90000 },
    )
    .toBe(progress);

/** Model state the view must leave untouched, and what the batches did. */
const snapshot = (page: Page) =>
  page.evaluate(async () => {
    const a = window.brickEditor!;
    const budget = await a.render.budget();
    return {
      revision: (await a.query()).revision,
      source: new TextDecoder().decode(
        (await a.project.export({ format: "ldraw" })).bytes,
      ),
      range: (await a.render.section.get()).range,
      structures: budget.batches.structures,
      drawn: budget.batches.occurrencesDrawn,
    };
  });

/** Screen point of a group's current centre (its home centre plus offset). */
const groupPoint = (page: Page, key: string) =>
  page.evaluate(async (key) => {
    const a = window.brickEditor!;
    const status = await a.render.anatomy.get();
    const scene = (window as any).__brickScene;
    const g = status.groups.find((g: { key: string }) => g.key === key)!;
    const inner = scene.anatomyView;
    const plan = inner.plan;
    const i = plan.groups.findIndex((p: { key: string }) => p.key === key);
    const box = plan.groups[i].box;
    const off = inner.applied.slice(i * 3, i * 3 + 3);
    const v = scene.root.position.clone();
    v.set(
      (box.min[0] + box.max[0]) / 2 + off[0],
      (box.min[1] + box.max[1]) / 2 + off[1],
      (box.min[2] + box.max[2]) / 2 + off[2],
    );
    scene.root.localToWorld(v);
    v.project(scene.camera);
    const rect = scene.renderer.domElement.getBoundingClientRect();
    return {
      name: g.name,
      x: rect.left + ((v.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - v.y) / 2) * rect.height,
    };
  }, key);

test("anatomy takes the jeep apart by submodel and puts it back without touching the build", async ({
  page,
}) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openSample(page, "jeep");
  const before = await snapshot(page);
  await page.getByRole("button", { name: "Camera views" }).click();
  await page.getByRole("button", { name: "Cut", exact: true }).click();
  await page.getByRole("button", { name: "Anatomy", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Put together" }),
  ).toHaveAttribute("aria-pressed", "true");
  await settle(page, 1);
  const status = await page.evaluate(() =>
    window.brickEditor!.render.anatomy.get(),
  );
  expect(status.basis).toBe("submodels");
  expect(status.groups.map((g) => g.name).sort()).toEqual(
    [
      "jeep-bed",
      "jeep-body",
      "jeep-chassis",
      "jeep-cockpit",
      "jeep-wheel-left-front",
      "jeep-wheel-left-rear",
      "jeep-wheel-right-front",
      "jeep-wheel-right-rear",
    ].sort(),
  );
  expect(status.groups.filter((g) => g.role === "anchor")).toHaveLength(1);
  expect(status.movers).toBe(7);
  // Wheels move as mirrored pairs: same distance, opposite or shared direction.
  const wheels = status.groups.filter((g) => g.name.includes("wheel"));
  for (const w of wheels) {
    const partner = status.groups.find((g) => g.key === w.mirror)!;
    expect(partner).toBeTruthy();
    expect(partner.distance).toBe(w.distance);
  }
  // Editing waits until the model is back together.
  await expect(
    page.getByRole("button", { name: "Select", exact: true }),
  ).toBeDisabled();
  const apart = await snapshot(page);
  // Render-only: same document and revision, no rebuilt batches, every part drawn.
  expect(apart.revision).toBe(before.revision);
  expect(apart.source).toBe(before.source);
  expect(apart.structures).toBe(before.structures);
  expect(apart.drawn).toBe(before.drawn);
  const spread = (r: typeof before.range) =>
    r.x!.max - r.x!.min + (r.y!.max - r.y!.min) + (r.z!.max - r.z!.min);
  expect(spread(apart.range)).toBeGreaterThan(spread(before.range) + 100);

  await page.screenshot({ path: "docs/screenshots/anatomy-desktop.png" });
  // Tap a group to isolate it: its name and part count show.
  const mover = status.groups.find((g) => g.name === "jeep-wheel-right-front")!;
  const point = await groupPoint(page, mover.key);
  await page.mouse.click(point.x, point.y);
  const focus = await page.evaluate(
    async () => (await window.brickEditor!.render.anatomy.get()).focus,
  );
  expect(focus).not.toBeNull();
  const focused = status.groups.find((g) => g.key === focus)!;
  await expect(page.locator(".anatomy-focus")).toContainText(focused.name);
  await expect(page.locator(".anatomy-focus")).toContainText(
    `${focused.parts} part`,
  );
  await page.screenshot({
    path: "docs/screenshots/anatomy-desktop-isolated.png",
  });
  await page.locator(".anatomy-focus").click();
  await expect(page.locator(".anatomy-focus")).toHaveCount(0);

  // The spread slider scales the travel.
  await page.getByLabel("Anatomy spread").fill("200");
  await expect(page.locator(".explode-control .section-label")).toHaveText(
    "Spread 200%",
  );
  const wider = await page.evaluate(() =>
    window.brickEditor!.render.anatomy.get(),
  );
  const body = wider.groups.find((g) => g.key === mover.key)!;
  expect(body.distance).toBeCloseTo(mover.distance * 2, 0);

  // Floors and anatomy are exclusive.
  await page.getByRole("button", { name: "Explode floors" }).click();
  expect(
    (await page.evaluate(() => window.brickEditor!.render.anatomy.get())).on,
  ).toBe(false);
  await page.getByRole("button", { name: "Assemble floors" }).click();

  await page.getByRole("button", { name: "Anatomy", exact: true }).click();
  await page.getByRole("button", { name: "Put together" }).click();
  await settle(page, 0);
  await expect(
    page.getByRole("button", { name: "Select", exact: true }),
  ).toBeEnabled();
  const after = await snapshot(page);
  expect(after.range).toEqual(before.range);
  expect(after.source).toBe(before.source);
  expect(after.revision).toBe(before.revision);
  expect(errors).toEqual([]);
});

test("anatomy through the automation API: the station, a flat model and nothing to take apart", async ({
  page,
}) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openSample(page, "train");
  const station = await page.evaluate(async () => {
    const a = window.brickEditor!;
    const on = await a.render.anatomy.set({ on: true });
    const off = await a.render.anatomy.set({ on: false, animate: false });
    return { on, off };
  });
  expect(station.on.on).toBe(true);
  expect(station.on.progress).toBe(1);
  expect(station.on.movers).toBeGreaterThanOrEqual(3);
  expect(station.off.progress).toBe(0);
  // A flat file: two separate stacks form two touching clusters.
  const flat = await page.evaluate(async () => {
    const a = window.brickEditor!;
    const imported = await a.project.import({
      format: "ldraw",
      text: [
        "0 FILE flat.ldr",
        "1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
        "1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat",
        "1 1 200 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
        "1 1 200 -24 0 1 0 0 0 1 0 0 0 1 3001.dat",
      ].join("\n"),
    });
    await a.ready({ minRevision: imported.revision });
    return a.render.anatomy.set({ on: true, animate: false });
  });
  expect(flat.basis).toBe("clusters");
  expect(flat.movers).toBe(1);
  const single = await page.evaluate(async () => {
    const a = window.brickEditor!;
    const imported = await a.project.import({
      format: "ldraw",
      text: "0 FILE one.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
    });
    await a.ready({ minRevision: imported.revision });
    return a.render.anatomy.set({ on: true });
  });
  expect(single).toMatchObject({ on: false, movers: 0 });
  expect(errors).toEqual([]);
});

for (const phone of [
  { width: 411, height: 685, scale: 2.625, name: "anatomy-phone" },
  { width: 360, height: 600, scale: 3, name: "anatomy-phone-small" },
])
  test(`anatomy controls fit a ${phone.width}x${phone.height} phone without overlaps`, async ({
    browser,
  }) => {
    test.setTimeout(300000);
    const context = await browser.newContext({
      viewport: { width: phone.width, height: phone.height },
      deviceScaleFactor: phone.scale,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await openSample(page, "jeep");
    await page.getByRole("button", { name: "Camera views" }).click();
    await page.getByRole("button", { name: "Cut", exact: true }).click();
    await page.getByRole("button", { name: "Anatomy", exact: true }).click();
    // On a phone the pane closes so the model can be seen coming apart.
    await expect(page.locator(".view-controls.open")).toHaveCount(0);
    await settle(page, 1);
    const status = await page.evaluate(() =>
      window.brickEditor!.render.anatomy.get(),
    );
    const wheel = status.groups.find(
      (g) => g.name === "jeep-wheel-left-front",
    )!;
    // Tap a wheel: its group is isolated, its name and part count show.
    const point = await groupPoint(page, wheel.key);
    await page.touchscreen.tap(point.x, point.y);
    await expect
      .poll(() =>
        page.evaluate(
          async () => (await window.brickEditor!.render.anatomy.get()).focus,
        ),
      )
      .not.toBeNull();
    const focused = await page.evaluate(async () => {
      const s = await window.brickEditor!.render.anatomy.get();
      return s.groups.find((g) => g.key === s.focus)!;
    });
    await expect(page.locator(".status-bar [role=status]")).toContainText(
      `${focused.name}: ${focused.parts} part`,
    );
    await page.screenshot({ path: `docs/screenshots/${phone.name}.png` });
    await page.getByRole("button", { name: "Camera views" }).click();
    await expect(page.locator(".anatomy-focus")).toContainText(focused.name);
    // Every control of the pane is on screen and none overlaps another.
    const boxes = await page
      .locator(
        ".explode-control button, .explode-control input, .explode-control .floor-check",
      )
      .evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.left, y: r.top, w: r.width, h: r.height };
        }),
      );
    expect(boxes.length).toBeGreaterThanOrEqual(5);
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(phone.width + 0.5);
      expect(b.y + b.h).toBeLessThanOrEqual(phone.height + 0.5);
    }
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i],
          b = boxes[j];
        const overlap =
          a.x < b.x + b.w - 0.5 &&
          b.x < a.x + a.w - 0.5 &&
          a.y < b.y + b.h - 0.5 &&
          b.y < a.y + a.h - 0.5;
        const nested =
          (a.x <= b.x &&
            a.y <= b.y &&
            a.x + a.w >= b.x + b.w &&
            a.y + a.h >= b.y + b.h) ||
          (b.x <= a.x &&
            b.y <= a.y &&
            b.x + b.w >= a.x + a.w &&
            b.y + b.h >= a.y + a.h);
        expect(overlap && !nested, `controls ${i} and ${j} overlap`).toBe(
          false,
        );
      }
    await page.screenshot({ path: `docs/screenshots/${phone.name}-panel.png` });
    expect(errors).toEqual([]);
    await context.close();
  });
