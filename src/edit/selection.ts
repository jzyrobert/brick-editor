import type { Occurrence, Project } from "../core/types";
export type SelectionOperation = "replace" | "add" | "remove" | "toggle";
export function combineSelection(
  current: string[],
  incoming: string[],
  operation: SelectionOperation,
) {
  const set = new Set(operation === "replace" ? [] : current);
  for (const id of incoming) {
    if (operation === "remove" || (operation === "toggle" && set.has(id)))
      set.delete(id);
    else set.add(id);
  }
  return [...set];
}
export function eligibleSelection(
  project: Project,
  all: Occurrence[],
  ids: string[],
  activeLayer: string,
  crossLayer: boolean,
) {
  const requested = new Set(ids);
  return all
    .filter(
      (o) =>
        requested.has(o.id) &&
        o.visible &&
        !project.layers[o.layerId].locked &&
        (crossLayer || o.layerId === activeLayer),
    )
    .map((o) => o.id);
}
