import { test, expect } from "@playwright/test";

const house = `0 FILE house.ldr
1 16 0 -48 0 1 0 0 0 1 0 0 0 1 upper.ldr
1 16 0 0 0 1 0 0 0 1 0 0 0 1 ground.ldr
0 FILE ground.ldr
1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat
0 FILE upper.ldr
1 1 0 0 0 1 0 0 0 1 0 0 0 1 3003.dat`;

test("exploded floors lift apart for viewing without changing the build", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(
    (text) =>
      window
        .brickEditor!.project.import({ format: "ldraw", text })
        .then(() => window.brickEditor!.ready()),
    house,
  );
  const state = () =>
    page.evaluate(async () => {
      const a = window.brickEditor!;
      return {
        height: (await a.render.section.get()).range.y,
        source: new TextDecoder().decode(
          (await a.project.export({ format: "ldraw" })).bytes,
        ),
      };
    });
  const before = await state();
  await page.getByRole("button", { name: "Camera views" }).click();
  await page.getByRole("button", { name: "Explode floors" }).click();
  await expect(
    page.getByRole("button", { name: "Select", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".explode-control .section-label")).toHaveText(
    "4 bricks apart",
  );
  const exploded = await state();
  // The upper floor is lifted 4 bricks (96 LDU); the source does not change.
  expect(exploded.height!.min).toBeCloseTo(before.height!.min - 96, 3);
  expect(exploded.height!.max).toBeCloseTo(before.height!.max, 3);
  expect(exploded.source).toBe(before.source);
  await page.getByRole("button", { name: "Assemble floors" }).click();
  await expect(
    page.getByRole("button", { name: "Select", exact: true }),
  ).toBeEnabled();
  expect((await state()).height).toEqual(before.height);
  // A one-group model has nothing to explode and says so.
  await page.evaluate(() =>
    window
      .brickEditor!.project.import({
        format: "ldraw",
        text: "0 FILE f.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
      })
      .then(() => window.brickEditor!.ready()),
  );
  expect(
    await page.evaluate(() =>
      window.brickEditor!.render.explode.set({ gap: 96 }),
    ),
  ).toMatchObject({ groups: 0 });
  expect(errors).toEqual([]);
});
