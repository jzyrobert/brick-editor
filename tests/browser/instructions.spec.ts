import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { unzipSync, strFromU8 } from "fflate";
import { openMode } from "./helpers/mode";

test("instruction UI publishes real cumulative PNGs and a printable PDF", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.project.import({
      format: "ldraw",
      name: "two-steps.mpd",
      text: "0 Two steps\n1 4 -80 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n1 1 80 0 0 1 0 0 0 1 0 0 0 1 3003.dat",
    });
    const q = await a.query();
    await a.dispatch({
      schemaVersion: 1,
      commandId: "publish-steps",
      expectedRevision: q.revision,
      type: "instructions.layers",
      payload: { maxPerStep: 1 },
    });
    await a.ready({ strict: true });
  });
  await openMode(page, "Instructions");
  const publication = page.getByRole("region", {
    name: "Publish instructions",
  });
  await publication.getByLabel("Image size").selectOption("640");
  await publication.getByLabel("Publication format").selectOption("png-zip");
  let download = page.waitForEvent("download");
  await publication
    .getByRole("button", { name: "Download publication" })
    .click();
  let artifact = await download;
  const files = unzipSync(await readFile((await artifact.path())!));
  expect(Object.keys(files)).toContain("step-001.png");
  expect(Object.keys(files)).toContain("step-002.png");
  expect(files["step-001.png"]).not.toEqual(files["step-002.png"]);
  const coverage = JSON.parse(strFromU8(files["instructions.json"]));
  expect(coverage.coverage).toEqual({
    intended: 2,
    introduced: 2,
    complete: true,
  });
  expect(coverage.assemblyValidated).toBe(false);
  const pixels = await page.evaluate(async (bytes) => {
    const bitmap = await createImageBitmap(
      new Blob([new Uint8Array(bytes)], { type: "image/png" }),
    );
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let colored = 0;
    for (let i = 0; i < data.length; i += 4)
      if (data[i] < 240 || data[i + 1] < 240 || data[i + 2] < 240) colored++;
    return { width: canvas.width, height: canvas.height, colored };
  }, Array.from(files["step-002.png"]));
  expect(pixels.width).toBe(640);
  expect(pixels.height).toBe(480);
  expect(pixels.colored).toBeGreaterThan(100);
  await publication.getByLabel("Publication format").selectOption("pdf");
  download = page.waitForEvent("download");
  await publication
    .getByRole("button", { name: "Download publication" })
    .click();
  artifact = await download;
  const pdf = await PDFDocument.load(await readFile((await artifact.path())!));
  expect(pdf.getPageCount()).toBe(4);
});

test("instruction cancellation leaves authored revision and camera unchanged", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.project.import({ format: "template", template: "200" });
    const q = await a.query();
    await a.dispatch({
      schemaVersion: 1,
      commandId: "cancel-steps",
      expectedRevision: q.revision,
      type: "instructions.layers",
      payload: { maxPerStep: 5 },
    });
    await a.ready();
  });
  await openMode(page, "Instructions");
  const savedCamera = await page.evaluate(async () => {
    const camera = {
      space: "ldraw" as const,
      projection: "perspective" as const,
      position: [100, -200, 300] as [number, number, number],
      target: [0, -20, 0] as [number, number, number],
      up: [0, -1, 0] as [number, number, number],
      fovDeg: 50,
      near: 0.5,
      far: 10000,
    };
    await window.brickEditor!.camera.set(camera);
    return camera;
  });
  const before = await page.evaluate(() => window.brickEditor!.query());
  const publication = page.getByRole("region", {
    name: "Publish instructions",
  });
  await publication.getByLabel("Publication format").selectOption("png-zip");
  let downloads = 0;
  page.on("download", () => downloads++);
  await publication
    .getByRole("button", { name: "Download publication" })
    .click();
  await publication.getByRole("button", { name: "Cancel publication" }).click();
  await expect(publication.getByRole("status")).toHaveText("Cancelled");
  await expect(
    publication.getByRole("button", { name: "Download publication" }),
  ).toBeEnabled();
  expect(downloads).toBe(0);
  expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
    before,
  );
  const restored = await page.evaluate(async () => {
    const a = window.brickEditor!,
      q = await a.query();
    return (
      await a.render.image({
        revision: q.revision,
        width: 64,
        height: 64,
        format: "png",
        visibility: { mode: "all" },
        background: { type: "solid", color: "#ffffff" },
        quality: "fast",
        strict: true,
      })
    ).manifest.camera;
  });
  expect(JSON.parse(JSON.stringify(restored))).toEqual(savedCamera);
});
