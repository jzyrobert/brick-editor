import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { PhotoProgressReport } from "../render/adapter";

/**
 * Photo-look refinement progress, kept outside React state (like LoadProgress)
 * so per-sample updates re-render only the indicator.
 */
let current: PhotoProgressReport | null = null;
const listeners = new Set<() => void>();
export function setPhotoProgress(progress: PhotoProgressReport | null) {
  current = progress && progress.phase !== "done" ? progress : null;
  for (const listener of listeners) listener();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** "Preparing photo…" / "Refining photo… n%" in the status toast, which stays
 * shown until the still has converged. */
export function PhotoProgressIndicator() {
  const progress = useSyncExternalStore(subscribe, () => current);
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const bar = ref.current?.closest<HTMLElement>(".status-bar");
    if (!bar) return;
    if (progress) bar.dataset.refining = "";
    else delete bar.dataset.refining;
  }, [progress]);
  const percent = progress?.percent ?? 0;
  return (
    <span
      ref={ref}
      className="load-progress photo-progress"
      hidden={!progress}
      role="progressbar"
      aria-label="Refining photo"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      {progress?.phase === "preparing"
        ? "Preparing photo…"
        : `Refining photo… ${percent}%`}
    </span>
  );
}
