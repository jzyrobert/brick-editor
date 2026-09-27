import { useEffect, useMemo, useRef, useState } from "react";
import type { Project, Scope } from "../core/types";
import { occurrences } from "../core/document";
import {
  type ExportProfile,
  PORTABLE_INSTRUCTIONS,
} from "../ldraw/export-profiles";
export function ExportProfiles({
  project,
  selection,
}: {
  project: Project;
  selection: string[];
}) {
  const [profile, setProfile] = useState<ExportProfile>("standard"),
    [scope, setScope] = useState<Scope["kind"]>("all"),
    [layerIds, setLayerIds] = useState<string[]>([]),
    [submodel, setSubmodel] = useState(""),
    [official, setOfficial] = useState(false),
    [complete, setComplete] = useState(true),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const operation = useRef<AbortController | undefined>(undefined),
    latest = useRef(project);
  latest.current = project;
  useEffect(() => {
    operation.current?.abort();
    setBusy(false);
    return () => operation.current?.abort();
  }, [project.id, project.revision]);
  const submodels = useMemo(() => {
    const paths = new Map<string, string>();
    for (const o of occurrences(project))
      for (let i = 1; i < o.path.length; i++) {
        const path = o.path.slice(0, i),
          id = JSON.stringify(path);
        if (paths.has(id)) continue;
        let model = project.models[project.rootModelId],
          name = "";
        for (const nodeId of path) {
          const node = model.nodes.find((n) => n.id === nodeId)!;
          name = project.models[node.ref]?.name ?? node.ref;
          model = project.models[node.ref];
        }
        paths.set(id, name + " · " + path.join("/"));
      }
    return [...paths];
  }, [project]);
  async function publish() {
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setMessage("Preparing export…");
    const selectedScope: Scope =
      profile === "native"
        ? { kind: "all" }
        : scope === "layers"
          ? { kind: scope, layerIds }
          : scope === "selection"
            ? { kind: scope, occurrenceIds: selection }
            : scope === "submodel"
              ? { kind: scope, occurrenceId: submodel }
              : { kind: scope };
    try {
      const { exportProfile } = await import("../ldraw/export-profiles");
      const artifact = await exportProfile(
        project,
        {
          profile,
          scope: selectedScope,
          includeCompleteModel: complete,
          includeOfficial: profile === "portable" && official,
          acknowledgeScopedMetadata: ack,
        },
        { signal: controller.signal, progress: setMessage },
      );
      if (
        controller.signal.aborted ||
        latest.current.id !== project.id ||
        latest.current.revision !== project.revision
      )
        return;
      const url = URL.createObjectURL(
          new Blob([artifact.bytes.slice().buffer], { type: artifact.mime }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = artifact.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(
        `Exported ${artifact.manifest.occurrenceCount} occurrences. ${artifact.manifest.warnings.join(" ")}`,
      );
    } catch (e) {
      setMessage(
        controller.signal.aborted
          ? "Export cancelled."
          : e instanceof Error
            ? e.message
            : String(e),
      );
    } finally {
      if (operation.current === controller) setBusy(false);
    }
  }
  return (
    <section className="export-profiles" aria-label="Model export profiles">
      <details className="layer-folders">
        <summary>Model export profiles</summary>
        <label className="number-field">
          <span>Export profile</span>
          <select
            aria-label="Export profile"
            value={profile}
            disabled={busy}
            onChange={(e) => setProfile(e.target.value as ExportProfile)}
          >
            <option value="standard">Standard model · MPD</option>
            <option value="portable">
              Portable model · MPD or library ZIP
            </option>
            <option value="layers">Per-layer archive · ZIP</option>
            <option value="native">Native project · full backup</option>
          </select>
        </label>
        {profile !== "native" && (
          <label className="number-field">
            <span>Export scope</span>
            <select
              aria-label="Export scope"
              value={scope}
              disabled={busy}
              onChange={(e) => setScope(e.target.value as Scope["kind"])}
            >
              <option value="all">All authored parts (including hidden)</option>
              <option value="visible">Visible layers only</option>
              <option value="selection">Selection ({selection.length})</option>
              <option value="layers">Chosen layers</option>
              <option value="submodel">Submodel occurrence</option>
            </select>
          </label>
        )}
        {scope === "layers" && profile !== "native" && (
          <fieldset>
            <legend>Layers to export</legend>
            {Object.values(project.layers)
              .sort((a, b) => a.order - b.order)
              .map((l) => (
                <label className="check" key={l.id}>
                  <input
                    type="checkbox"
                    checked={layerIds.includes(l.id)}
                    onChange={(e) =>
                      setLayerIds((ids) =>
                        e.target.checked
                          ? [...ids, l.id]
                          : ids.filter((id) => id !== l.id),
                      )
                    }
                  />
                  {l.name}
                  {!l.visible ? " (hidden)" : ""}
                </label>
              ))}
          </fieldset>
        )}
        {scope === "submodel" && profile !== "native" && (
          <label className="number-field">
            <span>Submodel occurrence</span>
            <select
              aria-label="Submodel occurrence"
              value={submodel}
              onChange={(e) => setSubmodel(e.target.value)}
            >
              <option value="">Choose a submodel</option>
              {submodels.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
        {profile === "portable" && (
          <>
            <label className="check">
              <input
                type="checkbox"
                checked={official}
                onChange={(e) => setOfficial(e.target.checked)}
              />
              Include licensed official dependency library (ZIP)
            </label>
            <p className="muted">
              {official
                ? PORTABLE_INSTRUCTIONS
                : "Embeds reachable project-local custom definitions. Official parts remain references to the recipient library."}
            </p>
          </>
        )}
        {profile === "layers" && (
          <>
            <label className="check">
              <input
                type="checkbox"
                checked={complete}
                onChange={(e) => setComplete(e.target.checked)}
              />
              Include complete model (all authored parts)
            </label>
            <p className="muted">
              Each layer MPD preserves world coordinates and custom definitions.
              The manifest identifies each file and its original occurrences.
            </p>
          </>
        )}
        {profile !== "native" && (scope !== "all" || profile === "layers") && (
          <label className="check">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            Allow scope changes that may invalidate unknown source metadata
          </label>
        )}
        <p className="muted">
          {profile === "native"
            ? "Native backups include every layer, hidden part, asset, rig and editor setting stored in the project."
            : "LDraw preserves source geometry and assembly records. Use a native backup to retain layer membership, marketplace overrides, groups and motion rigs."}
        </p>
        <button
          className="wide primary"
          disabled={
            busy ||
            (profile !== "native" &&
              ((scope === "selection" && !selection.length) ||
                (scope === "layers" && !layerIds.length) ||
                (scope === "submodel" && !submodel)))
          }
          onClick={() => void publish()}
        >
          Download model export
        </button>
        {busy && (
          <button className="wide" onClick={() => operation.current?.abort()}>
            Cancel model export
          </button>
        )}
        <p role="status">{message}</p>
      </details>
    </section>
  );
}
