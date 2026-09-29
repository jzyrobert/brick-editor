import { expect, test, type Page } from "@playwright/test";
import { openMode } from "./helpers/mode";

type Frame = {
  t: number;
  time: number;
  camera: number[];
  figure: number[];
  heading: number;
  pose: Record<string, number | string>;
};
const shots = "test-results/play-avatar/";
// Realtime sampling over software WebGL is slow; allow two minutes per test.
test.setTimeout(120000);
// A 32 × 32 baseplate: walking crosses stud and triangle edges constantly.
const baseplate = "0 Baseplate\n1 2 0 0 0 1 0 0 0 1 0 0 0 1 3811.dat\n";

async function open(page: Page, text = baseplate) {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async (text) => {
    await window.brickEditor!.project.import({ format: "ldraw", text });
    await window.brickEditor!.ready();
  }, text);
  await openMode(page, "Play");
}
const trace = (page: Page, clear = false) =>
  page.evaluate(
    (clear) =>
      (
        window.brickEditor!.play as unknown as {
          frameTrace: (clear: boolean) => Promise<Frame[]>;
        }
      ).frameTrace(clear),
    clear,
  );
const frames = (page: Page, n: number) =>
  page.evaluate(async (n) => {
    for (let i = 0; i < n; i++)
      await new Promise((r) => requestAnimationFrame(r));
  }, n);
const secondDifference = (a: number[][]) => {
  let worst = 0;
  for (let i = 2; i < a.length; i++)
    worst = Math.max(
      worst,
      Math.hypot(...a[i].map((v, k) => v - 2 * a[i - 1][k] + a[i - 2][k])),
    );
  return worst;
};
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

test("third-person figure walks, swings its limbs and flies, moving with the camera without judder", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() =>
    window.brickEditor!.play.enter({
      realtime: true,
      cameraMode: "third-person",
      position: [0, -10, 280],
      pitch: -0.35,
    }),
  );
  await frames(page, 20);
  const start = await page.evaluate(() => window.brickEditor!.play.snapshot());
  expect(start.collisionReady).toBe(true);
  expect(start.locomotion).toBe("walk");
  expect(start.avatarVisible).toBe(true);
  // Walk forward: the figure is drawn and its legs swing between frames.
  await page.evaluate(() => window.brickEditor!.play.setInput({ moveZ: 1 }));
  await frames(page, 30);
  await trace(page, true);
  await frames(page, 40);
  const walk = await trace(page);
  expect(walk.length).toBeGreaterThan(10);
  const hips = walk.map((f) => f.pose.leftHip as number);
  expect(Math.max(...hips) - Math.min(...hips)).toBeGreaterThan(0.4);
  expect(
    walk.every(
      (f) =>
        Math.abs((f.pose.leftHip as number) + (f.pose.rightHip as number)) <
        1e-9,
    ),
  ).toBe(true);
  // Back onto the baseplate for the picture (software rendering is slow, so
  // the walk above may have left the plate).
  await page.evaluate(async () => {
    const play = window.brickEditor!.play;
    await play.teleport({ position: [0, -10, 250], pitch: -0.35 });
    await play.setInput({ moveZ: 1, pitch: -0.35 });
  });
  await frames(page, 14);
  await page.screenshot({ path: shots + "third-person-walk.png" });

  // Diagonal: steady relative to the chase camera, smooth heading.
  await page.evaluate(async () => {
    const play = window.brickEditor!.play;
    await play.teleport({ position: [260, -10, 260] });
    await play.setInput({ moveZ: 1, moveX: 1, pitch: -0.35 });
  });
  await frames(page, 30);
  await trace(page, true);
  await frames(page, 45);
  const diagonal = await trace(page);
  const offsets = diagonal.map((f) => f.figure.map((v, k) => v - f.camera[k]));
  // Before render interpolation the figure snapped a whole tick (1.7 LDU)
  // relative to the smoothly interpolated camera.
  expect(secondDifference(offsets)).toBeLessThan(0.05);
  // No bobbing over the studs: the drawn height glides (the capsule's own
  // height still rises and dips by up to 4 LDU between studs).
  const heights = diagonal.map((f) => f.figure[1]);
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(2.5);
  // Per drawn frame (software rendering here draws a frame every few ticks).
  expect(secondDifference(heights.map((y) => [y]))).toBeLessThan(1.5);
  const turn = diagonal
    .slice(1)
    .map((f, i) => Math.abs(wrap(f.heading - diagonal[i].heading)));
  expect(Math.max(...turn)).toBeLessThan(0.02);
  // Constant speed across the studs: horizontal speed per frame stays near
  // the walking speed (100 LDU/s) instead of stalling on edges. Measured in
  // simulated time: slow software rendering may drop catch-up ticks.
  const speeds = diagonal.slice(1).flatMap((f, i) => {
    const dt = f.time - diagonal[i].time;
    const d = Math.hypot(
      f.figure[0] - diagonal[i].figure[0],
      f.figure[2] - diagonal[i].figure[2],
    );
    return dt > 0.005 ? [d / dt] : [];
  });
  speeds.sort((a, b) => a - b);
  expect(speeds[Math.floor(speeds.length / 2)]).toBeGreaterThan(80);
  expect(speeds[Math.floor(speeds.length / 2)]).toBeLessThan(120);
  await page.screenshot({ path: shots + "third-person-diagonal.png" });

  // Fly: legs trail, no running stride in the air.
  await page.evaluate(async () => {
    const play = window.brickEditor!.play;
    await play.setInput({});
    await play.setLocomotion("fly-noclip");
    await play.teleport({ position: [0, -160, 150], policy: "free-flight" });
    // Level flight (the view pitched down would descend to the ground).
    await play.setInput({ moveZ: 1, pitch: 0 });
  });
  await frames(page, 90);
  await trace(page, true);
  await frames(page, 30);
  const fly = await trace(page);
  const last = fly.at(-1)!.pose;
  expect(last.state).toBe("fly");
  expect(last.leftHip as number).toBeLessThan(-0.15);
  expect(last.rightHip as number).toBeLessThan(-0.15);
  expect(last.swing as number).toBeLessThan(0.05);
  await page.screenshot({ path: shots + "third-person-fly.png" });
  await page.evaluate(() => window.brickEditor!.play.exit());
});

test("desktop mouse look: click captures the pointer, raw movement turns the view, Esc releases and pauses", async ({
  page,
}) => {
  // Headless browsers cannot grant real pointer lock; emulate the browser.
  await page.addInitScript(() => {
    let locked: Element | null = null;
    Object.defineProperty(Document.prototype, "pointerLockElement", {
      configurable: true,
      get: () => locked,
    });
    Element.prototype.requestPointerLock = function (this: Element) {
      locked = this;
      (window as unknown as { __locks: number }).__locks =
        ((window as unknown as { __locks?: number }).__locks ?? 0) + 1;
      document.dispatchEvent(new Event("pointerlockchange"));
      return Promise.resolve();
    } as Element["requestPointerLock"];
    Document.prototype.exitPointerLock = function () {
      locked = null;
      document.dispatchEvent(new Event("pointerlockchange"));
    };
  });
  await open(page);
  // Mouse settings live with the Play controls.
  await page
    .getByText("Play keyboard and mouse controls", { exact: true })
    .click();
  await expect(page.getByLabel("Mouse sensitivity")).toHaveValue("1");
  await page.getByRole("button", { name: "Enter Play", exact: true }).click();
  await expect(page.locator(".play-overlay")).toHaveClass(/is-locked/);
  expect(
    await page.evaluate(
      () => (window as unknown as { __locks: number }).__locks,
    ),
  ).toBe(1);
  await expect(page.locator(".play-keys-hint")).toContainText("Esc to release");
  await page.screenshot({ path: shots + "desktop-locked.png" });
  const yaw = () =>
    page.evaluate(() => window.brickEditor!.play.snapshot().then((s) => s.yaw));
  const pitch = () =>
    page.evaluate(() =>
      window.brickEditor!.play.snapshot().then((s) => s.pitch),
    );
  // No button held: movement alone turns the view (0.0025 rad per count).
  await page.mouse.move(700, 500);
  const before = await yaw(),
    pitchBefore = await pitch();
  await page.mouse.move(800, 500, { steps: 4 });
  const turned = wrap(before - (await yaw()));
  expect(turned).toBeGreaterThan(0.2);
  expect(turned).toBeLessThan(0.3);
  await page.mouse.move(800, 540, { steps: 2 });
  expect(await pitch()).toBeLessThan(pitchBefore);
  // Esc (the browser's own release key) exits the lock and pauses; the
  // pause menu and every button are reachable.
  await page.evaluate(() => document.exitPointerLock());
  await expect(
    page.getByRole("heading", { name: "Take a breather." }),
  ).toBeVisible();
  await expect(page.locator(".play-overlay")).not.toHaveClass(/is-locked/);
  // Invert Y from the pause menu, then resume (re-captures the pointer).
  await page
    .locator(".play-menu")
    .getByText("Play keyboard and mouse controls", { exact: true })
    .click();
  await page
    .locator(".play-menu")
    .getByLabel("Invert mouse up and down")
    .check();
  await page.getByRole("button", { name: "Resume exploring" }).click();
  await expect(page.locator(".play-overlay")).toHaveClass(/is-locked/);
  const pitchInverted = await pitch();
  await page.mouse.move(800, 580, { steps: 2 });
  expect(await pitch()).toBeGreaterThan(pitchInverted);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Take a breather." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Exit Play" }).click();
});

test("mouse look falls back to dragging when pointer lock is refused", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Element.prototype.requestPointerLock = function () {
      return Promise.reject(new DOMException("Refused", "SecurityError"));
    } as Element["requestPointerLock"];
  });
  await open(page);
  await page.getByRole("button", { name: "Enter Play", exact: true }).click();
  await expect(page.locator(".play-lock-hint")).toHaveText(
    "Drag to look around · Esc to pause",
  );
  const yaw = () =>
    page.evaluate(() => window.brickEditor!.play.snapshot().then((s) => s.yaw));
  const before = await yaw();
  await page.mouse.move(600, 500);
  await page.mouse.down();
  await page.mouse.move(700, 500, { steps: 5 });
  await page.mouse.up();
  expect(wrap(before - (await yaw()))).toBeGreaterThan(0.2);
  // Moving without a button does nothing when the pointer is not captured.
  const still = await yaw();
  await page.mouse.move(900, 500, { steps: 3 });
  expect(await yaw()).toBe(still);
  await page.getByRole("button", { name: "Exit Play" }).click();
});
