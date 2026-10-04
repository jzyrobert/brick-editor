import {
  checkPhysicalMotorBinding,
  PHYSICAL_MOTOR_PROFILE,
} from "../mechanisms/motor-binding";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { Editor } from "../core/commands";
import { partSpec } from "../catalog/extended";
import { fullSource } from "../catalog/full-library";
import { occurrences } from "../core/document";
import { uid } from "../core/types";
import type { PlayRequest } from "../play/types";
import type { BrowserPlay } from "../play/browser";
import type {
  MechanicalProposal,
  MechanicalProposalRequest,
} from "../mechanisms/mechanical-proposals";
import {
  prepareMechanicalProposal,
  reviewedProposalProject,
} from "../mechanisms/proposal-entry";

export type MechanismReview = {
  request: MechanicalProposalRequest;
  proposal: MechanicalProposal;
  physics?: "kinematic" | "dynamic";
};

/** A deliberate review on the entry sheet, never automatic model repair. */
export function PlayMechanismSetup({
  editor,
  play,
  selection,
  playRequest,
  review,
  onReview,
  onClose,
}: {
  editor: Editor;
  play: BrowserPlay;
  selection: string[];
  playRequest: PlayRequest;
  review?: MechanismReview;
  onReview: (review: MechanismReview | undefined) => void;
  onClose: () => void;
}) {
  const project = useSyncExternalStore(
    editor.subscribe.bind(editor),
    () => editor.snapshot,
  );
  const all = useMemo(() => occurrences(project), [project]);
  const [scope, setScope] = useState("visible");
  const [anchors, setAnchors] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("My mechanism");
  const [driver, setDriver] = useState(
    () =>
      Object.entries(review?.proposal.drivers ?? {}).find(
        ([, id]) => review?.request.motors?.[id],
      )?.[0] ?? "",
  );
  const [speed, setSpeed] = useState(
    Object.values(review?.request.motors ?? {})[0]?.target ?? 60,
  );
  const [effort, setEffort] = useState(
    Object.values(review?.request.motors ?? {})[0]?.maxEffort.value ?? 10,
  );
  const [physics, setPhysics] = useState<"kinematic" | "dynamic">(
    review?.physics ?? "kinematic",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selected = all.filter(
    (o) => o.visible && (scope !== "selection" || selection.includes(o.id)),
  );
  const stale =
    !!review && review.request.expectedRevision !== project.revision;
  const rig = review?.proposal.rig;
  const motorChoices = useMemo(() => {
    if (!rig) return [];
    const motors = all.filter(
      (o) =>
        o.namespace === "official" && o.node.ref === PHYSICAL_MOTOR_PROFILE.ref,
    );
    return rig.joints.flatMap((joint) =>
      motors.flatMap((motor) => {
        const binding = {
          occurrenceId: motor.id,
          profile: PHYSICAL_MOTOR_PROFILE.id,
        };
        return checkPhysicalMotorBinding(project, rig, joint, binding, all)
          .eligible
          ? [{ joint, binding }]
          : [];
      }),
    );
  }, [project, rig, all]);
  const motorChoice = motorChoices.find((choice) => choice.joint.id === driver);
  const joint = motorChoice?.joint;
  const assigned = new Set(rig?.groups.flatMap((g) => g.occurrenceIds));
  const unassigned =
    review?.request.occurrenceIds?.filter((id) => !assigned.has(id)) ?? [];
  const ready =
    !!rig &&
    !stale &&
    !review!.proposal.unresolved.length &&
    !unassigned.length;
  const labels = useMemo(
    () =>
      new Map(
        all.map((o) => {
          const specName = partSpec(o.node.ref)?.name;
          const header = fullSource(o.node.ref)
            ?.split("\n", 1)[0]
            .trim()
            .replace(/^0\s+/, "");
          const sourceName =
            header && !/^(FILE|Name:|Author:|!|~Moved to)/i.test(header)
              ? header
              : undefined;
          const name =
            specName && specName !== o.node.ref.replace(/\.dat$/i, "")
              ? specName
              : (sourceName ?? o.node.ref);
          const path = JSON.parse(o.id) as string[];
          return [
            o.id,
            {
              primary: `${name} · Part ${path.join(" / ")}`,
              filename: o.node.ref,
            },
          ];
        }),
      ),
    [all],
  );
  const label = (id: string) => labels.get(id)?.primary ?? id;
  const configured = (): MechanicalProposalRequest => ({
    ...review!.request,
    motors: {},
    ...(joint
      ? {
          motors: {
            [review!.proposal.drivers[joint.id]]: {
              mode: "velocity",
              binding: motorChoice!.binding,
              target: speed,
              maxEffort: {
                value: effort,
                unit: joint.kind === "prismatic" ? "N" : "N*m",
              },
            },
          },
        }
      : {}),
  });
  const attempt = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="play-mechanism-setup" aria-label="Set up a mechanism">
      <button
        className="wide"
        onClick={() => {
          if (busy) play.exit();
          onClose();
        }}
      >
        {busy ? "Cancel setup" : "Back to Play settings"}
      </button>
      <h3>Set up a mechanism</h3>
      <p>
        Choose the parts that stay fixed. Review the connections before trying
        them in Play.
      </p>
      {!review ? (
        <>
          <label>
            Assembly
            <select
              aria-label="Mechanism assembly"
              value={scope}
              onChange={(e) => {
                setScope(e.target.value);
                setAnchors([]);
              }}
            >
              <option value="visible">
                All visible parts ({all.filter((o) => o.visible).length})
              </option>
              <option value="selection" disabled={!selection.length}>
                Build selection ({selection.length})
              </option>
            </select>
          </label>
          <label>
            Name
            <input
              aria-label="Mechanism name"
              value={name}
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Find fixed parts
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <p>
            {anchors.length} fixed parts chosen · {selected.length} parts in
            this assembly
          </p>
          <fieldset className="play-frame-parts">
            <legend>Parts that stay fixed</legend>
            {selected.length > 2048 ? (
              <p>Select a smaller assembly in Build (up to 2,048 parts).</p>
            ) : (
              selected
                .filter((o) =>
                  `${label(o.id)} ${o.node.ref}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((o) => (
                  <label key={o.id}>
                    <input
                      type="checkbox"
                      aria-label={label(o.id)}
                      data-occurrence-id={o.id}
                      checked={anchors.includes(o.id)}
                      onChange={(e) =>
                        setAnchors((ids) =>
                          e.target.checked
                            ? [...ids, o.id]
                            : ids.filter((id) => id !== o.id),
                        )
                      }
                    />
                    <span className="play-part-identity">
                      <span>{label(o.id)}</span>
                      <small>{o.node.ref}</small>
                    </span>
                  </label>
                ))
            )}
          </fieldset>
          <button
            className="primary wide"
            disabled={
              busy || !anchors.length || !name.trim() || selected.length > 2048
            }
            onClick={() =>
              void attempt(async () => {
                editor.requireMaterialization();
                const source = editor.snapshot;
                const request: MechanicalProposalRequest = {
                  id: uid(),
                  name: name.trim(),
                  expectedRevision: source.revision,
                  frameOccurrenceIds: anchors.filter((id) =>
                    selected.some((o) => o.id === id),
                  ),
                  occurrenceIds: selected.map((o) => o.id),
                };
                const proposal = await prepareMechanicalProposal(
                  source,
                  request,
                  () => source === editor.snapshot,
                );
                onReview({ request, proposal });
                setDriver("");
              })
            }
          >
            {busy ? "Checking connections…" : "Review connections"}
          </button>
        </>
      ) : (
        <>
          <p>
            {rig
              ? `${rig.groups.length - 1} moving groups · ${rig.joints.length} joints · ${review.proposal.relations.length} linked outputs`
              : "No supported moving joint found."}
          </p>
          {stale && (
            <p role="alert">
              Your build changed. Choose parts and review again.
            </p>
          )}
          <details>
            <summary>Fixed and moving parts</summary>
            {rig?.groups.map((g, i) => (
              <div key={g.id}>
                <strong>
                  {i === 0 ? "Fixed frame" : `Moving group ${i}`} (
                  {g.occurrenceIds.length})
                </strong>
                <ul>
                  {g.occurrenceIds.map((id) => (
                    <li key={id}>{label(id)}</li>
                  ))}
                </ul>
              </div>
            ))}
            {rig?.joints.map((j) => (
              <p key={j.id}>
                {j.id} · {j.kind === "prismatic" ? "Slide" : "Hinge"} ·{" "}
                {j.bodyA} to {j.bodyB}
                {j.limits ? ` · stops ${j.limits.join(" to ")}` : ""}
              </p>
            ))}
            {review.proposal.relations.map((r, i) => (
              <p key={i}>
                {r.kind === "spur"
                  ? `Gear pair ${r.teethA}:${r.teethB}`
                  : "Rack and pinion"}{" "}
                · {r.jointA} linked to {r.jointB}
              </p>
            ))}
          </details>
          {(review.proposal.unresolved.length > 0 || unassigned.length > 0) && (
            <div role="alert">
              <strong>Connections need review</strong>
              {review.proposal.unresolved.map((u, i) => (
                <p key={i}>
                  {u.reason} ({u.occurrenceIds.map(label).join(", ")})
                </p>
              ))}
              {!!unassigned.length && (
                <p>
                  {unassigned.length} parts have no group. Choose their fixed
                  frame or narrow the assembly.
                </p>
              )}
            </div>
          )}
          {ready && (
            <>
              {!!motorChoices.length && (
                <label>
                  Motor part
                  <select
                    aria-label="Proposal motor"
                    value={driver}
                    onChange={(e) => setDriver(e.target.value)}
                  >
                    <option value="">Manual controls only</option>
                    {motorChoices.map(({ joint: j, binding }) => (
                      <option
                        key={`${j.id}:${binding.occurrenceId}`}
                        value={j.id}
                      >
                        {label(binding.occurrenceId)} · Turn shaft
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {!motorChoices.length && (
                <p>
                  Turn or slide the connected parts by hand. For powered
                  controls, mount a Power Functions M motor and connect its
                  output to the shaft.
                </p>
              )}
              {joint && (
                <div className="play-motor-fields">
                  <label>
                    Speed ({joint.kind === "prismatic" ? "LDU/s" : "degrees/s"})
                    <input
                      aria-label="Proposal motor speed"
                      type="number"
                      min={-360}
                      max={360}
                      value={speed}
                      onChange={(e) => setSpeed(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Force limit ({joint.kind === "prismatic" ? "N" : "N·m"})
                    <input
                      aria-label="Proposal motor effort"
                      type="number"
                      min={0.01}
                      max={1000}
                      step={0.01}
                      value={effort}
                      onChange={(e) => setEffort(Number(e.target.value))}
                    />
                  </label>
                </div>
              )}
              <label>
                Physics
                <select
                  value={physics}
                  onChange={(e) => setPhysics(e.target.value as typeof physics)}
                >
                  <option value="kinematic">
                    Kinematic · follows the joints
                  </option>
                  <option value="dynamic">Dynamic · gravity and forces</option>
                </select>
              </label>
            </>
          )}
          <details>
            <summary>What this review can verify</summary>
            {review.proposal.warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
            <p>
              Unknown connections are not repaired. Trying keeps your build
              unchanged; saving adds an undoable mechanism at its original rest
              pose.
            </p>
          </details>
          <button
            className="primary wide"
            disabled={
              !ready ||
              busy ||
              !Number.isFinite(speed) ||
              Math.abs(speed) > 360 ||
              !Number.isFinite(effort) ||
              effort < 0.01 ||
              effort > 1000
            }
            onClick={() =>
              void attempt(async () => {
                const request = configured();
                onReview({ ...review!, request, physics });
                await play.enterProposal(
                  request,
                  { ...playRequest, realtime: true },
                  physics,
                );
                play.focusMechanism(rig!.id);
              })
            }
          >
            {busy ? "Preparing mechanism…" : "Try in Play"}
          </button>
          <button
            className="wide"
            disabled={
              !ready ||
              busy ||
              !Number.isFinite(speed) ||
              Math.abs(speed) > 360 ||
              !Number.isFinite(effort) ||
              effort < 0.01 ||
              effort > 1000
            }
            onClick={() =>
              void attempt(async () => {
                const source = editor.snapshot,
                  request = configured();
                const proposal = await prepareMechanicalProposal(
                  source,
                  request,
                  () => source === editor.snapshot,
                );
                reviewedProposalProject(source, request, proposal);
                editor.dispatch({
                  schemaVersion: 1,
                  type: "rigs.upsert",
                  commandId: uid(),
                  expectedRevision: request.expectedRevision,
                  payload: { rig: proposal.rig! },
                });
                onReview(undefined);
                setMessage("Mechanism saved. Undo in Build removes it.");
              })
            }
          >
            Save mechanism to build
          </button>
          <button
            className="wide"
            disabled={busy}
            onClick={() => onReview(undefined)}
          >
            Choose parts again
          </button>
        </>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
