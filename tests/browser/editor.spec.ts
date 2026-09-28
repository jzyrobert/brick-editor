import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { openMode } from "./helpers/mode";
test("200-part UI fill, edit/undo, native round trip, offline inventory and exact PNG", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(() => window.brickEditor!.ready());
  await page.getByRole("button", { name: "More tools" }).click();
  await page.getByRole("button", { name: "Rectangular fill" }).click();
  await page.getByLabel("Columns", { exact: true }).fill("20");
  await page.getByLabel("Rows", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Preview fill" }).click();
  await page.getByRole("button", { name: "Commit 200 parts" }).click();
  await expect(page.locator(".canvas-bottom")).toContainText("200 parts");
  const result = await page.evaluate(async () => {
    const a = window.brickEditor!,
      q = await a.query();
    await a.ready({ minRevision: q.revision, strict: true });
    const first = q.occurrences[0];
    await a.dispatch({
      schemaVersion: 1,
      commandId: "paint",
      expectedRevision: q.revision,
      type: "parts.recolor",
      payload: { occurrenceIds: [first.id], colorCode: "1" },
    });
    await a.dispatch({
      schemaVersion: 1,
      commandId: "undo",
      expectedRevision: q.revision + 1,
      type: "history.undo",
      payload: {},
    });
    const before = await a.query();
    const native = await a.project.export({ format: "native" });
    await a.project.import({
      format: "native",
      bytes: Array.from(native.bytes),
    });
    const after = await a.query();
    const preview = await a.inventory.preview({
      expectedRevision: after.revision,
      format: "bricklink-wanted-xml",
      scope: { kind: "all" },
    });
    const xml = await a.inventory.export({
      previewId: preview.previewId,
      expectedRevision: after.revision,
      expectedMappingPackSha256: preview.mappingPackSha256,
      errorPolicy: "block",
    });
    const camera = {
      space: "ldraw" as const,
      projection: "perspective" as const,
      position: [0, -70, 100] as [number, number, number],
      target: [0, -70, -140] as [number, number, number],
      up: [0, -1, 0] as [number, number, number],
      fovDeg: 65,
      near: 0.5,
      far: 10000,
    };
    await a.ready({ minRevision: after.revision, strict: true });
    await a.camera.set(camera);
    const image = await a.render.image({
      revision: after.revision,
      width: 640,
      height: 480,
      format: "png",
      visibility: { mode: "all" },
      background: { type: "transparent" },
      quality: "photo",
      strict: true,
    });
    const bitmap = await createImageBitmap(image.blob);
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const pixels = ctx.getImageData(0, 0, 640, 480).data;
    return {
      same:
        before.occurrences.map((o) => o.id).join() ===
        after.occurrences.map((o) => o.id).join(),
      xml: new TextDecoder().decode(xml.bytes),
      count: preview.resolvedPhysicalUnitCount,
      manifest: image.manifest,
      dimensions: [bitmap.width, bitmap.height],
      nonempty: pixels.some((v, i) => i % 4 === 3 && v > 0),
      transparent: pixels.some((v, i) => i % 4 === 3 && v === 0),
      bytes: Array.from(new Uint8Array(await image.blob.arrayBuffer())),
    };
  });
  expect(result.same).toBe(true);
  expect(result.count).toBe(200);
  expect(result.xml).toContain("<MINQTY>200</MINQTY>");
  expect(result.dimensions).toEqual([640, 480]);
  expect(result.nonempty).toBe(true);
  expect(result.transparent).toBe(true);
  expect(result.manifest.camera.position).toEqual([0, -70, 100]);
  expect(errors).toEqual([]);
  await testInfo.attach("interior.png", {
    body: Buffer.from(result.bytes),
    contentType: "image/png",
  });
  await testInfo.attach("manifest.json", {
    body: JSON.stringify(result.manifest, null, 2),
    contentType: "application/json",
  });
});
test("desktop template renders real geometry and exports inventory in the UI", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?automation=1");
  await page
    .getByRole("button", { name: "Explore the studio template" })
    .click();
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    const q = await a.query();
    await a.ready({ minRevision: q.revision, strict: true });
  });
  await expect(page.locator(".canvas-bottom")).toContainText("74 parts");
  await page.screenshot({ path: info.outputPath("desktop.png") });
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: "Preview parts list" }).click();
  await expect(
    page.getByRole("button", { name: "Download XML" }),
  ).toBeEnabled();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download XML" }).click();
  expect((await download).suggestedFilename()).toBe("wanted-list.xml");
  expect(errors).toEqual([]);
});
for (const viewport of [
  { width: 1080, height: 1800 },
  { width: 360, height: 800 },
])
  test(`touch layout ${viewport.width}x${viewport.height}: place, save and export`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport,
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/?automation=1");
    await page.waitForFunction(() => !!window.brickEditor);
    await page.evaluate(() => window.brickEditor!.ready());
    await page.getByRole("button", { name: /Brick 2 × 4 3001/ }).click();
    await page
      .locator(".mobile-sheet-head")
      .getByRole("button", { name: "Close" })
      .click();
    await page.getByRole("button", { name: "Place part", exact: true }).click();
    await expect(page.locator(".canvas-bottom")).toContainText("1 parts");
    const save = page.waitForEvent("download");
    await page.getByRole("button", { name: "Save project" }).click();
    expect((await save).suggestedFilename()).toMatch(/brickproj$/);
    await page.getByRole("button", { name: "Export", exact: true }).click();
    await page.getByRole("button", { name: "Preview parts list" }).click();
    await expect(
      page.getByRole("button", { name: "Download XML" }),
    ).toBeEnabled();
    await page.screenshot({
      path: info.outputPath(`mobile-${viewport.width}.png`),
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await context.close();
  });
test("strict render rejects unsupported texture metadata and API is opt in", async ({
  page,
}) => {
  await page.goto("/");
  await expect
    .poll(() => page.evaluate(() => !!window.brickEditor))
    .toBe(false);
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const error = await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.project.import({
      format: "ldraw",
      text: "0 !TEXMAP START PLANAR 0 0 0 1 0 0 0 1 0 image.png\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
    });
    try {
      await a.ready({ strict: true });
      return "no error";
    } catch (e) {
      return (e as Error).message;
    }
  });
  expect(error).toContain("Strict render refuses");
});

test("custom fixed-colour decoration survives body repaint; mirrored and conditional lines render", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const text = await readFile("fixtures/ldraw/custom.mpd", "utf8");
  const images = await page.evaluate(async (text) => {
    const a = window.brickEditor!;
    await a.project.import({ format: "ldraw", text });
    const camera = {
      space: "ldraw" as const,
      projection: "orthographic" as const,
      position: [0, -40, -150] as [number, number, number],
      target: [0, -40, 0] as [number, number, number],
      up: [0, -1, 0] as [number, number, number],
      fovDeg: 45,
      near: 0.5,
      far: 10000,
      span: 110,
    };
    await a.camera.set(camera);
    const capture = async () => {
      const q = await a.query();
      await a.ready({ strict: true, minRevision: q.revision });
      const r = await a.render.image({
        revision: q.revision,
        width: 256,
        height: 256,
        format: "png",
        visibility: { mode: "all" },
        background: { type: "solid", color: "#ffffff" },
        quality: "photo",
        strict: true,
      });
      const b = await createImageBitmap(r.blob),
        c = document.createElement("canvas");
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(b, 0, 0);
      const pixels = ctx.getImageData(0, 0, 256, 256).data;
      let red = 0,
        blue = 0,
        yellow = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const [r, g, b] = pixels.slice(i, i + 3);
        if (r > g * 1.4 && r > b * 1.4) red++;
        if (b > r * 1.4 && b > g * 1.1) blue++;
        if (r > 180 && g > 130 && b < 100) yellow++;
      }
      return { red, blue, yellow };
    };
    const before = await capture(),
      q = await a.query();
    await a.dispatch({
      schemaVersion: 1,
      commandId: "custom-paint",
      expectedRevision: q.revision,
      type: "parts.recolor",
      payload: { occurrenceIds: [q.occurrences[0].id], colorCode: "1" },
    });
    const after = await capture();
    const q2 = await a.query();
    await a.dispatch({
      schemaVersion: 1,
      commandId: "mirror",
      expectedRevision: q2.revision,
      type: "parts.transform",
      payload: {
        occurrenceIds: [q2.occurrences[0].id],
        space: "ldraw",
        transform: {
          position: [0, -24, 0],
          basis: [-1, 0, 0, 0, 1, 0, 0, 0, 1],
        },
      },
    });
    const mirrored = await capture();
    return { before, after, mirrored };
  }, text);
  expect(images.before.red).toBeGreaterThan(100);
  expect(images.before.yellow).toBeGreaterThan(10);
  expect(images.after.blue).toBeGreaterThan(100);
  expect(images.after.yellow).toBe(images.before.yellow);
  expect(images.mirrored.blue).toBeGreaterThan(100);
});
test("pinch gesture never places a part; rejected locked mutation is atomic; offline inventory stays available", async ({
  page,
  context,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page
    .locator(".tool-segment button")
    .filter({ hasText: "Place" })
    .click();
  const canvas = page.locator(".viewport canvas");
  await canvas.dispatchEvent("pointerdown", {
    pointerId: 10,
    pointerType: "touch",
    clientX: 600,
    clientY: 400,
  });
  await canvas.dispatchEvent("pointerdown", {
    pointerId: 11,
    pointerType: "touch",
    clientX: 700,
    clientY: 400,
  });
  await canvas.dispatchEvent("pointerup", {
    pointerId: 10,
    pointerType: "touch",
    clientX: 650,
    clientY: 400,
  });
  await canvas.dispatchEvent("pointerup", {
    pointerId: 11,
    pointerType: "touch",
    clientX: 700,
    clientY: 400,
  });
  expect(
    (await page.evaluate(() => window.brickEditor!.query())).occurrences,
  ).toHaveLength(0);
  await page.evaluate(async () => {
    await window.brickEditor!.project.import({
      format: "template",
      template: "200",
    });
    await window.brickEditor!.ready();
  });
  await context.setOffline(true);
  const result = await page.evaluate(async () => {
    const a = window.brickEditor!,
      q = await a.query();
    await a.dispatch({
      schemaVersion: 1,
      commandId: "lock",
      expectedRevision: q.revision,
      type: "layers.update",
      payload: { layerId: "base", locked: true },
    });
    const locked = await a.query();
    let refused = false;
    try {
      await a.dispatch({
        schemaVersion: 1,
        commandId: "remove",
        expectedRevision: locked.revision,
        type: "parts.remove",
        payload: { occurrenceIds: locked.occurrences.map((o) => o.id) },
      });
    } catch {
      refused = true;
    }
    const after = await a.query();
    const preview = await a.inventory.preview({
      expectedRevision: after.revision,
      format: "bricklink-wanted-xml",
      scope: { kind: "all" },
    });
    return {
      refused,
      count: after.occurrences.length,
      canExport: preview.canExportComplete,
    };
  });
  expect(result).toEqual({ refused: true, count: 200, canExport: true });
});

test("Photo UI exports a transparent PNG with the selected dimensions", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    await window.brickEditor!.project.import({
      format: "template",
      template: "room",
    });
    await window.brickEditor!.ready({ strict: true });
  });
  await openMode(page, "Photo");
  await page.getByLabel("Width", { exact: true }).fill("320");
  await page.getByLabel("Height", { exact: true }).fill("240");
  await page.getByLabel("Transparent background").check();
  const download = page.waitForEvent("download", {
    predicate: (d) => d.suggestedFilename().endsWith(".png"),
  });
  await page.getByRole("button", { name: "Download PNG + manifest" }).click();
  const file = await download;
  const bytes = await readFile((await file.path())!);
  expect(bytes.readUInt32BE(16)).toBe(320);
  expect(bytes.readUInt32BE(20)).toBe(240);
});
test("cancelled import leaves the authored document unchanged", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async () => {
    const a = window.brickEditor!,
      before = await a.query();
    const pending = a.project.import({
      format: "ldraw",
      text: Array.from(
        { length: 5000 },
        (_, i) => `1 4 ${i * 80} -24 0 1 0 0 0 1 0 0 0 1 3001.dat`,
      ).join("\n"),
    });
    const jobs = await a.jobs.list();
    const job = jobs.find((j) => j.state === "running")!;
    await a.jobs.cancel(job.id);
    let code = "";
    try {
      await pending;
    } catch (e) {
      code = (e as { code: string }).code;
    }
    const after = await a.query();
    return {
      code,
      before: before.revision,
      after: after.revision,
      count: after.occurrences.length,
      status: (await a.jobs.status(job.id)).state,
    };
  });
  expect(result.code).toBe("CANCELLED");
  expect(result.after).toBe(result.before);
  expect(result.count).toBe(0);
  expect(result.status).toBe("cancelled");
});
