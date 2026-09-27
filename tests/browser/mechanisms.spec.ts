import { test, expect } from "@playwright/test";
test("mechanism API captures real hinged motion while preserving authored rest, then applies, undoes and reloads rigs", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.project.import({ format: "template", template: "mechanisms" });
    await a.ready({ strict: true });
    const before = await a.query(),
      rest = new TextDecoder().decode(
        (await a.project.export({ format: "ldraw" })).bytes,
      );
    await a.camera.set({
      space: "ldraw",
      projection: "perspective",
      position: [180, -110, 180],
      target: [15, -50, 0],
      up: [0, -1, 0],
      fovDeg: 45,
      near: 0.5,
      far: 5000,
    });
    const capture = async () => {
      const image = await a.render.image({
        revision: before.revision,
        width: 400,
        height: 400,
        format: "png",
        visibility: { mode: "all" },
        background: { type: "solid", color: "#ffffff" },
        quality: "balanced",
        strict: true,
      });
      return {
        hash: Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              await image.blob.arrayBuffer(),
            ),
          ),
        ).join(","),
        manifest: image.manifest,
      };
    };
    const original = await capture();
    await a.mechanisms.enter("door");
    const hinged = await a.mechanisms.setJointPosition("hinge", 90),
      posed = await capture();
    const previewQuery = await a.query(),
      previewSource = new TextDecoder().decode(
        (await a.project.export({ format: "ldraw" })).bytes,
      );
    await a.mechanisms.exit();
    const restored = await capture();
    await a.mechanisms.enter("door");
    await a.mechanisms.setJointPosition("hinge", 90);
    await a.mechanisms.applyPose();
    await a.ready({ strict: true });
    const applied = await a.query(),
      appliedSource = new TextDecoder().decode(
        (await a.project.export({ format: "ldraw" })).bytes,
      );
    await a.dispatch({
      schemaVersion: 1,
      commandId: "undo-mechanism-pose",
      expectedRevision: applied.revision,
      type: "history.undo",
      payload: {},
    });
    const undoneSource = new TextDecoder().decode(
      (await a.project.export({ format: "ldraw" })).bytes,
    );
    await a.mechanisms.enter("vehicle");
    await a.mechanisms.setVehicleInput({ throttle: 1, steering: 0 });
    const vehicle = await a.mechanisms.stepTicks(60);
    await a.mechanisms.exit();
    const native = await a.project.export({ format: "native" });
    await a.project.import({
      format: "native",
      bytes: Array.from(native.bytes),
    });
    await a.ready({ strict: true });
    const reloaded = await a.mechanisms.enter("door");
    const reopened = await a.mechanisms.setJointPosition("hinge", 90);
    await a.mechanisms.exit();
    return {
      before,
      previewQuery,
      rest,
      previewSource,
      original,
      posed,
      restored,
      hinged,
      applied,
      appliedSource,
      undoneSource,
      vehicle,
      reloaded,
      reopened,
    };
  });
  expect(result.posed.hash).not.toBe(result.original.hash);
  expect(result.restored.hash).toBe(result.original.hash);
  expect(result.previewQuery.revision).toBe(result.before.revision);
  expect(result.previewQuery.occurrences).toEqual(result.before.occurrences);
  expect(result.previewSource).toBe(result.rest);
  expect(result.posed.manifest.mechanism!.pose.jointPositions.hinge).toBe(90);
  expect(result.applied.revision).toBe(result.before.revision + 1);
  expect(result.appliedSource).not.toBe(result.rest);
  expect(result.undoneSource).toBe(result.rest);
  expect(result.vehicle.tick).toBe(60);
  expect(result.vehicle.pose.vehicle!.position[2]).toBeCloseTo(-100);
  expect(result.vehicle.pose.vehicle!.wheelAngles["left-front"]).toBeCloseTo(
    ((100 / 12) * 180) / Math.PI,
  );
  expect(result.reloaded.pose.jointPositions.hinge).toBe(0);
  expect(result.reopened.transforms).toEqual(result.hinged.transforms);
  expect(errors).toEqual([]);
});
test("Play mechanisms panel operates a hinge and explicitly applies its pose", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const revision = await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.project.import({ format: "template", template: "mechanisms" });
    await a.ready({ strict: true });
    return (await a.query()).revision;
  });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByLabel("Authored rig").selectOption("door");
  await page
    .getByRole("button", { name: "Preview mechanism", exact: true })
    .click();
  const slider = page.getByRole("slider", { name: "hinge position" });
  await expect(slider).toBeVisible();
  await slider.focus();
  await slider.press("End");
  await expect(slider).toHaveValue("110");
  expect(
    await page.evaluate(
      async () => (await window.brickEditor!.query()).revision,
    ),
  ).toBe(revision);
  await page
    .getByRole("button", { name: "Apply pose to build", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Preview mechanism", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      async () => (await window.brickEditor!.query()).revision,
    ),
  ).toBe(revision + 1);
});
