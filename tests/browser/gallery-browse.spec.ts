import { expect, test } from "@playwright/test";
import { GALLERY_INDEX, TITLES, mockGallery } from "./helpers/gallery";

test("prompt generations feature E and keep text-only history browsable across detail and Play", async ({
  page,
}) => {
  const collection = {
    ...GALLERY_INDEX,
    generations: [
      {
        id: "e-fresh",
        name: "E · fresh builds",
        description:
          "Empty working directory. No previous source, images or visual feedback.",
        order: 3,
        default: true,
      },
      {
        id: "f-fresh",
        name: "F · fresh builds",
        description: "Fresh F comparison.",
        order: 2,
      },
      {
        id: "e-revision",
        name: "E · source revisions",
        description:
          "Previous build source supplied. No images or visual feedback.",
        order: 1,
      },
    ],
    builds: GALLERY_INDEX.builds.map((b, i) => ({
      ...b,
      generation: i === 0 ? "e-fresh" : i === 1 ? "e-revision" : "f-fresh",
      created: i === 2 ? "2026-10-11T18:00:00Z" : b.created,
    })),
  };
  await mockGallery(page, { collection });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "connection", {
      value: { saveData: true },
    }),
  );
  await page.goto("./?galleryIndex=1");
  const responses = page.locator(".gallery-response");
  const generation = page.getByRole("combobox", {
    name: "Prompt generation",
    exact: true,
  });
  await expect(generation).toHaveValue("latest");
  await expect(responses.locator("h3")).toHaveText([TITLES[0]]);
  for (const viewport of [
    { width: 360, height: 600 },
    { width: 411, height: 685 },
    { width: 390, height: 844 },
    { width: 686, height: 411 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(generation).toBeHidden();
    expect(
      (await page.locator(".gallery-browse").boundingBox())!.height,
    ).toBeLessThan(90);
    await expect(page.locator(".gallery-mobile-filter-summary")).toHaveText(
      "E · fresh builds",
    );
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await generation.selectOption("e-revision");
  await expect(responses.locator("h3")).toHaveText([TITLES[1]]);
  await page
    .getByRole("combobox", { name: "AI model" })
    .selectOption("Claude Opus 5.5");
  await expect(
    page.getByRole("heading", { name: "No matching builds" }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "AI model" }).selectOption("");
  await page
    .getByRole("button", { name: `Look closer at ${TITLES[1]}`, exact: true })
    .click();
  await page.getByText("Prompt & generation notes", { exact: true }).click();
  await expect(page.locator(".gallery-notes")).toContainText(
    "Previous build source supplied",
  );
  await page
    .getByRole("button", { name: "Explore this model", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Enter Play", exact: true }),
  ).toBeVisible();
  await page
    .locator(".primary-modes")
    .getByRole("button", { name: "Gallery", exact: true })
    .click();
  await expect(generation).toHaveValue("e-revision");
  await expect(responses.locator("h3")).toHaveText([TITLES[1]]);
  await generation.selectOption("");
  await expect(responses).toHaveCount(3);
  for (const viewport of [
    { width: 360, height: 600 },
    { width: 411, height: 685 },
    { width: 390, height: 844 },
    { width: 1080, height: 1800 },
    { width: 686, height: 411 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport);
    const toggle = page.getByRole("button", { name: /^Filters/ });
    if (
      viewport.width <= 760 &&
      (await toggle.getAttribute("aria-expanded")) === "false"
    )
      await toggle.click();
    const box = await generation.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(
      await page
        .locator(".gallery-page")
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  }
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(generation).toHaveValue("latest");
  await expect(responses.locator("h3")).toHaveText([TITLES[0]]);
  await generation.selectOption("f-fresh");
  await expect(responses.locator("h3")).toHaveText([TITLES[2]]);
});

test("gallery combines search, prompt, model and effort with recoverable empty results", async ({
  page,
}) => {
  await mockGallery(page);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "connection", {
      value: { saveData: true },
    }),
  );
  await page.goto("./?galleryIndex=1");
  const search = page.getByRole("searchbox", { name: "Search", exact: true });
  const prompt = page.getByRole("combobox", { name: "Prompt", exact: true });
  const model = page.getByRole("combobox", { name: "AI model" });
  const responses = page.locator(".gallery-response");
  await expect(responses).toHaveCount(3);
  await search.fill(" TEMPLE ");
  await expect(responses).toHaveCount(2);
  await model.selectOption("GPT-6.1-Sol");
  await expect(responses.locator("h3")).toHaveText([TITLES[1]]);
  await expect(page.locator(".gallery-result-count")).toContainText(
    "1 build · 1 prompt",
  );
  await page.getByRole("button", { name: "More filters" }).click();
  await page
    .getByRole("combobox", { name: "Reasoning effort" })
    .selectOption("High");
  await expect(
    page.getByRole("heading", { name: "No matching builds" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "More filters" }).click();
  // A folded filter still has a visible removal control.
  await page.getByRole("button", { name: "Remove effort filter" }).click();
  await expect(responses).toHaveCount(1);
  await prompt.selectOption("lighthouse-500");
  await expect(responses).toHaveCount(0);
  await page
    .locator(".gallery-no-results")
    .getByRole("button", { name: "Clear filters" })
    .click();
  await expect(responses).toHaveCount(3);
  await expect(search).toHaveValue("");
  await expect(model).toHaveValue("");
  await expect(prompt).toHaveValue("");
  await search.fill("red gate");
  await expect(responses.locator("h3")).toHaveText([TITLES[0]]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".gallery-page").evaluate((el) => (el.scrollTop = 220));
  const closer = page.getByRole("button", {
    name: `Look closer at ${TITLES[0]}`,
    exact: true,
  });
  await closer.scrollIntoViewIfNeeded();
  const scroll = await page
    .locator(".gallery-page")
    .evaluate((el) => el.scrollTop);
  expect(scroll).toBeGreaterThan(0);
  await closer.click();
  await expect(page.locator(".gallery-detail")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect
    .poll(() => page.locator(".gallery-page").evaluate((el) => el.scrollTop))
    .toBe(scroll);
  await expect(search).toHaveValue("red gate");
  await expect(responses).toHaveCount(1);
  await search.fill("unpublished subject");
  await expect(
    page.getByRole("heading", { name: "No matching builds" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(responses).toHaveCount(3);
  // Native filters and disclosures also work from the keyboard.
  await page.getByRole("button", { name: /^Filters/ }).click();
  await prompt.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(prompt).not.toHaveValue("");
  await expect(responses).toHaveCount(2);
});

test("a growing gallery pages prompt groups and fits expanded filters at all supported sizes", async ({
  page,
}) => {
  const collection = {
    ...GALLERY_INDEX,
    prompts: Array.from({ length: 15 }, (_, i) => ({
      ...GALLERY_INDEX.prompts[0],
      id: `prompt-${i}`,
      name: `Prompt ${String(i).padStart(2, "0")} — a detailed waterfront building with an exceptionally long name`,
    })),
    builds: Array.from({ length: 15 }, (_, i) => ({
      ...GALLERY_INDEX.builds[0],
      id: i.toString(16).padStart(12, "0"),
      mpd: i.toString(16).padStart(12, "0").padEnd(64, "0"),
      prompt: `prompt-${i}`,
      title: `Build ${i}: a waterfront workshop`,
      created: `2026-10-${String(15 - i).padStart(2, "0")}T18:00:00Z`,
    })),
  };
  collection.builds.push(
    ...[30, 31].map((i) => ({
      ...collection.builds[0],
      id: i.toString(16).padStart(12, "0"),
      mpd: i.toString(16).padStart(12, "0").padEnd(64, "0"),
      agent: GALLERY_INDEX.agents[1].id,
      title: `Another model's take ${i}`,
    })),
  );
  await mockGallery(page, { collection });
  await page.goto("./?galleryIndex=1");
  const groups = page.locator(".gallery-prompt-group");
  await expect(groups).toHaveCount(6);
  await expect(page.locator(".gallery-result-count")).toContainText(
    "17 builds · 15 prompts",
  );
  await page.getByRole("button", { name: "Show 6 more prompts" }).click();
  await expect(groups).toHaveCount(12);
  await page.getByRole("button", { name: "Show 3 more prompts" }).click();
  await expect(groups).toHaveCount(15);
  await page.getByRole("button", { name: "More filters" }).click();
  await page.getByRole("combobox", { name: "Sort by" }).selectOption("prompt");
  await expect(groups).toHaveCount(6);
  await expect(groups.first().locator("h2")).toContainText("Prompt 00");
  for (const viewport of [
    { width: 360, height: 600 },
    { width: 411, height: 685 },
    { width: 390, height: 844 },
    { width: 1080, height: 1800 },
    { width: 686, height: 411 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport);
    const dimensions = await page.locator(".gallery-page").evaluate((el) => ({
      width: el.clientWidth,
      scrollWidth: el.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
    for (const control of await page
      .locator(".gallery-browse")
      .getByRole("combobox")
      .all()) {
      const box = await control.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    }
    // More than two responses remain vertically browsable on phones.
    if (viewport.width <= 760) {
      const cards = groups.first().locator(".gallery-response");
      await expect(cards).toHaveCount(3);
      const a = await cards.nth(0).boundingBox();
      const b = await cards.nth(1).boundingBox();
      expect(a!.y + a!.height).toBeLessThanOrEqual(b!.y);
    }
    for (const name of ["Three-quarter", "Front", "Back"]) {
      const box = await page
        .getByRole("button", { name, exact: true })
        .boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.getByRole("button", { name: /Show only Prompt 04/ }).click();
  await expect(groups).toHaveCount(1);
  await expect(
    page.getByRole("combobox", { name: "Prompt", exact: true }),
  ).toHaveValue("prompt-4");
  expect(
    await page.locator(".gallery-page").evaluate((el) => el.scrollTop),
  ).toBe(0);
});

test("phone browsing keeps filters compact and restores active choices when unfolded", async ({
  page,
}) => {
  await mockGallery(page);
  await page.goto("./?galleryIndex=1");
  for (const viewport of [
    { width: 360, height: 600 },
    { width: 390, height: 844 },
    { width: 411, height: 685 },
    { width: 686, height: 411 },
  ]) {
    await page.setViewportSize(viewport);
    const browse = page.locator(".gallery-browse");
    const toggle = page.getByRole("button", { name: "Filters", exact: true });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(
      page.getByRole("combobox", { name: "Prompt", exact: true }),
    ).toBeHidden();
    await expect(page.getByRole("combobox", { name: "AI model" })).toBeHidden();
    expect((await browse.boundingBox())!.height).toBeLessThan(90);
    const search = await page
      .getByRole("searchbox", { name: "Search", exact: true })
      .boundingBox();
    const button = await toggle.boundingBox();
    expect(search!.height).toBeGreaterThanOrEqual(44);
    expect(button!.height).toBeGreaterThanOrEqual(44);
    expect(search!.x + search!.width).toBeLessThanOrEqual(button!.x);
    const stage = await page.locator(".gallery-stage").first().boundingBox();
    expect(stage!.y).toBeLessThan(400);
    expect(stage!.y + stage!.height).toBeLessThan(
      viewport.height + (viewport.height < 500 ? 400 : 0),
    );
    await toggle.click();
    await expect(
      page.getByRole("combobox", { name: "Prompt", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Reasoning effort" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Front", exact: true }),
    ).toBeVisible();
    await toggle.click();
  }
  await page.setViewportSize({ width: 360, height: 600 });
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page
    .getByRole("combobox", { name: "AI model" })
    .selectOption("Claude Opus 5.5");
  await page
    .getByRole("combobox", { name: "Prompt", exact: true })
    .selectOption("japanese-buddhist-temple-2000");
  await page
    .getByRole("button", { name: "Filters, 2 active", exact: true })
    .click();
  await expect(page.locator(".gallery-response")).toHaveCount(1);
  await expect(page.locator(".gallery-mobile-filter-summary")).toHaveText(
    "Japanese temple · Claude Opus 5.5",
  );
  await expect(
    page.getByRole("button", { name: "Clear filters", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Filters, 2 active", exact: true })
    .click();
  await expect(page.getByRole("combobox", { name: "AI model" })).toHaveValue(
    "Claude Opus 5.5",
  );
  await page
    .getByRole("button", { name: "Filters, 2 active", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page.locator(".gallery-response")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Filters", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
});
