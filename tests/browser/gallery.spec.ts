import { test, expect } from "@playwright/test";
import { openMode } from "./helpers/mode";
import { enterPlay } from "./helpers/play";

test("gallery browsing aligns angles, filters efforts, chooses comparisons and labels placeholders", async ({
  page,
}) => {
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "One temple. Five takes." }),
  ).toBeVisible();
  await expect(page.locator(".gallery-response")).toHaveCount(5);
  await page.getByRole("button", { name: "Front", exact: true }).click();
  for (const image of await page.locator(".gallery-stage > img").all())
    expect(await image.getAttribute("src")).toContain("/front.png");
  await page.getByRole("button", { name: "Agent settings" }).click();
  await page.getByLabel("Low effort", { exact: true }).uncheck();
  await expect(page.locator(".gallery-response")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Compare responses", exact: true })
    .click();
  await page.getByLabel("Compare response 2").selectOption("max");
  await expect(page.locator(".gallery-response")).toHaveCount(2);
  await expect(page.locator(".gallery-response").last()).toContainText(
    "The temple compound",
  );
  await page.getByRole("button", { name: /Seaside village/ }).click();
  await expect(
    page.getByRole("heading", { name: "This world is still waiting." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Browse the temple responses" })
    .click();
  for (const viewport of [
    { width: 360, height: 600 },
    { width: 411, height: 685 },
    { width: 390, height: 844 },
    { width: 1080, height: 1800 },
    { width: 686, height: 411 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const button = page.getByRole("button", {
      name: "Compare responses",
      exact: true,
    });
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await page.setViewportSize({ width: 360, height: 600 });
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Open your model", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "phone-model.ldr",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "0 Phone model\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n",
    ),
  });
  await expect(page.locator(".gallery-page")).toHaveCount(0);
  await expect(page.locator(".app")).toHaveClass(/mode-build/);
  await expect(page.locator(".canvas-bottom")).toContainText("1 parts");
});

test("a gallery model opens in all tools, walks in real Play, and protects edited copies", async ({
  page,
}) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.getByRole("button", { name: "Gallery", exact: true }).click();
  await page
    .getByRole("button", { name: "Look closer at The red pagoda", exact: true })
    .click();
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await expect(page.locator(".gallery-page")).toHaveCount(0, {
    timeout: 60000,
  });
  await expect(page.locator(".app")).toHaveClass(/mode-build/);
  await page.evaluate(() => window.brickEditor!.ready({ strict: true }));
  const before = await page.evaluate(async () => {
    const q = await window.brickEditor!.query();
    return { id: q.occurrences[0].id, parts: q.occurrences.length };
  });
  expect(before.parts).toBe(1965);
  for (const tool of ["Instructions", "Photo", "Project", "Build"] as const) {
    await openMode(page, tool);
    await expect(page.locator(".app")).toHaveClass(
      new RegExp(`mode-${tool.toLowerCase()}`),
    );
    expect(
      await page.evaluate(
        async () => (await window.brickEditor!.query()).occurrences[0].id,
      ),
    ).toBe(before.id);
  }
  await page
    .getByRole("navigation", { name: "Main modes" })
    .getByRole("button", { name: "Play", exact: true })
    .click();
  await expect(page.locator(".play-entry")).toBeVisible();
  await enterPlay(page);
  await expect
    .poll(() =>
      page.evaluate(
        async () => (await window.brickEditor!.play.snapshot()).tick,
      ),
    )
    .toBeGreaterThan(1);
  await page.keyboard.press("Escape");
  await openMode(page, "Build");
  await expect(page.locator(".play-overlay")).toHaveCount(0);
  await page.evaluate(async () => {
    const a = window.brickEditor!,
      q = await a.query();
    await a.dispatch({
      schemaVersion: 1,
      commandId: crypto.randomUUID(),
      expectedRevision: q.revision,
      type: "project.rename",
      payload: { title: "My edited pagoda" },
    });
  });
  await page.getByRole("button", { name: "Gallery", exact: true }).click();
  const galleryRevision = await page.evaluate(
    async () => (await window.brickEditor!.query()).revision,
  );
  await page.keyboard.press("Control+z");
  expect(
    await page.evaluate(
      async () => (await window.brickEditor!.query()).revision,
    ),
  ).toBe(galleryRevision);
  await page
    .getByRole("button", { name: "Explore The temple compound", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Save your current build first?",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  expect(
    await page.evaluate(
      async () => (await window.brickEditor!.query()).occurrences[0].id,
    ),
  ).toBe(before.id);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByLabel("Project title")).toHaveValue(
    "My edited pagoda",
  );
});

test("failed sample loading preserves the current model and the offline snapshot includes gallery assets", async ({
  page,
}) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    await window.brickEditor!.project.import({
      format: "template",
      template: "wall",
    });
    await window.brickEditor!.ready({ strict: true });
  });
  const id = await page.evaluate(
    async () => (await window.brickEditor!.query()).occurrences[0].id,
  );
  await page.route("**/gallery/japanese-temple/high/build.json", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.getByRole("button", { name: "Gallery", exact: true }).click();
  await page
    .getByRole("button", { name: "Explore The red pagoda", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "This sample could not load",
  );
  expect(
    await page.evaluate(
      async () => (await window.brickEditor!.query()).occurrences[0].id,
    ),
  ).toBe(id);
  const files: string[] = await page.evaluate(
    async () =>
      (
        await (
          await fetch(new URL("offline-manifest.json", location.href))
        ).json()
      ).files,
  );
  expect(files).toContain("gallery/japanese-temple/high/build.json");
  expect(files).toContain("gallery/japanese-temple/max/iso.png");
  expect(files).toContain("fonts/BricolageGrotesque.ttf");
});
