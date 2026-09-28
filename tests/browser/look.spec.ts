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
  // Realistic frames cost about a second each on software WebGL.
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const revision = await load(page);
  expect(
    (await page.evaluate(() => window.brickEditor!.render.look.get())).name,
  ).toBe("standard");
  await page.getByRole("button", { name: "Camera views" }).click();
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
        ...(look === "photo" ? { lookControls: { samples: 4 } } : {}),
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
  expect(photo.look).toMatchObject({ name: "photo", samples: 4 });
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
  await looks.getByRole("button", { name: "Standard" }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("brick-editor-render-look")),
  ).toBeNull();
  expect(errors).toEqual([]);
});

test("the photo look refines a still view, then stops drawing; Play never accumulates", async ({
  page,
}) => {
  await countDraws(page);
  await load(page);
  await page.evaluate(() =>
    window.brickEditor!.render.look.set("photo", { samples: 6 }),
  );
  // The still view keeps drawing while it accumulates…
  await page.evaluate(() => window.brickEditor!.camera.fit());
  expect(await drawsOver(page, 3)).toBeGreaterThan(0);
  // …and goes idle once every sample is in.
  await expect.poll(() => drawsOver(page, 8), { timeout: 30000 }).toBe(0);
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
