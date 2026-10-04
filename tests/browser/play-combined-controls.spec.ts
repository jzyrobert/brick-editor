import { expect, test } from "@playwright/test";
import { nativeContents } from "./helpers/physical-play-policy";
import { realCombinedMotorFixture } from "./helpers/real-mechanisms";
import { openMode } from "./helpers/mode";
import { openRemoteControls, closeRemoteControls } from "./helpers/play";
import { refusePointerLock } from "./helpers/pointer";
const fixture = realCombinedMotorFixture();
for (const width of [1440, 360])
  for (const dynamic of [false, true])
    test(`two independent mounted motors retain separate controls and overview ${width}px ${dynamic ? "Dynamic" : "Kinematic"}`, async ({
      page,
    }) => {
      test.setTimeout(180000);
      await page.setViewportSize({ width, height: width === 360 ? 600 : 1000 });
      await refusePointerLock(page);
      await page.goto("/?automation=1");
      await page.waitForFunction(() => !!window.brickEditor);
      const before = await page.evaluate(async (bytes) => {
        const a = window.brickEditor!;
        await a.project.import({ format: "native", bytes });
        await a.ready({ strict: true });
        return {
          q: await a.query(),
          inventory: await a.inventory.preview({
            expectedRevision: (await a.query()).revision,
            scope: { kind: "all" },
            format: "bricklink-wanted-xml",
            acceptDerivedMappings: true,
            acceptUnknownColors: true,
            errorPolicy: "export-resolved",
          }),
          source: Array.from(
            (await a.project.export({ format: "ldraw" })).bytes,
          ),
          native: Array.from(
            (await a.project.export({ format: "native" })).bytes,
          ),
        };
      }, fixture.bytes);
      await openMode(page, "Play");
      await page.evaluate(
        async ({ dynamic, drivers }) => {
          const play = window.brickEditor!.play;
          await play.enter({
            rigIds: ["drive-1", "drive-2"],
            ...(dynamic ? { dynamicRigIds: ["drive-1", "drive-2"] } : {}),
            position: [600, -0.3, 200],
            realtime: false,
          });
          for (const driver of drivers)
            await play.setMotor({ ...driver, enabled: true, input: 0 });
        },
        {
          dynamic,
          drivers: fixture.rigs.map((r) => ({
            rigId: r.id,
            jointId: r.transmissions![0].jointA,
          })),
        },
      );
      const rest = await page.evaluate(() =>
        window.brickEditor!.play.snapshot(),
      );
      await openRemoteControls(page);
      const selector = page.getByLabel("Remote mechanism", { exact: true });
      await expect(selector.locator("option")).toHaveCount(2);
      const poses = [];
      for (const rig of fixture.rigs) {
        await selector.selectOption(rig.id);
        expect(
          (await page.evaluate(() => window.brickEditor!.play.view()))
            .mechanismOverview,
        ).toBe(rig.id);
        const forward = page.getByRole("button", {
          name: "Hold motor 1 forward",
          exact: true,
        });
        await forward.scrollIntoViewIfNeeded();
        await forward.focus();
        await page.keyboard.down("Enter");
        await page.evaluate(() => window.brickEditor!.play.stepTicks(120));
        await page.keyboard.up("Enter");
        poses.push(
          await page.evaluate(() => window.brickEditor!.play.snapshot()),
        );
        const box = (await page.locator(".play-mechanism").boundingBox())!;
        expect(box.y + box.height).toBeLessThanOrEqual(
          width === 360 ? 600 : 1000,
        );
        for (const button of await page
          .locator(".play-mechanism button:visible")
          .all()) {
          const b = (await button.boundingBox())!;
          expect(b.width).toBeGreaterThanOrEqual(44);
          expect(b.height).toBeGreaterThanOrEqual(44);
        }
      }
      const input1 = fixture.rigs[0].transmissions![0].jointA,
        input2 = fixture.rigs[1].transmissions![0].jointA;
      expect(
        poses[0].mechanisms!["drive-1"].pose.jointPositions[input1],
      ).toBeGreaterThan(90);
      const untouched =
        poses[0].mechanisms!["drive-2"].pose.jointPositions[input2];
      const resting = rest.mechanisms!["drive-2"].pose.jointPositions[input2];
      if (dynamic) expect(untouched).toBeCloseTo(resting, 5);
      else expect(untouched).toBe(resting);
      expect(
        poses[1].mechanisms!["drive-2"].pose.jointPositions[input2],
      ).toBeGreaterThan(90);
      for (const rig of fixture.rigs) {
        const r = rig.transmissions![0],
          s = poses[1].mechanisms![rig.id];
        expect(s.pose.jointPositions[r.jointB]).toBeCloseTo(
          -s.pose.jointPositions[r.jointA] / 3,
          0,
        );
        expect(s.motors![r.jointA].input).toBe(0);
      }
      await closeRemoteControls(page);
      expect(
        (await page.evaluate(() => window.brickEditor!.play.view()))
          .mechanismOverview,
      ).toBeUndefined();
      await page.evaluate(() => window.brickEditor!.play.exit());
      const after = await page.evaluate(async () => {
        const a = window.brickEditor!;
        return {
          q: await a.query(),
          inventory: await a.inventory.preview({
            expectedRevision: (await a.query()).revision,
            scope: { kind: "all" },
            format: "bricklink-wanted-xml",
            acceptDerivedMappings: true,
            acceptUnknownColors: true,
            errorPolicy: "export-resolved",
          }),
          source: Array.from(
            (await a.project.export({ format: "ldraw" })).bytes,
          ),
          native: Array.from(
            (await a.project.export({ format: "native" })).bytes,
          ),
        };
      });
      expect(after.q).toEqual(before.q);
      expect(after.inventory).toEqual(before.inventory);
      expect(after.source).toEqual(before.source);
      expect(nativeContents(after.native)).toEqual(
        nativeContents(before.native),
      );
    });
