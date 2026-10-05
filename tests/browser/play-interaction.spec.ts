import { realMechanismsFixture } from "./helpers/real-mechanisms";
import { expect, test } from "@playwright/test";
import { openMode } from "./helpers/mode";
import { refusePointerLock } from "./helpers/pointer";
import { exitPlay } from "./helpers/play";
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
      await page.evaluate(async (realFixtureBytes: number[]) => {
        await window.brickEditor!.project.import({
          format: "native",
          bytes: realFixtureBytes,
        });
        await window.brickEditor!.ready();
      }, realFixture.bytes);
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
        page.getByText("Opening · 15.0° / 90.0°", { exact: true }),
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
      expect((await snapshot()).mechanism!.pose.jointPositions.hinge).toBe(90);
      await page.getByRole("button", { name: "Close joint" }).click();
      await page.evaluate(() => window.brickEditor!.play.stepTicks(74));
      expect((await snapshot()).mechanism!.pose.jointPositions.hinge).toBe(0);
      await page.evaluate(() =>
        window.brickEditor!.play.teleport({ position: [400, -0.3, 45] }),
      );
      // Out of reach the action is not shown at all (no greyed prompt), and
      // it comes back, labelled with what it does, beside the door again.
      await expect(page.locator(".play-interaction")).toHaveCount(0);
      await expect(page.locator(".play-prompt")).toHaveCount(0);
      await page.evaluate(() =>
        window.brickEditor!.play.teleport({ position: [20, -0.3, 45] }),
      );
      await expect(open).toBeVisible();
      await page.evaluate(() =>
        window.brickEditor!.play.teleport({ position: [400, -0.3, 45] }),
      );
      await expect(page.locator(".play-interaction")).toHaveCount(0);
      await page.evaluate(() =>
        window.brickEditor!.play.enter({
          rigId: "vehicle",
          position: [-90, -0.3, -280],
          cameraMode: "third-person",
          realtime: false,
        }),
      );
      await page.getByRole("button", { name: "Get in" }).click();
      await expect(page.getByRole("button", { name: "Get out" })).toBeVisible();
      const start = await page.evaluate(() =>
        window.brickEditor!.play.snapshot(),
      );
      expect(start.vehicleControl).toEqual({ rigId: "vehicle" });
      expect(start.avatarVisible).toBe(false);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await expect(
        page.getByText("Recover last safe position", { exact: true }),
      ).toHaveCount(0);
      await expect(
        page
          .locator(".play-menu-note")
          .filter({ hasText: "Get out returns you beside it" }),
      ).toBeVisible();
      await expect(page.locator(".play-menu")).not.toContainText(
        "You stay on foot",
      );
      await page.getByRole("button", { name: "Resume", exact: true }).click();
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
      expect(driven.position).toEqual(
        driven.mechanism!.groupFrames.chassis.position,
      );
      expect(driven.vehicleControl).toEqual({ rigId: "vehicle" });
      expect(driven.positionAnchor).toBe("vehicle-reference");
      expect(driven.cameraMode).toBe("third-person");
      expect(driven.avatarVisible).toBe(false);
      if (viewport.width !== 1440) {
        // Driving splits the stick: a throttle pad and a steering pad, one
        // thumb each.
        const throttle = (await page
          .getByRole("group", { name: "Throttle: forward and back" })
          .boundingBox())!;
        const steer = (await page
          .getByRole("group", { name: "Steering: left and right" })
          .boundingBox())!;
        const forward = {
          x: throttle.x + throttle.width / 2,
          y: throttle.y + throttle.height * 0.12,
        };
        const client = await context.newCDPSession(page);
        await client.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [
            { id: 1, ...forward },
            {
              id: 3,
              x: steer.x + steer.width * 0.15,
              y: steer.y + steer.height / 2,
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
            { id: 2, ...forward },
            {
              id: 4,
              x: steer.x + steer.width * 0.85,
              y: steer.y + steer.height / 2,
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
        // Lift a second finger on Get out while one thumb still holds the
        // throttle. Multi-touch supplies no synthetic click for that lift.
        const exit = (await page
            .getByRole("button", { name: "Get out" })
            .boundingBox())!,
          exitPoint = {
            id: 6,
            x: exit.x + exit.width / 2,
            y: exit.y + exit.height / 2,
          };
        await client.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ id: 5, ...forward }],
        });
        await client.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ id: 5, ...forward }, exitPoint],
        });
        await client.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [exitPoint],
        });
        await expect
          .poll(async () => (await snapshot()).vehicleControl)
          .toBeUndefined();
        expect((await snapshot()).avatarVisible).toBe(true);
        await client.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        const released = await snapshot();
        await page.evaluate(() => window.brickEditor!.play.stepTicks(12));
        expect((await snapshot()).mechanism!.pose.vehicle!.position).toEqual(
          released.mechanism!.pose.vehicle!.position,
        );
        await page.getByRole("button", { name: "Get in" }).tap();
        await expect(
          page.getByRole("button", { name: "Get out" }),
        ).toBeVisible();
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
      await page.getByRole("button", { name: "Resume driving" }).click();
      await page.getByRole("button", { name: "Get out" }).click();
      const exited = await snapshot();
      expect(exited.vehicleControl).toBeUndefined();
      expect(exited.positionAnchor).toBe("standing-feet");
      expect(
        Math.hypot(
          exited.position[0] - right.position[0],
          exited.position[2] - right.position[2],
        ),
      ).toBeLessThan(250);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: test.info().outputPath(`interaction-${viewport.width}.png`),
      });
      await exitPlay(page);
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
  await page.evaluate(async (realFixtureBytes: number[]) => {
    const a = window.brickEditor!;
    await a.project.import({ format: "native", bytes: realFixtureBytes });
    await a.ready();
  }, realFixture.bytes);
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
    await a.play.setJointTarget({ jointId: "hinge", target: 90, speed: 90 });
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
    await a.play.setJointTarget({ jointId: "hinge", target: 90, speed: 90 });
    await a.play.stepTicks(60);
    // Walk over the real frame sill; a ground-height teleport into it is unsafe.
    await a.play.teleport({ position: [0, -0.3, 45] });
    await a.play.setInput({ moveZ: 1 });
    await a.play.stepTicks(19);
    await a.play.setInput({});
    const inside = await a.play.snapshot();
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
      inside,
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
  expect(Math.abs(result.inside.position[2])).toBeLessThan(3);
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
  await page.evaluate(() => window.brickEditor!.play.stepTicks(60));
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

const realFixture = realMechanismsFixture();
