import { test, expect, type Page } from "@playwright/test";
import { openMode } from "./helpers/mode";
import { dismissRotatePrompt } from "./helpers/play";

const load = async (page: Page) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.project.import({ format: "template", template: "train" });
    await a.ready({ strict: true });
  });
};
const trains = (page: Page) =>
  page.evaluate(
    async () => (await window.brickEditor!.play.snapshot()).trains!,
  );

test("railway station: Go runs the train round the oval and through the switch", async ({
  page,
}) => {
  test.setTimeout(360000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await load(page);
  await openMode(page, "Play");
  await page.getByRole("button", { name: "Enter Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible({
    timeout: 60000,
  });
  const go = page.getByRole("button", { name: "Start the train" });
  await expect(go).toBeVisible();
  await expect(page.locator(".play-train-status")).toContainText(
    "Train 1 · Stopped",
  );
  let t = await trains(page);
  expect(t.trains).toHaveLength(1);
  expect(t.trains[0].cars.map((c) => c.locomotive)).toEqual([
    true,
    false,
    false,
  ]);
  expect(t.switches).toHaveLength(1);
  expect(t.track.gaps).toEqual([]);
  // Play captures the mouse for look on a desktop, so the train has keys:
  // G go/stop, R reverse, C ride along, P the points. One key: the train
  // pulls away (real time on this software-GL VM is slow, so fixed ticks
  // advance it).
  await expect(go).toHaveAttribute("aria-keyshortcuts", "G");
  await page.keyboard.press("g");
  await expect(
    page.getByRole("button", { name: "Stop the train" }),
  ).toBeVisible();
  const before = (await trains(page)).trains[0];
  await page.evaluate(() => window.brickEditor!.play.stepTicks(180));
  const after = (await trains(page)).trains[0];
  expect(after.odometer - before.odometer).toBeGreaterThan(200);
  expect(
    Math.hypot(
      after.position[0] - before.position[0],
      after.position[2] - before.position[2],
    ),
  ).toBeGreaterThan(200);
  await expect(page.locator(".play-train-status")).toContainText("Running");
  // Round the oval at a fixed tick rate, then through the switch into the
  // siding once the points are set (the train has left them by then).
  await page.evaluate(() => window.brickEditor!.play.stepTicks(900));
  t = await trains(page);
  expect(t.switches[0].occupied).toBe(false);
  await page.keyboard.press("p");
  t = await trains(page);
  expect(t.switches[0].route).toBe("branch");
  for (let i = 0; i < 12; i++) {
    t = await page.evaluate(async () => {
      await window.brickEditor!.play.stepTicks(240);
      return (await window.brickEditor!.play.snapshot()).trains!;
    });
    if (t.trains[0].status === "end-of-track") break;
  }
  expect(t.trains[0].status).toBe("end-of-track");
  expect(t.trains[0].position[2]).toBeCloseTo(320, 1);
  await expect(page.locator(".play-train-status")).toContainText(
    "The track ends here",
  );
  // Reverse and Go backs it out again; Ride along follows it. Riding opens
  // the drawer of train controls, where Reverse shows it is on.
  await page.keyboard.press("r");
  await page.keyboard.press("g");
  await page.keyboard.press("c");
  await expect(page.locator(".play-status")).toContainText("Riding · Train 1");
  await expect(
    page.getByRole("button", { name: "Reverse direction" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Get off train" }),
  ).toBeVisible();
  await page.evaluate(() => window.brickEditor!.play.stepTicks(120));
  t = await trains(page);
  expect(t.trains[0].speed).toBeLessThan(0);
  expect(t.riding).toBe("train:1");
  // First person rides in the cab.
  await page.screenshot({
    path: test.info().outputPath("train-desktop-cab.png"),
  });
  // Third person: the chase view behind the train, looking down on it.
  await page.keyboard.press("c");
  await page.evaluate(() =>
    window.brickEditor!.play.setCameraMode("third-person"),
  );
  await page.keyboard.press("c");
  await page.evaluate(() => window.brickEditor!.play.stepTicks(60));
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: test.info().outputPath("train-desktop.png"),
  });
  // The interact key (E) gets off, like the Get off train action.
  await page.keyboard.press("e");
  await expect(page.locator(".play-status")).toContainText("Walking");
  expect((await trains(page)).riding).toBeFalsy();
  await expect(page.locator(".play-train-drawer")).toHaveCount(0);
  await page.evaluate(() => window.brickEditor!.play.exit());
  expect(errors).toEqual([]);
});

test("railway station on a phone held sideways: the train slab fits the HUD", async ({
  browser,
}) => {
  test.setTimeout(360000);
  const context = await browser.newContext({
    viewport: { width: 800, height: 360 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await load(page);
  await openMode(page, "Play");
  await page.getByRole("button", { name: "Enter Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible({
    timeout: 60000,
  });
  await dismissRotatePrompt(page);
  // Walk up to the locomotive: the action says what it does. Drive train
  // rides in the cab with the train's controls open.
  const loco = (await trains(page)).trains[0].position;
  await page.evaluate(
    (p) =>
      window.brickEditor!.play.teleport({
        position: [p[0], -0.3, p[2] - 120],
        policy: "safe",
      }),
    loco,
  );
  await page.getByRole("button", { name: "Drive train" }).tap();
  expect((await trains(page)).riding).toBe("train:1");
  await page.getByRole("button", { name: "Start the train" }).tap();
  await page.evaluate(() => window.brickEditor!.play.stepTicks(240));
  expect((await trains(page)).trains[0].odometer).toBeGreaterThan(500);
  // Chase view: the train fills the phone screen.
  await page.evaluate(() =>
    window.brickEditor!.play.setCameraMode("third-person"),
  );
  await page.evaluate(() => window.brickEditor!.play.stepTicks(60));
  await page.waitForTimeout(1500);
  const box = await page.locator(".play-train").boundingBox();
  expect(box!.width).toBeLessThanOrEqual(800 - 32);
  await expect(
    page.getByRole("button", { name: "Get off train" }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("train-phone-landscape.png"),
  });
  await page.evaluate(() => window.brickEditor!.play.exit());
  expect(errors).toEqual([]);
  await context.close();
});
