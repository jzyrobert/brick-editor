import { expect, test, type Page } from "@playwright/test";
import { openMode } from "./helpers/mode";
import { refusePointerLock } from "./helpers/pointer";
import { execFileSync } from "node:child_process";

/** Backdrops draw a sky, a textured ground and horizon silhouettes around the
 * build, in the editor, in Play and in captures (docs/RENDERING.md). */
test.describe.configure({ timeout: 240000 });
const shots = "test-results/backdrops/";

/** Use the TS loader for generated catalogue imports. Only the authored crate
 * and plaza's pinned local dependencies are compiled; no library requests. */
function playgroundSupportSource(): {
  vertices: number[][];
  plaza: { min: number[]; max: number[] };
} {
  const script = `
    import { playgroundProject } from './src/catalog/builds/playground';
    import { occurrences } from './src/core/document';
    import { inverse, mv, add } from './src/core/math';
    import { officialMesh } from './tests/helpers/official-geometry';
    const project = playgroundProject(), group = project.motionRigs['crate-3'].groups[0],
      local = inverse(group.frame),
      moving = new Set(Object.values(project.motionRigs).flatMap(r => r.groups.flatMap(g => g.occurrenceIds))),
      tiles = occurrences(project).filter(o => o.node.ref === '87079.dat' && !moving.has(o.id));
    Promise.all([officialMesh(project,group.occurrenceIds), officialMesh(project,tiles.map(o => o.id))])
      .then(([crate,plaza]) => {
        const vertices = [], min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
        for(let k=0;k<crate.vertices.length;k+=3)
          vertices.push(add(local.position,mv(local.basis,Array.from(crate.vertices.slice(k,k+3)))));
        for(let k=0;k<plaza.vertices.length;k++) {
          const axis=k%3; min[axis]=Math.min(min[axis],plaza.vertices[k]); max[axis]=Math.max(max[axis],plaza.vertices[k]);
        }
        process.stdout.write(JSON.stringify({vertices,plaza:{min,max}}));
      });
  `;
  return JSON.parse(
    execFileSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "--eval", script],
      {
        encoding: "utf8",
        maxBuffer: 4 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      },
    ),
  );
}

const camera = {
  space: "ldraw",
  projection: "perspective",
  position: [300, -160, -420],
  target: [0, -30, 0],
  up: [0, -1, 0],
  fovDeg: 45,
  near: 0.5,
  far: 50000,
} as const;

async function openTemplate(page: Page, template: string) {
  return page.evaluate(async (template) => {
    const a = window.brickEditor!;
    const imported = await a.project.import({
      format: "template",
      template: template as "wall",
    });
    await a.ready({ minRevision: imported.revision, strict: true });
    return imported.revision;
  }, template);
}

/** A small capture; returns its manifest backdrop and the colour of the
 * top-left pixel (sky or background) and of a pixel low in the frame
 * (ground). */
function capture(
  page: Page,
  backdrop?: string,
  transparent = false,
  photo = false,
) {
  return page.evaluate(
    async ({ backdrop, transparent, camera, photo }) => {
      const a = window.brickEditor!;
      await a.camera.set(camera as never);
      const q = await a.query();
      const r = await a.render.image({
        revision: q.revision,
        width: 160,
        height: 120,
        format: "png",
        visibility: { mode: "all" },
        background: transparent
          ? { type: "transparent" }
          : { type: "solid", color: "#ffffff" },
        quality: "fast",
        ...(backdrop ? { backdrop: backdrop as "blank" } : {}),
        ...(photo
          ? { look: "photo" as const, lookControls: { pathSamples: 2 } }
          : {}),
      });
      const bitmap = await createImageBitmap(r.blob);
      const canvas = new OffscreenCanvas(160, 120);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      const px = (x: number, y: number) =>
        Array.from(ctx.getImageData(x, y, 1, 1).data);
      return {
        backdrop: r.manifest.backdrop,
        renderer: r.manifest.photo?.renderer,
        sky: px(2, 2),
        ground: px(4, 116),
      };
    },
    { backdrop, transparent, camera, photo },
  );
}

test("the backdrop switches from the views popover, is saved with the build and survives a reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await openTemplate(page, "wall");
  expect(
    await page.evaluate(() => window.brickEditor!.render.backdrop.get()),
  ).toMatchObject({ name: "blank", grid: true, stats: { drawn: false } });

  await page.getByRole("button", { name: "Camera views" }).click();
  await page.getByRole("button", { name: "Look", exact: true }).click();
  const swatches = page.getByRole("group", { name: "Backdrop" });
  await expect(swatches.getByRole("button")).toHaveCount(6);
  await expect(swatches.getByRole("button", { name: "Blank" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await swatches.getByRole("button", { name: "Meadow" }).click();
  await expect(
    swatches.getByRole("button", { name: "Meadow" }),
  ).toHaveAttribute("aria-pressed", "true");
  const grass = await page.evaluate(() =>
    window.brickEditor!.render.backdrop.get(),
  );
  expect(grass).toMatchObject({
    name: "grass",
    stats: { name: "grass", drawn: true, objects: 3 },
  });
  // Small procedural textures: well under 16 MB of GPU memory.
  expect(grass.stats.textureBytes).toBeLessThan(16e6);
  // One undoable project edit.
  const q = await page.evaluate(() => window.brickEditor!.query());
  expect(q.revision).toBeGreaterThan(0);
  await page.screenshot({ path: `${shots}editor-grass.png` });

  // The grid overlay is a view preference.
  await page.getByRole("checkbox", { name: "Grid" }).uncheck();
  expect(
    (await page.evaluate(() => window.brickEditor!.render.backdrop.get())).grid,
  ).toBe(false);
  await page.getByRole("checkbox", { name: "Grid" }).check();

  await expect(page.locator(".save-state")).toContainText(
    "Saved on this device · version",
  );
  await page.reload();
  await page.waitForFunction(() => !!window.brickEditor);
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          window.brickEditor!.render.backdrop.get().then((b) => b.name),
        ),
      { timeout: 60000 },
    )
    .toBe("grass");
  expect(
    (await page.evaluate(() => window.brickEditor!.render.backdrop.get())).stats
      .drawn,
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("captures draw the chosen backdrop and record it in the manifest", async ({
  page,
}) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await openTemplate(page, "wall");
  const blank = await capture(page);
  expect(blank.backdrop).toEqual({ name: "blank", drawn: false });
  // Blank keeps the requested solid background.
  expect(blank.sky.slice(0, 3)).toEqual([255, 255, 255]);
  const set = await page.evaluate(() =>
    window.brickEditor!.render.backdrop.set({ name: "street" }),
  );
  expect(set).toMatchObject({ name: "street" });
  // Captures default to the project's backdrop.
  const street = await capture(page);
  expect(street.backdrop).toEqual({ name: "street", drawn: true });
  expect(street.sky).not.toEqual(blank.sky);
  expect(street.ground).not.toEqual(blank.ground);
  // A capture may ask for another backdrop without changing the project.
  const night = await capture(page, "night");
  expect(night.backdrop).toEqual({ name: "night", drawn: true });
  expect(night.sky[2]).toBeGreaterThan(night.sky[0]);
  expect(night.sky[0] + night.sky[1] + night.sky[2]).toBeLessThan(
    street.sky[0] + street.sky[1] + street.sky[2],
  );
  expect(
    await page.evaluate(() =>
      window.brickEditor!.render.backdrop.get().then((b) => b.name),
    ),
  ).toBe("street");
  // Over a transparent background nothing of the backdrop is drawn.
  const clear = await capture(page, undefined, true);
  expect(clear.backdrop).toEqual({ name: "street", drawn: false });
  expect(clear.sky[3]).toBe(0);
  // Each preset draws something different at the sky and the ground.
  const seen = new Set<string>();
  for (const name of ["grass", "street", "beach", "night", "studio"]) {
    const r = await capture(page, name);
    expect(r.backdrop.drawn).toBe(true);
    seen.add(JSON.stringify([r.sky, r.ground]));
  }
  expect(seen.size).toBe(5);
  await expect(
    page.evaluate(() =>
      window.brickEditor!.render.backdrop.set({ name: "lava" as "blank" }),
    ),
  ).rejects.toThrow(/Backdrop must be one of/);
});

test("the path-traced Photo look traces the backdrop's ground instead of its studio sweep @heavy", async ({
  page,
}) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await openTemplate(page, "wall");
  const studio = await capture(page, "blank", false, true);
  const grass = await capture(page, "grass", false, true);
  expect(studio.renderer).toBe("path");
  expect(grass.renderer).toBe("path");
  expect(grass.backdrop).toEqual({ name: "grass", drawn: true });
  // The studio sweep is neutral grey; the meadow's traced ground is green.
  const [r, g, b] = grass.ground;
  expect(g).toBeGreaterThan(r + 10);
  expect(g).toBeGreaterThan(b + 10);
  const [sr, sg, sb] = studio.ground;
  expect(Math.abs(sg - sr)).toBeLessThan(12);
  expect(Math.abs(sg - sb)).toBeLessThan(12);
});

test("Play shows the backdrop: driving the jeep over the street map", async ({
  page,
}) => {
  await refusePointerLock(page);
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await openTemplate(page, "jeep");
  // The jeep opens on the toy street map.
  expect(
    await page.evaluate(() =>
      window.brickEditor!.render.backdrop.get().then((b) => b.name),
    ),
  ).toBe("street");
  await openMode(page, "Play");
  const drive = await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.play.enter({
      rigIds: ["jeep"],
      position: [-110, -0.3, -20],
      yaw: Math.PI / 2,
      realtime: false,
      cameraMode: "third-person",
    });
    await a.play.enterVehicle({ rigId: "jeep", seatId: "driver" });
    await a.play.setInput({ moveZ: 1 });
    const moved = await a.play.stepTicks(60);
    await a.play.setInput({});
    const q = await a.query();
    const r = await a.render.image({
      revision: q.revision,
      width: 160,
      height: 120,
      format: "png",
      visibility: { mode: "current" },
      background: { type: "solid", color: "#ffffff" },
      quality: "fast",
    });
    return {
      z: moved.mechanisms!.jeep.pose.vehicle!.position[2],
      backdrop: r.manifest.backdrop,
      play: !!r.manifest.play,
    };
  });
  expect(drive.z).toBeLessThan(-100);
  expect(drive).toMatchObject({
    backdrop: { name: "street", drawn: true },
    play: true,
  });
  await page.screenshot({ path: `${shots}play-jeep-street.png` });
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.play.exitVehicle().catch(() => {});
    await a.play.exit();
  });
});

test("the playground park starts Play with dynamic physics, and walking pushes a crate", async ({
  page,
}) => {
  // Compile the authored crate's complete pinned source, independently of its
  // native collision proxy. Rocking lifts its frame origin while a real source
  // corner stays supported; the origin is not a floor-clearance measurement.
  const { vertices, plaza } = playgroundSupportSource();
  await refusePointerLock(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await openTemplate(page, "playground");
  await expect(page.getByLabel("Project title")).toHaveValue("Playground park");
  await openMode(page, "Play");
  // The rigs ask for Dynamic, so it is chosen, and the build's hint shows.
  await expect(page.locator(".play-physics-settings summary")).toHaveText(
    "Mechanism physics · Dynamic",
  );
  await expect(page.locator(".play-intro-hint")).toHaveText(
    "Push the crates and barrels.",
  );
  await page.getByRole("button", { name: "Enter Play" }).click();
  await expect(page.locator(".play-start-hint")).toHaveText(
    "Push the crates and barrels.",
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        window
          .brickEditor!.play.snapshot()
          .then((s) => s.mechanisms?.["crate-3"]?.mode),
      ),
    )
    .toBe("dynamic");
  expect(
    await page.evaluate(async () =>
      Object.keys(
        (await window.brickEditor!.play.snapshot()).mechanisms!,
      ).sort(),
    ),
  ).toEqual([
    "barrel-1",
    "barrel-2",
    "crate-1",
    "crate-2",
    "crate-3",
    "crate-4",
  ]);
  await page.evaluate(() => window.brickEditor!.play.exit());

  // A deterministic push: walk into crate 3 (x -260..-220, z -160..-120).
  const push = await page.evaluate(async (vertices) => {
    const a = window.brickEditor!;
    const authored = async () => {
      const query = await a.query();
      return {
        source: Array.from((await a.project.export({ format: "ldraw" })).bytes),
        inventory: await a.inventory.preview({
          expectedRevision: query.revision,
          scope: { kind: "all" },
          format: "bricklink-wanted-xml",
          acceptDerivedMappings: true,
          acceptUnknownColors: true,
          errorPolicy: "export-resolved",
        }),
      };
    };
    const original = await authored();
    const rigIds = (await a.mechanisms.list())
      .filter((rig) => !rig.joints.length)
      .map((rig) => rig.id);
    await a.play.enter({
      rigIds,
      dynamicRigIds: rigIds,
      position: [-240, -8.3, -70],
      realtime: false,
      cameraMode: "third-person",
    });
    const start = await a.play.stepTicks(30);
    const support = (s: typeof start) => {
      const frame = s.mechanisms!["crate-3"].groupFrames.body;
      let lowest = -Infinity,
        point: number[] = [];
      for (const p of vertices) {
        const y =
          frame.position[1] +
          frame.basis[3] * p[0] +
          frame.basis[4] * p[1] +
          frame.basis[5] * p[2];
        if (y > lowest) {
          lowest = y;
          point = [
            frame.position[0] +
              frame.basis[0] * p[0] +
              frame.basis[1] * p[1] +
              frame.basis[2] * p[2],
            y,
            frame.position[2] +
              frame.basis[6] * p[0] +
              frame.basis[7] * p[1] +
              frame.basis[8] * p[2],
          ];
        }
      }
      return { lowest, point };
    };
    await a.play.setInput({ moveZ: 1 });
    let end = start;
    const supports = [];
    for (let tick = 0; tick < 40; tick++) {
      end = await a.play.stepTicks(1);
      supports.push(support(end));
    }
    await a.play.setInput({});
    await a.play.teleport({ position: [-240, -8.3, -70] });
    const settled = await a.play.stepTicks(180);
    return {
      before: start.mechanisms!["crate-3"].groupFrames.body.position,
      after: end.mechanisms!["crate-3"].groupFrames.body.position,
      mode: end.mechanisms!["crate-3"].mode,
      rigIds: Object.keys(end.mechanisms!).sort(),
      tickDelta:
        end.mechanisms!["crate-3"].tick - start.mechanisms!["crate-3"].tick,
      supports,
      settledSupport: support(settled),
      settledBody: settled.mechanisms!["crate-3"].dynamics!.bodies.body,
      original,
      afterSource: await authored(),
    };
  }, vertices);
  await test.info().attach("crate-source-support", {
    contentType: "application/json",
    body: JSON.stringify({
      before: push.before,
      after: push.after,
      plaza,
      supports: push.supports,
      settled: push.settledSupport,
      body: push.settledBody,
    }),
  });
  expect(push.mode).toBe("dynamic");
  expect(push.rigIds).toEqual([
    "barrel-1",
    "barrel-2",
    "crate-1",
    "crate-2",
    "crate-3",
    "crate-4",
  ]);
  expect(push.after[2]).toBeLessThan(push.before[2] - 20);
  expect(push.tickDelta).toBe(40);
  for (const support of [...push.supports, push.settledSupport]) {
    expect(support.point[0]).toBeGreaterThan(plaza.min[0]);
    expect(support.point[0]).toBeLessThan(plaza.max[0]);
    expect(support.point[2]).toBeGreaterThan(plaza.min[2]);
    expect(support.point[2]).toBeLessThan(plaza.max[2]);
    expect(support.lowest).toBeGreaterThan(plaza.min[1] - 3);
    expect(support.lowest).toBeLessThan(plaza.min[1] + 0.5);
  }
  expect(push.settledSupport.lowest).toBeCloseTo(plaza.min[1], 1);
  expect(Math.hypot(...push.settledBody.linearVelocity)).toBeLessThan(0.01);
  expect(push.settledBody.angularSpeed).toBeLessThan(0.01);
  expect(push.afterSource).toEqual(push.original);
  await page.screenshot({ path: `${shots}playground-push.png` });
  await page.evaluate(() => window.brickEditor!.play.exit());
  expect(errors).toEqual([]);
});
