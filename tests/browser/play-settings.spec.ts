import { expect, test } from "@playwright/test";
import { openMode } from "./helpers/mode";
import { enterPlay } from "./helpers/play";
for (const viewport of [
  { width: 360, height: 800 },
  { width: 1080, height: 1800 },
])
  test(`Play camera and validated spawn settings remain session-only at ${viewport.width}px`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ viewport, hasTouch: true }),
      page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.goto(`${baseURL}/?automation=1`);
      await page.waitForFunction(() => !!window.brickEditor);
      await page.evaluate(async () => {
        await window.brickEditor!.project.import({
          format: "template",
          template: "blank",
        });
        await window.brickEditor!.ready();
      });
      const documentBefore = await page.evaluate(() =>
        window.brickEditor!.query(),
      );
      await openMode(page, "Play");
      await enterPlay(page);
      await expect(
        page.getByRole("button", { name: "Pause", exact: true }),
      ).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(() =>
            window.brickEditor!.play.snapshot().then((r) => r.grounded),
          ),
        )
        .toBe(true);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      const initial = await page.evaluate(() =>
          window.brickEditor!.play.snapshot(),
        ),
        settings = page.getByRole("region", { name: "Play session settings" });
      await settings.getByText("Camera settings", { exact: true }).click();
      for (const [label, value] of [
        ["Eye height (LDU)", "50"],
        ["Field of view (degrees)", "75"],
        ["Near plane (LDU)", "1"],
        ["Follow distance (LDU)", "180"],
        ["Minimum pitch (degrees)", "-45"],
        ["Maximum pitch (degrees)", "45"],
      ])
        await settings.getByLabel(label, { exact: true }).fill(value);
      await settings
        .getByRole("button", { name: "Apply camera settings", exact: true })
        .click();
      let snapshot = await page.evaluate(() =>
        window.brickEditor!.play.snapshot(),
      );
      expect(snapshot.cameraSettings.eyeHeight).toBe(50);
      expect(snapshot.cameraSettings.fovDeg).toBe(75);
      expect(snapshot.cameraSettings.followDistance).toBe(180);
      expect(snapshot.cameraSettings.minPitch).toBeCloseTo(-Math.PI / 4);
      expect(snapshot.position).toEqual(initial.position);
      expect(snapshot.profile.height).toBe(104);
      await settings
        .getByLabel("Minimum pitch (degrees)", { exact: true })
        .fill("5");
      await settings
        .getByRole("button", { name: "Apply camera settings", exact: true })
        .click();
      await expect(settings.getByRole("status")).toContainText(
        /Minimum pitch \(degrees\).*84.8/,
      );
      expect(
        (await page.evaluate(() => window.brickEditor!.play.snapshot()))
          .cameraSettings,
      ).toEqual(snapshot.cameraSettings);
      await settings
        .getByLabel("Minimum pitch (degrees)", { exact: true })
        .fill("-45");

      const rendered = await page.evaluate(async () => {
        const api = window.brickEditor!,
          q = await api.query();
        const image = await api.render.image({
          revision: q.revision,
          width: 128,
          height: 128,
          format: "png",
          visibility: { mode: "all" },
          background: { type: "solid", color: "#ffffff" },
          quality: "fast",
          strict: true,
        });
        return image.manifest;
      });
      expect((rendered.camera as { fovDeg: number }).fovDeg).toBe(75);
      await settings.getByText("Camera settings", { exact: true }).click();
      await settings.getByText("Safe spawn", { exact: true }).click();
      await settings
        .getByRole("button", {
          name: "Remember current safe position",
          exact: true,
        })
        .click();
      snapshot = await page.evaluate(() => window.brickEditor!.play.snapshot());
      expect(snapshot.spawn!.position).toEqual(initial.position);
      await settings
        .getByText("Choose spawn coordinates", { exact: true })
        .click();
      await settings
        .getByLabel("Spawn feet Y (LDU)", { exact: true })
        .fill("-200");
      await settings
        .getByRole("button", { name: "Validate and save spawn", exact: true })
        .click();
      await expect(settings.getByRole("status")).toContainText(
        /support|clear|solid|floor/i,
      );
      expect(
        (await page.evaluate(() => window.brickEditor!.play.snapshot())).spawn,
      ).toEqual(snapshot.spawn);
      await settings
        .getByLabel("Spawn feet X (LDU)", { exact: true })
        .fill("80");
      await settings
        .getByLabel("Spawn feet Y (LDU)", { exact: true })
        .fill(String(initial.position[1]));
      await settings
        .getByLabel("Spawn feet Z (LDU)", { exact: true })
        .fill("80");
      await settings
        .getByLabel("Spawn yaw (degrees)", { exact: true })
        .fill("90");
      await settings
        .getByRole("button", { name: "Validate and save spawn", exact: true })
        .click();
      snapshot = await page.evaluate(() => window.brickEditor!.play.snapshot());
      expect(snapshot.position).toEqual(initial.position);
      expect(snapshot.spawn!.position).toEqual([80, initial.position[1], 80]);
      expect(snapshot.spawn!.yaw).toBeCloseTo(Math.PI / 2);
      await page.evaluate(async (y) => {
        await window.brickEditor!.play.setLocomotion("fly-noclip");
        await window.brickEditor!.play.teleport({
          position: [140, y, 140],
          policy: "free-flight",
        });
      }, initial.position[1]);
      await settings
        .getByRole("button", { name: "Go to saved spawn", exact: true })
        .click();
      snapshot = await page.evaluate(() => window.brickEditor!.play.snapshot());
      expect(snapshot.locomotion).toBe("walk");
      expect(snapshot.position).toEqual([80, initial.position[1], 80]);
      await expect(
        page.getByText("Movement is paused.", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Exit Play", exact: true })
        .click();
      expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
        documentBefore,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
