import { useMemo, useState } from "react";
import { colors } from "../catalog/catalog";
import type { Editor } from "../core/commands";
import { occurrences } from "../core/document";
import { uid, type Project, type Vec3, type Transform } from "../core/types";
import {
  buildJointRig,
  rigAuthoringRequest,
  type JointRigRequest,
  buildVehicleRig,
  rigDraftCommand,
} from "../mechanisms/authoring";

type RigKind = "hinge" | "fixed" | "prismatic" | "spherical" | "vehicle";
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
  axis: Vec3;
  basis?: Transform["basis"];
  radius: number;
  steering: boolean;
};
const wheel = (): WheelDraft => ({
  id: uid(),
  occurrenceIds: [],
  center: [0, 0, 0],
  axis: [1, 0, 0],
  radius: 12,
  steering: false,
});

export function RigAuthoring({
  editor,
  project,
  selection,
  activeLayerId,
  onSelect,
}: {
  editor: Editor;
  /** The workspace's current snapshot; reading `editor.project` here deep-copied
   * the whole document on every workspace render. */
  project: Project;
  selection: string[];
  activeLayerId?: string;
  onSelect: (ids: string[]) => void;
}) {
  const [kind, setKind] = useState<RigKind>("hinge"),
    [name, setName] = useState("My mechanism"),
    [rigId, setRigId] = useState<string>(uid),
    [fixed, setFixed] = useState<string[]>([]),
    [moving, setMoving] = useState<string[]>([]),
    [pivot, setPivot] = useState<Vec3>([0, 0, 0]),
    [hingeAxis, setHingeAxis] = useState<Vec3>([0, 1, 0]),
    [bounded, setBounded] = useState(true),
    [existingId, setExistingId] = useState(""),
    [editing, setEditing] = useState<{
      id: string;
      revision: number;
      projectId: string;
    }>(),
    [fixedFrame, setFixedFrame] = useState<Transform>(),
    [movingFrame, setMovingFrame] = useState<Transform>(),
    [groupIds, setGroupIds] = useState({
      fixed: "fixed",
      moving: "moving",
      chassis: "chassis",
      joint: "hinge",
    }),
    [motor, setMotor] = useState<JointRigRequest["motor"]>(),
    [chassisBasis, setChassisBasis] = useState<Transform["basis"]>(),
    [removal, setRemoval] = useState<{
      key: string;
      revision: number;
      count: number;
    }>(),
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
      result: ReturnType<typeof buildJointRig>;
    }>();
  const all = useMemo(() => occurrences(project), [project]);
  const available = all
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
    bounded,
    editing,
    fixedFrame,
    movingFrame,
    groupIds,
    motor,
    chassisBasis,
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
  const targetId = project.motionRigs[existingId]
    ? existingId
    : (Object.keys(project.motionRigs)[0] ?? "");
  const target = project.motionRigs[targetId];
  const removalKey = JSON.stringify([
    targetId,
    project.id,
    project.revision,
    activeLayerId,
  ]);
  const currentRemoval = removal?.key === removalKey ? removal : undefined;
  const currentPreview = preview?.key === key ? preview.result : undefined;
  const reset = () => {
    setEditing(undefined);
    setPreview(undefined);
    setRemoval(undefined);
    setRigId(uid());
    setFixed([]);
    setMoving([]);
    setChassis([]);
    setWheels([wheel(), wheel()]);
    setFixedFrame(undefined);
    setMovingFrame(undefined);
    setChassisBasis(undefined);
    setMotor(undefined);
    setGroupIds({
      fixed: "fixed",
      moving: "moving",
      chassis: "chassis",
      joint: "hinge",
    });
    setName("My mechanism");
    setBounded(true);
    setHingeAxis([0, 1, 0]);
    setMinimum(0);
    setMaximum(90);
  };
  const loadExisting = () =>
    attempt(() => {
      reset();
      const loaded = rigAuthoringRequest(
        project,
        targetId,
        activeLayerId ? { activeLayerId } : {},
      );
      const request = loaded.request;
      setRigId(request.id);
      setName(request.name);
      setEditing({
        id: request.id,
        revision: project.revision,
        projectId: project.id,
      });
      if (loaded.kind === "joint") {
        const r = loaded.request;
        setKind(r.kind === "revolute" ? "hinge" : r.kind);
        setFixed(r.fixed.occurrenceIds);
        setMoving(r.moving.occurrenceIds);
        setFixedFrame(r.fixed.frame);
        setMovingFrame(r.moving.frame);
        setPivot(r.pivotWorld);
        setHingeAxis(r.axisWorld ?? [0, 1, 0]);
        setBounded(!!r.limits);
        setMinimum(r.limits?.[0] ?? 0);
        setMaximum(r.limits?.[1] ?? (r.kind === "prismatic" ? 100 : 90));
        setGroupIds({
          fixed: r.fixed.id,
          moving: r.moving.id,
          chassis: "chassis",
          joint: r.jointId,
        });
        setMotor(r.motor);
      } else {
        const r = loaded.request;
        setKind("vehicle");
        setChassis(r.chassis.occurrenceIds);
        setChassisCenter(r.chassis.frame.position);
        setChassisBasis(r.chassis.frame.basis);
        setGroupIds({
          fixed: "fixed",
          moving: "moving",
          chassis: r.chassis.id,
          joint: "hinge",
        });
        setWheels(
          r.wheels.map((w) => ({
            id: w.id,
            occurrenceIds: w.occurrenceIds,
            center: w.frame.position,
            basis: w.frame.basis,
            axis: w.axisLocal,
            radius: w.radius,
            steering: w.steering,
          })),
        );
        setWheelbase(r.wheelbase);
        setMaxSteer(r.maxSteerDegrees);
        setMaxSpeed(r.maxSpeed);
      }
      setMessage(
        "Rig loaded. Original group frames and IDs are retained. Preview changes before updating.",
      );
    });
  const removeCommand = (revision: number, dryRun: boolean) =>
    editor.dispatch({
      schemaVersion: 1,
      commandId: uid(),
      expectedRevision: revision,
      type: "rigs.remove",
      payload: { rigId: targetId, ...(activeLayerId ? { activeLayerId } : {}) },
      dryRun,
    });
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
      const byId = new Map(all.map((o) => [o.id, o]));
      for (const id of selection) {
        const o = byId.get(id);
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
  const dispatch = (result: ReturnType<typeof buildJointRig>, dryRun = false) =>
    editor.dispatch({ ...rigDraftCommand(result, uid()), dryRun });
  const prepare = () =>
    attempt(() => {
      setPreview(undefined);
      if (
        editing &&
        (editing.revision !== project.revision ||
          editing.projectId !== project.id)
      )
        throw new Error(
          "Project changed since this rig was loaded. Load the rig again before editing.",
        );
      const common = {
        id: rigId,
        name,
        expectedRevision: project.revision,
        ...(activeLayerId ? { activeLayerId } : {}),
      };
      const result =
        kind !== "vehicle"
          ? buildJointRig(project, {
              ...common,
              kind: kind === "hinge" ? "revolute" : kind,
              jointId: editing
                ? groupIds.joint
                : kind === "hinge"
                  ? "hinge"
                  : "joint",
              fixed: {
                id: groupIds.fixed,
                occurrenceIds: fixed,
                frame: fixedFrame ?? frame(pivot),
              },
              moving: {
                id: groupIds.moving,
                occurrenceIds: moving,
                frame: movingFrame ?? frame(pivot),
              },
              pivotWorld: pivot,
              ...(["hinge", "prismatic"].includes(kind)
                ? {
                    axisWorld: hingeAxis,
                    ...(bounded
                      ? { limits: [minimum, maximum] as [number, number] }
                      : {}),
                  }
                : {}),
              ...(motor ? { motor } : {}),
            })
          : buildVehicleRig(project, {
              ...common,
              // Seat editing has its own explicit review/removal flow. Retain
              // the frozen source metadata when changing vehicle mechanics.
              ...(editing && project.motionRigs[editing.id]?.vehicle?.driverSeat
                ? {
                    driverSeat: structuredClone(
                      project.motionRigs[editing.id].vehicle!.driverSeat!,
                    ),
                  }
                : {}),
              chassis: {
                id: groupIds.chassis,
                occurrenceIds: chassis,
                frame: {
                  position: chassisCenter,
                  basis: chassisBasis ?? frame(chassisCenter).basis,
                },
              },
              wheels: wheels.map((w) => ({
                id: w.id,
                occurrenceIds: w.occurrenceIds,
                frame: {
                  position: w.center,
                  basis: w.basis ?? frame(w.center).basis,
                },
                axisLocal: w.axis,
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
        "Preview validated. Saving the rig records one undoable edit; it does not move parts.",
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
  const vector = (
    label: string,
    value: Vec3,
    change: (v: Vec3) => void,
    units = "world LDU",
  ) => (
    <fieldset>
      <legend>
        {label} ({units})
      </legend>
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
    value: Vec3,
    change: (v: Vec3) => void,
  ) => {
    const selected =
      ["X", "Y", "Z"].find((a) => axis(a).every((n, i) => n === value[i])) ??
      "custom";
    return (
      <>
        <label>
          {label}
          <select
            value={selected}
            onChange={(e) =>
              change(
                e.target.value === "custom" ? [1, 1, 0] : axis(e.target.value),
              )
            }
          >
            {["X", "Y", "Z"].map((a) => (
              <option key={a}>{a}</option>
            ))}
            <option value="custom">Custom vector</option>
          </select>
        </label>
        {selected === "custom" &&
          vector(
            `${label} direction`,
            value,
            change,
            "direction, normalised on save",
          )}
      </>
    );
  };
  return (
    <details className="rig-authoring">
      <summary>Create or edit a rig</summary>
      {!!target && (
        <section className="rig-existing" aria-label="Existing rig editing">
          <label>
            Existing rig
            <select
              value={targetId}
              onChange={(e) => {
                setExistingId(e.target.value);
                reset();
                setMessage("");
              }}
            >
              {Object.values(project.motionRigs).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <div className="rig-actions">
            <button onClick={loadExisting}>Load rig for editing</button>
            <button
              onClick={() => {
                reset();
                setMessage("New rig draft started.");
              }}
            >
              Start a new rig
            </button>
            <button
              onClick={() =>
                attempt(() => {
                  removeCommand(project.revision, true);
                  setRemoval({
                    key: removalKey,
                    revision: project.revision,
                    count: new Set(
                      target.groups.flatMap((g) => g.occurrenceIds),
                    ).size,
                  });
                })
              }
            >
              Review rig removal
            </button>
          </div>
          {currentRemoval && (
            <div className="rig-preview">
              <p>
                Remove “{target.name}” and its joint/vehicle settings? Its{" "}
                {currentRemoval.count} parts stay at their authored positions.
                This is one undoable edit.
              </p>
              <button
                className="danger wide"
                onClick={() =>
                  attempt(() => {
                    removeCommand(currentRemoval.revision, false);
                    reset();
                    setMessage(
                      "Rig removed. Parts were preserved. Undo restores its settings.",
                    );
                  })
                }
              >
                Confirm remove rig
              </button>
              <button onClick={() => setRemoval(undefined)}>
                Cancel removal
              </button>
            </div>
          )}
          {removal && !currentRemoval && (
            <p>Project or scope changed. Review removal again.</p>
          )}
        </section>
      )}
      {editing && (
        <p>
          <strong>
            Editing {project.motionRigs[editing.id]?.name ?? "a missing rig"}
          </strong>
          . Original group frames, IDs and supported metadata are retained.{" "}
          {motor &&
            "Motor metadata is preserved; the kinematic preview does not simulate motor forces."}
        </p>
      )}

      <p>
        Assign selected parts to separate rigid groups, then preview and create
        one kinematic rig. Connections and wheel contact are not inferred or
        physically validated.
      </p>
      <p>
        World coordinates use LDU; negative Y points up. New group frames align
        with world axes; existing frames are retained when editing. Current
        selection: {selection.length} parts.
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
          disabled={!!editing}
          onChange={(e) => setKind(e.target.value as typeof kind)}
        >
          <option value="hinge">Hinge</option>
          <option value="fixed">Fixed joint</option>
          <option value="prismatic">Sliding joint</option>
          <option value="spherical">Spherical joint (rest only)</option>
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
      {kind !== "vehicle" ? (
        <>
          {group("Fixed group", fixed, setFixed)}
          {group(
            ["fixed", "spherical"].includes(kind)
              ? "Attached group"
              : "Moving group",
            moving,
            setMoving,
          )}
          {vector(
            kind === "hinge" ? "Hinge pivot" : "Joint pivot",
            pivot,
            setPivot,
          )}
          {kind === "fixed" && (
            <p>
              Fixed joints preserve the relative rest pose. There is no scalar
              movement control.
            </p>
          )}
          {kind === "spherical" && (
            <p>
              Spherical joints preserve their rest pose in the current kinematic
              preview. Ball-joint motion and forces are not simulated.
            </p>
          )}
          {["hinge", "prismatic"].includes(kind) && (
            <>
              {axisSelect(
                kind === "hinge" ? "Hinge world axis" : "Sliding world axis",
                hingeAxis,
                setHingeAxis,
              )}
              <label className="rig-check">
                <input
                  type="checkbox"
                  checked={bounded}
                  onChange={(e) => setBounded(e.target.checked)}
                />
                Limit joint movement
              </label>
              {bounded ? (
                <div className="rig-pair">
                  <label>
                    {kind === "hinge"
                      ? "Minimum angle (degrees)"
                      : "Minimum travel (LDU)"}
                    <input
                      type="number"
                      value={minimum}
                      onChange={(e) => setMinimum(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    {kind === "hinge"
                      ? "Maximum angle (degrees)"
                      : "Maximum travel (LDU)"}
                    <input
                      type="number"
                      value={maximum}
                      onChange={(e) => setMaximum(Number(e.target.value))}
                    />
                  </label>
                </div>
              ) : (
                <p>No joint limits are authored.</p>
              )}
            </>
          )}
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
            const wasEditing = !!editing;
            reset();
            setMessage(
              wasEditing
                ? "Rig updated. Undo restores its previous settings."
                : "Rig created. Open Play to preview the mechanism. Undo restores the previous project.",
            );
          })
        }
      >
        {editing ? "Update rig" : "Create rig"}
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
