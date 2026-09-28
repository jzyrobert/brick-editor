import { useState } from "react";
import type { Editor } from "../core/commands";
import { ensure, uid, type Project, type Vec3 } from "../core/types";
import type { DriverSeatSpec } from "../mechanisms/types";
import {
  buildDriverSeatDraft,
  rigDraftCommand,
  type RigDraft,
} from "../mechanisms/authoring";

const newSeat = (): DriverSeatSpec => ({
  id: "driver",
  profile: "brick-figure-open-seat-v1",
  pelvisPosition: [0, 0, 0],
  yawDegrees: 0,
  accessPoint: [0, 0, 0],
  approachPosition: [80, 0, 0],
  exits: [{ position: [80, 0, 0], yawDegrees: 0 }],
});
export function SeatAuthoring({
  editor,
  project,
  activeLayerId,
}: {
  editor: Editor;
  /** The workspace's current snapshot (see RigAuthoring). */
  project: Project;
  activeLayerId?: string;
}) {
  const vehicles = Object.values(project.motionRigs ?? {}).filter(
    (rig) => rig.vehicle,
  );
  const [rigId, setRigId] = useState("");
  const [seat, setSeat] = useState<DriverSeatSpec>(newSeat);
  const [loaded, setLoaded] = useState<{
    projectId: string;
    revision: number;
    rigId: string;
  }>();
  const [review, setReview] = useState<{
    draft: RigDraft;
    projectId: string;
    activeLayerId?: string;
    remove: boolean;
  }>();
  const [message, setMessage] = useState("");
  const update = (next: DriverSeatSpec) => {
    setSeat(next);
    setReview(undefined);
    setMessage("");
  };
  const attempt = (action: () => void) => {
    try {
      action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };
  const checkLoaded = () =>
    ensure(
      loaded?.projectId === project.id &&
        loaded?.revision === project.revision &&
        loaded?.rigId === rigId,
      "REVISION_CONFLICT",
      "Load the vehicle again; the project or selected rig changed.",
    );
  const prepare = (remove: boolean) =>
    attempt(() => {
      checkLoaded();
      const draft = buildDriverSeatDraft(project, {
        rigId,
        expectedRevision: loaded!.revision,
        driverSeat: remove ? null : seat,
        activeLayerId,
      });
      editor.dispatch({ ...rigDraftCommand(draft, uid()), dryRun: true });
      setReview({ draft, projectId: project.id, activeLayerId, remove });
      setMessage("");
    });
  const vector = (
    label: string,
    value: Vec3,
    change: (value: Vec3) => void,
  ) => (
    <fieldset>
      <legend>{label} (local LDU)</legend>
      <div className="rig-vector">
        {["X", "Y", "Z"].map((axis, index) => (
          <label key={axis}>
            {axis}
            <input
              aria-label={`${label} ${axis}`}
              type="number"
              min={-10000}
              max={10000}
              step="0.1"
              value={value[index]}
              onChange={(event) => {
                const next = [...value] as Vec3;
                next[index] = Number(event.target.value);
                change(next);
              }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
  if (!vehicles.length) return null;
  return (
    <details className="seat-authoring drawer">
      <summary>Driver seat coordinates</summary>
      <p className="muted">
        One open bench seat, measured from the chassis in LDU (negative Y is
        up).
      </p>
      <label>
        Vehicle
        <select
          aria-label="Seat vehicle"
          value={rigId}
          onChange={(event) => {
            setRigId(event.target.value);
            setLoaded(undefined);
            setReview(undefined);
          }}
        >
          <option value="">Choose vehicle</option>
          {vehicles.map((rig) => (
            <option key={rig.id} value={rig.id}>
              {rig.name}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={!rigId}
        onClick={() =>
          attempt(() => {
            const rig = project.motionRigs?.[rigId];
            ensure(rig?.vehicle, "INVALID_INPUT", "Choose an existing vehicle");
            setSeat(structuredClone(rig.vehicle.driverSeat ?? newSeat()));
            setLoaded({
              projectId: project.id,
              revision: project.revision,
              rigId,
            });
            setReview(undefined);
            setMessage("");
          })
        }
      >
        Load seat coordinates
      </button>
      {loaded && (
        <>
          <p>
            Profile: original open-bench figure. These coordinates do not imply
            cabin fit. Play checks access, body clearance and exits before
            moving you.
          </p>
          <label>
            Seat ID
            <input
              aria-label="Driver seat ID"
              value={seat.id}
              maxLength={128}
              onChange={(event) => update({ ...seat, id: event.target.value })}
            />
          </label>
          {vector("Pelvis position", seat.pelvisPosition, (value) =>
            update({ ...seat, pelvisPosition: value }),
          )}
          <label>
            Seat facing (degrees)
            <input
              aria-label="Seat facing (degrees)"
              type="number"
              min={-360}
              max={360}
              value={seat.yawDegrees}
              onChange={(event) =>
                update({ ...seat, yawDegrees: Number(event.target.value) })
              }
            />
          </label>
          <p>
            Profile eye position (local LDU): {seat.pelvisPosition[0]},{" "}
            {seat.pelvisPosition[1] - 38}, {seat.pelvisPosition[2]}. The seat
            profile fixes this camera anchor.
          </p>
          {vector("Access point", seat.accessPoint, (value) =>
            update({ ...seat, accessPoint: value }),
          )}
          {vector("Standing approach", seat.approachPosition, (value) =>
            update({ ...seat, approachPosition: value }),
          )}
          <p>
            Exit positions are standing feet, checked in this order at the
            vehicle’s current position.
          </p>
          {seat.exits.map((exit, index) => (
            <section key={index} aria-label={`Seat exit ${index + 1}`}>
              {vector(`Exit ${index + 1} feet`, exit.position, (value) =>
                update({
                  ...seat,
                  exits: seat.exits.map((old, i) =>
                    i === index ? { ...old, position: value } : old,
                  ),
                }),
              )}
              <label>
                Exit {index + 1} facing (degrees)
                <input
                  aria-label={`Exit ${index + 1} facing (degrees)`}
                  type="number"
                  min={-360}
                  max={360}
                  value={exit.yawDegrees}
                  onChange={(event) =>
                    update({
                      ...seat,
                      exits: seat.exits.map((old, i) =>
                        i === index
                          ? { ...old, yawDegrees: Number(event.target.value) }
                          : old,
                      ),
                    })
                  }
                />
              </label>
              <div className="rig-actions">
                <button
                  disabled={index === 0}
                  onClick={() => {
                    const exits = [...seat.exits];
                    [exits[index - 1], exits[index]] = [
                      exits[index],
                      exits[index - 1],
                    ];
                    update({ ...seat, exits });
                  }}
                >
                  Move exit {index + 1} earlier
                </button>
                <button
                  disabled={seat.exits.length === 1}
                  onClick={() =>
                    update({
                      ...seat,
                      exits: seat.exits.filter((_, i) => i !== index),
                    })
                  }
                >
                  Remove exit {index + 1}
                </button>
              </div>
            </section>
          ))}
          <button
            disabled={seat.exits.length >= 4}
            onClick={() =>
              update({
                ...seat,
                exits: [
                  ...seat.exits,
                  {
                    position: [...seat.approachPosition],
                    yawDegrees: seat.yawDegrees,
                  },
                ],
              })
            }
          >
            Add exit
          </button>
          <div className="rig-actions">
            <button onClick={() => prepare(false)}>Review seat metadata</button>
            <button
              disabled={!project.motionRigs?.[rigId]?.vehicle?.driverSeat}
              onClick={() => prepare(true)}
            >
              Review seat removal
            </button>
          </div>
        </>
      )}
      {review && (
        <div className="rig-preview">
          <p>
            {review.remove
              ? "Remove only the driver seat"
              : "Save the declared driver seat"}{" "}
            for {review.draft.affectedOccurrenceIds.length} existing parts.
            Vehicle mechanics and source transforms remain unchanged. Clearance
            is checked in Play.
          </p>
          <button
            onClick={() =>
              attempt(() => {
                ensure(
                  review.projectId === editor.projectId &&
                    review.activeLayerId === activeLayerId,
                  "REVISION_CONFLICT",
                  "Project or active editing layer changed; review again.",
                );
                editor.dispatch(rigDraftCommand(review.draft, uid()));
                setReview(undefined);
                setLoaded(undefined);
                setMessage(
                  review.remove
                    ? "Driver seat removed. Undo restores it."
                    : "Driver seat saved. Undo restores the previous rig.",
                );
              })
            }
          >
            {review.remove ? "Remove driver seat" : "Save driver seat"}
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </details>
  );
}
