// Export → parts list "Check your parts": needs-attention rows, choosing an
// ambiguous candidate, accepting a reviewed match and a colour, typing a
// number (validated), undo refreshing the list; and Project → "Update to the
// latest parts library" on a project pinned to a retired complete release.
import { expect, test, type Page } from "@playwright/test";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { createHash } from "node:crypto";
import { openMode } from "./helpers/mode";

// 3001 (curated, verified), 3816cpq1 (the file names two BrickLink numbers)
// and 35371 (reviewed: BrickLink 2431, cross-checked with Rebrickable).
const MODEL = [
  "0 FILE check.ldr",
  "1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
  "1 0 0 -24 0 1 0 0 0 1 0 0 0 1 3816cpq1.dat",
  "1 4 80 0 0 1 0 0 0 1 0 0 0 1 35371.dat",
  "",
].join("\n");

async function load(page: Page, text = MODEL) {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async (t) => {
    const a = window.brickEditor!;
    await a.ready();
    await a.project.import({ format: "ldraw", text: t, name: "check.ldr" });
    await a.ready({ minRevision: (await a.query()).revision });
  }, text);
}
const row = (page: Page, name: RegExp) =>
  page.locator(".resolution-row").filter({ hasText: name });

test("parts list shows what needs attention and resolves it with undoable choices", async ({
  page,
}, info) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await load(page);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: "Preview parts list" }).click();
  const list = page.getByRole("region", { name: "Check your parts" });
  await expect(list).toBeVisible();
  await expect(
    list.getByRole("button", { name: "Needs attention (2)" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Download XML" }),
  ).toBeDisabled();
  // The verified brick is not in the attention list.
  await expect(row(page, /3001 ·/)).toHaveCount(0);
  await expect(row(page, /3816cpq1/)).toContainText("Pick one");
  await expect(row(page, /35371/)).toContainText("Check match");
  await page.screenshot({
    path: info.outputPath("desktop-needs-attention.png"),
  });

  // Ambiguous: pick one of the numbers the part file names.
  await row(page, /3816cpq1/)
    .locator(".resolution-summary")
    .click();
  await expect(row(page, /3816cpq1/)).toContainText(
    "could be one of these BrickLink parts",
  );
  await row(page, /3816cpq1/)
    .getByRole("button", { name: "Use 970c00pb0082" })
    .click();
  // Its colour is still unknown: accept it.
  await expect(row(page, /3816cpq1/)).toContainText("Check colour");
  await row(page, /3816cpq1/)
    .locator(".resolution-summary")
    .click();
  await row(page, /3816cpq1/)
    .getByRole("button", { name: "Buy this colour anyway" })
    .click();
  await expect(
    list.getByRole("button", { name: "Needs attention (1)" }),
  ).toBeVisible();

  // Reviewed: a typed number is validated first.
  await row(page, /35371/).locator(".resolution-summary").click();
  await expect(row(page, /35371/)).toContainText("Rebrickable agrees");
  const own = row(page, /35371/).getByRole("textbox");
  await own.fill("24 31");
  await row(page, /35371/).getByRole("button", { name: "Use it" }).click();
  await expect(row(page, /35371/).getByRole("alert")).toHaveText(
    "Part numbers have no spaces.",
  );
  await row(page, /35371/)
    .getByRole("button", { name: "Looks right: use 2431" })
    .click();
  await row(page, /35371/).locator(".resolution-summary").click();
  await row(page, /35371/)
    .getByRole("button", { name: "Buy this colour anyway" })
    .click();
  await expect(list).toContainText("Every part has a match");
  await expect(
    page.getByRole("button", { name: "Download XML" }),
  ).toBeEnabled();
  await list.getByRole("button", { name: /^All \(3\)$/ }).click();
  await expect(row(page, /3001 ·/)).toContainText("Ready");
  await expect(row(page, /3816cpq1/)).toContainText("Your choice");
  await page.screenshot({ path: info.outputPath("desktop-resolved.png") });

  // The decisions are in the project and in the exported list.
  const xml = await page.evaluate(async () => {
    const a = window.brickEditor!;
    const q = await a.query();
    const p = await a.inventory.preview({
      expectedRevision: q.revision,
      format: "bricklink-wanted-xml",
      scope: { kind: "all" },
    });
    const out = await a.inventory.export({
      previewId: p.previewId,
      expectedRevision: p.documentRevision,
      expectedMappingPackSha256: p.mappingPackSha256,
      errorPolicy: "block",
    });
    return new TextDecoder().decode(out.bytes);
  });
  expect(xml).toContain("<ITEMID>970c00pb0082</ITEMID>");
  expect(xml).toContain("<ITEMID>2431</ITEMID>");

  // Undo (here through the API) refreshes the open list.
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.dispatch({
      schemaVersion: 1,
      commandId: "undo-" + Date.now(),
      expectedRevision: (await a.query()).revision,
      type: "history.undo",
      payload: {},
    });
  });
  await expect(
    list.getByRole("button", { name: "Needs attention (1)" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download XML" }),
  ).toBeDisabled();

  // Leave a part out instead.
  await list.getByRole("button", { name: "Needs attention (1)" }).click();
  await row(page, /35371/).locator(".resolution-summary").click();
  await row(page, /35371/)
    .getByRole("button", { name: "Leave it out" })
    .click();
  await expect(list).toContainText("Every part has a match");
  await list.getByRole("button", { name: /^All/ }).click();
  await expect(row(page, /35371/)).toContainText("Left out");
  expect(errors).toEqual([]);
});

for (const viewport of [
  { width: 360, height: 800 },
  { width: 1080, height: 1800 },
])
  test(`parts list check on a ${viewport.width}px phone`, async ({
    browser,
  }, info) => {
    test.setTimeout(180000);
    const context = await browser.newContext({
      viewport,
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await load(page);
    await page.getByRole("button", { name: "Export", exact: true }).click();
    await page.getByRole("button", { name: "Preview parts list" }).click();
    const list = page.getByRole("region", { name: "Check your parts" });
    await expect(
      list.getByRole("button", { name: "Needs attention (2)" }),
    ).toBeVisible();
    await row(page, /3816cpq1/)
      .locator(".resolution-summary")
      .click();
    await row(page, /3816cpq1/).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath(`phone-${viewport.width}.png`),
    });
    // Nothing wider than the screen; every row action is reachable.
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const button of await row(page, /3816cpq1/)
      .getByRole("button")
      .all()) {
      const box = (await button.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
    }
    await row(page, /3816cpq1/)
      .getByRole("button", { name: "Use 970c00pb0081" })
      .click();
    await expect(row(page, /3816cpq1/)).toContainText("Check colour");
    expect(errors).toEqual([]);
    await context.close();
  });

test("a project pinned to a retired complete library can be updated, with undo", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const retired = {
    releaseId: "ldraw-full-2026-01-01",
    manifestSha256: "a".repeat(64),
    affected: ["35371.dat"],
  };
  await page.addInitScript((lock) => {
    (
      window as unknown as { __brickTestRetiredFullLocks: unknown }
    ).__brickTestRetiredFullLocks = [lock];
  }, retired);
  await load(page);
  // Pin the project to the retired release as an older save would be.
  const bytes = await page.evaluate(async () => {
    const out = await window.brickEditor!.project.export({ format: "native" });
    return [...out.bytes];
  });
  const files = unzipSync(new Uint8Array(bytes));
  const project = JSON.parse(strFromU8(files["project.json"]));
  project.library.full = {
    ...project.library.full,
    releaseId: retired.releaseId,
    manifestSha256: retired.manifestSha256,
  };
  const json = JSON.stringify(project);
  const legacy = zipSync({
    "project.json": strToU8(json),
    "manifest.json": strToU8(
      JSON.stringify({
        schemaVersion: 1,
        projectSha256: createHash("sha256").update(json).digest("hex"),
        library: project.library,
        mapping: project.marketplace.mappingPackId,
      }),
    ),
  });
  const status = await page.evaluate(
    async (b) => {
      const a = window.brickEditor!;
      await a.project.import({ format: "native", bytes: b });
      return a.library.updateStatus();
    },
    [...legacy],
  );
  expect(status).toMatchObject({
    needed: true,
    retired: true,
    changesKnown: true,
    changed: [{ ref: "35371.dat", occurrences: 1 }],
  });

  await openMode(page, "Project");
  const panel = page.getByRole("region", { name: "Parts library update" });
  await expect(panel).toContainText("ldraw-full-2026-01-01");
  await expect(panel).toContainText("1 part you use");
  await expect(
    panel.getByRole("list", { name: "Parts that change" }),
  ).toContainText("35371");
  await page.screenshot({
    path: info.outputPath("desktop-library-update.png"),
  });
  await panel
    .getByRole("button", { name: "Update to the latest parts library" })
    .click();
  await expect(panel).toHaveCount(0);
  const after = await page.evaluate(async () => {
    const a = window.brickEditor!;
    return {
      status: await a.library.updateStatus(),
      checkpoints: (await a.checkpoints.list()).map(
        (c: { name: string }) => c.name,
      ),
    };
  });
  expect(after.status.needed).toBe(false);
  expect(after.checkpoints).toContain(
    "Before parts library update (ldraw-full-2026-01-01)",
  );
  // The updated part now resolves from the current complete library.
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.ready({ minRevision: (await a.query()).revision, strict: true });
  });
  // Undo puts the old pin back, and the panel returns.
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.dispatch({
      schemaVersion: 1,
      commandId: "undo-" + Date.now(),
      expectedRevision: (await a.query()).revision,
      type: "history.undo",
      payload: {},
    });
  });
  await expect(panel).toBeVisible();
  expect(
    await page.evaluate(
      async () => (await window.brickEditor!.library.updateStatus()).needed,
    ),
  ).toBe(true);
});
