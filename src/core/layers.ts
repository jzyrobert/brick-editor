import { copyFragment, pasteFragment } from "./fragments";
import { occurrences } from "./document";
import { identity } from "./math";
import { ensure, uid, type Project } from "./types";
function name(value: unknown): asserts value is string {
  ensure(
    typeof value === "string" && value.trim().length > 0 && value.length <= 200,
    "INVALID_INPUT",
    "Choose a name of 1–200 characters.",
  );
}
export function duplicateLayer(
  p: Project,
  v: {
    layerId: string;
    name?: string;
    includeHidden?: boolean;
    maxAdditions?: number;
  },
) {
  const source = p.layers[v.layerId];
  ensure(source, "INVALID_INPUT", "Unknown source layer.");
  const label = v.name ?? source.name.slice(0, 195) + " copy";
  name(label);
  const ids = occurrences(p)
    .filter((o) => o.layerId === source.id)
    .map((o) => o.id);
  ensure(
    source.visible || v.includeHidden === true || !ids.length,
    "INVALID_INPUT",
    "Duplicating hidden layer contents requires includeHidden.",
  );
  ensure(
    ids.length <= (v.maxAdditions ?? 10000),
    "LIMIT_EXCEEDED",
    "Layer duplication exceeds the additions budget.",
  );
  const fragment = ids.length
    ? copyFragment(p, { occurrenceIds: ids, includeHidden: v.includeHidden })
    : undefined;
  const id = uid(),
    ordered = Object.values(p.layers).sort((a, b) => a.order - b.order),
    index = ordered.findIndex((l) => l.id === source.id);
  const layer = { ...structuredClone(source), id, name: label, locked: false };
  ordered.splice(index + 1, 0, layer);
  p.layers[id] = layer;
  ordered.forEach((l, i) => (l.order = i));
  return fragment
    ? pasteFragment(p, fragment, [identity()], {
        layerId: id,
        maxAdditions: v.maxAdditions,
      })
    : {};
}
export function mutateFolder(p: Project, type: string, v: Record<string, any>) {
  p.layerFolders ??= {};
  const folders = p.layerFolders;
  if (type === "folders.add") {
    name(v.name);
    if (v.parentFolderId)
      ensure(
        folders[v.parentFolderId],
        "INVALID_INPUT",
        "Unknown parent folder.",
      );
    const id = uid();
    folders[id] = {
      id,
      name: v.name,
      order: Object.keys(folders).length,
      ...(v.parentFolderId ? { parentFolderId: v.parentFolderId } : {}),
    };
    return;
  }
  const folder = folders[v.folderId];
  ensure(folder, "INVALID_INPUT", "Unknown folder.");
  if (type === "folders.rename") {
    name(v.name);
    folder.name = v.name;
    return;
  }
  if (type === "folders.move") {
    if (v.parentFolderId) {
      ensure(
        folders[v.parentFolderId],
        "INVALID_INPUT",
        "Unknown parent folder.",
      );
      folder.parentFolderId = v.parentFolderId;
    } else delete folder.parentFolderId;
    return;
  }
  ensure(
    v.mode === "promote-children",
    "INVALID_INPUT",
    "Folder removal must explicitly keep and promote its contents.",
  );
  for (const child of [...Object.values(folders), ...Object.values(p.layers)])
    if (child.parentFolderId === folder.id) {
      if (folder.parentFolderId) child.parentFolderId = folder.parentFolderId;
      else delete child.parentFolderId;
    }
  delete folders[folder.id];
}
