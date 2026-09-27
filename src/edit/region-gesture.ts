import type { SceneAdapter } from "../render/adapter";
import type { Point2, RegionMode } from "../render/region-selection";
import type { SelectionShape } from "../ui/SelectionTools";
export function attachRegionGesture(
  element: HTMLElement,
  get: () => {
    enabled: boolean;
    shape: SelectionShape;
    depth: RegionMode;
    renderer?: SceneAdapter;
    revision: number;
  },
  finish: (ids: string[]) => void,
  report: (message: string) => void,
) {
  let gesture:
    | {
        pointer: number;
        event: PointerEvent;
        points: Point2[];
        revision: number;
        shape: SelectionShape;
        depth: RegionMode;
        renderer: SceneAdapter;
        controls: boolean;
      }
    | undefined;
  const navigationPointers = new Set<number>();
  let replay = false;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"),
    path = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  svg.classList.add("selection-region");
  svg.setAttribute("aria-hidden", "true");
  svg.append(path);
  element.append(svg);
  const local = (e: PointerEvent): Point2 => {
    const r = element.getBoundingClientRect();
    return [
      Math.max(0, Math.min(r.width, e.clientX - r.left)),
      Math.max(0, Math.min(r.height, e.clientY - r.top)),
    ];
  };
  const polygon = () => {
    if (!gesture) return [];
    const p = gesture.points,
      a = p[0],
      b = p[p.length - 1];
    return gesture.shape === "box"
      ? ([a, [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]] as Point2[])
      : p;
  };
  const draw = () =>
    path.setAttribute(
      "points",
      polygon()
        .map((p) => p.join(","))
        .join(" "),
    );
  const cancel = () => {
    if (!gesture) return;
    const g = gesture;
    gesture = undefined;
    g.renderer.controls.enabled = g.controls;
    path.setAttribute("points", "");
    if (element.hasPointerCapture(g.pointer))
      element.releasePointerCapture(g.pointer);
  };
  const stop = (e: PointerEvent) => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const down = (e: PointerEvent) => {
    if (replay) return;
    if (navigationPointers.size) {
      navigationPointers.add(e.pointerId);
      return;
    }
    if (gesture && e.pointerId !== gesture.pointer) {
      const first = gesture.event;
      navigationPointers.add(first.pointerId);
      navigationPointers.add(e.pointerId);
      cancel();
      replay = true;
      try {
        element.querySelector("canvas")?.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            pointerId: first.pointerId,
            pointerType: first.pointerType,
            isPrimary: true,
            clientX: first.clientX,
            clientY: first.clientY,
            button: 0,
            buttons: 1,
          }),
        );
      } finally {
        replay = false;
      }
      report("Selection cancelled for two-finger navigation");
      return;
    }
    const s = get();
    if (
      s.renderer?.transformDragging ||
      s.renderer?.transformHitTest(e.clientX, e.clientY)
    )
      return;
    if (
      !s.enabled ||
      s.shape === "click" ||
      !s.renderer ||
      e.button !== 0 ||
      !(e.target instanceof HTMLCanvasElement)
    )
      return;
    stop(e);
    gesture = {
      pointer: e.pointerId,
      event: e,
      points: [local(e)],
      revision: s.revision,
      shape: s.shape,
      depth: s.depth,
      renderer: s.renderer,
      controls: s.renderer.controls.enabled,
    };
    s.renderer.controls.enabled = false;
    element.setPointerCapture(e.pointerId);
    draw();
  };
  const move = (e: PointerEvent) => {
    if (navigationPointers.size) return;
    if (!gesture || e.pointerId !== gesture.pointer) return;
    stop(e);
    gesture.event = e;
    const p = local(e),
      last = gesture.points.at(-1)!;
    if (gesture.shape === "box") gesture.points = [gesture.points[0], p];
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
    if (navigationPointers.has(e.pointerId)) return;
    if (!gesture || e.pointerId !== gesture.pointer) return;
    move(e);
    if (!gesture) return;
    const g = gesture,
      p = polygon();
    cancel();
    const s = get();
    if (
      !s.enabled ||
      s.revision !== g.revision ||
      g.renderer.revision !== g.revision
    ) {
      report("Selection cancelled because the build changed");
      return;
    }
    if (p.length < 3) return;
    try {
      finish(g.renderer.selectRegion(p, g.depth));
    } catch (error) {
      report(error instanceof Error ? error.message : String(error));
    }
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape" && gesture) {
      e.preventDefault();
      e.stopImmediatePropagation();
      cancel();
      report("Selection cancelled");
    }
  };
  const navigationEnd = (e: PointerEvent) => {
    navigationPointers.delete(e.pointerId);
  };
  const pointerCancel = (e: PointerEvent) => {
    navigationPointers.delete(e.pointerId);
    cancel();
  };
  const blur = () => {
    navigationPointers.clear();
    cancel();
  };
  element.addEventListener("pointerdown", down, true);
  element.addEventListener("pointermove", move, true);
  element.addEventListener("pointerup", up, true);
  element.addEventListener("pointercancel", pointerCancel, true);
  element.addEventListener("lostpointercapture", cancel, true);
  window.addEventListener("pointerup", navigationEnd, true);
  window.addEventListener("pointercancel", navigationEnd, true);
  window.addEventListener("blur", blur);
  window.addEventListener("keydown", key, true);
  return () => {
    cancel();
    svg.remove();
    element.removeEventListener("pointerdown", down, true);
    element.removeEventListener("pointermove", move, true);
    element.removeEventListener("pointerup", up, true);
    element.removeEventListener("pointercancel", pointerCancel, true);
    element.removeEventListener("lostpointercapture", cancel, true);
    window.removeEventListener("pointerup", navigationEnd, true);
    window.removeEventListener("pointercancel", navigationEnd, true);
    window.removeEventListener("blur", blur);
    window.removeEventListener("keydown", key, true);
  };
}
