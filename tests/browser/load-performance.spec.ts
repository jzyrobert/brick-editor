import { expect, test, type Page } from "@playwright/test";

/**
 * Opening a few-hundred-part template must not freeze the page: official
 * part geometry compiles in workers, the remaining main-thread work is split
 * into short tasks, parts appear while the rest compile, and compiled
 * geometry is cached so reopening after a reload skips compilation.
 *
 * Before this, the house template ran as one ~16 s task on the test VM
 * (quadratic normal smoothing of the 32×32 baseplate, on the main thread).
 * What remains longest is the first frame's synchronous shader compilation
 * (software WebGL, 0.3–1.3 s on the shared VM), so the bound is generous;
 * the load work itself must have been split into many tasks.
 */
const LONGEST_TASK_MS = 2500;
test.describe.configure({ timeout: 240000 });

async function openHouse(page: Page) {
  return page.evaluate(async () => {
    const w = window as unknown as {
      __long: number[];
      __progressSeen: boolean;
      __drawnBeforeReady: boolean;
    };
    w.__long = [];
    w.__progressSeen = false;
    w.__drawnBeforeReady = false;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) w.__long.push(entry.duration);
    });
    observer.observe({ type: "longtask" });
    const progress = new MutationObserver(() => {
      if (
        document.querySelector(
          ".load-progress:not(.photo-progress):not([hidden])",
        )
      )
        w.__progressSeen = true;
    });
    progress.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden"],
    });
    const a = window.brickEditor!;
    let ready = false;
    // Parts are drawn while the rest still compile.
    void (async () => {
      const before = (await a.render.budget()).lastFrame.frames;
      while (!ready) {
        await new Promise((r) => requestAnimationFrame(r));
        const frame = (await a.render.budget()).lastFrame;
        if (!ready && frame.frames > before && frame.triangles > 0)
          w.__drawnBeforeReady = true;
      }
    })();
    const t0 = performance.now();
    const imported = await a.project.import({
      format: "template",
      template: "house",
    });
    await a.ready({ minRevision: imported.revision, strict: true });
    ready = true;
    const ms = performance.now() - t0;
    // Long-task entries are delivered asynchronously.
    await new Promise((r) => setTimeout(r, 200));
    observer.disconnect();
    progress.disconnect();
    const stats = await a.render.compileStats();
    const budget = await a.render.budget();
    return {
      ms,
      longest: Math.max(0, ...w.__long),
      longTasks: w.__long.length,
      progressSeen: w.__progressSeen,
      drawnBeforeReady: w.__drawnBeforeReady,
      stats,
      drawn: budget.batches.occurrencesDrawn,
      parts: budget.usage?.partOccurrences,
    };
  });
}

/** Open a blank project and wait until it is the saved "current" project,
 * so a reload recovers nothing that needs compiling. */
async function reloadBlank(page: Page) {
  await page.evaluate(async () => {
    const before = localStorage.getItem("brick-editor-current");
    const a = window.brickEditor!;
    const r = await a.project.import({ format: "template", template: "blank" });
    await a.ready({ minRevision: r.revision });
    for (let i = 0; i < 100; i++) {
      if (localStorage.getItem("brick-editor-current") !== before) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("The blank project was not saved");
  });
  await page.reload();
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(() => window.brickEditor!.ready());
}

test("the house template loads in short tasks, progressively, and reopens from the geometry cache", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(() => window.brickEditor!.ready());
  const cold = await openHouse(page);
  console.log("cold house load", JSON.stringify(cold));
  expect(cold.parts).toBe(281);
  // Compiled off the main thread, then stored.
  expect(cold.stats.workerCompiles).toBeGreaterThan(20);
  expect(cold.stats.mainThread).toBe(0);
  expect(cold.stats.cache?.writes).toBeGreaterThan(20);
  expect(cold.longest).toBeLessThan(LONGEST_TASK_MS);
  expect(cold.stats.lastLoad?.progressive).toBe(true);
  expect(cold.stats.lastLoad?.tasks).toBeGreaterThan(10);
  expect(cold.drawnBeforeReady).toBe(true);
  expect(cold.progressSeen).toBe(true);
  await expect(
    page.locator(".load-progress:not(.photo-progress)"),
  ).toBeHidden();

  // A reload keeps the persistent cache: no part compiles again.
  await reloadBlank(page);
  const warm = await openHouse(page);
  console.log("warm house load", JSON.stringify(warm));
  expect(warm.parts).toBe(281);
  expect(warm.stats.workerCompiles).toBe(0);
  expect(warm.stats.mainThread).toBe(0);
  expect(warm.stats.diskHits).toBe(cold.stats.workerCompiles);
  expect(warm.ms).toBeLessThan(cold.ms);
  expect(warm.longest).toBeLessThan(LONGEST_TASK_MS);
  // Rebuilt from cached records, every part is drawn.
  const frames = await page.evaluate(async () => {
    const a = window.brickEditor!;
    const before = (await a.render.budget()).lastFrame.frames;
    for (let i = 0; i < 300; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      if ((await a.render.budget()).lastFrame.frames > before) break;
    }
    return (await a.render.budget()).batches.occurrencesDrawn;
  });
  expect(frames).toBe(281);
  expect(errors).toEqual([]);
});

test("a corrupt geometry cache entry is recompiled, not drawn", async ({
  page,
}) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.ready();
    const imported = await a.project.import({
      format: "template",
      template: "car",
    });
    await a.ready({ minRevision: imported.revision, strict: true });
  });
  // Flip bytes in every stored record, behind the cache's back.
  const corrupted = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open("brick-editor-geometry");
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const tx = db.transaction("data", "readwrite");
    const store = tx.objectStore("data");
    const keys = await new Promise<IDBValidKey[]>((resolve) => {
      const r = store.getAllKeys();
      r.onsuccess = () => resolve(r.result);
    });
    for (const key of keys) {
      const value = await new Promise<{ data: ArrayBuffer; sha256: string }>(
        (resolve) => {
          const r = store.get(key);
          r.onsuccess = () => resolve(r.result);
        },
      );
      const bytes = new Uint8Array(value.data);
      bytes[bytes.length - 1] ^= 0xff;
      store.put(value, key);
    }
    await new Promise((resolve) => (tx.oncomplete = resolve));
    db.close();
    return keys.length;
  });
  expect(corrupted).toBeGreaterThan(5);
  await reloadBlank(page);
  const stats = await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.ready();
    const imported = await a.project.import({
      format: "template",
      template: "car",
    });
    await a.ready({ minRevision: imported.revision, strict: true });
    return a.render.compileStats();
  });
  expect(stats.diskHits).toBe(0);
  expect(stats.cache?.corrupt).toBe(corrupted);
  expect(stats.workerCompiles).toBe(corrupted);
});
