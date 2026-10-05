import { expect, test } from "@playwright/test";
import { openMode } from "./helpers/mode";
import { openRemoteControls, closeRemoteControls } from "./helpers/play";
import { refusePointerLock } from "./helpers/pointer";
import { nativeContents } from "./helpers/physical-play-policy";

for (const phone of [false, true])
  test(`Large motor sample turns its actual source rotor ${phone ? "phone" : "desktop"}`, async ({
    browser,
    baseURL,
  }, info) => {
    test.setTimeout(180000);
    const context = await browser.newContext({
      viewport: phone
        ? { width: 360, height: 600 }
        : { width: 1440, height: 1000 },
      hasTouch: phone,
      isMobile: phone,
    });
    const page = await context.newPage(),
      errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await refusePointerLock(page);
    try {
      await page.goto(`${baseURL}/?automation=1`);
      await page.waitForFunction(() => !!window.brickEditor);
      const original = await page.evaluate(async () => {
        const api = window.brickEditor!;
        await api.project.import({
          format: "template",
          template: "large-motor",
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
        };
      });
      await openMode(page, "Play");
      await expect(
        page.locator(".play-physics-settings summary"),
      ).toContainText("Dynamic");
      await page.evaluate(async () => {
        const play = window.brickEditor!.play;
        await play.enter({
          rigId: "pf-large-drive",
          dynamicRigIds: ["pf-large-drive"],
          realtime: false,
          position: [300, -0.3, 300],
        });
        await play.setMotor({
          rigId: "pf-large-drive",
          jointId: "motor-output",
          enabled: true,
          input: 0,
        });
      });
      const report = () =>
        page.evaluate(
          async () =>
            (await window.brickEditor!.play.snapshot()).mechanisms![
              "pf-large-drive"
            ],
        );
      const components = () =>
        page.evaluate(async () => {
          type Child = { matrix: { elements: number[] }; children: Child[] };
          const rig = (await window.brickEditor!.mechanisms.list()).find(
            (rig) => rig.id === "pf-large-drive",
          )!;
          const motorId = rig.joints.find(
            (joint) => joint.id === "motor-output",
          )!.motor!.binding!.occurrenceId;
          const scene = window.__brickScene as {
            handles: { get(id: string): { object: Child | null } | undefined };
          };
          const motor = scene.handles.get(motorId)!.object!;
          return {
            casing: [...motor.children[0].children[0].matrix.elements],
            rotor: [...motor.children[0].children[1].matrix.elements],
          };
        });
      const initial = await components(),
        rest = await report();
      expect(rest.mode).toBe("dynamic");
      await openRemoteControls(page);
      await expect(
        page.getByLabel("Motor 1 power", { exact: true }),
      ).toBeVisible();
      await expect(page.locator(".play-mechanism")).not.toContainText(
        "Shaft position",
      );
      await page.getByLabel("Motor 1 power", { exact: true }).fill("0.5");
      await page
        .getByRole("button", { name: "Run motor 1 forward", exact: true })
        .click();
      await page.evaluate(() => window.brickEditor!.play.stepTicks(90));
      const forward = await report(),
        moved = await components();
      expect(forward.pose.jointPositions["motor-output"]).toBeGreaterThan(30);
      expect(forward.groupFrames.carrier).toEqual(rest.groupFrames.carrier);
      expect(moved.casing).toEqual(initial.casing);
      expect(moved.rotor).not.toEqual(initial.rotor);
      expect(moved.rotor[1]).toBeCloseTo(
        Math.sin((forward.pose.jointPositions["motor-output"] * Math.PI) / 180),
        5,
      );
      await expect(page.locator(".play-mechanism")).toContainText(
        "Running forward",
      );
      await page.screenshot({
        path: info.outputPath("large-motor-forward.png"),
      });
      await page
        .getByRole("button", { name: "Run motor 1 reverse", exact: true })
        .click();
      await page.evaluate(() => window.brickEditor!.play.stepTicks(120));
      const reverse = await report();
      expect(reverse.pose.jointPositions["motor-output"]).toBeLessThan(
        forward.pose.jointPositions["motor-output"] - 30,
      );
      await expect(page.locator(".play-mechanism")).toContainText(
        "Running reverse",
      );
      await page.getByLabel("Motor 1 power", { exact: true }).fill("0");
      expect((await report()).motors!["motor-output"]).toMatchObject({
        input: 0,
        power: 0,
      });
      await expect(page.locator(".play-mechanism")).toContainText("Motor off");
      await page.getByLabel("Motor 1 power", { exact: true }).fill("0.5");
      expect((await report()).motors!["motor-output"]).toMatchObject({
        input: -0.5,
        power: 0.5,
      });
      await page.evaluate(() => window.brickEditor!.play.stepTicks(30));
      expect((await report()).pose.jointPositions["motor-output"]).toBeLessThan(
        reverse.pose.jointPositions["motor-output"],
      );
      await expect(
        page.getByRole("button", { name: "Run motor 1 reverse", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await closeRemoteControls(page);
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
        };
      });
      expect(after.query).toEqual(original.query);
      expect(after.source).toEqual(original.source);
      expect(nativeContents(after.native)).toEqual(
        nativeContents(original.native),
      );
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
