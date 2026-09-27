import { expect, it } from "vitest";
import { importLDraw } from "../../src/ldraw/io";
import { queryProject } from "../../src/automation/query";
import { primitiveBounds, projectBounds } from "../../src/core/spatial";
const ref = (name: string, x = 0) => `1 16 ${x} 0 0 1 0 0 0 1 0 0 0 1 ${name}`;
it("bounds diagnostics remain conservative when a physical custom part has one known and one unknown dependency", () => {
  const p = importLDraw(
    `0 FILE root.ldr\n${ref("custom.dat")}\n0 FILE custom.dat\n0 !LDRAW_ORG Unofficial_Part\n3 16 -1 -2 -3 4 5 6 0 0 0\n${ref("absent.dat")}`,
  );
  const q = queryProject(p, {
    spatial: true,
    bounds: {
      min: [-100, -100, -100],
      max: [100, 100, 100],
      mode: "intersects",
    },
  });
  expect(q.count).toBe(0);
  expect(q.spatial!.bounds).toBeNull();
  expect(q.spatial!.complete).toBe(false);
  expect(q.spatial!.unknownBoundsIds).toHaveLength(1);
  expect(projectBounds(p, {}).model("custom.dat")).toBeNull();
});
it("conditional line control handles do not inflate occupied bounds, even with huge finite handles", () => {
  expect(
    primitiveBounds("5 24 -2 -3 -4 5 6 7 1e20 -1e20 1e20 -1e20 1e20 -1e20"),
  ).toEqual({ min: [-2, -3, -4], max: [5, 6, 7] });
});
it("caps repeated unresolved-reference diagnostic output, not merely cached dependency traversal", () => {
  const p = importLDraw(
    [
      "0 FILE root.ldr",
      ...Array.from({ length: 1500 }, () => ref("custom.dat")),
      "0 FILE custom.dat",
      "0 !LDRAW_ORG Unofficial_Part",
      ...Array.from({ length: 1500 }, (_, i) => ref(`missing-${i}.dat`)),
    ].join("\n"),
  );
  expect(() => queryProject(p)).toThrow(/budget|limit/i);
  expect(p.revision).toBe(0);
});
it("recognizes installed library primitives inside a custom physical part without giving it catalogue purchasing identity", () => {
  const p = importLDraw(
    `0 FILE root.ldr\n${ref("custom.dat")}\n0 FILE custom.dat\n0 !LDRAW_ORG Unofficial_Part\n${ref("stud.dat")}`,
  );
  const q = queryProject(p, { spatial: true });
  expect(q.occurrences[0].namespace).toBe("project");
  expect(q.unresolvedReferences).toEqual([]);
  expect(q.spatial!.complete).toBe(true);
  expect(q.spatial!.bounds).not.toBeNull();
});
it("never claims a small complete official box when a custom physical context overrides an official descendant", () => {
  const p = importLDraw(
    `0 FILE root.ldr\n${ref("custom.dat")}\n0 FILE custom.dat\n0 !LDRAW_ORG Unofficial_Part\n${ref("3022.dat")}\n0 FILE stud.dat\n3 16 1000 0 0 1001 0 0 1000 1 0`,
  );
  const q = queryProject(p, { spatial: true });
  // Renderer project scope removes the installed stud definition and uses this local source.
  // A query may explicitly decline the box, but cannot certify the small unmodified plate box.
  expect(!q.spatial!.complete || q.spatial!.bounds!.max[0] >= 1011).toBe(true);
});
it("reports missing dependencies introduced by a project override inside an official child of a custom part", () => {
  const p = importLDraw(
    `0 FILE root.ldr\n${ref("custom.dat")}\n0 FILE custom.dat\n0 !LDRAW_ORG Unofficial_Part\n${ref("3022.dat")}\n0 FILE stud.dat\n${ref("absent.dat")}`,
  );
  const q = queryProject(p);
  expect(q.unresolvedReferences).toEqual([
    { occurrenceId: q.occurrences[0].id, references: ["absent.dat"] },
  ]);
});
