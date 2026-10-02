import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { occurrences, validateDocument } from "../../src/core/document";
import { template } from "../../src/catalog/templates";
import { generateInstructions } from "../../src/instructions/generate";
import { sceneWorkbenches } from "../../src/instructions/scene-workbenches";
import {
  instructionDisplayStates,
  instructionReceivingIds,
} from "../../src/instructions/programme";
import { insertionChecksCurrent } from "../../src/instructions/motion";
import { prepareInstructionPlan } from "../../src/instructions/publish";
import { encodeNative, decodeNative } from "../../src/persistence/native";
import {
  registerFullLibraryFromDisk,
  registerFullCatalogFromDisk,
} from "../../scripts/full-library-node";
import type { InstructionPlan } from "../../src/core/types";
registerFullLibraryFromDisk();
registerFullCatalogFromDisk();

it("generates and persists a nested Roadster with hosted wheel joins before a single scene placement", async () => {
  const p = template("car"),
    before = exportLDraw(p),
    { plan } = generateInstructions(p),
    states = instructionDisplayStates(plan);
  const parent = Object.entries(plan.modules!).find(
    ([, m]) => m.placement === "scene",
  )!;
  expect(parent[1].occurrenceIds).toHaveLength(58);
  expect(
    Object.values(plan.modules!).filter((m) => m.parentModuleId === parent[0]),
  ).toHaveLength(4);
  const end = plan.steps.length - 1;
  expect(plan.stepMetadata![end].assembly).toEqual({
    type: "join",
    moduleId: parent[0],
  });
  expect(plan.steps[end]).toEqual([]);
  expect(instructionReceivingIds(plan, end)).toEqual([]);
  expect(states[end].displayIds).toHaveLength(58);
  expect(plan.stepMetadata![end].targets!.map((t) => t.label)).toEqual(["S"]);
  expect(
    plan.stepMetadata![end].insertionChecks!.every(
      (c) => c.status === "unknown" && !c.from,
    ),
  ).toBe(true);
  for (let n = 0; n < end; n++) {
    const action = plan.stepMetadata![n].assembly!;
    expect(action).toBeDefined();
    if (action.type === "join") {
      const m = plan.modules![action.moduleId];
      expect(m.purpose).toBe("wheel");
      expect(
        m.hostIds!.every((id) => instructionReceivingIds(plan, n).includes(id)),
      ).toBe(true);
    }
  }
  expect(new Set(plan.steps.flat()).size).toBe(58);
  expect(exportLDraw(p)).toBe(before);
  p.instructionPlans.generated = plan;
  validateDocument(p);
  expect(insertionChecksCurrent(p, plan)).toBe(true);
  const prepared = prepareInstructionPlan(p, "generated");
  expect(prepared.inventory.reduce((n, l) => n + l.quantity, 0)).toBe(58);
  expect(prepared.assemblyValidated).toBe(false);
  const restored = await decodeNative(await encodeNative(p));
  // Native JSON normalises signed zero and omitted optional fields.
  expect(restored.instructionPlans.generated).toEqual(
    JSON.parse(JSON.stringify(plan)),
  );
});

it("keeps source-scene props out of the vehicle and preserves the exact official source", async () => {
  const raw = await readFile(
      new URL("../../fixtures/instructions/omr/6350-1.mpd", import.meta.url),
      "utf8",
    ),
    p = importLDraw(raw),
    before = exportLDraw(p),
    { plan } = generateInstructions(p);
  const [key, parent] = Object.entries(plan.modules!).find(
    ([key, m]) =>
      m.placement === "scene" &&
      Object.values(plan.modules!).some(
        (child) => child.purpose === "wheel" && child.parentModuleId === key,
      ),
  )!;
  expect(parent.occurrenceIds).toHaveLength(47);
  const member = new Set(parent.occurrenceIds),
    states = instructionDisplayStates(plan);
  for (let n = 0; n < plan.steps.length; n++) {
    const a = plan.stepMetadata![n].assembly;
    if (
      a?.type === "build" &&
      (a.moduleId === key || plan.modules![a.moduleId].parentModuleId === key)
    )
      expect(states[n].displayIds.every((id) => member.has(id))).toBe(true);
    if (!a)
      expect(states[n].displayIds.some((id) => member.has(id))).toBe(
        n >
          plan.stepMetadata!.findIndex(
            (m) => m.assembly?.type === "join" && m.assembly.moduleId === key,
          ),
      );
  }
  expect(exportLDraw(p)).toBe(before);
  expect(new Set(plan.steps.flat()).size).toBe(166);
});

// Adversarial source batches and DAG contexts, independent of catalogue coverage.
function fixture() {
  const line = (x: number) => `1 4 ${x} 0 0 1 0 0 0 1 0 0 0 1 3001.dat`;
  const p = importLDraw(
    [
      "0 FILE main.ldr",
      "1 16 0 0 0 1 0 0 0 1 0 0 0 1 vehicle.ldr",
      line(1000),
      "0 FILE vehicle.ldr",
      ...Array.from({ length: 6 }, (_, n) => line(n * 20)),
    ].join("\n"),
  );
  const all = occurrences(p),
    inside = all.filter((o) => o.path.length === 2),
    outside = all.find((o) => o.path.length === 1)!,
    ids = inside.map((o) => o.id);
  const items = all.map((o, index) => ({
    o,
    index,
    ids: [o.id],
    box: {
      min: [0, 0, 0] as [number, number, number],
      max: [120, 24, 20] as [number, number, number],
    },
    broad: false,
    adjacent: new Set<number>(),
    supports: new Set<number>(),
    hosts: new Set<number>(),
    access: new Set<number>(),
  }));
  const plan: InstructionPlan = {
    name: "Flat",
    modules: {
      a: {
        name: "Wheel A",
        occurrenceIds: ids.slice(2, 4),
        hostIds: [ids[0]],
        purpose: "wheel",
        feasibility: "unknown",
      },
      b: {
        name: "Wheel B",
        occurrenceIds: ids.slice(4, 6),
        hostIds: [ids[1]],
        purpose: "wheel",
        feasibility: "unknown",
      },
    },
    steps: [
      [ids[0], outside.id, ids[1]],
      [ids[2]],
      [ids[3]],
      [],
      [ids[4]],
      [ids[5]],
      [],
    ],
    stepMetadata: [
      {},
      { assembly: { type: "build", moduleId: "a" } },
      { assembly: { type: "build", moduleId: "a" } },
      { assembly: { type: "join", moduleId: "a" } },
      { assembly: { type: "build", moduleId: "b" } },
      { assembly: { type: "build", moduleId: "b" } },
      { assembly: { type: "join", moduleId: "b" } },
    ],
  };
  return { p, items, plan, ids, outside };
}
it("splits mixed batches without moving foreign parts onto a parent bench", () => {
  const { p, items, plan, ids, outside } = fixture(),
    flat = plan.steps.flat();
  expect(sceneWorkbenches(p, plan, items).adopted).toBe(1);
  expect(plan.steps.flat()).toEqual(flat);
  const states = instructionDisplayStates(plan);
  expect(plan.steps.slice(0, 3)).toEqual([[ids[0]], [outside.id], [ids[1]]]);
  expect(states[0].displayIds).toEqual([ids[0]]);
  expect(states[1].displayIds).toEqual([outside.id]);
  expect(states[2].displayIds).toEqual([ids[0], ids[1]]);
  expect(states.at(-1)!.displayIds).toHaveLength(7);
});
it("rejects crossing dependencies in both directions without absorbing the rest of the scene", () => {
  for (const direction of [true, false])
    for (const kind of ["supports", "hosts", "access", "adjacent"] as const) {
      const { p, items, plan, ids, outside } = fixture(),
        before = structuredClone(plan),
        a = items.find((i) => i.ids[0] === ids[0])!,
        b = items.find((i) => i.ids[0] === outside.id)!;
      (direction ? a : b)[kind].add((direction ? b : a).index);
      expect(sceneWorkbenches(p, plan, items).adopted).toBe(0);
      expect(plan).toEqual(before);
    }
});
it("rejects an introduced but unjoined sibling receiver, even though it belongs to the parent", () => {
  const { p, items, plan, ids } = fixture();
  plan.modules!.a.hostIds = [ids[4]];
  const before = structuredClone(plan);
  expect(sceneWorkbenches(p, plan, items).adopted).toBe(0);
  expect(plan).toEqual(before);
});
it("retains flat unresolved receiving tasks and source sections with ownership or geometry uncertainty", () => {
  for (const change of ["receiver", "geometry", "unknown-bounds"] as const) {
    const { p, items, plan } = fixture();
    if (change === "receiver") delete plan.modules!.a.hostIds;
    else if (change === "geometry")
      (items[0] as (typeof items)[number] & { component?: unknown }).component =
        {};
    else (items[0] as { box: unknown }).box = null;
    const before = structuredClone(plan);
    expect(sceneWorkbenches(p, plan, items).adopted).toBe(0);
    expect(plan).toEqual(before);
  }
});

function staticFixture() {
  const f = fixture();
  f.plan.modules = {};
  f.plan.steps = [
    [f.ids[0]],
    [f.outside.id],
    ...f.ids.slice(1).map((id) => [id]),
  ];
  f.plan.stepMetadata = f.plan.steps.map(() => ({}));
  for (let n = 1; n < f.ids.length; n++) {
    const item = f.items.find((i) => i.ids[0] === f.ids[n])!;
    item.supports.add(f.items.find((i) => i.ids[0] === f.ids[n - 1])!.index);
  }
  return f;
}
it("separates a complete static source section without inventing a mating connection", () => {
  const { p, items, plan, ids, outside } = staticFixture(),
    flat = plan.steps.flat();
  expect(sceneWorkbenches(p, plan, items).adopted).toBe(1);
  expect(plan.steps.flat()).toEqual(flat);
  const states = instructionDisplayStates(plan);
  expect(states[1].displayIds).toEqual([outside.id]);
  expect(states.at(-2)!.displayIds).toEqual(ids);
  expect(new Set(states.at(-1)!.displayIds)).toEqual(
    new Set([...ids, outside.id]),
  );
  expect(plan.steps.at(-1)).toEqual([]);
  expect(plan.modules!["scene-1"].placement).toBe("scene");
  expect(plan.modules!["scene-1"].feasibility).toBe("unknown");
});
it("rejects every static boundary crossing in either direction and retains the whole flat programme", () => {
  for (const direction of [true, false])
    for (const kind of ["supports", "hosts", "access", "adjacent"] as const) {
      const { p, items, plan, ids, outside } = staticFixture(),
        before = structuredClone(plan),
        a = items.find((i) => i.ids[0] === ids[0])!,
        b = items.find((i) => i.ids[0] === outside.id)!;
      (direction ? a : b)[kind].add((direction ? b : a).index);
      expect(sceneWorkbenches(p, plan, items).adopted).toBe(0);
      expect(plan).toEqual(before);
    }
});
it("rejects static disconnected props, unavailable same-batch prerequisites and nonrigid source geometry", () => {
  for (const kind of ["disconnected", "same-batch", "nonrigid"] as const) {
    const { p, items, plan, ids } = staticFixture();
    if (kind === "disconnected")
      items.find((i) => i.ids[0] === ids[2])!.supports.clear();
    if (kind === "same-batch") {
      plan.steps = [ids];
      plan.stepMetadata = [{}];
    }
    if (kind === "nonrigid") items[0].o.transform.basis[0] = 1.03;
    const before = structuredClone(plan);
    expect(sceneWorkbenches(p, plan, items).adopted).toBe(0);
    expect(plan).toEqual(before);
  }
});
it("describes loose supported positions before the first connecting piece without certifying stability", () => {
  const { p, items, plan, ids } = staticFixture(),
    a = items.find((i) => i.ids[0] === ids[0])!,
    b = items.find((i) => i.ids[0] === ids[1])!;
  b.supports.clear();
  const bridge = items.find((i) => i.ids[0] === ids[2])!;
  bridge.supports.add(a.index);
  expect(sceneWorkbenches(p, plan, items).adopted).toBe(1);
  expect(plan.stepMetadata![2].notes).toContain("loose pieces supported");
  expect(plan.stepMetadata![2].notes).toContain("No connection");
});
it("keeps a completed static candidate aside until the remaining in-place scene is built", () => {
  const { p, items, plan, ids, outside } = staticFixture();
  plan.steps = [...ids.map((id) => [id]), [outside.id]];
  plan.stepMetadata = plan.steps.map(() => ({}));
  const flat = plan.steps.flat();
  expect(sceneWorkbenches(p, plan, items).adopted).toBe(1);
  expect(plan.steps.flat()).toEqual(flat);
  const states = instructionDisplayStates(plan);
  expect(states.at(-2)!.displayIds).toEqual([outside.id]);
  expect(plan.stepMetadata!.at(-1)!.assembly!.type).toBe("join");
  expect(new Set(states.at(-1)!.displayIds)).toEqual(
    new Set([...ids, outside.id]),
  );
  expect(plan.stepMetadata!.at(-1)!.notes).toContain(
    "No new parts and no mating connection inferred",
  );
});
it("waits for a receiving root join but does not turn a separate scene placement into a prerequisite", () => {
  for (const scene of [true, false]) {
    const { p, items, plan, ids, outside } = staticFixture();
    plan.modules = {
      other: {
        name: "Other candidate",
        occurrenceIds: [outside.id],
        feasibility: "unknown",
        ...(scene ? { placement: "scene" as const } : {}),
      },
    };
    plan.steps = [...ids.map((id) => [id]), [outside.id], []];
    plan.stepMetadata = [
      ...ids.map(() => ({})),
      { assembly: { type: "build", moduleId: "other" } },
      { assembly: { type: "join", moduleId: "other" } },
    ];
    expect(sceneWorkbenches(p, plan, items).adopted).toBe(1);
    const n = plan.stepMetadata!.findIndex(
      (m) => m.assembly?.type === "join" && m.assembly.moduleId === "scene-1",
    );
    expect(n).toBe(scene ? ids.length : plan.steps.length - 1);
  }
});
