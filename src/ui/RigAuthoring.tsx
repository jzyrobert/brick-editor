import { useState } from "react";
import { colors } from "../catalog/catalog";
import type { Editor } from "../core/commands";
import { occurrences } from "../core/document";
import { uid, type Vec3, type Transform } from "../core/types";
import {
  buildHingeRig,
  buildVehicleRig,
  rigDraftCommand,
} from "../mechanisms/authoring";

const frame = (position: Vec3): Transform => ({
  position,
  basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
});
const axis = (name: string): Vec3 => [
  name === "X" ? 1 : 0,
  name === "Y" ? 1 : 0,
  name === "Z" ? 1 : 0,
];
type WheelDraft = {
  id: string;
  occurrenceIds: string[];
  center: Vec3;
  axis: string;
  radius: number;
  steering: boolean;
};
const wheel = (): WheelDraft => ({
  id: uid(),
  occurrenceIds: [],
  center: [0, 0, 0],
  axis: "X",
  radius: 12,
  steering: false,
});

export function RigAuthoring({
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
  const [kind, setKind] = useState<"hinge" | "vehicle">("hinge"),
    [name, setName] = useState("My mechanism"),
    [rigId, setRigId] = useState(uid),
    [fixed, setFixed] = useState<string[]>([]),
    [moving, setMoving] = useState<string[]>([]),
    [pivot, setPivot] = useState<Vec3>([0, 0, 0]),
    [hingeAxis, setHingeAxis] = useState("Y"),
    [minimum, setMinimum] = useState(0),
    [maximum, setMaximum] = useState(90),
    [chassis, setChassis] = useState<string[]>([]),
    [chassisCenter, setChassisCenter] = useState<Vec3>([0, 0, 0]),
    [wheels, setWheels] = useState<WheelDraft[]>(() => [wheel(), wheel()]),
    [wheelbase, setWheelbase] = useState(40),
    [maxSteer, setMaxSteer] = useState(35),
    [maxSpeed, setMaxSpeed] = useState(100),
    [message, setMessage] = useState(""),
    [filter, setFilter] = useState(""),
    [preview, setPreview] = useState<{
      key: string;
      result: ReturnType<typeof buildHingeRig>;
    }>();
  const project = editor.project;
  const available = occurrences(project)
    .filter(
      (o) =>
        o.visible &&
        !project.layers[o.layerId].locked &&
        (!activeLayerId || o.layerId === activeLayerId),
    )
    .filter((o) =>
      `${o.node.ref ?? "drawing"} ${o.id}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
    );
  const key = JSON.stringify({
    kind,
    name,
    rigId,
    fixed,
    moving,
    pivot,
    hingeAxis,
    minimum,
    maximum,
    chassis,
    chassisCenter,
    wheels,
    wheelbase,
    maxSteer,
    maxSpeed,
    revision: project.revision,
    projectId: project.id,
    activeLayerId,
  });
  const currentPreview = preview?.key === key ? preview.result : undefined;
  const attempt = (action: () => void) => {
    try {
      action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };
  const assign = (change: (ids: string[]) => void) =>
    attempt(() => {
      if (!selection.length)
        throw new Error("Select parts in the canvas before assigning a group.");
      const all = new Map(occurrences(project).map((o) => [o.id, o]));
      for (const id of selection) {
        const o = all.get(id);
        if (
          !o ||
          project.layers[o.layerId].locked ||
          !o.visible ||
          (activeLayerId && o.layerId !== activeLayerId)
        )
          throw new Error(
            "Every selected part must exist, be unlocked and visible, and belong to the active edit scope.",
          );
      }
      change([...selection]);
      setMessage(
        "Selection assigned. Review the group count before previewing.",
      );
    });
  const dispatch = (result: ReturnType<typeof buildHingeRig>, dryRun = false) =>
    editor.dispatch({ ...rigDraftCommand(result, uid()), dryRun });
  const prepare = () =>
    attempt(() => {
      setPreview(undefined);
      const common = {
        id: rigId,
        name,
        expectedRevision: project.revision,
        ...(activeLayerId ? { activeLayerId } : {}),
      };
      const result =
        kind === "hinge"
          ? buildHingeRig(project, {
              ...common,
              fixed: { id: "fixed", occurrenceIds: fixed, frame: frame(pivot) },
              moving: {
                id: "moving",
                occurrenceIds: moving,
                frame: frame(pivot),
              },
              pivotWorld: pivot,
              axisWorld: axis(hingeAxis),
              limits: [minimum, maximum],
            })
          : buildVehicleRig(project, {
              ...common,
              chassis: {
                id: "chassis",
                occurrenceIds: chassis,
                frame: frame(chassisCenter),
              },
              wheels: wheels.map((w) => ({
                id: w.id,
                occurrenceIds: w.occurrenceIds,
                frame: frame(w.center),
                axisLocal: axis(w.axis),
                radius: w.radius,
                steering: w.steering,
              })),
              wheelbase,
              maxSteerDegrees: maxSteer,
              maxSpeed,
            });
      dispatch(result, true);
      setPreview({ key, result });
      setMessage(
        "Preview validated. Creating the rig records one undoable edit; it does not move parts.",
      );
    });
  const group = (
    label: string,
    ids: string[],
    change: (ids: string[]) => void,
  ) => (
    <div className="rig-group">
      <strong>
        {label}: {ids.length} parts
      </strong>
      <div className="rig-actions">
        <button disabled={!selection.length} onClick={() => assign(change)}>
          Assign selection to {label.toLowerCase()}
        </button>
        <button disabled={!ids.length} onClick={() => onSelect(ids)}>
          Show {label.toLowerCase()} parts
        </button>
        <button disabled={!ids.length} onClick={() => change([])}>
          Clear {label.toLowerCase()}
        </button>
      </div>
    </div>
  );
  const vector = (label: string, value: Vec3, change: (v: Vec3) => void) => (
    <fieldset>
      <legend>{label} (world LDU)</legend>
      <div className="rig-vector">
        {["X", "Y", "Z"].map((a, i) => (
          <label key={a}>
            {a}
            <input
              aria-label={`${label} ${a}`}
              type="number"
              value={value[i]}
              onChange={(e) =>
                change(
                  value.map((v, j) =>
                    i === j ? Number(e.target.value) : v,
                  ) as Vec3,
                )
              }
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
  const axisSelect = (
    label: string,
    value: string,
    change: (v: string) => void,
  ) => (
    <label>
      {label}
      <select value={value} onChange={(e) => change(e.target.value)}>
        {["X", "Y", "Z"].map((a) => (
          <option key={a}>{a}</option>
        ))}
      </select>
    </label>
  );
  return (
    <details className="rig-authoring">
      <summary>Create a hinge or vehicle</summary>
      <p>
        Assign selected parts to separate rigid groups, then preview and create
        one kinematic rig. Connections and wheel contact are not inferred or
        physically validated.
      </p>
      <p>
        World coordinates use LDU; negative Y points up. All group frames align
        with world axes. Current selection: {selection.length} parts.
      </p>
      <details className="rig-picker">
        <summary>Choose parts for assignment</summary>
        <p>
          These checkboxes change the editor selection. Only visible, unlocked
          parts in the current edit scope are listed.
        </p>
        <label>
          Find rig parts
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Part reference or occurrence ID"
          />
        </label>
        <button onClick={() => onSelect([])}>Clear rig selection</button>
        <div className="rig-parts">
          {available.slice(0, 80).map((o, index) => (
            <label className="rig-check" key={o.id}>
              <input
                type="checkbox"
                aria-label={`Select ${o.node.ref ?? "drawing"} · part ${index + 1}`}
                aria-describedby={`rig-part-detail-${index}`}
                checked={selection.includes(o.id)}
                onChange={(e) =>
                  onSelect(
                    e.target.checked
                      ? [...selection, o.id]
                      : selection.filter((id) => id !== o.id),
                  )
                }
              />
              <span className="rig-part-description">
                <span>
                  {o.node.ref ?? "drawing"} · part {index + 1}
                </span>
                <span
                  id={`rig-part-detail-${index}`}
                  className="rig-part-detail"
                >
                  {colors.find((color) => color.code === o.colorCode)?.name ??
                    `LDraw colour ${o.colorCode}`}{" "}
                  · world (
                  {o.transform.position
                    .map((value) => Number(value.toFixed(2)))
                    .join(", ")}
                  ) LDU
                </span>
              </span>
            </label>
          ))}
        </div>
        {available.length > 80 && (
          <p>
            Showing the first 80 matches. Narrow the search to find other parts.
          </p>
        )}
      </details>
      <label>
        Rig type
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
        >
          <option value="hinge">Hinge</option>
          <option value="vehicle">Planar vehicle</option>
        </select>
      </label>
      <label>
        Rig name
        <input
          value={name}
          maxLength={200}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      {kind === "hinge" ? (
        <>
          {group("Fixed group", fixed, setFixed)}
          {group("Moving group", moving, setMoving)}
          {vector("Hinge pivot", pivot, setPivot)}
          {axisSelect("Hinge world axis", hingeAxis, setHingeAxis)}
          <div className="rig-pair">
            <label>
              Minimum angle (degrees)
              <input
                type="number"
                value={minimum}
                onChange={(e) => setMinimum(Number(e.target.value))}
              />
            </label>
            <label>
              Maximum angle (degrees)
              <input
                type="number"
                value={maximum}
                onChange={(e) => setMaximum(Number(e.target.value))}
              />
            </label>
          </div>
        </>
      ) : (
        <>
          {group("Chassis", chassis, setChassis)}
          {vector("Chassis origin", chassisCenter, setChassisCenter)}
          {wheels.map((w, index) => (
            <fieldset key={w.id}>
              <legend>Wheel {index + 1}</legend>
              {group(`Wheel ${index + 1}`, w.occurrenceIds, (ids) =>
                setWheels(
                  wheels.map((item) =>
                    item.id === w.id ? { ...item, occurrenceIds: ids } : item,
                  ),
                ),
              )}
              {vector(`Wheel ${index + 1} center`, w.center, (center) =>
                setWheels(
                  wheels.map((item) =>
                    item.id === w.id ? { ...item, center } : item,
                  ),
                ),
              )}
              {axisSelect(`Wheel ${index + 1} axle`, w.axis, (axis) =>
                setWheels(
                  wheels.map((item) =>
                    item.id === w.id ? { ...item, axis } : item,
                  ),
                ),
              )}
              <label>
                Wheel {index + 1} radius (LDU)
                <input
                  type="number"
                  min="0.1"
                  value={w.radius}
                  onChange={(e) =>
                    setWheels(
                      wheels.map((item) =>
                        item.id === w.id
                          ? { ...item, radius: Number(e.target.value) }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <label className="rig-check">
                <input
                  type="checkbox"
                  checked={w.steering}
                  onChange={(e) =>
                    setWheels(
                      wheels.map((item) =>
                        item.id === w.id
                          ? { ...item, steering: e.target.checked }
                          : item,
                      ),
                    )
                  }
                />
                Wheel {index + 1} steers
              </label>
              <button
                disabled={wheels.length <= 1}
                onClick={() =>
                  setWheels(wheels.filter((item) => item.id !== w.id))
                }
              >
                Remove wheel {index + 1}
              </button>
            </fieldset>
          ))}
          <button
            disabled={wheels.length >= 8}
            onClick={() => setWheels([...wheels, wheel()])}
          >
            Add wheel group
          </button>
          <label>
            Wheelbase (LDU)
            <input
              type="number"
              min="1"
              value={wheelbase}
              onChange={(e) => setWheelbase(Number(e.target.value))}
            />
          </label>
          <label>
            Maximum steering (degrees)
            <input
              type="number"
              min="0.1"
              max="79.9"
              value={maxSteer}
              onChange={(e) => setMaxSteer(Number(e.target.value))}
            />
          </label>
          <label>
            Maximum speed (LDU per second)
            <input
              type="number"
              min="0.1"
              max="10000"
              value={maxSpeed}
              onChange={(e) => setMaxSpeed(Number(e.target.value))}
            />
          </label>
        </>
      )}
      <button className="wide" onClick={prepare}>
        Preview rig assignment
      </button>
      {currentPreview && (
        <div className="rig-preview">
          <strong>
            {currentPreview.rig.name}:{" "}
            {currentPreview.affectedOccurrenceIds.length} affected parts in{" "}
            {currentPreview.rig.groups.length} groups
          </strong>
          <p>
            Source revision {currentPreview.sourceRevision}. Parts remain at
            their authored rest positions.
          </p>
          <button
            onClick={() => onSelect(currentPreview.affectedOccurrenceIds)}
          >
            Show all affected parts
          </button>
          {currentPreview.warnings.map((warning, i) => (
            <p key={i}>{warning}</p>
          ))}
        </div>
      )}
      <button
        className="primary wide"
        disabled={!currentPreview}
        onClick={() =>
          attempt(() => {
            if (!currentPreview) return;
            dispatch(currentPreview);
            setPreview(undefined);
            setRigId(uid());
            setFixed([]);
            setMoving([]);
            setChassis([]);
            setWheels([wheel(), wheel()]);
            setMessage(
              "Rig created. Open Play to preview the mechanism. Undo restores the previous project.",
            );
          })
        }
      >
        Create rig
      </button>
      {preview && !currentPreview && (
        <p>
          Draft or project changed. Preview the assignment again before
          creating.
        </p>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </details>
  );
}
