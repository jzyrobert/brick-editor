import { useEffect, useRef, useState } from "react";
import type { GalleryAngle, GalleryEntry } from "../catalog/gallery";
import { fetchGalleryModel } from "../catalog/gallery-index";
import {
  loadFullLibraryIndex,
  sourceNeedsFullLibrary,
} from "../catalog/full-library-loader";
import { libraryLock, retiredLibraryLocks } from "../catalog/catalog";
import { viewCamera } from "../build-script/views";
import { importLDraw } from "../ldraw/io";
import { SceneAdapter } from "../render/adapter";
import type { Vec3 } from "../core/types";

export type PreviewState = "loading" | "ready" | "failed";

/**
 * A live, spinnable view of one published build in the Realistic look: its
 * own small scene beside the workspace's (one at a time, freed when the
 * detail page closes). Angle changes swing the camera to the same framing as
 * the still renders.
 */
export function GalleryPreview({
  entry,
  angle,
  maxBytes,
  onState,
}: {
  entry: GalleryEntry;
  angle: GalleryAngle;
  maxBytes: number;
  onState: (state: PreviewState, message?: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const adapter = useRef<SceneAdapter>(undefined);
  const frame = useRef<{ target: Vec3; radius: number }>(undefined);
  const [ready, setReady] = useState(false);
  const report = useRef(onState);
  report.current = onState;
  useEffect(() => {
    let live = true;
    report.current("loading");
    (async () => {
      const text = await fetchGalleryModel(entry.build, entry.files, {
        maxBytes,
        locks: [libraryLock, ...retiredLibraryLocks],
      });
      if (sourceNeedsFullLibrary(text))
        await loadFullLibraryIndex().catch(() => {});
      const project = importLDraw(text, entry.title);
      if (!live || !host.current) return;
      const scene = new SceneAdapter(host.current, () => {});
      adapter.current = scene;
      scene.setGridVisible(false);
      scene.limitOrbitAboveGround();
      scene.setLook("realistic");
      scene.requestFitOnFirstParts();
      scene.update(project, { owned: true });
      await scene.ready();
      if (!live) return;
      scene.fit();
      const cam = scene.currentCamera();
      frame.current = {
        target: cam.target,
        radius: (cam.span ?? 0) / 2.3 || 200,
      };
      setReady(true);
      report.current("ready");
    })().catch((e: unknown) => {
      if (live)
        report.current(
          "failed",
          e instanceof Error ? e.message : "The 3D view could not load.",
        );
    });
    return () => {
      live = false;
      adapter.current?.dispose();
      adapter.current = undefined;
      frame.current = undefined;
      setReady(false);
    };
  }, [entry.id, entry.build, entry.files, entry.title, maxBytes]);
  useEffect(() => {
    const scene = adapter.current,
      f = frame.current;
    if (!ready || !scene || !f || !host.current) return;
    // A cube whose half-diagonal is the fitted radius, centred on the target:
    // viewCamera then frames it like the published renders.
    const h = f.radius / Math.sqrt(3);
    const bounds = {
      min: f.target.map((v) => v - h) as Vec3,
      max: f.target.map((v) => v + h) as Vec3,
    };
    const aspect =
      host.current.clientWidth / host.current.clientHeight || 4 / 3;
    // Lift the build a little in its stage so the angle tabs along the
    // bottom never cover it (LDraw's +Y is down).
    const view = viewCamera(bounds, angle, aspect);
    const lift = f.radius * 0.16;
    scene.setCamera({
      ...view,
      position: [view.position[0], view.position[1] + lift, view.position[2]],
      target: [view.target[0], view.target[1] + lift, view.target[2]],
    });
  }, [angle, ready]);
  return (
    <div
      ref={host}
      className={"gallery-live" + (ready ? " ready" : "")}
      role="img"
      aria-label={`${entry.title} in 3D. Drag to turn it, pinch or scroll to zoom.`}
    />
  );
}
