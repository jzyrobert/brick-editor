import { occurrences } from "../core/document";
import { ensure, type Project } from "../core/types";
import { validateRequest } from "../core/validate-request";
import { curatedHas } from "../catalog/full-library";
import { fullConnectorEntry } from "../catalog/full-connectors";
import { loadFullConnectors } from "../catalog/full-library-loader";
import {
  proposeMechanicalRig,
  type MechanicalProposal,
  type MechanicalProposalRequest,
} from "./mechanical-proposals";

/** The UI and automation share the same bounded, source-bound analysis. */
export async function prepareMechanicalProposal(
  project: Project,
  input: MechanicalProposalRequest,
  isCurrent: () => boolean,
) {
  validateRequest("mechanicalProposalRequest", input);
  ensure(
    input.expectedRevision === project.revision,
    "REVISION_CONFLICT",
    "Project changed; review the mechanism again.",
  );
  const selection = input.occurrenceIds
    ? new Set(input.occurrenceIds)
    : undefined;
  const lookup = new Map(occurrences(project).map((o) => [o.id, o]));
  const all = [...lookup.values()].filter((o) =>
    selection ? selection.has(o.id) : o.visible || input.includeHidden,
  );
  ensure(
    all.length <= 2048,
    "LIMIT_EXCEEDED",
    "Select at most 2,048 parts for mechanical analysis.",
  );
  const refs = new Set(
    all
      .filter(
        (o) =>
          o.namespace === "official" &&
          !curatedHas(o.node.ref) &&
          !fullConnectorEntry(o.node.ref),
      )
      .map((o) => o.node.ref),
  );
  await loadFullConnectors(refs);
  ensure(
    isCurrent(),
    "REVISION_CONFLICT",
    "Project changed while preparing the mechanism. Review it again.",
  );
  return proposeMechanicalRig(project, input, lookup);
}

/** A runnable draft must account for every selected part, without inferred repairs. */
export function reviewedProposalProject(
  project: Project,
  input: MechanicalProposalRequest,
  proposal: MechanicalProposal,
) {
  ensure(
    project.revision === proposal.sourceRevision &&
      input.expectedRevision === project.revision,
    "REVISION_CONFLICT",
    "Project changed; review the mechanism again.",
  );
  ensure(
    proposal.rig && !proposal.unresolved.length,
    "INVALID_INPUT",
    "Resolve every uncertain attachment before trying or saving this mechanism.",
  );
  const assigned = new Set(proposal.rig.groups.flatMap((g) => g.occurrenceIds));
  const selected =
    input.occurrenceIds ??
    occurrences(project)
      .filter((o) => o.visible || input.includeHidden)
      .map((o) => o.id);
  ensure(
    selected.every((id) => assigned.has(id)),
    "INVALID_INPUT",
    "Some selected parts have no reviewed group. Choose their fixed frame or narrow the assembly and review again.",
  );
  const owned = new Set(
    Object.values(project.motionRigs).flatMap((r) =>
      r.groups.flatMap((g) => g.occurrenceIds),
    ),
  );
  ensure(
    !Object.hasOwn(project.motionRigs, proposal.rig.id) &&
      [...assigned].every((id) => !owned.has(id)),
    "INVALID_INPUT",
    "An authored mechanism already owns these parts. Choose another assembly.",
  );
  return {
    ...project,
    motionRigs: {
      ...project.motionRigs,
      [proposal.rig.id]: structuredClone(proposal.rig),
    },
  };
}
