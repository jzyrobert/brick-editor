import { test, expect } from "@playwright/test";

// Architectural MPDs (for example generated building exports) author walls as thousands of
// non-certified raw type 3/4 faces. Each face used to count as a distinct renderer variant,
// and the loader's twin-face smoothing cancelled their normals so they rendered black.
function architecturalSource(faces: number) {
  const wall: string[] = [
    "0 FILE wall.ldr",
    "0 Name: wall.ldr",
    "0 !LDRAW_ORG Unofficial_Model",
    "0 BFC NOCERTIFY",
  ];
  for (let i = 0; i < faces; i++) {
    const x = (i % 20) * 4,
      y = -Math.floor(i / 20) * 4;
    wall.push(
      i % 2
        ? `4 15 ${x} ${y} 0 ${x + 4} ${y} 0 ${x + 4} ${y - 4} 0 ${x} ${y - 4} 0`
        : `3 15 ${x} ${y} 0 ${x + 4} ${y} 0 ${x + 4} ${y - 4} 0\n3 15 ${x} ${y} 0 ${x + 4} ${y - 4} 0 ${x} ${y - 4} 0`,
    );
  }
  return [
    "0 FILE facade.ldr",
    "0 Name: facade.ldr",
    "0 !COLOUR White CODE 15 VALUE #F4F4F4 EDGE #59636B",
    "1 16 -40 0 0 1 0 0 0 1 0 0 0 1 wall.ldr",
    // Reflected placement must keep outward lit normals after batching.
    "1 16 40 0 10 -1 0 0 0 1 0 0 0 1 wall.ldr",
    "0 NOFILE",
    ...wall,
    "0 NOFILE",
  ].join("\n");
}

test("hundreds of non-certified raw faces load lit and stay individually editable and undoable", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(() => window.brickEditor!.ready());
  const result = await page.evaluate(async (text) => {
    const a = window.brickEditor!;
    await a.project.import({ format: "ldraw", text, name: "facade.mpd" });
    const q = await a.query();
    await a.ready({ strict: true, minRevision: q.revision });
    await a.camera.set({
      space: "ldraw",
      projection: "perspective",
      position: [0, -60, -260],
      target: [0, -60, 0],
      up: [0, -1, 0],
      fovDeg: 45,
      near: 0.5,
      far: 10000,
    });
    const capture = async () => {
      const s = await a.query();
      await a.ready({ strict: true, minRevision: s.revision });
      const r = await a.render.image({
        revision: s.revision,
        width: 256,
        height: 256,
        format: "png",
        visibility: { mode: "all" },
        background: { type: "solid", color: "#303030" },
        quality: "balanced",
        strict: true,
      });
      const bitmap = await createImageBitmap(r.blob),
        canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      const pixels = context.getImageData(0, 0, 256, 256).data;
      let light = 0,
        dark = 0,
        blue = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const [r, g, b] = pixels.slice(i, i + 3);
        if (r > 150 && g > 150 && b > 150) light++;
        if (r < 30 && g < 30 && b < 30) dark++;
        if (b > r * 1.4 && b > g * 1.1) blue++;
      }
      return { light, dark, blue };
    };
    const exported = async () =>
      new TextDecoder().decode(
        (await a.project.export({ format: "ldraw" })).bytes,
      );
    const original = await exported();
    const lit = await capture();
    const face = q.occurrences.find((o) => o.colorCode === "15")!;
    await a.dispatch({
      schemaVersion: 1,
      commandId: crypto.randomUUID(),
      expectedRevision: q.revision,
      type: "parts.recolor",
      payload: { occurrenceIds: [face.id], colorCode: "1" },
    });
    await a.dispatch({
      schemaVersion: 1,
      commandId: crypto.randomUUID(),
      expectedRevision: q.revision + 1,
      type: "parts.transform",
      payload: {
        occurrenceIds: [face.id],
        space: "ldraw",
        transform: {
          position: [0, -8, -20],
          basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
        },
      },
    });
    const edited = await exported();
    const recolored = await capture();
    for (let i = 0; i < 2; i++) {
      const s = await a.query();
      await a.dispatch({
        schemaVersion: 1,
        commandId: crypto.randomUUID(),
        expectedRevision: s.revision,
        type: "history.undo",
        payload: {},
      });
    }
    const undone = await exported();
    const restored = await capture();
    const originalLines = new Set(original.split("\n"));
    const wallBlock = original
      .slice(original.indexOf("0 FILE wall.ldr"))
      .split("0 NOFILE")[0];
    return {
      count: q.projectOccurrenceCount,
      lit,
      recolored,
      restored,
      added: edited.split("\n").filter((line) => !originalLines.has(line)),
      originalWallKept: edited.includes(wallBlock),
      undoneEqual: undone === original,
    };
  }, architecturalSource(300));
  expect(result.count).toBeGreaterThan(700);
  // Lit white walls, not unlit black silhouettes.
  expect(result.lit.light).toBeGreaterThan(3000);
  expect(result.lit.dark).toBeLessThan(200);
  expect(result.recolored.blue).toBeGreaterThan(result.lit.blue + 5);
  // Editing one face of one shared-submodel instance forks that instance (copy-on-write):
  // only its reference, the fork header and the edited record are new; the other
  // instance's source is untouched.
  expect(result.added).toHaveLength(3);
  expect(result.added.filter((line) => /^3 1 /.test(line))).toHaveLength(1);
  expect(result.originalWallKept).toBe(true);
  expect(result.undoneEqual).toBe(true);
  expect(result.restored.blue).toBe(result.lit.blue);
  await expect(page.locator(".save-state")).toContainText(
    "Saved on this device · version",
  );
  expect(errors).toEqual([]);
});
