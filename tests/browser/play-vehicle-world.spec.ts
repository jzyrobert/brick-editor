import { playSourceState } from "./helpers/play-source-state";
import { realMechanismsFixture } from "./helpers/real-mechanisms";
import { expect, test } from "@playwright/test";
import { openMode } from "./helpers/mode";
for (const width of [360, 1440])
  test(`vehicle world stop, reverse and capture preserve authored source at ${width}px`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width, height: width === 360 ? 800 : 1000 },
      hasTouch: width === 360,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto("/?automation=1");
      await page.waitForFunction(() => !!window.brickEditor);
      await page.evaluate(async (realFixtureBytes: number[]) => {
        const a = window.brickEditor!;
        await a.project.import({ format: "native", bytes: realFixtureBytes });
        await a.ready();
      }, realFixture.bytes);
      await openMode(page, "Play");
      const source = await playSourceState(page);
      const initial = await page.evaluate(() =>
        window.brickEditor!.play.enter({
          rigIds: ["door", "vehicle"],
          position: [-90, -0.3, -160],
          realtime: false,
        }),
      );
      expect(initial.mechanisms!.vehicle.vehicleCollision).toMatchObject({
        supported: true,
        status: "ready",
      });
      const control = page.getByRole("button", {
        name: "Drive from here",
        exact: true,
      });
      if (width === 360) await control.tap();
      else await control.click();
      // Reverse toward the authored door/frame at z=0. Player stays out of its path.
      await page.keyboard.down("s");
      const stopped = await page.evaluate(() =>
        window.brickEditor!.play.stepTicks(180),
      );
      await page.keyboard.up("s");
      const vehicle = stopped.mechanisms!.vehicle;
      expect(vehicle.vehicleCollision).toMatchObject({
        status: "blocked",
        supported: true,
      });
      expect(vehicle.pose.vehicle!.position[2]).toBeGreaterThan(20);
      expect(vehicle.pose.vehicle!.position[2]).toBeLessThan(180);
      await expect(
        page
          .getByText(
            /Vehicle stopped before intersecting included world or another rig/,
          )
          .first(),
      ).toBeVisible();
      const idle = await page.evaluate(() =>
        window.brickEditor!.play.stepTicks(20),
      );
      expect(idle.mechanisms!.vehicle.pose).toEqual(vehicle.pose);
      expect(idle.mechanisms!.vehicle.vehicleCollision).toEqual(
        vehicle.vehicleCollision,
      );
      const capture = await page.evaluate(async () => {
        const a = window.brickEditor!;
        const snapshot = await a.play.snapshot();
        return (
          await a.render.image({
            revision: snapshot.sourceRevision,
            width: 128,
            height: 128,
            format: "png",
            visibility: { mode: "all" },
            background: { type: "transparent" },
            quality: "fast",
            strict: true,
          })
        ).manifest;
      });
      expect(
        (capture as unknown as { play: typeof idle }).play.mechanisms!.vehicle
          .vehicleCollision,
      ).toEqual(vehicle.vehicleCollision);
      await page.keyboard.down("w");
      const reversed = await page.evaluate(() =>
        window.brickEditor!.play.stepTicks(12),
      );
      await page.keyboard.up("w");
      expect(
        reversed.mechanisms!.vehicle.pose.vehicle!.position[2],
      ).toBeLessThan(vehicle.pose.vehicle!.position[2]);
      expect(reversed.mechanisms!.vehicle.vehicleCollision!.status).toBe(
        "ready",
      );
      await page.evaluate(() => window.brickEditor!.play.exit());
      expect(await playSourceState(page)).toEqual(source);
      expect(errors).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    } finally {
      await context.close();
    }
  });

const realFixture = realMechanismsFixture(-200);
