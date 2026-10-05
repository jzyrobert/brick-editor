import { expect, test, type Page } from "@playwright/test";
import { openMode } from "./helpers/mode";
import { refusePointerLock } from "./helpers/pointer";
import { exitPlay } from "./helpers/play";

const shots = "test-results/play-orbit/";
test.setTimeout(180000);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

async function open(page: Page, template: string) {
  await refusePointerLock(page);
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async (template) => {
    await window.brickEditor!.project.import({
      format: "template",
      template: template as "jeep",
    });
    await window.brickEditor!.ready();
  }, template);
  await openMode(page, "Play");
}
const snapshot = (page: Page) =>
  page.evaluate(() => window.brickEditor!.play.snapshot());

test("the jeep drives and turns at the same time for fifteen seconds without a collision error", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await open(page, "jeep");
  await page.evaluate(() =>
    window.brickEditor!.play.enter({
      rigIds: ["jeep"],
      position: [-110, -0.3, -20],
      yaw: Math.PI / 2,
      realtime: false,
    }),
  );
  await page.keyboard.press("e");
  await expect(
    page.getByRole("button", { name: "Get out", exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.brickEditor!.play.setCameraMode("third-person"),
  );
  await page.keyboard.down("w");
  await page.keyboard.down("a");
  const stops: string[] = [];
  for (let i = 0; i < 15; i++) {
    const s = await page.evaluate(() => window.brickEditor!.play.stepTicks(60));
    const jeep = s.mechanisms!.jeep;
    if (jeep.blockedReason) stops.push(jeep.blockedReason);
    expect(jeep.vehicleCollision!.status).toBe("ready");
    if (i === 3) await page.screenshot({ path: `${shots}jeep-driving.png` });
  }
  await page.keyboard.up("w");
  await page.keyboard.up("a");
  expect(stops).toEqual([]);
  const driven = await snapshot(page);
  // Round through due south (±180°) at least once.
  expect(
    Math.abs(driven.mechanisms!.jeep.pose.vehicle!.headingDegrees),
  ).toBeGreaterThan(360);
  await expect(page.getByText(/work budget/i)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the roadster seats the figure, drives, and lets it out", async ({
  page,
}) => {
  await open(page, "car");
  await page.evaluate(() =>
    window.brickEditor!.play.enter({
      rigIds: ["car"],
      position: [-90, -0.3, 40],
      yaw: Math.PI / 2,
      realtime: false,
    }),
  );
  const enter = page.getByRole("button", {
    name: "Get in",
    exact: true,
  });
  await expect(enter).toBeEnabled();
  await page.keyboard.press("e");
  await expect(
    page.getByRole("button", { name: "Get out", exact: true }),
  ).toBeVisible();
  const seated = await snapshot(page);
  expect(seated.vehicleControl).toEqual({ rigId: "car" });
  expect(seated.cameraMode).toBe("third-person");
  expect(seated.avatarVisible).toBe(false);
  expect(seated.positionAnchor).toBe("vehicle-reference");
  await page.evaluate(async () => {
    const play = window.brickEditor!.play;
    await play.setCameraMode("third-person");
    const s = await play.snapshot();
    // Orbit round to the front left of the car, looking down at the driver.
    await play.setInput({ yaw: s.avatar.heading + 2.3, pitch: 0.5 });
    await play.stepTicks(1);
  });
  await page.screenshot({ path: `${shots}roadster-seated.png` });
  await page.keyboard.down("w");
  const moved = await page.evaluate(() =>
    window.brickEditor!.play.stepTicks(60),
  );
  await page.keyboard.up("w");
  expect(moved.mechanisms!.car.pose.vehicle!.position[2]).toBeLessThan(-100);
  expect(moved.mechanisms!.car.blockedReason).toBeUndefined();
  await page.getByRole("button", { name: "Get out", exact: true }).click();
  const out = await snapshot(page);
  expect(out.vehicleControl).toBeUndefined();
  expect(out.avatarVisible).toBe(out.cameraMode === "third-person");
  expect(out.positionAnchor).toBe("standing-feet");
  await exitPlay(page);
});

test("third person: walking back turns the figure round, and the camera orbits to show its face", async ({
  page,
}) => {
  await open(page, "blank");
  await page.evaluate(() =>
    window.brickEditor!.play.enter({
      position: [0, -0.3, 0],
      yaw: 0,
      pitch: -0.2,
      cameraMode: "third-person",
      realtime: false,
    }),
  );
  // Walk away from the camera, then press S: the figure turns to face the
  // camera and walks towards it.
  await page.keyboard.down("w");
  await page.evaluate(() => window.brickEditor!.play.stepTicks(30));
  await page.keyboard.up("w");
  const away = await snapshot(page);
  expect(Math.abs(wrap(away.avatar.heading))).toBeLessThan(1e-3);
  await page.keyboard.down("s");
  await page.evaluate(() => window.brickEditor!.play.stepTicks(40));
  const back = await snapshot(page);
  await page.keyboard.up("s");
  expect(back.position[2]).toBeGreaterThan(away.position[2]);
  expect(Math.abs(wrap(back.avatar.heading - Math.PI))).toBeLessThan(1e-3);
  // The camera yaw is still the player's.
  expect(back.yaw).toBe(0);
  await page.screenshot({ path: `${shots}walking-back-face.png` });
  // Stand still and drag the view round: the camera orbits, the figure stays.
  const settled = await page.evaluate(() =>
    window.brickEditor!.play.stepTicks(30),
  );
  const canvas = page.locator("canvas").first();
  const box = (await canvas.boundingBox())!;
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++)
    await page.mouse.move(start.x + i * 40, start.y);
  await page.mouse.up();
  const orbited = await snapshot(page);
  expect(Math.abs(wrap(orbited.yaw - back.yaw))).toBeGreaterThan(0.5);
  expect(orbited.avatar.heading).toBeCloseTo(settled.avatar.heading, 9);
  // Orbit on round to the front and look at the face.
  await page.evaluate(async (heading) => {
    await window.brickEditor!.play.setInput({
      yaw: heading + Math.PI,
      pitch: -0.1,
    });
    await window.brickEditor!.play.stepTicks(2);
  }, settled.avatar.heading);
  const front = await snapshot(page);
  expect(front.avatar.heading).toBeCloseTo(settled.avatar.heading, 9);
  expect(Math.abs(front.avatar.headYaw)).toBeLessThan(1e-9);
  await page.screenshot({ path: `${shots}third-person-face.png` });
  await exitPlay(page);
});
