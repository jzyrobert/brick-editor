/**
 * Architectural stress benchmark: generates a ~20,000-part official-parts village
 * (tests/helpers/architectural-stress.ts) and measures import, time to first
 * render, draw statistics, JS heap, orbit frame CPU time and Play entry/frames on
 * the desktop profile and on a phone context (mobile resource profile).
 *
 *   npm run build && npx vite preview --port 4190 --strictPort --host 127.0.0.1 &
 *   BRICK_BENCH_URL=http://127.0.0.1:4190/ npm run test:stress -- [--parts N]
 *     [--variants N] [--profiles desktop,mobile] [--label name] [--no-play]
 *
 * Software WebGL (SwiftShader) numbers are only meaningful relative to each other.
 * Results go to .local/perf/stress-<label>.json.
 */
import { chromium, type BrowserContext } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import { architecturalStressModel } from "../tests/helpers/architectural-stress";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const parts = Number(arg("parts", "20000"));
const variants = Number(arg("variants", "300"));
const profiles = arg("profiles", "desktop,mobile").split(",");
const label = arg("label", `${parts}-${variants}`);
const play = !process.argv.includes("--no-play");
const url = process.env.BRICK_BENCH_URL || "http://127.0.0.1:4173/";
const model = architecturalStressModel({ parts, variants });

const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--js-flags=--expose-gc",
  ],
});
const browserCdp = await browser.newBrowserCDPSession();
/** Summed RSS (MB) of Chromium's renderer and GPU processes (Linux /proc). It
 * includes geometry buffers, which the JS heap figure leaves out. */
async function rssMb() {
  try {
    const { processInfo } = (await browserCdp.send(
      "SystemInfo.getProcessInfo" as never,
    )) as { processInfo: Array<{ type: string; id: number }> };
    let kb = 0;
    for (const p of processInfo)
      if (p.type === "renderer" || p.type === "GPU") {
        const status = readFileSync(`/proc/${p.id}/status`, "utf8");
        kb += Number(/VmRSS:\s+(\d+)/.exec(status)?.[1] ?? 0);
      }
    return Math.round(kb / 1024);
  } catch {
    return undefined;
  }
}

async function measure(context: BrowserContext, profile: string) {
  const page = await context.newPage();
  // tsx keeps function names with an injected helper that page code lacks.
  await page.addInitScript("window.__name = (f) => f");
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  const heapMb = async () => {
    await cdp.send("HeapProfiler.collectGarbage");
    const { metrics } = await cdp.send("Performance.getMetrics");
    const used = metrics.find((m) => m.name === "JSHeapUsedSize")!.value;
    return Math.round(used / 1024 / 1024);
  };
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("crash", () => errors.push("page crashed"));
  await page.goto(url + "?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const active = await page.evaluate(async () => {
    await window.brickEditor!.ready();
    return (await window.brickEditor!.resources.status()).active;
  });
  if (active !== profile)
    throw new Error(`Expected the ${profile} profile, got ${active}`);
  const heapBefore = await heapMb();
  const load = await page.evaluate(async (text) => {
    const a = window.brickEditor!;
    const t0 = performance.now();
    const imported = await a.project.import({
      format: "ldraw",
      text,
      name: "stress-village.mpd",
    });
    const importMs = performance.now() - t0;
    let failure = "";
    try {
      await a.ready({ minRevision: imported.revision, strict: true });
    } catch (e) {
      failure = (e as Error).message;
    }
    const readyMs = performance.now() - t0 - importMs;
    // First drawn frame after the scene is ready.
    const before = (await a.render.budget()).lastFrame.frames;
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    for (let i = 0; i < 600; i++) {
      await frame();
      if ((await a.render.budget()).lastFrame.frames > before) break;
    }
    const firstFrameMs = performance.now() - t0;
    const q = await a.query();
    return {
      importMs: Math.round(importMs),
      readyMs: Math.round(readyMs),
      timeToFirstRenderMs: Math.round(firstFrameMs),
      occurrences: q.occurrences.length,
      failure,
      budget: await a.render.budget(),
    };
  }, model.text);
  const heapAfterLoad = await heapMb();
  const rssAfterLoad = await rssMb();
  const orbit = load.failure
    ? undefined
    : await page.evaluate(async () => {
        const a = window.brickEditor!;
        const frame = () => new Promise((r) => requestAnimationFrame(r));
        const cpu: number[] = [],
          wall: number[] = [];
        let last = { calls: 0, triangles: 0, lines: 0 };
        for (let i = 0; i < 16; i++) {
          const angle = (i / 16) * Math.PI * 2;
          const before = (await a.render.budget()).lastFrame.frames;
          const t = performance.now();
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
          let stats = (await a.render.budget()).lastFrame;
          for (let f = 0; f < 600 && stats.frames <= before; f++) {
            await frame();
            stats = (await a.render.budget()).lastFrame;
          }
          wall.push(performance.now() - t);
          cpu.push(stats.cpuMs);
          last = stats;
        }
        const sorted = (x: number[]) => [...x].sort((p, q) => p - q);
        const median = (x: number[]) => sorted(x)[Math.floor(x.length / 2)];
        return {
          frameCpuMedianMs: +median(cpu.slice(2)).toFixed(1),
          frameCpuMaxMs: +Math.max(...cpu.slice(2)).toFixed(1),
          frameWallMedianMs: Math.round(median(wall.slice(2))),
          drawCalls: last.calls,
          triangles: last.triangles,
          lines: last.lines,
        };
      });
  const playResult =
    load.failure || !play
      ? undefined
      : await page.evaluate(async () => {
          const a = window.brickEditor!;
          const frame = () => new Promise((r) => requestAnimationFrame(r));
          // Stand on the ground just outside the village and walk into it.
          const request = {
            position: [1000, -0.3, -300] as [number, number, number],
          };
          let t = performance.now();
          let snapshot: { locomotion?: string; warnings?: string[] };
          try {
            snapshot = await a.play.enter({ ...request, realtime: false });
          } catch (e) {
            return {
              enterMs: Math.round(performance.now() - t),
              enterError: (e as Error).message,
            };
          }
          const enterMs = performance.now() - t;
          const collision = await a.play.collisionStats();
          await a.play.setInput({ moveZ: 1 });
          const ticks: number[] = [];
          for (let i = 0; i < 6; i++) {
            t = performance.now();
            await a.play.stepTicks(10);
            ticks.push((performance.now() - t) / 10);
          }
          await a.play.exit();
          t = performance.now();
          await a.play.enter({ ...request, realtime: true });
          const reenterMs = performance.now() - t;
          await a.play.setInput({ moveZ: 1 });
          const cpu: number[] = [],
            intervals: number[] = [];
          let prev = performance.now(),
            before = (await a.render.budget()).lastFrame.frames;
          for (let i = 0; i < 40; i++) {
            await frame();
            const now = performance.now();
            intervals.push(now - prev);
            prev = now;
            const stats = (await a.render.budget()).lastFrame;
            if (stats.frames > before) cpu.push(stats.cpuMs);
            before = stats.frames;
          }
          await a.play.exit();
          const sorted = (x: number[]) => [...x].sort((p, q) => p - q);
          const median = (x: number[]) =>
            x.length ? sorted(x)[Math.floor(x.length / 2)] : 0;
          return {
            enterMs: Math.round(enterMs),
            reenterMs: Math.round(reenterMs),
            locomotion: snapshot.locomotion,
            collision,
            tickMeanMs: +(
              ticks.reduce((s, v) => s + v, 0) / ticks.length
            ).toFixed(2),
            frameCpuMedianMs: +median(cpu.slice(5)).toFixed(1),
            frameIntervalMedianMs: Math.round(median(intervals.slice(5))),
            warnings: snapshot.warnings,
          };
        });
  const heapAfterPlay = await heapMb();
  const rssAfterPlay = await rssMb();
  await page.close();
  return {
    profile,
    ...load,
    heapMb: {
      before: heapBefore,
      afterLoad: heapAfterLoad,
      afterPlay: heapAfterPlay,
    },
    processRssMb: {
      afterLoad: rssAfterLoad,
      afterPlay: rssAfterPlay,
    },
    orbit,
    play: playResult,
    errors,
  };
}

const results = [];
try {
  for (const profile of profiles) {
    const phone = profile === "mobile";
    const context = await browser.newContext({
      viewport: phone
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
      deviceScaleFactor: phone ? 3 : 1,
      isMobile: phone,
      hasTouch: phone,
    });
    const result = await measure(context, profile);
    console.log(JSON.stringify(result, null, 2));
    results.push(result);
    await context.close();
  }
} finally {
  await browser.close();
}
mkdirSync(".local/perf", { recursive: true });
const report = {
  label,
  model: {
    parts: model.parts,
    variants: model.variants,
    floors: model.floors,
    bytes: model.text.length,
  },
  environment: {
    cpu: os.cpus()[0]?.model,
    cpus: os.cpus().length,
    platform: `${os.platform()} ${os.arch()}`,
    webgl: "SwiftShader (software)",
    loadAverage: os.loadavg().map((n) => +n.toFixed(1)),
  },
  results,
};
writeFileSync(
  `.local/perf/stress-${label}.json`,
  JSON.stringify(report, null, 2) + "\n",
);
