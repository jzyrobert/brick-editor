import { describe, expect, it } from "vitest";
import {
  computeOcclusion,
  type OcclusionItem,
} from "../../src/render/occlusion";
import type { Vec3 } from "../../src/core/types";

const I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
/** A 1 × N brick (height 24) or plate (8) along X, origin at its top centre. */
function brick(
  id: string,
  position: Vec3,
  options: {
    n?: number;
    height?: number;
    opaque?: boolean;
    basis?: number[];
    box?: boolean;
  } = {},
): OcclusionItem {
  const n = options.n ?? 1,
    height = options.height ?? 24;
  const xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * 20);
  return {
    id,
    basis: options.basis ?? I,
    position,
    opaque: options.opaque ?? true,
    studs: xs.map((x) => ({ p: [x, 0, 0] as Vec3, axis: [0, -1, 0] as Vec3 })),
    antistuds: xs.map((x) => ({
      p: [x, height, 0] as Vec3,
      axis: [0, 1, 0] as Vec3,
    })),
    box:
      options.box === false
        ? null
        : { min: [-10 * n, 0, -10], max: [10 * n, height, 10] },
  };
}

describe("occlusion from connectors and the closed-shell grid", () => {
  it("hides a stud received by an opaque part above, per stud", () => {
    // A 1 × 2 brick with a 1 × 1 brick on its right stud only.
    const { hidden } = computeOcclusion([
      brick("base", [0, 0, 0], { n: 2 }),
      brick("top", [10, -24, 0], { box: false }),
    ]);
    expect(hidden.get("base")).toEqual({
      studs: [1],
      cavity: false,
      enclosed: false,
    });
    expect(hidden.has("top")).toBe(false);
  });
  it("hides nothing next to or inside transparent parts", () => {
    const glassAbove = computeOcclusion([
      brick("base", [0, 0, 0]),
      brick("top", [0, -24, 0], { opaque: false }),
    ]).hidden;
    expect(glassAbove.size).toBe(0);
    const glassBelow = computeOcclusion([
      brick("base", [0, 0, 0], { opaque: false }),
      brick("top", [0, -24, 0]),
    ]).hidden;
    expect(glassBelow.size).toBe(0);
  });
  it("needs coincident lattice points and opposed axes", () => {
    // Half a stud off, and upside down: not received.
    expect(
      computeOcclusion([brick("a", [0, 0, 0]), brick("b", [10, -24, 0])]).hidden
        .size,
    ).toBe(0);
    const flipped = [1, 0, 0, 0, -1, 0, 0, 0, -1];
    expect(
      computeOcclusion([
        brick("a", [0, 0, 0]),
        brick("b", [0, -24, 0], { basis: flipped, box: false }),
      ]).hidden.size,
    ).toBe(0);
    // Rotated a quarter turn about the vertical: still received.
    const quarter = [0, 0, 1, 0, 1, 0, -1, 0, 0];
    expect(
      computeOcclusion([
        brick("a", [0, 0, 0]),
        brick("b", [0, -24, 0], { basis: quarter }),
      ]).hidden.get("a")?.studs,
    ).toEqual([0]);
  });
  it("hides the cavity of a closed-shell part resting on closed-shell parts", () => {
    const { hidden } = computeOcclusion([
      brick("low", [0, 0, 0], { n: 2 }),
      brick("high", [0, -24, 0], { n: 2 }),
    ]);
    expect(hidden.get("high")).toEqual({
      studs: [],
      cavity: true,
      enclosed: false,
    });
    expect(hidden.get("low")!.studs).toEqual([0, 1]);
    // A plate under only half of it leaves the cavity open.
    const half = computeOcclusion([
      brick("low", [-10, 8, 0], { height: 8 }),
      brick("high", [0, -24 + 8 + 8, 0], { n: 2 }),
    ]).hidden;
    expect(half.get("high")?.cavity ?? false).toBe(false);
  });
  it("leaves out parts enclosed on all six faces (Minebench's hidden blocks)", () => {
    // A 3 × 3 × 3 cube of 1 × 1 bricks: only the centre is enclosed.
    const items: OcclusionItem[] = [];
    for (let x = 0; x < 3; x++)
      for (let y = 0; y < 3; y++)
        for (let z = 0; z < 3; z++)
          items.push(brick(`${x}${y}${z}`, [x * 20, -y * 24, z * 20]));
    const { hidden, stats } = computeOcclusion(items);
    expect(stats.enclosed).toBe(1);
    expect(hidden.get("111")!.enclosed).toBe(true);
    // Bottom centre: top covered (studs hidden), bottom open; top centre:
    // bottom covered (cavity hidden), studs open.
    expect(hidden.get("101")).toEqual({
      studs: [0],
      cavity: false,
      enclosed: false,
    });
    expect(hidden.get("121")).toEqual({
      studs: [],
      cavity: true,
      enclosed: false,
    });
    // Take out one side neighbour: the centre is no longer enclosed.
    const open = computeOcclusion(items.filter((i) => i.id !== "011")).hidden;
    expect(open.get("111")!.enclosed).toBe(false);
    // A transparent neighbour does not enclose either.
    const glass = computeOcclusion(
      items.map((i) => (i.id === "211" ? { ...i, opaque: false } : i)),
    ).hidden;
    expect(glass.get("111")!.enclosed).toBe(false);
  });
  it("ignores off-lattice closed-shell parts in the grid", () => {
    const items = [
      brick("a", [0, 0, 0]),
      brick("b", [0, -24, 0]),
      brick("c", [5, -48, 0]),
    ];
    const { stats } = computeOcclusion(items);
    expect(stats.gridded).toBe(2);
  });
  it("handles a 150,000-part wall in a few hundred milliseconds of typed arrays", () => {
    const items: OcclusionItem[] = [];
    for (let i = 0; i < 150_000; i++) {
      const course = Math.floor(i / 500),
        at = i % 500;
      items.push(
        brick(String(i), [at * 40 + (course % 2) * 20, -course * 24, 0], {
          n: 2,
        }),
      );
    }
    const { stats } = computeOcclusion(items);
    expect(stats.items).toBe(150_000);
    // Every course but the top has all its studs covered.
    expect(stats.hiddenStuds).toBeGreaterThan(299_000 - 1000);
    expect(stats.ms).toBeLessThan(10_000);
  });
});
