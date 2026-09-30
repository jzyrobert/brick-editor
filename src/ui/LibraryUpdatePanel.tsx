// Project → "Update to the latest parts library": shown only while the project
// is pinned to an older complete LDraw library whose changed parts kept it
// from being updated automatically. Previews which parts change, saves a
// checkpoint, then applies the undoable `library.update` command.
import { useEffect, useMemo, useState } from "react";
import type { BrickEditorAPI } from "../automation/api";
import type { Project } from "../core/types";
import { libraryUpdateStatus } from "../catalog/library-update";
import { fullCatalog, onFullLibraryChange } from "../catalog/full-library";
import { loadFullCatalog } from "../catalog/full-library-loader";
import { Icon } from "./icons";

const SHOWN = 12;

export function LibraryUpdatePanel({
  api,
  project,
  onStatus,
}: {
  api: BrickEditorAPI;
  project: Project;
  onStatus: (message: string) => void;
}) {
  const status = useMemo(
    () => libraryUpdateStatus(project),
    // The pin and the parts only change with the document revision.
    [project.id, project.revision],
  );
  const [busy, setBusy] = useState(false);
  const [titlesVersion, setTitlesVersion] = useState(0);
  useEffect(() => {
    if (!status.needed || !status.changed.length) return;
    const off = onFullLibraryChange(() => setTitlesVersion((v) => v + 1));
    loadFullCatalog()
      .then(() => setTitlesVersion((v) => v + 1))
      .catch(() => undefined);
    return off;
  }, [status.needed, status.changed.length]);
  const titles = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of fullCatalog() ?? [])
      map.set(e[0], e[1].replace(/^[=_~]+/, ""));
    return map;
  }, [titlesVersion]);
  if (!status.needed || !status.pinned) return null;
  const n = status.changed.length;
  const summary = status.changesKnown
    ? n
      ? `${n} part${n === 1 ? "" : "s"} you use (${status.changedOccurrences} in the build) changed since then, so ${n === 1 ? "it stays" : "they stay"} hidden until you update.`
      : "None of the parts you use changed."
    : `We can't tell which parts changed, so the ${n} part${n === 1 ? "" : "s"} from the full library (${status.changedOccurrences} in the build) may look different after updating.`;
  async function update() {
    setBusy(true);
    try {
      await api.library.update({
        expectedRevision: project.revision,
        checkpoint: true,
      });
      onStatus(
        `Updated to the parts library ${status.current.releaseId}. A checkpoint was saved first; Undo puts the old library back.`,
      );
    } catch (e) {
      onStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="library-update"
      aria-label="Parts library update"
      role="region"
    >
      <h3>
        <Icon name="info" size={18} /> A newer parts library is ready
      </h3>
      <p>
        This build uses the LDraw parts library{" "}
        <strong>{status.pinned.releaseId}</strong>. {summary}
      </p>
      {n > 0 && (
        <ul className="library-update-parts" aria-label="Parts that change">
          {status.changed.slice(0, SHOWN).map((c) => (
            <li key={c.ref}>
              <span>{titles.get(c.ref) ?? c.ref.replace(/\.dat$/i, "")}</span>
              <small>
                {c.ref.replace(/\.dat$/i, "")} · ×{c.occurrences}
              </small>
            </li>
          ))}
          {n > SHOWN && <li className="muted">and {n - SHOWN} more</li>}
        </ul>
      )}
      <button
        className="primary wide"
        disabled={busy}
        onClick={() => void update()}
      >
        Update to the latest parts library
      </button>
      <p className="muted">
        Its textured parts use the matching texture pack (
        {status.textures.texturePackId}). We save a checkpoint first, and Undo
        puts the old library back.
      </p>
    </section>
  );
}
