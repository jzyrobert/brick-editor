/** Read-only production-browser moving-mechanism resource witness.
 * Build first, serve this worktree on a private port, then run:
 * BRICK_BENCH_URL=http://127.0.0.1:4397/ npx tsx scripts/benchmark-play-moving.ts
 * Reports JSONL. SwiftShader and emulated phone dimensions are not device FPS.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { cpus, loadavg } from "node:os";
import { chromium } from "@playwright/test";
import { occurrences } from "../src/core/document";
import { importLDraw } from "../src/ldraw/io";
import { proposeMechanicalRig } from "../src/mechanisms/mechanical-proposals";
import { encodeNative } from "../src/persistence/native";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "./full-library-node";
import { playSources } from "../tests/helpers/play-dynamic-source";
import { openMode } from "../tests/browser/helpers/mode";
import { openRemoteControls } from "../tests/browser/helpers/play";
import { refusePointerLock } from "../tests/browser/helpers/pointer";

const url = process.env.BRICK_BENCH_URL;
assert(url, "Supply BRICK_BENCH_URL for this worktree's production preview");
const sourceFiles = [
  "src/play/browser.ts",
  "src/play/session.ts",
  "src/play/dynamics.ts",
  "src/play/mechanism.ts",
  "src/play/mechanical-solids.ts",
  "src/render/adapter.ts",
  "fixtures/ldraw/technic-motion.mpd",
];
const hashes = () =>
  Object.fromEntries(
    sourceFiles.map((path) => [
      path,
      createHash("sha256")
        .update(readFileSync(new URL("../" + path, import.meta.url)))
        .digest("hex"),
    ]),
  );
const initialHashes = hashes();
const original = readFileSync(
  new URL("../fixtures/ldraw/technic-motion.mpd", import.meta.url),
  "utf8",
)
  .split("\n")
  .filter((line) => line.startsWith("1 "));
assert.equal(original.length, 13);
const copy = original.map((line) => {
  const fields = line.split(/\s+/);
  fields[2] = String(Number(fields[2]) + 400);
  return fields.join(" ");
});
registerFullLibraryFromDisk();
const project = importLDraw(
  ["0 Original CC0-1.0 two-spur resource witness", ...original, ...copy].join(
    "\n",
  ),
);
const all = occurrences(project);
const proposal = proposeMechanicalRig(project, {
  id: "moving-resource-drive",
  name: "Two spur assemblies",
  expectedRevision: project.revision,
  frameOccurrenceIds: [0, 1, 10, 13, 14, 23].map((i) => all[i].id),
  motors: Object.fromEntries(
    [2, 15].map((i) => [
      all[i].id,
      {
        mode: "velocity",
        target: 90,
        maxEffort: { value: 50, unit: "N*m" },
      },
    ]),
  ),
});
assert.equal(proposal.unresolved.length, 0);
const rig = proposal.rig!;
rig.dynamics = {
  groups: Object.fromEntries(
    rig.groups
      .filter((group) => group.id !== "frame")
      .map((group) => [group.id, { massKg: 1 }]),
  ),
};
project.motionRigs[rig.id] = rig;
const prepared = await playSources(
  project,
  [rig.id],
  fullLibrarySources(all.map((o) => o.node.ref)),
);
const movingCollisionTriangles = Object.entries(prepared.sources[0].groups)
  .filter(([id]) => id !== "frame")
  .reduce((sum, [, mesh]) => sum + mesh.indices.length / 3, 0);
const bytes = Array.from(await encodeNative(project));
console.log(
  JSON.stringify({
    type: "metadata",
    url,
    node: process.version,
    cpu: cpus()[0]?.model,
    load: loadavg(),
    hashes: initialHashes,
    parts: all.length,
    groups: rig.groups.length,
    movingMembers: rig.groups
      .filter((group) => group.id !== "frame")
      .reduce((sum, group) => sum + group.occurrenceIds.length, 0),
    movingCollisionTriangles,
    samples: 12,
    warmupTicks: 30,
  }),
);
const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
try {
  for (const profile of ["desktop", "mobile"] as const)
    for (const dynamic of [false, true]) {
      const context = await browser.newContext({
        viewport:
          profile === "desktop"
            ? { width: 1440, height: 1000 }
            : { width: 390, height: 844 },
        deviceScaleFactor: profile === "mobile" ? 3 : 1,
        isMobile: profile === "mobile",
        hasTouch: profile === "mobile",
      });
      try {
        const page = await context.newPage();
        await page.addInitScript("window.__name = (f) => f");
        await refusePointerLock(page);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const cdp = await context.newCDPSession(page);
        await cdp.send("Performance.enable");
        const heapBytes = async () => {
          await cdp.send("HeapProfiler.collectGarbage");
          const { metrics } = await cdp.send("Performance.getMetrics");
          return metrics.find((metric) => metric.name === "JSHeapUsedSize")!
            .value;
        };
        await page.goto(new URL("?automation=1", url).href);
        await page.waitForFunction(() => !!window.brickEditor);
        const beforeHeap = await heapBytes();
        const before = await page.evaluate(async (bytes) => {
          const api = window.brickEditor!;
          await api.project.import({ format: "native", bytes });
          await api.ready({ strict: true });
          return {
            query: await api.query(),
            source: (await api.project.export({ format: "ldraw" })).bytes,
            profile: (await api.resources.status()).active,
            budget: await api.render.budget(),
          };
        }, bytes);
        assert.equal(before.profile, profile);
        const loadHeap = await heapBytes();
        await openMode(page, "Play");
        const entryMs = await page.evaluate(
          async ({ rigId, dynamic }) => {
            const start = performance.now();
            await window.brickEditor!.play.enter({
              rigIds: [rigId],
              dynamicRigIds: dynamic ? [rigId] : [],
              position: [1200, -0.3, 300],
              realtime: false,
            });
            return performance.now() - start;
          },
          { rigId: rig.id, dynamic },
        );
        await openRemoteControls(page);
        const playHeap = await heapBytes();
        const result = await page.evaluate(async (rigId) => {
          const api = window.brickEditor!;
          await api.play.stepTicks(30);
          const frames = [];
          for (let i = 0; i < 12; i++) {
            const beforeFrame = (await api.render.budget()).lastFrame.frames;
            const start = performance.now();
            await api.play.stepTicks(1);
            const tickMs = performance.now() - start;
            let budget = await api.render.budget();
            do {
              await new Promise(requestAnimationFrame);
              budget = await api.render.budget();
              if (performance.now() - start > 30000)
                throw new Error(
                  "Timed out waiting for a moving rendered frame",
                );
            } while (budget.lastFrame.frames <= beforeFrame);
            frames.push({
              tickMs,
              tickAndDrawIntervalMs: performance.now() - start,
              ...budget.lastFrame,
            });
          }
          const snapshot = await api.play.snapshot();
          return {
            frames,
            snapshot,
            budget: await api.render.budget(),
            view: await api.play.view(),
            collision: await api.play.collisionStats(),
            report: snapshot.mechanisms![rigId],
          };
        }, rig.id);
        for (const transmission of rig.transmissions!) {
          const a = result.report.pose.jointPositions[transmission.jointA],
            b = result.report.pose.jointPositions[transmission.jointB];
          assert(a > 45, "Both motors must advance in the measured scene");
          assert(Math.abs(b + a / 3) < 1, "Both 8:24 relations must hold");
        }
        assert.equal(result.report.blocked, false);
        await page.evaluate(() => window.brickEditor!.play.exit());
        const after = await page.evaluate(async () => ({
          query: await window.brickEditor!.query(),
          source: (
            await window.brickEditor!.project.export({ format: "ldraw" })
          ).bytes,
        }));
        assert.deepEqual(after.query, before.query);
        assert.deepEqual(after.source, before.source);
        assert.deepEqual(errors, []);
        const median = (values: number[]) =>
          [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
        console.log(
          JSON.stringify({
            type: "measurement",
            profile,
            dynamic,
            entryMs,
            heapBytes: {
              before: beforeHeap,
              afterLoad: loadHeap,
              inPlay: playHeap,
              afterExit: await heapBytes(),
            },
            tickMedianMs: median(result.frames.map((f) => f.tickMs)),
            drawSubmissionMedianMs: median(result.frames.map((f) => f.cpuMs)),
            tickAndDrawIntervalMedianMs: median(
              result.frames.map((f) => f.tickAndDrawIntervalMs),
            ),
            drawCallsMedian: median(result.frames.map((f) => f.calls)),
            trianglesMedian: median(result.frames.map((f) => f.triangles)),
            beforeBudget: before.budget,
            ...result,
            sourceUnchanged: true,
            load: loadavg(),
          }),
        );
      } finally {
        await context.close();
      }
    }
} finally {
  await browser.close();
}
assert.deepEqual(hashes(), initialHashes, "Source changed during measurement");
console.log(
  JSON.stringify({ type: "final", hashes: hashes(), load: loadavg() }),
);
