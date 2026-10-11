import { expect, test } from "@playwright/test";
import { openMode } from "./helpers/mode";
import { refusePointerLock } from "./helpers/pointer";

for (const [width, height] of [
  [1080, 1800],
  [360, 600],
  [411, 685],
  [390, 844],
  [686, 411],
  [1440, 1000],
]) {
  test(`driving chase keeps distance and follows steering at ${width}×${height}`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width, height },
      hasTouch: width !== 1440,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await refusePointerLock(page);
      await page.goto("/?automation=1");
      await page.waitForFunction(() => !!window.brickEditor);
      await page.evaluate(async () => {
        await window.brickEditor!.project.import({
          format: "template",
          template: "car",
        });
        await window.brickEditor!.ready();
      });
      await openMode(page, "Play");
      await page.evaluate(async () => {
        const play = window.brickEditor!.play;
        await play.enter({
          rigId: "car",
          position: [-90, -0.3, 40],
          realtime: false,
          cameraMode: "third-person",
        });
      });
      await page.getByRole("button", { name: "Get in", exact: true }).click();
      await expect
        .poll(async () =>
          page.evaluate(
            async () =>
              (await window.brickEditor!.play.snapshot()).vehicleControl?.rigId,
          ),
        )
        .toBe("car");
      // Use the live viewport's aspect in captures, including the wide phone.
      const camera = () =>
        page.evaluate(async () => {
          const a = window.brickEditor!;
          const s = await a.play.snapshot();
          const canvas = document.querySelector("canvas")!;
          const aspect = canvas.clientWidth / canvas.clientHeight;
          const image = await a.render.image({
            revision: s.sourceRevision,
            width: Math.max(1, Math.round(64 * aspect)),
            height: 64,
            format: "png",
            quality: "fast",
            visibility: { mode: "all" },
            background: { type: "transparent" },
            strict: true,
          });
          return { camera: image.manifest.camera, state: s };
        });
      const initial = await camera();
      const distance = (c: typeof initial.camera) =>
        Math.hypot(...c.position.map((v, i) => v - c.target[i]));
      expect(initial.camera.near).toBeCloseTo(
        initial.state.cameraSafety.effectiveNear,
      );
      await page.evaluate(async () => {
        const play = window.brickEditor!.play;
        await play.setInput({ moveZ: 1, moveX: -1 });
        await play.stepTicks(150);
      });
      await page.screenshot({ path: test.info().outputPath("driving.png") });
      const driven = await camera();
      expect(driven.state.mechanism!.vehicleCollision!.status).toBe("ready");
      expect(distance(driven.camera)).toBeCloseTo(distance(initial.camera), 4);
      const heading =
        (driven.state.mechanism!.pose.vehicle!.headingDegrees * Math.PI) / 180;
      const bearing = Math.atan2(
        driven.camera.target[0] - driven.camera.position[0],
        driven.camera.position[2] - driven.camera.target[2],
      );
      expect(
        Math.abs(
          Math.atan2(Math.sin(bearing - heading), Math.cos(bearing - heading)),
        ),
      ).toBeLessThan(0.35);
      expect(heading).toBeGreaterThan(2);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
