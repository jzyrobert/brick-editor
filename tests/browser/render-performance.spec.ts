import { expect, test } from "@playwright/test";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";

for (const mobile of [false, true]) {
  test(`Photo inspects the final scene after a drag, including small models (${mobile ? "phone" : "desktop"})`, async ({
    page,
  }) => {
    await page.setViewportSize(
      mobile ? { width: 390, height: 844 } : { width: 720, height: 520 },
    );
    await page.goto(`/?automation=1&profile=${mobile ? "mobile" : "desktop"}`);
    await page.waitForFunction(() => !!window.brickEditor);
    if (mobile)
      await page.evaluate(() =>
        window.brickEditor!.resources.setProfile({ profile: "mobile" }),
      );
    await page.evaluate(async () => {
      const a = window.brickEditor!;
      const imported = await a.project.import({
        format: "ldraw",
        text: "0 Drag test\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
        name: "drag.ldr",
      });
      await a.ready({ minRevision: imported.revision, strict: true });
    });
    const during = await page.evaluate(async () => {
      const a = window.brickEditor!;
      const scene = window.__brickScene as unknown as {
        controls: OrbitControls;
        photoTrace: (...args: unknown[]) => unknown;
        startPhoto: (...args: unknown[]) => Promise<void>;
      };
      const observed = { inspections: 0, starts: 0 };
      (window as unknown as { __photoAudit: typeof observed }).__photoAudit =
        observed;
      const inspect = scene.photoTrace.bind(scene);
      scene.photoTrace = (...args) => {
        observed.inspections++;
        return inspect(...args);
      };
      // Test the real raster and idle scheduler without compiling the path shader.
      // Path samples/captures are covered by look.spec.ts's heavy tests.
      scene.startPhoto = async () => {
        observed.starts++;
      };
      scene.controls.dispatchEvent({ type: "start" });
      scene.controls.dispatchEvent({ type: "change" });
      await a.render.look.set("photo", { pathSamples: 2 });
      const before = (await a.render.budget()).lastFrame.frames;
      for (let i = 0; i < 3; i++) {
        const previous = (await a.render.budget()).lastFrame.frames;
        await a.camera.set({
          space: "ldraw",
          projection: "perspective",
          position: [200 + 10 * i, -200, 300],
          target: [0, -12, 0],
          up: [0, -1, 0],
          fovDeg: 45,
          near: 0.5,
          far: 10000,
        });
        for (
          let n = 0;
          n < 120 && (await a.render.budget()).lastFrame.frames <= previous;
          n++
        )
          await new Promise(requestAnimationFrame);
      }
      return {
        ...observed,
        frames: (await a.render.budget()).lastFrame.frames - before,
        motion: (await a.render.budget()).motion,
      };
    });
    expect(during.frames).toBeGreaterThanOrEqual(3);
    expect(during.inspections).toBe(0);
    expect(during.starts).toBe(0);
    expect(during.motion.reducible).toBe(false);
    await page.evaluate(() =>
      (
        window.__brickScene as unknown as { controls: OrbitControls }
      ).controls.dispatchEvent({ type: "end" }),
    );
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __photoAudit: { starts: number } })
              .__photoAudit.starts,
        ),
      )
      .toBeGreaterThan(0);
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { __photoAudit: { inspections: number } })
            .__photoAudit.inspections,
      ),
    ).toBeGreaterThan(0);
    await page.evaluate(() => window.brickEditor!.render.look.set("standard"));
  });
}

test("camera replacements and viewport resizing reuse shadows; edits refresh them", async ({
  page,
}) => {
  await page.setViewportSize({ width: 720, height: 520 });
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.project.import({
      format: "ldraw",
      text: "0 Shadow test\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
      name: "shadow.ldr",
    });
    await a.ready({ strict: true });
    await a.render.look.set("realistic");
    await a.camera.fit();
  });
  const stats = () =>
    page.evaluate(
      async () => (await window.brickEditor!.render.budget()).lastFrame,
    );
  await expect
    .poll(async () => (await stats()).shadowPasses)
    .toBeGreaterThan(0);
  const before = await stats();
  for (const projection of ["perspective", "orthographic"] as const) {
    const previous = await stats();
    await page.evaluate(
      (projection) =>
        window.brickEditor!.camera.set({
          space: "ldraw",
          projection,
          position: [200, -200, 300],
          target: [0, -12, 0],
          up: [0, -1, 0],
          fovDeg: 45,
          span: 300,
          near: 0.5,
          far: 10000,
        }),
      projection,
    );
    await expect
      .poll(async () => (await stats()).frames)
      .toBeGreaterThan(previous.frames);
    expect((await stats()).shadowPasses).toBe(before.shadowPasses);
  }
  for (const [width, height] of [
    [1080, 1800],
    [360, 600],
    [411, 685],
    [390, 844],
    [686, 411],
    [1440, 1000],
  ]) {
    const previous = await stats();
    await page.setViewportSize({ width, height });
    await expect
      .poll(async () => (await stats()).frames)
      .toBeGreaterThan(previous.frames);
    expect((await stats()).shadowPasses).toBe(before.shadowPasses);
  }
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.project.import({
      format: "ldraw",
      text: "0 Changed\n1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat",
      name: "changed.ldr",
    });
    await a.ready({ strict: true });
  });
  await expect
    .poll(async () => (await stats()).shadowPasses)
    .toBeGreaterThan(before.shadowPasses);
});
