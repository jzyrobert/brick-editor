import { test, expect } from "@playwright/test";

// Connectors and occupancy derived from the complete official library, loaded
// on demand with a part; the newly curated roadster/flag/door parts in health
// and inventory.

test("a part outside the catalogue snaps onto studs and connects", async ({
  page,
}) => {
  const shards: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/libraries/connectors-ldraw-full-"))
      shards.push(r.url());
  });
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async () => {
    const a = window.brickEditor!;
    const imported = await a.project.import({
      format: "ldraw",
      text: "1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n",
      name: "snap.ldr",
      strict: true,
    });
    await a.ready({ minRevision: imported.revision, strict: true });
    // Brick 1 × 2 without bottom tube (3065) is not in the catalogue.
    const part = await a.connectors.part({ ref: "3065.dat" });
    const fit = await a.connectors.snap({
      part: "3065.dat",
      position: [4, -24, 6],
    });
    const r = await a.dispatch({
      schemaVersion: 1,
      commandId: crypto.randomUUID(),
      expectedRevision: (await a.query()).revision,
      type: "parts.add",
      payload: {
        parts: [
          {
            ref: "3065.dat",
            colorCode: "1",
            transform: { position: fit!.position, basis: fit!.basis },
          },
        ],
      },
    });
    await a.ready({ minRevision: r.revision, strict: true });
    const groups = await a.connectors.groups();
    const health = await a.health.check();
    return {
      source: part.source,
      verified: part.verified,
      rule: part.rule,
      fit: fit && { position: fit.position, contacts: fit.contacts },
      groups: groups.groups.length,
      contacts: groups.contacts,
      uncovered: groups.uncovered.length,
      connectivity: health.checks.find((c) => c.id === "connectivity")!,
      coverage: (await a.connectors.coverage()).completeLibrary,
    };
  });
  expect(result).toMatchObject({
    source: "complete-library",
    verified: true,
    rule: "full-underside",
    fit: { position: [0, -24, 10], contacts: 2 },
    groups: 1,
    contacts: 2,
    uncovered: 0,
    connectivity: { status: "ok", basis: "exact" },
  });
  expect(result.coverage).toMatchObject({ parts: 24735, verified: 5168 });
  // The pack's manifest and the one shard holding 3065, each verified once.
  expect(shards.filter((u) => u.endsWith("manifest.json"))).toHaveLength(1);
  expect(shards.filter((u) => u.endsWith(".bin")).length).toBeGreaterThan(0);
  expect(new Set(shards).size).toBe(shards.length);
});

test("roadster and castle health compare every part by derived shape; the roadster's parts export as reviewed lots", async ({
  page,
}) => {
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async () => {
    const a = window.brickEditor!;
    const out: Record<string, unknown> = {};
    for (const template of ["castle", "car"] as const) {
      const imported = await a.project.import({ format: "template", template });
      await a.ready({ minRevision: imported.revision, strict: true });
      const health = await a.health.check();
      const collisions = health.checks.find((c) => c.id === "collisions")!;
      out[template] = {
        missing: health.checks.find((c) => c.id === "missing-definitions")!
          .status,
        detail: collisions.detail,
      };
      if (template === "car") {
        const q = await a.query();
        const inventory = await a.inventory.preview({
          expectedRevision: q.revision,
          format: "bricklink-wanted-xml",
          scope: { kind: "all" },
        });
        out.items = [...new Set(inventory.rows.map((r) => r.itemId))].sort();
        out.unmapped = inventory.diagnostics.filter(
          (d) => d.code === "UNMAPPED_PART",
        ).length;
      }
    }
    return out;
  });
  for (const t of ["castle", "car"]) {
    const r = result[t] as { missing: string; detail: string };
    expect(r.missing).toBe("ok");
    // Every part now has derived shape data: nothing falls back to outer boxes.
    expect(r.detail).not.toMatch(/outer boxes/);
    // What remains nests through connections that are not modelled yet
    // (a flag's clips on its pole, wheels on pins, tyres on rims).
    expect(r.detail).toMatch(/connection .*is not modelled/);
  }
  expect(result.unmapped).toBe(0);
  expect(result.items).toEqual(
    expect.arrayContaining([
      "3641",
      "3788",
      "3823",
      "3829c01",
      "4079",
      "4600",
      "4624",
    ]),
  );
});
