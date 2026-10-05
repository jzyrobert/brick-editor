import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
import { createHash } from "node:crypto";
import { openMenuTab, openMode } from "./helpers/mode";
async function rename(page: Page, title: string) {
  await page.evaluate(async (title) => {
    const a = window.brickEditor!,
      q = await a.query();
    await a.dispatch({
      schemaVersion: 1,
      commandId: crypto.randomUUID(),
      expectedRevision: q.revision,
      type: "project.rename",
      payload: { title },
    });
  }, title);
}
async function saved(page: Page) {
  await expect(page.locator(".save-state")).toContainText(
    "Saved on this device · version",
  );
}
async function stored(page: Page, id?: string) {
  return page.evaluate(async (id) => {
    const selected = id ?? localStorage.getItem("brick-editor-current")!;
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("brick-editor-projects", 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const record = await new Promise<any>((resolve, reject) => {
      const r = db
        .transaction("projects")
        .objectStore("projects")
        .get(selected);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    db.close();
    return record?.deleted ? null : JSON.parse(record.snapshots[0].json);
  }, id);
}
test("two tabs cannot overwrite saved edits and the losing tab can fork", async ({
  page,
  context,
}) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(() => window.brickEditor!.ready());
  await rename(page, "Shared starting project");
  await saved(page);
  const original = await stored(page);
  const second = await context.newPage();
  await second.goto("./?automation=1");
  await expect(second.getByLabel("Project title")).toHaveValue(
    "Shared starting project",
  );
  await second.evaluate(() => window.brickEditor!.ready());
  await rename(page, "First tab wins");
  await saved(page);
  await expect(second.getByRole("alert")).toContainText(
    "Another tab saved this project",
  );
  await rename(second, "Second tab work");
  await expect(second.getByRole("alert")).toContainText(
    "Another tab saved this project",
  );
  expect((await stored(second, original.id)).title).toBe("First tab wins");
  await second
    .getByRole("button", { name: "Fork my edits", exact: true })
    .click();
  await saved(second);
  const fork = await stored(second);
  expect(fork.id).not.toBe(original.id);
  expect(fork.title).toBe("Second tab work (copy)");
  expect((await stored(second, original.id)).title).toBe("First tab wins");
  await expect(second.getByRole("alert")).toHaveCount(0);
  await second.close();
});
test("saved-project UI opens, downloads a valid backup and deletes only the chosen saved copy", async ({
  page,
}) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    await window.brickEditor!.project.import({
      format: "template",
      template: "wall",
    });
  });
  await rename(page, "Saved wall");
  await saved(page);
  const wall = await stored(page);
  await page.evaluate(async () => {
    await window.brickEditor!.project.import({
      format: "template",
      template: "blank",
    });
  });
  await rename(page, "Current blank");
  await saved(page);
  const blank = await stored(page);
  await openMenuTab(page, "Project", "My builds");
  const row = page.locator(".saved-project").filter({ hasText: "Saved wall" });
  await expect(row).toBeVisible();
  const event = page.waitForEvent("download");
  await row.getByRole("button", { name: "Download backup" }).click();
  const download = await event;
  const backupFiles = unzipSync(await readFile((await download.path())!));
  const backupJson = strFromU8(backupFiles["project.json"]);
  expect(createHash("sha256").update(backupJson).digest("hex")).toBe(
    JSON.parse(strFromU8(backupFiles["manifest.json"])).projectSha256,
  );
  const restored = JSON.parse(backupJson);
  expect(restored.id).toBe(wall.id);
  expect(restored.title).toBe("Saved wall");
  await row.getByRole("button", { name: "Open saved project" }).click();
  await expect(page.getByLabel("Project title")).toHaveValue("Saved wall");
  expect(
    (await page.evaluate(() => window.brickEditor!.query())).occurrences,
  ).toHaveLength(40);
  await openMenuTab(page, "Project", "My builds");
  await page
    .locator(".saved-project")
    .filter({ hasText: "Current blank" })
    .getByRole("button", { name: "Open saved project" })
    .click();
  await expect(page.getByLabel("Project title")).toHaveValue("Current blank");
  await openMenuTab(page, "Project", "My builds");
  await row
    .getByRole("button", { name: "Delete saved copy", exact: true })
    .click();
  await row
    .getByRole("button", { name: "Delete this saved project", exact: true })
    .click();
  await expect(row).toHaveCount(0);
  expect(
    await page.evaluate(
      (id) =>
        Object.keys(localStorage).some((k) =>
          k.startsWith("brick-editor:" + encodeURIComponent(id) + ":"),
        ),
      wall.id,
    ),
  ).toBe(false);
  expect((await stored(page, blank.id)).title).toBe("Current blank");
});

test("an early import during delayed startup recovery wins and is autosaved", async ({
  page,
}) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    await window.brickEditor!.project.import({
      format: "template",
      template: "wall",
    });
  });
  await rename(page, "Previously saved wall");
  await saved(page);
  const original = await stored(page);
  await page.addInitScript(() => {
    const controls = window as typeof window & {
      recoveryBlocked?: boolean;
      releaseRecovery?: () => void;
    };
    // Recovery verifies the stored project in a worker: hold its reply.
    const NativeWorker = window.Worker;
    class HeldWorker extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        if (!String(url).includes("project-restore")) return;
        let handler: ((e: MessageEvent) => void) | null = null;
        Object.defineProperty(this, "onmessage", {
          configurable: true,
          get: () => handler,
          set: (h: ((e: MessageEvent) => void) | null) => {
            handler = h;
          },
        });
        NativeWorker.prototype.addEventListener.call(
          this,
          "message",
          (e: Event) => {
            controls.recoveryBlocked = true;
            void new Promise<void>((resolve) => {
              controls.releaseRecovery = resolve;
            }).then(() => handler?.call(this, e as MessageEvent));
          },
        );
      }
    }
    window.Worker = HeldWorker;
  });
  await page.reload();
  await page.waitForFunction(
    () =>
      !!window.brickEditor &&
      (window as typeof window & { recoveryBlocked?: boolean }).recoveryBlocked,
  );
  await page.evaluate(async () => {
    await window.brickEditor!.project.import({
      format: "template",
      template: "blank",
    });
  });
  await rename(page, "New work during recovery");
  const early = await page.evaluate(() => window.brickEditor!.query());
  expect(early.occurrences).toHaveLength(0);
  await expect(page.getByLabel("Project title")).toHaveValue(
    "New work during recovery",
  );
  await page.evaluate(() =>
    (
      window as typeof window & { releaseRecovery: () => void }
    ).releaseRecovery(),
  );
  await expect
    .poll(async () => (await stored(page)).title)
    .toBe("New work during recovery");
  expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(early);
  const current = await stored(page);
  expect(current.id).not.toBe(original.id);
  expect(current.models[current.rootModelId].nodes).toHaveLength(0);
  expect(await stored(page, original.id)).toEqual(original);
});

test("IndexedDB fallback serializes two tabs across asynchronous checksums without Web Locks", async ({
  page,
  context,
}) => {
  await context.addInitScript(() =>
    Object.defineProperty(navigator, "locks", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(() => window.brickEditor!.ready());
  await rename(page, "Fallback baseline");
  await saved(page);
  const original = await stored(page),
    second = await context.newPage();
  await second.goto("./?automation=1");
  await expect(second.getByLabel("Project title")).toHaveValue(
    "Fallback baseline",
  );
  await second.evaluate(() => window.brickEditor!.ready());
  await page.evaluate(() => {
    const w = window as any,
      digest = crypto.subtle.digest.bind(crypto.subtle);
    w.fallbackHeld = false;
    w.fallbackGate = new Promise<void>((resolve) => {
      w.releaseFallback = resolve;
    });
    crypto.subtle.digest = async (
      ...args: Parameters<SubtleCrypto["digest"]>
    ) => {
      if (
        new TextDecoder()
          .decode(args[1])
          .includes('"title":"Fallback baseline"')
      ) {
        w.fallbackHeld = true;
        await w.fallbackGate;
      }
      return digest(...args);
    };
  });
  await second.evaluate(() => {
    const w = window as any,
      digest = crypto.subtle.digest.bind(crypto.subtle);
    w.fallbackReads = 0;
    crypto.subtle.digest = async (
      ...args: Parameters<SubtleCrypto["digest"]>
    ) => {
      if (
        new TextDecoder()
          .decode(args[1])
          .includes('"title":"Fallback baseline"')
      )
        w.fallbackReads++;
      return digest(...args);
    };
  });
  await rename(page, "Fallback winner");
  await page.waitForFunction(() => (window as any).fallbackHeld);
  await rename(second, "Fallback losing edits");
  // Let the second tab's 750ms autosave enter its transaction queue while the
  // first owns an actual exclusive transaction paused in a checksum.
  await second.waitForTimeout(1000);
  expect(await second.evaluate(() => (window as any).fallbackReads)).toBe(0);
  expect((await stored(second, original.id)).title).toBe("Fallback baseline");
  await page.evaluate(() => (window as any).releaseFallback());
  await saved(page);
  await expect(second.getByRole("alert")).toContainText(
    "Another tab saved this project",
  );
  expect((await stored(second, original.id)).title).toBe("Fallback winner");
  await second
    .getByRole("button", { name: "Fork my edits", exact: true })
    .click();
  await saved(second);
  expect((await stored(second)).title).toBe("Fallback losing edits (copy)");
  expect((await stored(second, original.id)).title).toBe("Fallback winner");
  await second.close();
});

test("unavailable coordination preserves saved bytes and offers a native backup", async ({
  page,
  context,
}) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(() => window.brickEditor!.ready());
  await rename(page, "Protected saved copy");
  await saved(page);
  const original = await stored(page);
  await page.evaluate(() => {
    (window as any).savedIDB = indexedDB;
    Object.defineProperty(navigator, "locks", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(window, "indexedDB", {
      value: undefined,
      configurable: true,
    });
  });

  await rename(page, "Unsaved in memory");
  await expect(page.getByRole("alert")).toContainText(
    "Automatic saving is unavailable",
  );
  await page.evaluate(() =>
    Object.defineProperty(window, "indexedDB", {
      value: (window as any).savedIDB,
      configurable: true,
    }),
  );
  expect((await stored(page, original.id)).title).toBe("Protected saved copy");
  const event = page.waitForEvent("download");
  await page
    .getByRole("alert")
    .getByRole("button", { name: "Download my backup" })
    .click();
  const download = await event;
  const bundle = unzipSync(await readFile((await download.path())!));
  expect(JSON.parse(strFromU8(bundle["project.json"])).title).toBe(
    "Unsaved in memory",
  );
});

test("an expired fallback transaction cannot publish after its checksum resumes", async ({
  page,
  context,
}) => {
  await context.addInitScript(() =>
    Object.defineProperty(navigator, "locks", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(() => window.brickEditor!.ready());
  await rename(page, "Timeout baseline");
  await saved(page);
  const original = await stored(page);
  await page.evaluate(() => {
    const w = window as any,
      timer = window.setTimeout.bind(window),
      digest = crypto.subtle.digest.bind(crypto.subtle);
    window.setTimeout = ((
      handler: TimerHandler,
      delay?: number,
      ...args: any[]
    ) =>
      timer(
        handler,
        delay === 30000 ? 50 : delay,
        ...args,
      )) as typeof window.setTimeout;
    const gate = new Promise<void>((resolve) => {
      w.releaseExpired = resolve;
    });
    w.expiredResumed = false;
    crypto.subtle.digest = async (
      ...args: Parameters<SubtleCrypto["digest"]>
    ) => {
      if (
        new TextDecoder().decode(args[1]).includes('"title":"Timeout baseline"')
      ) {
        await gate;
        const result = await digest(...args);
        w.expiredResumed = true;
        return result;
      }
      return digest(...args);
    };
  });
  await rename(page, "Must stay in memory");
  await expect(page.getByRole("alert")).toContainText(
    "Automatic saving is unavailable",
  );
  expect((await stored(page, original.id)).title).toBe("Timeout baseline");
  await page.evaluate(() => (window as any).releaseExpired());
  await page.waitForFunction(() => (window as any).expiredResumed);
  expect((await stored(page, original.id)).title).toBe("Timeout baseline");
  expect(
    (await page.evaluate(() => window.brickEditor!.query())).revision,
  ).toBeGreaterThan(original.revision);
});

test("another-tab notification can back up the current draft before reloading the winner", async ({
  page,
  context,
}) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(() => window.brickEditor!.ready());
  await rename(page, "Reload baseline");
  await saved(page);
  const second = await context.newPage();
  await second.goto("./?automation=1");
  await expect(second.getByLabel("Project title")).toHaveValue(
    "Reload baseline",
  );
  await rename(page, "New saved winner");
  await saved(page);
  await expect(second.getByRole("alert")).toContainText(
    "Another tab saved this project",
  );
  await rename(second, "Draft to keep");
  const event = second.waitForEvent("download");
  await second
    .getByRole("button", { name: "Back up and reload saved", exact: true })
    .click();
  const download = await event;
  const bundle = unzipSync(await readFile((await download.path())!));
  expect(JSON.parse(strFromU8(bundle["project.json"])).title).toBe(
    "Draft to keep",
  );
  await expect(second.getByLabel("Project title")).toHaveValue(
    "New saved winner",
  );
  await expect(second.getByRole("alert")).toHaveCount(0);
  expect((await stored(second)).title).toBe("New saved winner");
  await second.close();
});
