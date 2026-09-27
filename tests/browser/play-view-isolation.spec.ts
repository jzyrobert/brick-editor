import { test, expect } from "@playwright/test";
test("instruction previews cannot replace an active API Play camera and resume after exit", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    await window.brickEditor!.project.import({
      format: "template",
      template: "wall",
    });
    await window.brickEditor!.ready();
  });
  await page.getByRole("button", { name: "Instructions", exact: true }).click();
  const saved = await page.evaluate(async () => {
    const a = window.brickEditor!,
      q = await a.query();
    const plan = await a.dispatch({
      schemaVersion: 1,
      commandId: crypto.randomUUID(),
      expectedRevision: q.revision,
      type: "instructions.layers",
      payload: { maxPerStep: 10 },
    });
    const camera = {
      space: "ldraw" as const,
      projection: "perspective" as const,
      position: [300, -200, 400] as [number, number, number],
      target: [0, -30, 0] as [number, number, number],
      up: [0, -1, 0] as [number, number, number],
      fovDeg: 45,
      near: 0.5,
      far: 5000,
    };
    await a.dispatch({
      schemaVersion: 1,
      commandId: crypto.randomUUID(),
      expectedRevision: plan.revision,
      type: "instructions.step.update",
      payload: { planId: plan.addedPlanIds![0], index: 3, camera },
    });
    return camera;
  });
  await expect(
    page.getByLabel("Instruction step", { exact: true }),
  ).toHaveValue("0");
  const before = await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.play.enter({
      locomotion: "fly-noclip",
      position: [0, -120, 200],
      yaw: 0.2,
      pitch: 0.1,
    });
    return a.play.snapshot();
  });
  const capture = () =>
    page.evaluate(async () => {
      const a = window.brickEditor!,
        q = await a.query();
      return (
        await a.render.image({
          revision: q.revision,
          width: 160,
          height: 120,
          format: "png",
          visibility: { mode: "all" },
          background: { type: "solid", color: "#ffffff" },
          quality: "balanced",
          strict: true,
        })
      ).manifest.camera;
    });
  const playCamera = await capture();
  const viewport = page.getByLabel("3D build viewport", { exact: true });
  // Element screenshots include overlapping DOM panels. Hide those overlays
  // without changing layout so only the actual WebGL scene is compared.
  const sceneOnly =
    '* { visibility: hidden !important; } canvas[aria-label="3D build viewport"] { visibility: visible !important; }';
  const playPixels = await viewport.screenshot({
    style: sceneOnly,
    path: test.info().outputPath("play-before.png"),
  });
  await page.getByLabel("Instruction step", { exact: true }).fill("3");
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const afterPixels = await viewport.screenshot({
    style: sceneOnly,
    path: test.info().outputPath("play-after.png"),
  });
  await test
    .info()
    .attach("play-before", { body: playPixels, contentType: "image/png" });
  await test
    .info()
    .attach("play-after", { body: afterPixels, contentType: "image/png" });
  expect(afterPixels.equals(playPixels)).toBe(true);
  const after = await capture();
  expect(after).toEqual(playCamera);
  expect(
    await page.evaluate(() => window.brickEditor!.play.snapshot()),
  ).toEqual(before);
  await page.evaluate(() => window.brickEditor!.play.exit());
  await expect
    .poll(async () => (await capture()).position)
    .toEqual(saved.position);
});
