import type { SceneAdapter } from "../render/adapter";
import {
  snapshotSelect,
  type Containment,
  type Point2,
  type RegionMode,
  type RegionSnapshot,
} from "../render/region-selection";
import type { SelectionOperation } from "./selection";
export type RegionShape = "box" | "lasso";
/** What a region does to the selection. */
export type RegionOperation = SelectionOperation;
export type RegionGestureState = {
  /** Build mode, Select tool, nothing else claiming taps. */
  enabled: boolean;
  /** Explicit box/lasso mode (entered from Selection tools): one finger or the
   * mouse draws. Otherwise only a mouse or pen drag draws. */
  regionMode: boolean;
  shape: RegionShape;
  depth: RegionMode;
  rule: Containment;
  operation: RegionOperation;
  floorOnly: boolean;
  renderer?: SceneAdapter;
  revision: number;
  /** Editing scope (layers, locks): what the preview may count. */
  eligible: (ids: string[]) => string[];
};
/** Pointer travel (CSS px) before a press becomes a region instead of a tap. */
export const REGION_DRAG_THRESHOLD = 6;
/** Desktop modifiers: Shift adds, Alt (or Ctrl/Cmd) removes. */
export function modifierOperation(
  e: { shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean },
  fallback: RegionOperation,
): RegionOperation {
  if (e.altKey || e.ctrlKey || e.metaKey) return "remove";
  if (e.shiftKey) return "add";
  return fallback;
}
export function regionLabel(count: number, operation: RegionOperation) {
  const parts = `${count.toLocaleString("en-US")} part${count === 1 ? "" : "s"}`;
  return operation === "add"
    ? `+ ${parts}`
    : operation === "remove"
      ? `− ${parts}`
      : operation === "toggle"
        ? `± ${parts}`
        : parts;
}
/**
 * Box and lasso on the canvas. A press is armed, and becomes a region once it
 * travels past the threshold (a still tap stays an ordinary click). Nothing is
 * stopped on the way down, so a second finger reaches the orbit controls and
 * simply cancels the region. The view is captured once when the region starts
 * (one ID pass, or part outlines); every move re-evaluates that snapshot and
 * outlines what would be selected, with a live count.
 */
export function attachRegionGesture(
  element: HTMLElement,
  get: () => RegionGestureState,
  finish: (ids: string[], operation: RegionOperation) => void,
  report: (message: string) => void,
) {
  let armed:
    | { pointer: number; start: Point2; client: [number, number] }
    | undefined;
  let gesture:
    | {
        pointer: number;
        points: Point2[];
        revision: number;
        state: RegionGestureState;
        renderer: SceneAdapter;
        snapshot: RegionSnapshot;
        operation: RegionOperation;
        frame: number;
      }
    | undefined;
  const pointers = new Set<number>();
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"),
    path = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  svg.classList.add("selection-region");
  svg.setAttribute("aria-hidden", "true");
  svg.append(path);
  element.append(svg);
  const label = document.createElement("div");
  label.className = "selection-region-count";
  label.setAttribute("role", "status");
  label.hidden = true;
  element.append(label);
  const local = (e: PointerEvent): Point2 => {
    const r = element.getBoundingClientRect();
    return [
      Math.max(0, Math.min(r.width, e.clientX - r.left)),
      Math.max(0, Math.min(r.height, e.clientY - r.top)),
    ];
  };
  /** Region polygon in canvas CSS pixels (the canvas fills the viewport element). */
  const polygon = () => {
    if (!gesture) return [];
    const p = gesture.points,
      a = p[0],
      b = p[p.length - 1];
    return gesture.state.shape === "box"
      ? ([a, [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]] as Point2[])
      : p;
  };
  const evaluate = () => {
    if (!gesture) return [];
    const p = polygon();
    if (p.length < 3) return [];
    const ids = snapshotSelect(gesture.snapshot, p, gesture.state.rule);
    return gesture.state.eligible(ids);
  };
  const draw = () => {
    if (!gesture) return;
    const p = polygon();
    path.setAttribute("points", p.map((q) => q.join(",")).join(" "));
    path.dataset.operation = gesture.operation;
    if (gesture.frame) return;
    gesture.frame = requestAnimationFrame(() => {
      if (!gesture) return;
      gesture.frame = 0;
      try {
        const ids = evaluate();
        gesture.renderer.previewRegion(
          ids,
          gesture.operation === "remove" ? "remove" : "add",
          gesture.operation !== "replace",
        );
        const last = polygon().at(gesture.state.shape === "box" ? 2 : -1)!;
        label.textContent = regionLabel(ids.length, gesture.operation);
        label.dataset.operation = gesture.operation;
        label.hidden = false;
        label.style.left = `${last[0]}px`;
        label.style.top = `${last[1]}px`;
      } catch (error) {
        cancel();
        report(error instanceof Error ? error.message : String(error));
      }
    });
  };
  const cancel = () => {
    armed = undefined;
    if (!gesture) return;
    const g = gesture;
    gesture = undefined;
    if (g.frame) cancelAnimationFrame(g.frame);
    path.setAttribute("points", "");
    label.hidden = true;
    element.classList.remove("region-drawing");
    g.renderer.previewRegion(null);
  };
  const begin = (e: PointerEvent) => {
    const start = armed!;
    armed = undefined;
    const s = get();
    if (!s.enabled || !s.renderer || s.renderer.revision !== s.revision) return;
    let snapshot: RegionSnapshot;
    try {
      snapshot = s.renderer.regionSnapshot(s.depth, {
        floorOnly: s.floorOnly,
      });
    } catch (error) {
      report(error instanceof Error ? error.message : String(error));
      return;
    }
    gesture = {
      pointer: e.pointerId,
      points: [start.start],
      revision: s.revision,
      state: s,
      renderer: s.renderer,
      snapshot,
      operation: modifierOperation(e, s.operation),
      frame: 0,
    };
    element.classList.add("region-drawing");
    const canvas = element.querySelector("canvas");
    if (canvas && !canvas.hasPointerCapture(e.pointerId))
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // The pointer may already be gone; the region still ends on pointerup.
      }
  };
  const down = (e: PointerEvent) => {
    // A primary press means no other pointer is down (drops any missed release).
    if (e.isPrimary) pointers.clear();
    pointers.add(e.pointerId);
    if (pointers.size > 1) {
      // A second finger navigates: drop the region (the controls got the
      // first finger's press, so they orbit, pan and zoom as usual).
      if (gesture) report("Selection cancelled for two-finger navigation");
      cancel();
      return;
    }
    const s = get();
    if (
      !s.enabled ||
      !s.renderer ||
      e.button !== 0 ||
      !(e.target instanceof HTMLCanvasElement) ||
      (e.pointerType === "touch" && !s.regionMode) ||
      s.renderer.transformDragging ||
      s.renderer.transformHitTest(e.clientX, e.clientY)
    )
      return;
    armed = {
      pointer: e.pointerId,
      start: local(e),
      client: [e.clientX, e.clientY],
    };
  };
  const move = (e: PointerEvent) => {
    if (armed && e.pointerId === armed.pointer) {
      if (
        Math.hypot(e.clientX - armed.client[0], e.clientY - armed.client[1]) <
        REGION_DRAG_THRESHOLD
      )
        return;
      begin(e);
    }
    if (!gesture || e.pointerId !== gesture.pointer) return;
    e.preventDefault();
    gesture.operation = modifierOperation(e, gesture.state.operation);
    const p = local(e),
      last = gesture.points.at(-1)!;
    if (gesture.state.shape === "box") gesture.points = [gesture.points[0], p];
    else if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 2) {
      if (gesture.points.length >= 2047) {
        cancel();
        report("Selection cancelled: lasso exceeds 2,048 points");
        return;
      }
      gesture.points.push(p);
    }
    draw();
  };
  const up = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (armed?.pointer === e.pointerId) armed = undefined;
    if (!gesture || e.pointerId !== gesture.pointer) return;
    move(e);
    if (!gesture) return;
    const g = gesture,
      operation = modifierOperation(e, g.state.operation);
    let ids: string[] = [];
    let failure: unknown;
    try {
      ids = polygon().length >= 3 ? evaluate() : [];
    } catch (error) {
      failure = error;
    }
    cancel();
    if (failure) {
      report(failure instanceof Error ? failure.message : String(failure));
      return;
    }
    const s = get();
    if (
      !s.enabled ||
      s.revision !== g.revision ||
      g.renderer.revision !== g.revision
    ) {
      report("Selection cancelled because the build changed");
      return;
    }
    finish(ids, operation);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape" && gesture) {
      e.preventDefault();
      e.stopImmediatePropagation();
      cancel();
      report("Selection cancelled");
      return;
    }
    // Modifiers pressed mid-drag change the outcome at once.
    if (gesture && ["Shift", "Alt", "Control", "Meta"].includes(e.key)) {
      if (e.key === "Alt") e.preventDefault();
      const next = modifierOperation(e, gesture.state.operation);
      if (next !== gesture.operation) {
        gesture.operation = next;
        draw();
      }
    }
  };
  const pointerCancel = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    cancel();
  };
  const blur = () => {
    pointers.clear();
    cancel();
  };
  element.addEventListener("pointerdown", down, true);
  element.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", up, true);
  window.addEventListener("pointercancel", pointerCancel, true);
  window.addEventListener("blur", blur);
  window.addEventListener("keydown", key, true);
  window.addEventListener("keyup", key, true);
  return () => {
    cancel();
    svg.remove();
    label.remove();
    element.removeEventListener("pointerdown", down, true);
    element.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", up, true);
    window.removeEventListener("pointercancel", pointerCancel, true);
    window.removeEventListener("blur", blur);
    window.removeEventListener("keydown", key, true);
    window.removeEventListener("keyup", key, true);
  };
}
