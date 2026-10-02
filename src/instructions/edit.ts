import { flattenInstructionProgramme } from "./programme";
import {
  ensure,
  uid,
  type Project,
  type InstructionPlan,
  type InstructionStepMetadata,
  type CameraSpec,
} from "../core/types";
import { occurrences } from "../core/document";
const named = (name: unknown) => {
  ensure(
    typeof name === "string" && name.trim().length > 0 && name.length <= 200,
    "INVALID_INPUT",
    "Instruction name must contain 1–200 characters.",
  );
  return name;
};
export function instructionCoverage(project: Project, plan: InstructionPlan) {
  const ids = occurrences(project).map((o) => o.id),
    seen = new Set(plan.steps.flat());
  return {
    total: ids.length,
    introduced: ids.filter((id) => seen.has(id)).length,
    missing: ids.filter((id) => !seen.has(id)),
    emptySteps: plan.steps.filter(
      (s, i) => !s.length && plan.stepMetadata?.[i]?.assembly?.type !== "join",
    ).length,
  };
}
export function validateInstructionCamera(c: CameraSpec) {
  const direction = c.position.map((v, i) => v - c.target[i]);
  ensure(
    c.far > c.near &&
      Math.hypot(...direction) > 1e-9 &&
      Math.hypot(...c.up) > 1e-9,
    "INVALID_INPUT",
    "Step camera needs a valid range, direction and up vector.",
  );
  const cross = [
    direction[1] * c.up[2] - direction[2] * c.up[1],
    direction[2] * c.up[0] - direction[0] * c.up[2],
    direction[0] * c.up[1] - direction[1] * c.up[0],
  ];
  ensure(
    Math.hypot(...cross) > 1e-9,
    "INVALID_INPUT",
    "Step camera up must not be parallel to its view.",
  );
  ensure(
    c.projection !== "orthographic" || !!c.span,
    "INVALID_INPUT",
    "Orthographic step camera needs a span.",
  );
}
function editInstructionsInner(
  p: Project,
  type: string,
  v: Record<string, any>,
) {
  const all = new Set(occurrences(p).map((o) => o.id));
  const ids = (value: string[]) => {
    ensure(
      new Set(value).size === value.length && value.every((id) => all.has(id)),
      "INVALID_INPUT",
      "Instruction additions must be unique existing leaf occurrences.",
    );
    return value;
  };
  if (type === "instructions.create") {
    p.instructionPlans[uid()] = {
      name: named(v.name),
      steps: [ids(v.occurrenceIds ?? [])],
    };
    return;
  }
  const plan = p.instructionPlans[v.planId];
  ensure(plan, "INVALID_INPUT", "Unknown instruction plan.");
  if (type === "instructions.rename") {
    plan.name = named(v.name);
    return;
  }
  if (type === "instructions.remove") {
    delete p.instructionPlans[v.planId];
    return;
  }
  plan.stepMetadata ??= plan.steps.map(() => ({}));
  const meta = plan.stepMetadata;
  const index = (i: number) => {
    ensure(
      Number.isInteger(i) && i >= 0 && i < plan.steps.length,
      "INVALID_INPUT",
      "Unknown instruction step.",
    );
    return i;
  };
  if (type === "instructions.step.add") {
    const i = v.index ?? plan.steps.length;
    ensure(
      Number.isInteger(i) &&
        i >= 0 &&
        i <= plan.steps.length &&
        plan.steps.length < 2000,
      "LIMIT_EXCEEDED",
      "Invalid new step index or step budget.",
    );
    plan.steps.splice(i, 0, []);
    meta.splice(i, 0, {});
    return;
  }
  if (type === "instructions.step.reorder") {
    ensure(
      v.indices.length === plan.steps.length &&
        new Set(v.indices).size === plan.steps.length,
      "INVALID_INPUT",
      "Step order must be a complete permutation.",
    );
    v.indices.forEach(index);
    plan.steps = v.indices.map((i: number) => plan.steps[i]);
    plan.stepMetadata = v.indices.map((i: number) => meta[i]);
    return;
  }
  const i = index(v.index);
  if (type === "instructions.step.update") {
    if (v.notes !== undefined) meta[i].notes = v.notes;
    if (v.camera !== undefined) {
      delete meta[i].contextCamera;
      delete meta[i].alternateCamera;
      delete meta[i].alternateBeforePlacement;
      delete meta[i].alternateDetailIds;
      delete meta[i].incomingCamera;
      delete meta[i].completedDetail;
      delete meta[i].targets;
      delete meta[i].axisReference;
      delete meta[i].insertionChecks;
    }
    if (v.camera === null) delete meta[i].camera;
    else if (v.camera) {
      validateInstructionCamera(v.camera);
      meta[i].camera = structuredClone(v.camera);
    }
    return;
  }
  if (type === "instructions.step.remove") {
    ensure(
      v.disposition === "unassign" || v.disposition === "move",
      "INVALID_INPUT",
      "Choose where removed step additions go.",
    );
    if (v.disposition === "move") {
      const target = index(v.targetIndex);
      ensure(target !== i, "INVALID_INPUT", "Choose another target step.");
      plan.steps[target] = plan.steps[target].concat(plan.steps[i]);
    }
    plan.steps.splice(i, 1);
    meta.splice(i, 1);
    return;
  }
  if (type === "instructions.step.assign") {
    const moved = ids(v.occurrenceIds),
      chosen = new Set(moved);
    plan.steps = plan.steps.map((step) => step.filter((id) => !chosen.has(id)));
    plan.steps[i] = plan.steps[i].concat(moved);
    return;
  }
  if (type === "instructions.step.split") {
    const moved = ids(v.occurrenceIds),
      chosen = new Set(moved);
    ensure(
      moved.length > 0 &&
        moved.length < plan.steps[i].length &&
        moved.every((id) => plan.steps[i].includes(id)),
      "INVALID_INPUT",
      "Split requires some, but not all, additions from this step.",
    );
    ensure(plan.steps.length < 2000, "LIMIT_EXCEEDED", "Step budget exceeded.");
    const part = plan.steps[i].filter((id) => chosen.has(id));
    plan.steps[i] = plan.steps[i].filter((id) => !chosen.has(id));
    plan.steps.splice(i + 1, 0, part);
    meta.splice(
      i + 1,
      0,
      meta[i].camera ? { camera: structuredClone(meta[i].camera) } : {},
    );
    return;
  }
  ensure(
    type === "instructions.step.merge" && i + 1 < plan.steps.length,
    "INVALID_INPUT",
    "Choose a step with a following step to merge.",
  );
  plan.steps[i] = plan.steps[i].concat(plan.steps[i + 1]);
  const notes = [meta[i].notes, meta[i + 1].notes].filter(Boolean).join("\n\n");
  ensure(
    notes.length <= 4096,
    "LIMIT_EXCEEDED",
    "Merged notes exceed 4096 characters.",
  );
  if (notes) meta[i].notes = notes;
  plan.steps.splice(i + 1, 1);
  meta.splice(i + 1, 1);
}

export function editInstructions(
  p: Project,
  type: string,
  v: Record<string, any>,
) {
  editInstructionsInner(p, type, v);
  if (
    type.startsWith("instructions.step.") &&
    (type !== "instructions.step.update" || Object.hasOwn(v, "camera"))
  ) {
    const plan = p.instructionPlans[v.planId];
    if (plan) delete plan.refinement;
  }
  if (
    type.startsWith("instructions.step.") &&
    type !== "instructions.step.update"
  ) {
    const plan = p.instructionPlans[v.planId];
    if (plan) flattenInstructionProgramme(plan);
  }
}
