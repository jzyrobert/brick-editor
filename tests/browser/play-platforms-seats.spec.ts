import { expect, test } from "@playwright/test";
import { openMode } from "./helpers/mode";
import { refusePointerLock } from "./helpers/pointer";
import {
  checkPhysicalRefusal,
  laboratoryFixture,
} from "./helpers/physical-play-policy";
for (const kind of ["lift", "turntable"] as const)
  test(`a synthetic ${kind} stays a static bench without a mounted motor`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await checkPhysicalRefusal(
      page,
      laboratoryFixture(`movingPlatformFixture('${kind}')`),
      /supported motor part/,
      true,
    );
  });
for (const width of [1440, 360])
  test(`seated native jeep driving and safe exit ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 360 ? 600 : 1000 });
    await refusePointerLock(page);
    await page.goto("/?automation=1");
    await page.waitForFunction(() => !!window.brickEditor);
    const original = await page.evaluate(async () => {
      const api = window.brickEditor!;
      await api.project.import({ format: "template", template: "jeep" });
      await api.ready({ strict: true });
      return api.query();
    });
    await openMode(page, "Play");
    await page.evaluate(async () => {
      const play = window.brickEditor!.play;
      await play.enter({
        rigId: "jeep",
        dynamicRigIds: ["jeep"],
        position: [-110, -0.3, -20],
        yaw: Math.PI / 2,
        cameraMode: "third-person",
        realtime: false,
      });
      await play.stepTicks(60);
    });
    const entry = await page.evaluate(async () =>
      window.brickEditor!.play.enterVehicle({
        rigId: "jeep",
        seatId: "driver",
      }),
    );
    expect(entry.avatar.state).toBe("seated");
    await expect(
      page.getByRole("button", { name: "Get out", exact: true }),
    ).toBeVisible();
    const driven = await page.evaluate(async () => {
      await window.brickEditor!.play.setInput({ moveZ: 1, moveX: -0.3 });
      return window.brickEditor!.play.stepTicks(120);
    });
    expect(driven.occupancy).toBeDefined();
    expect(driven.avatar.basis).toBeDefined();
    expect(
      Math.hypot(...driven.position.map((v, i) => v - entry.position[i])),
    ).toBeGreaterThan(50);
    await page.screenshot({
      path: test.info().outputPath(`dynamic-jeep-${width}.png`),
    });
    await page.evaluate(async () => {
      await window.brickEditor!.play.setInput({});
      await window.brickEditor!.play.stepTicks(240);
    });
    const exited = await page.evaluate(() =>
      window.brickEditor!.play.exitVehicle(),
    );
    expect(exited.occupancy).toBeUndefined();
    expect(Math.abs(exited.position[1])).toBeLessThan(1);
    await page.evaluate(() => window.brickEditor!.play.exit());
    expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
      original,
    );
  });
