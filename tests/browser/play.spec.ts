import { test, expect, type Page } from "@playwright/test";
import { openMode } from "./helpers/mode";
import { enterPlay } from "./helpers/play";

async function ready(page: Page) {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor?.play);
  await page.evaluate(() => window.brickEditor!.ready());
}

test("Play API uses deterministic ticks, isolates authoring, and restores the editor camera", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const api = window.brickEditor!;
    await api.project.import({
      format: "ldraw",
      text: "0 Test brick\n1 4 300 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
      name: "play-isolation.mpd",
    });
    await api.ready({ strict: true });
    const before = await api.query();
    const source = Array.from(
      (await api.project.export({ format: "ldraw" })).bytes,
    );
    const editorCamera = {
      space: "ldraw" as const,
      projection: "perspective" as const,
      position: [200, -180, 300] as [number, number, number],
      target: [0, -20, 0] as [number, number, number],
      up: [0, -1, 0] as [number, number, number],
      fovDeg: 50,
      near: 0.5,
      far: 10000,
    };
    await api.camera.set(editorCamera);
    const runs = [];
    for (let repeat = 0; repeat < 3; repeat++) {
      const entered = await api.play.enter({
        position: [0, -100, 0],
        locomotion: "fly-noclip",
        realtime: false,
      });
      await api.play.setInput({ moveZ: 1, yaw: 0.3, pitch: 0.1 });
      const moved = await api.play.stepTicks(60);
      const third = await api.play.setCameraMode("third-person");
      const first = await api.play.setCameraMode("first-person");
      await api.play.exit();
      let exited = false;
      try {
        await api.play.snapshot();
      } catch {
        exited = true;
      }
      runs.push({ entered, moved, third, first, exited });
    }
    const after = await api.query();
    const afterSource = Array.from(
      (await api.project.export({ format: "ldraw" })).bytes,
    );
    const image = await api.render.image({
      revision: after.revision,
      width: 128,
      height: 128,
      format: "png",
      visibility: { mode: "all" },
      background: { type: "transparent" },
      quality: "photo",
      strict: true,
    });
    return {
      before,
      after,
      source,
      afterSource,
      editorCamera,
      restoredCamera: image.manifest.camera,
      runs,
    };
  });
  expect(result.after).toEqual(result.before);
  expect(result.afterSource).toEqual(result.source);
  expect(JSON.parse(JSON.stringify(result.restoredCamera))).toEqual(
    result.editorCamera,
  );
  expect(result.runs[1].moved).toEqual(result.runs[0].moved);
  expect(result.runs[2].moved).toEqual(result.runs[0].moved);
  for (const run of result.runs) {
    expect(run.entered.tick).toBe(0);
    expect(run.moved.tick).toBe(60);
    expect(run.moved.position).not.toEqual(run.entered.position);
    expect(run.first.avatarVisible).toBe(false);
    expect(run.third.avatarVisible).toBe(true);
    expect(run.third.position).toEqual(run.first.position);
    expect(run.exited).toBe(true);
  }
});

for (const viewport of [
  { width: 360, height: 800 },
  { width: 1080, height: 1800 },
]) {
  test(`touch Play supports simultaneous move, look, jump and clears lost input at ${viewport.width}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport,
      baseURL: info.project.use.baseURL,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto("/?automation=1");
      await page.waitForFunction(() => !!window.brickEditor?.play);
      await page.evaluate(() => window.brickEditor!.ready());
      await openMode(page, "Play");
      await enterPlay(page);
      const client = await context.newCDPSession(page);
      const liveBefore = await page.evaluate(() =>
        window.brickEditor!.play.snapshot(),
      );
      const liveStick = (await page
        .getByRole("group", { name: "Movement joystick" })
        .boundingBox())!;
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          {
            id: 10,
            x: liveStick.x + liveStick.width / 2,
            y: liveStick.y + liveStick.height / 2 - 28,
          },
        ],
      });
      await expect
        .poll(async () => {
          const report = await page.evaluate(() =>
            window.brickEditor!.play.snapshot(),
          );
          return Math.hypot(
            report.position[0] - liveBefore.position[0],
            report.position[2] - liveBefore.position[2],
          );
        })
        .toBeGreaterThan(5);
      const liveAfter = await page.evaluate(() =>
        window.brickEditor!.play.snapshot(),
      );
      expect(liveAfter.tick).toBeGreaterThan(liveBefore.tick);
      await client.send("Input.dispatchTouchEvent", {
        type: "touchCancel",
        touchPoints: [],
      });
      // Use the same UI controller with deterministic stepping, independent of GPU frame rate.
      await page.evaluate(async () => {
        await window.brickEditor!.play.enter({
          realtime: false,
          position: [0, 0, 0],
        });
        await window.brickEditor!.play.stepTicks(3);
      });
      const before = await page.evaluate(() =>
        window.brickEditor!.play.snapshot(),
      );
      expect(before.locomotion).toBe("walk");
      const stick = (await page
        .getByRole("group", { name: "Movement joystick" })
        .boundingBox())!;
      const jump = (await page
        .getByRole("button", { name: "Jump", exact: true })
        .boundingBox())!;
      const look = (await page
        .getByLabel("Drag to look around")
        .boundingBox())!;
      const movePoint = {
        id: 1,
        x: stick.x + stick.width / 2,
        y: stick.y + stick.height / 2 - 28,
      };
      const lookPoint = {
        id: 2,
        x: look.x + look.width * 0.6,
        y: look.y + look.height * 0.42,
      };
      const jumpPoint = {
        id: 3,
        x: jump.x + jump.width / 2,
        y: jump.y + jump.height / 2,
      };
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [movePoint],
      });
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [movePoint, lookPoint],
      });
      lookPoint.x += 25;
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [movePoint, lookPoint],
      });
      const looking = await page.evaluate(() =>
        window.brickEditor!.play.stepTicks(6),
      );
      expect(
        Math.hypot(
          looking.position[0] - before.position[0],
          looking.position[2] - before.position[2],
        ),
      ).toBeGreaterThan(5);
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [movePoint, lookPoint, jumpPoint],
      });
      const moved = await page.evaluate(() =>
        window.brickEditor!.play.stepTicks(12),
      );
      expect(moved.yaw).not.toEqual(before.yaw);
      expect(
        Math.hypot(
          moved.position[0] - before.position[0],
          moved.position[2] - before.position[2],
        ),
      ).toBeGreaterThan(5);
      expect(moved.position[1]).toBeLessThan(before.position[1] - 5);
      await client.send("Input.dispatchTouchEvent", {
        type: "touchCancel",
        touchPoints: [],
      });
      const settled = await page.evaluate(() =>
        window.brickEditor!.play.stepTicks(60),
      );
      const still = await page.evaluate(() =>
        window.brickEditor!.play.stepTicks(60),
      );
      expect(still.position[0]).toBeCloseTo(settled.position[0], 2);
      expect(still.position[2]).toBeCloseTo(settled.position[2], 2);
      expect(still.grounded).toBe(true);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await expect(page.getByText("Movement is paused.")).toBeVisible();
      await page.getByRole("button", { name: "Resume exploring" }).click();
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await expect(page.getByText("Movement is paused.")).toBeVisible();
      await page.screenshot({
        path: info.outputPath(`play-${viewport.width}.png`),
      });
      await page
        .getByRole("button", { name: "Exit Play", exact: true })
        .click();
      await expect(
        page.getByRole("navigation", { name: "Mobile panels" }),
      ).toBeVisible();
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
}
