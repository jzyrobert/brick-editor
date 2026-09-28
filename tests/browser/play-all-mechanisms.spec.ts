import { test, expect } from "@playwright/test";
import { openMode } from "./helpers/mode";
for (const width of [360, 1080, 1440]) {
  test(`all mechanisms default and separated remote controls at ${width}px`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
        viewport: {
          width,
          height: width === 360 ? 800 : width === 1080 ? 1800 : 1000,
        },
        hasTouch: width !== 1440,
      }),
      page = await context.newPage(),
      errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(`${baseURL}/?automation=1`);
      await page.waitForFunction(() => !!window.brickEditor);
      await page.evaluate(async () => {
        await window.brickEditor!.project.import({
          format: "template",
          template: "mechanisms",
        });
        await window.brickEditor!.ready();
      });
      const before = await page.evaluate(() => window.brickEditor!.query());
      await openMode(page, "Play");
      await expect(
        page.getByLabel("Explore with mechanism").locator("option:checked"),
      ).toHaveText("All mechanisms (2)");
      await page
        .getByRole("button", { name: "Enter Play", exact: true })
        .click();
      await expect(page.locator(".play-overlay")).toBeVisible({
        timeout: 20000,
      });
      await expect
        .poll(() =>
          page.evaluate(async () =>
            Object.keys(
              (await window.brickEditor!.play.snapshot()).mechanisms ?? {},
            ).sort(),
          ),
        )
        .toEqual(["door", "vehicle"]);
      await page.evaluate(() =>
        window.brickEditor!.play.teleport({
          position: [20, -0.3, 45],
          policy: "safe",
        }),
      );
      const action = page.getByRole("button", { name: "Open joint" });
      await expect(action).toBeEnabled();
      await action.click();
      await expect
        .poll(() =>
          page.evaluate(
            async () =>
              (await window.brickEditor!.play.snapshot()).mechanisms!.door.pose
                .jointPositions.hinge,
          ),
        )
        .toBeGreaterThan(90);
      await page
        .getByText("Remote mechanism controls", { exact: true })
        .click();
      await expect(page.locator(".play-interaction")).toHaveCount(0);
      const remote = page.locator(".play-mechanism"),
        stick = page.getByRole("group", {
          name: "Movement joystick",
          exact: true,
        });
      const panelBox = await remote.boundingBox(),
        stickBox = await stick.boundingBox();
      expect(
        panelBox && stickBox && panelBox.y + panelBox.height <= stickBox.y - 8,
      ).toBe(true);
      await expect(stick).toBeVisible();
      await page
        .getByRole("combobox", { name: "Remote mechanism", exact: true })
        .selectOption("vehicle");
      const drive = page.getByRole("button", {
        name: "Hold forward",
        exact: true,
      });
      await drive.scrollIntoViewIfNeeded();
      const start = await page.evaluate(
        async () =>
          (await window.brickEditor!.play.snapshot()).mechanisms!.vehicle.pose
            .vehicle!.position,
      );
      const box = (await drive.boundingBox())!;
      if (width !== 1440) {
        const cdp = await context.newCDPSession(page);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [
            { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 10 },
          ],
        });
        await page.waitForTimeout(300);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await cdp.detach();
      } else {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(300);
        await page.mouse.up();
      }
      const driven = await page.evaluate(() =>
        window.brickEditor!.play.snapshot(),
      );
      expect(driven.mechanisms!.vehicle.pose.vehicle!.position[2]).toBeLessThan(
        start[2] - 10,
      );
      expect(driven.mechanisms!.door.pose.jointPositions.hinge).toBeGreaterThan(
        90,
      );
      await page.waitForTimeout(150);
      expect(
        (await page.evaluate(() => window.brickEditor!.play.snapshot()))
          .mechanisms!.vehicle.pose.vehicle!.position,
      ).toEqual(driven.mechanisms!.vehicle.pose.vehicle!.position);
      await page
        .getByRole("button", { name: "Back to nearby actions", exact: true })
        .click();
      await expect(page.locator(".play-interaction")).toBeVisible();
      await expect(remote).not.toHaveAttribute("open", "");
      await page.evaluate(async () => {
        const api = window.brickEditor!,
          report = await api.play.snapshot(),
          frame = report.mechanisms!.vehicle.groupFrames.chassis;
        return api.play.teleport({
          position: [frame.position[0], -0.3, frame.position[2] + 60],
          policy: "safe",
        });
      });
      await page.getByRole("button", { name: "Control vehicle" }).click();
      await expect(
        page.getByRole("button", { name: "Release vehicle" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Release vehicle" }).click();
      await page.evaluate(() => window.brickEditor!.play.exit());
      expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
        before,
      );
      await page.getByLabel("Explore with mechanism").selectOption("");
      await page
        .getByRole("button", { name: "Enter Play", exact: true })
        .click();
      await expect(page.locator(".play-overlay")).toBeVisible({
        timeout: 20000,
      });
      await expect
        .poll(() =>
          page.evaluate(
            async () =>
              Object.keys(
                (await window.brickEditor!.play.snapshot()).mechanisms ?? {},
              ).length,
          ),
        )
        .toBe(0);
      await expect(page.locator(".play-mechanism")).toHaveCount(0);
      await page.evaluate(() => window.brickEditor!.play.exit());
      expect(errors).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
    } finally {
      await context.close();
    }
  });
}
