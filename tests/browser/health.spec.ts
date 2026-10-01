import { test, expect } from "@playwright/test";
import { openMenuTab, openMode } from "./helpers/mode";

test("model health reports overlaps with their certainty and selects the parts", async ({
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
    "0 FILE c.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n1 1 20 -8 0 1 0 0 0 1 0 0 0 1 3003.dat\n1 14 400 -200 0 1 0 0 0 1 0 0 0 1 3005.dat",
  );
  await openMenuTab(page, "Project", "My builds");
  const panel = page.getByRole("region", { name: "Model health" });
  await panel.getByRole("button", { name: "Check model" }).click();
  const overlap = panel
    .getByRole("listitem")
    .filter({ hasText: "Overlapping parts" });
  await expect(overlap).toContainText("Approximate");
  await expect(overlap).toContainText("2 parts overlap in 1 place");
  // Verified stud data: the clashing 2 × 2 does not sit on studs, the 1 × 1 floats.
  const connections = panel
    .getByRole("listitem")
    .filter({ hasText: /^Connections/ });
  await expect(connections).toContainText("3 separately connected groups");
  await expect(connections).not.toContainText("Not verified");
  await overlap.getByRole("button", { name: "Select 2 parts" }).click();
  await expect(page.locator(".canvas-bottom")).toContainText("2 selected");
  expect(errors).toEqual([]);
});
