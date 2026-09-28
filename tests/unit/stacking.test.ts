import { describe, expect, it } from "vitest";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { defaultWorkplane, placementOnPlane } from "../../src/edit/workplane";
import { occurrenceBox, stackingTarget } from "../../src/edit/stacking";
import { catalog } from "../../src/catalog/catalog";
import { transformBounds } from "../../src/core/spatial";
import type { Vec3 } from "../../src/core/types";

const brick = { width: 80, depth: 40, angle: 0 };

describe("stacking placement", () => {
  const p = importLDraw("0 FILE s.ldr\n1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat");
  const [o] = occurrences(p);
  const box = occurrenceBox(p, o)!;
  const wp = defaultWorkplane();
  it("taps on a top face (even on a stud) stack the new brick on the body top", () => {
    for (const y of [-24, -28]) {
      const t = stackingTarget(
        wp,
        { point: [10, y, 5], normal: [0, -1, 0] },
        box,
        true,
        brick,
      )!;
      const placed = placementOnPlane(t.point, t.plane, 24, 0);
      // The existing brick spans y −24…0; the new one sits on it at −48…−24.
      expect(placed.position[1]).toBe(-48);
      expect(placed.position[0]).toBe(20);
    }
  });
  it("taps on a side face put the new brick flush beside it at the same level", () => {
    const right = stackingTarget(
      wp,
      { point: [40, -12, 3], normal: [1, 0, 0] },
      box,
      true,
      brick,
    )!;
    const placed = placementOnPlane(right.point, right.plane, 24, 0);
    expect(placed.position).toEqual([80, -24, 0]);
    const front = stackingTarget(
      wp,
      { point: [0, -12, -20], normal: [0, 0, -1] },
      box,
      true,
      brick,
    )!;
    expect(placementOnPlane(front.point, front.plane, 24, 0).position).toEqual([
      0, -24, -40,
    ]);
    // A new brick turned 90° is 40 deep along x.
    const turned = stackingTarget(
      wp,
      { point: [40, -12, 3], normal: [1, 0, 0] },
      box,
      true,
      { ...brick, angle: 90 },
    )!;
    expect(
      placementOnPlane(turned.point, turned.plane, 24, 90).position[0],
    ).toBe(60);
  });
  it("places an off-centre part (a slope) flush using its real box", () => {
    const slope = catalog["3040b.dat"];
    const spec = {
      width: slope.width,
      depth: slope.depth,
      angle: 0,
      bounds: slope.bounds,
    };
    // In front of the brick: the slope's box runs z −30…10 about its origin.
    const front = stackingTarget(
      wp,
      { point: [0, -12, -20], normal: [0, 0, -1] },
      box,
      true,
      spec,
    )!;
    const placed = placementOnPlane(
      front.point,
      front.plane,
      slope.height,
      0,
      slope.align,
    );
    expect(placed.position).toEqual([10, -24, -30]);
    const slopeBox = transformBounds(
      { min: slope.bounds.min as Vec3, max: slope.bounds.max as Vec3 },
      placed,
    );
    expect(slopeBox.max[2]).toBe(-20); // touches the brick's front face
    expect(slopeBox.max[1]).toBe(0); // rests on the same level
    // Stacking on a tile ignores studs: tiles are flat.
    expect(catalog["3070b.dat"].studded).toBe(false);
  });
  it("hangs a part under a tapped bottom face, its body top on the part's base", () => {
    const t = stackingTarget(
      wp,
      { point: [10, 0, 5], normal: [0, 1, 0] },
      box,
      true,
      { ...brick, height: 24 },
    )!;
    const placed = placementOnPlane(t.point, t.plane, 24, 0);
    // The existing brick spans y −24…0; the new one hangs at 0…24.
    expect(placed.position[1]).toBe(0);
  });
  it("falls back to the workplane for undersides without a height and tilted workplanes", () => {
    expect(
      stackingTarget(
        wp,
        { point: [0, 0, 0], normal: [0, 1, 0] },
        box,
        true,
        brick,
      ),
    ).toBeNull();
    expect(
      stackingTarget(
        { ...wp, normal: [1, 0, 0] },
        { point: [0, -24, 0], normal: [0, -1, 0] },
        box,
        true,
        brick,
      ),
    ).toBeNull();
  });
});
