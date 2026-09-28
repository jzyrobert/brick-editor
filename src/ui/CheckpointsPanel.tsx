import { useEffect, useId, useRef, useState } from "react";
import type { BrickEditorAPI } from "../automation/api";
import type { ChangeReport } from "../core/compare";
import { changedOccurrenceIds } from "../core/compare";
import type { CheckpointSummary } from "../persistence/checkpoints";
import { Icon } from "./icons";

type Compared = { checkpoint: CheckpointSummary; report: ChangeReport };
const kinds = [
  ["added", "added"],
  ["removed", "removed"],
  ["moved", "moved"],
  ["recoloured", "recoloured"],
  ["relayered", "moved to another layer"],
  ["replaced", "replaced"],
] as const;
const plural = (n: number, word: string) =>
  `${n.toLocaleString("en")} ${word}${n === 1 ? "" : "s"}`;

/** Named checkpoints: save, compare against now, restore and download (spec §10.4, §20). */
export function CheckpointsPanel({
  api,
  projectId,
  revision,
  download,
  backupCurrent,
  showChanges,
  onStatus,
}: {
  api: BrickEditorAPI;
  projectId: string;
  revision: number;
  download: (name: string, bytes: Uint8Array, mime: string) => void;
  backupCurrent: () => Promise<unknown>;
  showChanges: (occurrenceIds: string[]) => void;
  onStatus: (message: string) => void;
}) {
  const id = useId();
  const [items, setItems] = useState<CheckpointSummary[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [compared, setCompared] = useState<Compared>();
  const [confirming, setConfirming] = useState<CheckpointSummary>();
  // Only the latest listing may land: startup recovery can switch projects mid-request.
  const latest = useRef(0);
  const refresh = () => {
    const ticket = ++latest.current;
    return api.checkpoints
      .list()
      .then((list) => {
        if (ticket === latest.current) setItems(list);
      })
      .catch((e: Error) => setError(e.message));
  };
  // Re-list on project or revision changes: startup recovery can settle after mount, and a
  // comparison is stale once the build changes.
  useEffect(() => {
    void refresh();
    setCompared(undefined);
    setConfirming(undefined);
  }, [projectId, revision]);
  const attempt = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    attempt(async () => {
      const created = await api.checkpoints.create({ name });
      setName("");
      await refresh();
      onStatus(`Checkpoint “${created.name}” saved on this device.`);
    });
  const restore = (checkpoint: CheckpointSummary, backup: boolean) =>
    attempt(async () => {
      if (backup) await backupCurrent();
      await api.checkpoints.restore({
        checkpointId: checkpoint.id,
        expectedRevision: revision,
      });
      setConfirming(undefined);
      setCompared(undefined);
      onStatus(`Restored checkpoint “${checkpoint.name}”.`);
    });
  const report = compared?.report;
  return (
    <section className="checkpoints" aria-labelledby={id + "-title"}>
      <h3 id={id + "-title"}>Checkpoints</h3>
      <p className="muted">
        Save a named point you can compare against or go back to. Checkpoints
        stay on this device; download one to keep it elsewhere.
      </p>
      <form
        className="checkpoint-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label>
          Checkpoint name
          <input
            value={name}
            maxLength={80}
            placeholder="e.g. Ground floor done"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button className="primary" disabled={busy || !name.trim()}>
          Save checkpoint
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {items.length === 0 ? (
        <p className="muted">No checkpoints yet.</p>
      ) : (
        <ul className="checkpoint-list">
          {items.map((c) => (
            <li key={c.id}>
              <div>
                <strong>{c.name}</strong>
                <small>
                  {new Date(c.createdAt).toLocaleString()} ·{" "}
                  {plural(c.parts, "part")} · revision {c.revision}
                </small>
              </div>
              <div className="button-row">
                <button
                  disabled={busy}
                  onClick={() =>
                    void attempt(async () =>
                      setCompared(
                        await api.checkpoints.compare({ checkpointId: c.id }),
                      ),
                    )
                  }
                >
                  Compare
                </button>
                <button disabled={busy} onClick={() => setConfirming(c)}>
                  Restore…
                </button>
                <button
                  disabled={busy}
                  aria-label={`Download ${c.name}`}
                  onClick={() =>
                    void attempt(async () => {
                      const file = await api.checkpoints.export({
                        checkpointId: c.id,
                      });
                      download(file.name, file.bytes, file.mimeType);
                    })
                  }
                >
                  <Icon name="arrowDown" size={16} />
                </button>
                <button
                  disabled={busy}
                  aria-label={`Delete ${c.name}`}
                  onClick={() =>
                    void attempt(async () => {
                      await api.checkpoints.delete({ checkpointId: c.id });
                      if (compared?.checkpoint.id === c.id)
                        setCompared(undefined);
                      await refresh();
                    })
                  }
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
              {confirming?.id === c.id && (
                <div className="warning checkpoint-confirm" role="alert">
                  <p>
                    Restore “{c.name}”? Everything changed since then is
                    replaced and undo history is cleared.
                  </p>
                  <div className="button-row">
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => void restore(c, true)}
                    >
                      Back up current, then restore
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void restore(c, false)}
                    >
                      Restore without backup
                    </button>
                    <button onClick={() => setConfirming(undefined)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {report && compared && (
        <div className="checkpoint-report" role="status">
          <p>
            <strong>Since “{compared.checkpoint.name}”:</strong>{" "}
            {kinds.some(([k]) => report.counts[k])
              ? kinds
                  .filter(([k]) => report.counts[k])
                  .map(
                    ([k, label]) =>
                      `${plural(report.counts[k], "part")} ${label}`,
                  )
                  .join(", ")
              : "no parts changed"}
            .
          </p>
          {report.counts.removed + report.counts.added > 0 && (
            <p className="muted">
              Parts inside submodels that were made unique or regrouped count as
              removed and added.
            </p>
          )}
          <div className="button-row">
            <button
              disabled={changedOccurrenceIds(report).length === 0}
              onClick={() => showChanges(changedOccurrenceIds(report))}
            >
              Show changed parts
            </button>
            <button
              onClick={() =>
                download(
                  `changes-since-${compared.checkpoint.name}.json`,
                  new TextEncoder().encode(JSON.stringify(report, null, 2)),
                  "application/json",
                )
              }
            >
              Download report <Icon name="arrowDown" size={16} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
