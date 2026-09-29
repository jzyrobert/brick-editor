import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { LoadProgress } from "../render/adapter";

/**
 * Model loading progress, kept outside React state so its frequent updates
 * re-render only the indicator, never the workspace around it.
 */
let current: LoadProgress | null = null;
const listeners = new Set<() => void>();
export function setLoadProgress(progress: LoadProgress | null) {
  current = progress;
  for (const listener of listeners) listener();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** A thin bar and percentage in the status bar while a model loads. The
 * status bar (a transient toast) stays shown until loading ends. */
export function LoadProgressIndicator() {
  const progress = useSyncExternalStore(subscribe, () => current);
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const bar = ref.current?.closest<HTMLElement>(".status-bar");
    if (!bar) return;
    if (progress) bar.dataset.loading = "";
    else delete bar.dataset.loading;
  }, [progress]);
  const percent = progress
    ? Math.round((100 * progress.done) / Math.max(1, progress.total))
    : 0;
  return (
    <span
      ref={ref}
      className="load-progress"
      hidden={!progress}
      role="progressbar"
      aria-label="Loading parts"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <span className="load-progress-track">
        <span className="load-progress-bar" style={{ width: percent + "%" }} />
      </span>
      {percent}%
    </span>
  );
}
