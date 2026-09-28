import { describe, expect, it } from "vitest";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { modelHealth } from "../../src/core/health";

const check = (source: string, id: string) =>
  modelHealth(importLDraw(source)).checks.find((c) => c.id === id)!;

describe("model health", () => {
  it("allows stacked and side-by-side bricks but flags real body overlaps", () => {
    const stacked = `0 FILE s.ldr
1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat
1 4 80 0 0 1 0 0 0 1 0 0 0 1 3001.dat`;
    expect(check(stacked, "collisions")).toMatchObject({
      status: "ok",
      count: 0,
      basis: "approximate",
    });
    expect(check(stacked, "assemblies")).toMatchObject({ status: "ok" });
    const clash = `0 FILE c.ldr
1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 1 20 -8 0 1 0 0 0 1 0 0 0 1 3003.dat`;
    const collisions = check(clash, "collisions");
    expect(collisions.status).toBe("warning");
    expect(collisions.count).toBe(1);
    expect(collisions.occurrenceIds).toHaveLength(2);
  });
  it("finds floating groups, missing definitions and instruction omissions", () => {
    const source = `0 FILE f.ldr
1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat
1 14 400 -200 0 1 0 0 0 1 0 0 0 1 3005.dat
1 4 0 0 200 1 0 0 0 1 0 0 0 1 mystery.dat`;
    const p = importLDraw(source);
    const all = occurrences(p);
    p.instructionPlans.plan = { name: "Plan", steps: [[all[0].id, "gone"]] };
    const report = modelHealth(p);
    const byId = Object.fromEntries(report.checks.map((c) => [c.id, c]));
    expect(byId.assemblies).toMatchObject({ status: "warning", count: 1 });
    expect(byId.assemblies.occurrenceIds).toEqual([all[2].id]);
    expect(byId["missing-definitions"]).toMatchObject({
      status: "warning",
      count: 1,
      basis: "exact",
    });
    expect(byId["missing-definitions"].detail).toContain("mystery.dat");
    // Verified stud data: the stacked bricks connect, the lifted 1 × 1 floats;
    // the missing part has no data, so the result is not exact.
    expect(byId.connectivity).toMatchObject({
      status: "warning",
      basis: "approximate",
      count: 1,
    });
    expect(byId.connectivity.occurrenceIds).toEqual([all[2].id]);
    expect(byId.connectivity.detail).toContain("1 part has no verified");
    expect(byId["instruction-omissions"].status).toBe("warning");
    expect(byId["instruction-omissions"].occurrenceIds).toHaveLength(3);
    expect(byId["instruction-omissions"].detail).toContain(
      "1 step entry points at parts that no longer exist",
    );
    // Tilted, raw and missing parts are outside the box checks and say so.
    expect(byId.collisions.detail).toContain(
      "1 raw, custom, tilted or unmapped part was not checked",
    );
  });
});

it("reports box checks as unknown when no part could be measured", () => {
  const raw =
    "0 FILE r.ldr\n3 4 0 0 0 20 0 0 0 0 20\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 custom.ldr\n0 FILE custom.ldr\n3 4 0 0 0 10 0 0 0 0 10";
  const report = modelHealth(importLDraw(raw));
  const byId = Object.fromEntries(report.checks.map((c) => [c.id, c]));
  expect(byId.collisions.status).toBe("unknown");
  expect(byId.collisions.detail).toMatch(/^Not checked\./);
  expect(byId.assemblies.status).toBe("unknown");
});
