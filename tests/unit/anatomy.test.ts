import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import {
  ANATOMY,
  ANATOMY_DIRECTIONS,
  anatomyGroups,
  anatomyOffset,
  clearance,
  mirrorPairs,
  planAnatomy,
  planProjectAnatomy,
  projectPartBoxes,
  type AnatomyPlan,
  type Vec3,
} from "../../src/render/anatomy";

type Box = { min: Vec3; max: Vec3 };
const box = (min: Vec3, max: Vec3): Box => ({ min, max });
const parts = (...list: Box[]) =>
  new Float64Array(list.flatMap((b) => [...b.min, ...b.max]));
const group = (key: string, ...list: Box[]) => ({
  key,
  name: key,
  ids: list.map((_, i) => `${key}-${i}`),
  boxes: parts(...list),
});
const other = (...list: Box[]) => {
  const boxes = parts(...list);
  const min = [0, 1, 2].map((k) =>
    Math.min(...list.map((b) => b.min[k])),
  ) as Vec3;
  const max = [0, 1, 2].map((k) =>
    Math.max(...list.map((b) => b.max[k])),
  ) as Vec3;
  return { box: { min, max }, boxes };
};

describe("clearance", () => {
  const g = box([0, -24, 0], [40, 0, 20]);
  it("clears a part in the way plus the gap", () => {
    // A plate across the top (LDraw −Y is up): moving up must pass it.
    const roof = other(box([-20, -32, -10], [60, -24, 30]));
    expect(clearance(g, "up", [roof])).toBe(24 + 8 + ANATOMY.gap);
    // Sideways it is not in the way: only the gap.
    expect(clearance(g, "+x", [roof])).toBe(ANATOMY.gap);
  });
  it("ignores parts behind the group and beside its path", () => {
    const behind = other(box([-100, -24, 0], [-10, 0, 20]));
    const beside = other(box([100, -24, 40], [140, 0, 60]));
    expect(clearance(g, "+x", [behind, beside])).toBe(ANATOMY.gap);
    // The part behind blocks the other way: the group's far side (x = 40)
    // must pass the part's far side (x = −100).
    expect(clearance(g, "-x", [behind])).toBe(140 + ANATOMY.gap);
  });
  it("uses parts, not the other group's bounds", () => {
    // An L of two parts: its bounds cover the path, its parts do not.
    const l = other(
      box([60, -100, 0], [80, -80, 20]),
      box([60, -24, 60], [80, 0, 80]),
    );
    expect(clearance(g, "+x", [l])).toBe(ANATOMY.gap);
  });
  it("counts a moved group where it went", () => {
    const moved = {
      ...other(box([0, -24, 40], [40, 0, 60])),
      offset: [0, 0, -40] as Vec3,
    };
    expect(clearance(g, "+z", [moved])).toBe(20 + ANATOMY.gap);
  });
});

describe("planning", () => {
  // A base plate, a flat lid over a tower on it, and two mirrored side boxes.
  const base = group("base", box([-200, -8, -200], [200, 0, 200]));
  const tower = group("tower", box([-20, -200, -20], [20, -8, 20]));
  const lid = group("lid", box([-100, -208, -100], [100, -200, 100]));
  const left = group("left", box([-160, -48, -20], [-120, -8, 20]));
  const right = group("right", box([120, -48, -20], [160, -8, 20]));
  const plan = planAnatomy("submodels", [tower, left, base, right, lid]);
  const byKey = (p: AnatomyPlan, key: string) =>
    p.groups.find((g) => g.key === key)!;

  it("anchors the base the others rest on", () => {
    expect(byKey(plan, "base").role).toBe("anchor");
    expect(byKey(plan, "base").direction).toBeNull();
    expect(plan.movers).toBe(4);
  });
  it("picks the direction with the least travel", () => {
    // The flat lid lifts off: a short way up, a long way sideways.
    const l = byKey(plan, "lid");
    expect(l.direction).toBe("up");
    expect(l.distance).toBe(2 * ANATOMY.gap + 0.25 * 8);
    // The tall tower slides out sideways (after the lid is off, up would
    // still cost its whole height); nothing blocks it there.
    const t = byKey(plan, "tower");
    expect(["+x", "-x", "+z", "-z"]).toContain(t.direction);
    expect(t.distance).toBeGreaterThanOrEqual(2 * ANATOMY.gap + 0.25 * 40);
    expect(l.delay).toBeLessThan(t.delay);
  });
  it("moves mirrored pairs as mirror images", () => {
    const l = byKey(plan, "left"),
      r = byKey(plan, "right");
    expect(l.mirror).toBe("right");
    expect(r.mirror).toBe("left");
    expect([l.direction, r.direction]).toEqual(["-x", "+x"]);
    expect(l.distance).toBe(r.distance);
    expect(l.delay).toBe(r.delay);
  });
  it("detects mirror pairs only for matching inventories", () => {
    const odd = group(
      "odd",
      box([120, -48, -20], [140, -8, 20]),
      box([140, -48, -20], [160, -8, 20]),
    );
    const groups = [left, odd].map((g) => ({
      ...other(...boxesOf(g.boxes)),
      boxes: g.boxes,
    }));
    const model = box([-200, -200, -200], [200, 0, 200]);
    expect(mirrorPairs(groups, [0, 1], model)).toEqual([]);
    const pair = [left, right].map((g) => ({
      ...other(...boxesOf(g.boxes)),
      boxes: g.boxes,
    }));
    expect(mirrorPairs(pair, [0, 1], model)).toEqual([{ a: 0, b: 1, axis: 0 }]);
  });
  it("staggers departures and eases offsets", () => {
    const movers = plan.groups.filter((g) => g.role === "mover");
    for (const g of movers) {
      expect(g.delay).toBeGreaterThanOrEqual(0);
      expect(g.delay).toBeLessThanOrEqual(ANATOMY.stagger);
      expect(anatomyOffset(g, 0, 1)).toEqual([0, 0, 0]);
      const end = anatomyOffset(g, 1, 2);
      const d = ANATOMY_DIRECTIONS[g.direction!];
      expect(end).toEqual(d.map((v) => v * g.distance * 2 + 0));
    }
    expect(new Set(movers.map((g) => g.delay)).size).toBe(3);
    const t = byKey(plan, "lid");
    // Halfway through its own window it is halfway out.
    const mid = t.delay + (1 - ANATOMY.stagger) / 2;
    expect(-anatomyOffset(t, mid, 1)[1]).toBeCloseTo(t.distance / 2, 6);
  });
  it("keeps groups taken out earlier further out", () => {
    // Two stacked blocks walled in on every side: both leave upwards.
    const walls = group(
      "walls",
      box([-200, -400, -200], [200, 0, -40]),
      box([-200, -400, 40], [200, 0, 200]),
      box([-200, -400, -40], [-40, 0, 40]),
      box([40, -400, -40], [200, 0, 40]),
      box([-200, -8, -200], [200, 0, 200]),
      box([-200, -8, -200], [200, 0, 200]),
    );
    const low = group("low", box([-20, -48, -20], [20, -8, 20]));
    const high = group("high", box([-20, -88, -20], [20, -48, 20]));
    const p = planAnatomy("submodels", [walls, low, high]);
    const h = byKey(p, "high"),
      l = byKey(p, "low");
    expect([h.direction, l.direction]).toEqual(["up", "up"]);
    // High leaves first; low follows its minimum travel.
    expect(h.delay).toBeLessThan(l.delay);
    expect(l.distance).toBe(2 * ANATOMY.gap + 0.25 * 40);
    // High was pushed on to stay above low, the gap between them.
    expect(h.distance).toBe(l.distance + ANATOMY.gap);
  });
});

function boxesOf(b: Float64Array): Box[] {
  const out: Box[] = [];
  for (let o = 0; o < b.length; o += 6)
    out.push(box([b[o], b[o + 1], b[o + 2]], [b[o + 3], b[o + 4], b[o + 5]]));
  return out;
}

describe("sample models", () => {
  const load = (name: string) => {
    const p = importLDraw(
      readFileSync(`fixtures/ldraw/templates/${name}.mpd`, "utf8"),
    );
    return { p, all: occurrences(p) };
  };
  it("takes the jeep apart by submodel with mirrored wheels", () => {
    const { p, all } = load("off-road-jeep");
    const plan = planProjectAnatomy(p, all)!;
    expect(plan.basis).toBe("submodels");
    expect(plan.groups).toHaveLength(8);
    expect(plan.groups.find((g) => g.role === "anchor")!.name).toBe(
      "jeep-chassis",
    );
    const wheels = plan.groups.filter((g) => g.name.includes("wheel"));
    expect(wheels.every((g) => g.mirror)).toBe(true);
    for (const w of wheels) {
      const m = plan.groups.find((g) => g.key === w.mirror)!;
      expect(m.distance).toBe(w.distance);
      expect(m.name.replace("left", "right")).not.toBe(
        w.name.replace("left", "right") + "x",
      );
    }
    // Left/right partners: the left and right wheel of one axle.
    const lf = wheels.find((g) => g.name === "jeep-wheel-left-front")!;
    expect(plan.groups.find((g) => g.key === lf.mirror)!.name).toBe(
      "jeep-wheel-right-front",
    );
  });
  for (const name of [
    "off-road-jeep",
    "railway-station",
    "corner-cafe",
    "house-with-garden",
    "lighthouse",
    "playground-park",
    "roadster",
    "small-castle",
    "windmill-farm",
  ])
    it(`${name}: every moved group clears the parts that stay`, () => {
      const { p, all } = load(name);
      const plan = planProjectAnatomy(p, all)!;
      expect(plan.movers).toBeGreaterThanOrEqual(2);
      const boxes = projectPartBoxes(p, all);
      const index = new Map(all.map((o, i) => [o.id, i]));
      const found = anatomyGroups(p, all)!;
      const staying = new Set(
        plan.groups.filter((g) => g.role !== "mover").map((g) => g.key),
      );
      const fixed: number[] = [];
      for (const g of found.groups)
        if (staying.has(g.key))
          for (const id of g.ids) fixed.push(index.get(id)!);
      for (const g of plan.groups) {
        if (g.role !== "mover") continue;
        const d = ANATOMY_DIRECTIONS[g.direction!];
        const min = g.box.min.map((v, k) => v + d[k] * g.distance),
          max = g.box.max.map((v, k) => v + d[k] * g.distance);
        for (const i of fixed) {
          const o = i * 6;
          const hit = [0, 1, 2].every(
            (k) =>
              boxes[o + k] < max[k] - 0.01 && boxes[o + 3 + k] > min[k] + 0.01,
          );
          expect(hit, `${g.name} lands in a part`).toBe(false);
        }
      }
    });
});

describe("grouping", () => {
  it("descends through a root that wraps one submodel", () => {
    const p = importLDraw(`0 FILE wrap.ldr
1 16 0 0 0 1 0 0 0 1 0 0 0 1 main.ldr
0 FILE main.ldr
1 16 0 0 0 1 0 0 0 1 0 0 0 1 a.ldr
1 16 100 0 0 1 0 0 0 1 0 0 0 1 b.ldr
0 FILE a.ldr
1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
0 FILE b.ldr
1 1 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat`);
    const found = anatomyGroups(p, occurrences(p))!;
    expect(found.basis).toBe("submodels");
    expect(found.groups.map((g) => g.name).sort()).toEqual(["a", "b"]);
  });
  it("falls back to layers, then touching clusters, else nothing", () => {
    const flat = importLDraw(
      "0 FILE f.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat\n1 1 300 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
    );
    const all = occurrences(flat);
    const boxes = projectPartBoxes(flat, all);
    const boxOf = (_: unknown, i: number) => boxes.subarray(i * 6, i * 6 + 6);
    const clusters = anatomyGroups(flat, all, boxOf)!;
    expect(clusters.basis).toBe("clusters");
    expect(clusters.groups.map((g) => g.ids.length)).toEqual([2, 1]);
    const layered = structuredClone(flat);
    layered.layers.roof = {
      id: "roof",
      name: "Roof",
      visible: true,
      locked: false,
      order: 1,
    };
    layered.layerAssignments[all[1].id] = "roof";
    const byLayer = anatomyGroups(layered, occurrences(layered), boxOf)!;
    expect(byLayer.basis).toBe("layers");
    expect(byLayer.groups.map((g) => g.name).sort()).toContain("Roof");
    const one = importLDraw(
      "0 FILE f.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat",
    );
    const oneAll = occurrences(one);
    const oneBoxes = projectPartBoxes(one, oneAll);
    expect(
      anatomyGroups(one, oneAll, (_, i) => oneBoxes.subarray(i * 6, i * 6 + 6)),
    ).toBeNull();
  });
});
