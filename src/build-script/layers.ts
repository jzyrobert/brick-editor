/**
 * Section layers of compiled build scripts: assigned when a script compiles,
 * written into its LDraw text and read back when that text is opened again.
 */
import { encodePath as encode } from "../core/document";
import type { Project } from "../core/types";

/** A project records at most this many layer assignments (its schema). */
const MAX_ASSIGNMENTS = 10000;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "build";

export const LAYER_COMMENT = "0 // Build script layer: ";

/**
 * One layer per name, holding every part under the root nodes given that
 * name (`layerOf(rootNodeIndex)`). The layer with the most parts is the
 * project's default layer, renamed, so it needs no assignments; when the rest
 * would still exceed the schema's assignment limit, only that is done.
 */
export function assignSectionLayers(
  project: Project,
  layerOf: (index: number) => string | undefined,
) {
  const root = project.models[project.rootModelId];
  const parts = new Map<string, string[]>();
  root.nodes.forEach((node, i) => {
    const name = layerOf(i);
    if (!name || !project.models[node.ref]) return;
    const list = parts.get(name) ?? [];
    parts.set(name, list);
    const walk = (modelId: string, prefix: string[]) => {
      for (const n of project.models[modelId].nodes) {
        const path = [...prefix, n.id];
        if (n.kind === "submodel" || project.models[n.ref]) walk(n.ref, path);
        else if (n.kind === "part") list.push(encode(path));
      }
    };
    walk(node.ref, [node.id]);
  });
  if (!parts.size) return false;
  const names = [...parts.keys()];
  const biggest = names.reduce((a, b) =>
    parts.get(b)!.length > parts.get(a)!.length ? b : a,
  );
  project.layers[project.defaultLayerId].name = biggest;
  const rest = names.filter((n) => n !== biggest);
  if (
    rest.reduce((n, name) => n + parts.get(name)!.length, 0) > MAX_ASSIGNMENTS
  )
    return true;
  let order = Object.keys(project.layers).length;
  rest.forEach((name, i) => {
    const id = "layer-" + slugify(name) + "-" + (i + 1);
    project.layers[id] = {
      id,
      name,
      visible: true,
      locked: false,
      order: order++,
    };
    for (const path of parts.get(name)!) project.layerAssignments[path] = id;
  });
  return true;
}

/**
 * Layers of a compiled build script's sections, read back from its LDraw
 * text (each section file carries a "0 // Build script layer: Name" line).
 * Returns false when the text has no such lines.
 */
export function sectionLayers(project: Project, text: string) {
  const byFile = new Map<string, string>();
  let file = "";
  for (const line of text.split("\n")) {
    if (line.startsWith("0 FILE ")) file = line.slice(7).trim().toLowerCase();
    else if (line.startsWith(LAYER_COMMENT))
      byFile.set(file, line.slice(LAYER_COMMENT.length).trim());
  }
  if (!byFile.size) return false;
  const root = project.models[project.rootModelId];
  return assignSectionLayers(project, (i) => {
    const model = project.models[root.nodes[i].ref];
    return model && byFile.get(model.name.toLowerCase());
  });
}
