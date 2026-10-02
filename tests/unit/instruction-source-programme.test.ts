import { expect, it } from "vitest";
import type { InstructionPlan } from "../../src/core/types";
import type { SourceGraphItem } from "../../src/instructions/source-procedures";
import {
  sourceGuidedProgramme,
  type SourceProgrammeCandidate,
} from "../../src/instructions/source-programme";
import {
  instructionDisplayStates,
  instructionReceivingIds,
} from "../../src/instructions/programme";

const item = (index: number, ids = [`p${index}`]): SourceGraphItem => ({
  index,
  ids,
  box: { min: [0, 0, 0], max: [20, 8, 20] },
  broad: false,
  supports: new Set(),
  hosts: new Set(),
  access: new Set(),
  adjacent: new Set(),
});
const candidate = (
  id: string,
  members: string[],
  extra: Partial<SourceProgrammeCandidate> = {},
): SourceProgrammeCandidate => ({
  id,
  name: id,
  members,
  sourceOrder: [...members],
  placement: "scene",
  receivers: [],
  buildNotes:
    "Source prior only; support loose pieces, physical fit unverified.",
  joinNotes: "Position this candidate; physical assembly unverified.",
  ...extra,
});
const baseline = (steps: string[][]): InstructionPlan => ({
  name: "Before",
  steps,
});
const at = (p: InstructionPlan, id: string) =>
  p.steps.findIndex((s) => s.includes(id));
const join = (p: InstructionPlan, id: string) =>
  p.stepMetadata!.findIndex(
    (m) => m.assembly?.type === "join" && m.assembly.moduleId === id,
  );

it("prepares a complete parent receiver before the child's foundation and keeps the join separate", () => {
  const items = Array.from({ length: 5 }, (_, n) => item(n)),
    original = baseline([["p4", "p0"], ["p1", "p2"], ["p3"]]),
    candidates = [
      candidate("parent", ["p0", "p1", "p2", "p3"]),
      candidate("jaw", ["p2", "p3"], {
        parentId: "parent",
        placement: "attachment",
        receivers: ["p1"],
      }),
    ],
    { plan, adopted } = sourceGuidedProgramme(original, items, candidates);
  expect(adopted).toBe(2);
  expect(plan.steps).toEqual([["p4"], ["p0"], ["p1"], ["p2"], ["p3"], [], []]);
  expect(plan.steps[join(plan, "jaw")]).toEqual([]);
  expect(instructionReceivingIds(plan, join(plan, "jaw"))).toEqual([
    "p0",
    "p1",
  ]);
  const states = instructionDisplayStates(plan);
  expect(states[at(plan, "p2")].displayIds).toEqual(["p2"]);
  expect(states[join(plan, "jaw")].displayIds).toEqual([
    "p0",
    "p1",
    "p2",
    "p3",
  ]);
  expect(original.steps).toEqual([["p4", "p0"], ["p1", "p2"], ["p3"]]);
});

it("uses a sibling's completed join as receiver availability and resumes later direct parent work", () => {
  const items = Array.from({ length: 4 }, (_, n) => item(n)),
    candidates = [
      candidate("parent", ["p0", "p1", "p2", "p3"]),
      candidate("provider", ["p1"], {
        parentId: "parent",
        placement: "attachment",
        receivers: ["p0"],
      }),
      candidate("consumer", ["p2"], {
        parentId: "parent",
        placement: "attachment",
        receivers: ["p1"],
      }),
    ],
    { plan, adopted } = sourceGuidedProgramme(
      baseline([["p0"], ["p1"], ["p2"], ["p3"]]),
      items,
      candidates,
    );
  expect(adopted).toBe(3);
  expect(join(plan, "provider")).toBeLessThan(join(plan, "consumer"));
  expect(instructionReceivingIds(plan, join(plan, "consumer"))).toEqual([
    "p0",
    "p1",
  ]);
  expect(at(plan, "p3")).toBeGreaterThan(join(plan, "consumer"));
  expect(at(plan, "p3")).toBeLessThan(join(plan, "parent"));
});

it.each(["supports", "hosts", "access"] as const)(
  "retains %s at leaf introduction with real sibling and root availability",
  (field) => {
    const items = Array.from({ length: 5 }, (_, n) => item(n));
    items[2][field].add(1); // Provider must be on the actual parent bench.
    items[4][field].add(2); // Outside use must wait for the entire parent.
    const before = items.map((i) => [...i[field]]),
      candidates = [
        candidate("parent", ["p0", "p1", "p2", "p3"]),
        candidate("provider", ["p1"], {
          parentId: "parent",
          placement: "attachment",
          receivers: ["p0"],
        }),
      ],
      { plan, adopted } = sourceGuidedProgramme(
        baseline(items.map((i) => i.ids)),
        items,
        candidates,
      );
    expect(adopted).toBe(2);
    expect(join(plan, "provider")).toBeLessThan(at(plan, "p2"));
    expect(join(plan, "parent")).toBeLessThan(at(plan, "p4"));
    expect(items.map((i) => [...i[field]])).toEqual(before);
  },
);

it("refuses an otherwise acyclic A -> outside -> B whole-bench contraction", () => {
  const items = Array.from({ length: 3 }, (_, n) => item(n));
  items[1].hosts.add(0);
  items[2].supports.add(1);
  const original = baseline(items.map((i) => i.ids)),
    result = sourceGuidedProgramme(original, items, [
      candidate("bench", ["p0", "p2"]),
    ]);
  expect(result.adopted).toBe(0);
  expect(result.plan).toBe(original);
  expect(result.reason).toMatch(/conflicts/);
});

it("refuses source ordering that contradicts a retained access prerequisite", () => {
  const items = [item(0), item(1)];
  items[0].access.add(1);
  const original = baseline([["p1"], ["p0"]]);
  expect(
    sourceGuidedProgramme(original, items, [candidate("bench", ["p0", "p1"])])
      .plan,
  ).toBe(original);
});

it("refuses overlapping siblings and whole drawing-owner splits atomically", () => {
  const items = [item(0, ["a", "b"]), item(1, ["c"]), item(2, ["d"])],
    original = baseline(items.map((i) => i.ids));
  const split = sourceGuidedProgramme(original, items, [
    candidate("bad", ["a", "c"]),
  ]);
  expect(split.plan).toBe(original);
  expect(split.reason).toMatch(/drawing/);
  const overlap = sourceGuidedProgramme(original, items, [
    candidate("one", ["a", "b", "c"]),
    candidate("two", ["c", "d"]),
  ]);
  expect(overlap.plan).toBe(original);
  expect(overlap.reason).toMatch(/overlap/);
});

it("keeps foreign mixed batches in original order while assigning introductions to their deepest owner", () => {
  const items = Array.from({ length: 5 }, (_, n) => item(n)),
    original = baseline([
      ["p4", "p0", "p3"],
      ["p1", "p2"],
    ]),
    { plan, adopted } = sourceGuidedProgramme(original, items, [
      candidate("parent", ["p0", "p1", "p2"]),
      candidate("child", ["p2"], {
        parentId: "parent",
        placement: "attachment",
        receivers: ["p1"],
      }),
    ]);
  expect(adopted).toBe(2);
  expect(at(plan, "p4")).toBeLessThan(at(plan, "p3"));
  expect(plan.stepMetadata![at(plan, "p2")].assembly).toEqual({
    type: "build",
    moduleId: "child",
  });
  expect(new Set(plan.steps.flat())).toEqual(new Set(original.steps.flat()));
  expect(plan.steps.flat()).toHaveLength(5);
});

it("refuses duplicate or missing source membership, unknown parents, and exhausted searches", () => {
  const items = [item(0), item(1)],
    original = baseline(items.map((i) => i.ids));
  for (const c of [
    candidate("x", ["p0", "p0"]),
    candidate("x", ["missing"]),
    candidate("x", ["p0"], { sourceOrder: [] }),
    candidate("x", ["p0"], {
      parentId: "missing",
      placement: "attachment",
      receivers: ["p1"],
    }),
  ])
    expect(sourceGuidedProgramme(original, items, [c]).plan).toBe(original);
  const result = sourceGuidedProgramme(
    original,
    items,
    [candidate("x", ["p0", "p1"])],
    1,
  );
  expect(result.plan).toBe(original);
  expect(result.reason).toMatch(/budget/);
});

it("keeps an existing typed programme intact until mixed-mode ownership is explicitly supported", () => {
  const original = {
    ...baseline([["p0"], []]),
    modules: {
      wheel: {
        name: "Wheel",
        occurrenceIds: ["p0"],
        feasibility: "unknown" as const,
        purpose: "wheel" as const,
      },
    },
    stepMetadata: [
      { assembly: { type: "build" as const, moduleId: "wheel" } },
      { assembly: { type: "join" as const, moduleId: "wheel" } },
    ],
  };
  const result = sourceGuidedProgramme(
    original,
    [item(0)],
    [candidate("x", ["p0"])],
  );
  expect(result.plan).toBe(original);
  expect(result.reason).toMatch(/existing owned/);
});
