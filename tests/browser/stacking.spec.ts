import { test, expect } from "@playwright/test";

test("tapping an existing brick stacks on top of it or places beside it", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(() =>
    window
      .brickEditor!.project.import({
        format: "ldraw",
        text: "0 FILE s.ldr\n1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat",
      })
      .then(() => window.brickEditor!.ready()),
  );
  const look = (position: number[], target: number[]) =>
    page.evaluate(
      ([position, target]) =>
        window.brickEditor!.camera.set({
          space: "ldraw",
          projection: "perspective",
          position: position as [number, number, number],
          target: target as [number, number, number],
          up: [0, -1, 0],
          fovDeg: 40,
          near: 1,
          far: 5000,
        }),
      [position, target],
    );
  const tapCentre = async () => {
    const box = (await page.locator(".viewport canvas").boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };
  const place = page.locator(".placement-card");
  await page.getByRole("button", { name: /Brick 2 × 4 3001/ }).click();
  // From above, tapping the brick's top stacks the new brick on it.
  await look([0, -400, 150], [0, -24, 0]);
  await tapCentre();
  await expect(page.locator(".status-bar")).toContainText("stacked on top");
  await expect(place.getByLabel("Place Y")).toHaveValue("-48");
  await place.getByRole("button", { name: "Place part", exact: true }).click();
  const stacked = await page.evaluate(() => window.brickEditor!.query());
  expect(
    stacked.occurrences
      .map((o) => o.transform.position[1])
      .sort((a, b) => a - b),
  ).toEqual([-48, -24]);
  // From the side, tapping the lower brick's right face places flush beside it.
  await look([400, -12, 0], [40, -12, 0]);
  await tapCentre();
  await expect(page.locator(".status-bar")).toContainText("beside the part");
  await expect(place.getByLabel("Place X")).toHaveValue("80");
  await expect(place.getByLabel("Place Y")).toHaveValue("-24");
  expect(errors).toEqual([]);
});
