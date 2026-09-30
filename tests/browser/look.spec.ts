import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const fixture = readFileSync("fixtures/ldraw/finishes.mpd", "utf8");

async function countDraws(page: Page) {
  await page.addInitScript(() => {
    const counter = { draws: 0 };
    (window as unknown as { __draws: typeof counter }).__draws = counter;
    const proto = WebGL2RenderingContext.prototype as unknown as Record<
      string,
      (...args: unknown[]) => unknown
    >;
    for (const name of [
      "drawElements",
      "drawArrays",
      "drawElementsInstanced",
      "drawArraysInstanced",
    ]) {
      const original = proto[name];
      proto[name] = function (this: unknown, ...args: unknown[]) {
        counter.draws++;
        return original.apply(this, args);
      };
    }
  });
}
const drawsOver = (page: Page, frames: number) =>
  page.evaluate(async (frames) => {
    const counter = (window as unknown as { __draws: { draws: number } })
      .__draws;
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    await frame();
    const start = counter.draws;
    for (let i = 0; i < frames; i++) await frame();
    return counter.draws - start;
  }, frames);

async function load(page: Page) {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  return page.evaluate(async (text) => {
    const a = window.brickEditor!;
    const imported = await a.project.import({ format: "ldraw", text });
    await a.ready({ minRevision: imported.revision, strict: true });
    return imported.revision;
  }, fixture);
}

test("render looks switch from the views popover, persist, and captures request them explicitly", async ({
  page,
}) => {
  // Realistic frames cost about a second each on software WebGL, and the photo
  // capture compiles the path-tracing shader.
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const revision = await load(page);
  expect(
    (await page.evaluate(() => window.brickEditor!.render.look.get())).name,
  ).toBe("standard");
  await page.getByRole("button", { name: "Camera views" }).click();
  await page.getByRole("button", { name: "Look", exact: true }).click();
  const looks = page.getByRole("group", { name: "Render look" });
  await expect(looks.getByRole("button", { name: "Standard" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await looks.getByRole("button", { name: "Realistic" }).click();
  await expect(
    looks.getByRole("button", { name: "Realistic" }),
  ).toHaveAttribute("aria-pressed", "true");
  const realistic = await page.evaluate(() =>
    window.brickEditor!.render.look.get(),
  );
  expect(realistic).toMatchObject({
    name: "realistic",
    resourceProfile: "desktop",
    environment: "room",
    ambientOcclusion: "gtao",
    edges: "hidden",
  });
  // The quality profile is untouched by a look.
  expect(
    await page.evaluate(() => window.brickEditor!.render.quality.get()),
  ).toMatchObject({ name: "balanced", edges: "all", shadows: "off" });

  const result = await page.evaluate(async (revision) => {
    const a = window.brickEditor!;
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
    const captures = [];
    for (const look of ["standard", "realistic", "photo", undefined] as const) {
      const r = await a.render.image({
        revision,
        width: 160,
        height: 120,
        format: "png",
        visibility: { mode: "all" },
        background: { type: "solid", color: "#e9edef" },
        quality: "balanced",
        ...(look ? { look } : {}),
        ...(look === "photo" ? { lookControls: { pathSamples: 4 } } : {}),
        strict: true,
      });
      const hash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", await r.blob.arrayBuffer()),
        ),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      captures.push({
        hash,
        look: r.manifest.look,
        stats: r.manifest.stats,
        output: r.manifest.output,
        restored: (await a.render.look.get()).name,
      });
    }
    let refused = "";
    try {
      await a.render.look.set("realistic", { samples: 500 });
    } catch (e) {
      refused = (e as Error).message;
    }
    return { captures, refused };
  }, revision);
  const [standard, real, photo, implicit] = result.captures;
  expect(new Set([standard.hash, real.hash, photo.hash]).size).toBe(3);
  // An unspecified look captures reproducibly with the standard look.
  expect(implicit.hash).toBe(standard.hash);
  expect(implicit.look.name).toBe("standard");
  expect(real.look.name).toBe("realistic");
  expect(photo.look).toMatchObject({
    name: "photo",
    renderer: "path",
    pathSamples: 4,
  });
  expect(standard.stats.lines).toBeGreaterThan(0);
  expect(real.stats.lines).toBe(0);
  expect(standard.output.toneMapped).toBe(false);
  expect(real.output).toMatchObject({
    toneMapped: true,
    toneMapping: "neutral",
  });
  for (const c of result.captures) expect(c.restored).toBe("realistic");
  expect(result.refused).toContain("bounds");

  // The choice is per viewer and survives a reload.
  expect(
    await page.evaluate(() => localStorage.getItem("brick-editor-render-look")),
  ).toBe("realistic");
  await load(page);
  expect(
    (await page.evaluate(() => window.brickEditor!.render.look.get())).name,
  ).toBe("realistic");
  await page.getByRole("button", { name: "Camera views" }).click();
  await page.getByRole("button", { name: "Look", exact: true }).click();
  await looks.getByRole("button", { name: "Standard" }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("brick-editor-render-look")),
  ).toBeNull();
  expect(errors).toEqual([]);
});

test("the photo look path-traces a still view with progress, then stops drawing; Play never accumulates", async ({
  page,
}) => {
  // The first photo still compiles the path-tracing shader, and every traced
  // sample costs seconds on software WebGL: keep the viewport small.
  test.setTimeout(480000);
  await page.setViewportSize({ width: 720, height: 520 });
  await countDraws(page);
  await load(page);
  await page.evaluate(() =>
    window.brickEditor!.render.look.set("photo", { pathSamples: 4 }),
  );
  await page.evaluate(() => window.brickEditor!.camera.fit());
  // A realistic raster frame is drawn at once; the still then prepares its
  // BVH and shader and refines, with progress in the status toast.
  const status = page.locator(".status-bar");
  await expect(status).toContainText(/(Preparing|Refining) photo…/, {
    timeout: 240000,
  });
  await expect(status).toHaveAttribute("data-refining", "");
  await expect
    .poll(() => page.evaluate(() => window.brickEditor!.render.look.photo()), {
      timeout: 240000,
    })
    .toMatchObject({ renderer: "path", reason: null, samples: 4 });
  await expect(status).toContainText("Photo refined: 4 path-traced samples.");
  await expect(status).not.toHaveAttribute("data-refining", "");
  const stats = await page.evaluate(() =>
    window.brickEditor!.render.look.photo(),
  );
  expect(stats.triangles).toBeGreaterThan(60000);
  // Converged: nothing more is drawn.
  await expect.poll(() => drawsOver(page, 8), { timeout: 60000 }).toBe(0);
  // Moving the view restarts it: raster frames first, then tracing again.
  await page.evaluate(() =>
    window.brickEditor!.camera.set({
      space: "ldraw",
      projection: "perspective",
      position: [300, -260, 420],
      target: [-30, -40, 0],
      up: [0, -1, 0],
      fovDeg: 45,
      near: 0.5,
      far: 50000,
    }),
  );
  // (The raster frame lands at once; tracing resumes after PHOTO_IDLE_MS.)
  await expect
    .poll(() => drawsOver(page, 4), { timeout: 60000 })
    .toBeGreaterThan(0);
  await expect.poll(() => drawsOver(page, 8), { timeout: 120000 }).toBe(0);
  // Play draws live raster frames: no tracing, no accumulation.
  await page.evaluate(() =>
    window.brickEditor!.play.enter({
      realtime: true,
      locomotion: "fly-noclip",
      position: [0, -120, 300],
    }),
  );
  await drawsOver(page, 5);
  expect(await drawsOver(page, 10)).toBe(0);
  await page.evaluate(() => window.brickEditor!.play.exit());
});

test("photo captures are path traced, repeatable, and clearly unlike realistic; section cuts fall back to the raster photo", async ({
  page,
}) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const revision = await load(page);
  const result = await page.evaluate(async (revision) => {
    const a = window.brickEditor!;
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
    const capture = async (
      look: "realistic" | "photo",
      lookControls: Record<string, unknown> = {},
    ) => {
      const r = await a.render.image({
        revision,
        width: 200,
        height: 150,
        format: "png",
        visibility: { mode: "all" },
        background: { type: "solid", color: "#e9edef" },
        quality: "balanced",
        look,
        lookControls,
        strict: true,
      });
      const bitmap = await createImageBitmap(r.blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      return {
        pixels: Array.from(
          context.getImageData(0, 0, bitmap.width, bitmap.height).data,
        ),
        manifest: { look: r.manifest.look, photo: r.manifest.photo },
      };
    };
    const realistic = await capture("realistic");
    const photo = await capture("photo", { pathSamples: 8 });
    const again = await capture("photo", { pathSamples: 8 });
    await a.render.section.set({ height: -40 });
    const sectioned = await capture("photo", { samples: 2 });
    await a.render.section.set(null);
    // Mean absolute difference per channel (0–255).
    const difference = (x: number[], y: number[]) => {
      let sum = 0;
      for (let i = 0; i < x.length; i++)
        if (i % 4 !== 3) sum += Math.abs(x[i] - y[i]);
      return sum / ((x.length / 4) * 3);
    };
    return {
      realisticVsPhoto: difference(realistic.pixels, photo.pixels),
      photoRepeat: difference(photo.pixels, again.pixels),
      photo: photo.manifest,
      sectioned: sectioned.manifest,
    };
  }, revision);
  expect(result.photo.photo).toMatchObject({
    renderer: "path",
    reason: null,
    samples: 8,
  });
  // A clear image difference, not a subtle one.
  expect(result.realisticVsPhoto).toBeGreaterThan(12);
  // Seeded (stable) noise: the same view traces the same image.
  expect(result.photoRepeat).toBeLessThan(1);
  expect(result.sectioned.photo).toMatchObject({
    renderer: "raster",
    samples: 2,
  });
  expect(result.sectioned.photo?.reason).toMatch(/Section cuts/);
  expect(errors).toEqual([]);
});

test("phones trace fewer samples within the phone budget", async ({ page }) => {
  test.setTimeout(300000);
  await page.setViewportSize({ width: 720, height: 520 });
  await load(page);
  const look = await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.resources.setProfile({ profile: "mobile" });
    return a.render.look.set("photo");
  });
  expect(look).toMatchObject({
    resourceProfile: "mobile",
    renderer: "path",
    pathSamples: 64,
  });
  const budget = await page.evaluate(
    async () => (await window.brickEditor!.render.budget()).budget,
  );
  expect(budget.photoTriangles).toBe(600000);
  await page.evaluate(() =>
    window.brickEditor!.render.look.set("photo", { pathSamples: 2 }),
  );
  await expect
    .poll(() => page.evaluate(() => window.brickEditor!.render.look.photo()), {
      timeout: 240000,
    })
    .toMatchObject({ renderer: "path", samples: 2 });
});

test("Play re-renders the cached shadow map only when the scene changes, not when the camera moves", async ({
  page,
}) => {
  await load(page);
  await page.evaluate(() => window.brickEditor!.render.look.set("realistic"));
  await page.evaluate(() =>
    window.brickEditor!.play.enter({
      realtime: true,
      locomotion: "fly-noclip",
      position: [0, -120, 300],
    }),
  );
  const stats = () =>
    page.evaluate(
      async () => (await window.brickEditor!.render.budget()).lastFrame,
    );
  // Let entry settle (it changes the scene once), then fly forward.
  await page.waitForTimeout(500);
  const before = await stats();
  expect(before.shadowPasses).toBeGreaterThan(0);
  await page.evaluate(() => window.brickEditor!.play.setInput({ moveZ: 1 }));
  await expect
    .poll(async () => (await stats()).frames - before.frames, {
      timeout: 30000,
    })
    .toBeGreaterThan(3);
  await page.evaluate(() => window.brickEditor!.play.setInput({}));
  expect((await stats()).shadowPasses).toBe(before.shadowPasses);
  await page.evaluate(() => window.brickEditor!.play.exit());
});
