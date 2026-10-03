import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openMode } from "./helpers/mode";
import { closeRemoteControls, openRemoteControls } from "./helpers/play";
import { refusePointerLock } from "./helpers/pointer";
const source = readFileSync(
  new URL("../../fixtures/ldraw/technic-motion.mpd", import.meta.url),
  "utf8",
);
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
      const loaded = await page.evaluate(async (source) => {
        const api = window.brickEditor!;
        await api.project.import({
          format: "ldraw",
          name: "technic-motion.mpd",
          text: source,
        });
        await api.ready({ strict: true });
        const q = await api.query();
        const proposal = await api.mechanisms.propose({
          id: "technic-drive",
          name: "Technic drive",
          expectedRevision: q.revision,
          frameOccurrenceIds: [0, 1, 10].map((i) => q.occurrences[i].id),
          motors: {
            [q.occurrences[2].id]: {
              mode: "velocity",
              target: 90,
              maxEffort: { value: 50, unit: "N*m" },
            },
          },
        });
        await api.dispatch({
          schemaVersion: 1,
          commandId: "save-controls-drive",
          expectedRevision: q.revision,
          type: "rigs.upsert",
          payload: { rig: proposal.rig! },
        });
        await api.ready({ strict: true });
        return { rig: proposal.rig!, query: await api.query() };
      }, source);
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
      await expect(
        page.getByLabel("Part control").locator("option"),
      ).toHaveCount(3); // One driver, two bearings; passive gear is feedback.
      const forward = page.getByRole("button", {
        name: "Hold motor 1 forward",
        exact: true,
      });
      await forward.scrollIntoViewIfNeeded();
      const touch =
        width === 1440 ? undefined : await context.newCDPSession(page);
      const down = async () => {
        const b = (await forward.boundingBox())!;
        if (width === 1440) {
          await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
          await page.mouse.down();
        } else {
          await touch!.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [
              { x: b.x + b.width / 2, y: b.y + b.height / 2, id: 1 },
            ],
          });
        }
      };
      const up = async () => {
        if (width === 1440) await page.mouse.up();
        else {
          await touch!.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
        }
      };
      await down();
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
      await up();
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
      await page.evaluate(() => window.brickEditor!.play.stepTicks(60));
      await forward.focus();
      await page.keyboard.down("Enter");
      expect(
        (await page.evaluate(() => window.brickEditor!.play.snapshot()))
          .mechanisms!["technic-drive"].motors![input].input,
      ).toBe(1);
      await page.keyboard.up("Enter");
      expect(
        (await page.evaluate(() => window.brickEditor!.play.snapshot()))
          .mechanisms!["technic-drive"].motors![input].input,
      ).toBe(0);
      // Stop held input on blur, cancellation and pause.
      await forward.focus();
      await page.keyboard.down("Enter");
      await page.getByRole("button", { name: "Brake motor" }).focus();
      await page.keyboard.up("Enter");
      expect(
        (await page.evaluate(() => window.brickEditor!.play.snapshot()))
          .mechanisms!["technic-drive"].motors![input].input,
      ).toBe(0);
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
      await page.getByRole("button", { name: "Pause", exact: true }).click();
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
      const headerBox = (await page.locator(".site-header").boundingBox())!;
      expect(topBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
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
