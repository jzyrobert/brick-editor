import { test, expect, type Page } from "@playwright/test";
import { openMenuTab, openMode, showAllTemplates } from "./helpers/mode";
import { refusePointerLock } from "./helpers/pointer";

/** A few-hundred-part build takes several seconds to compile and draw with
 * software WebGL on the test VM. */
const LOAD = 60000;
test.describe.configure({ timeout: 300000 });

const shots = "test-results/templates/";

type Sample =
  | "cafe"
  | "windmill"
  | "lighthouse"
  | "jeep"
  | "house"
  | "castle"
  | "car"
  | "playground"
  | "train";
/** Every sample: its title and part count. */
const SAMPLES: [Sample, string, number][] = [
  ["cafe", "Corner café", 358],
  ["windmill", "Windmill farm", 338],
  ["lighthouse", "Lighthouse", 269],
  ["jeep", "Off-road jeep", 80],
  ["house", "House with garden", 281],
  ["castle", "Small castle", 237],
  ["car", "Roadster", 58],
  ["playground", "Playground park", 110],
  ["train", "Railway station", 415],
];
/** Chooser cards in display order (the blank canvas last). */
const CARDS = [
  "Market town",
  "Cathedral",
  "Harbour",
  "Corner café",
  "Windmill farm",
  "Lighthouse",
  "Off-road jeep",
  "Railway station",
  "Playground park",
  "House with garden",
  "Small castle",
  "Roadster car",
  "Motor & gears",
  "Rack guide",
  "Blank canvas",
];

async function openTemplate(page: Page, template: Sample) {
  return page.evaluate(async (template) => {
    const a = window.brickEditor!;
    const imported = await a.project.import({ format: "template", template });
    // Strict: every part (curated or from the complete library) resolves
    // and renders; a missing definition fails.
    await a.ready({ minRevision: imported.revision, strict: true });
    const q = await a.query();
    const health = await a.health.check();
    return {
      unresolved: q.unresolvedReferenceIds.length,
      parts: q.occurrences.length,
      namespaces: [...new Set(q.occurrences.map((o) => o.namespace))],
      checks: Object.fromEntries(
        health.checks.map((c: { id: string; status: string }) => [
          c.id,
          c.status,
        ]),
      ),
    };
  }, template);
}

test("every sample loads strictly with every part resolved", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  for (const [name, title, parts] of SAMPLES) {
    const r = await openTemplate(page, name);
    await expect(page.getByLabel("Project title")).toHaveValue(title);
    expect(r, name).toMatchObject({
      unresolved: 0,
      parts,
      namespaces: ["official"],
    });
    expect(r.checks["missing-definitions"], name).toBe("ok");
    expect(r.checks.connectivity, name).toBe("ok");
    if (name !== "jeep" && name !== "car" && name !== "castle")
      expect(r.checks.collisions, name).toBe("ok");
  }
  expect(errors).toEqual([]);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
])
  test(`the chooser offers only the samples and opens them (${viewport.width}×${viewport.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("./?automation=1");
    await page.waitForFunction(() => !!window.brickEditor);
    await openMenuTab(page, "Project", "New");
    await showAllTemplates(page);
    const grid = page.locator(".template-grid");
    await expect(grid.locator(".template-card")).toHaveText(CARDS);
    for (const old of [
      "Courtyard studio",
      "Exploration room",
      "Door room",
      "Door & vehicle",
      "Open-bench vehicle",
      "Physics playground",
      "Simple wall",
      "200-part build",
    ])
      await expect(page.getByRole("button", { name: old })).toHaveCount(0);
    const card = page.getByRole("button", { name: "Corner café" });
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator("img")).toBeVisible();
    // The preview image loaded (not a broken image).
    await expect
      .poll(() =>
        card
          .locator("img")
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBe(320);
    await page.screenshot({
      path: `${shots}chooser-${viewport.width}.png`,
    });
    // An empty project has nothing to lose: no prompt.
    await card.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByLabel("Project title")).toHaveValue("Corner café", {
      timeout: LOAD,
    });
    await page.evaluate(() => window.brickEditor!.ready({ strict: true }));
    await page.screenshot({ path: `${shots}cafe-${viewport.width}.png` });
    const next: [string, string, string][] =
      viewport.width > 800
        ? [
            ["Windmill farm", "Windmill farm", "windmill"],
            ["Lighthouse", "Lighthouse", "lighthouse"],
            ["Off-road jeep", "Off-road jeep", "jeep"],
            ["Playground park", "Playground park", "playground"],
            ["House with garden", "House with garden", "house"],
            ["Small castle", "Small castle", "castle"],
            ["Roadster car", "Roadster", "car"],
          ]
        : [
            ["Lighthouse", "Lighthouse", "lighthouse"],
            ["Off-road jeep", "Off-road jeep", "jeep"],
          ];
    for (const [name, title, file] of next) {
      await openMenuTab(page, "Project", "New");
      await showAllTemplates(page);
      // The previous sample is untouched, so it is replaced without asking.
      await page.getByRole("button", { name }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByLabel("Project title")).toHaveValue(title, {
        timeout: LOAD,
      });
      await page.evaluate(() => window.brickEditor!.ready({ strict: true }));
      // A template just opened has nothing unsaved (it is autosaved for
      // recovery, so the state may already read "Saved").
      await expect(page.locator(".save-state")).toHaveText(
        /^(No changes|Saving…|Saved revision \d+)$/,
      );
      await page.screenshot({ path: `${shots}${file}-${viewport.width}.png` });
    }
  });

test("the jeep drives from its driver seat and the windmill's sails turn", async ({
  page,
}) => {
  await refusePointerLock(page);
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await openTemplate(page, "jeep");
  await openMode(page, "Play");
  await page.evaluate(() =>
    window.brickEditor!.play.enter({
      rigIds: ["jeep"],
      position: [-110, -0.3, -20],
      yaw: Math.PI / 2,
      realtime: false,
      cameraMode: "third-person",
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
  const drive = await page.evaluate(async () => {
    const a = window.brickEditor!;
    const seated = await a.play.snapshot();
    await a.play.setInput({ moveZ: 1 });
    const moved = await a.play.stepTicks(60);
    await a.play.setInput({});
    return { seated, moved };
  });
  expect(drive.seated.occupancy).toMatchObject({
    rigId: "jeep",
    seatId: "driver",
  });
  expect(drive.moved.mechanisms!.jeep.pose.vehicle!.position[2]).toBeLessThan(
    -100,
  );
  await page.screenshot({ path: `${shots}jeep-driving.png` });
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.play.exitVehicle();
    await a.play.exit();
  });

  await openTemplate(page, "windmill");
  await openMode(page, "Play");
  const sails = await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.play.enter({
      rigIds: ["windmill"],
      position: [0, -8.3, -200],
      realtime: false,
      cameraMode: "third-person",
    });
    const s = await a.play.stepTicks(60);
    return s.mechanisms!.windmill;
  });
  expect(sails.pose.jointPositions.axle).toBeGreaterThan(25);
  expect(sails.motors!.axle.status).toBe("running");
  await page.screenshot({ path: `${shots}windmill-play.png` });
  await page.evaluate(() => window.brickEditor!.play.exit());
});

test("the roadster drives in Play and the house door opens", async ({
  page,
}) => {
  await refusePointerLock(page);
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await openTemplate(page, "car");
  const drive = await page.evaluate(async () => {
    const a = window.brickEditor!;
    const entered = await a.play.enter({
      rigIds: ["car"],
      position: [200, -0.3, 0],
      realtime: false,
    });
    await a.play.setMechanismVehicleInput({ throttle: 1, steering: 0 }, "car");
    const straight = await a.play.stepTicks(60);
    await a.play.setMechanismVehicleInput({ throttle: 1, steering: 1 }, "car");
    const turned = await a.play.stepTicks(45);
    await a.play.exit();
    return { entered, straight, turned };
  });
  const car = drive.straight.mechanisms!.car;
  expect(car.pose.vehicle!.position[2]).toBeLessThan(-100);
  expect(car.pose.vehicle!.wheelAngles["left-front"]).toBeGreaterThan(180);
  expect(
    Math.abs(drive.turned.mechanisms!.car.pose.vehicle!.headingDegrees),
  ).toBeGreaterThan(15);

  await openTemplate(page, "house");
  await openMode(page, "Play");
  const entered = await page.evaluate(() =>
    window.brickEditor!.play.enter({
      // Within reach of the hinge (96 LDU) but outside the leaf's sweep.
      position: [-40, -0.3, -118],
      yaw: Math.PI,
      realtime: false,
      cameraMode: "third-person",
    }),
  );
  expect(entered.autoDoors!.doors).toHaveLength(1);
  expect(entered.autoDoors!.doors[0].part).toBe("60616a");
  expect(entered.autoDoors!.doors[0].swing).not.toBe("blocked");
  const open = page.getByRole("button", { name: "Open door" });
  await expect(open).toBeEnabled();
  await page.keyboard.press("e");
  const opened = await page.evaluate(async () => {
    const a = window.brickEditor!;
    return a.play.stepTicks(70);
  });
  expect(
    Math.abs(opened.mechanisms!["auto-door:0"].pose.jointPositions.door),
  ).toBe(90);
  await page.screenshot({ path: `${shots}house-door-open.png` });
  // Walk in through the open door.
  const inside = await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.play.setInput({ moveZ: 1, yaw: Math.PI });
    const s = await a.play.stepTicks(180);
    await a.play.setInput({});
    await a.play.exit();
    return s;
  });
  expect(inside.position[2]).toBeGreaterThan(0);
});
