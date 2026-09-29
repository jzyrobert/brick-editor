import { expect, test } from "@playwright/test";
import { architecturalStressModel } from "../helpers/architectural-stress";

/**
 * Reloading the page with a large autosaved project must not freeze it: the
 * saved copy is verified in a worker, the model is compiled and placed in
 * short tasks and drawn progressively, and the editor answers input before
 * the model has finished loading. Before, recovering a 20,000-part project
 * blocked the page in tasks of up to about 2.4 s (1.8 s of them reading the
 * saved copy back and replacing the document) and a mode switch clicked
 * during recovery took about 8 s to answer on the test VM.
 */
const PARTS = 20000;
/** Longest main-thread task allowed during recovery. After the change the
 * longest was 0.42–0.99 s on the shared VM (the first frame's software shader
 * compilation, the JSON parse and the first workspace render, stretched by
 * the VM's load); before it was 1.1–2.4 s. */
const LONGEST_TASK_MS = 1500;
test.describe.configure({ timeout: 600000 });

test("a large autosaved project recovers without freezing the page", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __long: number[];
      __projectPressedAt?: number;
    };
    w.__long = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__long.push(e.duration);
    }).observe({ type: "longtask", buffered: true });
    // When the Project mode tab starts showing as pressed.
    new MutationObserver(() => {
      const pressed = document.querySelector(
        'nav[aria-label="Editor mode"] button[aria-pressed="true"]',
      );
      if (
        w.__projectPressedAt === undefined &&
        pressed?.textContent?.includes("Project")
      )
        w.__projectPressedAt = performance.now();
    }).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["aria-pressed"],
    });
  });
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const model = architecturalStressModel({ parts: PARTS, variants: 200 });
  await page.evaluate(async (text) => {
    const a = window.brickEditor!;
    await a.ready();
    const r = await a.project.import({
      format: "ldraw",
      text,
      name: "stress-village.mpd",
    });
    await a.ready({ minRevision: r.revision });
  }, model.text);
  // Autosaved as this device's current project.
  await expect(page.locator(".save-state")).toHaveText(/^Saved revision/, {
    timeout: 300000,
  });

  await page.reload();
  const nav = page.getByRole("navigation", { name: "Editor mode" });
  await nav.getByRole("button", { name: "Project", exact: true }).click();
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async (parts) => {
    const a = window.brickEditor!;
    for (;;) {
      await a.ready().catch(() => {});
      if ((await a.render.budget()).usage?.partOccurrences === parts) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    const doneAt = performance.now();
    await new Promise((r) => setTimeout(r, 500));
    const w = window as unknown as {
      __long: number[];
      __projectPressedAt?: number;
    };
    return {
      doneAt,
      pressedAt: w.__projectPressedAt,
      longest: Math.max(0, ...w.__long),
      longTasks: w.__long.length,
      longTotal: Math.round(w.__long.reduce((t, d) => t + d, 0)),
    };
  }, PARTS);
  console.log("startup recovery", JSON.stringify(result));
  // The mode switch was answered before the model finished loading.
  expect(result.pressedAt).toBeDefined();
  expect(result.pressedAt!).toBeLessThan(result.doneAt);
  expect(result.longest).toBeLessThan(LONGEST_TASK_MS);
  // Every recovered part is drawn.
  const drawn = await page.evaluate(async () => {
    const a = window.brickEditor!;
    const before = (await a.render.budget()).lastFrame.frames;
    for (let i = 0; i < 600; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      if ((await a.render.budget()).lastFrame.frames > before) break;
    }
    return (await a.render.budget()).batches.occurrencesDrawn;
  });
  expect(drawn).toBe(PARTS);
});
