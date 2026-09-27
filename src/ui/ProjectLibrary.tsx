import { useEffect, useState } from "react";
import { BrowserProjects } from "../persistence/browser-projects";
import type { Project } from "../core/types";
export function ProjectLibrary({
  currentId,
  open,
}: {
  currentId: string;
  open: (p: Project) => Promise<void>;
}) {
  const [projects, setProjects] = useState<
      Awaited<ReturnType<BrowserProjects["list"]>>
    >([]),
    [message, setMessage] = useState(""),
    [deleting, setDeleting] = useState<string>();
  const refresh = async () => {
    try {
      setProjects(await new BrowserProjects(localStorage).list());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => {
    void refresh();
  }, [currentId]);
  const attempt = (fn: () => Promise<void>) => {
    void fn().catch((e) => setMessage(e.message));
  };
  return (
    <section>
      <h3>Saved on this device</h3>
      <button onClick={() => void refresh()}>Refresh saved projects</button>
      {projects.map((p) => (
        <div key={p.id} className="saved-project">
          <strong>{p.title}</strong>
          <p className="muted">
            Revision {p.revision} · approximately{" "}
            {Math.ceil(p.approximateBytes / 1024)} KiB in browser storage
            {p.id === currentId ? " · current" : ""}
          </p>
          <div className="button-row">
            <button
              disabled={p.id === currentId}
              onClick={() =>
                attempt(async () => {
                  const value = await new BrowserProjects(localStorage).load(
                    p.id,
                  );
                  if (!value)
                    throw Error("This project is no longer available");
                  await open(value);
                })
              }
            >
              Open saved project
            </button>
            <button
              onClick={() =>
                attempt(async () => {
                  const bytes = await new BrowserProjects(
                    localStorage,
                  ).exportBackup(p.id);
                  const url = URL.createObjectURL(
                    new Blob([Uint8Array.from(bytes)], {
                      type: "application/zip",
                    }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = p.title + ".brickproj";
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                })
              }
            >
              Download backup
            </button>
            <button
              disabled={p.id === currentId}
              onClick={() => setDeleting(p.id)}
            >
              Delete saved copy
            </button>
          </div>
          {deleting === p.id && (
            <div>
              <p>
                Delete “{p.title}” from this device? Download a backup first if
                you want to keep it.
              </p>
              <button onClick={() => setDeleting(undefined)}>
                Keep saved copy
              </button>
              <button
                className="danger"
                onClick={() =>
                  attempt(async () => {
                    await new BrowserProjects(localStorage).delete(
                      p.id,
                      p.revision,
                    );
                    setDeleting(undefined);
                    await refresh();
                  })
                }
              >
                Delete this saved project
              </button>
            </div>
          )}
        </div>
      ))}
      {!projects.length && (
        <p className="muted">No saved projects found yet.</p>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
