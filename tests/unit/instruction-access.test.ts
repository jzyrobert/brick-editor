import { expect, it } from "vitest";
import {
  enclosurePrecedence,
  type AccessItem,
} from "../../src/instructions/access";
import { generateInstructions } from "../../src/instructions/generate";
import { template } from "../../src/catalog/templates";
import { encodeNative, decodeNative } from "../../src/persistence/native";
const item = (
  index: number,
  y: number,
  parent: string,
  eligible = true,
): AccessItem => ({
  index,
  box: { min: [0, y, 0], max: [20, y + 8, 20] },
  parent,
  eligible,
  requires: new Set(),
});
it("finishes an interior support chain before an overhead section", () => {
  const inputs = [
    item(0, 0, "stairs"),
    item(1, -8, "stairs"),
    item(2, -80, "roof"),
  ];
  inputs[1].requires.add(0);
  const { edges, conflicts } = enclosurePrecedence(inputs);
  expect([...edges[2]]).toEqual([0, 1]);
  expect(edges[1].size).toBe(0); // a course in the same section is not a closure
  expect(conflicts.size).toBe(0);
});
it("retains support prerequisites when top approach would create a cycle", () => {
  const inputs = [item(0, 0, "inside"), item(1, -80, "ceiling")];
  inputs[0].requires.add(1);
  const result = enclosurePrecedence(inputs);
  expect(result.edges[1].size).toBe(0);
  expect([...result.conflicts]).toEqual([0]);
  expect([...inputs[0].requires]).toEqual([1]);
});
it("leaves unsupported approaches and an open shaft unconstrained", () => {
  const inputs = [item(0, 0, "inside", false), item(1, -80, "roof")];
  expect(enclosurePrecedence(inputs).edges[1].size).toBe(0);
  inputs[0].eligible = true;
  inputs[1].box = { min: [40, -80, 0], max: [60, -72, 20] };
  expect(enclosurePrecedence(inputs).edges[1].size).toBe(0);
});
it("bounds work for an extreme known footprint", () => {
  const inputs = [item(0, 0, "inside")];
  inputs[0].box = { min: [-1e9, 0, -1e9], max: [1e9, 8, 1e9] };
  expect(enclosurePrecedence(inputs).exhausted).toBe(true);
});
it("moves actual cafe stair supports and caps before the upper-room ceiling", () => {
  const p = template("cafe"),
    before = JSON.stringify(p.models),
    { plan, report } = generateInstructions(p);
  const at = (path: string[]) =>
    plan.steps.findIndex((s) => s.includes(JSON.stringify(path)));
  const ceiling = at(["n12", "n352"]);
  for (const n of [214, 224, 225])
    expect(at(["n10", "n" + n])).toBeLessThan(ceiling);
  expect(at(["n10", "n214"])).toBeLessThan(at(["n10", "n224"]));
  expect(at(["n10", "n224"])).toBeLessThan(at(["n10", "n225"]));
  expect(report.enclosureConstraints).toBeGreaterThan(0);
  expect(JSON.stringify(p.models)).toBe(before);
});
it("keeps older generation reports readable without new access counters", async () => {
  const p = template("car"),
    plan = generateInstructions(p).plan;
  plan.generation!.algorithm = "connected-bottom-up-v5";
  delete plan.generation!.enclosureConstraints;
  delete plan.generation!.accessConflicts;
  delete plan.generation!.axialOperations;
  delete plan.generation!.axialMatchedBushes;
  delete plan.generation!.axialUnmatched;
  delete plan.generation!.axialConflicts;
  p.instructionPlans.legacy = plan;
  const recovered = await decodeNative(await encodeNative(p));
  // Native documents serialize JSON: optional undefined fields disappear and
  // signed zero is serialized as zero (not a loss of a camera/receiver pose).
  expect(recovered.instructionPlans.legacy).toEqual(
    JSON.parse(JSON.stringify(plan)),
  );
});
it("orders an overhanging stud receiver by its actual contact, not nearly equal centres", async () => {
  const { registerFullLibraryFromDisk } = await import(
    "../../scripts/full-library-node"
  );
  registerFullLibraryFromDisk();
  const { importLDraw } = await import("../../src/ldraw/io");
  const { occurrences } = await import("../../src/core/document");
  const p = importLDraw(
      "1 0 0 -8 -10 1 0 0 0 1 0 0 0 1 3070b.dat\n1 0 0 0 0 0 0 -1 0 1 0 1 0 0 11458.dat",
    ),
    { plan } = generateInstructions(p);
  const rows = occurrences(p);
  const at = (ref: string) =>
    plan.steps.findIndex((s) =>
      s.includes(rows.find((o) => o.node.ref === ref)!.id),
    );
  expect(at("11458.dat")).toBeLessThan(at("3070b.dat"));
});
it("separates a hinged leaf from its receiving frame and a held lateral pair", async () => {
  const { importLDraw } = await import("../../src/ldraw/io");
  const { occurrences } = await import("../../src/core/document");
  const p = importLDraw(
    "1 4 15 -160 -308 0 0 1 0 1 0 -1 0 0 60623.dat\n1 4 10 -160 -340 0 0 1 0 1 0 -1 0 0 60596.dat",
  );
  const { plan } = generateInstructions(p),
    rows = occurrences(p),
    at = (ref: string) =>
      plan.steps.findIndex((s) =>
        s.includes(rows.find((o) => o.node.ref === ref)!.id),
      );
  expect(at("60596.dat")).toBeLessThan(at("60623.dat"));
  const q = importLDraw(
    "1 4 -112 -38 -450 0 -1 0 0 0 -1 1 0 0 3062b.dat\n1 4 -104 -38 -450 0 -1 0 0 0 -1 1 0 0 6141.dat",
  );
  expect(generateInstructions(q).plan.steps.map((s) => s.length)).toEqual([
    1, 1,
  ]);
});
it("does not mistake a tall thin leaf for an overhead cover", () => {
  const inputs = [item(0, 0, "furniture"), item(1, -100, "door")];
  inputs[1].box = { min: [0, -100, 0], max: [20, 0, 5] };
  expect(enclosurePrecedence(inputs).edges[1].size).toBe(0);
});
it("keeps the actual house door after its frame and before roof closure", () => {
  const { plan } = generateInstructions(template("house"));
  const at = (path: string[]) =>
    plan.steps.findIndex((s) => s.includes(JSON.stringify(path)));
  const door = at(["n8", "n151"]);
  expect(at(["n8", "n150"])).toBeLessThan(door);
  expect(door).toBeLessThan(
    plan.stepMetadata!.findIndex((m) => m.assembly?.type === "join"),
  );
});
