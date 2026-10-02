/** Replay detached candidate builds independently of final source poses. */
import { ensure, type InstructionPlan } from "../core/types";
export type InstructionDisplayState = {
  displayIds: string[];
  highlightIds: string[];
  incomingIds?: string[];
  operationLabel?: string;
};
function replay(
  plan: InstructionPlan,
  visit?: (state: InstructionDisplayState, index: number) => void,
  wanted?: number,
) {
  const modules = plan.modules ?? {},
    owners = new Map<string, string>(),
    members = new Map<string, Set<string>>(),
    ancestors = new Map<string, Set<string>>(),
    children = new Map<string, string[]>();
  let membershipWork = 0;
  for (const [key, module] of Object.entries(modules)) {
    const ids = new Set(module.occurrenceIds);
    membershipWork += ids.size;
    ensure(
      ids.size > 0 && ids.size === module.occurrenceIds.length,
      "INVALID_INPUT",
      "Workbench candidate is empty or repeats members.",
    );
    ensure(
      membershipWork <= 200000,
      "LIMIT_EXCEEDED",
      "Workbench membership budget exceeded.",
    );
    members.set(key, ids);
    const chain = new Set<string>();
    for (
      let cursor: string | undefined = key;
      cursor;
      cursor = modules[cursor].parentModuleId
    ) {
      ensure(
        modules[cursor] && !chain.has(cursor),
        "INVALID_INPUT",
        "Unknown or cyclic workbench parent.",
      );
      chain.add(cursor);
      ensure(
        chain.size <= 16,
        "LIMIT_EXCEEDED",
        "Workbench nesting exceeds sixteen levels.",
      );
    }
    ancestors.set(key, chain);
    if (module.parentModuleId) {
      const list = children.get(module.parentModuleId) ?? [];
      list.push(key);
      children.set(module.parentModuleId, list);
    }
    ensure(
      module.placement !== "scene" || !module.parentModuleId,
      "INVALID_INPUT",
      "Scene placement must target the root scene.",
    );
  }
  for (const [key, module] of Object.entries(modules)) {
    if (module.parentModuleId) {
      const parent = members.get(module.parentModuleId)!;
      ensure(
        module.occurrenceIds.length < parent.size &&
          module.occurrenceIds.every((id) => parent.has(id)),
        "INVALID_INPUT",
        "A nested workbench must be a strict subset of its parent.",
      );
    }
  }
  for (const [key, module] of Object.entries(modules).sort(
    (a, b) => ancestors.get(b[0])!.size - ancestors.get(a[0])!.size,
  ))
    for (const id of module.occurrenceIds) {
      const owner = owners.get(id);
      ensure(
        !owner || ancestors.get(owner)!.has(key),
        "INVALID_INPUT",
        "Workbench candidates overlap without a parent relationship.",
      );
      if (!owner) owners.set(id, key);
    }
  const built = new Set<string>(),
    assembled = new Set<string>(),
    joined = new Set<string>(),
    workbenches = new Map(
      Object.keys(modules).map((key) => [key, new Set<string>()]),
    );
  for (let index = 0; index < plan.steps.length; index++) {
    const ids = plan.steps[index],
      action = plan.stepMetadata?.[index]?.assembly;
    if (action)
      ensure(
        modules[action.moduleId],
        "INVALID_INPUT",
        "Unknown workbench candidate.",
      );
    const continuing =
      action?.type === "build" &&
      plan.stepMetadata?.[index - 1]?.assembly?.type === "build" &&
      plan.stepMetadata[index - 1].assembly!.moduleId === action.moduleId;
    const resuming =
      action?.type === "build" && workbenches.get(action.moduleId)!.size > 0;
    for (const id of ids) {
      ensure(
        !built.has(id),
        "INVALID_INPUT",
        "An occurrence is introduced more than once.",
      );
      ensure(
        owners.get(id) ===
          (action?.type === "build" ? action.moduleId : undefined),
        "INVALID_INPUT",
        "Workbench build ownership does not match its additions.",
      );
      built.add(id);
      if (!action) assembled.add(id);
      else if (action.type === "build")
        workbenches.get(action.moduleId)!.add(id);
    }
    let displayIds: string[],
      highlightIds = ids,
      incomingIds: string[] | undefined,
      operationLabel: string | undefined;
    if (action?.type === "join") {
      const module = modules[action.moduleId],
        destination = module.parentModuleId
          ? workbenches.get(module.parentModuleId)!
          : assembled;
      ensure(
        ids.length === 0 &&
          !joined.has(action.moduleId) &&
          module.occurrenceIds.every((id) =>
            workbenches.get(action.moduleId)!.has(id),
          ) &&
          (children.get(action.moduleId) ?? []).every((key) =>
            joined.has(key),
          ) &&
          (!module.parentModuleId || !joined.has(module.parentModuleId)),
        "INVALID_INPUT",
        "Join requires one completed, previously unjoined candidate and no new parts.",
      );
      ensure(
        (module.hostIds ?? []).every((id) => destination.has(id)),
        "INVALID_INPUT",
        "Receiving candidate must precede placement in the destination workbench.",
      );
      joined.add(action.moduleId);
      for (const id of module.occurrenceIds) destination.add(id);
      highlightIds = module.occurrenceIds;
      incomingIds = module.occurrenceIds;
      displayIds =
        visit && (wanted === undefined || wanted === index)
          ? [...destination]
          : [];
      operationLabel = `Join candidate: ${module.name}. No new parts. Fit and access unknown.`;
      if (module.purpose === "wheel")
        operationLabel =
          "Place completed wheel. Review receiving fit and fastening.";
      if (module.parentModuleId)
        operationLabel += ` Into workbench: ${modules[module.parentModuleId].name}.`;
      if (module.placement === "scene")
        operationLabel = `Place completed object in the scene: ${module.name}. No new parts; no mating connection inferred.`;
    } else if (action?.type === "build") {
      ensure(
        !joined.has(action.moduleId) && ids.length > 0,
        "INVALID_INPUT",
        "Cannot build an empty or already joined workbench candidate.",
      );
      const module = modules[action.moduleId];
      displayIds =
        visit && (wanted === undefined || wanted === index)
          ? [...workbenches.get(action.moduleId)!]
          : [];
      operationLabel = `${continuing ? "Continue workbench candidate" : resuming ? "Resume workbench candidate" : "Workbench candidate"}: ${module.name}. Detached construction unverified; shown in final orientation.`;
      if (module.purpose === "wheel")
        operationLabel = continuing
          ? "Fit tyre around rim. Check seating all around; deformation and fit unverified."
          : "Prepare wheel rim separately. Shown in final orientation; hold on the workbench.";
    } else
      displayIds =
        visit && (wanted === undefined || wanted === index)
          ? [...assembled]
          : [];
    const detail = plan.stepMetadata?.[index]?.alternateDetailIds;
    if (detail) {
      const meta = plan.stepMetadata![index],
        destination =
          action?.type === "build"
            ? workbenches.get(action.moduleId)!
            : action?.type === "join" && modules[action.moduleId].parentModuleId
              ? workbenches.get(modules[action.moduleId].parentModuleId!)!
              : assembled,
        incoming = new Set([...ids, ...(incomingIds ?? [])]);
      ensure(
        meta.alternateBeforePlacement === true &&
          !!meta.alternateCamera &&
          detail.length > 0 &&
          detail.length <= 64 &&
          new Set(detail).size === detail.length &&
          detail.every((id) => destination.has(id) && !incoming.has(id)),
        "INVALID_INPUT",
        "Receiver detail must contain only prior receiving members, with a before-placement camera.",
      );
    }
    const completed = plan.stepMetadata?.[index]?.completedDetail;
    if (completed) {
      const destination =
        action?.type === "build"
          ? workbenches.get(action.moduleId)!
          : action?.type === "join" && modules[action.moduleId].parentModuleId
            ? workbenches.get(modules[action.moduleId].parentModuleId!)!
            : assembled;
      ensure(
        completed.occurrenceIds.length > 0 &&
          completed.occurrenceIds.length <= 64 &&
          new Set(completed.occurrenceIds).size ===
            completed.occurrenceIds.length &&
          completed.occurrenceIds.every((id) => destination.has(id)) &&
          completed.occurrenceIds.some((id) => highlightIds.includes(id)),
        "INVALID_INPUT",
        "Completed joint detail must contain only available members and include a current addition.",
      );
    }
    if (visit && (wanted === undefined || wanted === index))
      visit(
        {
          displayIds,
          highlightIds,
          ...(incomingIds ? { incomingIds } : {}),
          ...(operationLabel ? { operationLabel } : {}),
        },
        index,
      );
  }
  ensure(
    Object.keys(modules).every((key) => joined.has(key)),
    "INVALID_INPUT",
    "Workbench programme is missing a completed join.",
  );
}
export function validateInstructionProgramme(plan: InstructionPlan) {
  replay(plan);
}
export function instructionDisplayState(
  plan: InstructionPlan,
  index: number,
): InstructionDisplayState {
  let result: InstructionDisplayState = { displayIds: [], highlightIds: [] };
  replay(
    plan,
    (state, n) => {
      if (n === index) result = state;
    },
    index,
  );
  return result;
}
/** Bare receiver for either a loose-part addition or a completed-module placement. */
export function instructionReceivingIds(
  plan: InstructionPlan,
  index: number,
): string[] {
  const state = instructionDisplayState(plan, index);
  const incoming = new Set([
    ...(plan.steps[index] ?? []),
    ...(state.incomingIds ?? []),
  ]);
  return state.displayIds.filter((id) => !incoming.has(id));
}
/** Optional illustration mask; it never changes programme membership or CAD checks. */
export function instructionAlternateIds(
  plan: InstructionPlan,
  index: number,
): string[] {
  const receiving = instructionReceivingIds(plan, index),
    detail = plan.stepMetadata?.[index]?.alternateDetailIds;
  return detail ? receiving.filter((id) => detail.includes(id)) : receiving;
}
/** Structural edits retain flat introductions and discard derived join operations. */
export function flattenInstructionProgramme(plan: InstructionPlan) {
  if (!plan.modules) {
    for (const meta of plan.stepMetadata ?? []) {
      delete meta.contextCamera;
      delete meta.alternateCamera;
      delete meta.alternateBeforePlacement;
      delete meta.alternateDetailIds;
      delete meta.incomingCamera;
      delete meta.completedDetail;
      delete meta.targets;
      delete meta.axisReference;
      delete meta.insertionChecks;
    }
    return;
  }
  const retained = plan.steps
    .map((ids, index) => ({ ids, meta: plan.stepMetadata?.[index] ?? {} }))
    .filter((s) => s.meta.assembly?.type !== "join" || s.ids.length > 0);
  plan.steps = retained.map((s) => s.ids);
  plan.stepMetadata = retained.map(({ meta }) => {
    const {
      assembly,
      contextCamera,
      alternateCamera,
      alternateBeforePlacement,
      alternateDetailIds,
      incomingCamera,
      completedDetail,
      targets,
      axisReference,
      insertionChecks,
      ...rest
    } = meta;
    return assembly?.type === "join"
      ? {
          ...rest,
          notes:
            "Workbench programme removed after editing; review these additions.",
        }
      : rest;
  });
  delete plan.modules;
}

export function instructionDisplayStates(
  plan: InstructionPlan,
): InstructionDisplayState[] {
  const states: InstructionDisplayState[] = [];
  replay(plan, (state) => states.push(state));
  return states;
}
