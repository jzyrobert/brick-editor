import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { conversion } from "../core/math";
import type { Transform, Vec3 } from "../core/types";
export type TransformHandleOptions = {
  occurrenceIds: string[];
  mode: "translate" | "rotate";
  translationSnap: number | null;
  rotationSnapDegrees: number | null;
  onStart: () => void;
  onPreview: (delta: Transform) => void;
  onCommit: () => void;
  onCancel: () => void;
  onError: (error: unknown) => void;
};
/** DOM ownership lives here: a second pointer cancels editing before orbit navigation. */
export class TransformHandles {
  readonly controls: TransformControls;
  readonly helper: THREE.Object3D;
  private anchor = new THREE.Object3D();
  private start = new THREE.Matrix4();
  private conversion = new THREE.Matrix4().makeScale(1, -1, -1);
  private pointer: number | null = null;
  private pointers = new Map<number, PointerEvent>();
  private navigating = false;
  private replay = false;
  private orbitEnabled = true;
  private orbitLocked = false;
  private suppress = false;
  private disposed = false;
  constructor(
    private canvas: HTMLElement,
    private scene: THREE.Scene,
    private camera: () => THREE.Camera,
    private orbit: OrbitControls,
    pivot: Vec3,
    private options: TransformHandleOptions,
    private invalidate: () => void,
  ) {
    // Bind events ourselves so pointer cancellation and multi-touch are transactional.
    this.controls = new TransformControls(camera());
    this.controls.domElement = canvas;
    this.controls.setMode(options.mode);
    this.controls.setSpace("world");
    this.controls.setTranslationSnap(options.translationSnap);
    this.controls.setRotationSnap(
      options.rotationSnapDegrees === null
        ? null
        : (options.rotationSnapDegrees * Math.PI) / 180,
    );
    this.controls.setSize(matchMedia("(pointer: coarse)").matches ? 1.4 : 1);
    this.anchor.position.set(...conversion(pivot));
    scene.add(this.anchor);
    this.controls.attach(this.anchor);
    this.helper = this.controls.getHelper();
    scene.add(this.helper);
    this.controls.addEventListener("change", this.invalidate);
    this.controls.addEventListener("objectChange", this.changed);
    for (const [event, fn] of [
      ["pointerdown", this.down],
      ["pointermove", this.move],
      ["pointerup", this.up],
      ["pointercancel", this.cancelPointer],
      ["lostpointercapture", this.lost],
    ] as const)
      canvas.addEventListener(event, fn, true);
    window.addEventListener("keydown", this.key, true);
    window.addEventListener("blur", this.blur);
    document.addEventListener("visibilitychange", this.visibility);
    invalidate();
  }
  get dragging() {
    return this.pointer !== null;
  }
  private normalized(e: Pick<PointerEvent, "clientX" | "clientY">, button = 0) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 2 - 1,
      y: (-(e.clientY - r.top) / r.height) * 2 + 1,
      button,
    } as unknown as PointerEvent;
  }
  hitTest(x: number, y: number) {
    if (this.disposed || !this.helper.visible || this.navigating) return false;
    this.controls.camera = this.camera();
    this.anchor.updateMatrixWorld(true);
    this.helper.updateMatrixWorld(true);
    this.controls.pointerHover(this.normalized({ clientX: x, clientY: y }));
    return this.controls.axis !== null;
  }
  private down = (e: PointerEvent) => {
    if (this.replay) return;
    this.pointers.set(e.pointerId, e);
    if (this.pointers.size > 1) {
      const first =
        this.pointer === null ? undefined : this.pointers.get(this.pointer);
      this.cancel();
      this.navigating = true;
      if (first) {
        this.replay = true;
        try {
          this.canvas.dispatchEvent(
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
          this.replay = false;
        }
      }
      return;
    }
    if (
      this.navigating ||
      e.button !== 0 ||
      !this.hitTest(e.clientX, e.clientY)
    )
      return;
    e.preventDefault();
    e.stopImmediatePropagation();
    try {
      this.options.onStart();
      this.start.copy(this.anchor.matrixWorld);
      this.orbitEnabled = this.orbit.enabled;
      this.orbitLocked = true;
      this.orbit.enabled = false;
      this.controls.pointerDown(this.normalized(e));
      if (this.controls.dragging) {
        this.pointer = e.pointerId;
        this.canvas.setPointerCapture(e.pointerId);
      } else this.cancel();
    } catch (error) {
      this.cancel();
      this.options.onError(error);
    }
  };
  private move = (e: PointerEvent) => {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, e);
    if (this.pointer === e.pointerId) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.controls.camera = this.camera();
      this.controls.pointerMove(this.normalized(e, -1));
    } else if (!this.navigating && e.pointerType !== "touch")
      this.hitTest(e.clientX, e.clientY);
  };
  private changed = () => {
    if (this.pointer === null || this.suppress) return;
    try {
      this.anchor.updateMatrixWorld(true);
      const d = this.anchor.matrixWorld
        .clone()
        .multiply(this.start.clone().invert());
      d.premultiply(this.conversion).multiply(this.conversion);
      const e = d.elements;
      this.options.onPreview({
        position: [e[12], e[13], e[14]],
        basis: [e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]],
      });
    } catch (error) {
      this.cancel();
      this.options.onError(error);
    }
  };
  private release() {
    const id = this.pointer;
    this.pointer = null;
    if (id !== null && this.canvas.hasPointerCapture(id))
      this.canvas.releasePointerCapture(id);
    this.controls.pointerUp(null);
    if (this.orbitLocked) {
      this.orbit.enabled = this.orbitEnabled;
      this.orbitLocked = false;
    }
  }
  private up = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pointer === e.pointerId) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.release();
      try {
        this.options.onCommit();
      } catch (error) {
        this.options.onCancel();
        this.options.onError(error);
      }
    }
    if (!this.pointers.size) this.navigating = false;
  };
  private cancelPointer = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pointer === e.pointerId) {
      e.stopImmediatePropagation();
      this.cancel();
    }
    if (!this.pointers.size) this.navigating = false;
  };
  private lost = (e: PointerEvent) => {
    if (this.pointer === e.pointerId) this.cancel();
  };
  private key = (e: KeyboardEvent) => {
    if (e.key === "Escape" && this.dragging) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.cancel();
    }
  };
  private blur = () => {
    this.cancel();
    this.pointers.clear();
    this.navigating = false;
  };
  private visibility = () => {
    if (document.hidden) this.blur();
  };
  cancel() {
    this.suppress = true;
    try {
      if (this.controls.dragging) this.controls.reset();
      this.release();
      this.options.onCancel();
      this.invalidate();
    } finally {
      this.suppress = false;
    }
  }
  dispose() {
    if (this.disposed) return;
    this.cancel();
    this.disposed = true;
    for (const [event, fn] of [
      ["pointerdown", this.down],
      ["pointermove", this.move],
      ["pointerup", this.up],
      ["pointercancel", this.cancelPointer],
      ["lostpointercapture", this.lost],
    ] as const)
      this.canvas.removeEventListener(event, fn, true);
    window.removeEventListener("keydown", this.key, true);
    window.removeEventListener("blur", this.blur);
    document.removeEventListener("visibilitychange", this.visibility);
    this.controls.removeEventListener("change", this.invalidate);
    this.controls.removeEventListener("objectChange", this.changed);
    this.scene.remove(this.anchor, this.helper);
    this.controls.detach();
    const touchAction = this.canvas.style.touchAction;
    this.controls.dispose();
    this.canvas.style.touchAction = touchAction;
    this.invalidate();
  }
}
