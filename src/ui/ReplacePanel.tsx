import { useId, useState } from "react";
import { catalog } from "../catalog/catalog";
import type { Occurrence, Project } from "../core/types";
import { planReplacement, type ReplaceAnchor } from "../edit/replace";

/** Replace selected catalogue parts, keeping layer and colour (spec §10.3). */
export function ReplacePanel({
  project,
  all,
  selected,
  activeLayerId,
  crossLayer,
  onReplace,
}: {
  project: Project;
  all: Occurrence[];
  selected: Occurrence[];
  activeLayerId: string;
  crossLayer: boolean;
  onReplace: (
    payloads: ReturnType<typeof planReplacement>["payloads"],
  ) => unknown;
}) {
  const id = useId();
  const [target, setTarget] = useState("");
  const [anchor, setAnchor] = useState<ReplaceAnchor>("bottom");
  const [allMatching, setAllMatching] = useState(false);
  const inScope = (o: Occurrence) =>
    o.visible &&
    !project.layers[o.layerId]?.locked &&
    (crossLayer || o.layerId === activeLayerId);
  const refs = new Set(selected.map((o) => o.node.ref));
  // Resolve stable IDs before execution; hidden, locked and out-of-scope parts stay unchanged.
  const members = allMatching
    ? all.filter((o) => refs.has(o.node.ref) && inScope(o))
    : selected;
  const plan = target ? planReplacement(members, target, anchor) : undefined;
  const scope = crossLayer ? "all editable layers" : "the active layer";
  return (
    <details className="replace-panel">
      <summary>Replace part…</summary>
      <label>
        Replace with
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">Choose a part</option>
          {Object.values(catalog).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.id.replace(".dat", "")})
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Keep in place</legend>
        {(
          [
            ["bottom", "Bottom (stays on what is below)"],
            ["top", "Top (stays under what is above)"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="check">
            <input
              type="radio"
              name={id + "-anchor"}
              checked={anchor === value}
              onChange={() => setAnchor(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <label className="check">
        <input
          type="checkbox"
          checked={allMatching}
          onChange={(e) => setAllMatching(e.target.checked)}
        />
        All matching parts in {scope}
      </label>
      {plan && (
        <div className="replace-preview" role="status">
          <p>
            {plan.replaced
              ? `Replaces ${plan.replaced} part${plan.replaced === 1 ? "" : "s"} in ${scope} with ${plan.target?.name}; colour and layer are kept.`
              : "Nothing to replace."}
            {plan.unchanged ? ` ${plan.unchanged} already match.` : ""}
            {plan.excluded
              ? ` ${plan.excluded} raw, custom or missing part${plan.excluded === 1 ? " is" : "s are"} skipped.`
              : ""}
            {allMatching ? " Hidden and locked parts are not changed." : ""}
          </p>
          {plan.changes.map((c) => (
            <p key={c.from} className="muted">
              {c.count} × {c.from}:{" "}
              {c.heightChange
                ? `${Math.abs(c.heightChange) / 8} plate${Math.abs(c.heightChange) === 8 ? "" : "s"} ${c.heightChange > 0 ? "taller" : "lower"}`
                : "same height"}
              ,{" "}
              {c.footprint === "same"
                ? "same footprint"
                : `${c.footprint} footprint`}
            </p>
          ))}
          {plan.mayOverlap && (
            <p className="warning-text">
              The new part is larger or taller and may overlap neighbouring
              parts. Check the result; undo restores the original.
            </p>
          )}
        </div>
      )}
      <button
        className="wide"
        disabled={!plan?.replaced}
        onClick={() => plan && void onReplace(plan.payloads)}
      >
        {plan?.replaced
          ? `Replace ${plan.replaced} part${plan.replaced === 1 ? "" : "s"}`
          : "Replace"}
      </button>
    </details>
  );
}
