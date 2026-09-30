import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { brickCityModel } from "../helpers/brick-city";

// Anatomy on the largest model a phone accepts (docs/ANATOMY.md#cost): a
// ~147,000-part plain-brick city of 97 block submodels on the mobile profile.
// Slow (the load alone takes minutes on SwiftShader), so opt-in:
//   ANATOMY_PERF=1 npx playwright test anatomy-performance
test.skip(!process.env.ANATOMY_PERF, "set ANATOMY_PERF=1 to measure");

const city = brickCityModel({ parts: 147440 });

test("anatomy plans and moves a 147,000-part city on the phone profile without rebuilding", async ({
  browser,
}) => {
  test.setTimeout(900000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async (text) => {
    const a = window.brickEditor!;
    await a.ready();
    const loadStart = performance.now();
    const imported = await a.project.import({
      format: "ldraw",
      text,
      name: "brick-city.mpd",
      strict: true,
    });
    await a.ready({ minRevision: imported.revision, strict: true });
    const loadMs = performance.now() - loadStart;
    const scene = (window as any).__brickScene;
    const frame = async () => {
      const before = (await a.render.budget()).lastFrame.frames;
      for (let i = 0; i < 600; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        if ((await a.render.budget()).lastFrame.frames > before) break;
      }
      return a.render.budget();
    };
    const fill = () => {
      scene.batches.refresh();
      const t = performance.now();
      scene.batches.prepare();
      return performance.now() - t;
    };
    const plain = await frame();
    const plainFillMs = fill();
    // Plan and jump fully apart (no animation).
    let t = performance.now();
    const on = scene.setAnatomy({ on: true, animate: false });
    const jumpMs = performance.now() - t;
    const apart = await frame();
    const apartFillMs = fill();
    // One animation step (JS matrix writes only), and its refill.
    const view = scene.anatomyView;
    view.progress = 0.5;
    t = performance.now();
    view.apply(true);
    const stepMs = performance.now() - t;
    const stepFillMs = fill();
    view.progress = 1;
    view.apply(false);
    // Animated back together: frames drawn and wall time.
    const framesBefore = (await a.render.budget()).lastFrame.frames;
    t = performance.now();
    await a.render.anatomy.set({ on: false });
    const assembleMs = performance.now() - t;
    const assembleFrames =
      (await a.render.budget()).lastFrame.frames - framesBefore;
    const back = await frame();
    return {
      parts: plain.usage!.partOccurrences,
      profile: (await a.resources.status()).active,
      loadMs,
      revision: imported.revision,
      revisionAfter: (await a.query()).revision,
      planMs: on.planMs,
      movers: on.movers,
      groups: on.groups.length,
      jumpMs,
      stepMs,
      plainFillMs,
      apartFillMs,
      stepFillMs,
      assembleMs,
      assembleFrames,
      plain: {
        triangles: plain.lastFrame.triangles,
        cpuMs: plain.lastFrame.cpuMs,
        draws: plain.lastFrame.calls,
        structures: plain.batches.structures,
        plainView: plain.batches.plainView,
      },
      apart: {
        triangles: apart.lastFrame.triangles,
        cpuMs: apart.lastFrame.cpuMs,
        draws: apart.lastFrame.calls,
        structures: apart.batches.structures,
        plainView: apart.batches.plainView,
      },
      back: {
        triangles: back.lastFrame.triangles,
        structures: back.batches.structures,
        plainView: back.batches.plainView,
        culled: back.batches.culled,
      },
    };
  }, city.text);
  mkdirSync("test-results", { recursive: true });
  writeFileSync(
    "test-results/anatomy-performance.json",
    JSON.stringify(result, null, 2),
  );
  expect(result.profile).toBe("mobile");
  expect(result.movers).toBeGreaterThanOrEqual(2);
  // Render-only: no revision, no rebuilt batch structure.
  expect(result.revisionAfter).toBe(result.revision);
  expect(result.apart.structures).toBe(result.plain.structures);
  expect(result.back.structures).toBe(result.plain.structures);
  // Back together, every translation is exactly home: culling returns.
  expect(result.back.plainView).toBe(true);
  expect(result.back.culled).toBeGreaterThan(0);
  await context.close();
});
