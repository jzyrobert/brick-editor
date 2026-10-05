import { realMechanismsFixture } from "./helpers/real-mechanisms";
import { expect, test } from "@playwright/test";
import { openMode } from "./helpers/mode";

test("door and vehicle keep independent live poses in one frozen Play world", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async (realFixtureBytes: number[]) => {
    await window.brickEditor!.project.import({
      format: "native",
      bytes: realFixtureBytes,
    });
    await window.brickEditor!.ready();
  }, realFixture.bytes);
  await openMode(page, "Play");
  const before = await page.evaluate(() =>
    window.brickEditor!.project.export({ format: "ldraw" }),
  );
  const initial = await page.evaluate(() =>
    window.brickEditor!.play.enter({
      rigIds: ["door", "vehicle"],
      position: [20, -0.3, 45],
    }),
  );
  expect(initial.mechanism).toBeUndefined();
  expect(Object.keys(initial.mechanisms!)).toEqual(["door", "vehicle"]);
  await page.getByRole("button", { name: "Open joint" }).click();
  await page.evaluate(() =>
    window.brickEditor!.play.teleport({ position: [-90, -0.3, -280] }),
  );
  await page.getByRole("button", { name: "Get in" }).click();
  await page.keyboard.down("w");
  await page.evaluate(() => window.brickEditor!.play.stepTicks(12));
  await page.keyboard.up("w");
  const driven = await page.evaluate(() => window.brickEditor!.play.snapshot());
  expect(driven.mechanisms!.door.pose.jointPositions.hinge).toBe(18);
  expect(driven.mechanisms!.vehicle.pose.vehicle!.position[2]).toBeLessThan(
    -19,
  );
  expect(driven.mechanisms!.vehicle.tick).toBe(driven.mechanisms!.door.tick);
  await page.getByRole("button", { name: "Get out" }).click();
  const result = await page.evaluate(async () => {
    const a = window.brickEditor!;
    const ambiguous = await a.play.setMechanismJoint("hinge", 0).then(
      () => false,
      () => true,
    );
    await a.play.setMechanismJoint("hinge", 0, "door");
    const snapshot = await a.play.snapshot();
    const capture = await a.render.image({
      revision: snapshot.sourceRevision,
      width: 128,
      height: 128,
      format: "png",
      visibility: { mode: "all" },
      background: { type: "solid", color: "#ffffff" },
      quality: "fast",
      strict: true,
    });
    await a.play.exit();
    return {
      ambiguous,
      snapshot,
      manifest: capture.manifest,
      document: await a.project.export({ format: "ldraw" }),
    };
  });
  expect(result.ambiguous).toBe(true);
  expect(result.snapshot.mechanisms!.door.pose.jointPositions.hinge).toBe(0);
  expect(result.snapshot.mechanisms!.vehicle.pose.vehicle).toEqual(
    driven.mechanisms!.vehicle.pose.vehicle,
  );
  expect(
    (result.manifest as unknown as { play: typeof driven }).play.mechanisms,
  ).toEqual(result.snapshot.mechanisms);
  expect(result.document).toEqual(before);
});

test("multi-rig API refuses ambiguous entry, duplicate selections and unknown IDs", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async (realFixtureBytes: number[]) => {
    const a = window.brickEditor!;
    await a.project.import({ format: "native", bytes: realFixtureBytes });
    await a.ready();
    const rejected = [];
    for (const request of [
      { rigId: "door", rigIds: ["vehicle"] },
      { rigIds: ["door", "door"] },
      { rigIds: ["constructor"] },
    ])
      rejected.push(
        await a.play.enter(request).then(
          () => false,
          () => true,
        ),
      );
    return rejected;
  }, realFixture.bytes);
  expect(result).toEqual([true, true, true]);
});

test("capture refuses concurrent multi-rig mutation before it changes the reported pose", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async (realFixtureBytes: number[]) => {
    const a = window.brickEditor!;
    await a.project.import({ format: "native", bytes: realFixtureBytes });
    await a.ready();
    const before = await a.play.enter({
      rigIds: ["door", "vehicle"],
      position: [-90, -0.3, -280],
    });
    const pending = a.render.image({
      revision: before.sourceRevision,
      width: 512,
      height: 512,
      format: "png",
      visibility: { mode: "all" },
      background: { type: "solid", color: "#ffffff" },
      quality: "balanced",
      strict: true,
    });
    const rejected = await Promise.all(
      [
        a.play.setMechanismJoint("hinge", 90, "door"),
        a.play.setMechanismVehicleInput(
          { throttle: 1, steering: 1 },
          "vehicle",
        ),
        a.play.stepTicks(1),
        a.play.teleport({ position: [100, -0.3, 100] }),
      ].map((task) =>
        task.then(
          () => false,
          () => true,
        ),
      ),
    );
    const during = await a.play.snapshot();
    const image = await pending;
    await a.play.setMechanismJoint("hinge", 45, "door");
    const after = await a.play.snapshot();
    await a.play.exit();
    return { before, during, rejected, manifest: image.manifest, after };
  }, realFixture.bytes);
  expect(result.rejected).toEqual([true, true, true, true]);
  expect(result.during.mechanisms).toEqual(result.before.mechanisms);
  expect(result.during.position).toEqual(result.before.position);
  expect(result.during.tick).toEqual(result.before.tick);
  expect(
    (result.manifest as unknown as { play: typeof result.before }).play
      .mechanisms,
  ).toEqual(result.before.mechanisms);
  expect(result.after.mechanisms!.door.pose.jointPositions.hinge).toBe(45);
});

test("an explicit pause during capture wins over automatic resume", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await openMode(page, "Play");
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    const s = await a.play.enter({ realtime: true });
    const pending = a.render.image({
      revision: s.sourceRevision,
      width: 512,
      height: 512,
      format: "png",
      visibility: { mode: "all" },
      background: { type: "solid", color: "#ffffff" },
      quality: "balanced",
      strict: true,
    });
    await a.play.pause(true);
    await pending;
  });
  await expect(
    page.getByRole("button", { name: "Resume exploring" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resume exploring" }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
});

const realFixture = realMechanismsFixture();
