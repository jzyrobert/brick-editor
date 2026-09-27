import { useEffect, useRef, useState } from "react";
import type { Project } from "../core/types";
import type { PublishFormat, PublishRenderer } from "../instructions/publish";

export function InstructionsPublish({
  project,
  planId,
  renderer,
}: {
  project: Project;
  planId: string;
  renderer: PublishRenderer | undefined;
}) {
  const [format, setFormat] = useState<PublishFormat>("pdf");
  const [size, setSize] = useState("960");
  const [progress, setProgress] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const operation = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    operation.current?.abort();
    setBusy(false);
    setProgress("");
    return () => operation.current?.abort();
  }, [project.revision, planId]);
  async function publish() {
    if (!renderer) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setProgress("Preparing publication…");
    try {
      const { publishInstructions } = await import("../instructions/publish");
      const artifact = await publishInstructions(project, planId, renderer, {
        format,
        width: Number(size),
        height: Number(size) * 0.75,
        signal: controller.signal,
        onProgress: (done, total) => {
          if (!controller.signal.aborted)
            setProgress(`Rendering step ${done} of ${total}`);
        },
      });
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(
        new Blob([Uint8Array.from(artifact.bytes)], {
          type: artifact.mimeType,
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = artifact.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setProgress(`Downloaded ${artifact.name}`);
    } catch (error) {
      if (!controller.signal.aborted)
        setProgress(error instanceof Error ? error.message : String(error));
    } finally {
      if (operation.current === controller) {
        setBusy(false);
        operation.current = undefined;
      }
    }
  }
  return (
    <section aria-label="Publish instructions">
      <h3>Publish your sequence</h3>
      <p>
        Uses each saved step camera, or the current view when none is saved.
        Step notes, parts lists and a coverage report are included.
      </p>
      <div className="form-row">
        <label>
          Publication format
          <select
            value={format}
            disabled={busy}
            onChange={(e) => setFormat(e.target.value as PublishFormat)}
          >
            <option value="pdf">Printable PDF</option>
            <option value="png-zip">PNG images (ZIP)</option>
            <option value="html-zip">Browsable HTML (ZIP)</option>
          </select>
        </label>
        <label>
          Image size
          <select
            value={size}
            disabled={busy}
            onChange={(e) => setSize(e.target.value)}
          >
            <option value="640">640 × 480</option>
            <option value="960">960 × 720</option>
            <option value="1440">1440 × 1080</option>
          </select>
        </label>
      </div>
      <button
        className="primary wide"
        disabled={busy || !renderer}
        onClick={() => void publish()}
      >
        {busy ? "Publishing…" : "Download publication"}
      </button>
      {busy && (
        <button
          className="wide"
          onClick={() => {
            operation.current?.abort();
            setProgress("Cancelled");
          }}
        >
          Cancel publication
        </button>
      )}
      <p role="status" aria-live="polite">
        {progress}
      </p>
    </section>
  );
}
