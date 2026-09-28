import { test, expect, devices } from "@playwright/test";
import { openMode } from "./helpers/mode";

// Raw triangles count as expanded leaves but stay within renderer part budgets.
const flat = (n: number) =>
  "0 FILE root.ldr\n" +
  Array.from({ length: n }, (_, i) => {
    const x = (i % 200) * 4,
      z = Math.floor(i / 200) * 4;
    return `3 4 ${x} 0 ${z} ${x + 4} 0 ${z} ${x} 0 ${z + 4}`;
  }).join("\n");

test.describe("phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: devices["Pixel 7"].userAgent,
  });
  test("phones default to mobile limits; raising them needs an acknowledged impact and persists", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("./?automation=1");
    await page.waitForFunction(() => !!window.brickEditor);
    await page.evaluate(() => window.brickEditor!.ready());
    const status = await page.evaluate(() =>
      window.brickEditor!.resources.status(),
    );
    expect(status).toMatchObject({
      profile: "mobile",
      preference: "auto",
      detected: "mobile",
    });
    // Mobile budgets apply to automation too.
    const refused = await page.evaluate(async () => {
      const a = window.brickEditor!,
        q = await a.query();
      return a.render
        .image({
          revision: q.revision,
          width: 2400,
          height: 2000,
          format: "png",
          visibility: { mode: "all" },
          background: { type: "solid", color: "#ffffff" },
          quality: "fast",
        })
        .then(
          () => "captured",
          (e) => e.code + ": " + e.message,
        );
    });
    expect(refused).toMatch(/^LIMIT_EXCEEDED: .*4 megapixels \(mobile/);
    const denied = await page.evaluate(() =>
      window.brickEditor!.resources.setProfile({ profile: "desktop" }).then(
        () => "applied",
        (e) => e.message,
      ),
    );
    expect(denied).toMatch(/acknowledge/);

    // 25,001 parts exceed the phone budget: source-only view with the limits control.
    await page.evaluate(
      (text) =>
        window.brickEditor!.project.import({
          format: "ldraw",
          text,
          name: "wide.ldr",
        }),
      flat(25001),
    );
    await expect(
      page.getByRole("heading", { name: "Too big for phone limits" }),
    ).toBeVisible();
    await expect(page.locator("main")).toContainText(
      "25,001 parts and shapes; phone limits allow 25,000",
    );
    const panel = page.getByRole("region", { name: "Device limits" });
    await expect(panel).toContainText("This project has 25,001 parts");
    // The primary action opens the confirmation directly.
    await page
      .getByRole("button", { name: "Open with desktop limits…" })
      .click();
    await expect(panel.getByLabel("Desktop limits")).toBeChecked();
    const warning = panel.getByRole("alert");
    await expect(warning).toContainText("including this one (25,001)");
    await expect(
      warning.getByRole("button", { name: "Download backup" }),
    ).toBeVisible();
    const apply = warning.getByRole("button", { name: "Use desktop limits" });
    await expect(apply).toBeDisabled();
    await warning.getByLabel("I understand the risk").check();
    await apply.click();
    await expect(
      page.getByRole("heading", { name: "Too big for phone limits" }),
    ).toBeHidden();
    await expect(page.locator(".canvas-bottom")).toContainText("25,001 parts", {
      timeout: 60000,
    });
    // The model is shown (not the catalogue sheet) and the change is announced.
    await expect(
      page.getByText(
        "Desktop limits on. Project opened: 25,001 parts and shapes.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Place selected part" }),
    ).toBeHidden();
    expect(
      await page.evaluate(() => window.brickEditor!.resources.status()),
    ).toMatchObject({
      profile: "desktop",
      preference: "desktop",
      raisedAboveDevice: true,
    });
    await page.screenshot({
      path: test.info().outputPath("phone-raised.png"),
    });

    // The acknowledged choice survives reload; returning to automatic restores phone limits.
    await page.reload();
    await page.waitForFunction(() => !!window.brickEditor);
    await page.evaluate(() => window.brickEditor!.ready());
    expect(
      (await page.evaluate(() => window.brickEditor!.resources.status()))
        .profile,
    ).toBe("desktop");
    await page.evaluate(() =>
      window.brickEditor!.resources.setProfile({ profile: "auto" }),
    );
    await expect(
      page.getByRole("heading", { name: "Too big for phone limits" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test("desktop keeps desktop limits and shows the device limits panel", async ({
  page,
}) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  expect(
    await page.evaluate(() => window.brickEditor!.resources.status()),
  ).toMatchObject({ profile: "desktop", detected: "desktop" });
  await openMode(page, "Project");
  const panel = page.getByRole("region", { name: "Device limits" });
  await expect(panel).toContainText("desktop or laptop");
  await panel.getByLabel("Phone limits").check();
  expect(
    (await page.evaluate(() => window.brickEditor!.resources.status())).profile,
  ).toBe("mobile");
  await panel.getByLabel("Automatic").check();
  expect(
    (await page.evaluate(() => window.brickEditor!.resources.status())).profile,
  ).toBe("desktop");
});
