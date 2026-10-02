import { afterEach, expect, it } from "vitest";
import { Triangle, Vector3 } from "three";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import {
  createInsertionEngine,
  sweptTriangleInterval,
} from "../../src/instructions/collision";
import { generateInstructions } from "../../src/instructions/generate";
import { effectiveInsertionChecks } from "../../src/instructions/motion";
import { prepareInstructionPlan } from "../../src/instructions/publish";
import { registerInstructionGeometryFromDisk } from "../../scripts/instruction-geometry-node";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import {
  curatedGeometrySource,
  registerCuratedGeometrySources,
} from "../../src/catalog/geometry-sources";
import { encodeNative, decodeNative } from "../../src/persistence/native";
import { instructionDisplayStates } from "../../src/instructions/programme";
import { editInstructions } from "../../src/instructions/edit";
import type { Vec3 } from "../../src/core/types";
const line = (ref = "3001.dat", p = [0, 0, 0]) =>
  `1 4 ${p.join(" ")} 1 0 0 0 1 0 0 0 1 ${ref}`;
registerFullLibraryFromDisk();
registerInstructionGeometryFromDisk(importLDraw(line()));
const originals = new Map(
  ["3001.dat", "3002.dat"].map((ref) => [ref, curatedGeometrySource(ref)!]),
);
afterEach(() => registerCuratedGeometrySources(originals));
const triangle = (points: number[][]) =>
  new Triangle(
    ...(points.map((p) => new Vector3(...p)) as [Vector3, Vector3, Vector3]),
  );
// Synthetic surfaces are registered ONLY in this isolated test process. They
// exercise the same engine without adding fabricated parts to pinned packs.
const cuboid = (min: Vec3, max: Vec3) => {
  const v = [
    min,
    [max[0], min[1], min[2]],
    [max[0], max[1], min[2]],
    [min[0], max[1], min[2]],
    [min[0], min[1], max[2]],
    [max[0], min[1], max[2]],
    max,
    [min[0], max[1], max[2]],
  ];
  return [
    [0, 1, 2, 3],
    [4, 7, 6, 5],
    [0, 4, 5, 1],
    [3, 2, 6, 7],
    [0, 3, 7, 4],
    [1, 5, 6, 2],
  ]
    .map((f) => `4 16 ${f.flatMap((i) => v[i]).join(" ")}`)
    .join("\n");
};
function synthetic(a: string, b: string, dir: Vec3, limits = {}) {
  registerCuratedGeometrySources(
    new Map([
      ["3001.dat", a],
      ["3002.dat", b],
    ]),
  );
  const p = importLDraw(line() + "\n" + line("3002.dat")),
    all = occurrences(p),
    e = createInsertionEngine(p, all, limits);
  e.beginReplay();
  try {
    return {
      path: e.check([all[0].id], [all[1].id], [dir])[0],
      stats: e.stats(),
    };
  } finally {
    e.dispose();
  }
}
it("finds a thin obstacle between distant endpoint poses continuously", () => {
  const a = triangle([
      [0, 0, 0],
      [0, 2, 0],
      [0, 0, 2],
    ]),
    b = triangle([
      [37, -1, -1],
      [37, 4, -1],
      [37, -1, 4],
    ]);
  const interval = sweptTriangleInterval(a, b, new Vector3(100, 0, 0));
  expect(interval).toBeDefined();
  expect(interval![0]).toBeCloseTo(0.37, 6);
  expect(interval![1]).toBeCloseTo(0.37, 6);
  expect(sweptTriangleInterval(a, b, new Vector3(0, 100, 0))).toBeUndefined();
});
it("uses an external group start and finds the wall of a containing closed body", () => {
  const { path } = synthetic(
    cuboid([-1, -1, -1], [1, 1, 1]),
    cuboid([-50, -50, -50], [50, 50, 50]),
    [1, 0, 0],
  );
  expect(path.status).toBe("blocked");
  expect(path.distance).toBe(52);
  expect(path.blockers).toHaveLength(1);
});
it("preserves a receiving hole rather than replacing the frame with its convex hull", () => {
  const rod = cuboid([-1, -1, -1], [1, 1, 1]);
  const frame = [
    cuboid([-5, -5, -5], [5, -2, 5]),
    cuboid([-5, 2, -5], [5, 5, 5]),
    cuboid([-5, -2, -5], [5, 2, -2]),
    cuboid([-5, -2, 2], [5, 2, 5]),
  ].join("\n");
  expect(synthetic(rod, frame, [1, 0, 0]).path.status).toBe("clear");
  expect(
    synthetic(rod, frame + "\n" + cuboid([3, -2, -2], [4, 2, 2]), [1, 0, 0])
      .path.status,
  ).toBe("blocked");
});
it("treats parallel face grazing as contact rather than transverse penetration", () => {
  expect(
    synthetic(
      cuboid([-1, -1, -1], [1, 1, 1]),
      cuboid([-1, 1, -1], [1, 3, 1]),
      [1, 0, 0],
    ).path.status,
  ).toBe("clear");
  expect(
    synthetic(
      cuboid([-1, -1, -1], [1, 1, 1]),
      cuboid([-1, 0.99, -1], [1, 3, 1]),
      [1, 0, 0],
    ).path.status,
  ).toBe("blocked");
});
it("does not turn missing dependencies, texture alternatives or exhausted work into clear", () => {
  const small = cuboid([-1, -1, -1], [1, 1, 1]),
    wall = cuboid([10, -2, -2], [11, 2, 2]);
  for (const source of [
    wall + "\n" + line("not-a-real-dependency.dat"),
    wall + "\n0 !TEXMAP START PLANAR 0 0 0",
  ])
    expect(synthetic(small, source, [1, 0, 0]).path.status).toBe("unknown");
  expect(
    synthetic(small, wall, [1, 0, 0], { sourceCharacters: 1 }).path.status,
  ).toBe("unknown");
  expect(
    synthetic(small, wall, [1, 0, 0], { broadPhaseQueries: 0 }).path.status,
  ).toBe("unknown");
  const r = synthetic(small, wall, [1, 0, 0], { triangleTests: 1 });
  expect(r.path.status).toBe("unknown");
  expect(r.stats.exhausted).toBe(true);
});
it("keeps out-of-domain world placement unknown without changing source poses", () => {
  const p = importLDraw(line("3001.dat", [2_000_000, 0, 0])),
    before = exportLDraw(p),
    all = occurrences(p),
    engine = createInsertionEngine(p, all);
  expect(engine.check([all[0].id], [], [[0, -1, 0]])[0].status).toBe("unknown");
  expect(exportLDraw(p)).toBe(before);
  engine.dispose();
  registerCuratedGeometrySources(
    new Map([
      ["3001.dat", cuboid([-1, -1, -1], [1, 1, 1])],
      ["3002.dat", cuboid([-1, -1, -1], [1, 1, 1])],
    ]),
  );
  const cubes = importLDraw(line() + "\n" + line("3002.dat")),
    original = occurrences(cubes),
    base = createInsertionEngine(cubes, original);
  base.beginReplay();
  expect(
    base.check([original[0].id], [original[1].id], [[1, 0, 0]])[0].status,
  ).toBe("blocked");
  base.dispose();
  for (const node of cubes.models[cubes.rootModelId].nodes)
    node.transform.position = [1e17, 1e17, 1e17];
  const extreme = occurrences(cubes),
    far = createInsertionEngine(cubes, extreme);
  expect(
    far.check([extreme[0].id], [extreme[1].id], [[1, 0, 0]])[0].status,
  ).toBe("unknown");
  expect(extreme.every((o) => !far.body(o).box)).toBe(true);
  far.dispose();
});
it("allows a real stud seating locally but keeps the receiving part's other walls active", () => {
  const p = importLDraw(line() + "\n" + line("3001.dat", [0, -24, 0])),
    all = occurrences(p),
    e = createInsertionEngine(p, all);
  e.beginReplay();
  expect(e.check([all[1].id], [all[0].id], [[0, -1, 0]])[0].status).toBe(
    "clear",
  );
  e.dispose();
  // Same receiving part now has an overhead wall beyond every local contact
  // region. Blanket exemption of a mating part would incorrectly pass this.
  registerCuratedGeometrySources(
    new Map([
      [
        "3002.dat",
        originals.get("3001.dat")! +
          "\n" +
          cuboid([-40, -60, -20], [40, -59, 20]),
      ],
    ]),
  );
  const q = importLDraw(
      line("3002.dat") + "\n" + line("3001.dat", [0, -24, 0]),
    ),
    b = occurrences(q),
    f = createInsertionEngine(q, b);
  f.beginReplay();
  expect(f.check([b[1].id], [b[0].id], [[0, -1, 0]])[0].status).toBe("blocked");
  f.dispose();
});
it("does not exempt a terminal obstacle outside the local connector region", () => {
  // This thin roof is only 5.5LDU beyond the antistud contact. A final-pose
  // moving triangle can be connector-local while its swept collision is not.
  registerCuratedGeometrySources(
    new Map([
      [
        "3002.dat",
        originals.get("3001.dat")! +
          "\n" +
          cuboid([-40, -30, -20], [40, -29.5, 20]),
      ],
    ]),
  );
  const p = importLDraw(
      line("3002.dat") + "\n" + line("3001.dat", [0, -24, 0]),
    ),
    all = occurrences(p),
    e = createInsertionEngine(p, all);
  e.beginReplay();
  expect(e.check([all[1].id], [all[0].id], [[0, -1, 0]])[0].status).toBe(
    "blocked",
  );
  e.dispose();
});
it("stores finite checked paths, preserves source and invalidates edited geometry or ordering", async () => {
  const p = importLDraw(line() + "\n" + line("3001.dat", [0, -24, 0])),
    before = exportLDraw(p),
    { plan, report } = generateInstructions(p);
  expect(report.insertionClear).toBe(2);
  expect(report.insertionBlocked).toBe(0);
  expect(exportLDraw(p)).toBe(before);
  p.instructionPlans.test = plan;
  expect(
    (await decodeNative(await encodeNative(p))).instructionPlans.test,
  ).toEqual(plan);
  expect(
    prepareInstructionPlan(p, "test").steps.every(
      (s) => s.insertionChecks![0].status === "clear",
    ),
  ).toBe(true);
  const moved = structuredClone(p);
  moved.models[moved.rootModelId].nodes[0].transform.position[0] += 1;
  const stale = effectiveInsertionChecks(moved, plan, plan.stepMetadata![1])!;
  expect(stale[0].status).toBe("unknown");
  expect(stale[0].from).toBeUndefined();
  const reordered = structuredClone(plan);
  reordered.steps.reverse();
  expect(
    effectiveInsertionChecks(p, reordered, reordered.stepMetadata![1])![0]
      .status,
  ).toBe("unknown");
  editInstructions(p, "instructions.step.reorder", {
    planId: "test",
    indices: [1, 0],
  });
  expect(plan.stepMetadata!.every((m) => !m.insertionChecks)).toBe(true);
});
it("checks a completed workbench as one rigid join and excludes future main parts from its build", () => {
  const p = importLDraw(
    "0 FILE root.ldr\n" +
      line("section.ldr") +
      "\n" +
      line("3001.dat", [0, -200, 0]) +
      "\n0 FILE section.ldr\n" +
      [0, -24, -48, -72].map((y) => line("3001.dat", [0, y, 0])).join("\n"),
  );
  const { plan } = generateInstructions(p),
    states = instructionDisplayStates(plan);
  expect(Object.keys(plan.modules ?? {})).toHaveLength(1);
  for (let n = 0; n < plan.steps.length; n++) {
    const m = plan.stepMetadata![n];
    if (m.assembly?.type === "build")
      expect(m.insertionChecks!.every((c) => c.status === "clear")).toBe(true);
    if (m.assembly?.type === "join") {
      expect(m.insertionChecks).toHaveLength(1);
      expect(m.insertionChecks![0].occurrenceIds).toEqual(
        states[n].incomingIds,
      );
    }
  }
});
