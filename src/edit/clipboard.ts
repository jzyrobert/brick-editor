import type { Editor } from "../core/commands";
import type { ClipboardFragment } from "../core/fragments";
import { occurrences } from "../core/document";
import { ensure, uid, type Vec3 } from "../core/types";
let fragment: ClipboardFragment | undefined;
const listeners = new Set<() => void>();
export const clipboardSnapshot = () => fragment;
export const subscribeClipboard = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function setClipboard(value: ClipboardFragment) {
  fragment = structuredClone(value);
  for (const listener of listeners) listener();
}
export function copyToClipboard(
  editor: Editor,
  ids: string[],
  layerId: string,
  crossLayer: boolean,
  cut = false,
) {
  const selected = occurrences(editor.project).filter((o) =>
    ids.includes(o.id),
  );
  ensure(selected.length > 0, "INVALID_INPUT", "Select parts first");
  ensure(
    crossLayer || selected.every((o) => o.layerId === layerId),
    "LAYER_LOCKED",
    "Selection includes parts outside the active layer",
  );
  const value = cut
    ? editor.cut({
        occurrenceIds: ids,
        expectedRevision: editor.project.revision,
        commandId: uid(),
      }).fragment
    : editor.copy({ occurrenceIds: ids });
  setClipboard(value);
  return value;
}
export function pasteFromClipboard(
  editor: Editor,
  layerId: string,
  position?: Vec3,
) {
  ensure(fragment, "INVALID_INPUT", "Copy parts or open a fragment first");
  const origin = occurrences(fragment.project)[0]?.transform.position ?? [
    0, 0, 0,
  ];
  return editor.dispatch({
    schemaVersion: 1,
    commandId: uid(),
    expectedRevision: editor.project.revision,
    type: "clipboard.paste",
    payload: {
      fragment,
      layerId,
      delta: position ? position.map((n, i) => n - origin[i]) : [0, 0, 0],
    },
  });
}
