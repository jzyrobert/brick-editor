import { expect, test, type Page } from "@playwright/test";
import { brickCityModel } from "../helpers/brick-city";

// Hidden-geometry culling (docs/PERFORMANCE-MINEBENCH.md): studs received by
// the part above, cavities resting on closed-shell parts, parts enclosed on
// every side and cavities facing away from the eye are not drawn in the plain
// view. Drawing must look the same, stay within the phone budget, and fall
// back to exact geometry for section cuts.
const city = brickCityModel({ parts: 6000, courses: 6 });

async function open(page: Page, query = "") {
  await page.goto("/?automation=1" + query);
  await page.waitForFunction(() => !!window.brickEditor);
  return page.evaluate(async (text) => {
    const a = window.brickEditor!;
    await a.ready();
    const imported = await a.project.import({
      format: "ldraw",
      text,
      name: "brick-city.mpd",
      strict: true,
    });
    await a.ready({ minRevision: imported.revision, strict: true });
    return imported.revision;
  }, city.text);
}

/** Wait for a new drawn frame; returns the render budget report. */
const frame = (page: Page) =>
  page.evaluate(async () => {
    const a = window.brickEditor!;
    const before = (await a.render.budget()).lastFrame.frames;
    for (let i = 0; i < 300; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      if ((await a.render.budget()).lastFrame.frames > before) break;
    }
    return a.render.budget();
  });

const view = {
  space: "ldraw" as const,
  projection: "perspective" as const,
  position: [-900, -1500, -900] as [number, number, number],
  target: [700, -100, 700] as [number, number, number],
  up: [0, -1, 0] as [number, number, number],
  fovDeg: 45,
  near: 1,
  far: 40000,
};

/** A standard-look capture from `view`, as RGBA bytes. */
async function capture(page: Page, revision: number) {
  return page.evaluate(
    async ({ revision, view }) => {
      const a = window.brickEditor!;
      await a.camera.set(view);
      const r = await a.render.image({
        revision,
        width: 640,
        height: 480,
        format: "png",
        visibility: { mode: "all" },
        background: { type: "solid", color: "#e9edef" },
        // Surfaces only: with edges, the full drawing also shows the outlines
        // of covered studs bleeding through the parts above them at a
        // distance (depth precision), which culling removes.
        quality: "fast",
        look: "standard",
        strict: true,
      });
      const bitmap = await createImageBitmap(r.blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      const data = context.getImageData(0, 0, bitmap.width, bitmap.height);
      return { pixels: Array.from(data.data), triangles: r.manifest.stats };
    },
    { revision, view },
  );
}

test("a plain-brick city draws a fraction of its triangles on the phone profile and falls back for section cuts", async ({
  browser,
}) => {
  test.setTimeout(300000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await open(page);
  expect(
    await page.evaluate(
      async () => (await window.brickEditor!.resources.status()).active,
    ),
  ).toBe("mobile");
  await page.evaluate((v) => window.brickEditor!.camera.set(v), view);
  const plain = await frame(page);
  const usage = plain.usage!;
  const hidden = plain.hiddenGeometry as {
    enabled: boolean;
    enclosed: number;
    hiddenStuds: number;
    cavities: number;
  };
  expect(usage.partOccurrences).toBe(city.parts);
  expect(hidden.enabled).toBe(true);
  expect(hidden.hiddenStuds).toBeGreaterThan(0);
  expect(hidden.cavities).toBeGreaterThan(0);
  expect(hidden.enclosed).toBeGreaterThan(0);
  // The budget counts what the plain view draws with every opening in sight.
  expect(usage.sceneTriangles).toBeLessThan(usage.sceneTrianglesFull! * 0.5);
  expect(usage.sceneTriangles).toBeLessThan(plain.budget.sceneTriangles);
  expect(plain.batches.plainView).toBe(true);
  expect(plain.batches.culled).toBeGreaterThan(0);
  // Every part is drawn except those enclosed on all six faces.
  expect(plain.batches.occurrencesDrawn + hidden.enclosed).toBe(city.parts);
  // Looking down, no downward opening can be seen either.
  expect(plain.lastFrame.triangles).toBeLessThan(usage.sceneTriangles);
  // A section cut exposes insides: exact geometry, then culled again.
  await page.evaluate(() =>
    window.brickEditor!.render.section.set({ height: -40 }),
  );
  const cut = await frame(page);
  expect(cut.batches.plainView).toBe(false);
  expect(cut.batches.omitted).toBe(0);
  await page.evaluate(() => window.brickEditor!.render.section.set(null));
  const back = await frame(page);
  expect(back.batches.plainView).toBe(true);
  expect(back.batches.structures).toBe(cut.batches.structures);
  expect(back.lastFrame.triangles).toBe(plain.lastFrame.triangles);
  await context.close();
});

test("culled drawing matches full drawing and keeps picking", async ({
  browser,
}) => {
  test.setTimeout(300000);
  const shots = [];
  const picks = [];
  for (const query of ["", "&hiddenCull=0"]) {
    const page = await browser.newPage({
      viewport: { width: 1000, height: 800 },
    });
    const revision = await open(page, query);
    shots.push(await capture(page, revision));
    await frame(page);
    picks.push(
      await page.evaluate(() => {
        const scene = window.__brickScene as unknown as {
          pick(x: number, y: number): string | null;
          renderer: { domElement: HTMLCanvasElement };
        };
        const r = scene.renderer.domElement.getBoundingClientRect();
        return [0.4, 0.5, 0.6].map((f) =>
          scene.pick(r.left + r.width * f, r.top + r.height * f),
        );
      }),
    );
    await page.close();
  }
  const [culled, full] = shots;
  expect(culled.pixels.length).toBe(full.pixels.length);
  let differing = 0;
  for (let i = 0; i < culled.pixels.length; i += 4) {
    const d = Math.max(
      Math.abs(culled.pixels[i] - full.pixels[i]),
      Math.abs(culled.pixels[i + 1] - full.pixels[i + 1]),
      Math.abs(culled.pixels[i + 2] - full.pixels[i + 2]),
    );
    if (d > 24) differing++;
  }
  // Hidden geometry is inside neighbours or facing away: nothing visible
  // disappears. A few pixels of distant roofs differ where faces are smaller
  // than a pixel and coplanar faces tie in depth (16 of 307,200 when
  // measured; 0.4% at 320 × 240).
  expect(differing / (culled.pixels.length / 4)).toBeLessThan(0.001);
  expect(picks[0]).toEqual(picks[1]);
  expect(picks[0].some((id) => id)).toBe(true);
});
