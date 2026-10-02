import { test, expect } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { openMode } from "./helpers/mode";
const run = promisify(execFile);

for (const width of [1440, 360]) {
  test(`authored native instructions open first and replay nested benches at ${width}px`, async ({
    page,
  }) => {
    const workspace = test.info().outputPath("workbench");
    await mkdir(workspace, { recursive: true });
    const input = join(workspace, "source.mpd");
    await writeFile(
      input,
      Array.from(
        { length: 5 },
        (_, i) => `1 4 ${i * 80} 0 0 1 0 0 0 1 0 0 0 1 3001.dat`,
      ).join("\n"),
    );
    const cli = (...args: string[]) =>
      run(process.execPath, [
        "node_modules/tsx/dist/cli.mjs",
        "scripts/instruction-workbench.ts",
        ...args,
      ]);
    await cli("prepare", "--input", input, "--output", workspace);
    const source = JSON.parse(
      await readFile(join(workspace, "source.json"), "utf8"),
    );
    const aliases = JSON.parse(
      await readFile(join(workspace, "aliases.json"), "utf8"),
    );
    const ids = Object.values(aliases) as string[];
    const proposalPath = join(workspace, "proposal.json");
    await writeFile(
      proposalPath,
      JSON.stringify({
        sourceHash: source.sourceHash,
        name: "Authored hobbyist draft",
        modules: [
          {
            id: "object",
            name: "Completed object",
            members: ["p0001", "p0002", "p0003", "p0004"],
            placement: "scene",
          },
          {
            id: "child",
            name: "Child candidate",
            members: ["p0002", "p0003"],
            parentId: "object",
            receivers: ["p0001"],
          },
        ],
        operations: [
          { key: "ground", additions: ["p0005"] },
          { key: "host", additions: ["p0001"], workbench: "object" },
          { key: "child-a", additions: ["p0002"], workbench: "child" },
          {
            key: "child-b",
            additions: ["p0003"],
            workbench: "child",
            receiving: ["p0002"],
            notes:
              "Support the separate child on a flat surface. Locate the exposed receiving feature, keep the support clear, and check alignment before adding this part. Source pictures do not establish physical fit or retention.",
          },
          { key: "child-place", place: "child" },
          { key: "finish", additions: ["p0004"], workbench: "object" },
          { key: "scene-place", place: "object" },
        ],
      }),
    );
    const result = join(workspace, "result");
    await cli(
      "apply",
      "--workspace",
      workspace,
      "--proposal",
      proposalPath,
      "--output",
      result,
    );
    await page.setViewportSize({ width, height: width === 360 ? 800 : 1000 });
    await page.goto("/?automation=1");
    await page.waitForFunction(() => !!window.brickEditor);
    await page.evaluate(
      async (bytes) => {
        await window.brickEditor!.project.import({ format: "native", bytes });
        await window.brickEditor!.ready({ strict: true });
      },
      Array.from(await readFile(join(result, "result.brickproj"))),
    );
    const shown = () =>
      page.evaluate(async () => {
        await window.brickEditor!.ready();
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        const scene = window.__brickScene as unknown as {
          handles: Map<string, { visible: boolean }>;
        };
        return [...scene.handles]
          .flatMap(([id, handle]) => (handle.visible ? [id] : []))
          .sort();
      });
    await openMode(page, "Instructions");
    await expect(
      page.getByRole("heading", {
        name: "Authored hobbyist draft",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Generated plan review", { exact: true }),
    ).toHaveCount(0);
    await page.getByLabel("Instruction step", { exact: true }).fill("3");
    await expect.poll(shown).toEqual(ids.slice(1, 3).sort());
    await page
      .getByRole("button", {
        name: "Show receiver before placement",
        exact: true,
      })
      .click();
    await expect.poll(shown).toEqual([ids[1]]);
    await page
      .getByRole("button", { name: /^Show placement(?: close-up)?$/ })
      .click();
    await expect.poll(shown).toEqual(ids.slice(1, 3).sort());
    await page
      .getByRole("button", { name: "Build it step by step", exact: true })
      .click();
    const scrubber = page.locator(".guide-scrubber");
    await scrubber.fill("2");
    await expect.poll(shown).toEqual([ids[1]]);
    await scrubber.fill("3");
    const action = page.locator(".guide-placement-note");
    await action.scrollIntoViewIfNeeded();
    expect(
      await action.evaluate((el) => el.getBoundingClientRect().height),
    ).toBeGreaterThan(20);

    await expect.poll(shown).toEqual(ids.slice(1, 3).sort());
    await page
      .locator(".guide-panel summary")
      .filter({ hasText: "Placement views" })
      .click();
    await page
      .getByRole("button", {
        name: "Show receiver before placement",
        exact: true,
      })
      .click();
    await expect.poll(shown).toEqual([ids[1]]);
    await page
      .getByRole("button", { name: "Show placement", exact: true })
      .click();
    await expect.poll(shown).toEqual(ids.slice(1, 3).sort());
    await scrubber.fill("4");
    await expect.poll(shown).toEqual(ids.slice(0, 3).sort());
    await expect(page.locator(".guide-panel")).toContainText("No new parts");
    await scrubber.fill("6");
    await expect.poll(shown).toEqual([...ids].sort());
    await expect(page.locator(".guide-panel")).toContainText(
      "no mating connection inferred",
    );
    await page.screenshot({
      path: test.info().outputPath(`authored-${width}.png`),
    });
  });
}
