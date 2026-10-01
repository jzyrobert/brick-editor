import { useEffect, useRef, useState } from "react";
import {
  browserSavedBuildStores,
  countSavedBuilds,
  describeSavedBuilds,
  type SavedBuildCounts,
} from "../persistence/clear-saved";

/**
 * The last item of the Project menu: deletes every saved project, autosave
 * and checkpoint in this browser after a confirmation that says how many
 * and that it cannot be undone. Caches of parts and sets are kept.
 */
export function ClearSavedBuilds({
  onClear,
}: {
  /** Clears the stores and opens a blank canvas; resolves when done. */
  onClear: () => Promise<void>;
}) {
  const [asking, setAsking] = useState(false);
  return (
    <div className="clear-saved">
      <button className="text-button" onClick={() => setAsking(true)}>
        Clear saved builds…
      </button>
      {asking && (
        <ClearSavedDialog onClear={onClear} onClose={() => setAsking(false)} />
      )}
    </div>
  );
}

function ClearSavedDialog({
  onClear,
  onClose,
}: {
  onClear: () => Promise<void>;
  onClose: () => void;
}) {
  const [counts, setCounts] = useState<SavedBuildCounts>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const dialog = useRef<HTMLElement>(null),
    cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancel.current?.focus();
    let live = true;
    countSavedBuilds(browserSavedBuildStores(localStorage))
      .then((c) => live && setCounts(c))
      .catch(
        (e) => live && setError(e instanceof Error ? e.message : String(e)),
      );
    return () => {
      live = false;
      previous?.focus?.();
    };
  }, []);
  const nothing = !!counts && counts.projects + counts.checkpoints === 0;
  const clear = async () => {
    setBusy(true);
    setError("");
    try {
      await onClear();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <section
        ref={dialog}
        className="dialog replace-dialog clear-saved-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="clear-saved-title"
        aria-describedby="clear-saved-body"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
          if (e.key !== "Tab") return;
          const items = [
            ...dialog.current!.querySelectorAll<HTMLElement>(
              "button:not(:disabled)",
            ),
          ];
          const first = items[0],
            last = items[items.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }}
      >
        <h2 id="clear-saved-title">Clear saved builds?</h2>
        <p id="clear-saved-body">
          {nothing ? (
            "Nothing is saved in this browser. This closes the open build and starts a blank canvas."
          ) : (
            <>
              {counts
                ? `This deletes ${describeSavedBuilds(counts)} stored in this browser, with their autosaves,`
                : "Counting saved builds… This deletes every saved project in this browser, with its autosaves,"}{" "}
              and starts a blank canvas. <strong>This can’t be undone.</strong>{" "}
              Download a native backup first to keep a build. Downloaded parts
              and sets stay.
            </>
          )}
        </p>
        <div className="replace-actions">
          <button
            className="danger"
            disabled={busy || !counts}
            onClick={() => void clear()}
          >
            {nothing
              ? "Start a blank canvas"
              : counts
                ? `Delete ${describeSavedBuilds(counts)}`
                : "Delete saved builds"}
          </button>
          <button ref={cancel} disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
        {error && (
          <p className="replace-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
