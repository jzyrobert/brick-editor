import { test, expect } from "@playwright/test";
import { openMode } from "./helpers/mode";
import { enterPlay } from "./helpers/play";
import {
  BUILD_IDS,
  GALLERY_ORIGIN,
  GALLERY_INDEX,
  MPD_SHAS,
  RENDER,
  TITLES,
  mockGallery,
} from "./helpers/gallery";

test("gallery browsing pairs the models on each brief, aligns angles and imports", async ({
  page,
}) => {
  await mockGallery(page);
  await page.goto("./?galleryIndex=1");
  await expect(
    page.getByRole("heading", { name: "Build gallery" }),
  ).toBeVisible();
  const responses = page.locator(".gallery-response");
  await expect(responses).toHaveCount(3);
  const chooser = page.getByRole("combobox", { name: "Prompt", exact: true });
  await expect(chooser.locator("option")).toHaveText([
    "All prompts (2)",
    "Japanese temple · 2 builds",
    "Lighthouse · 1 build",
  ]);
  await chooser.selectOption("japanese-buddhist-temple-2000");
  await expect(responses).toHaveCount(2);
  await expect(page.locator(".gallery-responses")).toHaveClass(/gallery-pair/);
  await page.getByText("Read the prompt", { exact: false }).click();
  await expect(
    page.getByText("“a japanese buddhist temple”", { exact: true }),
  ).toBeVisible();
  // Ordered by model: Claude first, then GPT.
  await expect(responses.locator("h3")).toHaveText(TITLES.slice(0, 2));
  await expect(responses.first()).toContainText("Claude Opus 5.5High effort");
  await expect(responses.first()).toContainText(
    "Accepted after 2 replies · 19 min",
  );
  await page.getByRole("button", { name: "Front", exact: true }).click();
  await expect(
    responses.first().locator(".gallery-stage > img"),
  ).toHaveAttribute("src", `${GALLERY_ORIGIN}/r/${RENDER(0, 1)}.webp`);
  await expect(
    page.getByRole("button", { name: "Agent settings" }),
  ).toHaveCount(0);
  await chooser.selectOption("lighthouse-500");
  await expect(responses.locator("h3")).toHaveText([TITLES[2]]);
  await expect(
    page.getByRole("heading", { name: "Lighthouse", exact: true }),
  ).toBeVisible();
  await chooser.selectOption("japanese-buddhist-temple-2000");
  await page.getByRole("button", { name: "More filters" }).click();
  for (const viewport of [
    { width: 360, height: 600 },
    { width: 411, height: 685 },
    { width: 390, height: 844 },
    { width: 1080, height: 1800 },
    { width: 686, height: 411 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport);
    const navigation = await page
      .getByRole("navigation", { name: "Main modes" })
      .boundingBox();
    expect(navigation!.x).toBeGreaterThanOrEqual(0);
    expect(navigation!.x + navigation!.width).toBeLessThanOrEqual(
      viewport.width,
    );
    if (viewport.width <= 760)
      await expect(page.locator(".site-open")).toBeHidden();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const name of ["Three-quarter", "Front", "Back"]) {
      const box = await page
        .getByRole("button", { name, exact: true })
        .boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    // Both builds of the pair are side by side, or stacked on phones.
    const [a, b] = await Promise.all(
      [0, 1].map((i) => responses.nth(i).boundingBox()),
    );
    expect(a!.x + a!.width <= b!.x + 1 || a!.y + a!.height <= b!.y + 1).toBe(
      true,
    );
  }
  await page.setViewportSize({ width: 360, height: 600 });
  const fileChooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Open your model", exact: true })
    .click();
  await (
    await fileChooser
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

test("a build's page spins it in 3D on desktop and waits for a tap on phones", async ({
  page,
}) => {
  const requests = await mockGallery(page);
  await page.goto(`./?galleryIndex=1&gallery=${BUILD_IDS[0]}`);
  await expect(page.getByRole("heading", { name: TITLES[0] })).toBeVisible();
  const facts = page.locator(".gallery-detail-info dl");
  await expect(facts).toContainText("Model time19 min");
  await expect(facts).toContainText("Cost$2.84");
  const stage = page.locator(".gallery-detail-stage");
  await expect(stage.locator(".gallery-live.ready canvas")).toBeVisible({
    timeout: 60000,
  });
  await expect(stage).toHaveClass(/live/);
  await expect(stage).toContainText("Drag to turn");
  // The angle tabs swing the live camera.
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    stage.getByRole("button", { name: "Back", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(requests).toContain(`/b/${MPD_SHAS[0]}.mpd.gz`);

  const phone = await page
    .context()
    .browser()!
    .newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      baseURL: new URL(page.url()).origin,
    });
  // Phones open the detail page in live 3D too.
  const p = await phone.newPage();
  await mockGallery(p);
  await p.goto(`./?galleryIndex=1&gallery=${BUILD_IDS[1]}`);
  await expect(p.getByRole("heading", { name: TITLES[1] })).toBeVisible();
  await expect(p.locator(".gallery-live.ready canvas")).toBeVisible({
    timeout: 60000,
  });
  expect(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  // A browser asking to save data starts on the pictures: no MPD request
  // until Spin in 3D.
  const saver = await phone.newPage();
  await saver.addInitScript(() =>
    Object.defineProperty(navigator, "connection", {
      value: { saveData: true },
    }),
  );
  const saverRequests = await mockGallery(saver);
  await saver.goto(`./?galleryIndex=1&gallery=${BUILD_IDS[1]}`);
  await expect(saver.getByRole("heading", { name: TITLES[1] })).toBeVisible();
  await expect(saver.locator(".gallery-live")).toHaveCount(0);
  expect(saverRequests.some((r) => r.startsWith("/b/"))).toBe(false);
  await saver.getByRole("button", { name: "Spin in 3D" }).click();
  await expect(saver.locator(".gallery-live.ready canvas")).toBeVisible({
    timeout: 60000,
  });
  await phone.close();
});

test("a gallery model opens in all tools, walks in real Play, and protects edited copies", async ({
  page,
}) => {
  await mockGallery(page);
  await page.goto("./?automation=1&galleryIndex=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.getByRole("button", { name: "Gallery", exact: true }).click();
  await page
    .getByRole("button", { name: `Look closer at ${TITLES[0]}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await expect(page.locator(".gallery-page")).toHaveCount(0, {
    timeout: 60000,
  });
  await expect(page.locator(".app")).toHaveClass(/mode-build/);
  await expect(page.locator(".model-heading")).toContainText(
    "Claude Opus 5.5 · High effort · 2 parts",
  );
  await page.evaluate(() => window.brickEditor!.ready({ strict: true }));
  const before = await page.evaluate(async () => {
    const q = await window.brickEditor!.query();
    return { id: q.occurrences[0].id, parts: q.occurrences.length };
  });
  expect(before.parts).toBe(2);
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
      payload: { title: "My edited hall" },
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
    .getByRole("button", { name: `Explore ${TITLES[1]}`, exact: true })
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
  await expect(page.getByLabel("Project title")).toHaveValue("My edited hall");
});

test("changing the prompt after a trip into Play stays in Gallery", async ({
  page,
}) => {
  await mockGallery(page);
  await page.goto("./?galleryIndex=1");
  await page
    .getByRole("combobox", { name: "AI model" })
    .selectOption("Claude Opus 5.5");
  await page.getByRole("button", { name: "More filters" }).click();
  await page
    .getByRole("combobox", { name: "Reasoning effort" })
    .selectOption("High");
  await page.getByRole("button", { name: "Front", exact: true }).click();
  await page
    .getByRole("button", { name: `Explore ${TITLES[0]}`, exact: true })
    .click();
  await expect(page.locator(".play-entry")).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: "Gallery", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "AI model" })).toHaveValue(
    "Claude Opus 5.5",
  );
  await expect(
    page.getByRole("combobox", { name: "Reasoning effort" }),
  ).toHaveValue("High");
  await expect(
    page.getByRole("button", { name: "Front", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("combobox", { name: "Prompt", exact: true })
    .selectOption("lighthouse-500");
  await expect(page.locator(".gallery-response h3")).toHaveText([TITLES[2]]);
  await expect(page.locator(".gallery-page")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Prompt", exact: true })
    .selectOption("japanese-buddhist-temple-2000");
  await expect(page.locator(".gallery-response")).toHaveCount(1);
  // Back still steps out of Gallery to the model.
  await page.goBack();
  await expect(page.locator(".gallery-page")).toHaveCount(0);
  await expect(page.locator(".play-entry")).toBeVisible();
});

test("failed or damaged builds keep the current model, and the gallery says when it needs a connection", async ({
  page,
}) => {
  await mockGallery(page, { model: "down" });
  await page.goto("./?automation=1&galleryIndex=1");
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
  await page.getByRole("button", { name: "Gallery", exact: true }).click();
  await page
    .getByRole("button", { name: `Explore ${TITLES[0]}`, exact: true })
    .click();
  await expect(page.locator(".gallery-error")).toContainText(
    "The gallery is unavailable (HTTP 503)",
  );
  expect(
    await page.evaluate(
      async () => (await window.brickEditor!.query()).occurrences[0].id,
    ),
  ).toBe(id);

  const damaged = await page.context().newPage();
  await mockGallery(damaged, { model: "corrupt" });
  await damaged.goto(`./?galleryIndex=1&gallery=${BUILD_IDS[1]}`);
  await damaged.getByRole("button", { name: "Explore this model" }).click();
  await expect(damaged.locator(".gallery-error")).toContainText(
    "does not match the gallery",
  );

  const offline = await page.context().newPage();
  await mockGallery(offline, { index: "offline" });
  await offline.goto("./?galleryIndex=1");
  await expect(
    offline.getByRole("heading", { name: "The gallery needs a connection." }),
  ).toBeVisible();
  await expect(
    offline.getByRole("button", { name: "Try again" }),
  ).toBeVisible();

  // Plain http without the switch never reaches the bucket.
  const local = await page.context().newPage();
  const requests = await mockGallery(local);
  await local.goto("./");
  await expect(local.getByRole("alert")).toContainText(
    "does not read the published gallery",
  );
  expect(requests).toEqual([]);
  const files: string[] = await local.evaluate(
    async () =>
      (
        await (
          await fetch(new URL("offline-manifest.json", location.href))
        ).json()
      ).files,
  );
  expect(files).toContain("fonts/BricolageGrotesque.ttf");
});
