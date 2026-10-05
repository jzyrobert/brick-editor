import { expect, test, type Page } from "@playwright/test";
import { openMode } from "./helpers/mode";
import { openRemoteControls, closeRemoteControls } from "./helpers/play";
import { refusePointerLock } from "./helpers/pointer";

const RIG = "pneumatic:0";
const air = (page: Page) =>
  page.evaluate(async () => {
    const report = (await window.brickEditor!.play.snapshot()).mechanisms![
      "pneumatic:0"
    ];
    return { pneumatic: report.pneumatic!, blocked: report.blocked };
  });

for (const phone of [false, true])
  test(`Air pump sample pumps, pushes the crate and pulls the rod back ${phone ? "phone" : "desktop"}`, async ({
    browser,
    baseURL,
  }, info) => {
    test.setTimeout(240000);
    const context = await browser.newContext({
      viewport: phone
        ? { width: 390, height: 844 }
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
      const before = await page.evaluate(async () => {
        const api = window.brickEditor!;
        await api.project.import({ format: "template", template: "air-pump" });
        await api.ready({ strict: true });
        return Array.from(
          (await api.project.export({ format: "ldraw" })).bytes,
        );
      });
      await openMode(page, "Play");
      // The crate's rig asks for Dynamic physics; the air circuit always is.
      await expect(
        page.locator(".play-physics-settings summary"),
      ).toContainText("Dynamic");
      const entered = await page.evaluate(async () => {
        const snapshot = await window.brickEditor!.play.enter({
          rigIds: ["crate"],
          dynamicRigIds: ["crate"],
          realtime: false,
          position: [40, -0.3, -260],
        });
        return {
          rigs: Object.keys(snapshot.mechanisms ?? {}),
          skipped: snapshot.pneumatics?.skipped ?? [],
        };
      });
      expect(entered.skipped).toEqual([]);
      expect(entered.rigs).toEqual(["crate", "pneumatic:0"]);
      const crateStart = await page.evaluate(
        async () =>
          (await window.brickEditor!.play.snapshot()).mechanisms!.crate
            .groupFrames.body.position[0],
      );
      await openRemoteControls(page);
      // The crate has no controls of its own: the air circuit is the only
      // remote mechanism, so its controls open directly.
      const sheet = page.locator(".play-mechanism");
      await expect(sheet.getByRole("heading")).toHaveText("Air pump controls");
      await expect(
        sheet.getByText("Air pressure", { exact: true }),
      ).toBeVisible();
      const pump = sheet.getByRole("button", { name: "Pump", exact: true });
      await expect(pump).toBeVisible();
      const box = (await pump.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      await pump.click();
      await expect(
        sheet.getByRole("button", { name: "Stop pumping", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await sheet
        .getByRole("button", { name: "Push out", exact: true })
        .click();
      await expect(
        sheet.getByRole("button", { name: "Push out", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      for (let i = 0; i < 6; i++)
        await page.evaluate(() => window.brickEditor!.play.stepTicks(300));
      const out = await air(page);
      expect(out.blocked).toBe(false);
      expect(out.pneumatic.valves[0].position).toBe("out");
      expect(out.pneumatic.cylinders[0].extension).toBeGreaterThan(0.6);
      const crateEnd = await page.evaluate(
        async () =>
          (await window.brickEditor!.play.snapshot()).mechanisms!.crate
            .groupFrames.body.position[0],
      );
      // The rod pushed the loose crate along the table (+X).
      expect(crateEnd - crateStart).toBeGreaterThan(20);
      await expect(sheet).toContainText(/Rod out \d+%/);
      await page.screenshot({ path: info.outputPath("air-pump-out.png") });
      await sheet.getByRole("button", { name: "Pull in", exact: true }).click();
      for (let i = 0; i < 6; i++)
        await page.evaluate(() => window.brickEditor!.play.stepTicks(300));
      const back = await air(page);
      expect(back.pneumatic.cylinders[0].extension).toBeLessThan(0.15);
      await closeRemoteControls(page);
      // Closing the sheet lets go of the pump; the valve stays where it is.
      const after = await air(page);
      expect(after.pneumatic.pumps[0].pumping).toBe(false);
      expect(after.pneumatic.valves[0].position).toBe("in");
      await page.evaluate(() => window.brickEditor!.play.exit());
      const exported = await page.evaluate(async () =>
        Array.from(
          (await window.brickEditor!.project.export({ format: "ldraw" })).bytes,
        ),
      );
      expect(exported).toEqual(before);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("Static build keeps the air circuit still", async ({ page, baseURL }) => {
  test.setTimeout(180000);
  await page.goto(`${baseURL}/?automation=1`);
  await page.waitForFunction(() => !!window.brickEditor);
  const snapshot = await page.evaluate(async () => {
    const api = window.brickEditor!;
    await api.project.import({ format: "template", template: "air-pump" });
    await api.ready({ strict: true });
    return api.play.enter({ pneumatics: false, realtime: false });
  });
  expect(snapshot.mechanisms?.[RIG]).toBeUndefined();
  await expect(
    page.evaluate(() =>
      window.brickEditor!.play.setPneumatic({ pumping: true }),
    ),
  ).rejects.toThrow(/no working air circuit/);
});
