import type { Occurrence, Project } from "../core/types";
/** Reconstruct file-local material scope when a leaf is compiled independently. */
export function occurrenceSourceContext(
  project: Project,
  occurrence: Occurrence,
) {
  const scopes = [project.models[project.rootModelId]];
  let model = scopes[0];
  for (const id of occurrence.path.slice(0, -1)) {
    const reference = model.nodes.find((n) => n.id === id);
    if (
      !reference ||
      reference.kind !== "submodel" ||
      !project.models[reference.ref]
    )
      break;
    model = project.models[reference.ref];
    scopes.push(model);
  }
  const colors = scopes.flatMap((scope) =>
    scope.records
      .filter((r) => /^0\s+!COLOUR\s/i.test(r.raw.trim()))
      .map((r) => r.raw.trim()),
  );
  if (occurrence.node.kind !== "geometry") return colors.join("\n");
  const state: string[] = [];
  for (const record of model.records) {
    if (record.id === occurrence.node.sourceRecordId) break;
    if (!/^0\s+BFC(?:\s|$)/i.test(record.raw.trim())) continue;
    // INVERTNEXT belongs to the following type-1 reference, never this isolated face.
    const directive = record.raw
      .trim()
      .replace(/\bINVERTNEXT\b/gi, "")
      .trim();
    if (!/^0\s+BFC\s*$/i.test(directive)) state.push(directive);
  }
  return [...colors, ...state].join("\n");
}
