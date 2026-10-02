import { expect, it } from "vitest";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences, validateDocument } from "../../src/core/document";
import type { InstructionPlan } from "../../src/core/types";
import {
  instructionDisplayStates,
  validateInstructionProgramme,
} from "../../src/instructions/programme";
import { prepareInstructionPlan } from "../../src/instructions/publish";
import { deriveGuide, stepView } from "../../src/instructions/guide";
import { encodeNative, decodeNative } from "../../src/persistence/native";
const fixture = () => {
  const p = importLDraw(
      Array.from(
        { length: 5 },
        (_, i) => `1 4 ${i * 100} 0 0 1 0 0 0 1 0 0 0 1 3001.dat`,
      ).join("\n"),
    ),
    ids = occurrences(p).map((o) => o.id),
    plan: InstructionPlan = {
      name: "Authored scene",
      presentation: "pictorial",
      modules: {
        vehicle: {
          name: "Vehicle",
          occurrenceIds: ids.slice(0, 4),
          feasibility: "unknown",
          placement: "scene",
        },
        wheel: {
          name: "Wheel",
          occurrenceIds: ids.slice(1, 3),
          feasibility: "unknown",
          parentModuleId: "vehicle",
          hostIds: [ids[0]],
          purpose: "wheel",
        },
      },
      steps: [[ids[4]], [ids[0]], [ids[1]], [ids[2]], [], [ids[3]], []],
      stepMetadata: [
        {},
        { assembly: { type: "build", moduleId: "vehicle" } },
        { assembly: { type: "build", moduleId: "wheel" } },
        { assembly: { type: "build", moduleId: "wheel" } },
        { assembly: { type: "join", moduleId: "wheel" } },
        { assembly: { type: "build", moduleId: "vehicle" } },
        { assembly: { type: "join", moduleId: "vehicle" } },
      ],
    };
  return { p, ids, plan };
};
it("builds nested children on separate benches and places them into their parent before root scene placement", async () => {
  const { p, ids, plan } = fixture(),
    states = instructionDisplayStates(plan);
  expect(states[2].displayIds).toEqual([ids[1]]);
  expect(new Set(states[4].displayIds)).toEqual(new Set(ids.slice(0, 3)));
  expect(states[4].displayIds).not.toContain(ids[4]);
  expect(states[5].displayIds).toHaveLength(4);
  expect(states[6].displayIds).toHaveLength(5);
  expect(states[6].operationLabel).toContain(
    "No new parts; no mating connection inferred",
  );
  p.instructionPlans.manual = plan;
  validateDocument(p);
  const prepared = prepareInstructionPlan(p, "manual");
  expect(prepared.generation).toBeUndefined();
  expect(prepared.inventory.reduce((n, l) => n + l.quantity, 0)).toBe(5);
  expect(prepared.assemblyValidated).toBe(false);
  const restored = await decodeNative(await encodeNative(p));
  expect(restored.instructionPlans.manual).toEqual(plan);
  const guide = deriveGuide(restored, occurrences(restored), {
    plan: restored.instructionPlans.manual,
  });
  expect(new Set(stepView(guide, 4))).toEqual(new Set(ids.slice(0, 3)));
  expect(stepView(guide, 4)).not.toContain(ids[4]);
  expect(guide.steps[4].added).toEqual([]);
  expect(guide.steps[6].assemblies[0].name).toContain("scene");
});
it("rejects premature parent joins, receivers built on another bench and unrelated overlap", () => {
  const { ids, plan } = fixture(),
    premature = structuredClone(plan);
  [premature.stepMetadata![4], premature.stepMetadata![6]] = [
    premature.stepMetadata![6],
    premature.stepMetadata![4],
  ];
  expect(() => validateInstructionProgramme(premature)).toThrow(/completed/);
  const receiver = structuredClone(plan);
  receiver.modules!.wheel.hostIds = [ids[4]];
  expect(() => validateInstructionProgramme(receiver)).toThrow(
    /destination workbench/,
  );
  const overlap = structuredClone(plan);
  delete overlap.modules!.wheel.parentModuleId;
  expect(() => validateInstructionProgramme(overlap)).toThrow(/overlap/);
});
it("rejects parent cycles, missing parents and repeated membership", () => {
  for (const mutate of [
    (p: InstructionPlan) => {
      p.modules!.vehicle.parentModuleId = "wheel";
      delete p.modules!.vehicle.placement;
    },
    (p: InstructionPlan) => {
      p.modules!.wheel.parentModuleId = "missing";
    },
    (p: InstructionPlan) => {
      p.modules!.wheel.occurrenceIds.push(p.modules!.wheel.occurrenceIds[0]);
    },
  ]) {
    const { plan } = fixture();
    mutate(plan);
    expect(() => validateInstructionProgramme(plan)).toThrow();
  }
});
