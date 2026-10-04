import { expect, test, type Page } from "@playwright/test";
import {
  MOTION_SAMPLES,
  type MotionSampleName,
} from "../../src/catalog/motion-sample-specs";
import { openMenuTab, openMode, showAllTemplates } from "./helpers/mode";
import { enterPlay, openRemoteControls } from "./helpers/play";
import { refusePointerLock } from "./helpers/pointer";

const cases = [
  {
    name: "motor-gears",
    ids: ["technic-drive"],
    rig: "technic-drive",
    driver: "joint-0",
    output: "joint-1",
  },
  {
    name: "rack-drive",
    ids: ["rack-drive"],
    rig: "rack-drive",
    driver: "joint-0",
    output: "joint-0",
  },
] as const;
async function documentState(page: Page) {
  return page.evaluate(async () => ({
    query: await window.brickEditor!.query(),
    source: Array.from(
      (await window.brickEditor!.project.export({ format: "ldraw" })).bytes,
    ),
  }));
}
async function choose(page: Page, name: MotionSampleName) {
  await openMenuTab(page, "Project", "New");
  await showAllTemplates(page);
  const card = page.getByRole("button", {
    name: MOTION_SAMPLES[name].title,
    exact: true,
  });
  await card.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      card.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBe(320);
  await card.click();
  await expect(page.getByLabel("Project title")).toHaveValue(
    MOTION_SAMPLES[name].title,
  );
  await page.evaluate(() => window.brickEditor!.ready({ strict: true }));
}
for (const phone of [false, true])
  for (const c of cases)
    test(`${c.name} chooser opens a working ${phone ? "phone" : "desktop"} mechanism`, async ({
      browser,
      baseURL,
    }, testInfo) => {
      const context = await browser.newContext({
          viewport: phone
            ? { width: 360, height: 600 }
            : { width: 1440, height: 1000 },
          hasTouch: phone,
          isMobile: phone,
        }),
        page = await context.newPage(),
        errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await refusePointerLock(page);
      try {
        await page.goto(`${baseURL}/?automation=1`);
        await page.waitForFunction(() => !!window.brickEditor);
        await choose(page, c.name);
        const before = await documentState(page);
        expect(before.query.unresolvedReferenceIds).toEqual([]);
        await openMode(page, "Play");
        await expect(
          page.getByText(MOTION_SAMPLES[c.name].hint, { exact: true }),
        ).toBeVisible();
        await enterPlay(page);
        await page.evaluate(
          async (ids) => {
            await window.brickEditor!.play.enter({
              rigIds: ids,
              dynamicRigIds: [],
              realtime: false,
              position: [300, -0.3, 300],
            });
          },
          [...c.ids],
        );
        await openRemoteControls(page);
        await expect(page.locator(".play-start-hint")).toHaveCount(0);
        const rest = await page.evaluate(() =>
          window.brickEditor!.play.snapshot(),
        );
        if (c.name === "motor-gears") {
          const forward = page.getByRole("button", {
            name: "Run motor 1 forward",
            exact: true,
          });
          const bounds = (await forward.boundingBox())!;
          expect(bounds.height).toBeGreaterThanOrEqual(44);
          expect(bounds.width).toBeGreaterThanOrEqual(44);
          await forward.focus();
          await page.keyboard.press("Enter");
          await page.evaluate(() => window.brickEditor!.play.stepTicks(120));
          await page
            .getByRole("button", { name: "Brake motor", exact: true })
            .click();
        } else {
          await page
            .getByLabel("Explore joint joint-0", { exact: true })
            .fill("-60");
          // Sliders submit the latest intent once per rendered frame. Wait for
          // that public target before advancing the deterministic simulation.
          await expect
            .poll(() =>
              page.evaluate(async (rigId) => {
                const snapshot = await window.brickEditor!.play.snapshot();
                return snapshot.mechanisms![rigId].jointTargets?.["joint-0"]
                  ?.target;
              }, c.rig),
            )
            .toBe(-60);
          await page.evaluate(() => window.brickEditor!.play.stepTicks(120));
        }
        const moved = await page.evaluate(() =>
            window.brickEditor!.play.snapshot(),
          ),
          m = moved.mechanisms![c.rig],
          r = rest.mechanisms![c.rig];
        expect(
          Math.abs(
            m.pose.jointPositions[c.driver] - r.pose.jointPositions[c.driver],
          ),
        ).toBeGreaterThan(10);
        if (c.name === "motor-gears") {
          expect(m.motors![c.driver].input).toBe(0);
          expect(
            Math.abs(
              m.pose.jointPositions[c.output] - r.pose.jointPositions[c.output],
            ),
          ).toBeGreaterThan(1);
        }
        expect(
          (await page.evaluate(() => window.brickEditor!.play.view()))
            .mechanismOverview,
        ).toBe(c.rig);
        await page.screenshot({
          path: testInfo.outputPath(
            `${c.name}-${phone ? "phone" : "desktop"}.png`,
          ),
        });
        await page.evaluate(() => window.brickEditor!.play.exit());
        expect(await documentState(page)).toEqual(before);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });

test("motion chooser cards remain readable and inside all supported screens", async ({
  page,
}, testInfo) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  for (const [width, height] of [
    [1440, 1000],
    [1080, 1800],
    [360, 600],
    [411, 685],
    [390, 844],
    [686, 411],
  ]) {
    await page.setViewportSize({ width, height });
    await openMenuTab(page, "Project", "New");
    await showAllTemplates(page);
    for (const name of Object.keys(MOTION_SAMPLES) as MotionSampleName[]) {
      const card = page.getByRole("button", {
        name: MOTION_SAMPLES[name].title,
        exact: true,
      });
      await card.scrollIntoViewIfNeeded();
      const b = (await card.boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(width + 1);
      expect(b.height).toBeGreaterThanOrEqual(44);
      await expect
        .poll(() =>
          card
            .locator("img")
            .evaluate((img: HTMLImageElement) => img.naturalWidth),
        )
        .toBe(320);
    }
    await page.screenshot({
      path: testInfo.outputPath(`motion-chooser-${width}.png`),
    });
  }
});

test("all motion samples open and move from a freshly installed offline snapshot", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await refusePointerLock(page);
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await openMenuTab(page, "Project", "Settings");
  await page
    .getByRole("button", { name: "Download / check for updates", exact: true })
    .click();
  await expect(page.getByText(/Ready offline\./)).toBeVisible({
    timeout: 60000,
  });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => !!window.brickEditor);
  for (const c of cases) {
    await choose(page, c.name);
    const before = await documentState(page);
    await page.evaluate(async (c) => {
      const api = window.brickEditor!;
      await api.play.enter({
        rigIds: [...c.ids],
        dynamicRigIds: [],
        realtime: false,
        position: [300, -0.3, 300],
      });
      await api.play.setJointTarget({
        rigId: c.rig,
        jointId: c.driver,
        target: c.name === "motor-gears" ? 30 : -60,
        speed: 60,
      });
      await api.play.stepTicks(180);
    }, c);
    const moved = await page.evaluate(() =>
      window.brickEditor!.play.snapshot(),
    );
    expect(
      Math.abs(moved.mechanisms![c.rig].pose.jointPositions[c.driver]),
    ).toBeGreaterThan(15);
    await page.evaluate(() => window.brickEditor!.play.exit());
    expect(await documentState(page)).toEqual(before);
  }
  expect(errors).toEqual([]);
});
