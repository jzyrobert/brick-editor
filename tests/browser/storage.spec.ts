import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
import { createHash } from "node:crypto";
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
  await expect(page.locator(".save-state")).toContainText("Saved revision");
}
async function stored(page: Page, id?: string) {
  return page.evaluate((id) => {
    const selected = id ?? localStorage.getItem("brick-editor-current")!;
    const head = localStorage.getItem(
      "brick-editor:" + encodeURIComponent(selected) + ":head",
    )!;
    return JSON.parse(JSON.parse(localStorage.getItem(head)!).json);
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
  await page.getByRole("button", { name: "Project", exact: true }).click();
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
  await page.getByRole("button", { name: "Project", exact: true }).click();
  await page
    .locator(".saved-project")
    .filter({ hasText: "Current blank" })
    .getByRole("button", { name: "Open saved project" })
    .click();
  await expect(page.getByLabel("Project title")).toHaveValue("Current blank");
  await page.getByRole("button", { name: "Project", exact: true }).click();
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
      recoveryDigestBlocked?: boolean;
      releaseRecoveryDigest?: () => void;
    };
    const id = localStorage.getItem("brick-editor-current")!;
    const head = localStorage.getItem(
      "brick-editor:" + encodeURIComponent(id) + ":head",
    )!;
    const storedJson = JSON.parse(localStorage.getItem(head)!).json as string;
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    let held = false;
    crypto.subtle.digest = (algorithm, data) => {
      if (!held && new TextDecoder().decode(data) === storedJson) {
        held = true;
        controls.recoveryDigestBlocked = true;
        return new Promise<void>((resolve) => {
          controls.releaseRecoveryDigest = () => {
            crypto.subtle.digest = digest;
            resolve();
          };
        }).then(() => digest(algorithm, data));
      }
      return digest(algorithm, data);
    };
  });
  await page.reload();
  await page.waitForFunction(
    () =>
      !!window.brickEditor &&
      (window as typeof window & { recoveryDigestBlocked?: boolean })
        .recoveryDigestBlocked,
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
      window as typeof window & { releaseRecoveryDigest: () => void }
    ).releaseRecoveryDigest(),
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
