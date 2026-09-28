import { test, expect } from "@playwright/test";

const source = `0 FILE root.ldr
1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 4 100 0 0 0 0 1 0 1 0 -1 0 0 3001.dat
1 1 0 -24 60 1 0 0 0 1 0 0 0 1 3003.dat`;

test("inspector shows mixed batch values and sets one axis for every selected part in one undo step", async ({
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
  await page.getByRole("button", { name: "Inspector", exact: true }).click();
  await page.getByText("Selection tools").click();
  await page.getByRole("button", { name: "Select editable parts" }).click();
  await expect(page.locator(".canvas-bottom")).toContainText("3 selected");
  const props = page.locator(".inspector-properties");
  await expect(page.locator(".selection-summary")).toContainText(
    "3 mixed parts",
  );
  await expect(props).toContainText("ColourMixed");
  await expect(props).toContainText("OrientationMixed");
  await expect(props).toContainText("SourceOfficial LDraw library");
  await expect(props).toContainText("SubmodelMain model");
  const x = page.getByLabel("Position X");
  await expect(x).toHaveValue("");
  await expect(x).toHaveAttribute("placeholder", "Mixed");
  await expect(page.getByLabel("Position Z")).toHaveAttribute(
    "placeholder",
    "Mixed",
  );
  const before = await page.evaluate(() => window.brickEditor!.query());
  await x.fill("60");
  await expect(x).toHaveValue("60");
  const after = await page.evaluate(() => window.brickEditor!.query());
  expect(after.occurrences.map((o) => o.transform.position[0])).toEqual([
    60, 60, 60,
  ]);
  // Other axes unchanged.
  expect(after.occurrences.map((o) => o.transform.position[2])).toEqual(
    before.occurrences.map((o) => o.transform.position[2]),
  );
  // Three parts with two distinct X values: still one revision and one undo step.
  expect(after.revision - before.revision).toBe(1);
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    const q = await a.query();
    await a.dispatch({
      schemaVersion: 1,
      commandId: crypto.randomUUID(),
      expectedRevision: q.revision,
      type: "history.undo",
      payload: {},
    });
  });
  const undone = await page.evaluate(() => window.brickEditor!.query());
  expect(undone.occurrences.map((o) => o.transform.position)).toEqual(
    before.occurrences.map((o) => o.transform.position),
  );
  await expect(x).toHaveAttribute("placeholder", "Mixed");

  // A matching-part selection shares the part, colour and height.
  await page.getByRole("button", { name: "Clear selection" }).click();
  await page.evaluate(() =>
    window.brickEditor!.project.import({
      format: "ldraw",
      text: "0 FILE one.ldr\n1 4 20 0 40 0 0 1 0 1 0 -1 0 0 3001.dat",
    }),
  );
  await page.getByRole("button", { name: "Select editable parts" }).click();
  await expect(page.locator(".selection-summary")).toContainText("3001");
  await expect(props).toContainText("OrientationUpright, turned 90°");
  await expect(props).toContainText("2 × 4 studs, 1 brick (3 plates) tall");
  await page.getByRole("button", { name: "More details" }).click();
  await expect(props).toContainText("ChecksNo problems found");
  await expect(page.getByLabel("Position X")).toHaveValue("20");
  await page.getByText("Placement matrix").click();
  await expect(page.locator(".affine-matrix table")).toContainText("-1");
  expect(errors).toEqual([]);
});
