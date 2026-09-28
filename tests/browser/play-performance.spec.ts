import { test, expect } from "@playwright/test";

test.use({
  viewport: { width: 360, height: 800 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

test("Play caps the phone drawing buffer and redraws only when the view changes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const counter = { draws: 0 };
    (window as unknown as { __draws: typeof counter }).__draws = counter;
    const proto = WebGL2RenderingContext.prototype as unknown as Record<
      string,
      (...args: unknown[]) => unknown
    >;
    for (const name of [
      "drawElements",
      "drawArrays",
      "drawElementsInstanced",
      "drawArraysInstanced",
    ]) {
      const original = proto[name];
      proto[name] = function (this: unknown, ...args: unknown[]) {
        counter.draws++;
        return original.apply(this, args);
      };
    }
  });
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    await window.brickEditor!.project.import({
      format: "template",
      template: "wall",
    });
    await window.brickEditor!.ready();
  });
  const ratio = () =>
    page.evaluate(() => {
      const canvas = document.querySelector("canvas")!;
      return canvas.width / canvas.clientWidth;
    });
  // The editor keeps the balanced profile's 2x cap on a DPR 3 phone.
  expect(await ratio()).toBeCloseTo(2, 1);
  await page.evaluate(() =>
    window.brickEditor!.play.enter({
      realtime: true,
      locomotion: "fly-noclip",
      position: [0, -120, 300],
    }),
  );
  await expect.poll(ratio).toBeCloseTo(1.5, 1);
  const drawsOver = (frames: number) =>
    page.evaluate(async (frames) => {
      const counter = (window as unknown as { __draws: { draws: number } })
        .__draws;
      const frame = () => new Promise((r) => requestAnimationFrame(r));
      await frame();
      const start = counter.draws;
      for (let i = 0; i < frames; i++) await frame();
      return counter.draws - start;
    }, frames);
  // Hovering with no input: after settling, frames draw nothing.
  await drawsOver(5);
  expect(await drawsOver(10)).toBe(0);
  // Moving redraws continuously again.
  await page.evaluate(() => window.brickEditor!.play.setInput({ moveZ: 1 }));
  expect(await drawsOver(10)).toBeGreaterThan(0);
  const moved = await page.evaluate(() => window.brickEditor!.play.snapshot());
  expect(moved.position[2]).toBeLessThan(300);
  await page.evaluate(() => window.brickEditor!.play.exit());
  await expect.poll(ratio).toBeCloseTo(2, 1);
});
