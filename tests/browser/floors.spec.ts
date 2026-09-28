import { test, expect, type Page } from "@playwright/test";
import { openMode } from "./helpers/mode";

// Ground (red), upper floor (blue) and roof (yellow) as top-level submodels.
const house = `0 FILE house.ldr
1 16 0 0 0 1 0 0 0 1 0 0 0 1 ground.ldr
1 16 0 -96 0 1 0 0 0 1 0 0 0 1 upper.ldr
1 16 0 -192 0 1 0 0 0 1 0 0 0 1 roof.ldr
0 FILE ground.ldr
1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat
0 FILE upper.ldr
1 1 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 1 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat
0 FILE roof.ldr
1 14 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat`;

const front = {
  space: "ldraw" as const,
  projection: "orthographic" as const,
  position: [0, -84, -400] as [number, number, number],
  target: [0, -84, 0] as [number, number, number],
  up: [0, -1, 0] as [number, number, number],
  fovDeg: 45,
  near: 0.5,
  far: 5000,
  span: 280,
};

/** Capture the front view and count red, blue and yellow pixels. */
const colours = (page: Page) =>
  page.evaluate(async (camera) => {
    const a = window.brickEditor!,
      q = await a.query();
    await a.camera.set(camera);
    const r = await a.render.image({
      revision: q.revision,
      width: 160,
      height: 160,
      format: "png",
      visibility: { mode: "all" },
      background: { type: "solid", color: "#ffffff" },
      quality: "fast",
    });
    const bitmap = await createImageBitmap(r.blob),
      canvas = document.createElement("canvas");
    canvas.width = canvas.height = 160;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const d = ctx.getImageData(0, 0, 160, 160).data;
    let yellow = 0,
      blue = 0,
      red = 0;
    for (let i = 0; i < d.length; i += 4) {
      const [rr, g, b] = [d[i], d[i + 1], d[i + 2]];
      if (rr > 180 && g > 140 && b < 110) yellow++;
      if (b > rr * 1.4 && b > g * 1.1 && b > 120) blue++;
      if (rr > 150 && rr > g * 1.8 && rr > b * 1.8) red++;
    }
    return { yellow, blue, red, architecture: r.manifest.architecture };
  }, front);

test("floor guides, floor focus and room labels are view aids that never change the build", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(
    (text) =>
      window
        .brickEditor!.project.import({ format: "ldraw", text })
        .then(() => window.brickEditor!.ready()),
    house,
  );
  const source = () =>
    page.evaluate(async () =>
      new TextDecoder().decode(
        (await window.brickEditor!.project.export({ format: "ldraw" })).bytes,
      ),
    );
  const before = await source();
  const whole = await colours(page);
  expect(whole.yellow).toBeGreaterThan(200);
  expect(whole.architecture.floorFocus).toBeNull();

  // Detect floors from the camera-views popover.
  await page.getByRole("button", { name: "Camera views" }).click();
  await page.getByRole("button", { name: "Floors", exact: true }).click();
  await page.getByRole("button", { name: "Detect floors" }).click();
  const focus = page.getByRole("group", { name: "Floor focus" });
  await expect(focus.getByRole("button")).toHaveText([
    "All floors",
    "Floor 2",
    "Floor 1",
    "Ground floor",
  ]);
  const report = await page.evaluate(() =>
    window.brickEditor!.architecture.get(),
  );
  expect(report.floors.map((f) => [f.name, f.parts])).toEqual([
    ["Ground floor", 2],
    ["Floor 1", 2],
    ["Floor 2", 1],
  ]);
  expect(
    await page.evaluate(() => window.brickEditor!.render.floors.get()),
  ).toMatchObject({ floorGuides: true, drawn: { guides: 3 } });

  // Rename the roof level through the floor editor (one undoable command).
  await page.getByText("Edit floors (3)").click();
  const roofName = page.getByRole("textbox", { name: "Floor name" }).first();
  await roofName.fill("Roof");
  await roofName.press("Enter");
  await expect(focus.getByRole("button", { name: "Roof" })).toBeVisible();

  // "Show Floor 1": the roof is hidden, the ground floor ghosted, nothing deleted.
  await focus.getByRole("button", { name: "Floor 1" }).click();
  const state = await page.evaluate(() =>
    window.brickEditor!.render.floors.get(),
  );
  expect(state).toMatchObject({ hidden: 1, ghosted: 2 });
  const focused = await colours(page);
  expect(focused.yellow).toBeLessThan(20);
  expect(focused.blue).toBeGreaterThan(200);
  expect(focused.red).toBeLessThan(whole.red / 2); // ghosted, not solid
  expect(focused.architecture.floorFocus).toMatchObject({ ghostBelow: true });
  await page.getByRole("checkbox", { name: "Ghost floors below" }).uncheck();
  expect((await colours(page)).red).toBeGreaterThan(whole.red * 0.8);
  expect(await source()).toBe(before);

  // Place a room label by tapping the model.
  await page.getByText("Room labels (0)").click();
  await page.getByRole("textbox", { name: "Room label" }).fill("Bedroom");
  await page.getByRole("button", { name: "Place label" }).click();
  await expect(page.locator(".label-pick-card")).toContainText("Bedroom");
  await page.evaluate(
    (camera) => window.brickEditor!.camera.set(camera),
    front,
  );
  const box = (await page.locator(".viewport canvas").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 - 20);
  await expect(page.locator(".label-pick-card")).toBeHidden();
  const labelled = await page.evaluate(() =>
    window.brickEditor!.architecture.get(),
  );
  expect(labelled.labels).toHaveLength(1);
  expect(labelled.labels[0]).toMatchObject({ text: "Bedroom" });
  expect(labelled.floors[1].labels).toBe(1); // tied to Floor 1
  expect(
    (await page.evaluate(() => window.brickEditor!.render.floors.get())).drawn
      .labels,
  ).toBe(1);
  // Focusing the ground floor hides the upper floor's label with its floor.
  await page.getByRole("button", { name: "Camera views" }).click();
  await focus.getByRole("button", { name: "Ground floor" }).click();
  expect(
    await page.evaluate(() => window.brickEditor!.render.floors.get()),
  ).toMatchObject({ hidden: 3, drawn: { labels: 0 } });
  expect(await source()).toBe(before);

  // Play shares the renderer: floor focus is suspended there and restored on return.
  await openMode(page, "Play");
  expect(
    (await page.evaluate(() => window.brickEditor!.render.floors.get())).focus,
  ).toBeNull();
  await openMode(page, "Build");
  expect(
    (await page.evaluate(() => window.brickEditor!.render.floors.get())).hidden,
  ).toBe(3);
  expect(errors).toEqual([]);
});

test("camera bookmarks keep a floor view for collections, and aids survive native save", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(
    async ({ text, camera }) => {
      const a = window.brickEditor!;
      await a.project.import({ format: "ldraw", text });
      await a.ready();
      const dispatch = async (type: string, payload: object) =>
        a.dispatch({
          schemaVersion: 1,
          commandId: crypto.randomUUID(),
          expectedRevision: (await a.query()).revision,
          type,
          payload: payload as Record<string, unknown>,
        });
      const { floors } = await a.architecture.detectFloors();
      await dispatch("floors.set", { floors });
      await dispatch("labels.add", {
        text: "Hall",
        position: [0, -24, 0],
      });
      await dispatch("camera.bookmark", { name: "exterior/front", camera });
      // "Hide the roof in this camera profile."
      await dispatch("camera.bookmark", {
        name: "interior/upper",
        camera,
        floorFocus: { floorId: floors[1].id, ghostBelow: false },
      });
      await a.render.floors.set({ roomLabels: true });
      const collection = await a.render.collection({
        prefix: "",
        width: 120,
        height: 120,
      });
      const after = await a.render.floors.get();
      const unknown = await a.render.floors
        .set({ focus: { floorId: "nope", ghostBelow: true } })
        .then(
          () => "accepted",
          (e) => e.message,
        );
      const saved = await a.project.export({ format: "native" });
      const project = await a.architecture.get();
      await a.project.import({ format: "template", template: "blank" });
      await a.project.import({
        format: "native",
        bytes: Array.from(saved.bytes),
      });
      await a.ready();
      return {
        images: collection.manifest.images.map((i) => [i.name, i.floorFocus]),
        after,
        unknown,
        before: project,
        restored: await a.architecture.get(),
        ldraw: new TextDecoder().decode(
          (await a.project.export({ format: "ldraw" })).bytes,
        ),
      };
    },
    { text: house, camera: front },
  );
  expect(result.images).toEqual([
    ["exterior/front", null],
    [
      "interior/upper",
      { floorId: result.before.floors[1].id, ghostBelow: false },
    ],
  ]);
  // The collection restores the editor's own (unfocused) view afterwards.
  expect(result.after.focus).toBeNull();
  expect(result.unknown).toMatch(/Unknown floor/);
  expect(result.restored.floors).toEqual(result.before.floors);
  expect(result.restored.labels).toEqual(result.before.labels);
  expect(result.restored.views).toEqual(result.before.views);
  expect(result.ldraw).not.toContain("Hall");
  expect(errors).toEqual([]);
});
