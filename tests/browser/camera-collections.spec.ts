import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
import { openMode } from "./helpers/mode";

test("camera collections render named bookmarks from one revision with a shared manifest", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.project.import({ format: "template", template: "room" });
    await a.ready();
    const camera = (z: number) => ({
      space: "ldraw" as const,
      projection: "perspective" as const,
      position: [300, -250, z] as [number, number, number],
      target: [0, -40, 0] as [number, number, number],
      up: [0, -1, 0] as [number, number, number],
      fovDeg: 45,
      near: 1,
      far: 20000,
    });
    for (const [name, z] of [
      ["exterior/front", 500],
      ["exterior/rear", -500],
      ["interior/kitchen", 80],
    ] as const)
      await a.dispatch({
        schemaVersion: 1,
        commandId: crypto.randomUUID(),
        expectedRevision: (await a.query()).revision,
        type: "camera.bookmark",
        payload: { name, camera: camera(z) },
      });
    await a.camera.set(camera(900));
    const r = await a.render.collection({
      prefix: "exterior/",
      width: 160,
      height: 120,
    });
    const missing = await a.render
      .collection({ prefix: "roof/", width: 160, height: 120 })
      .then(
        () => "rendered",
        (e) => e.message,
      );
    return {
      manifest: r.manifest,
      sizes: r.images.map((i) => i.blob.size),
      revision: (await a.query()).revision,
      missing,
    };
  });
  expect(result.manifest.images.map((i) => i.name)).toEqual([
    "exterior/front",
    "exterior/rear",
  ]);
  expect(result.manifest.images.map((i) => i.file)).toEqual([
    "exterior-front.png",
    "exterior-rear.png",
  ]);
  expect(result.manifest.revision).toBe(result.revision);
  expect(result.manifest.documentHash).toMatch(/^[0-9a-f]{64}$/);
  expect(result.sizes.every((n) => n > 500)).toBe(true);
  expect(result.missing).toMatch(/No camera bookmarks start with “roof\/”/);

  // Photo mode: pick the collection and download a ZIP of PNGs plus manifest.
  await openMode(page, "Photo");
  await page.locator("summary", { hasText: "Camera collection" }).click();
  await page
    .getByRole("combobox", { name: "Collection", exact: true })
    .selectOption("interior/");
  const zip = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download 1 view/ }).click();
  const file = await zip;
  expect(file.suggestedFilename()).toMatch(/^interior-r\d+\.zip$/);
  const entries = unzipSync(
    new Uint8Array(await readFile((await file.path())!)),
  );
  expect(Object.keys(entries).sort()).toEqual([
    "interior-kitchen.png",
    "manifest.json",
  ]);
  expect(JSON.parse(strFromU8(entries["manifest.json"])).collection).toBe(
    "interior/",
  );
  expect(errors).toEqual([]);
});
