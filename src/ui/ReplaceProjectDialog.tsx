import { useEffect, useRef, useState } from "react";

/**
 * Asked before a template, a file, a shared model or another saved project
 * replaces a build with changes: save it to this device's project list,
 * discard the changes, or cancel. In-app (no browser confirm()), so it works
 * the same on phones; Escape cancels and Tab stays inside the dialog.
 */
export function ReplaceProjectDialog({
  title,
  action,
  storedBefore,
  onSave,
  onDiscard,
  onDownload,
  onCancel,
}: {
  /** The current project's title. */
  title: string;
  /** What replaces it, e.g. "the Small castle template". */
  action: string;
  /** The project was already in the saved list when it was opened. */
  storedBefore: boolean;
  onSave: () => Promise<void>;
  onDiscard: () => Promise<void>;
  onDownload: () => Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const dialog = useRef<HTMLElement>(null),
    primary = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    primary.current?.focus();
    return () => previous?.focus?.();
  }, []);
  const attempt = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <section
        ref={dialog}
        className="dialog replace-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="replace-dialog-title"
        aria-describedby="replace-dialog-body"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
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
        <h2 id="replace-dialog-title">Save your current build first?</h2>
        <p id="replace-dialog-body">
          Opening {action} replaces “{title}”.{" "}
          {storedBefore
            ? "Save keeps your changes in My builds; Discard puts it back as it was when you opened it."
            : "It isn’t in My builds yet. Save adds it there on this device; Discard lets it go."}
        </p>
        <div className="replace-actions">
          <button
            ref={primary}
            className="primary"
            disabled={busy}
            onClick={() => void attempt(onSave)}
          >
            Save and continue
          </button>
          <button
            className="danger"
            disabled={busy}
            onClick={() => void attempt(onDiscard)}
          >
            Discard
          </button>
          <button disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        </div>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => void attempt(onDownload)}
        >
          Download a copy
        </button>
        {error && (
          <p className="replace-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
