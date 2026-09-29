// Renders every catalogue part with the app's own LDraw/three.js pipeline into a
// small static WebP (public/thumbnails/<release>/<part>.webp). Parts are drawn
// in opaque white (glass parts too) so the UI can tint them to the held colour
// with a multiply blend, and show them as glass when that colour is
// transparent. Run after build-parts.ts and build-query-bounds.ts:
//   npx tsx scripts/build-thumbnails.ts [--only 3001,3003] [--size 128]
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { catalog, libraryLock, type CatalogPart } from "../src/catalog/catalog";
import type { Vec3 } from "../src/core/types";

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = option("--only")?.split(",");
const size = Number(option("--size") ?? 128);
const parts = Object.values(catalog).filter(
  (p) => !only || only.includes(p.id.replace(/\.dat$/, "")),
);
const out = `public/thumbnails/${libraryLock.releaseId}/`;
mkdirSync(out, { recursive: true });

// Looking direction: from above, front right, like the editor's default camera
// (LDraw axes: −Y is up).
const view = [-1, 0.8, -1.1];
const len = Math.hypot(...view);
const dir = view.map((v) => v / len);

function camera(p: CatalogPart, offset: number[]) {
  const { min, max } = p.bounds;
  const centre = [0, 1, 2].map((i) => (min[i] + max[i]) / 2 + offset[i]);
  // Screen axes: right = up × dir, up' = dir × right, with LDraw up = −Y.
  const up = [0, -1, 0];
  const cross = (a: number[], b: number[]) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const norm = (a: number[]) => a.map((v) => v / Math.hypot(...a));
  const right = norm(cross(dir, up)),
    screenUp = norm(cross(right, dir));
  let w = 0,
    h = 0;
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]])
      for (const z of [min[2], max[2]]) {
        const d = [x, y, z].map((v, i) => v - (min[i] + max[i]) / 2);
        w = Math.max(
          w,
          Math.abs(d[0] * right[0] + d[1] * right[1] + d[2] * right[2]),
        );
        h = Math.max(
          h,
          Math.abs(
            d[0] * screenUp[0] + d[1] * screenUp[1] + d[2] * screenUp[2],
          ),
        );
      }
  const span = Math.max(w, h) * 2 * 1.08;
  const distance = 4000;
  return {
    space: "ldraw" as const,
    projection: "orthographic" as const,
    position: centre.map((c, i) => c - dir[i] * distance) as Vec3,
    target: centre as Vec3,
    up: up as Vec3,
    fovDeg: 30,
    near: 1,
    far: 10000,
    span,
  };
}

const [{ createServer }, { chromium }] = await Promise.all([
  import("vite"),
  import("@playwright/test"),
]);
const server = await createServer({
  root: fileURLToPath(new URL("../", import.meta.url)),
  base: "/",
  server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
  logLevel: "error",
});
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
let bytes = 0;
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  page.setDefaultTimeout(120000);
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(server.resolvedUrls!.local[0] + "?automation=1");
  await page.waitForFunction(() => window.brickEditor?.apiVersion === "1.0");
  // The renderer budget is 128 part variants per project, so render in batches.
  for (let start = 0; start < parts.length; start += 60) {
    const batch = parts.slice(start, start + 60);
    const placed = batch.map((p, i) => ({
      part: p,
      offset: [(i % 8) * 1200, 0, Math.floor(i / 8) * 1200],
    }));
    const text =
      "0 FILE thumbnails.ldr\n" +
      placed
        .map(
          ({ part, offset }) =>
            `1 15 ${offset.join(" ")} 1 0 0 0 1 0 0 0 1 ${part.id}`,
        )
        .join("\n") +
      "\n";
    const jobs = placed.map(({ part, offset }) => ({
      id: part.id,
      camera: camera(part, offset),
      // Stud-dense baseplates turn into edge-line noise at thumbnail size.
      qualityControls: {
        edges: (Math.max(part.width, part.depth) >= 200 ? "none" : "all") as
          | "none"
          | "all",
        toneMapping: "neutral" as const,
      },
    }));
    const images = await page.evaluate(
      async ({ text, jobs, size }) => {
        const a = window.brickEditor!;
        const imported = await a.project.import({
          format: "ldraw",
          text,
          name: "Thumbnails",
          strict: true,
        });
        await a.ready({ minRevision: imported.revision, strict: true });
        const q = await a.query({});
        const result: Record<string, string> = {};
        for (const job of jobs) {
          const occurrence = q.occurrences.find(
            (o: { node: { ref: string } }) => o.node.ref === job.id,
          );
          if (!occurrence) throw new Error("Not placed: " + job.id);
          await a.camera.set(job.camera);
          const { blob } = await a.render.image({
            revision: q.revision,
            width: size * 2,
            height: size * 2,
            format: "png",
            visibility: { mode: "occurrences", occurrenceIds: [occurrence.id] },
            background: { type: "transparent" },
            quality: "balanced",
            qualityControls: job.qualityControls,
            strict: true,
          });
          const bitmap = await createImageBitmap(blob, {
            resizeWidth: size,
            resizeHeight: size,
            resizeQuality: "high",
          });
          const canvas = new OffscreenCanvas(size, size);
          canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
          const webp = await canvas.convertToBlob({
            type: "image/webp",
            quality: 0.82,
          });
          const buffer = new Uint8Array(await webp.arrayBuffer());
          let binary = "";
          for (const b of buffer) binary += String.fromCharCode(b);
          result[job.id] = btoa(binary);
        }
        return result;
      },
      { text, jobs, size },
    );
    for (const [id, base64] of Object.entries(images)) {
      const data = Buffer.from(base64, "base64");
      if (data.subarray(8, 12).toString() !== "WEBP")
        throw new Error("Not a WebP image: " + id);
      bytes += data.length;
      writeFileSync(out + id.replace(/\.dat$/, "") + ".webp", data);
    }
    console.log(
      `Rendered ${Math.min(start + 60, parts.length)}/${parts.length}`,
    );
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(JSON.stringify({ thumbnails: parts.length, bytes, size }));
