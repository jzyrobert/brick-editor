import type { Occurrence, Project } from "../core/types";

type Model = Project["models"][string];
type BfcState = {
  certified: boolean | null;
  ccw: boolean;
  clip: boolean;
  invertNext: boolean;
};

type ModelIndex = {
  nodes: Map<string, Model["nodes"][number]>;
  records: Map<string, Model["records"][number]>;
  states: Map<string, BfcState>;
  finalState: BfcState;
  colors: string[];
  physical: boolean;
};
const indices = new WeakMap<
  Project,
  { revision: number; index: Map<string, ModelIndex> }
>();

/** Render snapshots are immutable; indexing once avoids a record scan per face. */
function projectIndex(project: Project) {
  const cached = indices.get(project);
  if (cached?.revision === project.revision) return cached.index;
  const index = new Map<string, ModelIndex>();
  for (const [id, model] of Object.entries(project.models)) {
    const state: BfcState = {
      certified: null,
      ccw: true,
      clip: true,
      invertNext: false,
    };
    const states = new Map<string, BfcState>();
    const colors: string[] = [];
    let physical = false;
    for (const record of model.records) {
      states.set(record.id, { ...state });
      const line = record.raw.trim();
      if (/^0\s+!COLOUR\s/i.test(line)) colors.push(line);
      if (/^0\s+!LDRAW_ORG\s+(?:Unofficial_)?Part(?:\s|$)/i.test(line))
        physical = true;
      if (!line) continue;
      const bfc = line.match(/^0\s+BFC\s+(.+)$/);
      if (bfc) {
        const tokens = bfc[1].split(/\s+/);
        state.invertNext = false;
        if (state.certified === false) continue;
        if (tokens.includes("NOCERTIFY")) {
          state.certified = false;
          continue;
        }
        state.certified = true;
        for (const token of tokens) {
          if (token === "CW") state.ccw = false;
          if (token === "CCW") state.ccw = true;
          if (token === "CLIP") state.clip = true;
          if (token === "NOCLIP") state.clip = false;
          if (token === "INVERTNEXT") state.invertNext = true;
        }
      } else {
        state.invertNext = false;
        if (/^[1-5]\s/.test(line) && state.certified === null)
          state.certified = false;
      }
    }
    index.set(id, {
      nodes: new Map(model.nodes.map((n) => [n.id, n])),
      records: new Map(model.records.map((r) => [r.id, r])),
      states,
      finalState: { ...state, invertNext: false },
      colors,
      physical,
    });
  }
  indices.set(project, { revision: project.revision, index });
  return index;
}
function stateBefore(
  model: ModelIndex,
  recordId: string | undefined,
): BfcState {
  return (recordId && model.states.get(recordId)) || model.finalState;
}

export function occurrenceRawRecord(project: Project, occurrence: Occurrence) {
  return (
    projectIndex(project)
      .get(occurrence.modelId)
      ?.records.get(occurrence.node.sourceRecordId || "")?.raw || ""
  );
}

/**
 * Independent meshes retain full affine occurrence matrices (Three corrects
 * negative determinants). Only explicit INVERTNEXT parity changes winding here.
 * Physical parts start a new BFC branch per the official BFC extension.
 */
export function occurrenceRenderContext(
  project: Project,
  occurrence: Occurrence,
) {
  const index = projectIndex(project);
  const scopes = [index.get(project.rootModelId)!];
  let model = scopes[0],
    cull = true,
    inverted = false;
  for (const id of occurrence.path.slice(0, -1)) {
    const reference = model.nodes.get(id);
    if (
      !reference ||
      reference.kind !== "submodel" ||
      !project.models[reference.ref]
    )
      break;
    const state = stateBefore(model, reference.sourceRecordId);
    cull = cull && state.certified === true && state.clip;
    inverted = inverted !== state.invertNext;
    model = index.get(reference.ref)!;
    scopes.push(model);
  }
  const colors = scopes.flatMap((scope) => scope.colors);
  const state = stateBefore(model, occurrence.node.sourceRecordId);
  const physicalPart =
    occurrence.node.kind !== "geometry" &&
    (occurrence.namespace === "official" ||
      !!index.get(occurrence.node.ref)?.physical);
  const b = occurrence.transform.basis;
  const determinant =
    b[0] * (b[4] * b[8] - b[5] * b[7]) -
    b[1] * (b[3] * b[8] - b[5] * b[6]) +
    b[2] * (b[3] * b[7] - b[4] * b[6]);
  const nonsingular = Math.abs(determinant) > 1e-12;
  cull =
    (physicalPart || (cull && state.certified === true && state.clip)) &&
    nonsingular;
  if (occurrence.node.kind === "geometry") {
    const winding = state.ccw !== inverted ? "CCW" : "CW";
    return {
      source: [
        ...colors,
        `0 BFC CERTIFY ${winding}`,
        ...(cull ? [] : ["0 BFC NOCLIP"]),
      ].join("\n"),
      forceDoubleSided: false,
    };
  }
  inverted = !physicalPart && inverted !== state.invertNext;
  return {
    source: [
      ...colors,
      "0 BFC CERTIFY CCW",
      ...(cull ? [] : ["0 BFC NOCLIP"]),
      ...(inverted ? ["0 BFC INVERTNEXT"] : []),
    ].join("\n"),
    // Singular world transforms cannot support reliable culling even at a
    // physical-part boundary; ordinary branch state is normalized in source.
    forceDoubleSided: !nonsingular,
  };
}

/** Reconstruct file-local material and BFC scope for independent compilation. */
export function occurrenceSourceContext(
  project: Project,
  occurrence: Occurrence,
) {
  return occurrenceRenderContext(project, occurrence).source;
}
