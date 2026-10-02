import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { registerInstructionGeometryFromDisk } from "../../scripts/instruction-geometry-node";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { occurrences, validateDocument } from "../../src/core/document";
import {
  mechanismProfiles,
  MECHANISM_SOURCE_SHA256,
} from "../../src/instructions/mechanism-procedures";
import { sourcePrecedence } from "../../src/instructions/source-procedures";
import { generateInstructions } from "../../src/instructions/generate";
import { createInsertionEngine } from "../../src/instructions/collision";
import {
  instructionDisplayStates,
  instructionReceivingIds,
  instructionAlternateIds,
  validateInstructionProgramme,
} from "../../src/instructions/programme";
import { encodeNative, decodeNative } from "../../src/persistence/native";
import {
  captureInstructionIllustration,
  illustrationHtml,
} from "../../src/instructions/illustrate";
import {
  prepareInstructionPlan,
  publishInstructions,
} from "../../src/instructions/publish";
registerFullLibraryFromDisk();
const row = (ref: string, x = 0, y = 0, z = 0, basis = "1 0 0 0 1 0 0 0 1") =>
  `1 16 ${x} ${y} ${z} ${basis} ${ref}`;
const source = (rows: string[], transform = "0 0 0 1 0 0 0 1 0 0 0 1") =>
  importLDraw(
    [
      "0 FILE root.ldr",
      `1 16 ${transform} section.ldr`,
      "0 FILE section.ldr",
      ...rows,
    ].join("\n"),
  );
const hinge = () => [
  row("3315.dat", 0, -118, 130),
  row("3597.dat", 0, -118, 50, "1 0 0 0 -1 0 0 0 -1"),
];
const joint = () => [
  row("2350ap01.dat", 0, -150, 10),
  row("3673.dat", 20, -140, 150),
  row("3673.dat", -20, -140, 150),
  row("3700.dat", 30, -150, 150, "0 0 1 0 1 0 -1 0 0"),
  row("3700.dat", -30, -150, 150, "0 0 1 0 1 0 -1 0 0"),
];
it("binds finite hinges, bores and pin shoulders to the actual pinned primitive closure", () => {
  const sources = fullLibrarySources(Object.keys(MECHANISM_SOURCE_SHA256));
  for (const [ref, sha] of Object.entries(MECHANISM_SOURCE_SHA256))
    expect(createHash("sha256").update(sources[ref]).digest("hex"), ref).toBe(
      sha,
    );
  const p = source(joint());
  expect(mechanismProfiles(p, occurrences(p)).groups).toHaveLength(1);
  p.library.full!.manifestSha256 = "changed";
  expect(mechanismProfiles(p, occurrences(p)).groups).toHaveLength(0);
});
it("uses actual hinge outer-cylinder surfaces instead of the empty central gap", () => {
  const p = source(hinge()),
    all = occurrences(p),
    group = mechanismProfiles(p, all).groups[0];
  expect(group.edges).toEqual([[all[1].id, all[0].id]]);
  const op = group.operations.get(all[1].id)!;
  expect(op.feature).toEqual([0, -114, 74]);
  expect(op.landmarks!.map((p) => p.position)).toEqual([
    [-18, -118, 74],
    [18, -118, 74],
  ]);
  expect(op.detailIds).toEqual([all[0].id]);
});
it("requires the complete finite two-sided arm joint, signed source axes and unique recipients", () => {
  for (const rows of [
    joint().slice(0, -1),
    [...joint(), joint()[1]],
    [...joint(), joint()[3]],
    [...joint(), joint()[0]],
    [
      ...joint().slice(0, 3),
      row("3700.dat", 30, -150, 151, "0 0 1 0 1 0 -1 0 0"),
      joint()[4],
    ],
    [
      joint()[0],
      row("3673.dat", 20, -140, 150, "-1 0 0 0 1 0 0 0 -1"),
      ...joint().slice(2),
    ],
  ]) {
    const p = source(rows);
    expect(mechanismProfiles(p, occurrences(p)).groups).toHaveLength(0);
  }
  for (const rows of [
    [hinge()[0], row("3597.dat", 0, -118, 51, "1 0 0 0 -1 0 0 0 -1")],
    [hinge()[0], row("3597.dat", 0, -110, 98)],
    [...hinge(), hinge()[0]],
    [...hinge(), hinge()[1]],
  ]) {
    const p = source(rows);
    expect(mechanismProfiles(p, occurrences(p)).groups).toHaveLength(0);
  }
  const p = source(joint()),
    all = occurrences(p);
  all[0].namespace = "project";
  expect(mechanismProfiles(p, all).groups).toHaveLength(0);
});
it("preserves the finite associations under rigid world rotations and rejects an incomplete uniqueness scan", () => {
  for (const transform of [
    "100 200 300 0 0 1 0 1 0 -1 0 0",
    "100 200 300 1 0 0 0 0 -1 0 1 0",
  ]) {
    const p = source([...hinge(), ...joint()], transform),
      result = mechanismProfiles(p, occurrences(p));
    expect(result.groups).toHaveLength(2);
  }
  const p = source([...hinge(), ...joint()]);
  expect(mechanismProfiles(p, occurrences(p), 1)).toEqual({
    groups: [],
    exhausted: true,
  });
  for (const transform of [
    "0 0 0 -1 0 0 0 1 0 0 0 1",
    "0 0 0 1.02 0 0 0 1 0 0 0 1",
  ]) {
    const p = source(joint(), transform);
    expect(mechanismProfiles(p, occurrences(p)).groups).toHaveLength(0);
  }
});
it("rejects an acyclic leaf order whose held joint would contract an outside prerequisite cycle", () => {
  const item = (index: number, required: number[]) => ({
    index,
    ids: [String(index)],
    box: null,
    broad: false,
    supports: new Set(required),
    hosts: new Set<number>(),
    access: new Set<number>(),
    adjacent: new Set<number>(),
  });
  const items = [item(0, []), item(1, [0]), item(2, [1])];
  const group = {
    edges: [] as [string, string][],
    operations: new Map([
      ["0", {}],
      ["2", {}],
    ]),
    workbench: { ids: ["0", "2"] },
  };
  const result = sourcePrecedence([group], items);
  expect(result.conflicts).toBe(1);
  expect(result.groups).toEqual([]);
  expect([...items[2].supports]).toEqual([1]);
});
it("keeps pin lip/collar CAD crossings instead of exempting the receiving parts", () => {
  const p = source(joint()),
    all = occurrences(p);
  registerInstructionGeometryFromDisk(p);
  const engine = createInsertionEngine(p, all);
  engine.beginReplay();
  try {
    const old = engine.check(
      [all[1].id],
      [all[0].id, all[3].id],
      [[1, 0, 0]],
    )[0];
    expect(old.status).toBe("blocked");
    expect(old.blockers).toContain(all[3].id);
    const staged = engine.check([all[1].id], [all[0].id], [[1, 0, 0]])[0];
    expect(staged.status).toBe("blocked");
    expect(staged.blockers).toContain(all[0].id);
    expect(engine.stats().exhausted).toBe(false);
  } finally {
    engine.dispose();
  }
});
it("gives Crane actual held pin stages and a separate mount with every original source support prior", async () => {
  const p = importLDraw(
      await readFile("fixtures/instructions/omr/6361-1.mpd", "utf8"),
    ),
    original = exportLDraw(p),
    all = occurrences(p);
  registerInstructionGeometryFromDisk(p);
  const plan = generateInstructions(p).plan,
    states = instructionDisplayStates(plan),
    id = (n: number) => all.find((o) => o.path.at(-1) === "n" + n)!.id;
  const joint = Object.entries(plan.modules!).find(
    ([, m]) => m.purpose === "joint",
  )!;
  expect(joint).toBeTruthy();
  const [key, module] = joint;
  expect(module.occurrenceIds).toHaveLength(5);
  expect(module.parentModuleId).toBeTruthy();
  for (const [pin, brick] of [
    [247, 249],
    [248, 250],
  ]) {
    const pn = plan.steps.findIndex((s) => s.includes(id(pin))),
      bn = plan.steps.findIndex((s) => s.includes(id(brick)));
    expect(plan.steps[pn]).toEqual([id(pin)]);
    expect(plan.steps[bn]).toEqual([id(brick)]);
    expect(pn).toBeLessThan(bn);
    expect(plan.stepMetadata![pn].assembly).toEqual({
      type: "build",
      moduleId: key,
    });
    expect(instructionAlternateIds(plan, pn)).toEqual([id(244)]);
    expect(instructionAlternateIds(plan, bn)).toEqual([id(244), id(pin)]);
    expect(states[pn].displayIds).not.toContain(id(brick));
    expect(states[bn].displayIds).not.toContain(id(278));
    const target = plan.stepMetadata![bn].targets!.find(
      (t) => t.label === "P",
    )!;
    expect(target.occurrenceId).toBe(id(pin));
    expect(plan.stepMetadata![pn].insertionChecks![0].status).toBe("unknown");
  }
  const hingeStep = plan.steps.findIndex((s) => s.includes(id(241)));
  expect(plan.stepMetadata![hingeStep].camera!.target).toEqual([0, -114, 74]);
  expect(plan.stepMetadata![hingeStep].camera!.position[1]).toBeLessThan(
    plan.stepMetadata![hingeStep].camera!.target[1],
  );
  expect(plan.stepMetadata![hingeStep].completedDetail!.occurrenceIds).toEqual([
    id(240),
    id(241),
  ]);
  const future = structuredClone(plan);
  future.stepMetadata![hingeStep].completedDetail!.occurrenceIds.push(id(244));
  expect(() => validateInstructionProgramme(future)).toThrow(/only available/);
  const mount = plan.stepMetadata!.findIndex(
    (m) => m.assembly?.moduleId === key && m.assembly.type === "join",
  );
  expect(plan.steps[mount]).toEqual([]);
  expect(new Set(module.hostIds)).toEqual(
    new Set([170, 241, 242, 243, 278, 279].map(id)),
  );
  expect(
    module.hostIds!.every((id) =>
      instructionReceivingIds(plan, mount).includes(id),
    ),
  ).toBe(true);
  expect(
    instructionReceivingIds(plan, mount).some((id) =>
      module.occurrenceIds.includes(id),
    ),
  ).toBe(false);
  expect(plan.stepMetadata![mount].insertionChecks![0].status).toBe("blocked");
  expect(plan.stepMetadata![mount].insertionChecks![0].blockerIds).toContain(
    id(245),
  );
  expect(plan.stepMetadata![mount].notes).toContain(
    "estimated source support at the cab",
  );
  expect(new Set(plan.steps.flat()).size).toBe(all.length);
  expect(plan.steps.flat()).toHaveLength(all.length);
  validateInstructionProgramme(plan);
  p.instructionPlans.heuristic = plan;
  validateDocument(p);
  const prepared = prepareInstructionPlan(p, "heuristic");
  const canopy = plan.stepMetadata!.findIndex((m) =>
    m.targets?.some((t) => t.label === "B1" && t.caption?.includes("4213.dat")),
  );
  expect(canopy).toBeGreaterThan(0);
  expect(prepared.steps[canopy].targets!.find((t) => t.label === "B1")).toEqual(
    plan.stepMetadata![canopy].targets!.find((t) => t.label === "B1"),
  );
  expect(exportLDraw(p)).toBe(original);
  const restored = await decodeNative(await encodeNative(p));
  expect(restored.instructionPlans.heuristic).toEqual(
    JSON.parse(JSON.stringify(plan)),
  );
  expect(exportLDraw(restored)).toBe(original);
});

it("renders completed joint members separately from real context and true prior receiver", async () => {
  const p = source(hinge()),
    all = occurrences(p),
    group = mechanismProfiles(p, all).groups[0],
    op = group.operations.get(all[1].id)!;
  p.instructionPlans.test = {
    name: "Detail",
    presentation: "pictorial",
    steps: [[all[0].id], [all[1].id]],
    stepMetadata: [
      {},
      {
        camera: op.camera,
        completedDetail: op.completedDetail,
        alternateCamera: op.camera,
        alternateBeforePlacement: true,
        alternateDetailIds: [all[0].id],
      },
    ],
  };
  const requests: any[] = [];
  const step = prepareInstructionPlan(p, "test").steps[1];
  const image = await captureInstructionIllustration(
    p.revision,
    step,
    {
      setCamera: () => {},
      image: async (request) => {
        requests.push(request);
        return { blob: new Blob([new Uint8Array([1])]) };
      },
    },
    { width: 640, height: 480, dimPrevious: true },
  );
  expect(requests).toHaveLength(3);
  expect(requests[0].visibility.occurrenceIds).toEqual(all.map((o) => o.id));
  expect(requests[1].visibility.occurrenceIds).toEqual([all[0].id]);
  expect(requests[2].visibility.occurrenceIds).toEqual(all.map((o) => o.id));
  expect(requests[2].instructionNewIds).toEqual([all[1].id]);
  expect(illustrationHtml(step, image)).toContain(
    "Completed joint detail; surrounding model omitted, fit and access unverified",
  );
});
it("counts the completed-detail image against the full publication pixel budget before rendering", async () => {
  const p = source(
      Array.from({ length: 16 }, (_, n) => row("3001.dat", n * 80)),
    ),
    all = occurrences(p);
  p.instructionPlans.test = {
    name: "Boundary",
    presentation: "pictorial",
    steps: all.map((o) => [o.id]),
    stepMetadata: all.map(() => ({})),
  };
  const camera = {
    space: "ldraw" as const,
    projection: "orthographic" as const,
    target: [0, 0, 0] as [number, number, number],
    position: [100, -100, 100] as [number, number, number],
    up: [0, -1, 0] as [number, number, number],
    span: 100,
    fovDeg: 45,
    near: 0.5,
    far: 500,
  };
  let called = 0;
  const renderer = {
    setCamera: () => {},
    currentCamera: () => camera,
    ready: async () => ({ revision: p.revision }),
    image: async () => {
      called++;
      throw Error("Renderer reached");
    },
  };
  await expect(
    publishInstructions(p, "test", renderer as any, {
      format: "html-zip",
      width: 2000,
      height: 2000,
    }),
  ).rejects.toThrow("Renderer reached");
  expect(called).toBe(1);
  called = 0;
  p.instructionPlans.test.stepMetadata![0].completedDetail = {
    occurrenceIds: [all[0].id],
    camera,
  };
  await expect(
    publishInstructions(p, "test", renderer as any, {
      format: "html-zip",
      width: 2000,
      height: 2000,
    }),
  ).rejects.toThrow(/64 megapixels/);
  expect(called).toBe(0);
});
