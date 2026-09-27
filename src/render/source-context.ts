import type { Occurrence, Project } from "../core/types";

type Model = Project["models"][string];
type BfcState = {
  certified: boolean | null;
  ccw: boolean;
  clip: boolean;
  invertNext: boolean;
};

/** State immediately before a source record, following the BFC branch rules. */
function stateBefore(model: Model, recordId: string | undefined): BfcState {
  const state: BfcState = {
    certified: null,
    ccw: true,
    clip: true,
    invertNext: false,
  };
  for (const record of model.records) {
    if (record.id === recordId) break;
    const line = record.raw.trim();
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
  // New authored nodes have no immediately preceding source INVERTNEXT.
  if (!recordId) state.invertNext = false;
  return state;
}

function isPhysicalPart(project: Project, occurrence: Occurrence) {
  if (occurrence.namespace === "official") return true;
  const model = project.models[occurrence.node.ref];
  return !!model?.records.some((record) =>
    /^0\s+!LDRAW_ORG\s+(?:Unofficial_)?Part(?:\s|$)/i.test(record.raw.trim()),
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
  const scopes = [project.models[project.rootModelId]];
  let model = scopes[0],
    cull = true,
    inverted = false;
  for (const id of occurrence.path.slice(0, -1)) {
    const reference = model.nodes.find((node) => node.id === id);
    if (
      !reference ||
      reference.kind !== "submodel" ||
      !project.models[reference.ref]
    )
      break;
    const state = stateBefore(model, reference.sourceRecordId);
    cull = cull && state.certified === true && state.clip;
    inverted = inverted !== state.invertNext;
    model = project.models[reference.ref];
    scopes.push(model);
  }
  const colors = scopes.flatMap((scope) =>
    scope.records
      .filter((record) => /^0\s+!COLOUR\s/i.test(record.raw.trim()))
      .map((record) => record.raw.trim()),
  );
  const state = stateBefore(model, occurrence.node.sourceRecordId);
  const physicalPart =
    occurrence.node.kind !== "geometry" && isPhysicalPart(project, occurrence);
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
