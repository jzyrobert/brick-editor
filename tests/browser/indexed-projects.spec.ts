import { test, expect } from "@playwright/test";
import { unzipSync, strFromU8 } from "fflate";
import { createHash } from "node:crypto";

test("legacy source migrates on save without deleting backup and corrupted newest recovers previous snapshot", async ({
  page,
}) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(() => window.brickEditor!.ready());
  const bytes = await page.evaluate(async () =>
    Array.from(
      (await window.brickEditor!.project.export({ format: "native" })).bytes,
    ),
  );
  const project = JSON.parse(
    strFromU8(unzipSync(Uint8Array.from(bytes))["project.json"]),
  );
  project.id = "legacy-migration-fixture";
  project.title = "Legacy source";
  const json = JSON.stringify(project),
    hash = createHash("sha256").update(json).digest("hex");
  await page.evaluate(
    ({ json, hash, id }) => {
      const key = `brick-editor:${id}:snapshot:0:fixture`;
      localStorage.setItem(key, JSON.stringify({ json, hash }));
      localStorage.setItem(`brick-editor:${id}:head`, key);
      localStorage.setItem("brick-editor-current", id);
    },
    { json, hash, id: project.id },
  );
  await page.reload();
  await expect(page.getByLabel("Project title")).toHaveValue("Legacy source");
  await page.evaluate(async () => {
    const a = window.brickEditor!,
      s = await a.project.status();
    await a.dispatch({
      schemaVersion: 1,
      commandId: crypto.randomUUID(),
      expectedRevision: s.revision,
      type: "project.rename",
      payload: { title: "Migrated revision" },
    });
  });
  await expect(page.locator(".save-state")).toHaveText(
    "Saved on this device · version 2",
  );
  expect(
    await page.evaluate(
      () =>
        !!localStorage.getItem(
          "brick-editor:legacy-migration-fixture:snapshot:0:fixture",
        ),
    ),
  ).toBe(true);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("brick-editor-projects", 1);
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("projects", "readwrite"),
        store = tx.objectStore("projects"),
        r = store.get("legacy-migration-fixture");
      r.onsuccess = () => {
        const record = r.result;
        record.snapshots[0].json = "corrupted";
        store.put(record, "legacy-migration-fixture");
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.getByLabel("Project title")).toHaveValue("Legacy source");
  const restored = await page.evaluate(async () =>
    Array.from(
      (await window.brickEditor!.project.export({ format: "native" })).bytes,
    ),
  );
  const recovered = JSON.parse(
    strFromU8(unzipSync(Uint8Array.from(restored))["project.json"]),
  );
  // Recovery replaces the editor document, which advances only the revision counter.
  expect({ ...recovered, revision: project.revision }).toEqual(project);
  expect(recovered.revision).toBe(project.revision + 1);
});

test("project exceeding localStorage quota remains durable through two revisions", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(() => window.brickEditor!.ready());
  const source =
    "0 Large persistence fixture\n" +
    Array.from(
      { length: 24000 },
      (_, i) =>
        `3 4 ${i % 200} 0 ${Math.floor(i / 200)} ${(i % 200) + 1} 0 ${Math.floor(i / 200)} ${i % 200} 0 ${Math.floor(i / 200) + 1}`,
    ).join("\n");
  await page.evaluate(
    (text) => window.brickEditor!.project.import({ format: "ldraw", text }),
    source,
  );
  // The default localStorage envelope previously threw QuotaExceededError at this size.
  await page.evaluate(() => window.brickEditor!.ready());
  await expect(page.locator(".save-state")).toHaveText(
    "Saved on this device · version 1",
    {
      timeout: 60000,
    },
  );
  const before = await page.evaluate(async () =>
    Array.from(
      (await window.brickEditor!.project.export({ format: "native" })).bytes,
    ),
  );
  const original = JSON.parse(
    strFromU8(unzipSync(Uint8Array.from(before))["project.json"]),
  );
  expect(JSON.stringify(original).length).toBeGreaterThan(5_242_880);
  await page.reload();
  await page.waitForFunction(() => !!window.brickEditor);
  await expect(page.getByLabel("Project title")).toHaveValue(original.title);
  await page.evaluate(async () => {
    const a = window.brickEditor!,
      s = await a.project.status();
    await a.dispatch({
      schemaVersion: 1,
      commandId: crypto.randomUUID(),
      expectedRevision: s.revision,
      type: "project.rename",
      payload: { title: "Durable large project" },
    });
  });
  await expect(page.locator(".save-state")).toHaveText(
    "Saved on this device · version 3",
    {
      timeout: 60000,
    },
  );
  await page.reload();
  await expect(page.getByLabel("Project title")).toHaveValue(
    "Durable large project",
  );
  const bytes = await page.evaluate(async () =>
    Array.from(
      (await window.brickEditor!.project.export({ format: "native" })).bytes,
    ),
  );
  const recovered = JSON.parse(
    strFromU8(unzipSync(Uint8Array.from(bytes))["project.json"]),
  );
  expect(recovered.models).toEqual(original.models);
  expect(recovered.revision).toBe(4);
});
