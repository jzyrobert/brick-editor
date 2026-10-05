import { expect, test, type Page } from "@playwright/test";
import { openMode } from "./helpers/mode";
import { enterPlay, exitPlay } from "./helpers/play";

/**
 * A micro-scale test build (no doors, about four bricks high, 1,300 LDU
 * wide): an arch whose opening is two bricks (48 LDU) high, too low for a
 * minifigure, and a two-brick wall that a 3× explorer steps over.
 */
const brick = (colour: number, x: number, y: number, z: number, part: string) =>
  `1 ${colour} ${x} ${y} ${z} 1 0 0 0 1 0 0 0 1 ${part}`;
const MICRO = [
  "0 FILE micro-town.ldr",
  "0 Micro town test",
  "0 Name: micro-town.ldr",
  "0 Author: Brick Editor tests",
  // The arch: two 2 × 2 pillars two bricks high and a 2 × 8 plate lintel.
  brick(4, -50, -24, 0, "3003.dat"),
  brick(4, -50, -48, 0, "3003.dat"),
  brick(4, 50, -24, 0, "3003.dat"),
  brick(4, 50, -48, 0, "3003.dat"),
  brick(71, 0, -56, 0, "3034.dat"),
  // A low wall two bricks high, well away from the arch.
  ...[880, 960, 1040, 1120].flatMap((x) => [
    brick(15, x, -24, 0, "3001.dat"),
    brick(15, x, -48, 0, "3001.dat"),
  ]),
  // Micro houses four bricks high at the town's edges.
  ...[-300, 600].flatMap((x) =>
    [-24, -48, -72, -96].map((y) => brick(1, x, y, 300, "3003.dat")),
  ),
  "",
].join("\n");

async function importMicro(page: Page) {
  await page.evaluate(async (text) => {
    await window.brickEditor!.project.import({
      format: "ldraw",
      text,
      name: "micro-town.ldr",
    });
    await window.brickEditor!.ready();
  }, MICRO);
}

/** Walks forward (−Z at yaw 0) from `from` for `ticks` fixed ticks. */
async function walk(
  page: Page,
  scale: number,
  from: [number, number, number],
  ticks: number,
) {
  return page.evaluate(
    async ({ scale, from, ticks }) => {
      const play = window.brickEditor!.play;
      await play.setInput({});
      // Move first, then resize in the open (growing needs room).
      await play.teleport({ position: from, yaw: 0, pitch: 0 });
      await play.setPlayerScale(scale);
      await play.stepTicks(5);
      await play.setInput({ moveZ: 1 });
      await play.stepTicks(ticks);
      await play.setInput({});
      const report = await play.snapshot();
      return { z: report.position[2], scale: report.playerScale };
    },
    { scale, from, ticks },
  );
}

test("a tiny explorer walks through a micro-scale arch a minifigure cannot, and a big one steps over a wall", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await importMicro(page);
  const entered = await page.evaluate(() =>
    window.brickEditor!.play.enter({
      playerScale: 0.25,
      position: [0, -0.3, 90],
      yaw: 0,
    }),
  );
  expect(entered.playerScale).toBe(0.25);
  expect(entered.profile.height).toBeCloseTo(26, 6);
  expect(entered.collisionReady).toBe(true);
  // Tiny (26 LDU tall) passes under the 48 LDU lintel …
  const tiny = await walk(page, 0.25, [0, -0.3, 90], 600);
  expect(tiny.z).toBeLessThan(-60);
  // … a minifigure (104 LDU) is stopped at its face.
  const minifig = await walk(page, 1, [0, -0.3, 90], 240);
  expect(minifig.z).toBeGreaterThan(20);
  // A 3× explorer steps over the two-brick wall; a minifigure cannot.
  const big = await walk(page, 3, [1000, -0.3, 160], 120);
  expect(big.z).toBeLessThan(-80);
  const blocked = await walk(page, 1, [1000, -0.3, 120], 120);
  expect(blocked.z).toBeGreaterThan(20);
  // Seats and train cabs keep minifigure size: none here, but the size
  // change is refused while not on foot only (API contract checked in units).
  expect(errors).toEqual([]);
});

for (const viewport of [
  { width: 1440, height: 1000, touch: false },
  { width: 390, height: 844, touch: true },
])
  test(`Player size is suggested in Play settings and changes live at ${viewport.width}px`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        hasTouch: viewport.touch,
      }),
      page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.goto(`${baseURL}/?automation=1`);
      await page.waitForFunction(() => !!window.brickEditor);
      await importMicro(page);
      await openMode(page, "Play");
      const menu = page.locator(".mode-card.play-intro");
      await expect(menu).toBeVisible();
      await menu.getByRole("tab", { name: "Size", exact: true }).click();
      const sizes = menu.getByRole("group", { name: "Player size" });
      const tiny = sizes.getByRole("button", { name: /^Tiny/ });
      await expect(tiny).toContainText("Suggested");
      await expect(
        sizes.getByRole("button", { name: "Minifigure", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      // Every size control is a comfortable touch target.
      for (const button of await sizes.getByRole("button").all()) {
        const box = (await button.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      await menu.getByRole("button", { name: "Use Tiny", exact: true }).click();
      await expect(tiny).toHaveAttribute("aria-pressed", "true");
      await expect(menu.getByText("¼ × a minifigure")).toBeVisible();
      await enterPlay(page);
      await expect
        .poll(() =>
          page.evaluate(() =>
            window.brickEditor!.play.snapshot().then((r) => r.playerScale),
          ),
        )
        .toBe(0.25);
      // Pause: the size can change live from the pause sheet.
      // On desktop the API pauses: headless Playwright reports the site
      // header intercepting the Pause button at 1440 × 1000 (also at
      // minifigure size on a blank build; unrelated to player size).
      if (viewport.touch)
        await page.getByRole("button", { name: "Pause", exact: true }).click();
      else await page.evaluate(() => window.brickEditor!.play.pause(true));
      await page.getByText("Player size · Tiny", { exact: true }).click();
      const live = page
        .locator(".play-menu")
        .getByRole("group", { name: "Player size" });
      await live.getByRole("button", { name: /^Giant/ }).click();
      await expect
        .poll(() =>
          page.evaluate(() =>
            window.brickEditor!.play.snapshot().then((r) => r.playerScale),
          ),
        )
        .toBe(8);
      await expect(page.getByText("Player size · Giant")).toBeVisible();
      // The pause sheet fits the viewport without sideways scrolling.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await exitPlay(page);
      // The chosen size is kept for the next entry and said on the dock.
      await expect(page.locator(".play-entry")).toContainText(/Giant size/);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("a giant takes the roadster's controls from further away, drives with the pads and steps out", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    }),
    page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(`${baseURL}/?automation=1`);
    await page.waitForFunction(() => !!window.brickEditor);
    await page.evaluate(async () => {
      await window.brickEditor!.project.import({
        format: "template",
        template: "car",
      });
      await window.brickEditor!.ready();
    });
    await openMode(page, "Play");
    // 300 LDU from the car: beyond a minifigure's reach, within a giant's.
    const enterAt = (playerScale: number) =>
      page.evaluate(async (playerScale) => {
        await window.brickEditor!.play.exit();
        return window.brickEditor!.play.enter({
          rigIds: ["car"],
          playerScale,
          position: [-300, -0.3, 40],
          yaw: Math.PI / 2,
          realtime: false,
        });
      }, playerScale);
    const getIn = page.getByRole("button", { name: "Get in", exact: true });
    await enterAt(1);
    await page.evaluate(() => window.brickEditor!.play.stepTicks(2));
    await expect(getIn).toHaveCount(0);
    await enterAt(8);
    await page.evaluate(() => window.brickEditor!.play.stepTicks(2));
    await expect(getIn).toBeEnabled();
    await getIn.click();
    await expect(
      page.getByRole("button", { name: "Get out", exact: true }),
    ).toBeVisible();
    // The throttle and steering pads are there and usable at any size.
    for (const name of [
      "Throttle: forward and back",
      "Steering: left and right",
    ])
      await expect(page.getByRole("group", { name })).toBeVisible();
    const before = await page.evaluate(() =>
      window.brickEditor!.play.snapshot(),
    );
    const throttle = (await page
      .getByRole("group", { name: "Throttle: forward and back" })
      .boundingBox())!;
    // Hold the throttle pad towards its top end for a second.
    await page.mouse.move(
      throttle.x + throttle.width / 2,
      throttle.y + throttle.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(throttle.x + throttle.width / 2, throttle.y + 4);
    await page.evaluate(() => window.brickEditor!.play.stepTicks(60));
    await page.mouse.up();
    const driven = await page.evaluate(() =>
      window.brickEditor!.play.snapshot(),
    );
    expect(driven.vehicleControl).toEqual({ rigId: "car" });
    expect(driven.playerScale).toBe(8);
    const moved = Math.hypot(
      ...[0, 2].map(
        (k) =>
          driven.mechanisms!.car.pose.vehicle!.position[k] -
          before.mechanisms!.car.pose.vehicle!.position[k],
      ),
    );
    expect(moved).toBeGreaterThan(20);
    await page.getByRole("button", { name: "Get out", exact: true }).click();
    const out = await page.evaluate(() => window.brickEditor!.play.snapshot());
    expect(out.vehicleControl).toBeUndefined();
    expect(out.positionAnchor).toBe("standing-feet");
    expect(out.playerScale).toBe(8);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
