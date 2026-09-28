import { test, expect } from "@playwright/test";
import { unzipSync, strFromU8 } from "fflate";
import type { Project } from "../../src/core/types";
for (const width of [360, 1080]) {
  test(`touch rig authoring validates groups, scopes and stale previews at ${width}px`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
        viewport: { width, height: width === 360 ? 800 : 1800 },
        hasTouch: true,
      }),
      page = await context.newPage(),
      errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.goto(`${baseURL}/?automation=1`);
      await page.waitForFunction(() => !!window.brickEditor, undefined, {
        timeout: 15000,
      });
      await page.evaluate(async () => {
        await window.brickEditor!.project.import({
          format: "ldraw",
          text: [0, 80, 160]
            .map(
              (x, i) =>
                `1 ${[4, 1, 14][i]} ${x} 0 0 1 0 0 0 1 0 0 0 1 3001.dat`,
            )
            .join("\n"),
        });
        await window.brickEditor!.ready();
      });
      await page
        .getByRole("navigation", { name: "Mobile panels" })
        .getByRole("button", { name: "Inspector", exact: true })
        .click();
      const ui = page.locator(".rig-authoring");
      await ui.getByText("Create or edit a rig", { exact: true }).click();
      await ui
        .getByText("Choose parts for assignment", { exact: true })
        .click();
      const choose = async (index: number) => {
        await ui
          .getByRole("button", { name: "Clear rig selection", exact: true })
          .click();
        await ui
          .getByRole("checkbox", {
            name: `Select 3001.dat · part ${index}`,
            exact: true,
          })
          .check();
      };
      const native = async () => {
        const bytes = await page.evaluate(async () =>
          Array.from(
            (await window.brickEditor!.project.export({ format: "native" }))
              .bytes,
          ),
        );
        return JSON.parse(
          strFromU8(unzipSync(Uint8Array.from(bytes))["project.json"]),
        ) as Project;
      };
      const command = (type: string, payload: Record<string, unknown> = {}) =>
        page.evaluate(
          async ({ type, payload }) => {
            const a = window.brickEditor!,
              q = await a.query();
            return a.dispatch({
              schemaVersion: 1,
              commandId: crypto.randomUUID(),
              expectedRevision: q.revision,
              type,
              payload,
            });
          },
          { type, payload },
        );
      await choose(1);
      await ui
        .getByRole("button", {
          name: "Assign selection to fixed group",
          exact: true,
        })
        .click();
      await ui
        .getByRole("button", {
          name: "Assign selection to moving group",
          exact: true,
        })
        .click();
      await ui
        .getByRole("button", { name: "Preview rig assignment", exact: true })
        .click();
      await expect(
        ui.getByRole("button", { name: "Create rig", exact: true }),
      ).toBeDisabled();
      await expect(ui.getByRole("status")).toContainText(
        /more than one|multiple|distinct|overlap|once/i,
      );
      await choose(2);
      await ui
        .getByRole("button", {
          name: "Assign selection to moving group",
          exact: true,
        })
        .click();
      // Draft survives switching away to the canvas for normal part selection.
      await page
        .locator(".mobile-panel.mobile-open .mobile-sheet-head")
        .getByRole("button", { name: "Close" })
        .click();
      await page
        .getByRole("navigation", { name: "Mobile panels" })
        .getByRole("button", { name: "Inspector", exact: true })
        .click();
      await expect(ui).toContainText("Fixed group: 1 parts");
      await expect(ui).toContainText("Moving group: 1 parts");
      await ui.getByLabel("Hinge pivot X", { exact: true }).fill("40");
      await ui
        .getByRole("button", { name: "Preview rig assignment", exact: true })
        .click();
      await expect(
        ui.getByRole("button", { name: "Create rig", exact: true }),
      ).toBeEnabled();
      await ui
        .getByLabel("Maximum angle (degrees)", { exact: true })
        .fill("60");
      await expect(
        ui.getByRole("button", { name: "Create rig", exact: true }),
      ).toBeDisabled();
      const before = await page.evaluate(() => window.brickEditor!.query());
      await command("layers.update", {
        layerId: before.occurrences[0].layerId,
        locked: true,
      });
      await ui
        .getByRole("button", { name: "Preview rig assignment", exact: true })
        .click();
      await expect(ui.getByRole("status")).toContainText(/unlock|locked/i);
      await expect(
        ui.getByRole("button", { name: "Create rig", exact: true }),
      ).toBeDisabled();
      await command("layers.update", {
        layerId: before.occurrences[0].layerId,
        locked: false,
      });
      await ui
        .getByRole("button", { name: "Preview rig assignment", exact: true })
        .click();
      const preCommit = await page.evaluate(() => window.brickEditor!.query());
      await ui.getByRole("button", { name: "Create rig", exact: true }).click();
      await expect(ui.getByRole("status")).toContainText("Rig created");
      const hingeProject = await native(),
        hinge = Object.values(hingeProject.motionRigs)[0];
      expect(hingeProject.revision).toBe(preCommit.revision + 1);
      expect(hinge.joints[0].limits).toEqual([0, 60]);
      expect(hinge.groups.every((g) => g.frame.position[0] === 40)).toBe(true);
      expect(
        (await page.evaluate(() => window.brickEditor!.query())).occurrences,
      ).toEqual(preCommit.occurrences);
      await command("history.undo");
      expect(Object.keys((await native()).motionRigs)).toHaveLength(0);
      await ui
        .getByRole("combobox", { name: "Rig type", exact: true })
        .selectOption("vehicle");
      await choose(1);
      await ui
        .getByRole("button", {
          name: "Assign selection to chassis",
          exact: true,
        })
        .click();
      await choose(2);
      await ui
        .getByRole("button", {
          name: "Assign selection to wheel 1",
          exact: true,
        })
        .click();
      await choose(3);
      await ui
        .getByRole("button", {
          name: "Assign selection to wheel 2",
          exact: true,
        })
        .click();
      await ui.getByLabel("Wheel 1 center X", { exact: true }).fill("80");
      await ui.getByLabel("Wheel 2 center X", { exact: true }).fill("160");
      await ui
        .getByRole("checkbox", { name: "Wheel 1 steers", exact: true })
        .check();
      await ui
        .getByRole("button", { name: "Preview rig assignment", exact: true })
        .click();
      await expect(ui).toContainText("3 affected parts in 3 groups");
      await ui.getByRole("button", { name: "Create rig", exact: true }).click();
      const vehicle = Object.values((await native()).motionRigs)[0];
      expect(vehicle.vehicle?.wheels).toHaveLength(2);
      expect(vehicle.vehicle?.wheels.map((w) => w.steering)).toEqual([
        true,
        false,
      ]);
      expect(vehicle.groups.flatMap((g) => g.occurrenceIds).sort()).toEqual(
        before.occurrences.map((o) => o.id).sort(),
      );
      await command("history.undo");
      expect(Object.keys((await native()).motionRigs)).toHaveLength(0);
      await command("history.redo");
      expect(Object.values((await native()).motionRigs)[0]).toEqual(vehicle);
      expect(errors).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
    } finally {
      await context.close();
    }
  });
}
