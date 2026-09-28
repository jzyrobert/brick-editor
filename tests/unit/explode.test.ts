import { describe, expect, it } from "vitest";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { explodeLifts } from "../../src/render/adapter";

describe("exploded view grouping", () => {
  it("lifts top-level submodels bottom-up by rank × gap", () => {
    const p = importLDraw(`0 FILE house.ldr
1 16 0 -48 0 1 0 0 0 1 0 0 0 1 upper.ldr
1 16 0 0 0 1 0 0 0 1 0 0 0 1 ground.ldr
0 FILE ground.ldr
1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat
0 FILE upper.ldr
1 1 0 0 0 1 0 0 0 1 0 0 0 1 3003.dat`);
    const all = occurrences(p);
    const { lifts, groups } = explodeLifts(p, 100);
    expect(groups).toBe(2);
    const upper = all.find((o) => o.node.ref === "3003.dat")!;
    expect(lifts.get(upper.id)).toBe(100);
    for (const o of all.filter((o) => o.node.ref === "3001.dat"))
      expect(lifts.has(o.id)).toBe(false);
  });
  it("falls back to layers, and reports nothing to explode for one group", () => {
    // Two bricks one floor (4 bricks) apart; one brick of height difference is the same floor.
    const flat = importLDraw(
      "0 FILE f.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n1 4 0 -96 0 1 0 0 0 1 0 0 0 1 3001.dat",
    );
    expect(explodeLifts(flat, 50)).toEqual({
      lifts: new Map(),
      groups: 0,
      levels: [],
    });
    const layered = structuredClone(flat);
    const [a, b] = occurrences(layered);
    layered.layers.roof = {
      id: "roof",
      name: "Roof",
      visible: true,
      locked: false,
      order: 1,
    };
    layered.layerAssignments[b.id] = "roof";
    const r = explodeLifts(layered, 50);
    expect(r.groups).toBe(2);
    expect(r.lifts.get(b.id)).toBe(50);
    expect(r.lifts.has(a.id)).toBe(false);
  });
});

it("keeps parts of one floor together and merges levels within a brick", () => {
  const p = importLDraw(`0 FILE house.ldr
1 16 0 0 0 1 0 0 0 1 0 0 0 1 walls0.ldr
1 16 0 -8 0 1 0 0 0 1 0 0 0 1 window0.ldr
1 16 0 -96 0 1 0 0 0 1 0 0 0 1 walls1.ldr
0 FILE walls0.ldr
1 15 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 15 80 0 0 1 0 0 0 1 0 0 0 1 3001.dat
0 FILE window0.ldr
1 1 0 0 0 1 0 0 0 1 0 0 0 1 3004.dat
0 FILE walls1.ldr
1 15 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 15 80 0 0 1 0 0 0 1 0 0 0 1 3001.dat`);
  const all = occurrences(p);
  const { lifts, groups } = explodeLifts(p, 100);
  expect(groups).toBe(2);
  // The window 8 LDU above the ground-floor walls stays with the ground floor.
  const window = all.find((o) => o.node.ref === "3004.dat")!;
  expect(lifts.has(window.id)).toBe(false);
  expect(all.filter((o) => lifts.get(o.id) === 100)).toHaveLength(2);
});
