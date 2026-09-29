import { test, expect, type Page } from "@playwright/test";

// The colour picker offers the colours the held part is really made in
// (src/catalog/color-availability.json), keeps a held colour the part is not
// made in with a hint, and the Paint tool warns softly.
const open = async (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  return errors;
};
const swatch = (page: Page, name: string) =>
  page.locator(".left-sidebar").getByRole("button", { name, exact: true });

test("Brick 2 × 4 offers its real colours; Show all marks the rest", async ({
  page,
}) => {
  const errors = await open(page);
  const panel = page.locator(".left-sidebar");
  // The default held part is Brick 2 × 4 (3001).
  const note = panel.locator(".colour-note");
  await expect(note).toContainText(/Made in \d+ colours/);
  const made = Number(/Made in (\d+)/.exec((await note.textContent())!)![1]);
  expect(made).toBeGreaterThan(40);
  // Favourites it is made in; Light Green (never made) is not offered.
  for (const name of ["Red", "Blue", "Yellow", "White", "Black", "Dark grey"])
    await expect(swatch(page, name)).toBeVisible();
  await panel.getByRole("button", { name: /^More colours/ }).click();
  await expect(panel.getByRole("heading", { name: "Earth" })).toBeVisible();
  await expect(swatch(page, "Reddish brown")).toBeVisible();
  await expect(swatch(page, "Light green")).toHaveCount(0);
  await expect(swatch(page, "Light green (not made in this part)")).toHaveCount(
    0,
  );

  await panel.getByRole("button", { name: "Show all colours" }).click();
  const unavailable = swatch(page, "Light green (not made in this part)");
  await expect(unavailable).toBeVisible();
  await expect(unavailable).toHaveClass(/unavailable/);
  // Choosing it keeps it and says so gently.
  await unavailable.click();
  await expect(unavailable).toHaveAttribute("aria-pressed", "true");
  await expect(panel.locator(".colour-hint")).toContainText(
    "Brick 2 × 4 isn't made in light green",
  );
  // Back to real colours: the held colour stays listed and chosen.
  await panel.getByRole("button", { name: "Only real colours" }).click();
  await expect(unavailable).toHaveAttribute("aria-pressed", "true");
  await expect(swatch(page, "Pink")).toHaveCount(1);
  await expect(swatch(page, "Light blue (not made in this part)")).toHaveCount(
    0,
  );

  // Choosing another part keeps the colour and hints when it is not made.
  await page.getByLabel("Search parts").fill("3005");
  await panel.getByRole("button", { name: /Brick 1 × 1 3005/ }).click();
  await expect(page.locator(".status-bar")).toContainText(
    "Brick 1 × 1 isn't made in light green",
  );
  await expect(panel.locator(".color-title")).toContainText("Light green");
  expect(errors).toEqual([]);
});

test("a part without availability data shows every colour with a note", async ({
  page,
}) => {
  const errors = await open(page);
  const panel = page.locator(".left-sidebar");
  // 3049b: no reviewed BrickLink item and no Rebrickable part of that number.
  await page.getByLabel("Search parts").fill("3049b");
  await panel.locator(".part-grid .part-card").first().click();
  await expect(panel.locator(".colour-note")).toHaveText(
    "Colour availability unknown for this part",
  );
  await expect(
    panel.getByRole("button", { name: "Show all colours" }),
  ).toHaveCount(0);
  await panel.getByRole("button", { name: /^More colours/ }).click();
  await expect(swatch(page, "Light green")).toBeVisible();
  await expect(panel.locator(".swatches button.unavailable")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("painting a part in a colour it is not made in warns softly", async ({
  page,
}) => {
  const errors = await open(page);
  await page.evaluate(() =>
    window
      .brickEditor!.project.import({
        format: "ldraw",
        text: "0 FILE one.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n",
      })
      .then(() => window.brickEditor!.ready()),
  );
  await page.evaluate(() =>
    window.brickEditor!.camera.set({
      space: "ldraw",
      projection: "perspective",
      position: [0, -300, -260],
      target: [0, 12, 0],
      up: [0, -1, 0],
      fovDeg: 40,
      near: 1,
      far: 5000,
    }),
  );
  const panel = page.locator(".left-sidebar");
  await panel.getByRole("button", { name: "Show all colours" }).click();
  await panel.getByRole("button", { name: /^More colours/ }).click();
  await swatch(page, "Light green (not made in this part)").click();
  await page
    .locator(".tool-segment")
    .getByRole("button", { name: "Paint", exact: true })
    .click();
  const canvas = (await page.locator(".viewport canvas").boundingBox())!;
  await page.mouse.click(
    canvas.x + canvas.width / 2,
    canvas.y + canvas.height / 2,
  );
  await expect(page.locator(".status-bar")).toContainText(
    "Painted. Brick 2 × 4 isn't made in light green",
  );
  await expect
    .poll(async () =>
      (await page.evaluate(() => window.brickEditor!.query())).occurrences.map(
        (o: { colorCode: string }) => o.colorCode,
      ),
    )
    .toEqual(["17"]);
  expect(errors).toEqual([]);
});
