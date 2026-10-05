import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { InstructionPlan } from "../../src/core/types";
import { instructionDisplayState } from "../../src/instructions/programme";
import { openMode } from "./helpers/mode";

test("source-guided jaw keeps its receiver, incoming bench and completed pair distinct in editor and phone viewer", async ({
  page,
}) => {
  const text = await readFile(
    new URL("../../fixtures/instructions/omr/31088-1.mpd", import.meta.url),
    "utf8",
  );
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async (text) => {
    await window.brickEditor!.project.import({ format: "ldraw", text });
    await window.brickEditor!.ready({ strict: true });
  }, text);
  await openMode(page, "Instructions");
  await page
    .getByRole("button", { name: "Make steps automatically", exact: true })
    .click();
  await expect(
    page.getByText("Generated plan review", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download plan JSON", exact: true })
    .click();
  const plan = JSON.parse(
    await readFile((await (await pending).path())!, "utf8"),
  ) as InstructionPlan;
  expect(plan.generation!.sourceGuidance).toBe("hierarchy-and-step-prior");
  expect(plan.generation!.connectorCovered).toBe(0);
  expect(new Set(plan.steps.flat()).size).toBe(230);
  const n = plan.stepMetadata!.findIndex((m) => !!m.completedDetail),
    meta = plan.stepMetadata![n];
  expect(meta.assembly!.type).toBe("join");
  expect(plan.modules![meta.assembly!.moduleId].occurrenceIds).toHaveLength(15);
  const visible = () =>
    page.evaluate(async () => {
      await window.brickEditor!.ready();
      await new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      );
      const scene = window.__brickScene as unknown as {
        handles: Map<string, { visible: boolean }>;
      };
      return [...scene.handles]
        .filter(([, h]) => h.visible)
        .map(([id]) => id)
        .sort();
    });
  await page.getByLabel("Instruction step", { exact: true }).fill(String(n));
  await page
    .getByRole("button", {
      name: "Show receiver detail — access unverified",
      exact: true,
    })
    .click();
  expect(await visible()).toEqual([...meta.alternateDetailIds!].sort());
  expect(meta.alternateDetailIds).toHaveLength(1);
  await page
    .getByRole("button", {
      name: "Show joint detail — access unverified",
      exact: true,
    })
    .click();
  expect(await visible()).toEqual(
    [...meta.completedDetail!.occurrenceIds].sort(),
  );
  expect(meta.completedDetail!.occurrenceIds).toHaveLength(2);
  await page
    .getByRole("button", { name: "Show placement close-up", exact: true })
    .click();
  expect(await visible()).toEqual(
    [...instructionDisplayState(plan, n).displayIds].sort(),
  );
  await page
    .getByRole("button", { name: "Build it step by step", exact: true })
    .click();
  for (const size of [
    { width: 360, height: 600 },
    { width: 686, height: 411 },
  ]) {
    await page.setViewportSize(size);
    await page.locator(".guide-scrubber").fill(String(n));
    const summary = page
      .locator(".guide-panel summary")
      .filter({ hasText: "Placement views" });
    if (
      !(await summary.evaluate(
        (el) => (el.parentElement as HTMLDetailsElement).open,
      ))
    )
      await summary.click();
    for (const [label, ids] of [
      ["Show receiver detail — access unverified", meta.alternateDetailIds!],
      [
        "Show joint detail — access unverified",
        meta.completedDetail!.occurrenceIds,
      ],
      [
        "Show completed candidate",
        plan.modules![meta.assembly!.moduleId].occurrenceIds,
      ],
    ] as const) {
      await page.getByRole("button", { name: label, exact: true }).click();
      expect(await visible()).toEqual([...ids].sort());
    }
    await page
      .getByRole("button", { name: "Show placement", exact: true })
      .click();
    expect(await visible()).toEqual(
      [...instructionDisplayState(plan, n).displayIds].sort(),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
});
