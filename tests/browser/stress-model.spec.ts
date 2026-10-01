import { expect, test, type Page } from "@playwright/test";
import { architecturalStressModel } from "../helpers/architectural-stress";

// A generated real-parts village above the old reference-renderer caps
// (5,000 part occurrences, 128 part/colour variants): every part must be drawn.
const model = architecturalStressModel({ parts: 6000, variants: 200 });

async function load(page: Page, query = "") {
  await page.goto("/?automation=1" + query);
  await page.waitForFunction(() => !!window.brickEditor);
  return page.evaluate(async (text) => {
    const a = window.brickEditor!;
    await a.ready();
    const imported = await a.project.import({
      format: "ldraw",
      text,
      name: "stress-village.mpd",
      strict: true,
    });
    await a.ready({ minRevision: imported.revision, strict: true });
    // Batches are built on the next drawn frame.
    const before = (await a.render.budget()).lastFrame.frames;
    for (let i = 0; i < 300; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      if ((await a.render.budget()).lastFrame.frames > before) break;
    }
    const q = await a.query();
    const health = await a.health.check();
    return {
      occurrences: q.occurrences.length,
      namespaces: [...new Set(q.occurrences.map((o) => o.namespace))],
      unresolved: q.unresolvedReferences.length,
      missing: health.checks.find((c) => c.id === "missing-definitions")!
        .status,
      budget: await a.render.budget(),
      profile: (await a.resources.status()).active,
    };
  }, model.text);
}

function expectComplete(result: Awaited<ReturnType<typeof load>>) {
  expect(result.occurrences).toBe(6000);
  expect(result.namespaces).toEqual(["official"]);
  expect(result.unresolved).toBe(0);
  expect(result.missing).toBe("ok");
  expect(result.budget.usage).toMatchObject({
    partOccurrences: 6000,
    rawOccurrences: 0,
    variants: 200,
  });
  // Strictly no missing parts: every occurrence is drawn by some batch.
  expect(result.budget.batches.occurrencesDrawn).toBe(6000);
  // Repeated lines are instanced, not baked per occurrence.
  expect(result.budget.batches.instancedLines).toBeGreaterThan(100);
  expect(result.budget.batches.merged).toBe(0);
  expect(result.budget.lastFrame.triangles).toBeGreaterThan(0);
}

test("a 6,000-part, 200-variant official-parts model renders completely and is walkable", async ({
  page,
}) => {
  test.setTimeout(240000);
  // Without hidden-geometry culling: the adaptive-cell checks below compare
  // a whole-model view (from above, where culling also leaves out every
  // underside) with an eye-level view (which sees undersides); culling has
  // its own spec (hidden-geometry.spec.ts).
  const result = await load(page, "&hiddenCull=0");
  expect(result.profile).toBe("desktop");
  expectComplete(result);
  expect(result.budget.usage!.variants).toBeGreaterThan(128);
  expect(result.budget.usage!.partOccurrences).toBeGreaterThan(5000);
  // View changes refill the existing instance arrays instead of rebuilding
  // the batches; a section cut leaves out parts wholly above it.
  const views = await page.evaluate(async () => {
    const a = window.brickEditor!;
    const frame = async () => {
      const before = (await a.render.budget()).lastFrame.frames;
      for (let i = 0; i < 300; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        if ((await a.render.budget()).lastFrame.frames > before) break;
      }
      return (await a.render.budget()).batches;
    };
    const start = await frame();
    await a.render.explode.set({ gap: 200 });
    const exploded = await frame();
    await a.render.explode.set({ gap: 0 });
    await a.render.section.set({ height: -40 });
    const cut = await frame();
    await a.render.section.set(null);
    const whole = await frame();
    return { start, exploded, cut, whole };
  });
  expect(views.exploded.structures).toBe(views.start.structures);
  expect(views.whole.structures).toBe(views.start.structures);
  expect(views.exploded.fills).toBeGreaterThan(views.start.fills);
  expect(views.exploded.occurrencesDrawn).toBe(6000);
  expect(views.cut.occurrencesDrawn).toBeGreaterThan(0);
  expect(views.cut.occurrencesDrawn).toBeLessThan(6000);
  expect(views.whole.occurrencesDrawn).toBe(6000);
  // Occurrence handles are records: no Object3D tree per part in the scene,
  // only the batches under the model root.
  const scene = await page.evaluate(() => {
    const s = window.__brickScene as unknown as {
      handles: { values(): Iterable<{ object: unknown }>; size: number };
      root: { children: { name: string; children: unknown[] }[] };
    };
    // The step viewer's assembly group (just its empty tray when no steps
    // are shown) lives under the root too.
    const assembly = s.root.children.find(
      (c) => c.name === "instruction assembly",
    );
    return {
      handles: s.handles.size,
      trees: [...s.handles.values()].filter((h) => h.object).length,
      rootChildren: s.root.children.length - (assembly ? 1 : 0),
    };
  });
  expect(scene).toEqual({
    handles: 6000,
    trees: 0,
    rootChildren: 1,
  });
  // Adaptive culling cells: a whole-model view draws one draw per bucket; a
  // camera at eye level inside the village draws the large buckets per
  // spatial cell, so the cells behind and beside it are culled; fitting the
  // whole model again switches back without rebuilding the batches.
  const culling = await page.evaluate(async () => {
    const a = window.brickEditor!;
    const frame = async () => {
      const before = (await a.render.budget()).lastFrame.frames;
      for (let i = 0; i < 300; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        if ((await a.render.budget()).lastFrame.frames > before) break;
      }
      const budget = await a.render.budget();
      return { batches: budget.batches, frame: budget.lastFrame };
    };
    await a.camera.fit();
    const whole = await frame();
    // Stand in the middle of the village at eye level, looking along X.
    const range = (axis: "x" | "y" | "z") =>
      (
        window.__brickScene as unknown as {
          modelRange(axis: string): { min: number; max: number };
        }
      ).modelRange(axis);
    const x = range("x"),
      y = range("y"),
      z = range("z");
    const cx = (x.min + x.max) / 2,
      cz = (z.min + z.max) / 2,
      eye = y.max - 40;
    await a.camera.set({
      space: "ldraw",
      projection: "perspective",
      position: [cx, eye, cz],
      target: [x.max, eye, cz],
      up: [0, -1, 0],
      fovDeg: 60,
      near: 1,
      far: 20000,
    });
    const inside = await frame();
    await a.camera.fit();
    const again = await frame();
    return { whole, inside, again };
  });
  expect(culling.whole.batches.cellsInUse).toBe(false);
  expect(culling.whole.batches.cells).toBeGreaterThan(0);
  expect(culling.inside.batches.cellsInUse).toBe(true);
  expect(culling.inside.batches.structures).toBe(
    culling.whole.batches.structures,
  );
  // Every occurrence is still filled; the view culls whole cells.
  expect(culling.inside.batches.occurrencesDrawn).toBe(6000);
  expect(culling.inside.frame.triangles).toBeLessThan(
    culling.whole.frame.triangles * 0.95,
  );
  expect(culling.again.batches.cellsInUse).toBe(false);
  expect(culling.again.batches.structures).toBe(
    culling.whole.batches.structures,
  );
  const play = await page.evaluate(async () => {
    const a = window.brickEditor!;
    const snapshot = await a.play.enter({
      position: [600, -0.3, -300],
      realtime: false,
    });
    const collision = await a.play.collisionStats();
    await a.play.setInput({ moveZ: 1 });
    await a.play.stepTicks(30);
    const moved = await a.play.snapshot();
    await a.play.exit();
    return { snapshot, collision, moved };
  });
  // The full surface exceeds the collision budget; simplified official parts
  // keep the world walkable instead of falling back to Fly.
  expect(play.snapshot.locomotion).toBe("walk");
  expect(play.snapshot.warnings.join(" ")).toContain("simplified shapes");
  expect(play.collision.static!.triangles).toBeLessThan(1_000_000);
  expect(play.collision.static!.triangles).toBeGreaterThan(50_000);
  expect(play.moved.position).not.toEqual(play.snapshot.position);
});

test.describe("phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  test("the same model renders completely on the phone profile", async ({
    page,
  }) => {
    test.setTimeout(240000);
    const result = await load(page);
    expect(result.profile).toBe("mobile");
    expect(result.budget.budget.variants).toBe(768);
    expectComplete(result);
    // Orbiting a large scene on a phone draws without edge lines at a lower
    // pixel density, and the view redraws in full once it comes to rest.
    expect(result.budget.motion.reducible).toBe(true);
    const canvas = page.getByLabel("3D build viewport");
    const box = (await canvas.boundingBox())!;
    const x = box.x + box.width / 2,
      y = box.y + box.height * 0.45;
    const lastFrame = () =>
      page.evaluate(async () => {
        const a = window.brickEditor!;
        const budget = await a.render.budget();
        return {
          ...budget.lastFrame,
          ...budget.motion,
          ratio: (
            window.__brickScene as { renderer: { getPixelRatio(): number } }
          ).renderer.getPixelRatio(),
        };
      });
    const rest = await lastFrame();
    expect(rest.lines).toBeGreaterThan(0);
    await page.mouse.move(x, y);
    await page.mouse.down({ button: "right" });
    for (let i = 1; i <= 4; i++) await page.mouse.move(x + i * 12, y);
    await expect
      .poll(async () => (await lastFrame()).reducedFrame, { timeout: 30000 })
      .toBe(true);
    const moving = await lastFrame();
    // Only the editor grid's lines remain.
    expect(moving.lines).toBeLessThan(rest.lines / 1000);
    expect(moving.ratio).toBeLessThanOrEqual(1.25);
    await page.mouse.up({ button: "right" });
    await expect
      .poll(async () => (await lastFrame()).reducedFrame, { timeout: 30000 })
      .toBe(false);
    const settled = await lastFrame();
    expect(settled.lines).toBeGreaterThan(0);
    expect(settled.ratio).toBe(rest.ratio);
  });
});
