import { describe, expect, it } from "vitest";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { rotationY } from "../../src/core/math";
import { describeOrientation, inspectSelection } from "../../src/edit/inspect";
import type { Basis } from "../../src/core/types";

const source = `0 FILE root.ldr
1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat
1 4 100 0 0 0 0 1 0 1 0 -1 0 0 3001.dat
1 1 0 -24 0 1 0 0 0 1 0 0 0 1 3003.dat
1 14 0 0 200 1 0 0 0 1 0 0 0 1 sub.ldr
3 15 0 0 0 20 0 0 0 0 20
1 4 0 0 400 1 0 0 0 1 0 0 0 1 nothere.dat
0 FILE sub.ldr
1 16 0 0 0 1 0 0 0 1 0 0 0 1 3005.dat`;

describe("inspector batch properties", () => {
  const p = importLDraw(source),
    all = occurrences(p);
  const find = (pred: (o: (typeof all)[number]) => boolean) => all.filter(pred);
  it("reports one shared value or mixed, never the first member's value", () => {
    const bricks = find((o) => o.node.ref === "3001.dat");
    const same = inspectSelection(p, bricks);
    expect(same.part).toEqual({
      mixed: false,
      value: { ref: "3001.dat", name: expect.stringMatching(/2 x 4|2 × 4/) },
    });
    expect(same.color).toMatchObject({ mixed: false, value: { code: "4" } });
    expect(same.position[0]).toEqual({ mixed: true });
    expect(same.position[1]).toEqual({ mixed: false, value: 0 });
    expect(same.orientation).toEqual({ mixed: true });
    expect(same.source).toEqual({ mixed: false, value: "official" });
    expect(same.matrix).toBeNull();
    const mixed = inspectSelection(p, [
      ...bricks,
      ...find((o) => o.node.ref === "3003.dat"),
    ]);
    expect(mixed.part).toEqual({ mixed: true });
    expect(mixed.color).toEqual({ mixed: true });
  });
  it("describes source, parent submodel, size and validation", () => {
    const one = inspectSelection(
      p,
      find((o) => o.node.ref === "3001.dat").slice(0, 1),
    );
    expect(one.orientation).toEqual({
      mixed: false,
      value: "Upright, not rotated",
    });
    // 2 × 4 brick (long along LDraw X) including studs: 80 × 28 × 40 LDU.
    expect(one.dimensions).toEqual({
      ldu: [80, 28, 40],
      studs: [4, 2],
      plates: 3.5,
    });
    expect(one.matrix?.basis).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(one.parent).toMatchObject({ mixed: false, value: { root: true } });
    const nested = inspectSelection(
      p,
      find((o) => o.node.ref === "3005.dat"),
    );
    expect(nested.parent).toMatchObject({
      mixed: false,
      value: { name: "sub.ldr", root: false },
    });
    expect(nested.color).toMatchObject({ value: { code: "14" } });
    const raw = inspectSelection(
      p,
      find((o) => o.node.kind === "geometry"),
    );
    expect(raw.source).toEqual({ mixed: false, value: "geometry" });
    expect(raw.dimensions?.ldu).toEqual([20, 0, 20]);
    const missing = inspectSelection(
      p,
      find((o) => o.namespace === "missing"),
    );
    expect(missing.source).toEqual({ mixed: false, value: "missing" });
    expect(missing.dimensions).toBeNull();
    expect(missing.issues[0]).toMatch(/missing/);
  });
  it("names common orientations and flags reflected or sheared placements", () => {
    expect(describeOrientation(rotationY(90))).toBe("Upright, turned 90°");
    expect(describeOrientation(rotationY(270))).toBe("Upright, turned 270°");
    expect(describeOrientation([-1, 0, 0, 0, 1, 0, 0, 0, 1] as Basis)).toBe(
      "Mirrored",
    );
    expect(describeOrientation([4, 0, 0, 0, 1, 0, 0, 0, 1] as Basis)).toMatch(
      /custom matrix/,
    );
    expect(describeOrientation([1, 0, 0, 0, 0, -1, 0, 1, 0] as Basis)).toBe(
      "Tilted rotation",
    );
  });
});
