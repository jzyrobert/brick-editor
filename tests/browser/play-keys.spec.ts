import { test, expect } from "@playwright/test";
import { openMode } from "./helpers/mode";
test("Play keys validate, persist, drive movement and preserve Escape on focused inputs", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    await window.brickEditor!.project.import({
      format: "template",
      template: "blank",
    });
    await window.brickEditor!.ready();
  });
  await openMode(page, "Play");
  await page.getByText("Play keyboard controls", { exact: true }).click();
  const forward = page.getByLabel("Move forward Play key", { exact: true });
  await forward.fill("S");
  await page
    .getByRole("button", { name: "Apply Play keys", exact: true })
    .click();
  await expect(
    page.getByText("Play key already assigned: S", { exact: true }),
  ).toBeVisible();
  await forward.fill("ArrowUp");
  await page
    .getByRole("button", { name: "Apply Play keys", exact: true })
    .click();
  await expect(
    page.getByText("Play keys saved on this device.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enter Play", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await window.brickEditor!.play.setLocomotion("fly-noclip");
  });
  const position = () =>
    page.evaluate(() =>
      window.brickEditor!.play.snapshot().then((s) => s.position),
    );
  const before = await position();
  await page.keyboard.down("w");
  await page.waitForTimeout(150);
  await page.keyboard.up("w");
  expect(await position()).toEqual(before);
  await page.keyboard.down("ArrowUp");
  await expect.poll(position).not.toEqual(before);
  await page.keyboard.up("ArrowUp");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  await page.getByText("Play keyboard controls", { exact: true }).click();
  await page.evaluate(async () => {
    await window.brickEditor!.play.pause(false);
    const input = document.createElement("input");
    input.id = "escape-focus-probe";
    document.body.append(input);
    input.focus();
  });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.waitForFunction(() => !!window.brickEditor);
  await openMode(page, "Play");
  await page.getByText("Play keyboard controls", { exact: true }).click();
  await expect(
    page.getByLabel("Move forward Play key", { exact: true }),
  ).toHaveValue("ArrowUp");
});
