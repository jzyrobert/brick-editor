import type { SceneAdapter } from "../render/adapter";
import type { Project } from "../core/types";
import type { PlayMechanismSource } from "./mechanism";
import { ensure } from "../core/types";
import type {
  PlayInput,
  PlayRequest,
  PlayCameraMode,
  PlayLocomotion,
  PlayTeleportRequest,
  PlaySnapshotReport,
  PlayCameraSettings,
  PlaySpawnRequest,
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
  private restorePose?: () => void;
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
    private project?: () => Project,
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
      const project = request.rigId ? this.project?.() : undefined;
      const rig = request.rigId
        ? project?.motionRigs?.[request.rigId]
        : undefined;
      ensure(
        !request.rigId || rig,
        "INVALID_INPUT",
        "Unknown authored Play rig",
      );
      const ids = rig?.groups.flatMap((group) => group.occurrenceIds) ?? [];
      const [{ PlaySession }, geometry] = await Promise.all([
        import("./session"),
        r.playGeometry({ exclude: ids }),
      ]);
      const mechanismSource: PlayMechanismSource | undefined =
        rig && project
          ? {
              project,
              rigId: rig.id,
              groups: Object.fromEntries(
                await Promise.all(
                  rig.groups.map(async (group) => [
                    group.id,
                    await r.playGeometry({ include: group.occurrenceIds }),
                  ]),
                ),
              ),
            }
          : undefined;
      if (mechanismSource)
        for (const mesh of Object.values(mechanismSource.groups)) {
          for (let axis = 0; axis < 3; axis++) {
            geometry.bounds.min[axis] = Math.min(
              geometry.bounds.min[axis],
              mesh.bounds.min[axis],
            );
            geometry.bounds.max[axis] = Math.max(
              geometry.bounds.max[axis],
              mesh.bounds.max[axis],
            );
          }
        }
      ensure(
        geometry.revision === this.revision(),
        "REVISION_CONFLICT",
        "Project changed while preparing Play",
      );
      const session = await PlaySession.create(
        geometry,
        request,
        mechanismSource,
      );
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
      if (rig) this.restorePose = r.beginTransientPose();
      this.restore = r.beginPlayView();
      this.avatar = new BrickAvatar();
      r.scene.add(this.avatar.group);
      this.realtime = request.realtime === true;
      this.emit({ active: true, paused: false, loading: false });
      this.draw();
      this.schedule();
      return session.snapshot();
    } catch (e) {
      if (epoch === this.epoch) {
        this.exit();
        this.emit({
          loading: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
      throw e;
    }
  }
  private draw() {
    if (!this.session) return;
    const r = this.renderer();
    const canvas = r.renderer.domElement;
    this.session.setViewportAspect(
      Math.max(1, canvas.clientWidth) / Math.max(1, canvas.clientHeight),
    );
    const report = this.session.snapshot();
    if (report.mechanism) r.applyTransientPose(report.mechanism.transforms);
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
  configureCamera(settings: Partial<PlayCameraSettings>) {
    this.current().configureCamera(settings);
    this.draw();
    this.emit();
    return this.current().snapshot();
  }
  chooseSpawn(input: PlaySpawnRequest) {
    const report = this.current().chooseSpawn(input);
    this.emit({ report });
    return report;
  }
  useSpawn() {
    const report = this.current().useSpawn();
    this.held = {};
    this.draw();
    this.emit();
    return report;
  }
  prepareCapture(aspectRatio: number) {
    const session = this.current(),
      restore = session.beginCameraCapture(aspectRatio);
    this.renderer().playCamera(session.camera());
    this.avatar?.update(session.snapshot());
    return () => {
      if (this.session === session) {
        restore();
        this.draw();
      }
    };
  }
  setMechanismJoint(id: string, value: number) {
    const report = this.current().setMechanismJoint(id, value);
    this.draw();
    this.emit();
    return report;
  }
  setMechanismVehicleInput(input: { throttle: number; steering: number }) {
    const report = this.current().setMechanismVehicleInput(input);
    this.draw();
    this.emit();
    return report;
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
    this.restorePose?.();
    this.restorePose = undefined;
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
