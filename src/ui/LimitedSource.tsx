import { useEffect, useState } from "react";
import type { Editor } from "../core/commands";
import type { BrickEditorAPI } from "../automation/api";
import { BrowserProjects } from "../persistence/browser-projects";
import { ProjectLibrary } from "./ProjectLibrary";
import { ResourceProfilePanel } from "./ResourceProfilePanel";
import { RESOURCE_PROFILES, resourceLimits } from "../core/resource-profile";
import { assessMaterialization } from "../core/materialization";
import { ensure } from "../core/types";

export function LimitedSource({
  editor,
  api,
  knownSaveRevisions,
  enqueueSave,
}: {
  editor: Editor;
  api: BrickEditorAPI;
  enqueueSave: <T>(action: () => Promise<T>) => Promise<T>;
  knownSaveRevisions: Map<string, number>;
}) {
  const [project, setProject] = useState(editor.project);
  const [message, setMessage] = useState("");
  const [saveStatus, setSaveStatus] = useState("Saving source…");
  const [busy, setBusy] = useState(false);
  const availability = editor.materialization;
  const diagnostic = availability.diagnostic;
  const [desktopRequest, setDesktopRequest] = useState(0);
  const leaves = availability.estimate.metrics.leafCount;
  // Phone limits alone refuse this project: it would open under desktop limits.
  const phoneLimited =
    availability.profile === "mobile" &&
    assessMaterialization(project, { profile: "desktop" }).status ===
      "available";
  const attempt = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  const guardSource = () => {
    const started = editor.materialization;
    return () => {
      const current = editor.materialization;
      ensure(
        current.projectId === started.projectId &&
          current.revision === started.revision,
        "REVISION_CONFLICT",
        "Document changed while this action was preparing; open it again from the current project.",
      );
    };
  };
  const download = async (format: "native" | "ldraw") => {
    const artifact = await api.project.export({ format });
    const url = URL.createObjectURL(
      new Blob([artifact.bytes as BlobPart], { type: artifact.mimeType }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = artifact.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  useEffect(() => {
    const unsubscribe = editor.subscribe(() => setProject(editor.project));
    if (new URLSearchParams(location.search).get("automation") === "1")
      window.brickEditor = api;
    return () => {
      unsubscribe();
      if (window.brickEditor === api) delete window.brickEditor;
    };
  }, [editor]);
  useEffect(() => {
    let active = true;
    setSaveStatus("Saving source…");
    void enqueueSave(() =>
      new BrowserProjects(localStorage).save(
        project,
        knownSaveRevisions.get(project.id) ?? null,
      ),
    )
      .then((revision) => {
        knownSaveRevisions.set(project.id, revision);
        if (editor.project.id === project.id)
          localStorage.setItem("brick-editor-current", project.id);
        if (active)
          setSaveStatus(
            "Source saved on this device · revision " + project.revision,
          );
      })
      .catch((error) => {
        if (active) {
          setSaveStatus("Source save failed — download a native backup");
          setMessage(error.message);
        }
      });
    return () => {
      active = false;
    };
  }, [project.id, project.revision]);
  return (
    <main
      className="limited-source"
      style={{
        maxWidth: 720,
        margin: "auto",
        padding: "24px 20px",
        overflowWrap: "anywhere",
      }}
    >
      {phoneLimited ? (
        <>
          <h1>Too big for phone limits</h1>
          <h2>Project: {project.title}</h2>
          <p>
            This project has {leaves.toLocaleString("en")} parts and shapes;
            phone limits allow{" "}
            {RESOURCE_PROFILES.mobile.occurrences.toLocaleString("en")}. It is
            saved on this device and nothing has been lost.
          </p>
          <div className="button-row">
            <button
              className="primary"
              disabled={busy}
              onClick={() => setDesktopRequest((n) => n + 1)}
            >
              Open with desktop limits…
            </button>
            <button
              disabled={busy}
              onClick={() => void attempt(() => download("native"))}
            >
              Download backup
            </button>
          </div>
        </>
      ) : (
        <>
          <h1>Source retained</h1>
          <h2>{project.title}</h2>
          <p>
            Revision {project.revision}. Your complete project source is
            retained. 3D editing is unavailable under the current limit.
          </p>
          <p>
            The expanded model needs more memory than this editor currently
            allows. Your source is safe; download a backup or open another
            project.
          </p>
        </>
      )}
      <details>
        <summary
          style={{
            minHeight: 44,
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          Technical details
        </summary>
        <p>
          {diagnostic?.message}. Bounded estimate: at least{" "}
          {diagnostic?.requiredAtLeast.toLocaleString()} {diagnostic?.unit};
          configured limit {diagnostic?.limit.toLocaleString()}. This
          source-graph estimate does not allocate the expanded scene. Resource
          profile: {availability.profile}.
        </p>
        {phoneLimited && (
          <button
            disabled={busy}
            onClick={() => void attempt(() => download("ldraw"))}
          >
            Export complete LDraw source
          </button>
        )}
      </details>
      {availability.profile === "mobile" && (
        <ResourceProfilePanel
          editor={editor}
          onStatus={setMessage}
          headingLevel={2}
          desktopRequest={desktopRequest}
          onBackup={() => attempt(() => download("native"))}
        />
      )}
      {phoneLimited ? (
        <p>{saveStatus.replace(/ · revision \d+$/, "")}</p>
      ) : (
        <>
          <p>{saveStatus}</p>
          <div className="button-row">
            <button
              disabled={busy}
              onClick={() => void attempt(() => download("native"))}
            >
              Download native backup
            </button>
            <button
              disabled={busy}
              onClick={() => void attempt(() => download("ldraw"))}
            >
              Export complete LDraw source
            </button>
          </div>
          <p>
            Backups preserve source and metadata. Complete LDraw export
            preserves the model source; native files also preserve application
            metadata. Archive size and device storage limits still apply.
          </p>
        </>
      )}
      <label style={{ display: "grid", gap: 8, margin: "24px 0" }}>
        Open another project
        <input
          type="file"
          accept=".brickproj,.mpd,.ldr,.dat"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            void attempt(async () => {
              const assertCurrent = guardSource();
              const importBytes = resourceLimits(
                editor.resourceProfile,
              ).importBytes;
              ensure(
                file.size <= importBytes,
                "LIMIT_EXCEEDED",
                `Import file exceeds ${importBytes / 1024 / 1024} MiB`,
              );
              const input = file.name.toLowerCase().endsWith(".brickproj")
                ? {
                    format: "native" as const,
                    bytes: Array.from(new Uint8Array(await file.arrayBuffer())),
                  }
                : {
                    format: "ldraw" as const,
                    text: await file.text(),
                    name: file.name,
                  };
              assertCurrent();
              await api.project.import(input);
            });
          }}
        />
      </label>
      <button
        disabled={busy}
        onClick={() =>
          void attempt(async () => {
            const assertCurrent = guardSource();
            await download("native");
            assertCurrent();
            await api.project.import({ format: "template", template: "blank" });
          })
        }
      >
        Back up source and start blank
      </button>
      {message && <p role="alert">{message}</p>}
      <ProjectLibrary
        key={project.id + ":" + project.revision + ":" + saveStatus}
        currentId={project.id}
        open={async (saved) => {
          const assertCurrent = guardSource();
          await download("native");
          assertCurrent();
          knownSaveRevisions.set(saved.id, saved.revision);
          editor.replace(saved);
        }}
      />
    </main>
  );
}
