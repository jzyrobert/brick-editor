import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { openMode } from "./helpers/mode";

// Official parts outside the curated 214 (doors incl. a "~Moved to" redirect,
// a dome, a round-top cylinder, fences, an arch, shutter parts) plus 3001.
const fixture = () => readFile("fixtures/ldraw/full-library.ldr", "utf8");

async function importFixture(page: Page, text: string) {
  return page.evaluate(async (text) => {
    const a = window.brickEditor!;
    const imported = await a.project.import({
      format: "ldraw",
      text,
      name: "full-library.ldr",
      strict: true,
    });
    await a.ready({ minRevision: imported.revision, strict: true });
    const q = await a.query();
    const health = await a.health.check();
    return {
      count: q.occurrences.length,
      namespaces: [...new Set(q.occurrences.map((o) => o.namespace))],
      unresolved: q.unresolvedReferences.length,
      missing: health.checks.find((c) => c.id === "missing-definitions")!
        .status,
    };
  }, text);
}

test("imported models render official parts beyond the curated pack, and again offline", async ({
  page,
  context,
}) => {
  const chunks: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/libraries/ldraw-full-")) chunks.push(r.url());
  });
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  // Nothing of the complete pack is requested until a model needs it.
  expect(chunks).toEqual([]);
  // Install the offline app snapshot first (the pack itself is not precached).
  await openMode(page, "Project");
  await page
    .getByRole("button", { name: "Download / check for updates", exact: true })
    .click();
  await expect(page.getByText(/Ready offline\./)).toBeVisible({
    timeout: 45000,
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  expect(chunks).toEqual([]);

  const text = await fixture();
  expect(await importFixture(page, text)).toEqual({
    count: 10,
    namespaces: ["official"],
    unresolved: 0,
    missing: "ok",
  });
  // One planned batch: manifest, index and the closure's chunks, each once.
  expect(new Set(chunks).size).toBe(chunks.length);
  expect(chunks.filter((u) => u.endsWith(".bin")).length).toBeGreaterThan(5);
  expect(chunks.length).toBeLessThan(40);

  await context.setOffline(true);
  try {
    chunks.length = 0;
    await page.reload();
    await page.waitForFunction(() => !!window.brickEditor);
    expect(await importFixture(page, text)).toEqual({
      count: 10,
      namespaces: ["official"],
      unresolved: 0,
      missing: "ok",
    });
  } finally {
    await context.setOffline(false);
  }
});

test("a tampered complete-pack chunk is rejected and the part stays unresolved", async ({
  page,
}) => {
  await page.route("**/libraries/ldraw-full-*/chunks/*.bin", async (route) => {
    const response = await route.fetch();
    const body = Buffer.from(await response.body());
    body[body.length - 9] ^= 1;
    await route.fulfill({ response, body });
  });
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async () => {
    const a = window.brickEditor!;
    // Start from an empty cache so every chunk comes from the network.
    for (const key of await caches.keys())
      if (key.startsWith("brick-editor-ldraw-full:")) await caches.delete(key);
    const imported = await a.project.import({
      format: "ldraw",
      text: "1 71 0 0 0 1 0 0 0 1 0 0 0 1 86500.dat\n",
      name: "tampered.ldr",
    });
    let error = "";
    try {
      await a.ready({ minRevision: imported.revision, strict: true });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    const q = await a.query();
    return {
      error,
      namespace: q.occurrences[0].namespace,
      cached: await Promise.all(
        (await caches.keys())
          .filter((k) => k.startsWith("brick-editor-ldraw-full:"))
          .map(async (k) =>
            // Geometry chunks only (the part's derived connector shard is
            // intact and legitimately cached).
            (await (await caches.open(k)).keys()).filter((r) =>
              r.url.includes("/chunks/"),
            ),
          ),
      ).then((lists) => lists.flat().length),
    };
  });
  // Its definition is refused, so the part resolves as missing (a visible
  // diagnostic box) and strict readiness fails; nothing tampered is cached.
  expect(result.error).toMatch(/refuses unresolved parts/);
  expect(result.namespace).toBe("missing");
  expect(result.cached).toBe(0);
  await expect(page.locator(".status-bar")).toContainText(/hash mismatch/);
});

test("the parts picker searches every official LDraw part on request", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const panel = page.locator(".left-sidebar");
  await page.getByLabel("Search parts").fill("dome 4");
  const scope = panel.getByRole("region", { name: "All LDraw parts" });
  await scope
    .getByRole("button", { name: "Search every official LDraw part" })
    .click();
  const dome = scope.getByRole("button", { name: /Dome 4 × 4 Smooth 86500/ });
  await expect(dome).toBeVisible({ timeout: 20000 });
  // Its own rendering, from the complete library's sprite sheets.
  await expect(dome.locator(".part-thumb.atlas.loaded")).toBeVisible({
    timeout: 20000,
  });
  await expect(dome.locator(".part-thumb.atlas")).toHaveAttribute(
    "data-part",
    "86500.dat",
  );
  await dome.click();
  await expect(page.locator(".status-bar")).toContainText(
    "Dome 4 × 4 Smooth is ready to place",
  );
  await expect(dome).toHaveAttribute("aria-pressed", "true");
  // Place it through the editor and check it resolves and renders.
  const placed = await page.evaluate(async () => {
    const a = window.brickEditor!;
    const r = await a.dispatch({
      schemaVersion: 1,
      commandId: crypto.randomUUID(),
      expectedRevision: (await a.query()).revision,
      type: "parts.add",
      payload: {
        parts: [
          {
            ref: "86500.dat",
            colorCode: "71",
            transform: {
              position: [0, -24, 0],
              basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
            },
          },
        ],
      },
    });
    await a.ready({ minRevision: r.revision, strict: true });
    const q = await a.query({ ref: "86500.dat", spatial: true });
    return {
      namespace: q.occurrences[0].namespace,
      complete: q.spatial!.complete,
    };
  });
  expect(placed).toEqual({ namespace: "official", complete: true });
  // A curated search leaves the extra scope collapsed to one line.
  await page.getByLabel("Search parts").fill("");
  await expect(scope).toBeHidden();
  expect(errors).toEqual([]);
});
