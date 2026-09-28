import { LayerFolders } from "./LayerFolders";
import { useEffect, useId, useMemo, useState } from "react";
import { occurrences } from "../core/document";
import type { Project } from "../core/types";

export function LayerActions({
  project,
  layerId,
  dispatch,
  onRemoved,
  onCreated,
  ghostOtherLayers = false,
  onGhostChange,
}: {
  project: Project;
  layerId: string;
  dispatch: (
    type: string,
    payload: Record<string, unknown>,
  ) => unknown | Promise<unknown>;
  onRemoved?: (destinationLayerId: string) => void;
  onCreated?: (layerId: string) => void;
  ghostOtherLayers?: boolean;
  onGhostChange?: (enabled: boolean) => void;
}) {
  const [confirm, setConfirm] = useState(false),
    [mode, setMode] = useState("reassign"),
    [destination, setDestination] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const group = useId();
  const layers = Object.values(project.layers).sort(
      (a, b) => a.order - b.order,
    ),
    layer = project.layers[layerId],
    index = layers.findIndex((l) => l.id === layerId);
  const destinations = layers.filter((l) => l.id !== layerId && !l.locked),
    target = destinations.some((l) => l.id === destination)
      ? destination
      : (destinations.find((l) => l.id === project.defaultLayerId)?.id ??
        destinations[0]?.id ??
        "");
  const count = useMemo(
    () => occurrences(project).filter((o) => o.layerId === layerId).length,
    [project, layerId],
  );
  useEffect(() => {
    setConfirm(false);
    setError("");
    setMode("reassign");
  }, [layerId]);
  if (!layer) return null;
  async function act(fn: () => unknown | Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  function reorder(direction: number) {
    const ids = layers.map((l) => l.id);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    return act(() => dispatch("layers.reorder", { layerIds: ids }));
  }
  return (
    <section aria-label="Layer order and removal">
      {onGhostChange && (
        <label className="check">
          <input
            type="checkbox"
            checked={ghostOtherLayers}
            onChange={(e) => onGhostChange(e.target.checked)}
          />
          Ghost other layers
        </label>
      )}
      <details className="drawer">
        <summary>Layer options</summary>
        <button
          className="wide"
          disabled={busy}
          onClick={() =>
            void act(async () => {
              const result = (await dispatch("layers.duplicate", {
                layerId,
                includeHidden: true,
                maxAdditions: 10000,
              })) as { addedLayerIds?: string[] };
              if (result?.addedLayerIds?.[0])
                onCreated?.(result.addedLayerIds[0]);
            })
          }
        >
          Duplicate layer ({count} parts)
        </button>
        <div className="button-row">
          <button
            disabled={busy || index <= 0}
            onClick={() => void reorder(-1)}
          >
            Move layer up
          </button>
          <button
            disabled={busy || index >= layers.length - 1}
            onClick={() => void reorder(1)}
          >
            Move layer down
          </button>
        </div>
        {!confirm ? (
          <button
            className="wide danger"
            disabled={busy || layer.locked || layers.length < 2 || !target}
            onClick={() => setConfirm(true)}
          >
            Remove layer…
          </button>
        ) : (
          <div className="layer-removal">
            <h3>Remove “{layer.name}”?</h3>
            <p>
              {count} placed occurrences belong to this layer. Choose what
              happens to them. You can undo this change.
            </p>
            <label className="check">
              <input
                type="radio"
                name={group}
                checked={mode === "reassign"}
                onChange={() => setMode("reassign")}
              />
              Keep parts and move them to another layer
            </label>
            <label className="check">
              <input
                type="radio"
                name={group}
                checked={mode === "delete-contents"}
                onChange={() => setMode("delete-contents")}
              />
              Delete this layer and its parts
            </label>
            <label className="number-field">
              <span>
                {mode === "reassign"
                  ? "Move parts to"
                  : "Use as remaining active layer"}
              </span>
              <select
                value={target}
                onChange={(e) => setDestination(e.target.value)}
              >
                {destinations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            {layerId === project.defaultLayerId && (
              <p>The selected destination becomes the default layer.</p>
            )}
            <button
              className="wide danger"
              disabled={busy || layer.locked || !target}
              onClick={() =>
                void act(async () => {
                  await dispatch("layers.remove", {
                    layerId,
                    mode,
                    destinationLayerId: target,
                  });
                  setConfirm(false);
                  onRemoved?.(target);
                })
              }
            >
              {mode === "reassign"
                ? `Move ${count} parts and remove layer`
                : `Delete layer and ${count} parts`}
            </button>
            <button
              className="wide"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              Keep layer
            </button>
          </div>
        )}
        {layer.locked && (
          <p className="muted">Unlock this layer before removing it.</p>
        )}
        {layers.length < 2 && (
          <p className="muted">Keep at least one layer in the build.</p>
        )}
        {layers.length > 1 && !target && (
          <p className="muted">
            Unlock another layer to use as the destination.
          </p>
        )}
      </details>
      <LayerFolders project={project} layerId={layerId} dispatch={dispatch} />
      <p role="status">{error}</p>
    </section>
  );
}
