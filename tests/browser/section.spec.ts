import { test, expect } from "@playwright/test";
import { openMode } from "./helpers/mode";

test("section cut hides parts above a height, is recorded in captures and pauses in Play", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(() =>
    window
      .brickEditor!.project.import({
        format: "ldraw",
        text: "0 FILE s.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n1 1 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat\n1 14 0 -48 0 1 0 0 0 1 0 0 0 1 3001.dat",
      })
      .then(() => window.brickEditor!.ready()),
  );
  const colours = async () =>
    page.evaluate(async () => {
      const a = window.brickEditor!,
        q = await a.query();
      await a.camera.set({
        space: "ldraw",
        projection: "orthographic",
        position: [0, -40, -300],
        target: [0, -40, 0],
        up: [0, -1, 0],
        fovDeg: 45,
        near: 0.5,
        far: 5000,
        span: 160,
      });
      const r = await a.render.image({
        revision: q.revision,
        width: 160,
        height: 160,
        format: "png",
        visibility: { mode: "all" },
        background: { type: "solid", color: "#ffffff" },
        quality: "fast",
      });
      const bitmap = await createImageBitmap(r.blob),
        canvas = document.createElement("canvas");
      canvas.width = canvas.height = 160;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      const d = ctx.getImageData(0, 0, 160, 160).data;
      let yellow = 0,
        blue = 0,
        red = 0;
      for (let i = 0; i < d.length; i += 4) {
        const [rr, g, b] = [d[i], d[i + 1], d[i + 2]];
        if (rr > 180 && g > 140 && b < 110) yellow++;
        if (b > rr * 1.4 && b > g * 1.1) blue++;
        if (rr > g * 1.5 && rr > b * 1.5) red++;
      }
      return { yellow, blue, red, planes: r.manifest.clipping.planes.length };
    });
  const whole = await colours();
  expect(whole.yellow).toBeGreaterThan(200);
  expect(whole.planes).toBe(0);
  // Turn the cut on from the camera-views popover and drag it to 2 bricks (6 plates) up.
  await page.getByRole("button", { name: "Camera views" }).click();
  await page.getByRole("button", { name: "Section cut" }).click();
  await page.getByRole("slider", { name: "Section height" }).fill("6");
  await expect(page.locator(".section-label")).toHaveText("Cut 6 plates up");
  const cut = await colours();
  expect(cut.planes).toBe(1);
  expect(cut.yellow).toBeLessThan(20); // top brick removed
  expect(cut.blue).toBeGreaterThan(200); // middle brick still there
  expect(
    await page.evaluate(() => window.brickEditor!.render.section.get()),
  ).toMatchObject({ height: -24 });
  // Play shares the renderer: the cut is suspended there and restored on return.
  await openMode(page, "Play");
  expect(
    (await page.evaluate(() => window.brickEditor!.render.section.get()))
      .height,
  ).toBeNull();
  await openMode(page, "Build");
  expect(
    (await page.evaluate(() => window.brickEditor!.render.section.get()))
      .height,
  ).toBe(-24);
  expect(errors).toEqual([]);
});

test("vertical section cuts keep one side and flip to the other", async ({
  page,
}) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const counts = (cut: object | null) =>
    page.evaluate(async (cut) => {
      const a = window.brickEditor!;
      await a.render.section.set(cut as never);
      const q = await a.query();
      await a.camera.set({
        space: "ldraw",
        projection: "orthographic",
        position: [60, -12, -400],
        target: [60, -12, 0],
        up: [0, -1, 0],
        fovDeg: 45,
        near: 0.5,
        far: 5000,
        span: 120,
      });
      const r = await a.render.image({
        revision: q.revision,
        width: 200,
        height: 120,
        format: "png",
        visibility: { mode: "all" },
        background: { type: "solid", color: "#ffffff" },
        quality: "fast",
      });
      const bitmap = await createImageBitmap(r.blob),
        canvas = document.createElement("canvas");
      canvas.width = 200;
      canvas.height = 120;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      const d = ctx.getImageData(0, 0, 200, 120).data;
      let red = 0,
        blue = 0;
      for (let i = 0; i < d.length; i += 4) {
        const [rr, g, b] = [d[i], d[i + 1], d[i + 2]];
        if (rr > g * 1.5 && rr > b * 1.5) red++;
        if (b > rr * 1.4 && b > g * 1.1) blue++;
      }
      return { red, blue };
    }, cut);
  await page.evaluate(() =>
    window
      .brickEditor!.project.import({
        format: "ldraw",
        text: "0 FILE v.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3003.dat\n1 1 120 0 0 1 0 0 0 1 0 0 0 1 3003.dat",
      })
      .then(() => window.brickEditor!.ready()),
  );
  const both = await counts(null);
  expect(both.red).toBeGreaterThan(200);
  expect(both.blue).toBeGreaterThan(200);
  const left = await counts({ axis: "x", at: 60 });
  expect(left.red).toBeGreaterThan(200);
  expect(left.blue).toBeLessThan(20);
  const right = await counts({ axis: "x", at: 60, flip: true });
  expect(right.red).toBeLessThan(20);
  expect(right.blue).toBeGreaterThan(200);
  expect(
    (await page.evaluate(() => window.brickEditor!.render.section.get())).plane,
  ).toEqual({ axis: "x", at: 60, flip: true });
});
