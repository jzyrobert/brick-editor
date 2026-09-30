import { test, expect, type Page } from "@playwright/test";

const partsCount = (page: Page) => page.locator(".panel-title .count").first();

test("catalogue search, filters, favourites, recent and related parts", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const panel = page.locator(".left-sidebar");
  const cards = panel.locator(".part-grid .part-card");
  const total = Number(await partsCount(page).textContent());
  expect(total).toBeGreaterThanOrEqual(150);
  // Browsing everything is grouped by category, with every group listed.
  await expect(
    panel.locator(".part-group .parts-heading").first(),
  ).toContainText("Bricks");
  await expect(cards).toHaveCount(total);

  await page.getByLabel("Search parts").fill("2x2");
  await expect(cards.first()).toContainText("Brick 2 × 2");
  const twoByTwo = Number(await partsCount(page).textContent());
  expect(twoByTwo).toBeGreaterThan(2);
  expect(twoByTwo).toBeLessThan(total);
  // Part numbers rank the exact part first.
  await page.getByLabel("Search parts").fill("3039");
  await expect(cards.first()).toContainText("Slope 45° 2 × 2");
  await page.getByLabel("Search parts").fill("zzzz");
  await expect(page.locator(".empty-parts")).toContainText(
    "No parts match “zzzz”",
  );
  await page.getByRole("button", { name: "Show all parts" }).click();
  await expect(page.getByLabel("Search parts")).toHaveValue("");

  const filters = page.getByRole("group", { name: "Filter parts" });
  for (const name of ["Slopes", "Windows & doors", "Plants & decor"])
    await expect(filters.getByRole("button", { name })).toBeAttached();
  await filters.getByRole("button", { name: "Slopes" }).click();
  await expect(cards.first()).toContainText("Slope");
  await expect(
    panel.locator(".parts-heading").filter({ hasText: "Slopes" }),
  ).toBeVisible();
  await filters.getByRole("button", { name: "Favourites" }).click();
  await expect(page.locator(".empty-parts")).toContainText("No favourites yet");
  await expect(page.getByText(/RELATED TO/)).toBeHidden();
  await filters.getByRole("button", { name: "All", exact: true }).click();

  // The default part's related sizes lead with the same footprint.
  const relatedTitle = page.getByText("RELATED TO BRICK 2 × 4");
  await expect(relatedTitle).toBeVisible();
  await page
    .locator(".related-parts")
    .getByRole("button", { name: "Plate 2 × 4", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Plate 2 × 4 3020/ }),
  ).toHaveAttribute("aria-pressed", "true");
  // Choosing alone does not count as use; placing does.
  await expect(page.getByText("RECENTLY USED")).toBeHidden();
  await page.getByRole("button", { name: "Place part" }).click();
  await expect(page.getByText("RECENTLY USED")).toBeVisible();

  // Favourite the 1 × 1 brick; each star is named for its part.
  const star = page
    .locator(".part-card-wrap")
    .filter({ hasText: "Brick 1 × 1" })
    .first()
    .getByRole("button", { name: "Favourite Brick 1 × 1" });
  await star.click();
  await expect(star).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await page.waitForFunction(() => !!window.brickEditor);
  await page
    .getByRole("group", { name: "Filter parts" })
    .getByRole("button", { name: "Favourites" })
    .click();
  await expect(cards).toHaveCount(1);
  await expect(panel.locator(".part-grid")).toContainText("Brick 1 × 1");
  expect(errors).toEqual([]);
});

test("rendered thumbnails load lazily and tint to the held colour", async ({
  page,
}) => {
  const requested: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/thumbnails/")) requested.push(r.url());
  });
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const first = page.locator(".part-grid .part-thumb img").first();
  await expect(first).toHaveJSProperty("complete", true);
  expect(
    await first.evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBe(128);
  // Only cards near the viewport fetch their image.
  const total = Number(await partsCount(page).textContent());
  expect(new Set(requested).size).toBeLessThan(total);
  await page.getByRole("button", { name: "Blue", exact: true }).click();
  await expect(page.locator(".part-grid .part-thumb").first()).toHaveAttribute(
    "style",
    /--tint: #0055bf/,
  );
});

test("new catalogue parts can be searched and placed on the stud grid", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // The three parts share the default spot; Snap together would refuse the
  // overlap (tests/browser/snap-together.spec.ts covers that).
  await page.addInitScript(() =>
    localStorage.setItem("brick-editor-snap-together", "off"),
  );
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const place = async (query: string, name: RegExp) => {
    await page.getByLabel("Search parts").fill(query);
    await page.getByRole("button", { name }).first().click();
    await page.getByRole("button", { name: "Place part" }).click();
  };
  await place("slope 45 2x2", /Slope 45° 2 × 2 3039/);
  await place("window 1x2x2", /Window 1 × 2 × 2 Frame 60592/);
  await place("round plate 2x2", /Round Plate 2 × 2 4032b/);
  const q = await page.evaluate(() => window.brickEditor!.query());
  expect(q.occurrences.map((o) => o.node.ref).sort()).toEqual([
    "3039.dat",
    "4032b.dat",
    "60592.dat",
  ]);
  // Every placed part renders real geometry and rests on the workplane.
  await page.evaluate(() => window.brickEditor!.ready({ strict: true }));
  const window1 = q.occurrences.find((o) => o.node.ref === "60592.dat")!;
  expect(window1.transform.position[1]).toBe(-48);
  const slope = q.occurrences.find((o) => o.node.ref === "3039.dat")!;
  // Slope 2 × 2 origin sits between stud columns and on a stud row.
  expect(Math.abs(slope.transform.position[0] % 20)).toBe(0);
  expect(Math.abs(slope.transform.position[2] % 20)).toBe(10);
  expect(errors).toEqual([]);
});
