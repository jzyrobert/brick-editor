import { expect, test } from "@playwright/test";
import { openMode } from "./helpers/mode";
import { openRemoteControls } from "./helpers/play";
import { refusePointerLock } from "./helpers/pointer";
import { mountedMotorFixture } from "./helpers/physical-fixtures";

for (const kind of ["real gearbox"] as const)
  for (const dynamic of [false, true])
    test(`${kind} controls expose the driver and preserve passive motion (${dynamic ? "dynamic phone" : "kinematic desktop"})`, async ({
      browser,
      baseURL,
    }) => {
      test.setTimeout(120000);
      const { rig, bytes } = mountedMotorFixture(),
        driver = rig.joints.find((j) => j.motor)!,
        passive = rig.joints.find((j) => !j.motor)!;
      const context = await browser.newContext({
        viewport: dynamic
          ? { width: 360, height: 600 }
          : { width: 1440, height: 1000 },
        hasTouch: dynamic,
      });
      const page = await context.newPage();
      await refusePointerLock(page);
      try {
        await page.goto(`${baseURL}/?automation=1`);
        await page.waitForFunction(() => !!window.brickEditor);
        await page.evaluate(async (bytes) => {
          await window.brickEditor!.project.import({
            format: "native",
            bytes,
          });
          await window.brickEditor!.ready({ strict: true });
        }, bytes);
        const before = await page.evaluate(() => window.brickEditor!.query());
        await openMode(page, "Play");
        await page.evaluate(
          async ({ id, dynamic }) => {
            await window.brickEditor!.play.enter({
              rigIds: [id],
              dynamicRigIds: dynamic ? [id] : [],
              realtime: false,
              position: [200, -0.3, 200],
            });
          },
          { id: rig.id, dynamic },
        );
        await openRemoteControls(page);
        await expect(
          page.getByLabel("Part control", { exact: true }),
        ).toHaveCount(0);
        await expect(
          page.getByLabel(`Explore joint ${passive.id}`, { exact: true }),
        ).toHaveCount(0);
        const rest = await page.evaluate(() =>
          window.brickEditor!.play.snapshot(),
        );
        const forward = page.getByRole("button", {
          name: "Run motor 1 forward",
          exact: true,
        });
        await forward.focus();
        await page.keyboard.press("Enter");
        await page.evaluate(() => window.brickEditor!.play.stepTicks(120));
        await page
          .getByRole("button", { name: "Brake motor", exact: true })
          .click();
        const moved = await page.evaluate(() =>
          window.brickEditor!.play.snapshot(),
        );
        expect(moved.mechanisms![rig.id].motors![driver.id].input).toBe(0);
        expect(
          Math.abs(
            moved.mechanisms![rig.id].pose.jointPositions[driver.id] -
              rest.mechanisms![rig.id].pose.jointPositions[driver.id],
          ),
        ).toBeGreaterThan(10);
        expect(
          Math.abs(
            moved.mechanisms![rig.id].pose.jointPositions[passive.id] -
              rest.mechanisms![rig.id].pose.jointPositions[passive.id],
          ),
        ).toBeGreaterThan(1);
        await page.getByText("Linked outputs (1)", { exact: true }).click();
        await expect(page.locator(".play-output-details")).toContainText(
          "0.33× speed · opposite direction",
        );
        expect(
          (await page.evaluate(() => window.brickEditor!.play.view()))
            .mechanismOverview,
        ).toBe(rig.id);
        await page.evaluate(() => window.brickEditor!.play.exit());
        expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
          before,
        );
      } finally {
        await context.close();
      }
    });
