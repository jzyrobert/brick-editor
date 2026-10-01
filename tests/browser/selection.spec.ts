import { test, expect, type Page } from "@playwright/test";
import { openTool } from "./helpers/mode";
import { architecturalStressModel } from "../helpers/architectural-stress";

// Red plate above blue plate (seen from above, red hides blue); green aside.
const source = `0 FILE main.ldr
0 BFC NOCERTIFY
4 4 -80 -40 -80 80 -40 -80 80 -40 80 -80 -40 80
4 1 -80 0 -80 80 0 -80 80 0 80 -80 0 80
4 2 150 0 -30 210 0 -30 210 0 30 150 0 30
0 NOFILE`;
const topView = {
  space: "ldraw" as const,
  projection: "orthographic" as const,
  position: [0, -600, 0] as [number, number, number],
  target: [0, 0, 0] as [number, number, number],
  up: [0, 0, -1] as [number, number, number],
  span: 500,
  fovDeg: 45,
  near: 0.5,
  far: 5000,
};
const shots = "test-results/selection/";

async function open(page: Page, text: string) {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(
    async ({ text, view }) => {
      const a = window.brickEditor!;
      const imported = await a.project.import({ format: "ldraw", text });
      await a.ready({ minRevision: imported.revision, strict: true });
      await a.camera.set(view);
    },
    { text, view: topView },
  );
}
const selectedIds = (page: Page) =>
  page.evaluate(async () =>
    (await window.brickEditor!.query({ selection: true })).occurrences.map(
      (o: { id: string }) => o.id,
    ),
  );
const colours = (page: Page) =>
  page.evaluate(async () =>
    (await window.brickEditor!.query({ selection: true })).occurrences
      .map((o: { colorCode: string }) => o.colorCode)
      .sort(),
  );
/** Page coordinates of an LDraw point in the current view. */
const screenOf = (page: Page, point: [number, number, number]) =>
  page.evaluate((p) => {
    const s = window.__brickScene as {
      camera: {
        position: {
          constructor: new (
            x: number,
            y: number,
            z: number,
          ) => {
            project(c: unknown): { x: number; y: number };
          };
        };
      };
      renderer: { domElement: HTMLCanvasElement };
    };
    const v = new s.camera.position.constructor(p[0], -p[1], -p[2]).project(
      s.camera,
    );
    const r = s.renderer.domElement.getBoundingClientRect();
    return [
      r.left + ((v.x + 1) / 2) * r.width,
      r.top + ((1 - v.y) / 2) * r.height,
    ] as [number, number];
  }, point);
async function centre(page: Page) {
  const rect = (await page.locator(".viewport canvas").boundingBox())!;
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}
async function drag(
  page: Page,
  from: [number, number],
  to: [number, number],
  hold?: () => Promise<void>,
) {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(to[0], to[1], { steps: 8 });
  await hold?.();
  await page.mouse.up();
}

test("Navigate is the tool on load and after opening a build", async ({
  browser,
  baseURL,
}) => {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 411, height: 686 },
  ]) {
    const context = await browser.newContext({
      viewport,
      hasTouch: viewport.width < 600,
    });
    try {
      const page = await context.newPage();
      await page.goto(`${baseURL}/?automation=1`);
      await page.waitForFunction(() => !!window.brickEditor);
      const navigate = page.getByRole("button", {
        name: "Navigate",
        exact: true,
      });
      await expect(navigate).toHaveClass(/active/);
      // Select stays one tap away; opening another build resets to Navigate.
      await page.getByRole("button", { name: "Select", exact: true }).click();
      await expect(navigate).not.toHaveClass(/active/);
      await page.evaluate(async () => {
        const a = window.brickEditor!;
        const imported = await a.project.import({
          format: "template",
          template: "house",
        });
        await a.ready({ minRevision: imported.revision });
      });
      await expect(navigate).toHaveClass(/active/);
    } finally {
      await context.close();
    }
  }
});

test("desktop drags draw boxes and lassos with live counts, modifiers and Escape", async ({
  page,
}) => {
  await open(page, source);
  const before = await page.evaluate(() => window.brickEditor!.query());
  const { x: cx, y: cy } = await centre(page);
  // In Navigate a left drag orbits and selects nothing.
  await drag(page, [cx - 15, cy - 15], [cx + 15, cy + 15]);
  expect(await selectedIds(page)).toEqual([]);
  await page.evaluate((view) => window.brickEditor!.camera.set(view), topView);

  await page.getByRole("button", { name: "Select", exact: true }).click();
  // Visible (default, touching): only the red plate on top; the preview
  // outlines it and counts it before release.
  await drag(page, [cx - 15, cy - 15], [cx + 15, cy + 15], async () => {
    await expect(page.locator(".selection-region-count")).toHaveText("1 part");
    await page.screenshot({ path: shots + "desktop-visible-preview.png" });
  });
  await expect(page.locator(".selection-region-count")).toBeHidden();
  expect(await colours(page)).toEqual(["4"]);
  // A still click still selects one part (replacing). Green plate centre:
  // LDraw x 180, at span 500 over the canvas height.
  const [gx] = await screenOf(page, [180, 0, 0]);
  await page.mouse.click(gx, cy);
  expect(await colours(page)).toEqual(["2"]);
  // Through (centre inside): both stacked plates, whose centres are inside.
  await page
    .locator(".right-tabs")
    .getByRole("button", { name: "Inspector", exact: true })
    .click();
  await openTool(page, "Selection tools");
  await page
    .getByRole("group", { name: "Selection depth" })
    .getByRole("button", { name: "Through" })
    .click();
  await expect(page.getByLabel("Region rule")).toHaveValue("centre");
  await drag(page, [cx - 15, cy - 15], [cx + 15, cy + 15]);
  expect(await colours(page)).toEqual(["1", "4"]);
  // Alt removes what the region holds (a live "−" count while dragging).
  await page.keyboard.down("Alt");
  await drag(page, [cx - 15, cy - 15], [cx + 15, cy + 15], async () => {
    await expect(page.locator(".selection-region-count")).toHaveText(
      "− 2 parts",
    );
  });
  await page.keyboard.up("Alt");
  expect(await selectedIds(page)).toEqual([]);
  // Back to Visible; Shift adds the green plate, drawn as a lasso (L).
  await page
    .getByRole("group", { name: "Selection depth" })
    .getByRole("button", { name: "Visible" })
    .click();
  await expect(page.getByLabel("Region rule")).toHaveValue("touching");
  await drag(page, [cx - 15, cy - 15], [cx + 15, cy + 15]);
  expect(await colours(page)).toEqual(["4"]);
  await page.locator(".viewport canvas").hover();
  await page.keyboard.press("l");
  await expect(page.locator(".canvas-bottom")).toContainText("Lasso");
  await page.keyboard.down("Shift");
  await page.mouse.move(gx - 20, cy - 20);
  await page.mouse.down();
  await page.mouse.move(gx + 20, cy - 20, { steps: 4 });
  await page.mouse.move(gx + 20, cy + 20, { steps: 4 });
  await page.mouse.move(gx - 20, cy + 20, { steps: 4 });
  await expect(page.locator(".selection-region-count")).toHaveText("+ 1 part");
  await page.mouse.up();
  await page.keyboard.up("Shift");
  expect(await colours(page)).toEqual(["2", "4"]);
  // Escape cancels a region mid-drag and keeps the selection.
  await page.mouse.move(cx - 15, cy - 15);
  await page.mouse.down();
  await page.mouse.move(cx + 15, cy + 15, { steps: 4 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await colours(page)).toEqual(["2", "4"]);
  // Selecting never edits the document.
  expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
    before,
  );
});

test("visible selection maps regions correctly on high-density screens", async ({
  browser,
  baseURL,
}) => {
  // The ID image is drawn at CSS-pixel size whatever the canvas density.
  const context = await browser.newContext({
    viewport: { width: 800, height: 600 },
    deviceScaleFactor: 2,
  });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/?automation=1`);
    await page.waitForFunction(() => !!window.brickEditor);
    await page.evaluate(
      async ({ text, view }) => {
        const a = window.brickEditor!;
        const imported = await a.project.import({ format: "ldraw", text });
        await a.ready({ minRevision: imported.revision, strict: true });
        await a.camera.set(view);
      },
      { text: source, view: topView },
    );
    await page.getByRole("button", { name: "Select", exact: true }).click();
    const [rx, ry] = await screenOf(page, [0, -40, 0]);
    await drag(page, [rx - 10, ry - 10], [rx + 10, ry + 10]);
    expect(await colours(page)).toEqual(["4"]);
    const [gx, gy] = await screenOf(page, [180, 0, 0]);
    await drag(page, [gx - 10, gy - 10], [gx + 10, gy + 10]);
    expect(await colours(page)).toEqual(["2"]);
  } finally {
    await context.close();
  }
});

test("hidden and cut-away parts never occlude or get selected", async ({
  page,
}) => {
  await open(page, source);
  const { x: cx, y: cy } = await centre(page);
  await page.getByRole("button", { name: "Select", exact: true }).click();
  // Hide the red plate's layer: a Visible box now finds the blue plate.
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    let q = await a.query();
    const red = q.occurrences.find((o) => o.colorCode === "4")!;
    const added = await a.dispatch({
      schemaVersion: 1,
      commandId: "add-top",
      expectedRevision: q.revision,
      type: "layers.add",
      payload: { name: "Top" },
    });
    const top = { id: added.addedLayerIds[0] };
    q = await a.query();
    await a.dispatch({
      schemaVersion: 1,
      commandId: "assign-top",
      expectedRevision: q.revision,
      type: "layers.assign",
      payload: { occurrenceIds: [red.id], layerId: top.id },
    });
    q = await a.query();
    await a.dispatch({
      schemaVersion: 1,
      commandId: "hide-top",
      expectedRevision: q.revision,
      type: "layers.update",
      payload: { layerId: top.id, visible: false },
    });
    await a.ready({ minRevision: q.revision + 1 });
  });
  await drag(page, [cx - 15, cy - 15], [cx + 15, cy + 15]);
  expect(await colours(page)).toEqual(["1"]);
  // A section cut past the green plate (kept side x ≤ 100): Through with
  // "touching" over the whole view leaves it out.
  await page.evaluate(async () => {
    await window.brickEditor!.render.section.set({ axis: "x", at: 100 });
  });
  const rect = (await page.locator(".viewport canvas").boundingBox())!;
  const ids = await page.evaluate(
    ([w, h]) =>
      (
        window.__brickScene as {
          selectRegion(p: number[][], m: string, r: string): string[];
        }
      ).selectRegion(
        [
          [1, 1],
          [w - 1, 1],
          [w - 1, h - 1],
          [1, h - 1],
        ],
        "through",
        "touching",
      ),
    [rect.width, rect.height],
  );
  const q = await page.evaluate(() => window.brickEditor!.query());
  const colourOf = (id: string) =>
    q.occurrences.find((o: { id: string }) => o.id === id)!.colorCode;
  // The hidden red plate and the cut-away green plate are both left out.
  expect(ids.map(colourOf).sort()).toEqual(["1"]);
});

test("Visible picks only the house's front wall; Through reaches the back wall", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    const imported = await a.project.import({
      format: "template",
      template: "house",
    });
    await a.ready({ minRevision: imported.revision, strict: true });
    // Straight at the front (−Z) wall; walls run z −40 (front) to 140 (back).
    await a.camera.set({
      space: "ldraw",
      projection: "orthographic",
      position: [-50, -110, -1500],
      target: [-50, -110, 50],
      up: [0, -1, 0],
      span: 520,
      fovDeg: 45,
      near: 1,
      far: 5000,
    });
  });
  await page.getByRole("button", { name: "Select", exact: true }).click();
  // A box on the ground-floor wall, left of the door, away from roof and garden.
  const box = {
    from: await screenOf(page, [-160, -110, -40]),
    to: await screenOf(page, [-60, -40, -40]),
  };
  const selectedZ = () =>
    page.evaluate(async () =>
      (await window.brickEditor!.query({ selection: true })).occurrences.map(
        (o: { transform: { position: number[] } }) => o.transform.position[2],
      ),
    );
  // The preview (outlines and count) before release, for the docs.
  const preview = (name: string) => async () => {
    await expect(page.locator(".selection-region-count")).toBeVisible();
    await page.screenshot({ path: shots + name });
  };
  await drag(
    page,
    box.from as [number, number],
    box.to as [number, number],
    preview("house-visible.png"),
  );
  const visible = await selectedZ();
  expect(visible.length).toBeGreaterThan(3);
  // Only the front wall (and what sits in it): nothing from behind.
  expect(Math.max(...visible)).toBeLessThan(0);
  await page
    .locator(".right-tabs")
    .getByRole("button", { name: "Inspector", exact: true })
    .click();
  await openTool(page, "Selection tools");
  await page
    .getByRole("group", { name: "Selection depth" })
    .getByRole("button", { name: "Through" })
    .click();
  await drag(
    page,
    box.from as [number, number],
    box.to as [number, number],
    preview("house-through.png"),
  );
  const through = await selectedZ();
  expect(Math.min(...through)).toBeLessThan(0);
  expect(Math.max(...through)).toBeGreaterThan(100);
});

for (const viewport of [
  { width: 411, height: 686 },
  { width: 360, height: 800 },
])
  test(`touch box mode: one finger draws, two fingers navigate, Done exits (${viewport.width}×${viewport.height})`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ viewport, hasTouch: true });
    try {
      const page = await context.newPage();
      await page.goto(`${baseURL}/?automation=1`);
      await page.waitForFunction(() => !!window.brickEditor);
      await page.evaluate(
        async ({ text, view }) => {
          const a = window.brickEditor!;
          const imported = await a.project.import({ format: "ldraw", text });
          await a.ready({ minRevision: imported.revision, strict: true });
          await a.camera.set(view);
        },
        // Wider, and shifted so the green plate is on a narrow screen too.
        {
          text: source,
          view: {
            ...topView,
            target: [60, 0, 0] as [number, number, number],
            position: [60, -600, 0] as [number, number, number],
            span: 800,
          },
        },
      );
      const mobile = page.getByRole("navigation", { name: "Mobile panels" });
      await mobile
        .getByRole("button", { name: "Inspector", exact: true })
        .click();
      await openTool(page, "Selection tools");
      await page
        .getByRole("button", { name: "Box or lasso select", exact: true })
        .click();
      // The sheet steps aside; the chip holds the mode's switches.
      const chip = page.getByRole("group", { name: "Box select" });
      await expect(chip).toBeVisible();
      await expect(page.locator(".mobile-panel.mobile-open")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Select", exact: true }),
      ).toHaveClass(/active/);
      await page.screenshot({
        path: shots + `touch-chip-${viewport.width}.png`,
      });
      const [cx, cy] = await screenOf(page, [0, -40, 0]);
      const cdp = await context.newCDPSession(page);
      const touch = (
        type: "touchStart" | "touchMove" | "touchEnd",
        points: { x: number; y: number; id: number }[],
      ) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
      const region = async (x: number, y: number) => {
        await touch("touchStart", [{ x: x - 15, y: y - 15, id: 1 }]);
        await touch("touchMove", [{ x: x, y: y, id: 1 }]);
        await touch("touchMove", [{ x: x + 15, y: y + 15, id: 1 }]);
        await touch("touchEnd", []);
      };
      await region(cx, cy);
      await expect.poll(() => colours(page)).toEqual(["4"]);
      // Add on the chip, then a region over the green plate.
      await chip
        .getByRole("group", { name: "Region action" })
        .getByRole("button", { name: "Add" })
        .click();
      const [gx] = await screenOf(page, [180, 0, 0]);
      await region(gx, cy);
      await expect.poll(() => colours(page)).toEqual(["2", "4"]);
      // Remove, over the red plate.
      await chip
        .getByRole("group", { name: "Region action" })
        .getByRole("button", { name: "Remove" })
        .click();
      await region(cx, cy);
      await expect.poll(() => colours(page)).toEqual(["2"]);
      // A second finger cancels the region and moves the view instead.
      const before = await page.evaluate(() => window.brickEditor!.query());
      const camera = () =>
        page.evaluate(() =>
          (
            window.__brickScene as {
              camera: { position: { toArray(): number[] } };
            }
          ).camera.position.toArray(),
        );
      const cameraBefore = await camera();
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
      expect(await colours(page)).toEqual(["2"]);
      expect(await camera()).not.toEqual(cameraBefore);
      expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
        before,
      );
      // Done leaves the mode; a one-finger drag no longer draws.
      await chip.getByRole("button", { name: "Done" }).click();
      await expect(chip).toHaveCount(0);
      await cdp.detach();
    } finally {
      await context.close();
    }
  });

test("box selection stays fast on a 20,000-part model @perf", async ({
  page,
}) => {
  // Software WebGL spends minutes on the first full draw of ~10 M triangles
  // (an ordinary frame of this view included); the ID pass is timed and
  // logged, and its work is bounded structurally (one draw per batch).
  test.setTimeout(900000);
  const model = architecturalStressModel({ parts: 20000, variants: 300 });
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async (text) => {
    const a = window.brickEditor!;
    const imported = await a.project.import({
      format: "ldraw",
      text,
      name: "stress-village.mpd",
      strict: true,
    });
    await a.ready({ minRevision: imported.revision, strict: true });
    await a.camera.set({
      space: "ldraw",
      projection: "perspective",
      position: [1500, -900, -1500],
      target: [950, -250, 950],
      up: [0, -1, 0],
      fovDeg: 45,
      near: 1,
      far: 50000,
    });
    // Measure against a drawn model, as a user sees it before dragging.
    const before = (await a.render.budget()).lastFrame.frames;
    for (let i = 0; i < 600; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      if ((await a.render.budget()).lastFrame.frames > before + 1) break;
    }
  }, model.text);
  const timing = await page.evaluate(() => {
    type Snapshot = { coverage?: { draws?: number; totals: Uint32Array } };
    const s = window.__brickScene as {
      regionSnapshot(mode: string): Snapshot;
      selectRegion(p: number[][], m: string, r?: string): string[];
      selectFromSnapshot(s: Snapshot, p: number[][], r: string): string[];
      renderer: { domElement: HTMLCanvasElement };
    };
    const rect = s.renderer.domElement.getBoundingClientRect();
    const w = rect.width,
      h = rect.height;
    const box = (f: number) => [
      [w * (0.5 - f), h * (0.5 - f)],
      [w * (0.5 + f), h * (0.5 - f)],
      [w * (0.5 + f), h * (0.5 + f)],
      [w * (0.5 - f), h * (0.5 + f)],
    ];
    const time = <T>(fn: () => T) => {
      const t = performance.now();
      const value = fn();
      return { value, ms: performance.now() - t };
    };
    const visible = time(() => s.regionSnapshot("visible"));
    const through = time(() => s.regionSnapshot("through"));
    // What each pointer move costs once the gesture's snapshot exists.
    const moveVisible = time(() =>
      s.selectFromSnapshot(visible.value, box(0.3), "touching"),
    );
    const moveThrough = time(() =>
      s.selectFromSnapshot(through.value, box(0.3), "touching"),
    );
    const small = time(() => s.selectRegion(box(0.05), "through", "touching"));
    const large = time(() => s.selectRegion(box(0.3), "through", "centre"));
    return {
      moveVisibleMs: moveVisible.ms,
      moveVisible: moveVisible.value.length,
      moveThroughMs: moveThrough.ms,
      visibleMs: visible.ms,
      draws: visible.value.coverage!.draws!,
      seen: visible.value.coverage!.totals.filter((n) => n > 0).length,
      throughMs: through.ms,
      smallThrough: small.value.length,
      smallThroughMs: small.ms,
      largeThrough: large.value.length,
      largeThroughMs: large.ms,
    };
  });
  console.log("region selection on 20,000 parts:", JSON.stringify(timing));
  // One ID draw per render batch, not ~20,000 per-part proxies.
  expect(timing.draws).toBeLessThan(1000);
  expect(timing.seen).toBeGreaterThan(1000);
  // Through used to exceed its five-million-triangle budget here.
  expect(timing.smallThrough).toBeGreaterThan(0);
  expect(timing.largeThrough).toBeGreaterThan(timing.smallThrough);
  // Through needs no GPU work: well under a second, even on a busy VM.
  expect(timing.throughMs).toBeLessThan(5000);
  expect(timing.largeThroughMs).toBeLessThan(5000);
  // Live preview: re-evaluating a snapshot is cheap enough for every frame.
  expect(timing.moveVisible).toBeGreaterThan(0);
  expect(timing.moveVisibleMs).toBeLessThan(250);
  expect(timing.moveThroughMs).toBeLessThan(250);
});
