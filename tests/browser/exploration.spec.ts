import { writeFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
test("actual app preserves local colours and traverses the exploration doorway and four steps", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.project.import({ format: "template", template: "explore" });
    await a.ready({ strict: true });
    const before = await a.query();
    await a.camera.set({
      space: "ldraw",
      projection: "perspective",
      position: [300, -300, 400],
      target: [0, -30, 0],
      up: [0, -1, 0],
      fovDeg: 50,
      near: 0.5,
      far: 5000,
    });
    const photo = await a.render.image({
      revision: before.revision,
      width: 400,
      height: 400,
      format: "png",
      visibility: { mode: "all" },
      background: { type: "solid", color: "#ffffff" },
      quality: "balanced",
      strict: true,
    });
    const bitmap = await createImageBitmap(photo.blob),
      canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const pixels = ctx.getImageData(0, 0, 400, 400).data;
    let orange = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (
        pixels[i] > 70 &&
        pixels[i] > pixels[i + 1] * 1.15 &&
        pixels[i + 1] > pixels[i + 2] * 1.15
      )
        orange++;
    bitmap.close();
    const entered = await a.play.enter({
      position: [0, -0.3, 220],
      ground: false,
      realtime: false,
    });
    await a.play.stepTicks(3);
    await a.play.setInput({ moveZ: 1 });
    const stairs = await a.play.stepTicks(144);
    await a.play.exit();
    await a.play.enter({
      position: [0, -0.3, 220],
      ground: true,
      realtime: false,
    });
    const inside = await a.play.teleport({ position: [0, -0.3, 125] });
    await a.play.stepTicks(3);
    const grounded = await a.play.snapshot();
    let lowCeilingRejected = false;
    try {
      await a.play.teleport({ position: [120, -0.3, -40] });
    } catch {
      lowCeilingRejected = true;
    }
    await a.play.exit();
    return {
      orange,
      entered,
      stairs,
      inside,
      grounded,
      lowCeilingRejected,
      before,
      after: await a.query(),
      png: Array.from(new Uint8Array(await photo.blob.arrayBuffer())),
    };
  });
  expect(result.orange).toBeGreaterThan(100);
  expect(result.entered.locomotion).toBe("walk");
  expect(result.stairs.grounded).toBe(true);
  expect(result.stairs.position[1]).toBeLessThan(-31);
  expect(result.stairs.position[2]).toBeLessThan(-10);
  expect(result.inside.position).toEqual([0, -0.3, 125]);
  expect(result.grounded.grounded).toBe(true);
  expect(result.lowCeilingRejected).toBe(true);
  expect(result.after).toEqual(result.before);
  await test.info().attach("exploration-colours.png", {
    body: Buffer.from(result.png),
    contentType: "image/png",
  });
});
