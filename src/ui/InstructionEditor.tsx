import { useEffect, useMemo, useState } from "react";
import type { Project, CameraSpec } from "../core/types";
import { occurrences } from "../core/document";
import { instructionCoverage } from "../instructions/edit";
export function InstructionEditor({
  project,
  planId,
  onPlanChange,
  step,
  onStepChange,
  selection,
  dispatch,
  currentCamera,
  applyCamera,
  canUndo,
  canRedo,
}: {
  canUndo: boolean;
  canRedo: boolean;
  project: Project;
  planId: string;
  onPlanChange: (id: string) => void;
  step: number;
  onStepChange: (index: number) => void;
  selection: string[];
  dispatch: (
    type: string,
    payload: Record<string, unknown>,
  ) => unknown | Promise<unknown>;
  currentCamera: () => CameraSpec | undefined;
  applyCamera: (camera: CameraSpec) => void;
}) {
  const [name, setName] = useState("My sequence"),
    [notes, setNotes] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [chosen, setChosen] = useState<string[]>([]),
    [filter, setFilter] = useState(""),
    [target, setTarget] = useState(0),
    [remove, setRemove] = useState(false),
    [removePlan, setRemovePlan] = useState(false);
  const all = useMemo(() => occurrences(project), [project]),
    plan = project.instructionPlans[planId],
    ids = plan?.steps[step] ?? [],
    metadata = plan?.stepMetadata?.[step],
    coverage = plan ? instructionCoverage(project, plan) : undefined;
  useEffect(() => {
    setChosen([]);
    setTarget(step);
    setRemove(false);
    setRemovePlan(false);
  }, [planId, step]);
  useEffect(
    () => setNotes(metadata?.notes ?? ""),
    [metadata?.notes, planId, step],
  );
  async function run(type: string, payload: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const result = await dispatch(type, payload);
      return result ?? true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const act = (type: string, payload: Record<string, unknown> = {}) =>
    run(type, { planId, index: step, ...payload });
  const reorder = async (delta: number) => {
    if (!plan) return;
    const order = plan.steps.map((_, i) => i),
      index = step + delta;
    [order[step], order[index]] = [order[index], order[step]];
    if (await run("instructions.step.reorder", { planId, indices: order }))
      onStepChange(index);
  };
  const choices = all
    .map((o, index) => ({ o, index }))
    .filter(({ o, index }) =>
      `${index + 1} ${o.node.ref} ${o.colorCode} ${o.id}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
    );
  return (
    <section aria-label="Instruction plan editor">
      <div className="instruction-actions">
        <button
          disabled={busy || !canUndo}
          onClick={() => void run("history.undo", {})}
        >
          Undo edit
        </button>
        <button
          disabled={busy || !canRedo}
          onClick={() => void run("history.redo", {})}
        >
          Redo edit
        </button>
      </div>
      {Object.keys(project.instructionPlans).length > 0 && (
        <label className="number-field">
          <span>Active instruction plan</span>
          <select
            aria-label="Active instruction plan"
            value={planId}
            onChange={(e) => {
              onPlanChange(e.target.value);
              onStepChange(0);
            }}
          >
            {Object.entries(project.instructionPlans).map(([id, p]) => (
              <option key={id} value={id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <details className="layer-folders">
        <summary>Manage instruction plans</summary>
        <label className="number-field">
          <span>Instruction plan name</span>
          <input
            aria-label="Instruction plan name"
            value={name}
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button
          className="wide"
          disabled={busy || !name.trim()}
          onClick={() =>
            void run("instructions.create", { name }).then((result) => {
              if (result) {
                onPlanChange(
                  (result as { addedPlanIds: string[] }).addedPlanIds[0],
                );
                onStepChange(0);
              }
            })
          }
        >
          Create empty plan
        </button>
        {plan && (
          <>
            <button
              className="wide"
              disabled={busy || !name.trim()}
              onClick={() => void run("instructions.rename", { planId, name })}
            >
              Rename active plan
            </button>
            <button className="wide" onClick={() => setRemovePlan((v) => !v)}>
              Delete active plan…
            </button>
            {removePlan && (
              <>
                <p>
                  Delete “{plan.name}” and its notes and cameras? All authored
                  parts remain.
                </p>
                <button
                  className="wide"
                  onClick={() =>
                    void run("instructions.remove", { planId }).then((ok) => {
                      if (ok) onPlanChange("");
                    })
                  }
                >
                  Delete plan and keep parts
                </button>
              </>
            )}
          </>
        )}
      </details>
      {plan && (
        <>
          <p role="status">
            {coverage!.introduced} of {coverage!.total} parts are in a step ·{" "}
            {coverage!.missing.length} not yet · {coverage!.emptySteps} empty
            steps
          </p>
          <details className="layer-folders">
            <summary>Edit current step</summary>
            <p>
              Step {plan.steps.length ? step + 1 : 0} · {ids.length} additions.
              Changes reorganise instructions; they do not move parts or certify
              assembly feasibility.
            </p>
            <div className="instruction-actions">
              <button
                disabled={busy || step <= 0}
                onClick={() => void reorder(-1)}
              >
                Move step earlier
              </button>
              <button
                disabled={busy || step >= plan.steps.length - 1}
                onClick={() => void reorder(1)}
              >
                Move step later
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void act("instructions.step.add", {
                    index: plan.steps.length ? step + 1 : 0,
                  }).then((ok) => {
                    if (ok) onStepChange(plan.steps.length ? step + 1 : 0);
                  })
                }
              >
                Add step after
              </button>
              <button
                disabled={busy || step >= plan.steps.length - 1}
                onClick={() => void act("instructions.step.merge")}
              >
                Merge with next step
              </button>
            </div>
            <p className="muted">
              Merging combines notes and retains the first step's camera.
            </p>
            <button
              className="wide"
              disabled={busy || !plan.steps.length}
              onClick={() => setRemove((v) => !v)}
            >
              Delete current step…
            </button>
            {remove && (
              <>
                <p>
                  Delete this step's notes/camera and leave its {ids.length}{" "}
                  additions unassigned? Geometry stays in the build; assign
                  those parts before publishing.
                </p>
                <button
                  className="wide"
                  onClick={() =>
                    void act("instructions.step.remove", {
                      disposition: "unassign",
                    }).then((ok) => {
                      if (ok) {
                        setRemove(false);
                        onStepChange(Math.max(0, step - 1));
                      }
                    })
                  }
                >
                  Unassign additions and delete step
                </button>
              </>
            )}
            {plan.steps.length > 0 && (
              <>
                <label className="instruction-notes">
                  <span>Step notes</span>
                  <textarea
                    aria-label="Step notes"
                    maxLength={4096}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                <button
                  className="wide"
                  disabled={busy || notes === (metadata?.notes ?? "")}
                  onClick={() =>
                    void act("instructions.step.update", { notes })
                  }
                >
                  Save step notes
                </button>
                <div className="instruction-actions">
                  {(["Front", "Top", "Isometric"] as const).map((view) => (
                    <button
                      key={view}
                      onClick={() => {
                        const camera = currentCamera();
                        if (!camera) return;
                        const d = Math.max(
                          100,
                          Math.hypot(
                            ...camera.position.map(
                              (n, i) => n - camera.target[i],
                            ),
                          ),
                        );
                        const offset =
                          view === "Front"
                            ? [0, 0, d]
                            : view === "Top"
                              ? [0, -d, 0]
                              : [d * 0.7, -d * 0.6, d * 0.7];
                        applyCamera({
                          ...camera,
                          position: camera.target.map(
                            (n, i) => n + offset[i],
                          ) as CameraSpec["position"],
                          up: view === "Top" ? [0, 0, -1] : [0, -1, 0],
                        });
                        setMessage(
                          `${view} camera preview ready. Save the current step camera to keep it.`,
                        );
                      }}
                    >
                      Preview {view.toLowerCase()} camera
                    </button>
                  ))}
                </div>
                <div className="instruction-actions">
                  <button
                    disabled={busy}
                    onClick={() => {
                      const camera = currentCamera();
                      if (camera)
                        void act("instructions.step.update", { camera });
                      else setMessage("Renderer camera is unavailable.");
                    }}
                  >
                    Save current step camera
                  </button>
                  <button
                    disabled={!metadata?.camera}
                    onClick={() =>
                      metadata?.camera && applyCamera(metadata.camera)
                    }
                  >
                    Use saved step camera
                  </button>
                  <button
                    disabled={busy || !metadata?.camera}
                    onClick={() =>
                      void act("instructions.step.update", { camera: null })
                    }
                  >
                    Clear step camera
                  </button>
                </div>
                <p className="muted">
                  {metadata?.camera
                    ? "Saved camera is used for this step in previews and exports."
                    : "No saved camera: exports use the view at publication start."}
                </p>
                <details className="layer-folders">
                  <summary>Assign or split additions</summary>
                  <button
                    className="wide"
                    disabled={!selection.length}
                    onClick={() =>
                      setChosen(
                        selection.filter((id) => all.some((o) => o.id === id)),
                      )
                    }
                  >
                    Use editor selection ({selection.length})
                  </button>
                  <label className="number-field">
                    <span>Find instruction parts</span>
                    <input
                      aria-label="Find instruction parts"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    />
                  </label>
                  <div
                    className="instruction-parts"
                    role="group"
                    aria-label="Parts to organise"
                  >
                    {choices.slice(0, 200).map(({ o, index }) => (
                      <label className="check" key={o.id}>
                        <input
                          type="checkbox"
                          aria-label={`Part ${index + 1}: ${o.node.ref}`}
                          checked={chosen.includes(o.id)}
                          onChange={(e) =>
                            setChosen((list) =>
                              e.target.checked
                                ? [...list, o.id]
                                : list.filter((id) => id !== o.id),
                            )
                          }
                        />
                        <span>
                          {index + 1}. {o.node.ref} · colour {o.colorCode} ·{" "}
                          {plan.steps.findIndex((s) => s.includes(o.id)) < 0
                            ? "unassigned"
                            : `step ${plan.steps.findIndex((s) => s.includes(o.id)) + 1}`}
                        </span>
                      </label>
                    ))}
                  </div>
                  {choices.length > 200 && (
                    <p>
                      Showing 200 of {choices.length} matches. Filter by part,
                      number or occurrence ID to reach the remaining parts.
                    </p>
                  )}
                  <label className="number-field">
                    <span>Destination step</span>
                    <select
                      aria-label="Destination step"
                      value={target}
                      onChange={(e) => setTarget(Number(e.target.value))}
                    >
                      {plan.steps.map((s, index) => (
                        <option value={index} key={index}>
                          Step {index + 1} ({s.length} additions)
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="wide"
                    disabled={busy || !chosen.length}
                    onClick={() =>
                      void act("instructions.step.assign", {
                        index: target,
                        occurrenceIds: chosen,
                      }).then((ok) => {
                        if (ok) {
                          setChosen([]);
                          onStepChange(target);
                        }
                      })
                    }
                  >
                    Move chosen additions to step
                  </button>
                  <button
                    className="wide"
                    disabled={
                      busy ||
                      !chosen.length ||
                      chosen.length >= ids.length ||
                      !chosen.every((id) => ids.includes(id))
                    }
                    onClick={() =>
                      void act("instructions.step.split", {
                        occurrenceIds: chosen,
                      }).then((ok) => {
                        if (ok) onStepChange(step + 1);
                      })
                    }
                  >
                    Split chosen additions into next step
                  </button>
                </details>
              </>
            )}
          </details>
        </>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
