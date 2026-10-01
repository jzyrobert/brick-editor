import { test, expect } from "@playwright/test";
import { openMenuTab, openMode } from "./helpers/mode";

const source = `0 FILE root.ldr
1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 1 100 0 0 1 0 0 0 1 0 0 0 1 3003.dat
1 14 200 0 0 1 0 0 0 1 0 0 0 1 3005.dat`;

test("named checkpoints compare, highlight changes, download and restore", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(
    (text) =>
      window
        .brickEditor!.project.import({ format: "ldraw", text, name: "cp.ldr" })
        .then(() => window.brickEditor!.ready()),
    source,
  );
  const original = await page.evaluate(() =>
    window
      .brickEditor!.project.export({ format: "ldraw" })
      .then((r) => new TextDecoder().decode(r.bytes)),
  );
  await openMenuTab(page, "Project", "My builds");
  const panel = page.getByRole("region", { name: "Checkpoints" });
  await expect(panel).toContainText("No checkpoints yet.");
  await panel.getByLabel("Checkpoint name").fill("Three bricks");
  await panel.getByRole("button", { name: "Save checkpoint" }).click();
  await expect(panel.getByRole("listitem")).toContainText("Three bricks");

  // Edit: recolour one, move one, add one.
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    const q = await a.query();
    const [first, second] = q.occurrences;
    const run = async (type: string, payload: object) =>
      a.dispatch({
        schemaVersion: 1,
        commandId: crypto.randomUUID(),
        expectedRevision: (await a.query()).revision,
        type,
        payload,
      });
    await run("parts.recolor", { occurrenceIds: [first.id], colorCode: "2" });
    await run("parts.transform", {
      occurrenceIds: [second.id],
      delta: [0, -24, 0],
      space: "ldraw",
    });
    await run("parts.add", {
      parts: [
        {
          ref: "3005.dat",
          colorCode: "4",
          transform: {
            position: [0, -24, 0],
            basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
          },
        },
      ],
    });
  });
  await panel.getByRole("button", { name: "Compare" }).click();
  const report = panel.getByRole("status");
  await expect(report).toContainText(
    "1 part added, 1 part moved, 1 part recoloured",
  );
  const json = page.waitForEvent("download");
  await report.getByRole("button", { name: "Download report" }).click();
  expect((await json).suggestedFilename()).toBe(
    "changes-since-Three bricks.json",
  );
  const backup = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Download Three bricks" }).click();
  expect((await backup).suggestedFilename()).toMatch(
    /Three bricks\.brickproj$/,
  );

  await report.getByRole("button", { name: "Show changed parts" }).click();
  await expect(page.locator(".canvas-bottom")).toContainText("3 selected");

  // Restore without backup returns the source to the checkpoint.
  await openMenuTab(page, "Project", "My builds");
  await panel.getByRole("button", { name: "Restore…" }).click();
  await panel.getByRole("button", { name: "Restore without backup" }).click();
  await expect(page.locator(".status-bar")).toContainText(
    "Restored checkpoint “Three bricks”",
  );
  const restored = await page.evaluate(() =>
    window
      .brickEditor!.project.export({ format: "ldraw" })
      .then((r) => new TextDecoder().decode(r.bytes)),
  );
  expect(restored).toBe(original);
  // A checkpoint survives reload and deletion is explicit.
  await page.reload();
  await page.waitForFunction(() => !!window.brickEditor);
  await openMenuTab(page, "Project", "My builds");
  await expect(panel.getByRole("listitem")).toContainText("Three bricks");
  await panel.getByRole("button", { name: "Delete Three bricks" }).click();
  await expect(panel).toContainText("No checkpoints yet.");
  expect(errors).toEqual([]);
});
