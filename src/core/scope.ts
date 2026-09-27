import { occurrences } from "./document";
import { parseOccurrenceId } from "./occurrence-id";
import { ensure, type Occurrence, type Project, type Scope } from "./types";

type Prefix = {
  children?: Map<string, Prefix>;
  selected?: boolean;
  matched?: boolean;
};

/** Resolve leaf or submodel paths without multiplying selection size by model size. */
export function resolveScope(project: Project, scope: Scope): Occurrence[] {
  if (scope.kind === "all") return occurrences(project);
  if (scope.kind === "visible")
    return occurrences(project).filter((occurrence) => occurrence.visible);
  if (scope.kind === "layers") {
    const layers = new Set(scope.layerIds);
    ensure(
      [...layers].every((id) => Object.hasOwn(project.layers, id)),
      "INVALID_INPUT",
      "Unknown layer",
    );
    return occurrences(project).filter((occurrence) =>
      layers.has(occurrence.layerId),
    );
  }
  const selected =
    scope.kind === "selection" ? scope.occurrenceIds : [scope.occurrenceId];
  ensure(
    selected.length <= 100000,
    "LIMIT_EXCEEDED",
    "Scope exceeds 100,000 selected occurrences",
  );
  const root: Prefix = {};
  let unmatched = 0;
  for (const id of selected) {
    const path = parseOccurrenceId(id);
    let prefix = root;
    for (const segment of path) {
      const children = (prefix.children ??= new Map<string, Prefix>());
      let child = children.get(segment);
      if (!child) {
        child = {};
        children.set(segment, child);
      }
      prefix = child;
    }
    if (!prefix.selected) {
      prefix.selected = true;
      unmatched++;
    }
  }
  const result: Occurrence[] = [];
  for (const occurrence of occurrences(project)) {
    let prefix: Prefix | undefined = root,
      included = false;
    for (const segment of occurrence.path) {
      prefix = prefix.children?.get(segment);
      if (!prefix) break;
      if (prefix.selected) {
        included = true;
        if (!prefix.matched) {
          prefix.matched = true;
          unmatched--;
        }
      }
      // Keep visiting descendants: an existing selected ancestor must not mask
      // an unknown child explicitly requested in the same scope.
    }
    if (included) result.push(occurrence);
  }
  ensure(unmatched === 0, "INVALID_INPUT", "Unknown scope occurrence");
  return result;
}
