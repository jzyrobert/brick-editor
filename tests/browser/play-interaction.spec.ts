import { expect, test } from "@playwright/test";
for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 360, height: 800 },
  { width: 1080, height: 1800 },
]) {
  test(`nearby joint and vehicle interaction at ${viewport.width}px`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      viewport,
      hasTouch: viewport.width !== 1440,
      baseURL,
    });
    const page = await context.newPage();
    try {
      await page.goto("/?automation=1");
      await page.waitForFunction(() => !!window.brickEditor);
      await page.evaluate(async () => {
        await window.brickEditor!.project.import({
          format: "template",
          template: "mechanisms",
        });
        await window.brickEditor!.ready();
      });
      await page.getByRole("button", { name: "Play", exact: true }).click();
      const before = await page.evaluate(() =>
        window.brickEditor!.project.export({ format: "ldraw" }),
      );
      await page.evaluate(() =>
        window.brickEditor!.play.enter({
          rigId: "door",
          position: [20, -0.3, 45],
          realtime: false,
        }),
      );
      const open = page.getByRole("button", { name: "Open joint" });
      await expect(open).toBeEnabled();
      if (viewport.width === 1440) await page.keyboard.press("e");
      else await open.tap();
      await expect
        .poll(() =>
          page.evaluate(
            async () =>
              (await window.brickEditor!.play.snapshot()).mechanism!.pose
                .jointPositions.hinge,
          ),
        )
        .toBe(110);
      await page.getByRole("button", { name: "Close joint" }).click();
      await expect
        .poll(() =>
          page.evaluate(
            async () =>
              (await window.brickEditor!.play.snapshot()).mechanism!.pose
                .jointPositions.hinge,
          ),
        )
        .toBe(0);
      await page.evaluate(() =>
        window.brickEditor!.play.teleport({ position: [400, -0.3, 45] }),
      );
      await expect(
        page.getByRole("button", { name: "Move closer to interact" }),
      ).toBeDisabled();
      await page.evaluate(() =>
        window.brickEditor!.play.enter({
          rigId: "vehicle",
          position: [80, -0.3, -200],
          realtime: false,
        }),
      );
      await page.getByRole("button", { name: "Control vehicle" }).click();
      await expect(
        page.getByRole("button", { name: "Release vehicle" }),
      ).toBeVisible();
      const start = await page.evaluate(() =>
        window.brickEditor!.play.snapshot(),
      );
      await page.keyboard.down("w");
      await page.keyboard.down("a");
      await page.evaluate(() => window.brickEditor!.play.stepTicks(12));
      await page.keyboard.up("w");
      await page.keyboard.up("a");
      const driven = await page.evaluate(() =>
        window.brickEditor!.play.snapshot(),
      );
      expect(driven.mechanism!.pose.vehicle!.position[2]).toBeLessThan(-10);
      expect(driven.mechanism!.pose.vehicle!.headingDegrees).toBeLessThan(0);
      expect(driven.position[0]).toBeCloseTo(start.position[0], 3);
      expect(driven.position[2]).toBeCloseTo(start.position[2], 3);
      if (viewport.width !== 1440) {
        const stick = (await page
          .getByRole("group", { name: "Movement joystick" })
          .boundingBox())!;
        const client = await context.newCDPSession(page);
        await client.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [
            {
              id: 1,
              x: stick.x + stick.width / 2,
              y: stick.y + stick.height * 0.1,
            },
          ],
        });
        await page.evaluate(() => window.brickEditor!.play.stepTicks(12));
        await client.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        const touch = await page.evaluate(() =>
          window.brickEditor!.play.snapshot(),
        );
        expect(touch.mechanism!.pose.vehicle!.position[2]).toBeLessThan(
          driven.mechanism!.pose.vehicle!.position[2] - 10,
        );
        await page.evaluate(() => window.brickEditor!.play.stepTicks(12));
        expect(
          (await page.evaluate(() => window.brickEditor!.play.snapshot()))
            .mechanism!.pose.vehicle!.position,
        ).toEqual(touch.mechanism!.pose.vehicle!.position);
      }
      await page.screenshot({
        path: `test-results/interaction-driving-${viewport.width}.png`,
      });
      await page.keyboard.down("w");
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.keyboard.up("w");
      const stopped = await page.evaluate(() =>
        window.brickEditor!.play.snapshot(),
      );
      await page.evaluate(() => window.brickEditor!.play.stepTicks(12));
      expect(
        (await page.evaluate(() => window.brickEditor!.play.snapshot()))
          .mechanism!.pose.vehicle,
      ).toEqual(stopped.mechanism!.pose.vehicle);
      await page.getByRole("button", { name: "Resume exploring" }).click();
      await page.getByRole("button", { name: "Release vehicle" }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/interaction-${viewport.width}.png`,
      });
      await page
        .getByRole("button", { name: "Exit Play", exact: true })
        .click();
      expect(
        await page.evaluate(() =>
          window.brickEditor!.project.export({ format: "ldraw" }),
        ),
      ).toEqual(before);
    } finally {
      await context.close();
    }
  });
}
