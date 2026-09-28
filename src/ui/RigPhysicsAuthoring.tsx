import { useState } from "react";
import type { Editor } from "../core/commands";
import { ensure, uid, type Project } from "../core/types";
import type { RigDynamics } from "../mechanisms/types";
import {
  buildRigDynamicsDraft,
  rigDraftCommand,
  type RigDraft,
} from "../mechanisms/authoring";
import { RIG_DYNAMICS_LIMITS as L } from "../mechanisms/kinematic";
import { anchoredGroup } from "../mechanisms/dynamics-settings";

const DEFAULT_SUSPENSION = {
  restLength: 6,
  travel: 5,
  stiffness: 40,
  damping: 4,
};
/**
 * Optional dynamic-Play settings for an existing rig: which groups stay
 * anchored, group masses and vehicle suspension. Mechanics are unchanged;
 * saving is one undoable rig edit.
 */
export function RigPhysicsAuthoring({
  editor,
  project,
  activeLayerId,
}: {
  editor: Editor;
  project: Project;
  activeLayerId?: string;
}) {
  const rigs = Object.values(project.motionRigs ?? {});
  const [rigId, setRigId] = useState("");
  const [settings, setSettings] = useState<RigDynamics>({});
  const [loaded, setLoaded] = useState<{
    projectId: string;
    revision: number;
  }>();
  const [review, setReview] = useState<{
    draft: RigDraft;
    projectId: string;
    remove: boolean;
  }>();
  const [message, setMessage] = useState("");
  const rig = project.motionRigs?.[rigId];
  const attempt = (action: () => void) => {
    try {
      action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };
  const change = (next: RigDynamics) => {
    setSettings(next);
    setReview(undefined);
    setMessage("");
  };
  const group = (id: string) => settings.groups?.[id] ?? {};
  const setGroup = (
    id: string,
    patch: { massKg?: number; anchored?: boolean },
  ) => {
    const merged = { ...group(id), ...patch };
    for (const key of Object.keys(merged) as Array<keyof typeof merged>)
      if (merged[key] === undefined) delete merged[key];
    const groups = { ...(settings.groups ?? {}), [id]: merged };
    if (!Object.keys(merged).length) delete groups[id];
    change({ ...settings, groups });
  };
  const prepare = (remove: boolean) =>
    attempt(() => {
      ensure(
        loaded?.projectId === project.id &&
          loaded.revision === project.revision,
        "REVISION_CONFLICT",
        "Load the rig again; the project changed.",
      );
      const clean: RigDynamics = structuredClone(settings);
      if (clean.groups && !Object.keys(clean.groups).length)
        delete clean.groups;
      const draft = buildRigDynamicsDraft(project, {
        rigId,
        expectedRevision: project.revision,
        dynamics: remove ? null : clean,
        activeLayerId,
      });
      editor.dispatch({ ...rigDraftCommand(draft, uid()), dryRun: true });
      setReview({ draft, projectId: project.id, remove });
      setMessage("");
    });
  if (!rigs.length) return null;
  const number = (
    label: string,
    value: number | undefined,
    range: { min: number; max: number },
    set: (value: number | undefined) => void,
    placeholder = "Automatic",
  ) => (
    <label>
      {label}
      <input
        aria-label={label}
        type="number"
        min={range.min}
        max={range.max}
        step="any"
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(event) =>
          set(
            event.target.value === "" ? undefined : Number(event.target.value),
          )
        }
      />
    </label>
  );
  return (
    <details className="seat-authoring drawer rig-physics">
      <summary>Physics settings</summary>
      <p className="muted">
        Used only when Play runs with Dynamic physics. Blank values are
        automatic. These are simulation settings, not real brick strength.
      </p>
      <label>
        Rig
        <select
          aria-label="Physics rig"
          value={rigId}
          onChange={(event) => {
            setRigId(event.target.value);
            setLoaded(undefined);
            setReview(undefined);
          }}
        >
          <option value="">Choose rig</option>
          {rigs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={!rig}
        onClick={() =>
          attempt(() => {
            ensure(rig, "INVALID_INPUT", "Choose an existing rig");
            setSettings(structuredClone(rig.dynamics ?? {}));
            setLoaded({ projectId: project.id, revision: project.revision });
            setReview(undefined);
            setMessage("");
          })
        }
      >
        Load physics settings
      </button>
      {loaded && rig && (
        <>
          {rig.groups
            .filter((g) => !rig.vehicle?.wheels.some((w) => w.groupId === g.id))
            .map((g) => {
              const automatic = anchoredGroup(
                { ...rig, dynamics: settings },
                g.id,
              );
              const vehiclePart = rig.vehicle?.chassisGroup === g.id;
              return (
                <fieldset key={g.id}>
                  <legend>Group {g.id}</legend>
                  <label>
                    <input
                      type="checkbox"
                      aria-label={`Anchor group ${g.id}`}
                      disabled={vehiclePart}
                      checked={automatic}
                      onChange={(event) =>
                        setGroup(g.id, { anchored: event.target.checked })
                      }
                    />
                    Anchored in place
                  </label>
                  {!automatic &&
                    number(
                      `Mass of ${g.id} (kg)`,
                      group(g.id).massKg,
                      L.massKg,
                      (massKg) => setGroup(g.id, { massKg }),
                    )}
                </fieldset>
              );
            })}
          {number("Friction", settings.friction, L.friction, (friction) =>
            change({ ...settings, friction }),
          )}
          {rig.vehicle && (
            <fieldset>
              <legend>Suspension and engine</legend>
              {(
                [
                  ["restLength", "Spring length (LDU)"],
                  ["travel", "Travel (LDU)"],
                  ["stiffness", "Stiffness"],
                  ["damping", "Damping"],
                ] as const
              ).map(([key, label]) =>
                number(
                  label,
                  settings.suspension?.[key],
                  L[key],
                  (value) =>
                    change({
                      ...settings,
                      suspension: {
                        ...DEFAULT_SUSPENSION,
                        ...settings.suspension,
                        [key]: value ?? DEFAULT_SUSPENSION[key],
                      },
                    }),
                  String(DEFAULT_SUSPENSION[key]),
                ),
              )}
              {number(
                "Engine force (N)",
                settings.engineForce,
                L.engineForce,
                (engineForce) => change({ ...settings, engineForce }),
              )}
            </fieldset>
          )}
          <div className="rig-actions">
            <button onClick={() => prepare(false)}>
              Review physics settings
            </button>
            <button disabled={!rig.dynamics} onClick={() => prepare(true)}>
              Review removal
            </button>
          </div>
        </>
      )}
      {review && (
        <div className="rig-preview">
          <p>
            {review.remove
              ? "Remove the physics settings"
              : "Save physics settings"}{" "}
            of {review.draft.rig.name}. Joints, members and rest poses stay
            unchanged.
          </p>
          <button
            onClick={() =>
              attempt(() => {
                ensure(
                  review.projectId === editor.projectId,
                  "REVISION_CONFLICT",
                  "Project changed; review again.",
                );
                editor.dispatch(rigDraftCommand(review.draft, uid()));
                setReview(undefined);
                setLoaded(undefined);
                setMessage(
                  "Physics settings saved. Undo restores the previous rig.",
                );
              })
            }
          >
            {review.remove
              ? "Remove physics settings"
              : "Save physics settings"}
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
    </details>
  );
}
