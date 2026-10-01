import { expect, test, type Page } from "@playwright/test";
import { openMode } from "./helpers/mode";

// Third-person zoom with the mouse wheel and trackpad pinch
// (docs/API.md, "Camera zoom").
test.setTimeout(300000);
const baseplate = "0 Baseplate\n1 2 0 0 0 1 0 0 0 1 0 0 0 1 3811.dat\n";

/** Headless browsers cannot grant real pointer lock; emulate the browser. */
async function emulatePointerLock(page: Page) {
  await page.addInitScript(() => {
    let locked: Element | null = null;
    Object.defineProperty(Document.prototype, "pointerLockElement", {
      configurable: true,
      get: () => locked,
    });
    Element.prototype.requestPointerLock = function (this: Element) {
      locked = this;
      document.dispatchEvent(new Event("pointerlockchange"));
      return Promise.resolve();
    } as Element["requestPointerLock"];
    Document.prototype.exitPointerLock = function () {
      locked = null;
      document.dispatchEvent(new Event("pointerlockchange"));
    };
  });
}
const camera = (page: Page) =>
  page.evaluate(async () => {
    const s = await window.brickEditor!.play.snapshot();
    return {
      mode: s.cameraMode,
      distance: s.cameraSettings.followDistance,
      scroll: [
        window.scrollY,
        document.scrollingElement?.scrollTop ?? 0,
        document.querySelector(".workspace, main")?.scrollTop ?? 0,
      ],
      scale: window.visualViewport?.scale ?? 1,
    };
  });

test("the wheel zooms the third-person camera with the pointer captured, never the page", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await emulatePointerLock(page);
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async (text) => {
    await window.brickEditor!.project.import({ format: "ldraw", text });
    await window.brickEditor!.ready();
  }, baseplate);
  await openMode(page, "Play");
  await page.getByRole("button", { name: "Enter Play", exact: true }).click();
  await expect(page.locator(".play-overlay")).toHaveClass(/is-locked/);
  await page.evaluate(() =>
    window.brickEditor!.play.setCameraMode("third-person"),
  );
  expect(await camera(page)).toMatchObject({ mode: "third-person" });
  const start = (await camera(page)).distance;
  expect(start).toBe(160);

  // Scroll down (away): three notches, about 16% each.
  await page.mouse.move(720, 500);
  for (let i = 0; i < 3; i++) await page.mouse.wheel(0, 100);
  await expect
    .poll(async () => (await camera(page)).distance)
    .toBeGreaterThan(start * 1.5);
  const out = await camera(page);
  expect(out.distance).toBeLessThanOrEqual(400);
  expect(out.scroll).toEqual([0, 0, 0]);

  // Trackpad pinch (ctrl+wheel) zooms in; the browser does not zoom the page.
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -30);
  await page.keyboard.up("Control");
  await expect
    .poll(async () => (await camera(page)).distance)
    .toBeLessThan(out.distance);
  expect((await camera(page)).scale).toBe(1);

  // All the way in hands over to first person; out again returns.
  for (let i = 0; i < 7; i++) await page.mouse.wheel(0, -600);
  await expect.poll(async () => (await camera(page)).mode).toBe("first-person");
  await page.mouse.wheel(0, 100);
  await expect.poll(async () => (await camera(page)).mode).toBe("third-person");
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, 100);
  await expect
    .poll(async () => (await camera(page)).distance)
    .toBeGreaterThan(70);
  const chosen = (await camera(page)).distance;

  // The distance is kept for this tab: re-entering Play uses it.
  await page.evaluate(() => window.brickEditor!.play.exit());
  await page.evaluate(() =>
    window.brickEditor!.play.enter({ cameraMode: "third-person" }),
  );
  expect((await camera(page)).distance).toBeCloseTo(chosen, 6);
  expect((await camera(page)).scroll).toEqual([0, 0, 0]);
  await page.evaluate(() => window.brickEditor!.play.exit());
  expect(errors).toEqual([]);
});
