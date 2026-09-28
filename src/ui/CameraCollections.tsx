import { useId, useState } from "react";
import { zipSync, strToU8 } from "fflate";
import type { BrickEditorAPI } from "../automation/api";
import { Icon } from "./icons";

/** Render a collection of camera bookmarks (a shared name prefix such as
 * "exterior/") against one revision into a ZIP of PNGs plus one manifest. */
export function CameraCollections({
  api,
  bookmarks,
  size,
  transparent,
  download,
  onStatus,
}: {
  api: BrickEditorAPI;
  bookmarks: string[];
  size: number[];
  transparent: boolean;
  download: (name: string, bytes: Uint8Array, mime: string) => void;
  onStatus: (message: string) => void;
}) {
  const id = useId();
  const groups = new Map<string, number>();
  for (const name of bookmarks) {
    const slash = name.lastIndexOf("/");
    if (slash > 0) {
      const prefix = name.slice(0, slash + 1);
      groups.set(prefix, (groups.get(prefix) ?? 0) + 1);
    }
  }
  const [prefix, setPrefix] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!bookmarks.length) return null;
  const count = prefix ? (groups.get(prefix) ?? 0) : bookmarks.length;
  return (
    <section className="camera-collections" aria-labelledby={id + "-title"}>
      <h3 id={id + "-title"}>Camera collection</h3>
      <p className="muted">
        Name bookmarks with a shared start, like “exterior/front” and
        “exterior/rear”, to render them together from one revision.
      </p>
      <label>
        Collection
        <select value={prefix} onChange={(e) => setPrefix(e.target.value)}>
          <option value="">All bookmarks ({bookmarks.length})</option>
          {[...groups].map(([p, n]) => (
            <option key={p} value={p}>
              {p.replace(/\/$/, "")} ({n})
            </option>
          ))}
        </select>
      </label>
      <button
        className="wide"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const result = await api.render.collection({
              prefix: prefix || undefined,
              width: size[0],
              height: size[1],
              background: transparent
                ? { type: "transparent" }
                : { type: "solid", color: "#ffffff" },
            });
            const files: Record<string, Uint8Array> = {
              "manifest.json": strToU8(
                JSON.stringify(result.manifest, null, 2),
              ),
            };
            for (const image of result.images)
              files[image.file] = new Uint8Array(
                await image.blob.arrayBuffer(),
              );
            download(
              `${(prefix || "all-views").replace(/\/$/, "")}-r${result.manifest.revision}.zip`,
              zipSync(files, { level: 0 }),
              "application/zip",
            );
            onStatus(
              `Rendered ${result.images.length} view${result.images.length === 1 ? "" : "s"} from revision ${result.manifest.revision}.`,
            );
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Rendering…"
          : `Download ${count} view${count === 1 ? "" : "s"}`}{" "}
        <Icon name="arrowDown" size={16} />
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
