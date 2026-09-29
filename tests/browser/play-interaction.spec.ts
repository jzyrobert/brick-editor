import { expect, test } from "@playwright/test";
import { openMode } from "./helpers/mode";
import { refusePointerLock } from "./helpers/pointer";
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
    await refusePointerLock(page);
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
      await openMode(page, "Play");
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
      const snapshot = () =>
        page.evaluate(() => window.brickEditor!.play.snapshot());
      expect((await snapshot()).mechanism!.pose.jointPositions.hinge).toBe(0);
      await page.evaluate(() => window.brickEditor!.play.stepTicks(10));
      expect((await snapshot()).mechanism!.pose.jointPositions.hinge).toBe(15);
      await expect(
        page.getByText("Opening · 15.0° / 110.0°", { exact: true }),
      ).toBeVisible();
      const partial = await page.locator("canvas").first().screenshot();
      // Reverse intended opening before its midpoint: no pose jump on action.
      await page.getByRole("button", { name: "Close joint" }).click();
      expect((await snapshot()).mechanism!.pose.jointPositions.hinge).toBe(15);
      await page.evaluate(() => window.brickEditor!.play.stepTicks(1));
      expect((await snapshot()).mechanism!.pose.jointPositions.hinge).toBe(
        13.5,
      );
      await page.evaluate(() => window.brickEditor!.play.stepTicks(9));
      expect((await snapshot()).mechanism!.pose.jointPositions.hinge).toBe(0);
      expect(await page.locator("canvas").first().screenshot()).not.toEqual(
        partial,
      );
      await open.click();
      await page.evaluate(() => window.brickEditor!.play.stepTicks(74));
      expect((await snapshot()).mechanism!.pose.jointPositions.hinge).toBe(110);
      await page.getByRole("button", { name: "Close joint" }).click();
      await page.evaluate(() => window.brickEditor!.play.stepTicks(74));
      expect((await snapshot()).mechanism!.pose.jointPositions.hinge).toBe(0);
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
      expect(driven.mechanism!.pose.vehicle!.headingDegrees).toBeGreaterThan(0);
      // Forward is LDraw −Z, up is −Y, so screen-right is −X: A must travel +X.
      expect(driven.mechanism!.pose.vehicle!.position[0]).toBeGreaterThan(0);
      await page.keyboard.down("w");
      await page.keyboard.down("d");
      await page.evaluate(() => window.brickEditor!.play.stepTicks(6));
      await page.keyboard.up("w");
      await page.keyboard.up("d");
      const right = await page.evaluate(() =>
        window.brickEditor!.play.snapshot(),
      );
      expect(right.mechanism!.pose.vehicle!.headingDegrees).toBeLessThan(
        driven.mechanism!.pose.vehicle!.headingDegrees,
      );
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
              x: stick.x + stick.width * 0.3,
              y: stick.y + stick.height * 0.2,
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
        expect(touch.mechanism!.pose.vehicle!.headingDegrees).toBeGreaterThan(
          right.mechanism!.pose.vehicle!.headingDegrees,
        );
        await client.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [
            {
              id: 2,
              x: stick.x + stick.width * 0.7,
              y: stick.y + stick.height * 0.2,
            },
          ],
        });
        await page.evaluate(() => window.brickEditor!.play.stepTicks(6));
        await client.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        const touchRight = await page.evaluate(() =>
          window.brickEditor!.play.snapshot(),
        );
        expect(touchRight.mechanism!.pose.vehicle!.headingDegrees).toBeLessThan(
          touch.mechanism!.pose.vehicle!.headingDegrees,
        );
        await page.evaluate(() => window.brickEditor!.play.stepTicks(12));
        expect(
          (await page.evaluate(() => window.brickEditor!.play.snapshot()))
            .mechanism!.pose.vehicle!.position,
        ).toEqual(touchRight.mechanism!.pose.vehicle!.position);
      }
      await page.screenshot({
        path: test
          .info()
          .outputPath(`interaction-driving-${viewport.width}.png`),
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
        path: test.info().outputPath(`interaction-${viewport.width}.png`),
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

test("animated target pauses, survives frozen capture, and retries a blocked close", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.project.import({ format: "template", template: "mechanisms" });
    await a.ready();
  });
  await openMode(page, "Play");
  const result = await page.evaluate(async () => {
    const a = window.brickEditor!;
    const authored = await a.project.export({ format: "ldraw" });
    await a.play.enter({
      rigId: "door",
      position: [20, -0.3, 45],
      realtime: true,
    });
    await a.play.pause(true);
    await a.play.setJointTarget({ jointId: "hinge", target: 110, speed: 90 });
    await a.play.stepTicks(10); // Explicit automation ticks remain allowed while paused.
    const before = await a.play.snapshot();
    await new Promise((resolve) => setTimeout(resolve, 180));
    const paused = await a.play.snapshot();
    const pending = a.render.image({
      revision: before.sourceRevision,
      width: 128,
      height: 128,
      format: "png",
      visibility: { mode: "all" },
      background: { type: "solid", color: "#ffffff" },
      quality: "balanced",
      strict: true,
    });
    const rejected = await a.play
      .setJointTarget({ jointId: "hinge", target: 0, speed: 90 })
      .then(
        () => false,
        () => true,
      );
    const image = await pending;
    const after = await a.play.snapshot();
    await a.play.stepTicks(1);
    const advanced = await a.play.snapshot();
    await a.play.setMechanismJoint("hinge", 90);
    await a.play.teleport({ position: [20, -0.3, 0] });
    await a.play.setJointTarget({ jointId: "hinge", target: 0, speed: 90 });
    await a.play.stepTicks(60);
    const blocked = await a.play.snapshot();
    return {
      authored,
      before,
      paused,
      after,
      advanced,
      rejected,
      blocked,
      manifest: image.manifest,
    };
  });
  expect(result.paused).toEqual(result.before);
  expect(result.after).toEqual(result.before);
  expect(result.rejected).toBe(true);
  expect(
    (result.manifest as unknown as { play: typeof result.before }).play
      .mechanism,
  ).toEqual(result.before.mechanism);
  expect(result.advanced.mechanism!.pose.jointPositions.hinge).toBe(16.5);
  expect(result.blocked.mechanism!.jointTargets.hinge.status).toBe("blocked");
  expect(result.blocked.mechanism!.pose.jointPositions.hinge).toBeGreaterThan(
    0,
  );
  expect(result.blocked.mechanism!.pose.jointPositions.hinge).toBeLessThan(90);
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.play.teleport({ position: [20, -0.3, 45] });
    await a.play.pause(false);
  });
  await page.getByRole("button", { name: "Retry closing" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (await window.brickEditor!.play.snapshot()).mechanism!.pose
            .jointPositions.hinge,
      ),
    )
    .toBe(0);
  await page.evaluate(() => window.brickEditor!.play.exit());
  expect(
    await page.evaluate(() =>
      window.brickEditor!.project.export({ format: "ldraw" }),
    ),
  ).toEqual(result.authored);
});
