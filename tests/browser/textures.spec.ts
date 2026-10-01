import { test, expect, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { openMenuTab, openMode } from "./helpers/mode";

// Official !TEXMAP parts (fixtures/ldraw/textured-parts.ldr): a planar tile
// with an empty fallback, a printed brick, a minifig head textured through
// subfile references, and a spherical globe hemisphere.
const fixture = () => readFile("fixtures/ldraw/textured-parts.ldr", "utf8");
const TEXTURES = "**/libraries/textures-ldraw-full-*/textures/*.png";

type Rendered = {
  strict: string;
  warnings: string[];
  health: string;
  textures: {
    textures: number;
    decodedBytes: number;
    maxSize: number;
    textured: number;
    fallback: number;
  };
  /** Top-down view of the tile (87079pxf): RGBA bytes. */
  tile: number[];
  /** The whole fixture, front right, as a PNG data URL (screenshots). */
  scene: string;
};

/** Imports the fixture, waits for it, and renders the tile from above. */
async function render(page: Page, text: string): Promise<Rendered> {
  return page.evaluate(async (text) => {
    const a = window.brickEditor!;
    const imported = await a.project.import({
      format: "ldraw",
      text,
      name: "textured-parts.ldr",
    });
    const ready = await a.ready({ minRevision: imported.revision });
    let strict = "ok";
    try {
      await a.ready({ minRevision: imported.revision, strict: true });
    } catch (e) {
      strict = e instanceof Error ? e.message : String(e);
    }
    const health = await a.health.check();
    const budget = (await a.render.budget()) as unknown as {
      textures: Rendered["textures"];
    };
    const shot = async (
      camera: Parameters<typeof a.camera.set>[0],
      width: number,
      height: number,
    ) => {
      await a.camera.set(camera);
      const image = await a.render.image({
        revision: imported.revision,
        width,
        height,
        format: "png",
        visibility: { mode: "all" },
        background: { type: "solid", color: "#ffffff" },
        quality: "balanced",
      });
      return image.blob;
    };
    const tileBlob = await shot(
      {
        space: "ldraw",
        projection: "orthographic",
        position: [0, -500, 0],
        target: [0, 0, 0],
        up: [0, 0, -1],
        near: 1,
        far: 5000,
        fovDeg: 45,
        span: 90,
      },
      180,
      180,
    );
    const bitmap = await createImageBitmap(tileBlob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const tile = [...ctx.getImageData(0, 0, 180, 180).data];
    const sceneBlob = await shot(
      {
        space: "ldraw",
        projection: "perspective",
        position: [-160, -170, -260],
        target: [0, -10, 20],
        up: [0, -1, 0],
        near: 1,
        far: 5000,
        fovDeg: 40,
      },
      960,
      640,
    );
    const scene = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(sceneBlob);
    });
    return {
      strict,
      warnings: ready.warnings.map((w: { message: string }) => w.message),
      health: health.checks.find(
        (c: { id: string }) => c.id === "unsupported-rendering",
      )!.status,
      textures: budget.textures,
      tile,
      scene,
    };
  }, text);
}
/** Pixels of the tile's print (the centre 60 % of the tile's top face). */
function printPixels(rgba: number[]) {
  const out: number[][] = [];
  // Tile 80 × 40 LDU seen from above in a 90 LDU / 180 px view: 2 px per LDU.
  for (let y = 90 - 24; y < 90 + 24; y++)
    for (let x = 90 - 48; x < 90 + 48; x++) {
      const i = (y * 180 + x) * 4;
      out.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
    }
  return out;
}
const saturated = (pixels: number[][]) =>
  pixels.filter(([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b) > 80)
    .length / pixels.length;
async function screenshot(name: string, dataUrl: string) {
  await mkdir("test-results/textures", { recursive: true });
  await writeFile(
    `test-results/textures/${name}.png`,
    Buffer.from(dataUrl.split(",")[1], "base64"),
  );
}

test("official textured parts render with their textures, and with reported fallback geometry without them", async ({
  page,
  browser,
}) => {
  test.setTimeout(240000);
  const text = await fixture();
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/libraries/textures-")) requests.push(r.url());
  });
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const textured = await render(page, text);
  // Textured: strict capture accepts it and health has nothing to report.
  expect(textured.strict).toBe("ok");
  expect(textured.health).toBe("ok");
  expect(textured.warnings).toEqual([]);
  expect(textured.textures).toMatchObject({
    textures: 5,
    textured: 4,
    fallback: 0,
    maxSize: 2048,
  });
  // Manifest plus the five images, each once.
  expect(requests.filter((u) => u.endsWith(".png")).length).toBe(5);
  expect(new Set(requests).size).toBe(requests.length);
  await screenshot("textured-parts", textured.scene);

  // Without the images: fallback geometry, a warning, strict refuses.
  const context = await browser.newContext();
  try {
    const bare = await context.newPage();
    await bare.route(TEXTURES, (route) => route.abort());
    await bare.goto("./?automation=1");
    await bare.waitForFunction(() => !!window.brickEditor);
    const fallback = await render(bare, text);
    expect(fallback.strict).toMatch(
      /Strict render refuses textured parts drawn without their textures/,
    );
    expect(fallback.health).toBe("warning");
    expect(fallback.warnings.join(" ")).toMatch(
      /4 textured parts are drawn without their printed texture .*fallback geometry/,
    );
    expect(fallback.textures).toMatchObject({ textured: 0, fallback: 4 });
    await screenshot("textured-parts-fallback", fallback.scene);
    // The print differs from the fallback: the tile's DEFENDER artwork is
    // colourful, its fallback (no print; the tile's top is left open) is not.
    const withPrint = printPixels(textured.tile);
    const without = printPixels(fallback.tile);
    const diff =
      withPrint.reduce(
        (n, p, i) =>
          n +
          Math.abs(p[0] - without[i][0]) +
          Math.abs(p[1] - without[i][1]) +
          Math.abs(p[2] - without[i][2]),
        0,
      ) /
      (withPrint.length * 3);
    expect(diff).toBeGreaterThan(20);
    expect(saturated(withPrint)).toBeGreaterThan(0.2);
    expect(saturated(without)).toBeLessThan(0.02);
  } finally {
    await context.close();
  }
});

test("textures render offline once loaded, and are downscaled on the phone profile", async ({
  page,
  context,
}) => {
  test.setTimeout(240000);
  const text = await fixture();
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  // Install the offline app snapshot (the texture pack is not precached).
  await openMenuTab(page, "Project", "Settings");
  await page
    .getByRole("button", { name: "Download / check for updates", exact: true })
    .click();
  await expect(page.getByText(/Ready offline\./)).toBeVisible({
    timeout: 45000,
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  const online = await render(page, text);
  expect(online.strict).toBe("ok");
  const desktopBytes = online.textures.decodedBytes;

  await context.setOffline(true);
  try {
    await page.reload();
    await page.waitForFunction(() => !!window.brickEditor);
    // Phone profile: every texture decoded at no more than 1024 px.
    await page.evaluate(() =>
      window.brickEditor!.resources.setProfile({ profile: "mobile" }),
    );
    const offline = await render(page, text);
    expect(offline.strict).toBe("ok");
    expect(offline.textures).toMatchObject({
      textured: 4,
      fallback: 0,
      maxSize: 1024,
    });
    // 61287p01rb is 1600 × 1600 (1024 × 1024 on phones; the other four are
    // smaller than 1024 px): less decoded memory than on desktop.
    expect(offline.textures.decodedBytes).toBeLessThan(desktopBytes);
    expect(saturated(printPixels(offline.tile))).toBeGreaterThan(0.2);
  } finally {
    await context.setOffline(false);
  }
});
