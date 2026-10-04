import { realMechanismsFixture } from "./helpers/real-mechanisms";
import { expect, test } from "@playwright/test";
import { openMode } from "./helpers/mode";
import { enterPlay, openRemoteControls } from "./helpers/play";
test("Play uses posed door colliders, refuses actor-crossing motion and restores authored geometry", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async (realFixtureBytes: number[]) => {
    const a = window.brickEditor!;
    await a.project.import({ format: "native", bytes: realFixtureBytes });
    const before = await a.query();
    await a.ready({ minRevision: before.revision, strict: true });
    const documentBefore = await a.project.export({ format: "ldraw" });
    const capture = async () => {
      const r = await a.render.image({
        revision: before.revision,
        width: 256,
        height: 256,
        format: "png",
        visibility: { mode: "all" },
        background: { type: "solid", color: "#ffffff" },
        quality: "balanced",
        strict: true,
      });
      return {
        bytes: Array.from(new Uint8Array(await r.blob.arrayBuffer())),
        manifest: r.manifest,
      };
    };
    const authored = await capture();
    await a.play.enter({ rigId: "door", position: [20, -0.3, 45] });
    a.play.setInput({ moveZ: 1 });
    await a.play.stepTicks(40);
    const stopped = await a.play.snapshot();
    await a.play.teleport({ position: [20, -0.3, 45] });
    const closed = await capture();
    await a.play.setInput({});
    await a.play.setJointTarget({ jointId: "hinge", target: 90, speed: 90 });
    const opened = await a.play.stepTicks(60);
    const open = await capture();
    // Cross through the actual doorway centre, clear of the open leaf knob.
    await a.play.teleport({ position: [0, -0.3, 45] });
    await a.play.setInput({ moveZ: 1 });
    // 45 LDU at the walking speed (145 LDU/s): into the doorway.
    await a.play.stepTicks(19);
    await a.play.setInput({});
    const inside = await a.play.snapshot();
    const blocked = await a.play.setMechanismJoint("hinge", 0);
    await a.play.exit();
    const restored = await capture();
    await a.play.enter({ rigId: "vehicle", position: [200, -0.3, -200] });
    await a.play.setMechanismVehicleInput({ throttle: 1, steering: 0 });
    const driven = await a.play.stepTicks(60);
    await a.play.pause(true);
    const paused = await a.play.stepTicks(60);
    await a.play.exit();
    return {
      before,
      after: await a.query(),
      documentBefore,
      documentAfter: await a.project.export({ format: "ldraw" }),
      stopped,
      opened,
      inside,
      blocked,
      driven,
      paused,
      authored: authored.bytes,
      restored: restored.bytes,
      closed: closed.bytes,
      open: open.bytes,
      manifest: open.manifest,
    };
  }, realFixture.bytes);
  expect(result.stopped.position[2]).toBeGreaterThan(9);
  expect(result.opened.mechanism!.blocked).toBe(false);
  expect(Math.abs(result.inside.position[2])).toBeLessThan(3);
  expect(result.blocked.mechanism!.blocked).toBe(true);
  expect(result.blocked.mechanism!.pose.jointPositions.hinge).toBe(90);
  expect(result.open).not.toEqual(result.closed);
  expect(result.authored).toEqual(result.restored);
  expect(
    (
      result.manifest as unknown as {
        play: {
          mechanism: { pose: { jointPositions: Record<string, number> } };
        };
      }
    ).play.mechanism.pose.jointPositions.hinge,
  ).toBe(90);
  expect(result.driven.mechanism!.pose.vehicle!.position[2]).toBeCloseTo(
    -realFixture.rigs.vehicle.vehicle!.maxSpeed,
    4,
  );
  expect(
    result.driven.mechanism!.pose.vehicle!.wheelAngles["left-front"],
  ).toBeCloseTo(
    ((realFixture.rigs.vehicle.vehicle!.maxSpeed /
      realFixture.rigs.vehicle.vehicle!.wheels[0].radius) *
      180) /
      Math.PI,
    4,
  );
  expect(result.driven.mechanism!.tick).toBe(result.driven.tick);
  expect(result.paused.mechanism!.pose).toEqual(result.driven.mechanism!.pose);
  expect(result.documentAfter).toEqual(result.documentBefore);
  expect(result.after.revision).toBe(result.before.revision);
  expect(result.after.occurrences).toEqual(result.before.occurrences);
});

test("1080×1800 touch UI selects an authored door rig and controls its live collider", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1800 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(`${baseURL}/?automation=1`);
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(
    (realFixtureBytes: number[]) =>
      window.brickEditor!.project.import({
        format: "native",
        bytes: realFixtureBytes,
      }),
    realFixture.bytes,
  );
  const revision = await page.evaluate(
    async () => (await window.brickEditor!.query()).revision,
  );
  await openMode(page, "Play");
  await page.getByLabel("Explore with mechanism").selectOption("door");
  await enterPlay(page);
  await page.evaluate(() =>
    window.brickEditor!.play.teleport({ position: [20, -0.3, 45] }),
  );
  await openRemoteControls(page);
  const slider = await page.getByLabel("Explore joint hinge").boundingBox();
  await page.touchscreen.tap(
    slider!.x + slider!.width / 2,
    slider!.y + slider!.height / 2,
  );
  await page.evaluate(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    await window.brickEditor!.play.stepTicks(60);
  });
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (await window.brickEditor!.play.snapshot()).mechanism?.pose
            .jointPositions.hinge,
      ),
    )
    .toBeGreaterThan(40);
  const q = await page.evaluate(() => window.brickEditor!.query());
  expect(q.revision).toBe(revision);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});

const realFixture = realMechanismsFixture();
