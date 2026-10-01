import { test, expect, type Page } from "@playwright/test";
import { openMenuTab, openMode } from "./helpers/mode";

/** Records in an IndexedDB object store (0 when the database is empty). */
const count = (page: Page, database: string, store: string) =>
  page.evaluate(
    async ({ database, store }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open(database);
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      try {
        if (!db.objectStoreNames.contains(store)) return 0;
        return await new Promise<number>((resolve, reject) => {
          const r = db
            .transaction(store, "readonly")
            .objectStore(store)
            .count();
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
        });
      } finally {
        db.close();
      }
    },
    { database, store },
  );

test("Clear saved builds deletes every saved project and autosave, keeps the part cache", async ({
  page,
}) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  // Two builds, each autosaved on this device (the second is current).
  for (const template of ["car", "wall"] as const) {
    await page.evaluate(async (template) => {
      const a = window.brickEditor!;
      await a.ready();
      const r = await a.project.import({ format: "template", template });
      await a.ready({ minRevision: r.revision, strict: true });
    }, template);
    await expect(page.locator(".save-state")).toHaveText(/^Saved revision/, {
      timeout: 60000,
    });
  }
  // A preference in the same storage stays.
  await page.evaluate(() =>
    localStorage.setItem("brick-editor-play-keys-v1", "kept"),
  );
  const geometry = await count(page, "brick-editor-geometry", "meta");
  expect(geometry).toBeGreaterThan(5);
  expect(
    await count(page, "brick-editor-projects", "projects"),
  ).toBeGreaterThanOrEqual(2);

  // Project › My builds, after the saved list.
  await openMenuTab(page, "Project", "My builds");
  await page.getByRole("button", { name: "Clear saved builds…" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Clear saved builds?" });
  await expect(dialog).toContainText("2 saved projects");
  await expect(dialog).toContainText("can’t be undone");
  // Cancel keeps everything; focus starts on Cancel.
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await count(page, "brick-editor-projects", "projects")).toBe(2);

  await page.getByRole("button", { name: "Clear saved builds…" }).click();
  await dialog.getByRole("button", { name: "Delete 2 saved projects" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel("Project title")).toHaveValue("Untitled build");
  expect(await count(page, "brick-editor-projects", "projects")).toBe(0);
  expect(
    await page.evaluate(() => ({
      current: localStorage.getItem("brick-editor-current"),
      keys: localStorage.getItem("brick-editor-play-keys-v1"),
    })),
  ).toEqual({ current: null, keys: "kept" });
  // The blank canvas is not saved until it changes.
  await page.waitForTimeout(4000);
  expect(await count(page, "brick-editor-projects", "projects")).toBe(0);

  // Reload: nothing to recover, nothing saved, and the parts cache is warm.
  await page.reload();
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(() => window.brickEditor!.ready());
  await expect(page.getByLabel("Project title")).toHaveValue("Untitled build");
  await expect(page.getByText("Recovered local project")).toHaveCount(0);
  await openMenuTab(page, "Project", "My builds");
  await expect(page.getByText("No saved projects found yet.")).toBeVisible();
  expect(await count(page, "brick-editor-geometry", "meta")).toBe(geometry);
  const stats = await page.evaluate(async () => {
    const a = window.brickEditor!;
    const r = await a.project.import({ format: "template", template: "car" });
    await a.ready({ minRevision: r.revision, strict: true });
    return a.render.budget();
  });
  expect(stats).toBeTruthy();
  expect(await count(page, "brick-editor-geometry", "meta")).toBe(geometry);
  expect(errors).toEqual([]);
});
