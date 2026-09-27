import { expect, test } from "@playwright/test";
test("installed primitive geometry resolves without creating a purchasing identity", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.project.import({
      format: "ldraw",
      text: "1 4 0 0 0 1 0 0 0 1 0 0 0 1 stud.dat",
    });
    const q = await a.query({ spatial: true });
    await a.ready({ minRevision: q.revision, strict: true });
    const inventory = await a.inventory.preview({
      expectedRevision: q.revision,
      format: "bricklink-wanted-xml",
      scope: { kind: "all" },
    });
    return {
      namespace: q.occurrences[0].namespace,
      unresolved: q.unresolvedReferenceIds,
      completeBounds: q.spatial!.complete,
      minY: q.spatial!.bounds!.min[1],
      inventoryComplete: inventory.canExportComplete,
    };
  });
  expect(result).toEqual({
    namespace: "official",
    unresolved: [],
    completeBounds: true,
    minY: -4,
    inventoryComplete: false,
  });
});
test("spatial queries and actionable diagnostics work without WebGL", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: any[]
    ) {
      if (type.startsWith("webgl")) return null;
      return original.apply(this, [type, ...args] as any);
    } as typeof original;
  });
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.project.import({
      format: "ldraw",
      text: "1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n1 1 500 0 0 1 0 0 0 1 0 0 0 1 missing.dat",
    });
    const q = await a.query({ spatial: true });
    const selected = await a.query({
      scope: { kind: "selection", occurrenceIds: [q.occurrences[0].id] },
      spatial: true,
    });
    const inStud = await a.query({
      bounds: { min: [-1, -4, -1], max: [1, -3, 1], mode: "intersects" },
    });
    return {
      count: q.count,
      missing: q.unresolvedReferenceIds.length,
      unknown: q.spatial!.unknownBoundsIds.length,
      selected: selected.count,
      min: selected.spatial!.bounds!.min,
      inStud: inStud.count,
      connection: q.connectivity.status,
    };
  });
  expect(result).toEqual({
    count: 2,
    missing: 1,
    unknown: 1,
    selected: 1,
    min: [-40, -4, -20],
    inStud: 1,
    connection: "unverified",
  });
});
test("current selection queries follow the editor selection tools", async ({
  page,
}) => {
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async () => {
    const a = window.brickEditor!;
    await a.project.import({ format: "template", template: "wall" });
    await a.ready();
  });
  expect(
    await page.evaluate(
      async () => (await window.brickEditor!.query({ selection: true })).count,
    ),
  ).toBe(0);
  await page
    .locator(".right-tabs")
    .getByRole("button", { name: "Inspector", exact: true })
    .click();
  await page.getByText("Selection tools", { exact: true }).click();
  await page
    .getByRole("button", { name: "Select editable parts", exact: true })
    .click();
  await expect(page.locator(".canvas-bottom")).toContainText("40 selected");
  const q = await page.evaluate(async () => ({
    all: (await window.brickEditor!.query()).count,
    selected: (await window.brickEditor!.query({ selection: true })).count,
  }));
  expect(q.all).toBeGreaterThan(0);
  expect(q.selected).toBe(q.all);
});
