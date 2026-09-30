import { expect, it } from "vitest";
import { importLDraw } from "../../src/ldraw/io";
import { pointsBounds } from "../../src/core/spatial";
import { detectFloors } from "../../src/edit/floors";
import type { Vec3 } from "../../src/core/types";

// Spreading more than ~120,000 arguments (Math.max(...list), push(...list))
// overflows the stack; the occurrence limits are now 200,000 / 150,000.

it("bounds 200,000 points without spreading them into a call", () => {
  const points = Array.from(
    { length: 200000 },
    (_, i) => [i, -1 - i, i % 7] as Vec3,
  );
  expect(pointsBounds(points)).toEqual({
    min: [0, -200000, 0],
    max: [199999, -1, 6],
  });
});

it("detects floors of a model above 120,000 parts", () => {
  const row = Array.from(
    { length: 1000 },
    (_, i) => `1 4 ${i * 20} 0 0 1 0 0 0 1 0 0 0 1 3005.dat`,
  ).join("\n");
  const text =
    "0 FILE root.ldr\n" +
    Array.from(
      { length: 130 },
      (_, i) => `1 16 0 0 ${i * 20} 1 0 0 0 1 0 0 0 1 row.ldr`,
    ).join("\n") +
    "\n0 FILE row.ldr\n" +
    row;
  const floors = detectFloors(importLDraw(text));
  expect(floors.length).toBeGreaterThan(0);
  expect(floors[0].name).toBe("Ground floor");
}, 60000);
