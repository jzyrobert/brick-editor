import type { SelectionOperation } from "../edit/selection";
import type { RegionMode } from "../render/region-selection";
export type SelectionShape = "click" | "box" | "lasso";
export function SelectionTools({
  shape,
  operation,
  depth,
  onShape,
  onOperation,
  onDepth,
  onMatch,
  onClear,
  hasSelection,
}: {
  shape: SelectionShape;
  operation: SelectionOperation;
  depth: RegionMode;
  onShape: (v: SelectionShape) => void;
  onOperation: (v: SelectionOperation) => void;
  onDepth: (v: RegionMode) => void;
  onMatch: (v: "part" | "color" | "layer" | "all") => void;
  onClear: () => void;
  hasSelection: boolean;
}) {
  return (
    <details className="selection-tools drawer">
      <summary>Selection tools</summary>
      <label>
        Gesture
        <select
          aria-label="Selection gesture"
          value={shape}
          onChange={(e) => onShape(e.target.value as SelectionShape)}
        >
          <option value="click">Click / tap</option>
          <option value="box">Box</option>
          <option value="lasso">Lasso</option>
        </select>
      </label>
      <label>
        Selection action
        <select
          aria-label="Selection action"
          value={operation}
          onChange={(e) => onOperation(e.target.value as SelectionOperation)}
        >
          <option value="replace">Replace selection</option>
          <option value="add">Add to selection</option>
          <option value="remove">Remove from selection</option>
          <option value="toggle">Toggle selection</option>
        </select>
      </label>
      {shape !== "click" && (
        <>
          <label>
            Depth
            <select
              aria-label="Selection depth"
              value={depth}
              onChange={(e) => onDepth(e.target.value as RegionMode)}
            >
              <option value="visible">Visible surfaces</option>
              <option value="through">Through the build</option>
            </select>
          </label>
          <p className="muted">
            Drag on the model. Escape or a second finger cancels.
          </p>
        </>
      )}
      <div className="selection-match">
        {(["part", "color", "layer"] as const).map((kind) => (
          <button
            key={kind}
            disabled={!hasSelection}
            onClick={() => onMatch(kind)}
          >
            Match {kind}
          </button>
        ))}
        <button onClick={() => onMatch("all")}>Select editable parts</button>
        <button onClick={onClear}>Clear selection</button>
      </div>
      <p className="muted">Hidden and locked parts are skipped.</p>
    </details>
  );
}
