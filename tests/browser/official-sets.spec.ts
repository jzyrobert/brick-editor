import { test, expect, type Page } from "@playwright/test";
import { openMode } from "./helpers/mode";

// Official set models (docs/OFFICIAL-MODELS.md). The network is mocked: the
// app must request only its same-origin proxy (`api/omr/<set>.mpd`), never
// library.ldraw.org directly (which sends no CORS headers).
test.describe.configure({ timeout: 180000 });

/** A small OMR-shaped model: header credit, a submodel and STEP lines. */
const MODEL = [
  "0 FILE 10002 - main.ldr",
  "0 main",
  "0 Name: 10002 - main.ldr",
  "0 Author: Test Author [tester]",
  "0 !LDRAW_ORG Model",
  "0 !LICENSE Redistributable under CCAL version 2.0 : see CAreadme.txt",
  "",
  "1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
  "0 STEP",
  "1 14 0 -24 0 1 0 0 0 1 0 0 0 1 3003.dat",
  "1 16 40 0 0 1 0 0 0 1 0 0 0 1 10002 - roof.ldr",
  "0 STEP",
  "0 NOFILE",
  "0 FILE 10002 - roof.ldr",
  "0 Name: 10002 - roof.ldr",
  "0 Author: Test Author [tester]",
  "1 1 0 -48 0 1 0 0 0 1 0 0 0 1 3001.dat",
  "0 NOFILE",
  "",
].join("\n");

async function mockOmr(page: Page) {
  const calls = { proxy: 0, direct: 0 };
  await page.route("https://library.ldraw.org/**", (route) => {
    calls.direct++;
    return route.abort();
  });
  await page.route("**/api/omr/**", (route) => {
    calls.proxy++;
    const url = new URL(route.request().url());
    return url.pathname.endsWith("/api/omr/10002-1.mpd")
      ? route.fulfill({
          status: 200,
          contentType: "text/plain; charset=utf-8",
          body: MODEL,
        })
      : route.fulfill({ status: 404, body: "No such OMR model\n" });
  });
  return calls;
}

async function searchAndOpen(page: Page, query: string, name: RegExp) {
  await openMode(page, "Project");
  const search = page.getByRole("searchbox", { name: "Search official sets" });
  await expect(search).toBeEnabled();
  await search.fill(query);
  const results = page.getByRole("list", { name: "Matching sets" });
  await results.getByRole("button", { name }).first().click();
}

test("searches official sets and opens one through the proxy with credit, steps and an offline copy", async ({
  page,
}) => {
  const calls = await mockOmr(page);
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);

  // Search by name and theme words; results show number, name, theme, year.
  await openMode(page, "Project");
  const search = page.getByRole("searchbox", { name: "Search official sets" });
  await search.fill("railroad train");
  const results = page.getByRole("list", { name: "Matching sets" });
  await expect(
    results.getByRole("button", { name: /10002-1\s*Railroad Club Car/ }),
  ).toBeVisible();
  await search.fill("zzzz-no-such-set");
  await expect(results).toContainText("No sets match.");

  await searchAndOpen(page, "10002", /10002-1\s*Railroad Club Car/);
  await expect(page.locator(".status-bar [role=status]")).toContainText(
    "Opened 10002-1 Railroad Club Car — Test Author [tester] · CC BY 2.0",
    { timeout: 60000 },
  );
  await expect(page.getByLabel("Project title")).toHaveValue(
    "10002-1 Railroad Club Car",
  );
  const result = await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.ready({ strict: true });
    const q = await a.query();
    const exported = await a.project.export({ format: "ldraw" });
    return {
      parts: q.occurrences.length,
      unresolved: q.unresolvedReferenceIds.length,
      text: new TextDecoder().decode(new Uint8Array(exported.bytes)),
    };
  });
  expect(result.parts).toBe(3);
  expect(result.unresolved).toBe(0);
  // The header credit and the STEP lines stay in the model.
  expect(result.text).toContain("0 Author: Test Author [tester]");
  expect(result.text).toContain("0 !LICENSE Redistributable under CCAL");
  expect(result.text.match(/^0 STEP$/gm)?.length).toBe(2);
  expect(calls).toEqual({ proxy: 1, direct: 0 });

  // Project shows the credit, linked to the set page and the licence.
  await openMode(page, "Project");
  const credit = page.getByTestId("omr-credit");
  await expect(credit).toContainText("10002-1 Railroad Club Car");
  await expect(credit).toContainText("Test Author [tester]");
  await expect(
    credit.getByRole("link", { name: "10002-1 Railroad Club Car" }),
  ).toHaveAttribute("href", "https://library.ldraw.org/omr/sets/1413");
  await expect(credit.getByRole("link", { name: "CC BY 2.0" })).toHaveAttribute(
    "href",
    "https://creativecommons.org/licenses/by/2.0/",
  );

  // Opened once, it opens again without LDraw.org from this device's cache
  // (the proxy now fails like a lost connection; full offline reloads are
  // covered by offline.spec.ts, whose snapshot includes the set index).
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    const r = await a.project.import({ format: "template", template: "car" });
    await a.ready({ minRevision: r.revision });
  });
  await expect(page.getByLabel("Project title")).toHaveValue("Roadster");
  await page.route("**/api/omr/**", (route) => {
    calls.proxy++;
    return route.abort("internetdisconnected");
  });
  await searchAndOpen(page, "10002-1", /10002-1\s*Railroad Club Car/);
  await expect(page.getByLabel("Project title")).toHaveValue(
    "10002-1 Railroad Club Car",
    { timeout: 60000 },
  );
  expect(calls.proxy).toBe(1);
});

test("a set without a main model file reports it and keeps the build", async ({
  page,
}) => {
  const calls = await mockOmr(page);
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await searchAndOpen(page, "10001-1", /10001-1\s*Metroliner/);
  await expect(page.locator(".status-bar [role=status]")).toContainText(
    "LDraw.org has no main model file for 10001-1.",
  );
  expect(calls).toEqual({ proxy: 1, direct: 0 });
});

test("the set search fits a phone without horizontal scrolling", async ({
  page,
}) => {
  await mockOmr(page);
  await page.setViewportSize({ width: 360, height: 600 });
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await openMode(page, "Project");
  const search = page.getByRole("searchbox", { name: "Search official sets" });
  await search.scrollIntoViewIfNeeded();
  await search.fill("star wars");
  const results = page.getByRole("list", { name: "Matching sets" });
  await expect(results.getByRole("button").first()).toBeVisible();
  expect(await results.getByRole("button").count()).toBeLessThanOrEqual(20);
  const overflow = await page.evaluate(() => {
    const card = document.querySelector(".official-sets")!;
    return card.scrollWidth - card.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
  await results.getByRole("button").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/official-sets/phone.png" });
});
