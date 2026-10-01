import { expect, test } from "@playwright/test";
import { openTool } from "./helpers/mode";
import { unzipSync, strFromU8 } from "fflate";
import type { MotionRig } from "../../src/mechanisms/types";
import type { Project } from "../../src/core/types";

for (const width of [360, 1080, 1440]) {
  test(`rig editing preserves imported frames and guards update/removal at ${width}px`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
        viewport: {
          width,
          height: width === 360 ? 800 : width === 1080 ? 1800 : 1000,
        },
        hasTouch: width !== 1440,
      }),
      page = await context.newPage();
    try {
      await page.goto(`${baseURL}/?automation=1`);
      await page.waitForFunction(() => !!window.brickEditor, undefined, {
        timeout: 15000,
      });
      const { original, parts } = await page.evaluate(async () => {
        const api = window.brickEditor!;
        await api.project.import({
          format: "ldraw",
          text: [0, 80, 160]
            .map(
              (x, i) =>
                `1 ${[4, 1, 14][i]} ${x} 0 0 1 0 0 0 1 0 0 0 1 3001.dat`,
            )
            .join("\n"),
        });
        await api.ready();
        const q = await api.query(),
          parts = q.occurrences,
          d = Math.SQRT1_2;
        const original: MotionRig = {
          schemaVersion: 1,
          id: "imported",
          name: "Imported mechanism",
          mode: "kinematic",
          groups: [
            {
              id: "base-custom",
              occurrenceIds: [parts[0].id],
              frame: {
                position: [10, 20, 30],
                basis: [0, 0, 1, 0, 1, 0, -1, 0, 0],
              },
              restTransforms: { [parts[0].id]: parts[0].transform },
            },
            {
              id: "door-custom",
              occurrenceIds: [parts[1].id],
              frame: {
                position: [-20, 0, 40],
                basis: [1, 0, 0, 0, 0, -1, 0, 1, 0],
              },
              restTransforms: { [parts[1].id]: parts[1].transform },
            },
          ],
          joints: [
            {
              id: "custom-joint",
              kind: "revolute",
              bodyA: "base-custom",
              bodyB: "door-custom",
              anchorA: [-10, -30, 10],
              anchorB: [40, 0, 10],
              axisA: [0, d, d],
              axisB: [d, 0, -d],
              motor: {
                mode: "velocity",
                target: 1,
                maxEffort: { value: 3, unit: "N*m" },
              },
            },
          ],
        };
        await api.dispatch({
          schemaVersion: 1,
          commandId: crypto.randomUUID(),
          expectedRevision: q.revision,
          type: "rigs.upsert",
          payload: { rig: original },
        });
        return { original, parts };
      });
      await (
        width === 1440
          ? page.locator(".right-tabs")
          : page.getByRole("navigation", { name: "Mobile panels" })
      )
        .getByRole("button", { name: "Inspector", exact: true })
        .click();
      const ui = page.locator(".rig-authoring");
      await openTool(page, "Create or edit a rig");
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
      await ui
        .getByRole("button", { name: "Load rig for editing", exact: true })
        .click();
      await expect(ui).toContainText("Motor metadata is preserved");
      await expect(
        ui.getByRole("checkbox", { name: "Limit joint movement", exact: true }),
      ).not.toBeChecked();
      await expect(
        ui.getByRole("combobox", { name: "Hinge world axis", exact: true }),
      ).toHaveValue("custom");
      await ui.getByLabel("Rig name", { exact: true }).fill("Renamed safely");
      await ui
        .getByRole("button", { name: "Preview rig assignment", exact: true })
        .click();
      await expect(
        ui.getByRole("button", { name: "Update rig", exact: true }),
      ).toBeEnabled();
      await command("project.rename", { title: "Changed externally" });
      await expect(
        ui.getByRole("button", { name: "Update rig", exact: true }),
      ).toBeDisabled();
      await ui
        .getByRole("button", { name: "Preview rig assignment", exact: true })
        .click();
      await expect(ui.getByRole("status")).toContainText("Load the rig again");
      await ui
        .getByRole("button", { name: "Load rig for editing", exact: true })
        .click();
      await ui.getByLabel("Rig name", { exact: true }).fill("Renamed safely");
      await ui
        .getByRole("button", { name: "Preview rig assignment", exact: true })
        .click();
      const before = await page.evaluate(() => window.brickEditor!.query());
      await ui.getByRole("button", { name: "Update rig", exact: true }).click();
      const updated = (await native()).motionRigs.imported;
      expect(updated.name).toBe("Renamed safely");
      expect(updated.groups).toEqual(original.groups);
      expect(updated.joints[0].motor).toEqual(original.joints[0].motor);
      expect(updated.joints[0].id).toBe("custom-joint");
      expect(updated.joints[0].limits).toBeUndefined();
      for (const axis of ["axisA", "axisB"] as const)
        updated.joints[0][axis]!.forEach((value, i) =>
          expect(value).toBeCloseTo(original.joints[0][axis]![i], 12),
        );
      expect(
        (await page.evaluate(() => window.brickEditor!.query())).occurrences,
      ).toEqual(before.occurrences);
      await command("history.undo");
      expect((await native()).motionRigs.imported).toEqual(original);
      await ui
        .getByRole("button", { name: "Review rig removal", exact: true })
        .click();
      await expect(
        ui.getByRole("button", { name: "Confirm remove rig", exact: true }),
      ).toBeVisible();
      await command("project.rename", { title: "Another edit" });
      await expect(
        ui.getByRole("button", { name: "Confirm remove rig", exact: true }),
      ).toHaveCount(0);
      await command("layers.update", {
        layerId: parts[0].layerId,
        locked: true,
      });
      await ui
        .getByRole("button", { name: "Review rig removal", exact: true })
        .click();
      await expect(ui.getByRole("status")).toContainText(/locked|unlock/i);
      await expect(
        ui.getByRole("button", { name: "Confirm remove rig", exact: true }),
      ).toHaveCount(0);
      await command("layers.update", {
        layerId: parts[0].layerId,
        locked: false,
      });
      const compound = structuredClone(original);
      compound.groups.push({
        id: "extra",
        frame: { position: [0, 0, 0], basis: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
        occurrenceIds: [parts[2].id],
        restTransforms: { [parts[2].id]: parts[2].transform },
      });
      await command("rigs.upsert", { rig: compound });
      await ui
        .getByRole("button", { name: "Load rig for editing", exact: true })
        .click();
      await expect(ui.getByRole("status")).toContainText(
        /cannot be loaded|without losing/,
      );
      expect((await native()).motionRigs.imported).toEqual(compound);
      await ui
        .getByRole("button", { name: "Review rig removal", exact: true })
        .click();
      await expect(ui).toContainText("3 parts stay");
      const preRemove = await page.evaluate(() => window.brickEditor!.query());
      await ui
        .getByRole("button", { name: "Confirm remove rig", exact: true })
        .click();
      expect(Object.keys((await native()).motionRigs)).toHaveLength(0);
      expect(
        (await page.evaluate(() => window.brickEditor!.query())).occurrences,
      ).toEqual(preRemove.occurrences);
      await command("history.undo");
      expect((await native()).motionRigs.imported).toEqual(compound);
      await command("history.redo");
      await ui
        .getByText("Choose parts for assignment", { exact: true })
        .click();
      for (const kind of ["fixed", "prismatic", "spherical"] as const) {
        await ui
          .getByRole("combobox", { name: "Rig type", exact: true })
          .selectOption(kind);
        for (const [index, group] of [
          [1, "fixed group"],
          [2, kind === "prismatic" ? "moving group" : "attached group"],
        ] as const) {
          await ui
            .getByRole("button", { name: "Clear rig selection", exact: true })
            .click();
          await ui
            .getByRole("checkbox", {
              name: `Select 3001.dat · part ${index}`,
              exact: true,
            })
            .check();
          await ui
            .getByRole("button", {
              name: `Assign selection to ${group}`,
              exact: true,
            })
            .click();
        }
        if (kind === "prismatic") {
          await ui
            .getByLabel("Minimum travel (LDU)", { exact: true })
            .fill("-20");
          await ui
            .getByLabel("Maximum travel (LDU)", { exact: true })
            .fill("40");
        } else {
          await expect(
            ui.getByRole("checkbox", {
              name: "Limit joint movement",
              exact: true,
            }),
          ).toHaveCount(0);
          if (kind === "spherical")
            await expect(ui).toContainText(
              "Ball-joint motion and forces are not simulated",
            );
        }
        await ui
          .getByRole("button", { name: "Preview rig assignment", exact: true })
          .click();
        await ui
          .getByRole("button", { name: "Create rig", exact: true })
          .click();
        const rig = Object.values((await native()).motionRigs)[0];
        expect(rig.joints[0].kind).toBe(kind);
        if (kind === "prismatic")
          expect(rig.joints[0].limits).toEqual([-20, 40]);
        else {
          expect(rig.joints[0].limits).toBeUndefined();
          expect(rig.joints[0].axisA).toBeUndefined();
        }
        await command("history.undo");
        expect(Object.keys((await native()).motionRigs)).toHaveLength(0);
      }
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
