import { expect, it } from "vitest";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { deriveImportedSteps } from "../../src/ldraw/imported-steps";
import { encodeNative, decodeNative } from "../../src/persistence/native";
import { occurrences } from "../../src/core/document";
const source = `0 FILE main.ldr
0 Original comment
1 4 0 0 0 1 0 0 0 1 0 0 0 1 child.ldr
0 STEP
0 Keep between boundaries
0 ROTSTEP 10 20 30 REL
1 1 100 0 0 1 0 0 0 1 0 0 0 1 child.ldr
0 FILE child.ldr
0 Child source retained
1 16 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 16 40 0 0 1 0 0 0 1 0 0 0 1 3003.dat`;
it("defers editable instruction derivation while preserving source markers and native backup", async () => {
  const limited = importLDraw(source, "main.ldr", {
    limits: { retainedIdCharacters: 1 },
  });
  expect(limited.instructionPlans.imported).toBeUndefined();
  expect(limited.diagnostics).toContainEqual(
    expect.objectContaining({
      code: "INSTRUCTION_DERIVATION_DEFERRED",
      occurrenceIds: [],
    }),
  );
  const normal = importLDraw(source);
  expect(exportLDraw(limited)).toBe(exportLDraw(normal));
  expect(exportLDraw(limited)).toContain("0 ROTSTEP 10 20 30 REL");
  expect(limited.models).toEqual(normal.models);
  const restored = await decodeNative(await encodeNative(limited));
  expect(restored).toEqual(limited);
  const before = JSON.stringify(restored);
  const retried = deriveImportedSteps(restored);
  expect(retried).toEqual({
    status: "derived",
    plan: normal.instructionPlans.imported,
  });
  expect(JSON.stringify(restored)).toBe(before);
});
it("preserves source order, shared leaf occurrences and empty-boundary policy without replacing authored plans", () => {
  const p = importLDraw(source);
  const ids = occurrences(p).map((o) => o.id);
  expect(p.instructionPlans.imported.steps).toEqual([
    ids.slice(0, 2),
    ids.slice(2),
  ]);
  p.instructionPlans.imported = {
    name: "User edited",
    steps: [[ids[3]], [ids[0]]],
  };
  const before = JSON.stringify(p);
  const result = deriveImportedSteps(p);
  expect(result.status).toBe("derived");
  expect(JSON.stringify(p)).toBe(before);
  const noSteps = importLDraw(
    "1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
    "plain.ldr",
    { limits: { leafCount: 0 } },
  );
  expect(deriveImportedSteps(noSteps)).toEqual({ status: "absent" });
  expect(
    noSteps.diagnostics.some(
      (d) => d.code === "INSTRUCTION_DERIVATION_DEFERRED",
    ),
  ).toBe(false);
});
it("keeps source cycle validation when expensive instruction derivation is deferred", () => {
  const cyclic = `0 FILE main.ldr
0 STEP
1 4 0 0 0 1 0 0 0 1 0 0 0 1 custom.dat
0 FILE custom.dat
0 !LDRAW_ORG Unofficial_Part
1 4 0 0 0 1 0 0 0 1 0 0 0 1 custom.dat`;
  expect(() =>
    importLDraw(cyclic, "main.ldr", { limits: { leafCount: 0 } }),
  ).toThrow(/Cyclic/);
});
