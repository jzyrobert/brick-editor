import { expect, test, type Page } from "@playwright/test";
import { architecturalStressModel } from "../helpers/architectural-stress";

// A generated real-parts village above the old reference-renderer caps
// (5,000 part occurrences, 128 part/colour variants): every part must be drawn.
const model = architecturalStressModel({ parts: 6000, variants: 200 });

async function load(page: Page) {
  await page.goto("/?automation=1");
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
  const result = await load(page);
  expect(result.profile).toBe("desktop");
  expectComplete(result);
  expect(result.budget.usage!.variants).toBeGreaterThan(128);
  expect(result.budget.usage!.partOccurrences).toBeGreaterThan(5000);
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
  });
});
