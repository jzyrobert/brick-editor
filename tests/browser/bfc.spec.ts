import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "vite";
import { expect, test } from "@playwright/test";

test("independent occurrence BFC pixels match a whole-MPD hand-expanded reference from both sides", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const bundled = await build({
    configFile: false,
    logLevel: "silent",
    build: {
      write: false,
      minify: true,
      lib: {
        entry: resolve("tests/browser/helpers/bfc-reference.ts"),
        formats: ["iife"],
        name: "BfcReference",
      },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  const bundle = Array.isArray(bundled) ? bundled[0] : bundled;
  if (!("output" in bundle)) throw new Error("Expected reference bundle");
  const code = bundle.output
    .filter((o) => o.type === "chunk")
    .map((o) => o.code)
    .join("\n");
  await page.route("**/__bfc-reference.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: code }),
  );
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.addScriptTag({ url: "/__bfc-reference.js" });
  const source = await readFile("fixtures/ldraw/bfc-branches.mpd", "utf8");
  const expected = await readFile(
    "fixtures/ldraw/bfc-branches.expected.mpd",
    "utf8",
  );
  const comparisons = await page.evaluate(
    async ({ source, expected }) => {
      const a = window.brickEditor!;
      await a.project.import({ format: "ldraw", text: source });
      const q = await a.query();
      await a.ready({ minRevision: q.revision, strict: true });
      const results = [];
      for (const z of [-300, 300]) {
        await a.camera.set({
          space: "ldraw",
          projection: "orthographic",
          position: [0, -55, z],
          target: [0, -55, 0],
          up: [0, -1, 0],
          near: 0.5,
          far: 10000,
          fovDeg: 45,
          span: 220,
        });
        const image = await a.render.image({
          revision: q.revision,
          width: 384,
          height: 256,
          format: "png",
          visibility: { mode: "all" },
          background: { type: "solid", color: "#ffffff" },
          quality: "balanced",
          strict: true,
        });
        const bitmap = await createImageBitmap(image.blob),
          canvas = document.createElement("canvas");
        canvas.width = 384;
        canvas.height = 256;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        const actual = ctx.getImageData(0, 0, 384, 256).data;
        const reference = await (
          window as unknown as {
            bfcReference: (s: string, z: number) => Promise<number[]>;
          }
        ).bfcReference(expected, z);
        let total = 0,
          large = 0,
          colored = 0;
        for (let i = 0; i < actual.length; i++) {
          const d = Math.abs(actual[i] - reference[i]);
          total += d;
          if (d > 16) large++;
          if (i % 4 !== 3 && reference[i] < 200) colored++;
        }
        results.push({
          z,
          mean: total / actual.length,
          large: large / actual.length,
          colored,
        });
      }
      return results;
    },
    { source, expected },
  );
  await info.attach("BFC pixel comparisons", {
    body: JSON.stringify(comparisons, null, 2),
    contentType: "application/json",
  });
  for (const comparison of comparisons) {
    expect(comparison.colored).toBeGreaterThan(500);
    expect(comparison.mean).toBeLessThan(0.35);
    expect(comparison.large).toBeLessThan(0.002);
  }
});
