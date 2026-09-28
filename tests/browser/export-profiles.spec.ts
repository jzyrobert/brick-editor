import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
import { openMode } from "./helpers/mode";
const placements = (text: string) =>
  text
    .split(/\r?\n/)
    .filter((line) => /^1\s/.test(line))
    .map((line) => {
      const tokens = line.split(/\s+/);
      return {
        transform: {
          position: tokens.slice(2, 5).map(Number),
          basis: tokens.slice(5, 14).map(Number),
        },
      };
    });
for (const size of [
  { width: 1440, height: 1000, touch: false },
  { width: 1080, height: 1800, touch: true },
])
  test(`export profile downloads preserve coordinates and package dependencies at ${size.width}px`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
        viewport: size,
        hasTouch: size.touch,
      }),
      page = await context.newPage();
    try {
      await page.goto(`${baseURL}/?automation=1`);
      await page.waitForFunction(() => !!window.brickEditor);
      await page.evaluate(async () => {
        const a = window.brickEditor!;
        await a.project.import({ format: "template", template: "wall" });
        let q = await a.query();
        const layer = await a.dispatch({
          schemaVersion: 1,
          commandId: "export-layer",
          expectedRevision: q.revision,
          type: "layers.add",
          payload: { name: "Roof" },
        });
        q = await a.query();
        await a.dispatch({
          schemaVersion: 1,
          commandId: "export-assign",
          expectedRevision: q.revision,
          type: "layers.assign",
          payload: {
            layerId: layer.addedLayerIds[0],
            occurrenceIds: q.occurrences.slice(0, 5).map((o) => o.id),
          },
        });
        await a.ready();
      });
      const before = await page.evaluate(() => window.brickEditor!.query());
      await openMode(page, "Project");
      const panel = page.getByRole("region", { name: "Model export profiles" });
      await panel.getByText("Model export profiles", { exact: true }).click();
      await panel
        .getByRole("combobox", { name: "Export profile", exact: true })
        .selectOption("layers");
      let pending = page.waitForEvent("download");
      await panel
        .getByRole("button", { name: "Download model export" })
        .click();
      let download = await pending;
      const layers = unzipSync(await readFile((await download.path())!)),
        manifest = JSON.parse(strFromU8(layers["manifest.json"]));
      expect(manifest.layers).toHaveLength(2);
      const positions = manifest.layers
        .flatMap((l: { file: string }) =>
          placements(strFromU8(layers[l.file])).map((o) =>
            JSON.stringify(o.transform),
          ),
        )
        .sort();
      expect(positions).toEqual(
        before.occurrences.map((o) => JSON.stringify(o.transform)).sort(),
      );
      await panel
        .getByRole("combobox", { name: "Export profile", exact: true })
        .selectOption("portable");
      await panel
        .getByRole("checkbox", {
          name: "Include licensed official dependency library (ZIP)",
          exact: true,
        })
        .check();
      pending = page.waitForEvent("download");
      await panel
        .getByRole("button", { name: "Download model export" })
        .click();
      download = await pending;
      const portable = unzipSync(await readFile((await download.path())!));
      expect(download.suggestedFilename()).toMatch(/portable.zip$/);
      expect(placements(strFromU8(portable["model.mpd"]))).toHaveLength(
        before.occurrences.length,
      );
      expect(
        Object.keys(portable).some((k) => k.startsWith("ldraw/parts/s/")),
      ).toBe(true);
      expect(strFromU8(portable["README.txt"])).toContain("search path");
      expect(await page.evaluate(() => window.brickEditor!.query())).toEqual(
        before,
      );
    } finally {
      await context.close();
    }
  });
