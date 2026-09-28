import { useState } from "react";
import type { Editor } from "../core/commands";
import { occurrences } from "../core/document";
import { sharedDefinitionTargets } from "../core/models";
import { uid, type Vec3 } from "../core/types";
export function ModelTools({
  editor,
  selection,
  activeLayerId,
  onSelect,
}: {
  editor: Editor;
  selection: string[];
  activeLayerId?: string;
  onSelect: (ids: string[]) => void;
}) {
  const [name, setName] = useState("New submodel"),
    [pivot, setPivot] = useState<Vec3>([0, 0, 0]),
    [message, setMessage] = useState(""),
    [operation, setOperation] = useState<"recolor" | "move" | "rotate">(
      "recolor",
    ),
    [color, setColor] = useState("4"),
    [delta, setDelta] = useState<Vec3>([20, 0, 0]),
    [rotationPivot, setRotationPivot] = useState<Vec3>([0, 0, 0]),
    [rotationAxis, setRotationAxis] = useState("Y"),
    [degrees, setDegrees] = useState(90),
    [preview, setPreview] = useState<{
      revision: number;
      key: string;
      count: number;
      layers: string[];
    }>();
  const project = editor.project,
    chosen = occurrences(project).filter((o) => selection.includes(o.id)),
    definitionId = chosen[0]?.modelId;
  const sharedPayload = {
    definitionId,
    nodeIds: [...new Set(chosen.map((o) => o.node.id))],
    confirmShared: true,
    ...(activeLayerId ? { activeLayerId } : {}),
    operation,
    ...(operation === "recolor"
      ? { colorCode: color }
      : operation === "move"
        ? { delta }
        : {
            pivot: rotationPivot,
            axis: ["X", "Y", "Z"].map((a) => (a === rotationAxis ? 1 : 0)),
            degrees,
          }),
  };
  const key = JSON.stringify(sharedPayload);
  const attempt = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };
  const dispatch = (
    type: string,
    payload: Record<string, unknown>,
    dryRun = false,
  ) =>
    editor.dispatch({
      schemaVersion: 1,
      commandId: uid(),
      expectedRevision: project.revision,
      type,
      payload,
      dryRun,
    });
  const scope = {
    occurrenceIds: selection,
    ...(activeLayerId ? { activeLayerId } : {}),
  };
  const numbers = (values: Vec3, change: (v: Vec3) => void, prefix: string) => (
    <div className="field-row">
      {(["X", "Y", "Z"] as const).map((axis, i) => (
        <label key={axis}>
          {prefix} {axis}
          <input
            aria-label={`${prefix} ${axis}`}
            type="number"
            value={values[i]}
            onChange={(e) =>
              change(
                values.map((v, k) =>
                  k === i ? Number(e.target.value) : v,
                ) as Vec3,
              )
            }
          />
        </label>
      ))}
    </div>
  );
  return (
    <details className="model-tools drawer">
      <summary>Submodels and shared editing</summary>
      <p className="muted">
        Normal edits change only this copy. Shared edits change every copy.
      </p>
      <label>
        Submodel name
        <input
          value={name}
          maxLength={200}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      {numbers(pivot, setPivot, "Parent-local pivot")}
      <button
        disabled={!chosen.length}
        onClick={() =>
          attempt(() => {
            const result = dispatch("models.makeSubmodel", {
              ...scope,
              name,
              pivot,
            });
            onSelect(selection.map((id) => result.idRemappings[id] || id));
            setMessage(
              "Submodel created; layers, groups, plans and inventory overrides were preserved.",
            );
          })
        }
      >
        Make submodel
      </button>
      <p className="muted">
        Select neighbouring parts from one submodel. Nothing moves.
      </p>
      <button
        disabled={!chosen.length || chosen.some((o) => o.path.length < 2)}
        onClick={() =>
          attempt(() => {
            dispatch("models.makeUnique", scope);
            setMessage(
              "Selected submodel instance is independent. Occurrence IDs are unchanged.",
            );
          })
        }
      >
        Make this instance unique
      </button>
      <details>
        <summary>Edit shared definition</summary>
        <p className="muted">
          Select direct leaves from one definition. Movement and rotation below
          use that definition’s local coordinates. Locked or out-of-scope
          instances block the whole edit.
        </p>
        <label>
          Shared operation
          <select
            value={operation}
            onChange={(e) => {
              setOperation(e.target.value as typeof operation);
              setPreview(undefined);
            }}
          >
            <option value="recolor">Recolour all instances</option>
            <option value="move">Move all instances</option>
            <option value="rotate">Rotate all instances</option>
          </select>
        </label>
        {operation === "recolor" ? (
          <label>
            LDraw colour code
            <input
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                setPreview(undefined);
              }}
            />
          </label>
        ) : operation === "move" ? (
          numbers(delta, setDelta, "Shared move")
        ) : (
          <>
            <label>
              Shared rotation axis
              <select
                value={rotationAxis}
                onChange={(e) => setRotationAxis(e.target.value)}
              >
                {["X", "Y", "Z"].map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <label>
              Shared rotation degrees
              <input
                type="number"
                value={degrees}
                min={-360000}
                max={360000}
                onChange={(e) => setDegrees(Number(e.target.value))}
              />
            </label>
            {numbers(rotationPivot, setRotationPivot, "Shared rotation pivot")}
            <p className="muted">
              Rotate every selected definition leaf around this local pivot.
              Existing scale, shear and reflection are preserved.
            </p>
          </>
        )}
        <button
          disabled={
            !chosen.length || chosen.some((o) => o.modelId !== definitionId)
          }
          onClick={() =>
            attempt(() => {
              dispatch("models.editShared", sharedPayload, true);
              const targets = sharedDefinitionTargets(
                project,
                definitionId!,
                sharedPayload.nodeIds,
              );
              setPreview({
                revision: project.revision,
                key,
                count: targets.length,
                layers: [
                  ...new Set(
                    targets.map((o) => project.layers[o.layerId].name),
                  ),
                ],
              });
              setMessage("Review every affected instance before applying.");
            })
          }
        >
          Preview shared impact
        </button>
        {preview && (
          <>
            <p role="status">
              {preview.count} placed occurrences across{" "}
              {preview.layers.join(", ")}
            </p>
            <button
              disabled={
                preview.revision !== project.revision || preview.key !== key
              }
              onClick={() =>
                attempt(() => {
                  dispatch("models.editShared", sharedPayload);
                  setPreview(undefined);
                  setMessage(
                    "Shared definition edited as one undoable command.",
                  );
                })
              }
            >
              Apply to all {preview.count} occurrences
            </button>
          </>
        )}
      </details>
      <p role="status">{message}</p>
    </details>
  );
}
