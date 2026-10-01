import { test, expect } from "@playwright/test";
import { openTool } from "./helpers/mode";

const source = `0 FILE root.ldr
1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 1 100 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 14 0 0 100 1 0 0 0 1 0 0 0 1 3003.dat`;

test("replace keeps colour, layer and bottom face; states scope and size changes; one undo restores", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(
    (text) =>
      window
        .brickEditor!.project.import({ format: "ldraw", text })
        .then(() => window.brickEditor!.ready()),
    source,
  );
  const before = await page.evaluate(() =>
    window
      .brickEditor!.project.export({ format: "ldraw" })
      .then((r) => new TextDecoder().decode(r.bytes)),
  );
  await page.getByRole("button", { name: "Inspector", exact: true }).click();
  await openTool(page, "Selection tools");
  await page.getByRole("button", { name: "Select editable parts" }).click();
  await openTool(page, "Replace part");
  const panel = page.locator(".replace-panel");
  await panel.getByLabel("Replace with").selectOption("3020.dat");
  await expect(panel.getByRole("status")).toContainText(
    "Replaces 3 parts in the active layer with Plate 2 × 4",
  );
  await expect(panel.getByRole("status")).toContainText(
    "2 × Brick 2 × 4: 2 plates lower, same footprint",
  );
  await expect(panel.getByRole("status")).toContainText(
    "1 × Brick 2 × 2: 2 plates lower, larger footprint",
  );
  await expect(panel.getByRole("status")).toContainText("may overlap");
  await panel.getByRole("button", { name: "Replace 3 parts" }).click();
  const after = await page.evaluate(() => window.brickEditor!.query());
  expect(after.occurrences.map((o) => o.node.ref)).toEqual([
    "3020.dat",
    "3020.dat",
    "3020.dat",
  ]);
  expect(after.occurrences.map((o) => o.colorCode)).toEqual(["4", "1", "14"]);
  // Bottom face kept: plate origin moves 16 LDU down (+Y).
  expect(after.occurrences.map((o) => o.transform.position[1])).toEqual([
    16, 16, 16,
  ]);
  expect(after.revision).toBe(2);
  await page.evaluate(async () => {
    const a = window.brickEditor!,
      q = await a.query();
    await a.dispatch({
      schemaVersion: 1,
      commandId: crypto.randomUUID(),
      expectedRevision: q.revision,
      type: "history.undo",
      payload: {},
    });
  });
  const undone = await page.evaluate(() =>
    window
      .brickEditor!.project.export({ format: "ldraw" })
      .then((r) => new TextDecoder().decode(r.bytes)),
  );
  expect(undone).toBe(before);
  expect(errors).toEqual([]);
});
