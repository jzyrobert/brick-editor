import { useState } from "react";
import type { Project } from "../core/types";
export function folderPath(project: Project, id: string) {
  const names: string[] = [];
  const seen = new Set<string>();
  let current = project.layerFolders?.[id];
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.unshift(current.name);
    current = current.parentFolderId
      ? project.layerFolders?.[current.parentFolderId]
      : undefined;
  }
  return names.join(" / ");
}
export function LayerFolders({
  project,
  layerId,
  dispatch,
}: {
  project: Project;
  layerId: string;
  dispatch: (
    type: string,
    payload: Record<string, unknown>,
  ) => unknown | Promise<unknown>;
}) {
  const [name, setName] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [removing, setRemoving] = useState("");
  const folders = Object.values(project.layerFolders ?? {}).sort((a, b) =>
      folderPath(project, a.id).localeCompare(folderPath(project, b.id)),
    ),
    layer = project.layers[layerId];
  const run = async (type: string, payload: Record<string, unknown>) => {
    setBusy(true);
    setMessage("");
    try {
      await dispatch(type, payload);
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  if (!layer) return null;
  return (
    <details className="layer-folders drawer">
      <summary>Organise with folders</summary>
      <label className="number-field">
        <span>Folder for active layer</span>
        <select
          value={layer.parentFolderId ?? ""}
          disabled={busy}
          onChange={(e) =>
            void run("layers.folder", {
              layerId,
              parentFolderId: e.target.value || null,
            })
          }
        >
          <option value="">No folder</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {folderPath(project, f.id)}
            </option>
          ))}
        </select>
      </label>
      <label className="number-field">
        <span>New folder name</span>
        <input
          value={name}
          maxLength={200}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button
        className="wide"
        disabled={busy || !name.trim()}
        onClick={() =>
          void run("folders.add", { name }).then((ok) => {
            if (ok) setName("");
          })
        }
      >
        Create folder
      </button>
      {folders.map((f) => (
        <div className="layer-removal" key={f.id}>
          <label className="number-field">
            <span>Folder name</span>
            <input
              key={f.id + f.name}
              aria-label={`Rename folder ${folderPath(project, f.id)}`}
              defaultValue={f.name}
              maxLength={200}
              disabled={busy}
              onBlur={(e) => {
                if (e.target.value !== f.name)
                  void run("folders.rename", {
                    folderId: f.id,
                    name: e.target.value,
                  });
              }}
            />
          </label>
          <label className="number-field">
            <span>Parent folder</span>
            <select
              aria-label={`Parent of ${folderPath(project, f.id)}`}
              value={f.parentFolderId ?? ""}
              disabled={busy}
              onChange={(e) =>
                void run("folders.move", {
                  folderId: f.id,
                  parentFolderId: e.target.value || null,
                })
              }
            >
              <option value="">Top level</option>
              {folders
                .filter((other) => other.id !== f.id)
                .map((other) => (
                  <option key={other.id} value={other.id}>
                    {folderPath(project, other.id)}
                  </option>
                ))}
            </select>
          </label>
          {removing === f.id ? (
            <>
              <p>
                Remove “{f.name}”? Its layers and nested folders move up one
                level; all parts remain.
              </p>
              <button
                className="wide"
                disabled={busy}
                onClick={() =>
                  void run("folders.remove", {
                    folderId: f.id,
                    mode: "promote-children",
                  }).then((ok) => {
                    if (ok) setRemoving("");
                  })
                }
              >
                Remove folder and keep contents
              </button>
              <button className="wide" onClick={() => setRemoving("")}>
                Keep folder
              </button>
            </>
          ) : (
            <button
              className="wide"
              disabled={busy}
              onClick={() => setRemoving(f.id)}
            >
              Remove {f.name} folder…
            </button>
          )}
        </div>
      ))}
      <p role="status">{message}</p>
    </details>
  );
}
