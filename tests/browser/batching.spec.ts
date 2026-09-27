import { expect, test } from "@playwright/test";

// Original synthetic scene CC0-1.0. Real 3001.dat comes from the pinned library.
const fixture = `0 FILE main.ldr
0 Original batching conformance arrangement; CC0-1.0
${Array.from({ length: 8 }, (_, i) => `1 ${i === 7 ? 47 : 4} ${(i % 4) * 90 - 135} -24 ${Math.floor(i / 4) * 70} ${i === 5 ? "-1 0 0 0 1 0 0 0 1" : i === 6 ? "1 .3 0 0 1 0 0 0 1" : "1 0 0 0 1 0 0 0 1"} 3001.dat`).join("\n")}
${Array.from({ length: 4 }, (_, i) => `1 ${i % 2 ? 1 : 4} ${i * 65 - 95} -60 -60 1 0 0 0 1 0 0 0 1 decorated.dat`).join("\n")}
0 FILE decorated.dat
0 !LDRAW_ORG Unofficial_Part
0 !LICENSE Redistributable under CC0-1.0
0 BFC CERTIFY CCW
3 16 -20 0 0 20 0 0 0 -40 0
3 14 -5 -10 -1 5 -10 -1 0 -20 -1
2 24 -20 0 0 20 0 0
5 24 -20 0 0 0 -40 0 10 -10 10 -10 -10 -10
0 NOFILE`;

test("batched real/custom geometry matches reference with reflections, shear, transparency and scoped visibility", async ({
  browser,
  baseURL,
}, info) => {
  test.setTimeout(120000);
  const results: {
    pixels: number[];
    stats: { calls: number; triangles: number; [key: string]: unknown };
  }[][] = [];
  for (const reference of [true, false]) {
    const page = await browser.newPage();
    await page.goto(
      `${process.env.BRICK_BATCH_URL || baseURL}/?automation=1${reference ? "&referenceRenderer=1" : ""}`,
    );
    await page.waitForFunction(() => !!window.brickEditor);
    results.push(
      await page.evaluate(async (text) => {
        const api = window.brickEditor!;
        await api.project.import({ format: "ldraw", text });
        const q = await api.query();
        await api.ready({ minRevision: q.revision, strict: true });
        const captures = [];
        for (const quality of ["balanced", "fast", "photo"] as const) {
          for (const position of [
            [400, -300, -500],
            [-400, -220, -450],
          ] as [number, number, number][]) {
            if (quality !== "balanced" && position[0] < 0) continue;
            await api.camera.set({
              space: "ldraw",
              projection: "perspective",
              position,
              target: [0, -35, 0],
              up: [0, -1, 0],
              fovDeg: 45,
              near: 0.5,
              far: 5000,
            });
            for (const scoped of [false, true]) {
              if (quality !== "balanced" && scoped) continue;
              const image = await api.render.image({
                revision: q.revision,
                width: 512,
                height: 320,
                format: "png",
                background: { type: "solid", color: "#ffffff" },
                visibility: scoped
                  ? {
                      mode: "occurrences",
                      occurrenceIds: q.occurrences
                        .filter((_, i) => i % 2 === 0)
                        .map((o) => o.id),
                    }
                  : { mode: "all" },
                quality,
                strict: true,
              });
              const bitmap = await createImageBitmap(image.blob),
                canvas = document.createElement("canvas");
              canvas.width = 512;
              canvas.height = 320;
              const context = canvas.getContext("2d")!;
              context.drawImage(bitmap, 0, 0);
              bitmap.close();
              captures.push({
                pixels: Array.from(context.getImageData(0, 0, 512, 320).data),
                stats: image.manifest.stats,
              });
            }
          }
        }
        return captures;
      }, fixture),
    );
    await page.close();
  }
  const comparisons = results[0].map((reference, i) => {
    const batched = results[1][i];
    let absolute = 0,
      large = 0;
    for (let p = 0; p < reference.pixels.length; p++) {
      const d = Math.abs(reference.pixels[p] - batched.pixels[p]);
      absolute += d;
      if (d > 16) large++;
    }
    return {
      meanChannelError: absolute / reference.pixels.length,
      largeChannelFraction: large / reference.pixels.length,
      reference: reference.stats,
      batched: batched.stats,
    };
  });
  await info.attach("reference-comparison.json", {
    body: JSON.stringify(comparisons, null, 2),
    contentType: "application/json",
  });
  for (const comparison of comparisons) {
    expect(comparison.meanChannelError).toBeLessThan(0.35);
    expect(comparison.largeChannelFraction).toBeLessThan(0.002);
    expect(comparison.batched.calls).toBeLessThan(comparison.reference.calls);
  }
});
