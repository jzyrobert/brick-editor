import { test, expect } from "@playwright/test";

test("measure tool reports the distance between two tapped points", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(() =>
    window
      .brickEditor!.project.import({ format: "template", template: "wall" })
      .then(() => window.brickEditor!.ready()),
  );
  await page.getByRole("button", { name: "More tools" }).click();
  await page.getByRole("button", { name: "Measure", exact: true }).click();
  const chip = page.locator(".measure-chip");
  await expect(chip).toHaveText("Tap two points on the model to measure");
  const box = (await page.locator(".viewport canvas").boundingBox())!;
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2;
  await page.mouse.click(cx - 120, cy + 40);
  await expect(chip).toHaveText("Tap a second point");
  await page.mouse.click(cx + 120, cy + 60);
  await expect(chip).toContainText("LDU straight");
  await expect(chip).toContainText(/stud|plate/);
  // A third tap starts a new measurement; leaving the tool clears it.
  await page.mouse.click(cx, cy);
  await expect(chip).toHaveText("Tap a second point");
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await expect(chip).toBeHidden();
  expect(errors).toEqual([]);
});
