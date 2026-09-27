import type { SceneAdapter } from "../render/adapter";
import { ensure } from "../core/types";
import type {
  PlayInput,
  PlayRequest,
  PlayCameraMode,
  PlayLocomotion,
  PlayTeleportRequest,
  PlaySnapshotReport,
} from "./types";
import type { PlaySession } from "./session";
import { BrickAvatar } from "./avatar";

export type PlayViewState = {
  active: boolean;
  paused: boolean;
  loading: boolean;
  report?: PlaySnapshotReport;
  error?: string;
};
/** Owns browser lifetime, never authoring state. API sessions are manual-tick by default. */
export class BrowserPlay {
  private session?: PlaySession;
  private avatar?: BrickAvatar;
  private restore?: () => void;
  private raf = 0;
  private epoch = 0;
  private realtime = false;
  private held: PlayInput = {};
  private last = 0;
  private notifyAt = 0;
  private listeners = new Set<() => void>();
  private state: PlayViewState = {
    active: false,
    paused: true,
    loading: false,
  };
  constructor(
    private render: () => SceneAdapter | undefined,
    private revision: () => number,
    private beforeEnter: () => void = () => {},
  ) {}
  getState = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit(patch: Partial<PlayViewState> = {}) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }
  private renderer() {
    const r = this.render();
    ensure(r, "WEBGL_UNAVAILABLE", "Play requires WebGL2");
    return r;
  }
  private current() {
    ensure(this.session, "INVALID_INPUT", "Enter Play first");
    ensure(
      this.session.snapshot().sourceRevision === this.revision(),
      "REVISION_CONFLICT",
      "Project changed; re-enter Play",
    );
    return this.session;
  }
  async enter(request: PlayRequest = {}) {
    this.beforeEnter();
    this.exit();
    const epoch = ++this.epoch;
    this.emit({ loading: true, error: undefined });
    try {
      const r = this.renderer();
      const [{ PlaySession }, geometry] = await Promise.all([
        import("./session"),
        r.playGeometry(),
      ]);
      ensure(
        geometry.revision === this.revision(),
        "REVISION_CONFLICT",
        "Project changed while preparing Play",
      );
      const session = await PlaySession.create(geometry, request);
      if (epoch !== this.epoch) {
        session.dispose();
        throw new Error("Play entry cancelled");
      }
      if (geometry.revision !== this.revision()) {
        session.dispose();
        throw new Error("Project changed while preparing Play");
      }
      this.session = session;
      this.held = {};
      this.restore = r.beginPlayView();
      this.avatar = new BrickAvatar();
      r.scene.add(this.avatar.group);
      this.realtime = request.realtime === true;
      this.emit({ active: true, paused: false, loading: false });
      this.draw();
      this.schedule();
      return session.snapshot();
    } catch (e) {
      if (epoch === this.epoch)
        this.emit({
          loading: false,
          error: e instanceof Error ? e.message : String(e),
        });
      throw e;
    }
  }
  private draw() {
    if (!this.session) return;
    const r = this.renderer();
    r.playCamera(this.session.camera(this.realtime && !this.state.paused));
    this.avatar?.update(this.session.snapshot());
    r.invalidate();
    this.state = { ...this.state, report: this.session.snapshot() };
  }
  private schedule() {
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    if (!this.realtime || this.state.paused || !this.session) return;
    const frame = (now: number) => {
      if (!this.session || this.state.paused) return;
      if (this.session.snapshot().sourceRevision !== this.revision()) {
        this.exit();
        return;
      }
      this.session.advance(
        Math.max(0, Math.min((now - this.last) / 1000, 0.1)),
      );
      this.last = now;
      this.draw();
      if (now - this.notifyAt > 150) {
        this.notifyAt = now;
        this.emit();
      }
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }
  setInput(input: PlayInput) {
    this.current().setInput(input);
    this.held = { ...input };
  }
  clearInput() {
    this.held = {};
    this.session?.clearInput();
  }
  pause(paused = true) {
    this.clearInput();
    this.emit({ paused });
    if (this.session) this.draw();
    if (paused && document.pointerLockElement) void document.exitPointerLock();
    this.schedule();
  }
  look(dx: number, dy: number) {
    if (!this.session || this.state.paused) return;
    const s = this.session.snapshot();
    this.session.setInput({
      ...this.held,
      yaw: s.yaw - dx * 0.004,
      pitch: s.pitch - dy * 0.004,
    });
    this.draw();
  }
  setCameraMode(mode: PlayCameraMode) {
    this.current().setCameraMode(mode);
    this.draw();
    this.emit();
    return this.current().snapshot();
  }
  setLocomotion(mode: PlayLocomotion) {
    const report = this.current().setLocomotion(mode);
    this.held = {};
    this.draw();
    this.emit();
    return report;
  }
  respawn() {
    const report = this.current().respawn();
    this.held = {};
    this.draw();
    this.emit();
    return report;
  }
  teleport(input: PlayTeleportRequest) {
    const report = this.current().teleport(input);
    this.held = {};
    this.draw();
    this.emit();
    return report;
  }
  stepTicks(count: number) {
    const session = this.current();
    session.stepTicks(count);
    this.draw();
    this.emit();
    return session.snapshot();
  }
  snapshot() {
    return this.current().snapshot();
  }
  camera() {
    return this.current().camera();
  }
  sourceChanged() {
    if (this.state.active || this.state.loading) {
      this.exit();
      this.emit({
        error: "The build changed. Enter Play again to refresh the world.",
      });
    }
  }
  exit() {
    ++this.epoch;
    cancelAnimationFrame(this.raf);
    this.clearInput();
    if (document.pointerLockElement) void document.exitPointerLock();
    this.session?.dispose();
    this.session = undefined;
    this.avatar?.dispose();
    this.avatar = undefined;
    this.restore?.();
    this.restore = undefined;
    this.emit({
      active: false,
      paused: true,
      loading: false,
      report: undefined,
    });
  }
  dispose() {
    this.exit();
    this.listeners.clear();
  }
}
