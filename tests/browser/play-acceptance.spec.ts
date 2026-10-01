import { test, expect, type Page } from "@playwright/test";
import { openMenuTab, openMode } from "./helpers/mode";
async function enter(page: Page) {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor?.play);
  await openMode(page, "Play");
  await page.evaluate(async () => {
    await window.brickEditor!.play.enter({
      realtime: false,
      locomotion: "fly-noclip",
      position: [0, -100, 0],
    });
  });
}
test("PL07 Run toggle keeps a held touch joystick moving", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
    hasTouch: true,
    baseURL,
  });
  const page = await context.newPage();
  try {
    await enter(page);
    const cdp = await context.newCDPSession(page);
    const stick = (await page
      .getByRole("group", { name: "Movement joystick" })
      .boundingBox())!;
    const run = (await page
      .getByRole("button", { name: "Run", exact: true })
      .boundingBox())!;
    const move = {
      id: 1,
      x: stick.x + stick.width / 2,
      y: stick.y + stick.height / 2 - 28,
    };
    const toggle = {
      id: 2,
      x: run.x + run.width / 2,
      y: run.y + run.height / 2,
    };
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [move],
    });
    const moving = await page.evaluate(() =>
      window.brickEditor!.play.stepTicks(6),
    );
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [move, toggle],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [toggle],
    });
    await expect(
      page.getByRole("button", { name: "Run", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const running = await page.evaluate(() =>
      window.brickEditor!.play.stepTicks(6),
    );
    expect(
      Math.hypot(
        running.position[0] - moving.position[0],
        running.position[2] - moving.position[2],
      ),
    ).toBeGreaterThan(5);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
  } finally {
    await context.close();
  }
});
test("PL07 lost capture releases held flight descent", async ({ page }) => {
  await enter(page);
  const down = page.getByRole("button", { name: "Down", exact: true });
  const box = (await down.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2);
  const moved = await page.evaluate(() =>
    window.brickEditor!.play.stepTicks(6),
  );
  await down.evaluate((el) => (el as HTMLElement).releasePointerCapture(1));
  await page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height / 2);
  const stopped = await page.evaluate(() =>
    window.brickEditor!.play.stepTicks(6),
  );
  await page.mouse.up();
  expect(stopped.position[1]).toBeCloseTo(moved.position[1], 5);
});
test("PL07 focusing editable text clears a held movement key", async ({
  page,
}) => {
  await enter(page);
  await page.keyboard.down("w");
  const moving = await page.evaluate(() =>
    window.brickEditor!.play.stepTicks(6),
  );
  await page.evaluate(() => {
    const field = document.createElement("div");
    field.contentEditable = "true";
    field.tabIndex = 0;
    document.body.append(field);
    field.focus();
  });
  const stopped = await page.evaluate(() =>
    window.brickEditor!.play.stepTicks(6),
  );
  expect(stopped.position).toEqual(moving.position);
  await page.keyboard.up("w");
});

test("PL08 repeated third-person entry releases GL objects and global listeners after warmup", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const live: Record<string, Set<object>> = {};
    const proto = WebGL2RenderingContext.prototype as unknown as Record<
      string,
      (...args: any[]) => any
    >;
    for (const kind of [
      "Buffer",
      "Texture",
      "Framebuffer",
      "Renderbuffer",
      "VertexArray",
      "Program",
      "Shader",
    ]) {
      const create = proto[`create${kind}`],
        destroy = proto[`delete${kind}`];
      live[kind] = new Set();
      proto[`create${kind}`] = function (...args: any[]) {
        const value = create.apply(this, args);
        if (value) live[kind].add(value);
        return value;
      };
      proto[`delete${kind}`] = function (value: object, ...args: any[]) {
        live[kind].delete(value);
        return destroy.call(this, value, ...args);
      };
    }
    const events = new Map<EventTarget, Map<string, Set<unknown>>>();
    const originalAdd = EventTarget.prototype.addEventListener,
      originalRemove = EventTarget.prototype.removeEventListener;
    const registration = (
      target: EventTarget,
      type: string,
      options: boolean | AddEventListenerOptions | undefined,
    ) => {
      if (target !== window && target !== document) return;
      let byType = events.get(target);
      if (!byType) events.set(target, (byType = new Map()));
      const key = `${type}:${typeof options === "boolean" ? options : !!options?.capture}`;
      let listeners = byType.get(key);
      if (!listeners) byType.set(key, (listeners = new Set()));
      return listeners;
    };
    EventTarget.prototype.addEventListener = function (
      type,
      listener,
      options,
    ) {
      registration(this, type, options)?.add(listener);
      return originalAdd.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (
      type,
      listener,
      options,
    ) {
      registration(this, type, options)?.delete(listener);
      return originalRemove.call(this, type, listener, options);
    };
    (window as any).__playResourceCounts = () => ({
      gl: Object.fromEntries(
        Object.entries(live).map(([k, set]) => [k, set.size]),
      ),
      listeners: [...events.values()]
        .flatMap((map) => [...map.values()])
        .reduce((n, set) => n + set.size, 0),
    });
  });
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor?.play);
  await page.evaluate(async () => {
    await window.brickEditor!.project.import({
      format: "template",
      template: "blank",
    });
    await window.brickEditor!.ready({ strict: true });
  });
  const samples = await page.evaluate(async () => {
    const api = window.brickEditor!;
    const frame = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    const counts: Array<{ gl: Record<string, number>; listeners: number }> = [];
    for (let cycle = 0; cycle < 8; cycle++) {
      [...document.querySelectorAll("button")]
        .find((button) => button.textContent === "Play")!
        .click();
      await frame();
      await api.play.enter({ cameraMode: "third-person", realtime: false });
      await api.play.setInput({ moveZ: 1 });
      await api.play.stepTicks(6);
      await api.play.pause(true);
      await frame();
      [...document.querySelectorAll("button")]
        .find((button) => button.textContent === "Exit Play")!
        .click();
      await frame();
      counts.push((window as any).__playResourceCounts());
    }
    return counts;
  });
  await test.info().attach("play-lifecycle-counts", {
    body: JSON.stringify(samples, null, 2),
    contentType: "application/json",
  });
  for (const sample of samples.slice(2)) expect(sample).toEqual(samples[1]);
});

test("PL02/04 a frozen Play view captures and bookmarks without pointer lock, and replacing the build cancels Play", async ({
  page,
}) => {
  await enter(page);
  const before = await page.evaluate(async () => {
    const api = window.brickEditor!;
    await api.play.setInput({ moveZ: 1, yaw: 0.3, pitch: 0.15 });
    await api.play.stepTicks(12);
    await api.play.setInput({});
    const q = await api.query(),
      play = await api.play.snapshot();
    const image = await api.render.image({
      revision: q.revision,
      width: 128,
      height: 128,
      format: "png",
      visibility: { mode: "all" },
      background: { type: "transparent" },
      quality: "fast",
      strict: true,
    });
    return {
      q,
      play,
      manifest: image.manifest,
      locked: !!document.pointerLockElement,
    };
  });
  expect(before.locked).toBe(false);
  // A square capture reports its own near-plane footprint, while restoring
  // the interactive aspect and leaving the actor and simulation untouched.
  expect(before.manifest.play).toEqual({
    ...before.play,
    cameraSafety: { ...before.play.cameraSafety, aspectRatio: 1 },
  });
  expect(
    await page.evaluate(() => window.brickEditor!.play.snapshot()),
  ).toEqual(before.play);
  expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
    before.q,
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page
    .getByRole("button", { name: "Save this view to Photo", exact: true })
    .click();
  await openMenuTab(page, "Photo", "Saved views");
  await page
    .getByRole("button", { name: "Exploration view", exact: true })
    .click();
  const saved = await page.evaluate(async () => {
    const api = window.brickEditor!,
      q = await api.query();
    const image = await api.render.image({
      revision: q.revision,
      width: 128,
      height: 128,
      format: "png",
      visibility: { mode: "all" },
      background: { type: "transparent" },
      quality: "fast",
      strict: true,
    });
    return { q, camera: image.manifest.camera };
  });
  expect(saved.q.revision).toBe(before.q.revision + 1);
  expect(saved.q.occurrences).toEqual(before.q.occurrences);
  for (const field of ["position", "target", "up"] as const)
    for (let axis = 0; axis < 3; axis++)
      expect(saved.camera[field][axis]).toBeCloseTo(
        before.manifest.camera[field][axis],
        10,
      );
  for (const field of ["projection", "fovDeg", "near", "far"] as const)
    expect(saved.camera[field]).toEqual(before.manifest.camera[field]);
  const replaced = await page.evaluate(async () => {
    const api = window.brickEditor!;
    await api.play.enter({ realtime: false });
    await api.project.import({ format: "template", template: "blank" });
    try {
      await api.play.snapshot();
      return false;
    } catch {
      return true;
    }
  });
  expect(replaced).toBe(true);
});
