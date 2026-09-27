import { expect, test } from "@playwright/test";
import { unzipSync, strFromU8 } from "fflate";

for (const width of [360, 1080, 1440])
  test(`open-bench entry driving and exit at ${width}px`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: {
        width,
        height: width === 360 ? 800 : width === 1080 ? 1800 : 1000,
      },
      hasTouch: width !== 1440,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto("/?automation=1");
      await page.waitForFunction(() => !!window.brickEditor);
      await page.evaluate(async () => {
        await window.brickEditor!.project.import({
          format: "template",
          template: "seated-vehicle",
        });
        await window.brickEditor!.ready();
      });
      const authored = await page.evaluate(() => window.brickEditor!.query());
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await page.evaluate(() =>
        window.brickEditor!.play.enter({
          rigId: "vehicle",
          position: [80, -0.3, -188],
          realtime: false,
        }),
      );
      const enter = page.getByRole("button", {
        name: "Enter driver seat",
        exact: true,
      });
      await expect(enter).toBeEnabled();
      await page
        .getByRole("button", { name: "Control vehicle from here" })
        .click();
      await expect(
        page.getByText("Controlling vehicle · on foot", { exact: true }),
      ).toBeVisible();
      expect(
        (await page.evaluate(() => window.brickEditor!.play.snapshot()))
          .occupancy,
      ).toBeUndefined();
      await page.getByRole("button", { name: "Release vehicle" }).click();
      if (width === 1440) await page.keyboard.press("e");
      else await enter.tap();
      await expect(
        page.getByRole("button", { name: "Exit vehicle", exact: true }),
      ).toBeVisible();
      const seated = await page.evaluate(() =>
        window.brickEditor!.play.snapshot(),
      );
      const topBar = (await page.locator(".play-top").boundingBox())!;
      const exitCard = (await page.locator(".play-interaction").boundingBox())!;
      expect(exitCard.y).toBeGreaterThanOrEqual(topBar.y + topBar.height + 4);

      expect(seated.occupancy).toMatchObject({
        rigId: "vehicle",
        seatId: "driver",
        pelvisWorldLdu: [0, -41, -188],
        effectiveEyeWorldLdu: [0, -79, -188],
      });
      expect(seated.positionAnchor).toBe("seated-avatar-root");
      expect(seated.avatarVisible).toBe(false);
      await expect(
        page.getByRole("button", { name: "Jump", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Fly through walls", exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Third person", exact: true })
        .click();
      const third = await page.evaluate(() =>
        window.brickEditor!.play.snapshot(),
      );
      expect(third.avatar.leftHip).toBeCloseTo(Math.PI / 2, 8);
      expect(third.avatar.rightHip).toBeCloseTo(Math.PI / 2, 8);
      await page.screenshot({
        path: test.info().outputPath(`seated-${width}.png`),
      });
      const initialImage = await page.locator("canvas").first().screenshot();
      if (width !== 1440) {
        const client = await context.newCDPSession(page);
        const stick = (await page
          .getByRole("group", { name: "Movement joystick" })
          .boundingBox())!;
        const look = (await page
          .getByLabel("Drag to look around")
          .boundingBox())!;
        await client.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [
            {
              id: 1,
              x: stick.x + stick.width * 0.3,
              y: stick.y + stick.height * 0.2,
            },
            {
              id: 2,
              x: look.x + look.width * 0.75,
              y: look.y + look.height * 0.55,
            },
          ],
        });
        await client.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [
            {
              id: 1,
              x: stick.x + stick.width * 0.3,
              y: stick.y + stick.height * 0.2,
            },
            {
              id: 2,
              x: look.x + look.width * 0.75 + 18,
              y: look.y + look.height * 0.55 + 5,
            },
          ],
        });
        await page.evaluate(() => window.brickEditor!.play.stepTicks(20));
        await client.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
      } else {
        await page.keyboard.down("w");
        await page.keyboard.down("a");
        await page.evaluate(() => window.brickEditor!.play.stepTicks(20));
        await page.keyboard.up("w");
        await page.keyboard.up("a");
      }
      const driven = await page.evaluate(() =>
        window.brickEditor!.play.snapshot(),
      );
      expect(driven.mechanism!.pose.vehicle!.position[2]).toBeLessThan(-10);
      expect(driven.occupancy!.pelvisWorldLdu).not.toEqual(
        seated.occupancy!.pelvisWorldLdu,
      );
      if (width !== 1440) {
        expect(driven.occupancy!.localLookYaw).not.toBeCloseTo(
          third.occupancy!.localLookYaw,
          6,
        );
      }
      expect(driven.avatar.leftHip).toBeCloseTo(Math.PI / 2, 8);
      expect(await page.locator("canvas").first().screenshot()).not.toEqual(
        initialImage,
      );
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Resume driving", exact: true }),
      ).toBeVisible();
      const frozen = await page.evaluate(async () => {
        const a = window.brickEditor!,
          before = await a.play.snapshot();
        const image = await a.render.image({
          revision: before.sourceRevision,
          width: 128,
          height: 128,
          format: "png",
          visibility: { mode: "all" },
          background: { type: "solid", color: "#ffffff" },
          quality: "balanced",
          strict: true,
        });
        return {
          before,
          after: await a.play.snapshot(),
          manifest: image.manifest,
        };
      });
      expect(frozen.after).toEqual(frozen.before);
      expect(
        (frozen.manifest as unknown as { play: typeof frozen.before }).play
          .occupancy,
      ).toEqual(frozen.before.occupancy);
      await page
        .getByRole("button", { name: "Resume driving", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Exit vehicle", exact: true })
        .click();
      const outside = await page.evaluate(() =>
        window.brickEditor!.play.snapshot(),
      );
      expect(outside.occupancy).toBeUndefined();
      expect(outside.positionAnchor).toBe("standing-feet");
      await page
        .getByRole("button", { name: "Exit Play", exact: true })
        .click();
      expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
        authored,
      );
      expect(errors).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    } finally {
      await context.close();
    }
  });

test("seat metadata review preserves mechanics, refuses stale commit, and saves in one undo", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    await window.brickEditor!.project.import({
      format: "template",
      template: "seated-vehicle",
    });
    await window.brickEditor!.ready();
  });
  await page
    .locator(".right-tabs")
    .getByRole("button", { name: "Inspector", exact: true })
    .click();
  const form = page.locator(".seat-authoring");
  await form.getByText("Driver seat coordinates", { exact: true }).click();
  await form
    .getByRole("combobox", { name: "Seat vehicle" })
    .selectOption("vehicle");
  await form.getByRole("button", { name: "Load seat coordinates" }).click();
  const native = async () => {
    const bytes = await page.evaluate(async () =>
      Array.from(
        (await window.brickEditor!.project.export({ format: "native" })).bytes,
      ),
    );
    return JSON.parse(
      strFromU8(unzipSync(new Uint8Array(bytes))["project.json"]),
    );
  };
  const before = await native();
  await form
    .getByRole("spinbutton", { name: "Pelvis position X", exact: true })
    .fill("1");
  await form.getByRole("button", { name: "Review seat metadata" }).click();
  await page.evaluate(async () => {
    const a = window.brickEditor!,
      q = await a.query();
    await a.dispatch({
      schemaVersion: 1,
      commandId: crypto.randomUUID(),
      expectedRevision: q.revision,
      type: "project.rename",
      payload: { title: "New revision" },
    });
  });
  await form
    .getByRole("button", { name: "Save driver seat", exact: true })
    .click();
  await expect(form.getByRole("status")).toContainText(/changed|revision/i);
  expect((await native()).motionRigs.vehicle).toEqual(
    before.motionRigs.vehicle,
  );
  await form.getByRole("button", { name: "Load seat coordinates" }).click();
  await form
    .getByRole("spinbutton", { name: "Pelvis position X", exact: true })
    .fill("1");
  await form.getByRole("button", { name: "Review seat metadata" }).click();
  const revision = (await page.evaluate(() => window.brickEditor!.query()))
    .revision;
  await form
    .getByRole("button", { name: "Save driver seat", exact: true })
    .click();
  const after = await native();
  expect(after.revision).toBe(revision + 1);
  expect(after.motionRigs.vehicle.vehicle.driverSeat.pelvisPosition[0]).toBe(1);
  expect(after.motionRigs.vehicle.groups).toEqual(
    before.motionRigs.vehicle.groups,
  );
  expect(after.models).toEqual(before.models);
  await page.evaluate(async () => {
    const a = window.brickEditor!,
      q = await a.query();
    await a.dispatch({
      schemaVersion: 1,
      commandId: crypto.randomUUID(),
      expectedRevision: q.revision,
      type: "history.undo",
      payload: {},
    });
  });
  expect((await native()).motionRigs.vehicle).toEqual(
    before.motionRigs.vehicle,
  );
  const rigForm = page.locator(".rig-authoring");
  await rigForm.getByText("Create or edit a rig", { exact: true }).click();
  await rigForm
    .getByRole("combobox", { name: "Existing rig", exact: true })
    .selectOption("vehicle");
  await rigForm
    .getByRole("button", { name: "Load rig for editing", exact: true })
    .click();
  await rigForm.getByLabel("Maximum speed (LDU per second)").fill("110");
  await rigForm
    .getByRole("button", { name: "Preview rig assignment", exact: true })
    .click();
  const rigRevision = (await page.evaluate(() => window.brickEditor!.query()))
    .revision;
  await rigForm
    .getByRole("button", { name: "Update rig", exact: true })
    .click();
  const updated = await native();
  expect(updated.revision).toBe(rigRevision + 1);
  expect(updated.motionRigs.vehicle.vehicle.maxSpeed).toBe(110);
  expect(updated.motionRigs.vehicle.vehicle.driverSeat).toEqual(
    before.motionRigs.vehicle.vehicle.driverSeat,
  );
  await page.evaluate(async () => {
    const a = window.brickEditor!,
      q = await a.query();
    await a.dispatch({
      schemaVersion: 1,
      commandId: crypto.randomUUID(),
      expectedRevision: q.revision,
      type: "history.undo",
      payload: {},
    });
  });
  expect((await native()).motionRigs.vehicle).toEqual(
    before.motionRigs.vehicle,
  );
});

test("blocked seat exits retain the driver and become usable after reversing clear", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.project.import({ format: "template", template: "seated-vehicle" });
    const q = await a.query();
    await a.dispatch({
      schemaVersion: 1,
      commandId: crypto.randomUUID(),
      expectedRevision: q.revision,
      type: "parts.add",
      payload: {
        parts: [-80, 80].map((x) => ({
          ref: "3005.dat",
          colorCode: "14",
          transform: {
            position: [x, 0, -238],
            basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
          },
        })),
      },
    });
    await a.ready();
  });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.evaluate(() =>
    window.brickEditor!.play.enter({
      rigId: "vehicle",
      position: [80, -0.3, -188],
      realtime: false,
    }),
  );
  await page
    .getByRole("button", { name: "Enter driver seat", exact: true })
    .click();
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.play.setInput({ moveZ: 1 });
    await a.play.stepTicks(30);
    await a.play.setInput({});
  });
  const exit = page.getByRole("button", { name: "Exit vehicle", exact: true });
  await exit.click();
  await expect(page.locator(".play-interaction")).toContainText("Exit blocked");
  expect(
    (await page.evaluate(() => window.brickEditor!.play.snapshot())).occupancy
      ?.seatId,
  ).toBe("driver");
  const actionBox = (await page.locator(".play-interaction").boundingBox())!;
  const stickBox = (await page
    .getByRole("group", { name: "Movement joystick" })
    .boundingBox())!;
  expect(actionBox.y + actionBox.height).toBeLessThan(stickBox.y);
  await page.screenshot({
    path: test.info().outputPath("blocked-exit-360.png"),
  });
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.play.setInput({ moveZ: -1 });
    await a.play.stepTicks(30);
    await a.play.setInput({});
  });
  await exit.click();
  expect(
    (await page.evaluate(() => window.brickEditor!.play.snapshot())).occupancy,
  ).toBeUndefined();
});
