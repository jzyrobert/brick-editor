import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
import { openMenuTab, openMode } from "./helpers/mode";
for (const size of [
  { width: 1440, height: 1000, touch: false },
  { width: 1080, height: 1800, touch: true },
])
  test(`instruction editor preserves notes/cameras through step edits at ${size.width}px`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
        viewport: size,
        hasTouch: size.touch,
      }),
      page = await context.newPage();
    try {
      await page.goto(`${baseURL}/?automation=1`);
      await page.waitForFunction(() => !!window.brickEditor);
      await page.evaluate(async () => {
        const a = window.brickEditor!;
        await a.project.import({
          format: "ldraw",
          text: "1 4 -80 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n1 1 80 0 0 1 0 0 0 1 0 0 0 1 3003.dat",
        });
        await a.ready();
        await a.camera.fit();
      });
      const before = await page.evaluate(() => window.brickEditor!.query());
      await openMode(page, "Instructions");
      await page
        .getByRole("button", { name: "Generate layer steps", exact: true })
        .click();
      const editor = page.getByRole("region", {
        name: "Instruction plan editor",
      });
      await editor.getByText("Edit current step", { exact: true }).click();
      await editor
        .getByLabel("Step notes", { exact: true })
        .fill("First view <safe>");
      await editor
        .getByRole("button", { name: "Save step notes", exact: true })
        .click();
      await editor
        .getByRole("button", { name: "Preview top camera", exact: true })
        .click();
      await editor
        .getByRole("button", { name: "Save current step camera", exact: true })
        .click();
      await editor
        .getByText("Assign or split additions", { exact: true })
        .click();
      await editor
        .getByRole("checkbox", { name: "Part 1: 3001.dat", exact: true })
        .check();
      await editor
        .getByRole("button", {
          name: "Split chosen additions into next step",
          exact: true,
        })
        .click();
      const plan = async () => {
        const waiting = page.waitForEvent("download");
        await page
          .getByRole("button", { name: "Download plan JSON", exact: true })
          .click();
        return JSON.parse(
          await readFile((await (await waiting).path())!, "utf8"),
        );
      };
      let p = await plan();
      expect(p.steps).toHaveLength(2);
      expect(p.stepMetadata[0].notes).toBe("First view <safe>");
      expect(p.stepMetadata[1].camera).toEqual(p.stepMetadata[0].camera);
      expect(p.stepMetadata[0].camera.up).toEqual([0, 0, -1]);
      expect(p.steps.flat().sort()).toEqual(
        before.occurrences.map((o) => o.id).sort(),
      );
      await editor
        .getByLabel("Step notes", { exact: true })
        .fill("Second view");
      await editor
        .getByRole("button", { name: "Save step notes", exact: true })
        .click();
      await editor
        .getByRole("button", { name: "Move step earlier", exact: true })
        .click();
      p = await plan();
      expect(p.stepMetadata[0].notes).toBe("Second view");
      await editor
        .getByRole("button", { name: "Merge with next step", exact: true })
        .click();
      p = await plan();
      expect(p.steps).toHaveLength(1);
      expect(p.stepMetadata[0].notes).toBe("Second view\n\nFirst view <safe>");
      await editor
        .getByRole("button", { name: "Undo edit", exact: true })
        .click();
      p = await plan();
      expect(p.steps).toHaveLength(2);
      expect(p.stepMetadata[0].notes).toBe("Second view");
      await editor
        .getByRole("button", { name: "Redo edit", exact: true })
        .click();
      await openMenuTab(page, "Instructions", "Publish");
      const publisher = page.getByRole("region", {
        name: "Publish instructions",
      });
      await publisher.getByLabel("Image size").selectOption("640");
      await publisher.getByLabel("Publication format").selectOption("html-zip");
      const downloading = page.waitForEvent("download");
      await publisher
        .getByRole("button", { name: "Download publication", exact: true })
        .click();
      const files = unzipSync(
        await readFile((await (await downloading).path())!),
      );
      expect(strFromU8(files["index.html"])).toContain(
        "First view &lt;safe&gt;",
      );
      expect(
        JSON.parse(strFromU8(files["instructions.json"])).steps[0].camera,
      ).toEqual(p.stepMetadata[0].camera);
      expect(
        (await page.evaluate(() => window.brickEditor!.query())).occurrences,
      ).toEqual(before.occurrences);
    } finally {
      await context.close();
    }
  });

test("instruction viewport keeps its cumulative step mask after asynchronous document updates", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    const api = window.brickEditor!;
    await api.project.import({ format: "template", template: "wall" });
    await api.ready();
    await api.camera.fit();
  });
  await openMode(page, "Instructions");
  await page
    .getByRole("button", { name: "Generate layer steps", exact: true })
    .click();
  const settle = () =>
    page.evaluate(async () => {
      const api = window.brickEditor!,
        q = await api.query();
      await api.ready({ minRevision: q.revision, strict: true });
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });
  const shot = async () => {
    await settle();
    return page.locator(".viewport canvas").screenshot({
      animations: "disabled",
      style:
        ".mode-card,.canvas-label,.canvas-bottom,.canvas-toolbar,.view-toolbar,.hud-top,.hud-el,.left-sidebar,.right-sidebar,.status-bar,.mobile-nav { visibility:hidden !important; }",
    });
  };
  await expect(page.getByText(/Step 1 of 4 · 10 new parts/)).toBeVisible();
  const first = await shot(),
    slider = page.getByRole("slider", {
      name: "Instruction step",
      exact: true,
    });
  await slider.fill("3");
  const complete = await shot();
  expect(complete.equals(first)).toBe(false);
  await slider.fill("0");
  expect((await shot()).equals(first)).toBe(true);
  const editor = page.getByRole("region", { name: "Instruction plan editor" });
  await editor.getByText("Edit current step", { exact: true }).click();
  await editor
    .getByLabel("Step notes", { exact: true })
    .fill("Metadata edit must preserve the first10 rendered parts.");
  await editor
    .getByRole("button", { name: "Save step notes", exact: true })
    .click();
  expect((await shot()).equals(first)).toBe(true);
  await editor
    .getByRole("button", { name: "Move step later", exact: true })
    .click();
  await slider.fill("0");
  const reordered = await shot();
  expect(reordered.equals(first)).toBe(false);
  expect(reordered.equals(complete)).toBe(false);
  await editor.getByRole("button", { name: "Undo edit", exact: true }).click();
  expect((await shot()).equals(first)).toBe(true);
});
