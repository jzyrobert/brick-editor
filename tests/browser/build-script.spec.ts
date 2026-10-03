import { expect, test } from "@playwright/test";

const hut = {
  buildScript: 1,
  title: "Test hut",
  palette: { wall: "white", roof: "dark red" },
  sections: [
    {
      name: "Ground",
      ops: [{ op: "baseplate", at: [-8, -8], size: [16, 16], colour: "green" }],
    },
    {
      name: "Hut",
      layer: "Buildings",
      ops: [
        {
          op: "room",
          at: [-4, 0, -3],
          size: [8, "6b", 6],
          colour: "wall",
          openings: [
            { side: "front", at: 2, width: 4, height: 18, door: "red" },
          ],
        },
        {
          op: "roof",
          style: "gable",
          at: [-4, 18, -3],
          size: [8, 6],
          colour: "roof",
          gable: "wall",
        },
        {
          op: "place",
          part: { find: "cheese slope" },
          at: [6, 0, 6],
          colour: "yellow",
        },
      ],
    },
  ],
};

test("build scripts validate, compile, apply and search parts through the API", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async (script) => {
    const a = window.brickEditor!;
    const invalid = await a.buildScript.validate({
      buildScript: 1,
      title: "x",
      sections: [{ name: "a", ops: [{ op: "tower" }] }],
    });
    const valid = await a.buildScript.validate(script);
    const before = (await a.query()).revision;
    const compiled = await a.buildScript.compile({
      script,
      includeLDraw: true,
    });
    const unchanged = (await a.query()).revision === before;
    const dry = await a.buildScript.apply({ script, dryRun: true });
    // Over the script's own limit: refused. A part target is guidance only.
    const over = await a.buildScript.apply({
      script: { ...script, limits: { maxParts: 3 } },
    });
    const far = await a.buildScript.compile({ script, targetParts: 100_000 });
    const overUnchanged = (await a.query()).revision === before;
    const applied = await a.buildScript.apply({
      script,
      expectedRevision: before,
    });
    await a.ready({ minRevision: applied.revision, strict: true });
    const q = await a.query();
    const layers = [...new Set(q.occurrences.map((o) => o.layerId))];
    const search = await a.parts.search({ query: "headlight brick", limit: 3 });
    const sized = await a.parts.search({
      size: { w: 1, d: 2, h: 1 },
      category: "Tiles",
      colour: "white",
      availableInColour: true,
      limit: 5,
    });
    const health = await a.health.check();
    return {
      invalid: invalid.issues.map((i) => i.path),
      valid: valid.valid,
      unchanged,
      ldraw: compiled.ldraw!.startsWith("0 FILE test-hut.mpd"),
      compiledParts: compiled.report.stats.parts,
      resolved: compiled.report.resolved.map((r) => r.ref),
      dry: dry.applied,
      over: [over.applied, over.report.ok, over.report.problems[0]?.code],
      overUnchanged,
      far: [far.report.ok, far.report.target?.target, far.report.target?.parts],
      applied: applied.applied,
      ok: applied.report.ok,
      problems: applied.report.problems.filter((p) => p.severity !== "info"),
      occurrences: q.occurrences.length,
      layers: layers.length,
      search: search.results.map((r) => r.id),
      sized: sized.results.map((r) => [r.id, r.inColour]),
      connectivity: health.checks.find((c) => c.id === "connectivity")?.status,
    };
  }, hut);
  expect(result.invalid).toEqual(["$.sections[0].ops[0].op"]);
  expect(result.valid).toBe(true);
  expect(result.unchanged).toBe(true);
  expect(result.ldraw).toBe(true);
  expect(result.resolved).toEqual(["54200.dat"]);
  expect(result.dry).toBe(false);
  expect(result.over).toEqual([false, false, "over-budget"]);
  expect(result.overUnchanged).toBe(true);
  expect(result.far).toEqual([true, 100_000, result.compiledParts]);
  expect(result.applied).toBe(true);
  expect(result.ok).toBe(true);
  expect(result.problems).toEqual([]);
  expect(result.occurrences).toBe(result.compiledParts);
  expect(result.layers).toBe(2);
  expect(result.search[0]).toBe("4070.dat");
  expect(result.sized[0]).toEqual(["3069b.dat", "verified"]);
  expect(result.connectivity).toBe("ok");
});

test("Open file builds a build script", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page
    .locator('input[type="file"][accept*=".json"]')
    .first()
    .setInputFiles({
      name: "hut.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(hut)),
    });
  await page.waitForFunction(
    async () => (await window.brickEditor!.query()).occurrences.length > 50,
    undefined,
    { timeout: 60000 },
  );
  await expect(page.getByLabel("Project title")).toHaveValue("Test hut");
  await expect(page.getByText(/Built “Test hut”: \d+ parts/)).toBeVisible();
});
