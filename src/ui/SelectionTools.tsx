import type { SelectionOperation } from "../edit/selection";
import type { RegionShape } from "../edit/region-gesture";
import type { Containment, RegionMode } from "../render/region-selection";
export const RULE_LABELS: Record<Containment, string> = {
  touching: "Touching the region",
  centre: "Centre inside",
  inside: "Fully inside",
};
export const DEPTH_HELP: Record<RegionMode, string> = {
  visible: "Only parts you can see from here.",
  through: "Everything inside the outline, front to back.",
};
/** A small two- or three-way switch of pressed buttons. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={"segmented " + className} role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
export function SelectionTools({
  shape,
  operation,
  depth,
  rule,
  floorOnly,
  regionMode,
  onShape,
  onOperation,
  onDepth,
  onRule,
  onFloorOnly,
  onRegionMode,
  onMatch,
  onConnected,
  onClear,
  hasSelection,
}: {
  shape: RegionShape;
  operation: SelectionOperation;
  depth: RegionMode;
  rule: Containment;
  floorOnly: boolean;
  regionMode: boolean;
  onShape: (v: RegionShape) => void;
  onOperation: (v: SelectionOperation) => void;
  onDepth: (v: RegionMode) => void;
  onRule: (v: Containment) => void;
  onFloorOnly: (v: boolean) => void;
  onRegionMode: (v: boolean) => void;
  onMatch: (v: "part" | "color" | "layer" | "all") => void;
  /** Adds every part joined to the selection by verified stud connections. */
  onConnected: () => void;
  onClear: () => void;
  hasSelection: boolean;
}) {
  return (
    <details className="selection-tools drawer">
      <summary>Selection tools</summary>
      <button
        className="region-start"
        aria-pressed={regionMode}
        onClick={() => onRegionMode(!regionMode)}
      >
        {regionMode ? "Stop box select" : "Box or lasso select"}
      </button>
      <p className="muted">
        One finger draws, two fingers still move the view. With a mouse, drag
        with Select: Shift adds, Alt removes, L switches box and lasso.
      </p>
      <Segmented
        label="Region shape"
        value={shape}
        options={[
          ["box", "Box"],
          ["lasso", "Lasso"],
        ]}
        onChange={onShape}
      />
      <Segmented
        label="Selection depth"
        value={depth}
        options={[
          ["visible", "Visible"],
          ["through", "Through"],
        ]}
        onChange={onDepth}
      />
      <p className="muted">{DEPTH_HELP[depth]}</p>
      <label>
        A part counts when
        <select
          aria-label="Region rule"
          value={rule}
          onChange={(e) => onRule(e.target.value as Containment)}
        >
          {(Object.keys(RULE_LABELS) as Containment[]).map((r) => (
            <option key={r} value={r}>
              {RULE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <label className="floor-check">
        <input
          type="checkbox"
          checked={floorOnly}
          onChange={(e) => onFloorOnly(e.target.checked)}
        />
        Only the focused floor
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
        <button disabled={!hasSelection} onClick={onConnected}>
          Select connected
        </button>
        <button onClick={() => onMatch("all")}>Select editable parts</button>
        <button onClick={onClear}>Clear selection</button>
      </div>
      <p className="muted">
        Hidden, cut-away and locked parts are skipped. Select connected follows
        verified stud connections only.
      </p>
    </details>
  );
}
