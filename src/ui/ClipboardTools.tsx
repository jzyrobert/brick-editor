import { useRef, useState, useSyncExternalStore } from "react";
import type { Editor } from "../core/commands";
import {
  clipboardSnapshot,
  subscribeClipboard,
  setClipboard,
  copyToClipboard,
  pasteFromClipboard,
} from "../edit/clipboard";
import { occurrences } from "../core/document";
import { ensure, uid, type Vec3 } from "../core/types";

export function ClipboardTools({
  editor,
  selection,
  layerId,
  crossLayer,
  position,
  onSelect,
}: {
  editor: Editor;
  selection: string[];
  layerId: string;
  crossLayer: boolean;
  position: Vec3;
  onSelect: (ids: string[]) => void;
}) {
  const copied = useSyncExternalStore(subscribeClipboard, clipboardSnapshot),
    hasCopy = !!copied;
  const [message, setMessage] = useState(""),
    [kind, setKind] = useState("linear"),
    [count, setCount] = useState(3),
    [delta, setDelta] = useState<Vec3>([80, 0, 0]),
    [angle, setAngle] = useState(45),
    [preview, setPreview] = useState<{
      revision: number;
      key: string;
      count: number;
    }>();
  const input = useRef<HTMLInputElement>(null);
  const attempt = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };
  const validSelection = () => {
    const selected = occurrences(editor.project).filter((o) =>
      selection.includes(o.id),
    );
    ensure(selected.length > 0, "INVALID_INPUT", "Select parts first");
    ensure(
      crossLayer || selected.every((o) => o.layerId === layerId),
      "LAYER_LOCKED",
      "Selection includes parts outside the active layer",
    );
  };
  const envelope = (
    type: string,
    payload: Record<string, unknown>,
    dryRun = false,
  ) => ({
    schemaVersion: 1 as const,
    commandId: uid(),
    expectedRevision: editor.revision,
    type,
    payload,
    dryRun,
  });
  const copy = (cut = false) =>
    attempt(() => {
      validSelection();
      copyToClipboard(editor, selection, layerId, crossLayer, cut);
      setMessage(
        cut ? "Cut to internal clipboard" : "Copied with referenced geometry",
      );
    });
  const paste = (atCursor = false) =>
    attempt(() => {
      const result = pasteFromClipboard(
        editor,
        layerId,
        atCursor ? position : undefined,
      );
      onSelect(result.addedIds);
      setMessage(`Pasted ${result.addedIds.length} occurrences`);
    });
  const arrayPayload = () => ({
    occurrenceIds: selection,
    activeLayerId: crossLayer ? undefined : layerId,
    kind,
    count,
    ...(kind === "linear"
      ? { delta }
      : { center: position, axis: [0, -1, 0], angleDegrees: angle }),
    maxAdditions: 10000,
  });
  return (
    <section className="clipboard-tools">
      <h3>Copy and repeat</h3>
      <div className="button-row">
        <button disabled={!selection.length} onClick={() => copy()}>
          Copy
        </button>
        <button disabled={!selection.length} onClick={() => copy(true)}>
          Cut
        </button>
        <button disabled={!hasCopy} onClick={() => paste()}>
          Paste in place
        </button>
        <button disabled={!hasCopy} onClick={() => paste(true)}>
          Paste at cursor
        </button>
      </div>
      <details>
        <summary>Portable clipboard</summary>
        <p className="muted">
          Fragments keep referenced geometry and applicable metadata. Clipboard
          stays in this tab; save a fragment to move it elsewhere.
        </p>
        <button
          disabled={!hasCopy}
          onClick={() =>
            attempt(() => {
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(copied)], {
                  type: "application/json",
                }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = "clipboard.brickfragment";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            })
          }
        >
          Save fragment
        </button>
        <button onClick={() => input.current?.click()}>Open fragment</button>
        <input
          ref={input}
          type="file"
          accept=".brickfragment,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void (async () => {
              ensure(
                file.size <= 16 * 1024 * 1024,
                "LIMIT_EXCEEDED",
                "Fragment exceeds 16 MiB",
              );
              const fragment = JSON.parse(await file.text());
              editor.dispatch(
                envelope("clipboard.paste", { fragment, layerId }, true),
              );
              setClipboard(fragment);
              setMessage("Fragment ready to paste");
            })().catch((e) => setMessage(e.message));
            e.target.value = "";
          }}
        />
      </details>
      <details>
        <summary>Linear or circular array</summary>
        <label>
          Pattern
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPreview(undefined);
            }}
          >
            <option value="linear">Linear</option>
            <option value="circular">Circular about cursor</option>
          </select>
        </label>
        <label>
          New copies
          <input
            type="number"
            min="1"
            max="1000"
            value={count}
            onChange={(e) => {
              setCount(Number(e.target.value));
              setPreview(undefined);
            }}
          />
        </label>
        {kind === "linear" ? (
          <div className="form-row">
            {["X", "Y", "Z"].map((axis, i) => (
              <label key={axis}>
                {axis} spacing
                <input
                  type="number"
                  value={delta[i]}
                  onChange={(e) => {
                    setDelta(
                      delta.map((v, j) =>
                        i === j ? Number(e.target.value) : v,
                      ) as Vec3,
                    );
                    setPreview(undefined);
                  }}
                />
              </label>
            ))}
          </div>
        ) : (
          <label>
            Angle per copy (degrees)
            <input
              type="number"
              value={angle}
              min="-360"
              max="360"
              onChange={(e) => {
                setAngle(Number(e.target.value));
                setPreview(undefined);
              }}
            />
          </label>
        )}
        <p className="muted">
          Circular arrays use the vertical axis through the placement cursor.
          Original parts remain.
        </p>
        <button
          disabled={!selection.length}
          onClick={() =>
            attempt(() => {
              validSelection();
              const payload = arrayPayload(),
                result = editor.dispatch(
                  envelope("parts.array", payload, true),
                );
              setPreview({
                revision: editor.revision,
                key: JSON.stringify(payload),
                count: result.addedIds.length,
              });
              setMessage(`Preview: ${result.addedIds.length} new occurrences`);
            })
          }
        >
          Preview array count
        </button>
        <button
          disabled={!preview}
          onClick={() =>
            attempt(() => {
              const payload = arrayPayload();
              ensure(
                preview &&
                  preview.revision === editor.revision &&
                  preview.key === JSON.stringify(payload),
                "REVISION_CONFLICT",
                "Selection or build changed. Preview again.",
              );
              const result = editor.dispatch(envelope("parts.array", payload));
              onSelect(result.addedIds);
              setPreview(undefined);
              setMessage(`Added ${result.addedIds.length} occurrences`);
            })
          }
        >
          Commit array
        </button>
      </details>
      <p role="status">{message}</p>
    </section>
  );
}
