import { test, expect, type Page } from "@playwright/test";
import { openMode } from "./helpers/mode";
import { enterPlay } from "./helpers/play";

/**
 * The build-script samples (market town, cathedral, harbour): thousands of
 * parts fetched on demand, opened strictly on a desktop and on a phone, and
 * the town's train runs in Play.
 */
test.describe.configure({ timeout: 600000 });
const shots = "test-results/script-samples/";

const SAMPLES = [
  ["town", "Market town", 6083],
  ["cathedral", "Cathedral", 11817],
  ["harbour", "Harbour", 6966],
] as const;

async function open(page: Page, template: string) {
  return page.evaluate(async (template) => {
    const a = window.brickEditor!;
    const t0 = performance.now();
    const imported = await a.project.import({
      format: "template",
      template: template as never,
    });
    await a.ready({ minRevision: imported.revision, strict: true });
    const ms = performance.now() - t0;
    const q = await a.query();
    const health = await a.health.check();
    const budget = await a.render.budget();
    return {
      ms,
      unresolved: q.unresolvedReferenceIds.length,
      parts: q.occurrences.length,
      namespaces: [...new Set(q.occurrences.map((o) => o.namespace))],
      checks: Object.fromEntries(
        health.checks.map((c: { id: string; status: string }) => [
          c.id,
          c.status,
        ]),
      ),
      profile: budget.usage?.profile,
      backdrop: (await a.render.backdrop.get()).name,
    };
  }, template);
}

for (const [device, options] of [
  ["desktop", { viewport: { width: 1440, height: 900 } }],
  [
    "phone",
    {
      viewport: { width: 412, height: 686 },
      deviceScaleFactor: 2.625,
      isMobile: true,
      hasTouch: true,
    },
  ],
] as const)
  test.describe(device, () => {
    test.use(options);
    test(`the build-script samples open strictly (${device})`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("./?automation=1");
      await page.waitForFunction(() => !!window.brickEditor);
      for (const [name, title, parts] of SAMPLES) {
        const r = await open(page, name);
        await expect(page.getByLabel("Project title")).toHaveValue(title);
        expect(r, name).toMatchObject({
          unresolved: 0,
          parts,
          namespaces: ["official"],
          profile: device === "phone" ? "mobile" : "desktop",
        });
        expect(r.checks["missing-definitions"], name).toBe("ok");
        expect(r.checks.connectivity, name).toBe("ok");
        expect(r.checks.collisions, name).toBe("ok");
        await page.screenshot({ path: `${shots}${name}-${device}.png` });
      }
      expect(errors).toEqual([]);
    });
  });

test("market town: Play offers the train, and Go runs it round the town", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await open(page, "town");
  await openMode(page, "Play");
  await enterPlay(page);
  const go = page.getByRole("button", { name: "Start the train" });
  await expect(go).toBeVisible({ timeout: 60000 });
  await expect(page.locator(".play-train-status")).toContainText(
    "Train 1 · Stopped",
  );
  // Play captures the mouse for look on a desktop: the train has keys.
  await expect(go).toHaveAttribute("aria-keyshortcuts", "G");
  await page.keyboard.press("g");
  await expect(
    page.getByRole("button", { name: "Stop the train" }),
  ).toBeVisible();
  const trains = () =>
    page.evaluate(
      async () => (await window.brickEditor!.play.snapshot()).trains!,
    );
  const before = (await trains()).trains[0];
  await page.evaluate(() => window.brickEditor!.play.stepTicks(240));
  const after = (await trains()).trains[0];
  expect(after.cars.map((c) => c.locomotive)).toEqual([true, false]);
  expect(after.odometer - before.odometer).toBeGreaterThan(300);
  expect((await trains()).track.gaps).toEqual([]);
  await page.screenshot({ path: `${shots}town-play.png` });
  expect(errors).toEqual([]);
});
