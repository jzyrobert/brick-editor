/** Production-bundle look audit. See docs/RENDER-PERFORMANCE-AUDIT.md. */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import { architecturalStressModel } from "../tests/helpers/architectural-stress";
import type { SceneAdapter } from "../src/render/adapter";

const arg = (name: string, fallback: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index < 0 ? fallback : process.argv[index + 1];
};
const label = arg("label", "audit");
const parts = Number(arg("parts", "5000"));
const frames = Number(arg("frames", "8"));
const cameraMode = arg("camera", "replace");
const selectedLooks = arg(
  "looks",
  "standard,soft,realistic,photo,raster-photo",
).split(",");
const profiles = arg("profiles", "desktop,mobile").split(",");
const model = architecturalStressModel({ parts, variants: 100 });
const browser = await chromium.launch({
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const report = {
  label,
  date: new Date().toISOString(),
  parts: model.parts,
  frames,
  cameraMode,
  environment: {
    cpu: os.cpus()[0].model,
    arch: os.arch(),
    load: os.loadavg(),
    browser: browser.version(),
    graphics: "SwiftShader",
    physicalPhone: false,
  },
  results: [] as unknown[],
};
mkdirSync(".local/perf", { recursive: true });
try {
  for (const profile of profiles) {
    const context = await browser.newContext({
      viewport:
        profile === "mobile"
          ? { width: 390, height: 844 }
          : { width: 1440, height: 1000 },
      deviceScaleFactor: profile === "mobile" ? 3 : 1,
      isMobile: profile === "mobile",
      hasTouch: profile === "mobile",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(300000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/omr/**", (route) => route.abort());
    await page.route("https://gallery.bricks.robertj.in/**", (route) =>
      route.abort(),
    );
    await page.addInitScript("window.__name = (value) => value");
    await page.addInitScript(() => {
      const entries: Record<string, unknown[]> = {};
      (window as unknown as { __audit: typeof entries }).__audit = entries;
      for (const type of [
        "longtask",
        "largest-contentful-paint",
        "layout-shift",
        "paint",
      ]) {
        entries[type] = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            entries[type].push(entry.toJSON());
        }).observe({ type, buffered: true });
      }
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.start");
    const start = performance.now();
    await page.goto(
      `${process.env.BRICK_BENCH_URL ?? "http://127.0.0.1:4391/"}?automation=1`,
    );
    await page.waitForFunction(() => !!window.brickEditor);
    await page.evaluate(() => window.brickEditor!.ready());
    const shellMs = performance.now() - start;
    const active = await page.evaluate(
      async () => (await window.brickEditor!.resources.status()).active,
    );
    if (active !== profile)
      throw new Error(`Expected ${profile}, got ${active}`);
    const load = await page.evaluate(async (text) => {
      const a = window.brickEditor!;
      const start = performance.now();
      const imported = await a.project.import({
        format: "ldraw",
        text,
        name: "look-audit.mpd",
      });
      await a.ready({ minRevision: imported.revision, strict: true });
      await a.render.backdrop.set({ name: "blank", grid: false });
      return {
        readyMs: performance.now() - start,
        compile: await a.render.compileStats(),
        budget: await a.render.budget(),
      };
    }, model.text);
    const measurements = [];
    for (const look of [
      "standard",
      "soft",
      "realistic",
      "photo",
      "raster-photo",
    ] as const) {
      if (!selectedLooks.includes(look)) continue;
      console.log(`${label}: ${profile} ${look}`);
      const result = await page.evaluate(
        async ({ look, frames, cameraMode }) => {
          const a = window.brickEditor!;
          // Diagnostic access already used by the stress benchmark. Keep the drag
          // held to measure Photo's raster preview without starting a still.
          const scene = window.__brickScene as Omit<
            SceneAdapter,
            "motionHeld" | "moving" | "photoTrace"
          > & {
            controls: import("three/addons/controls/OrbitControls.js").OrbitControls;
            motionHeld: boolean;
            moving: boolean;
            photoTrace: (...args: unknown[]) => unknown;
          };
          scene.motionHeld = true;
          scene.moving = true;
          const original = scene.photoTrace;
          let traceCalls = 0,
            traceMs = 0;
          scene.photoTrace = function (...args) {
            const start = performance.now();
            try {
              return original.apply(this, args);
            } finally {
              traceCalls++;
              traceMs += performance.now() - start;
            }
          };
          const frame = () => new Promise(requestAnimationFrame);
          const samples = [];
          try {
            const start = performance.now();
            await a.render.look.set(
              look === "soft"
                ? "standard"
                : look === "raster-photo"
                  ? "photo"
                  : look,
              look === "soft"
                ? { edges: "soft" }
                : look === "raster-photo"
                  ? { renderer: "raster", samples: 1 }
                  : {},
            );
            const switchMs = performance.now() - start;
            for (let i = 0; i < frames + 2; i++) {
              const before = (await a.render.budget()).lastFrame.frames;
              const t = performance.now();
              const angle = 0.7 + i * 0.035;
              if (cameraMode === "orbit" && i > 0) {
                scene.controls.object.position.set(
                  1000 + Math.cos(angle) * 3200,
                  2200,
                  -(1000 + Math.sin(angle) * 3200),
                );
                scene.controls.update();
              } else {
                await a.camera.set({
                  space: "ldraw",
                  projection: "perspective",
                  position: [
                    1000 + Math.cos(angle) * 3200,
                    -2200,
                    1000 + Math.sin(angle) * 3200,
                  ],
                  target: [1000, -300, 1000],
                  up: [0, -1, 0],
                  fovDeg: 45,
                  near: 1,
                  far: 20000,
                });
              }
              let stats = (await a.render.budget()).lastFrame;
              for (let n = 0; stats.frames <= before && n < 600; n++) {
                await frame();
                stats = (await a.render.budget()).lastFrame;
              }
              if (stats.frames <= before) throw new Error("No frame drawn");
              // Readback fences queued GPU work so wall time is not just submission.
              const gl = scene.renderer.getContext();
              gl.finish();
              if (i >= 2)
                samples.push({ ...stats, wallMs: performance.now() - t });
            }
            return {
              look,
              switchMs,
              samples,
              traceCalls,
              traceMs,
              memory: { ...scene.renderer.info.memory },
              programs: scene.renderer.info.programs?.length,
              drawingBuffer: {
                width: scene.renderer.domElement.width,
                height: scene.renderer.domElement.height,
              },
              lookSettings: await a.render.look.get(),
            };
          } finally {
            scene.photoTrace = original;
            scene.motionHeld = false;
            scene.moving = false;
            await a.render.look.set("standard");
          }
        },
        { look, frames, cameraMode },
      );
      measurements.push(result);
    }
    const cpuProfile = await cdp.send("Profiler.stop");
    writeFileSync(
      `.local/perf/${label}-${profile}.cpuprofile`,
      JSON.stringify(cpuProfile.profile),
    );
    const diagnostics = await page.evaluate(() => ({
      entries: (window as unknown as { __audit: unknown }).__audit,
      resources: performance
        .getEntriesByType("resource")
        .map((e) => e.toJSON()),
    }));
    const accessibility = await page.locator("body").ariaSnapshot();
    writeFileSync(
      `.local/perf/${label}-${profile}-accessibility.txt`,
      accessibility,
    );
    const idle = await page.evaluate(async () => {
      const a = window.brickEditor!;
      await new Promise((resolve) => setTimeout(resolve, 500));
      const before = (await a.render.budget()).lastFrame.frames;
      await new Promise((resolve) => setTimeout(resolve, 500));
      return (await a.render.budget()).lastFrame.frames - before;
    });
    report.results.push({
      profile,
      shellMs,
      load,
      measurements,
      diagnostics,
      idleFrames: idle,
      errors,
    });
    writeFileSync(
      `.local/perf/looks-${label}.json`,
      JSON.stringify(report, null, 2) + "\n",
    );
    await context.close();
  }
} finally {
  await browser.close();
}
