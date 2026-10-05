import { expect, test } from "@playwright/test";
import { realMotorFixture } from "./helpers/real-mechanisms";
import { openMode } from "./helpers/mode";
import { closeRemoteControls, openRemoteControls } from "./helpers/play";
import { refusePointerLock } from "./helpers/pointer";
const fixture = realMotorFixture();
const sizes = [
  [1440, 1000, false],
  [1080, 1800, false],
  [360, 600, false],
  [411, 685, false],
  [390, 844, false],
  [686, 411, false],
  [360, 600, true],
] as const;
for (const [width, height, dynamic] of sizes)
  test(`whole-mechanism controls ${width}×${height} ${dynamic ? "dynamic" : "kinematic"}`, async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(120000);
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: width !== 1440,
    });
    const page = await context.newPage(),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await refusePointerLock(page);
    try {
      await page.goto(`${baseURL}/?automation=1`);
      await page.waitForFunction(() => !!window.brickEditor);
      const loaded = await page.evaluate(async ({ bytes, rig }) => {
        const api = window.brickEditor!;
        await api.project.import({ format: "native", bytes });
        await api.ready({ strict: true });
        return { rig, query: await api.query() };
      }, fixture);
      const input = loaded.rig.transmissions![0].jointA,
        output = loaded.rig.transmissions![0].jointB;
      await openMode(page, "Play");
      await page.evaluate(async (dynamic) => {
        await window.brickEditor!.play.enter({
          rigIds: ["technic-drive"],
          ...(dynamic ? { dynamicRigIds: ["technic-drive"] } : {}),
          position: [200, -0.3, 200],
          realtime: false,
        });
        // Settle the explorer's normal floor offset before comparing views.
        await window.brickEditor!.play.stepTicks(60);
      }, dynamic);
      const explorer = await page.evaluate(async () => ({
        report: await window.brickEditor!.play.snapshot(),
        view: await window.brickEditor!.play.view(),
      }));
      await openRemoteControls(page);
      await expect(
        page.getByRole("group", { name: "Movement joystick", exact: true }),
      ).toHaveCount(0);
      await expect(page.locator(".play-interaction")).toHaveCount(0);
      expect(
        (await page.evaluate(() => window.brickEditor!.play.view()))
          .mechanismOverview,
      ).toBe("technic-drive");
      // One source-backed driver needs no redundant part picker; the gear is feedback.
      await expect(page.getByLabel("Part control")).toHaveCount(0);
      const forward = page.getByRole("button", {
        name: "Run motor 1 forward",
        exact: true,
      });
      const reverse = page.getByRole("button", {
        name: "Run motor 1 reverse",
        exact: true,
      });
      const brake = page.getByRole("button", {
        name: "Brake motor",
        exact: true,
      });
      const speed = page.getByLabel("Motor 1 power", { exact: true });
      await expect(speed).toBeVisible();
      await speed.fill("0.25");
      await forward.click();
      await expect
        .poll(() =>
          page.evaluate(
            async (j) =>
              (await window.brickEditor!.play.snapshot()).mechanisms![
                "technic-drive"
              ].motors![j].input,
            input,
          ),
        )
        .toBe(0.25);
      await page.evaluate(() => window.brickEditor!.play.stepTicks(120));
      const slow = await page.evaluate(() =>
        window.brickEditor!.play.snapshot(),
      );
      expect(
        slow.mechanisms!["technic-drive"].pose.jointPositions[input],
      ).toBeGreaterThan(20);
      await speed.fill("1");
      await expect
        .poll(() =>
          page.evaluate(
            async (j) =>
              (await window.brickEditor!.play.snapshot()).mechanisms![
                "technic-drive"
              ].motors![j].input,
            input,
          ),
        )
        .toBe(1);
      await page.evaluate(() => window.brickEditor!.play.stepTicks(120));
      await brake.click();
      const driven = await page.evaluate(() =>
        window.brickEditor!.play.snapshot(),
      );
      expect(driven.position[0]).toBe(explorer.report.position[0]);
      expect(driven.position[2]).toBe(explorer.report.position[2]);
      expect(driven.position[1]).toBeCloseTo(explorer.report.position[1], 1);
      const mechanism = driven.mechanisms!["technic-drive"];
      expect(mechanism.pose.jointPositions[input]).toBeGreaterThan(90);
      expect(mechanism.pose.jointPositions[output]).toBeCloseTo(
        -mechanism.pose.jointPositions[input] / 3,
        0,
      );
      expect(mechanism.motors![input].input).toBe(0);
      await reverse.click();
      await page.evaluate(() => window.brickEditor!.play.stepTicks(60));
      const reversed = await page.evaluate(() =>
        window.brickEditor!.play.snapshot(),
      );
      expect(
        reversed.mechanisms!["technic-drive"].pose.jointPositions[input],
      ).toBeLessThan(mechanism.pose.jointPositions[input] - 20);
      // Zero power removes powered drive without losing the selected direction.
      await speed.fill("0");
      const unpowered = (
        await page.evaluate(() => window.brickEditor!.play.snapshot())
      ).mechanisms!["technic-drive"].motors![input];
      // Reverse multiplied by zero is IEEE -0, which commands the same stop.
      expect(Math.abs(unpowered.input!)).toBe(0);
      expect(unpowered).toMatchObject({ power: 0, status: "stopped" });
      await speed.fill("0.5");
      expect(
        (await page.evaluate(() => window.brickEditor!.play.snapshot()))
          .mechanisms!["technic-drive"].motors![input],
      ).toMatchObject({ input: -0.5, power: 0.5 });
      await brake.click();
      await speed.fill("1");
      // Keyboard activation latches just like a tap, until an explicit brake.
      await forward.focus();
      await page.keyboard.press("Enter");
      expect(
        (await page.evaluate(() => window.brickEditor!.play.snapshot()))
          .mechanisms!["technic-drive"].motors![input].input,
      ).toBe(1);
      await brake.focus();
      await page.keyboard.press("Space");
      expect(
        (await page.evaluate(() => window.brickEditor!.play.snapshot()))
          .mechanisms!["technic-drive"].motors![input].input,
      ).toBe(0);
      await forward.click();
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      expect(
        (await page.evaluate(() => window.brickEditor!.play.snapshot()))
          .mechanisms!["technic-drive"].motors![input].input,
      ).toBe(0);
      await page.getByRole("button", { name: "Resume", exact: true }).click();
      await page
        .locator(".play-mechanism-content")
        .evaluate((el) => (el.scrollTop = 0));
      const overview = await page.evaluate(() =>
        window.brickEditor!.play.view(),
      );
      const camera = overview.camera;
      expect(camera.position).not.toEqual(explorer.view.camera.position);
      const panel = page.locator(".play-mechanism");
      const lookBox = (await page.locator(".play-look").boundingBox())!,
        topBox = (await page.locator(".play-top").boundingBox())!,
        panelBox = (await panel.boundingBox())!;
      // The new site header shifts the canvas. Drag in the actual clear world
      // between the HUD and portrait sheet rather than at an old page offset.
      const orbitY =
        height > 500 && width <= 600
          ? (topBox.y + topBox.height + panelBox.y) / 2
          : lookBox.y + lookBox.height * 0.4;
      await page.mouse.move(80, orbitY);
      await page.mouse.down();
      await page.mouse.move(120, orbitY + 20);
      await page.mouse.up();
      const orbited = await page.evaluate(() =>
        window.brickEditor!.play.view(),
      );
      expect(orbited.camera.position).not.toEqual(camera.position);
      await page.evaluate(() => window.brickEditor!.play.zoomCamera(1.5));
      await page
        .getByRole("button", { name: "Fit build", exact: true })
        .click();
      await forward.click();
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      expect(
        (await page.evaluate(() => window.brickEditor!.play.snapshot()))
          .mechanisms!["technic-drive"].motors![input].input,
      ).toBe(0);
      expect(
        (await page.evaluate(() => window.brickEditor!.play.view()))
          .mechanismOverview,
      ).toBe("technic-drive");
      await expect(panel).toBeHidden();
      await expect(
        page.getByRole("button", { name: "First person", exact: true }),
      ).toHaveCount(0);
      await page.getByRole("button", { name: "Resume", exact: true }).click();
      await expect(panel).toBeVisible();
      const scroller = panel.locator(".play-mechanism-content");
      const overflow = await scroller.evaluate(
        (el) => el.scrollHeight > el.clientHeight + 2,
      );
      const cue = panel.getByText("Scroll for more controls", { exact: true });
      if (overflow) {
        await expect(cue).toBeVisible();
        const cueBox = (await cue.boundingBox())!,
          panelBox = (await panel.boundingBox())!;
        expect(cueBox.y + cueBox.height).toBeLessThanOrEqual(
          panelBox.y + panelBox.height,
        );
        const feedback = (await panel
          .locator(".play-drive-feedback")
          .boundingBox())!;
        expect(feedback.y + feedback.height).toBeLessThanOrEqual(cueBox.y);
        await scroller.evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        await expect(cue).toHaveCount(0);
        const linked = panel.getByText("Linked outputs (1)", { exact: true });
        const linkedBox = (await linked.boundingBox())!;
        expect(linkedBox.y + linkedBox.height).toBeLessThanOrEqual(
          panelBox.y + panelBox.height,
        );
        await scroller.evaluate((el) => {
          el.scrollTop = 0;
        });
        await expect(cue).toBeVisible();
      } else await expect(cue).toHaveCount(0);
      await page.screenshot({
        path: `.impeccable/review/mechanism-${width}x${height}-${dynamic ? "dynamic" : "kinematic"}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
      const metrics = await panel.evaluate((el) => ({
        box: el.getBoundingClientRect().toJSON(),
        buttons: [...el.querySelectorAll("button")]
          .filter((e) => e.getBoundingClientRect().height > 0)
          .map((e) => ({
            label: e.textContent,
            box: e.getBoundingClientRect().toJSON(),
          })),
      }));
      const toolsBox = (await page
          .getByRole("button", { name: "Model tools", exact: true })
          .boundingBox())!,
        statusBox = (await page.locator(".play-status-slab").boundingBox())!,
        pauseBox = (await page
          .getByRole("button", { name: "Pause", exact: true })
          .boundingBox())!;
      expect(statusBox.x + statusBox.width).toBeLessThanOrEqual(toolsBox.x - 7);
      expect(pauseBox.width).toBeGreaterThanOrEqual(44);
      expect(pauseBox.height).toBeGreaterThanOrEqual(44);
      // Phones on their side hide the site header for Play; otherwise the
      // Play bar starts below it.
      const headerBox = await page.locator(".site-header").boundingBox();
      expect(topBox.y).toBeGreaterThanOrEqual(
        headerBox ? headerBox.y + headerBox.height : 0,
      );
      expect(metrics.box.y + metrics.box.height).toBeLessThanOrEqual(height);
      for (const button of metrics.buttons) {
        expect(button.box.height).toBeGreaterThanOrEqual(44);
        expect(button.box.width).toBeGreaterThanOrEqual(44);
      }
      await closeRemoteControls(page);
      const returned = await page.evaluate(() =>
        window.brickEditor!.play.view(),
      );
      expect(returned.mechanismOverview).toBeUndefined();
      const restored = await page.evaluate(() =>
        window.brickEditor!.play.snapshot(),
      );
      expect(restored.yaw).toBe(explorer.report.yaw);
      expect(restored.pitch).toBe(explorer.report.pitch);
      for (let axis = 0; axis < 3; axis++) {
        const floorSettling =
          restored.position[axis] - explorer.report.position[axis];
        // Floor presentation eases independently of the capsule's reported feet.
        expect(returned.camera.position[axis]).toBeCloseTo(
          explorer.view.camera.position[axis] + floorSettling,
          axis === 1 ? 1 : 6,
        );
        expect(returned.camera.target[axis]).toBeCloseTo(
          explorer.view.camera.target[axis] + floorSettling,
          axis === 1 ? 1 : 6,
        );
      }
      await expect(
        page.getByRole("group", { name: "Movement joystick", exact: true }),
      ).toBeVisible();
      await page.evaluate(() => window.brickEditor!.play.exit());
      expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
        loaded.query,
      );
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
