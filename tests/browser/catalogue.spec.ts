import { test, expect } from "@playwright/test";

test("catalogue search, filters, favourites, recent and related parts", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const grid = page.locator(".part-grid");
  const count = page.locator(".panel-title .count").first();
  await expect(count).toHaveText("06");
  await page.getByLabel("Search parts").fill("2x2");
  await expect(grid.locator(".part-card")).toHaveCount(2);
  await expect(count).toHaveText("02");
  await page.getByLabel("Search parts").fill("window");
  await expect(page.locator(".empty-parts")).toContainText(
    "No parts match “window”",
  );
  await page.getByRole("button", { name: "Show all parts" }).click();
  await expect(page.getByLabel("Search parts")).toHaveValue("");
  const filters = page.getByRole("group", { name: "Filter parts" });
  await filters.getByRole("button", { name: "Plates" }).click();
  await expect(grid.locator(".part-card")).toHaveCount(2);
  await filters.getByRole("button", { name: "★ Favourites" }).click();
  await expect(page.locator(".empty-parts")).toContainText("No favourites yet");
  await expect(
    page.locator(".eyebrow").filter({ hasText: "FAVOURITES" }),
  ).toBeVisible();
  await expect(page.getByText(/RELATED TO/)).toBeHidden();
  await filters.getByRole("button", { name: "All" }).click();

  // The default part's related sizes lead with the same footprint.
  const relatedTitle = page.getByText("RELATED TO BRICK 2 × 4");
  await expect(relatedTitle).toBeVisible();
  await page
    .locator(".part-chips")
    .last()
    .getByRole("button", { name: "Plate 2 × 4" })
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
    .getByRole("button", { name: "Favourite Brick 1 × 1" });
  await star.click();
  await expect(star).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await page.waitForFunction(() => !!window.brickEditor);
  await page
    .getByRole("group", { name: "Filter parts" })
    .getByRole("button", { name: "★ Favourites" })
    .click();
  await expect(grid.locator(".part-card")).toHaveCount(1);
  await expect(grid).toContainText("Brick 1 × 1");
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(
    page.locator(".part-chips").first().getByRole("button"),
  ).toHaveText(["Plate 2 × 4"]);
  expect(errors).toEqual([]);
});
