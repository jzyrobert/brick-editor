import * as THREE from "three";
import { describe, expect, it } from "vitest";
import installedBounds from "../../src/catalog/bounds.json";
import { occurrences } from "../../src/core/document";
import { projectBounds, type Bounds } from "../../src/core/spatial";
import type { Basis, Occurrence, Project, Vec3 } from "../../src/core/types";
import { importLDraw } from "../../src/ldraw/io";
import {
  BOX_FLOATS,
  FALLBACK_BOX,
  LoadSkeleton,
  occurrenceSteps,
  planReveal,
  SKELETON_BOX_LIMIT,
  SKELETON_GROW_MS,
  takeRevealable,
} from "../../src/render/load-skeleton";
import { brickCityModel } from "../helpers/brick-city";

const IDENTITY: Basis = [1, 0, 0, 0, 1, 0, 0, 0, 1];
function occurrence(
  id: string,
  position: Vec3,
  ref = "3001.dat",
  basis: Basis = IDENTITY,
): Occurrence {
  return {
    id,
    path: [id],
    node: { id, kind: "part", ref, transform: { position, basis } },
    modelId: "root",
    transform: { position, basis },
    colorCode: "4",
    layerId: "base",
    namespace: "official",
    visible: true,
  } as unknown as Occurrence;
}
const brick: Bounds = { min: [-40, -4, -20], max: [40, 24, 20] };

describe("loading skeleton plan", () => {
  it("reveals from the ground up (largest LDraw y first), then in document order", async () => {
    const all = [
      occurrence("roof", [0, -48, 0]),
      occurrence("ground-a", [0, 0, 0]),
      occurrence("middle", [0, -24, 0]),
      occurrence("ground-b", [100, 0, 0]),
    ];
    const plan = (await planReveal(all, () => brick))!;
    expect([...plan.order].map((i) => all[i].id)).toEqual([
      "ground-a",
      "ground-b",
      "middle",
      "roof",
    ]);
    for (let r = 0; r < all.length; r++)
      expect(plan.rank[plan.order[r]]).toBe(r);
    // Bounds of every box (a hair inside each part).
    expect(plan.min[1]).toBeCloseTo(-48 - 4 + 0.4, 5);
    expect(plan.max[1]).toBeCloseTo(24 - 0.4, 5);
    expect(plan.max[0]).toBeCloseTo(140 - 0.4, 5);
  });

  it("orders by the lowest point of the part, not its origin", async () => {
    // A tall part hanging from a high origin reaches lower than a plate.
    const tall: Bounds = { min: [-10, 0, -10], max: [10, 96, 10] };
    const all = [
      occurrence("plate", [0, 0, 0], "3024.dat"),
      occurrence("column", [40, -80, 0], "tall.dat"),
    ];
    const plan = (await planReveal(all, (o) =>
      o.node.ref === "tall.dat"
        ? tall
        : { min: [-10, 0, -10], max: [10, 8, 10] },
    ))!;
    expect(plan.order[0]).toBe(1);
  });

  it("places each box through the part's placement, with a fallback box", async () => {
    const turned: Basis = [0, 0, 1, 0, 1, 0, -1, 0, 0];
    const all = [
      occurrence("turned", [100, -24, 50], "3001.dat", turned),
      occurrence("unknown", [0, 0, 0], "nothing.dat"),
    ];
    const plan = (await planReveal(all, (o) =>
      o.node.ref === "3001.dat" ? brick : null,
    ))!;
    const box = plan.boxes.subarray(0, BOX_FLOATS);
    // The part's x axis (80 LDU long) now runs along −z.
    const near = (values: Float32Array, expected: number[]) =>
      expected.forEach((v, k) => expect(values[k]).toBeCloseTo(v, 4));
    near(box.subarray(0, 3), [0, 0, -(80 - 0.8)]);
    near(box.subarray(3, 6), [0, 28 - 0.8, 0]);
    near(box.subarray(9, 12), [100, -24 + 10, 50]);
    const fallback = plan.boxes.subarray(BOX_FLOATS, 2 * BOX_FLOATS);
    expect(fallback[0]).toBeCloseTo(20 - 0.8, 5);
    expect(fallback[10]).toBeCloseTo(
      (FALLBACK_BOX.min[1] + FALLBACK_BOX.max[1]) / 2,
      5,
    );
  });

  it("keeps mirrored boxes outward facing", async () => {
    const mirrored: Basis = [-1, 0, 0, 0, 1, 0, 0, 0, 1];
    const plan = (await planReveal(
      [occurrence("m", [0, 0, 0], "3001.dat", mirrored)],
      () => brick,
    ))!;
    const x = plan.boxes.subarray(0, 3),
      y = plan.boxes.subarray(3, 6),
      z = plan.boxes.subarray(6, 9);
    const det =
      x[0] * (y[1] * z[2] - y[2] * z[1]) -
      y[0] * (x[1] * z[2] - x[2] * z[1]) +
      z[0] * (x[1] * y[2] - x[2] * y[1]);
    expect(det).toBeGreaterThan(0);
  });

  it("follows instruction steps before height", async () => {
    const all = [
      occurrence("a", [0, 0, 0]),
      occurrence("b", [0, -24, 0]),
      occurrence("c", [0, 0, 80]),
      occurrence("loose", [0, 0, 160]),
    ];
    const project = {
      instructionPlans: {
        p: { name: "Steps", steps: [["b"], ["c", "a"]] },
      },
    } as unknown as Project;
    const steps = occurrenceSteps(project, all)!;
    expect(Array.from(steps)).toEqual([1, 0, 1, 2]);
    const plan = (await planReveal(all, () => brick, steps))!;
    expect([...plan.order].map((i) => all[i].id)).toEqual([
      "b",
      "a",
      "c",
      "loose",
    ]);
    expect(plan.bySteps).toBe(true);
    // A one-step plan, or one covering almost nothing, orders by height.
    expect(
      occurrenceSteps(
        {
          instructionPlans: { p: { name: "One", steps: [["a", "b"]] } },
        } as unknown as Project,
        all,
      ),
    ).toBeNull();
    expect(
      occurrenceSteps(
        {
          instructionPlans: { p: { name: "Few", steps: [[], ["x"]] } },
        } as unknown as Project,
        all,
      ),
    ).toBeNull();
  });

  it("can be abandoned by its pacing callback", async () => {
    const all = Array.from({ length: 3000 }, (_, i) =>
      occurrence("o" + i, [i, 0, 0]),
    );
    let calls = 0;
    const plan = await planReveal(
      all,
      () => brick,
      null,
      async () => {
        calls++;
        return calls < 2;
      },
    );
    expect(plan).toBeNull();
    expect(calls).toBe(2);
  });

  it("plans a large generated city ground up from the installed bounds", async () => {
    const city = brickCityModel({ parts: 6000 });
    const project = importLDraw(city.text, "city.mpd");
    const all = occurrences(project);
    const sources = projectBounds(
      project,
      installedBounds.bounds as unknown as Record<string, Bounds | null>,
      installedBounds.dependencies.transitive,
    );
    let unknown = 0;
    const started = performance.now();
    const plan = (await planReveal(all, (o) => {
      const b = sources.model(o.node.ref);
      if (!b) unknown++;
      return b;
    }))!;
    const ms = performance.now() - started;
    expect(unknown).toBe(0);
    expect(plan.rank.length).toBe(all.length);
    // Monotone: every box's lowest point is no lower than the previous one's.
    let previous = Infinity;
    for (const i of plan.order) {
      const at = i * BOX_FLOATS;
      const reach =
        Math.abs(plan.boxes[at + 1]) / 2 +
        Math.abs(plan.boxes[at + 4]) / 2 +
        Math.abs(plan.boxes[at + 7]) / 2;
      const bottom = plan.boxes[at + 10] + reach;
      expect(bottom).toBeLessThanOrEqual(previous + 1);
      previous = bottom;
    }
    // The ground: the city's base plates sit on y = 0 (8 LDU thick).
    expect(plan.max[1]).toBeGreaterThan(city.bounds.max[1]);
    expect(plan.max[1]).toBeLessThan(city.bounds.max[1] + 8);
    expect(ms).toBeLessThan(2000);
  });
});

describe("skeleton at the phone ceiling", () => {
  it("draws 150,000 parts as at most 20,000 grid-cell boxes, cheaply", async () => {
    // A 400 × 25 block of 2 × 4 bricks, 15 courses high.
    const all = Array.from({ length: 150_000 }, (_, i) =>
      occurrence("o" + i, [
        (i % 400) * 80,
        -Math.floor(i / 10_000) * 24,
        (Math.floor(i / 400) % 25) * 40,
      ]),
    );
    const started = performance.now();
    const plan = (await planReveal(all, () => brick))!;
    const planned = performance.now();
    const view = new LoadSkeleton(plan, { now: 0, animate: false });
    const built = performance.now();
    console.log(
      `skeleton of 150,000: plan ${Math.round(planned - started)} ms, build ${Math.round(built - planned)} ms, ${view.boxCount} boxes of ${view.cell.toFixed(0)} LDU cells`,
    );
    expect(view.boxCount).toBeLessThanOrEqual(SKELETON_BOX_LIMIT);
    expect(view.boxCount).toBeGreaterThan(SKELETON_BOX_LIMIT / 8);
    expect(view.cell).toBeGreaterThan(0);
    expect(view.mesh.geometry.instanceCount).toBe(view.boxCount);
    // Every cell box contains its parts' boxes: the union of the cells spans
    // the plan's bounds.
    const boxes = (
      view.mesh.geometry.getAttribute(
        "aCentre",
      ) as THREE.InterleavedBufferAttribute
    ).data.array as Float32Array;
    let top = Infinity,
      bottom = -Infinity;
    for (let b = 0; b < view.boxCount; b++) {
      const at = b * BOX_FLOATS;
      top = Math.min(top, boxes[at + 10] - boxes[at + 4] / 2);
      bottom = Math.max(bottom, boxes[at + 10] + boxes[at + 4] / 2);
    }
    expect(top).toBeCloseTo(plan.min[1], 0);
    expect(bottom).toBeCloseTo(plan.max[1], 0);
    // Revealing the lowest five courses hides whole cells only
    // once all their parts are drawn.
    const ranks = view.mesh.geometry.getAttribute("aRank");
    view.reveal(Array.from({ length: 50_000 }, (_, i) => plan.order[i]));
    expect(view.revealed).toBe(50_000);
    let hidden = 0;
    for (let b = 0; b < view.boxCount; b++) if (ranks.getX(b) < 0) hidden++;
    expect(hidden).toBeGreaterThan(0);
    expect(hidden).toBeLessThan(view.boxCount);
    view.reveal(Array.from(plan.order));
    for (let b = 0; b < view.boxCount; b++) expect(ranks.getX(b)).toBe(-1);
    // Generous for a loaded shared VM; about 150–400 ms when quiet.
    expect(built - started).toBeLessThan(4000);
    view.dispose();
  });

  it("keeps one box per part up to the limit", async () => {
    const all = Array.from({ length: 30 }, (_, i) =>
      occurrence("o" + i, [i * 80, 0, 0]),
    );
    const plan = (await planReveal(all, () => brick))!;
    const per = new LoadSkeleton(plan, { now: 0, animate: false });
    expect(per.boxCount).toBe(30);
    expect(per.cell).toBe(0);
    const cells = new LoadSkeleton(plan, { now: 0, animate: false, limit: 10 });
    expect(cells.boxCount).toBeLessThanOrEqual(10);
    expect(cells.cell).toBeGreaterThan(0);
    per.dispose();
    cells.dispose();
  });
});

describe("reveal front", () => {
  it("reveals arrived parts ranked below the number arrived", () => {
    const rank = new Uint32Array([0, 5, 1, 4, 2, 3]);
    const arrived = [0, 1, 2];
    // Three arrived: ranks 0 and 1 are revealed, rank 5 waits.
    expect(takeRevealable(arrived, rank, 3)).toEqual([0, 2]);
    expect(arrived).toEqual([1]);
    arrived.push(3, 4, 5);
    expect(takeRevealable(arrived, rank, 6).sort()).toEqual([1, 3, 4, 5]);
    expect(arrived).toEqual([]);
  });
});

describe("skeleton view", () => {
  it("draws one instanced box per occurrence and hides revealed ones", async () => {
    const all = Array.from({ length: 5 }, (_, i) =>
      occurrence("o" + i, [i * 40, -i * 24, 0]),
    );
    const plan = (await planReveal(all, () => brick))!;
    const view = new LoadSkeleton(plan, { now: 1000, animate: true });
    const geometry = view.mesh.geometry;
    expect(geometry.instanceCount).toBe(5);
    expect(geometry.index!.count).toBe(36);
    expect(view.mesh.frustumCulled).toBe(false);
    // Grows in, then stays.
    expect(view.animating(1000)).toBe(true);
    expect(view.front(1000)).toBe(0);
    expect(view.front(1000 + SKELETON_GROW_MS / 2)).toBeCloseTo(0.55, 5);
    expect(view.animating(1000 + SKELETON_GROW_MS)).toBe(false);
    expect(view.front(1000 + SKELETON_GROW_MS)).toBeGreaterThan(1);
    const ranks = geometry.getAttribute("aRank");
    const ranges = () =>
      (ranks as unknown as { updateRanges: unknown[] }).updateRanges;
    view.reveal([3, 1]);
    // Only the touched span is uploaded.
    expect(ranges()).toEqual([{ start: 1, count: 3 }]);
    view.reveal([3, 4]);
    expect(ranges()).toEqual([{ start: 0, count: 1 }]);
    expect(view.revealed).toBe(3);
    // Instances run top down: occurrence i (rank i here) is slot 4 − i.
    expect(Array.from(ranks.array as Float32Array)).toEqual(
      [-1, -1, 0.4, -1, 0].map(Math.fround),
    );
    // The top box (revealed last) is drawn first.
    const centres = geometry.getAttribute("aCentre");
    expect(centres.getY(0)).toBeCloseTo(-4 * 24 + 10, 4);
    const still = new LoadSkeleton(plan, { now: 0, animate: false });
    expect(still.animating(0)).toBe(false);
    expect(still.front(0)).toBeGreaterThan(1);
    view.dispose();
    still.dispose();
  });
});
