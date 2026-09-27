import { ensure, type Project } from "../core/types";
import { exportLDraw } from "../ldraw/io";

const cache = new WeakMap<
  Project,
  { revision: number; sources: Map<string, string> }
>();
/** Compile only definitions reachable from a physical custom part. Ancestor
 * colour/BFC scope is supplied separately by occurrenceRenderContext. */
export function dependencySource(project: Project, ref: string): string {
  let entry = cache.get(project);
  if (!entry || entry.revision !== project.revision) {
    entry = { revision: project.revision, sources: new Map() };
    cache.set(project, entry);
  }
  const saved = entry.sources.get(ref);
  if (saved !== undefined) return saved;
  ensure(
    project.models[ref],
    "REFERENCE_MISSING",
    "Missing project geometry definition: " + ref,
  );
  const pending = [ref],
    selected = new Set<string>();
  while (pending.length) {
    const current = pending.pop()!;
    if (selected.has(current)) continue;
    selected.add(current);
    ensure(
      selected.size <= 10000,
      "LIMIT_EXCEEDED",
      "Custom dependency source exceeds 10,000 definitions",
    );
    for (const node of project.models[current].nodes)
      if (node.kind !== "geometry" && project.models[node.ref])
        pending.push(node.ref);
  }
  const source = exportLDraw({
    ...project,
    rootModelId: ref,
    models: Object.fromEntries(
      [...selected].map((key) => [key, project.models[key]]),
    ),
  });
  entry.sources.set(ref, source);
  return source;
}
