/** Matched captures and cold-start measurements; see RENDER-PERFORMANCE-AUDIT.md. */
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? fallback : process.argv[i + 1];
};
const label = arg("label", "audit");
const repeats = Number(arg("repeats", "3"));
const seeded = process.argv.includes("--seeded");
const startupRuns = Number(arg("startup-runs", "3"));
const selectedLooks = arg(
  "looks",
  "standard,soft,realistic,raster-photo,photo",
).split(",");
const url = process.env.BRICK_BENCH_URL ?? "http://127.0.0.1:4391/";
const browser = await chromium.launch({
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const report = {
  label,
  seeded,
  date: new Date().toISOString(),
  browser: browser.version(),
  load: os.loadavg(),
  startup: [] as unknown[],
  captures: [] as unknown[],
};
mkdirSync(".local/perf", { recursive: true });
try {
  for (let run = 0; run < startupRuns; run++) {
    const context = await browser.newContext({
      viewport: { width: 720, height: 520 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(300000);
    await page.route("**/api/omr/**", (route) => route.abort());
    await page.route("https://gallery.bricks.robertj.in/**", (route) =>
      route.abort(),
    );
    await page.addInitScript("window.__name = (value) => value");
    const t = performance.now();
    await page.goto(`${url}?automation=1`);
    await page.waitForFunction(() => !!window.brickEditor);
    await page.evaluate(() => window.brickEditor!.ready());
    const readyMs = performance.now() - t;
    const startup = await page.evaluate(() => ({
      resources: performance
        .getEntriesByType("resource")
        .map((entry) => entry.toJSON()),
      paint: performance
        .getEntriesByType("paint")
        .map((entry) => entry.toJSON()),
    }));
    report.startup.push({ run, readyMs, ...startup });
    console.log(label, "startup", run, Math.round(readyMs));
    if (run === startupRuns - 1 && !process.argv.includes("--startup-only")) {
      const revision = await page.evaluate(
        async (text) => {
          const a = window.brickEditor!;
          const result = await a.project.import({
            format: "ldraw",
            text,
            name: "finishes.mpd",
          });
          await a.ready({ minRevision: result.revision, strict: true });
          await a.camera.set({
            space: "ldraw",
            projection: "perspective",
            position: [330, -230, 400],
            target: [-30, -40, 0],
            up: [0, -1, 0],
            fovDeg: 45,
            near: 0.5,
            far: 50000,
          });
          return result.revision;
        },
        readFileSync("fixtures/ldraw/finishes.mpd", "utf8"),
      );
      for (const look of [
        "standard",
        "soft",
        "realistic",
        "raster-photo",
        "photo",
      ] as const) {
        if (!selectedLooks.includes(look)) continue;
        for (let repeat = 0; repeat < repeats; repeat++) {
          console.log(label, look, repeat);
          const result = await page.evaluate(
            async ({ revision, look, seeded }) => {
              if (seeded) {
                // Fix GTAO/blue-noise texture generation for cross-build image
                // comparisons. This changes only the benchmark page.
                let state = 0x5eed;
                Math.random = () => {
                  state = (Math.imul(1664525, state) + 1013904223) | 0;
                  return (state >>> 0) / 4294967296;
                };
              }
              const a = window.brickEditor!;
              const start = performance.now();
              const image = await a.render.image({
                revision,
                width: 160,
                height: 120,
                format: "png",
                visibility: { mode: "all" },
                background: { type: "solid", color: "#e9edef" },
                quality: "balanced",
                strict: true,
                look:
                  look === "soft"
                    ? "standard"
                    : look === "raster-photo"
                      ? "photo"
                      : look,
                lookControls:
                  look === "soft"
                    ? { edges: "soft" }
                    : look === "raster-photo"
                      ? { renderer: "raster", samples: 4 }
                      : look === "photo"
                        ? { pathSamples: 4 }
                        : {},
              });
              const captureMs = performance.now() - start;
              return {
                captureMs,
                memory: {
                  ...(
                    window.__brickScene as import("../src/render/adapter").SceneAdapter
                  ).renderer.info.memory,
                },
                programs: (
                  window.__brickScene as import("../src/render/adapter").SceneAdapter
                ).renderer.info.programs?.length,
                manifest: image.manifest,
                bytes: Array.from(
                  new Uint8Array(await image.blob.arrayBuffer()),
                ),
              };
            },
            { revision, look, seeded },
          );
          writeFileSync(
            `.local/perf/${label}-${look}-${repeat}.png`,
            Buffer.from(result.bytes),
          );
          const { bytes, ...measurement } = result;
          report.captures.push({
            look,
            repeat,
            pngBytes: bytes.length,
            ...measurement,
          });
          writeFileSync(
            `.local/perf/captures-${label}.json`,
            JSON.stringify(report, null, 2) + "\n",
          );
        }
      }
    }
    await context.close();
  }
  writeFileSync(
    `.local/perf/captures-${label}.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
