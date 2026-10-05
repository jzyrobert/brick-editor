import { expect, test } from "@playwright/test";
import { openMode } from "./helpers/mode";
import { closeRemoteControls, openRemoteControls } from "./helpers/play";
import { refusePointerLock } from "./helpers/pointer";
import { nativeContents } from "./helpers/physical-play-policy";

for (const phone of [false, true])
  for (const dynamic of [false, true])
    test(`twin motor table keeps independent power and direction ${phone ? "phone" : "desktop"} ${dynamic ? "Dynamic" : "Kinematic"}`, async ({
      browser,
      baseURL,
    }, testInfo) => {
      test.setTimeout(180000);
      const context = await browser.newContext({
        viewport: phone
          ? { width: 360, height: 600 }
          : { width: 1440, height: 1000 },
        hasTouch: phone,
        isMobile: phone,
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await refusePointerLock(page);
      try {
        await page.goto(`${baseURL}/?automation=1`);
        await page.waitForFunction(() => !!window.brickEditor);
        const before = await page.evaluate(async () => {
          const api = window.brickEditor!;
          await api.project.import({
            format: "template",
            template: "twin-drive",
          });
          await api.ready({ strict: true });
          return {
            query: await api.query(),
            source: Array.from(
              (await api.project.export({ format: "ldraw" })).bytes,
            ),
            native: Array.from(
              (await api.project.export({ format: "native" })).bytes,
            ),
            inventory: await api.inventory.preview({
              expectedRevision: (await api.query()).revision,
              scope: { kind: "all" },
              format: "bricklink-wanted-xml",
              acceptDerivedMappings: true,
              acceptUnknownColors: true,
              errorPolicy: "export-resolved",
            }),
          };
        });
        await openMode(page, "Play");
        await page.evaluate(async (dynamic) => {
          const play = window.brickEditor!.play;
          await play.enter({
            rigIds: ["twin-drive"],
            dynamicRigIds: dynamic ? ["twin-drive"] : [],
            realtime: false,
            position: [400, -0.3, 300],
          });
          for (const jointId of ["joint-0", "joint-3"])
            await play.setMotor({
              rigId: "twin-drive",
              jointId,
              enabled: true,
              input: 0,
            });
        }, dynamic);
        await expect(
          page.getByRole("button", {
            name: "Open mechanism controls",
            exact: true,
          }),
        ).toBeVisible();
        await openRemoteControls(page);
        expect(
          (await page.evaluate(() => window.brickEditor!.play.view()))
            .mechanismOverview,
        ).toBe("twin-drive");
        const motors = page.getByRole("group", {
          name: "Motor controls",
          exact: true,
        });
        const red = motors.getByRole("button", { name: /^Motor 1 / });
        const blue = motors.getByRole("button", { name: /^Motor 2 / });
        await expect(red).toHaveAttribute("aria-pressed", "true");
        await page.getByLabel("Motor 1 power", { exact: true }).fill("0.25");
        await page
          .getByRole("button", { name: "Run motor 1 forward", exact: true })
          .click();
        await page.evaluate(() => window.brickEditor!.play.stepTicks(240));
        const first = (
          await page.evaluate(() => window.brickEditor!.play.snapshot())
        ).mechanisms!["twin-drive"];
        expect(first.pose.jointPositions["joint-0"]).toBeGreaterThan(60);
        expect(Math.abs(first.pose.jointPositions["joint-3"])).toBeLessThan(1);
        expect(first.motors!["joint-0"]).toMatchObject({
          input: 0.25,
          power: 0.25,
        });
        await blue.click();
        await page.getByLabel("Motor 2 power", { exact: true }).fill("0.5");
        await page
          .getByRole("button", { name: "Run motor 2 reverse", exact: true })
          .click();
        await page.evaluate(() => window.brickEditor!.play.stepTicks(120));
        const both = (
          await page.evaluate(() => window.brickEditor!.play.snapshot())
        ).mechanisms!["twin-drive"];
        expect(both.motors!["joint-0"]).toMatchObject({
          input: 0.25,
          power: 0.25,
        });
        expect(both.motors!["joint-3"]).toMatchObject({
          input: -0.5,
          power: 0.5,
        });
        expect(both.pose.jointPositions["joint-0"]).toBeGreaterThan(
          first.pose.jointPositions["joint-0"] + 20,
        );
        expect(both.pose.jointPositions["joint-3"]).toBeLessThan(-60);
        expect(both.pose.jointPositions["joint-2"]).toBeCloseTo(
          both.pose.jointPositions["joint-0"] / 3,
          0,
        );
        expect(both.pose.jointPositions["joint-4"]).toBeCloseTo(
          -both.pose.jointPositions["joint-3"],
          0,
        );
        await expect(red).toContainText("Running forward");
        await expect(blue).toContainText("Running reverse");
        await page.getByText("Motor settings", { exact: true }).click();
        await expect(page.locator(".play-motor-settings")).not.toContainText(
          "Shaft position",
        );
        await page.getByText("Linked outputs (1)", { exact: true }).click();
        await expect(page.locator(".play-output-details")).not.toContainText(
          "degrees",
        );
        await page.getByText("Linked outputs (1)", { exact: true }).click();
        await page.getByText("Motor settings", { exact: true }).click();
        await expect(
          page.getByRole("button", { name: "Brake all", exact: true }),
        ).toBeVisible();
        await page.screenshot({
          path: testInfo.outputPath("independent-motors.png"),
        });
        await page
          .getByRole("button", { name: "Brake all", exact: true })
          .click();
        const stopped = (
          await page.evaluate(() => window.brickEditor!.play.snapshot())
        ).mechanisms!["twin-drive"];
        for (const id of ["joint-0", "joint-3"])
          expect(stopped.motors![id]).toMatchObject({ input: 0, power: 1 });
        await red.click();
        await expect(
          page.getByLabel("Motor 1 power", { exact: true }),
        ).toHaveValue("0.25");
        await page
          .getByRole("button", { name: "Run motor 1 reverse", exact: true })
          .click();
        await closeRemoteControls(page);
        expect(
          (await page.evaluate(() => window.brickEditor!.play.snapshot()))
            .mechanisms!["twin-drive"].motors!["joint-0"],
        ).toMatchObject({ input: 0, power: 1 });
        expect(
          (await page.evaluate(() => window.brickEditor!.play.view()))
            .mechanismOverview,
        ).toBeUndefined();
        await page.evaluate(() => window.brickEditor!.play.exit());
        const after = await page.evaluate(async () => {
          const api = window.brickEditor!;
          return {
            query: await api.query(),
            source: Array.from(
              (await api.project.export({ format: "ldraw" })).bytes,
            ),
            native: Array.from(
              (await api.project.export({ format: "native" })).bytes,
            ),
            inventory: await api.inventory.preview({
              expectedRevision: (await api.query()).revision,
              scope: { kind: "all" },
              format: "bricklink-wanted-xml",
              acceptDerivedMappings: true,
              acceptUnknownColors: true,
              errorPolicy: "export-resolved",
            }),
          };
        });
        expect(after.query).toEqual(before.query);
        expect(after.source).toEqual(before.source);
        expect(after.inventory).toEqual(before.inventory);
        expect(nativeContents(after.native)).toEqual(
          nativeContents(before.native),
        );
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
