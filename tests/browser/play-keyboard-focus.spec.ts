import { test, expect } from "@playwright/test";
import { openMode } from "./helpers/mode";

test("Play buttons retain WASD and Escape while Enter and Space activate native controls once", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor?.play);
  await openMode(page, "Play");
  await page.evaluate(() =>
    window.brickEditor!.play.enter({
      locomotion: "fly-noclip",
      realtime: false,
    }),
  );
  await page.getByRole("button", { name: "Third person", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "First person", exact: true }),
  ).toBeFocused();
  const before = await page.evaluate(() => window.brickEditor!.play.snapshot());
  await page.keyboard.down("w");
  const moved = await page.evaluate(() =>
    window.brickEditor!.play.stepTicks(6),
  );
  await page.keyboard.up("w");
  expect(
    Math.hypot(
      moved.position[0] - before.position[0],
      moved.position[2] - before.position[2],
    ),
  ).toBeGreaterThan(5);
  const run = page.getByRole("button", { name: "Run", exact: true });
  await run.focus();
  await page.keyboard.press("Enter");
  await expect(run).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Space");
  await expect(run).toHaveAttribute("aria-pressed", "false");
  const after = await page.evaluate(() =>
    window.brickEditor!.play.stepTicks(6),
  );
  expect(after.position).toEqual(moved.position);
  await page.keyboard.press("Escape");
  await expect(
    page.getByText("Movement is paused.", { exact: true }),
  ).toBeVisible();
});
