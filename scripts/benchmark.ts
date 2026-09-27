import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const start = performance.now();
  await page.goto(
    process.env.BRICK_BENCH_URL || "http://127.0.0.1:4173/?automation=1",
  );
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(() => window.brickEditor!.ready());
  const shellMs = performance.now() - start;
  const measurements = await page.evaluate(async () => {
    const a = window.brickEditor!,
      out = [];
    for (const count of [200, 1000]) {
      await a.project.import({ format: "template", template: "blank" });
      let q = await a.query();
      const parts = Array.from({ length: count }, (_, i) => ({
        ref: "3001.dat",
        colorCode: i % 2 ? "4" : "15",
        transform: {
          position: [(i % 25) * 80 - 1000, -24, Math.floor(i / 25) * 40 - 300],
          basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
        },
      }));
      let t = performance.now();
      await a.dispatch({
        schemaVersion: 1,
        commandId: "bench-add-" + count,
        expectedRevision: q.revision,
        type: "parts.add",
        payload: { parts, maxAdditions: count },
      });
      const commandMs = performance.now() - t;
      t = performance.now();
      q = await a.query();
      await a.ready({ minRevision: q.revision, strict: true });
      const sceneReadyMs = performance.now() - t;
      t = performance.now();
      const preview = await a.inventory.preview({
        expectedRevision: q.revision,
        format: "bricklink-wanted-xml",
        scope: { kind: "all" },
      });
      await a.inventory.export({
        previewId: preview.previewId,
        expectedRevision: q.revision,
        expectedMappingPackSha256: preview.mappingPackSha256,
        errorPolicy: "block",
      });
      const inventoryMs = performance.now() - t;
      await a.camera.set({
        space: "ldraw",
        projection: "perspective",
        position: [1800, -1500, 1800],
        target: [0, -12, 0],
        up: [0, -1, 0],
        fovDeg: 45,
        near: 0.5,
        far: 10000,
      });
      t = performance.now();
      const render = await a.render.image({
        revision: q.revision,
        width: 1080,
        height: 720,
        format: "png",
        visibility: { mode: "all" },
        background: { type: "solid", color: "#ffffff" },
        quality: "balanced",
        strict: true,
      });
      out.push({
        parts: count,
        commandMs,
        sceneReadyMs,
        inventoryMs,
        captureMs: performance.now() - t,
        pngBytes: render.blob.size,
        stats: render.manifest.stats,
        graphics: render.manifest.graphics,
      });
    }
    return out;
  });
  await mkdir("docs/reports", { recursive: true });
  await writeFile(
    "docs/reports/performance.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        environment: {
          platform: os.platform(),
          arch: os.arch(),
          cpu: os.cpus()[0]?.model,
          availableCPUs: os.availableParallelism(),
          browser: browser.version(),
          graphics: "SwiftShader software WebGL2",
          viewport: { width: 1440, height: 1000 },
          physicalPhone: false,
        },
        shellMs,
        measurements,
        limitations:
          "Single-run local-server smoke measurements; not p95, hardware FPS, physical-phone performance, or the 5,000-part acceptance gate.",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ shellMs, measurements }, null, 2));
} finally {
  await browser.close();
}
