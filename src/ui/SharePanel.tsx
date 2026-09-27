import { useEffect, useRef, useState } from "react";
import type { Project } from "../core/types";
import { occurrences } from "../core/document";
import { createShare, previewShare } from "../persistence/share";
export function SharePanel({
  project,
  open,
}: {
  project: Project;
  open: (project: Project) => Promise<void>;
}) {
  const [link, setLink] = useState<Awaited<ReturnType<typeof createShare>>>(),
    [preview, setPreview] = useState<Project>(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLElement>(null),
    generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setLink(undefined);
    return () => {
      generation.current++;
    };
  }, [project.id, project.revision]);
  useEffect(() => {
    if (!preview) return;
    const previous = document.activeElement as HTMLElement | null;
    const buttons = () => [
      ...(dialog.current?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      ) ?? []),
    ];
    buttons()[0]?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        e.preventDefault();
        setPreview(undefined);
        history.replaceState(null, "", location.pathname + location.search);
      }
      if (e.key !== "Tab") return;
      const items = buttons(),
        first = items[0],
        last = items.at(-1);
      if (!first) {
        e.preventDefault();
        return;
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [preview, busy]);
  useEffect(() => {
    let request = 0;
    const readHash = () => {
      const current = ++request;
      setPreview(undefined);
      if (!location.hash.startsWith("#v=")) return;
      setMessage("");
      void previewShare(location.hash)
        .then((r) => {
          if (current === request) setPreview(r.project);
        })
        .catch((e) => {
          if (current === request) setMessage(e.message);
        });
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => {
      request++;
      window.removeEventListener("hashchange", readHash);
    };
  }, []);
  const dismiss = () => {
    setPreview(undefined);
    history.replaceState(null, "", location.pathname + location.search);
  };
  return (
    <section className="share-panel">
      <h3>Share a small model</h3>
      <p className="muted">
        Create a self-contained link. Nothing is uploaded; anyone with the link
        can read the included model and source metadata.
      </p>
      <button
        disabled={busy}
        onClick={() => {
          setBusy(true);
          const current = generation.current;
          void createShare(project, location.href)
            .then((value) => {
              if (current === generation.current) setLink(value);
            })
            .catch((e) => {
              if (current === generation.current) setMessage(e.message);
            })
            .finally(() => setBusy(false));
        }}
      >
        Create share link
      </button>
      {link && (
        <>
          <label>
            Share link
            <textarea
              aria-label="Share link"
              readOnly
              value={link.url}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          <p className="muted">{link.includes}</p>
          {link.warning && <p>{link.warning}</p>}
          <button
            onClick={() => {
              void navigator.clipboard
                .writeText(link.url)
                .then(() => setMessage("Link copied"))
                .catch(() => setMessage("Select and copy the link above."));
            }}
          >
            Copy link
          </button>
        </>
      )}
      <p role="status">{message}</p>
      {preview && (
        <div className="modal-backdrop">
          <section
            className="dialog"
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-label="Shared model preview"
          >
            <h2>Open a shared model?</h2>
            <p>
              {occurrences(preview).length} geometry occurrences. This preview
              has not changed your workspace.
            </p>
            <p>
              Opening creates a new project. Your current nonempty build
              downloads as a backup first.
            </p>
            <div className="button-row">
              <button autoFocus disabled={busy} onClick={dismiss}>
                Keep my current build
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void open(preview)
                    .then(dismiss)
                    .catch((e) => setMessage(e.message))
                    .finally(() => setBusy(false));
                }}
              >
                Open shared model
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
