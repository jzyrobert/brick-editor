import { useEffect, useRef, useState } from "react";
import type { Editor } from "../core/commands";
import type { SceneAdapter } from "../render/adapter";
import { TransformGesture } from "../edit/transform-gesture";
import { ensure, type Vec3 } from "../core/types";
import { identity, mv } from "../core/math";
import { occurrences } from "../core/document";
import { axisRotation } from "../mechanisms/kinematic";
export function TransformPanel({
  editor,
  renderer,
  selection,
  revision,
  enabled,
  activeLayerId,
  report,
  modeRequest,
}: {
  editor: Editor;
  renderer: () => SceneAdapter | undefined;
  selection: string[];
  revision: number;
  enabled: boolean;
  activeLayerId?: string;
  report: (message: string) => void;
  modeRequest?: { mode: "off" | "translate" | "rotate"; nonce: number };
}) {
  const [mode, setMode] = useState<"off" | "translate" | "rotate">("off"),
    [snap, setSnap] = useState(true),
    [dragging, setDragging] = useState(false),
    [delta, setDelta] = useState<Vec3>([0, 0, 0]),
    [degrees, setDegrees] = useState(15),
    [axis, setAxis] = useState<"X" | "Y" | "Z">("Y");
  const binding = useRef<
      { cancel: () => void; dispose: () => void } | undefined
    >(undefined),
    refs = useRef({ renderer, report });
  refs.current = { renderer, report };
  useEffect(() => {
    if (modeRequest) setMode(modeRequest.mode);
  }, [modeRequest]);
  const selectionKey = JSON.stringify(selection);
  useEffect(() => {
    if (!enabled || !selection.length || mode === "off") return;
    let cancelled = false,
      gesture: TransformGesture | undefined,
      handles: typeof binding.current;
    const r = refs.current.renderer();
    if (!r) return;
    void r
      .ready(revision)
      .then(() => {
        if (cancelled) return;
        gesture = new TransformGesture(editor, r);
        const request = {
          occurrenceIds: selection,
          ...(activeLayerId ? { activeLayerId } : {}),
        };
        handles = r.bindTransformHandles({
          occurrenceIds: selection,
          mode,
          translationSnap: snap ? 20 : null,
          rotationSnapDegrees: snap ? 15 : null,
          onStart: () => {
            gesture!.begin(request);
            setDragging(true);
            refs.current.report(
              "Transform preview: release to apply, Escape or Cancel to discard.",
            );
          },
          onPreview: (d) => gesture!.preview(d),
          onCommit: () => {
            gesture!.commit();
            setDragging(false);
            refs.current.report("Transform applied as one undoable edit.");
          },
          onCancel: () => {
            gesture?.cancel();
            setDragging(false);
          },
          onError: (error) =>
            refs.current.report(
              error instanceof Error ? error.message : String(error),
            ),
        });
        binding.current = handles;
      })
      .catch((error) => refs.current.report(error.message));
    return () => {
      cancelled = true;
      handles?.dispose();
      gesture?.dispose();
      if (binding.current === handles) binding.current = undefined;
    };
  }, [editor, enabled, selectionKey, revision, mode, snap, activeLayerId]);
  const numeric = async (kind: "move" | "rotate") => {
    let gesture: TransformGesture | undefined;
    try {
      binding.current?.cancel();
      const r = refs.current.renderer();
      ensure(r, "WEBGL_UNAVAILABLE", "The renderer is unavailable.");
      await r.ready(revision);
      ensure(
        editor.project.revision === revision,
        "REVISION_CONFLICT",
        "Selection changed; try again.",
      );
      gesture = new TransformGesture(editor, r);
      gesture.begin({
        occurrenceIds: selection,
        ...(activeLayerId ? { activeLayerId } : {}),
      });
      let transform = { ...identity(), position: delta };
      if (kind === "rotate") {
        const selected = occurrences(editor.project).filter((o) =>
            selection.includes(o.id),
          ),
          pivot = selected.reduce(
            (p, o) =>
              p.map(
                (v, i) => v + o.transform.position[i] / selected.length,
              ) as Vec3,
            [0, 0, 0] as Vec3,
          );
        const basis = axisRotation(
            axis === "X" ? [1, 0, 0] : axis === "Y" ? [0, 1, 0] : [0, 0, 1],
            degrees,
          ),
          rotated = mv(basis, pivot);
        transform = {
          basis,
          position: pivot.map((v, i) => v - rotated[i]) as Vec3,
        };
      }
      gesture.preview(transform);
      gesture.commit();
      refs.current.report("Transform applied as one undoable edit.");
    } catch (error) {
      refs.current.report(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      gesture?.dispose();
    }
  };
  if (!enabled || !selection.length) return null;
  return (
    <section aria-label="Transform selection" className="transform-panel">
      <h3>Transform selection</h3>
      <div className="button-row">
        <button
          aria-pressed={mode === "translate"}
          onClick={() => setMode(mode === "translate" ? "off" : "translate")}
        >
          Move handles
        </button>
        <button
          aria-pressed={mode === "rotate"}
          onClick={() => setMode(mode === "rotate" ? "off" : "rotate")}
        >
          Rotate handles
        </button>
        {mode !== "off" && (
          <button onClick={() => setMode("off")}>Hide handles</button>
        )}
      </div>
      <label>
        <input
          type="checkbox"
          checked={snap}
          onChange={(e) => setSnap(e.target.checked)}
        />{" "}
        Snap handles to 20 LDU / 15°
      </label>
      <p className="muted">
        Drag a coloured axis or ring. Two fingers navigate and cancel the edit.
        World axes preserve imported transforms.
      </p>
      {dragging && (
        <button onClick={() => binding.current?.cancel()}>
          Cancel transform
        </button>
      )}
      <details>
        <summary>Exact move and rotation</summary>
        <div className="field-row">
          {(["X", "Y", "Z"] as const).map((name, i) => (
            <label key={name}>
              Move {name} (LDU)
              <input
                aria-label={`Move ${name} delta`}
                type="number"
                value={delta[i]}
                onChange={(e) =>
                  setDelta(
                    delta.map((v, k) =>
                      k === i ? Number(e.target.value) : v,
                    ) as Vec3,
                  )
                }
              />
            </label>
          ))}
        </div>
        <button onClick={() => void numeric("move")}>Apply exact move</button>
        <label>
          Rotation axis
          <select
            value={axis}
            onChange={(e) => setAxis(e.target.value as typeof axis)}
          >
            <option>X</option>
            <option>Y</option>
            <option>Z</option>
          </select>
        </label>
        <label>
          Rotation degrees
          <input
            type="number"
            value={degrees}
            onChange={(e) => setDegrees(Number(e.target.value))}
          />
        </label>
        <button onClick={() => void numeric("rotate")}>
          Apply exact rotation
        </button>
        <p className="muted">
          Exact rotation uses the selected part origins’ centre. Handle rotation
          uses the visible bounds’ centre.
        </p>
      </details>
    </section>
  );
}
