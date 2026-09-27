import {
  resolvePlayWorldProfile,
  validatePlayWorldProfile,
} from "./world-profile";
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
import { nearbyInteraction, type PlayInteraction } from "./interaction";
import { BrickAvatar } from "./avatar";

export type PlayViewState = {
  active: boolean;
  paused: boolean;
  loading: boolean;
  report?: PlaySnapshotReport;
  error?: string;
  vehicleControl?: string;
  interaction?: PlayInteraction;
};
/** Owns browser lifetime, never authoring state. API sessions are manual-tick by default. */
export class BrowserPlay {
  private session?: PlaySession;
  private captureSession?: PlaySession;
  private captureInputClear = false;
  private pauseVersion = 0;
  get pauseRevision() {
    return this.pauseVersion;
  }
  private assertMutable() {
    ensure(
      !this.captureSession,
      "CAPTURE_BUSY",
      "Wait for Play capture before changing the session",
    );
  }
  private avatar?: BrickAvatar;
  private restore?: () => void;
  private restorePose?: () => void;
  private raf = 0;
  private epoch = 0;
  get sessionEpoch() {
    return this.epoch;
  }
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
    this.assertMutable();
    this.beforeEnter();
    this.exit();
    const epoch = ++this.epoch;
    this.emit({ loading: true, error: undefined });
    try {
      const r = this.renderer();
      const project = this.project?.();
      const requestedProfile = validatePlayWorldProfile(request.worldProfile);
      ensure(
        project || requestedProfile.excludedLayerIds.length === 0,
        "INVALID_INPUT",
        "Layer exclusions require an authored project snapshot",
      );
      ensure(
        !(request.rigId !== undefined && request.rigIds !== undefined),
        "INVALID_INPUT",
        "Choose rigId or rigIds, not both",
      );
      const rigIds = request.rigIds ?? (request.rigId ? [request.rigId] : []);
      ensure(
        Array.isArray(rigIds) &&
          rigIds.length <= 32 &&
          rigIds.every(
            (id) =>
              typeof id === "string" && id.length > 0 && id.length <= 1024,
          ) &&
          new Set(rigIds).size === rigIds.length,
        "INVALID_INPUT",
        "Choose at most 32 unique authored rigs",
      );
      const worldProfile = project
        ? resolvePlayWorldProfile(project, request.worldProfile, rigIds)
        : undefined;
      const rigs = rigIds.map((id) => {
        const rig =
          project?.motionRigs && Object.hasOwn(project.motionRigs, id)
            ? project.motionRigs[id]
            : undefined;
        ensure(rig, "INVALID_INPUT", "Unknown authored Play rig");
        return rig;
      });
      const ids = rigs.flatMap((rig) =>
        rig.groups.flatMap((group) => group.occurrenceIds),
      );
      ensure(
        new Set(ids).size === ids.length,
        "INVALID_INPUT",
        "Active rigs cannot share occurrence members",
      );
      ensure(
        rigs.reduce((sum, rig) => sum + rig.groups.length, 0) <= 128,
        "LIMIT_EXCEEDED",
        "Play supports at most 128 moving groups across all rigs",
      );
      const [{ PlaySession }, geometry] = await Promise.all([
        import("./session"),
        r.playGeometry({
          include: worldProfile?.includedOccurrenceIds,
          exclude: ids,
        }),
      ]);
      const mechanismSources: PlayMechanismSource[] = [];
      let triangles = 0;
      for (const rig of rigs) {
        const groups: PlayMechanismSource["groups"] = {};
        for (const group of rig.groups) {
          const mesh = await r.playGeometry({ include: group.occurrenceIds });
          ensure(epoch === this.epoch, "INVALID_INPUT", "Play entry cancelled");
          ensure(
            geometry.revision === this.revision(),
            "REVISION_CONFLICT",
            "Project changed while preparing Play",
          );
          triangles += mesh.indices.length / 3;
          ensure(
            triangles <= 200000,
            "LIMIT_EXCEEDED",
            "Play supports at most 200,000 moving triangles across all rigs",
          );
          groups[group.id] = mesh;
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
        mechanismSources.push({ project: project!, rigId: rig.id, groups });
      }
      ensure(
        geometry.revision === this.revision(),
        "REVISION_CONFLICT",
        "Project changed while preparing Play",
      );
      const collisionSnapshot = {
        ...geometry,
        ...(worldProfile ? { worldProfile } : {}),
      };
      const session = await PlaySession.create(
        collisionSnapshot,
        request,
        mechanismSources,
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
      if (rigs.length) this.restorePose = r.beginTransientPose();
      this.restore = r.beginPlayView(worldProfile?.includedOccurrenceIds);
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
    const mechanisms = Object.values(
      report.mechanisms ??
        (report.mechanism
          ? { [report.mechanism.rigId]: report.mechanism }
          : {}),
    );
    if (mechanisms.length)
      r.applyTransientPose(
        Object.assign({}, ...mechanisms.map((m) => m.transforms)),
      );
    r.playCamera(this.session.camera(this.realtime && !this.state.paused));
    this.avatar?.update(this.session.snapshot());
    r.invalidate();
    this.state = {
      ...this.state,
      report: this.session.snapshot(),
      interaction: this.nearby(report),
    };
  }
  private nearby(report: PlaySnapshotReport) {
    const rigs = this.project?.().motionRigs ?? {};
    return Object.keys(
      report.mechanisms ??
        (report.mechanism
          ? { [report.mechanism.rigId]: report.mechanism }
          : {}),
    )
      .flatMap((id) =>
        rigs[id]
          ? [nearbyInteraction(rigs[id], report)].filter(
              (target): target is PlayInteraction => !!target,
            )
          : [],
      )
      .sort((a, b) => a.distance - b.distance)[0];
  }

  private schedule() {
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    if (!this.realtime || this.state.paused || !this.session) return;
    const frame = (now: number) => {
      if (!this.session || this.state.paused) return;
      if (this.captureSession) {
        this.last = now;
        this.raf = requestAnimationFrame(frame);
        return;
      }
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
    this.assertMutable();
    const session = this.current();
    if (this.state.vehicleControl) {
      // Let the normal validator reject malformed input before changing the vehicle.
      session.setInput(input);
      session.setInput({ yaw: input.yaw, pitch: input.pitch });
      session.setMechanismVehicleInput(
        {
          throttle: input.moveZ ?? 0,
          // LDraw up is −Y: vehicle-right is −X at heading zero.
          steering: -(input.moveX ?? 0),
        },
        this.state.vehicleControl,
      );
    } else session.setInput(input);
    this.held = { ...input };
  }
  clearInput() {
    if (this.captureSession) {
      this.captureInputClear = true;
      return;
    }
    this.held = {};
    this.session?.clearInput();
  }
  pause(paused = true) {
    this.pauseVersion++;
    if (this.captureSession) {
      this.captureInputClear = true;
      if (paused) this.emit({ paused: true });
      return;
    }
    this.clearInput();
    this.emit({ paused });
    if (this.session) this.draw();
    if (paused && document.pointerLockElement) void document.exitPointerLock();
    this.schedule();
  }
  look(dx: number, dy: number) {
    if (!this.session || this.state.paused || this.captureSession) return;
    const s = this.session.snapshot();
    this.setInput({
      ...this.held,
      yaw: s.yaw - dx * 0.004,
      pitch: s.pitch - dy * 0.004,
    });
    this.draw();
  }
  setCameraMode(mode: PlayCameraMode) {
    this.assertMutable();
    this.current().setCameraMode(mode);
    this.draw();
    this.emit();
    return this.current().snapshot();
  }
  setLocomotion(mode: PlayLocomotion) {
    this.assertMutable();
    this.releaseVehicle();
    const report = this.current().setLocomotion(mode);
    this.held = {};
    this.draw();
    this.emit();
    return report;
  }
  respawn() {
    this.assertMutable();
    this.releaseVehicle();
    const report = this.current().respawn();
    this.held = {};
    this.draw();
    this.emit();
    return report;
  }
  teleport(input: PlayTeleportRequest) {
    this.assertMutable();
    this.releaseVehicle();
    const report = this.current().teleport(input);
    this.held = {};
    this.draw();
    this.emit();
    return report;
  }
  stepTicks(count: number) {
    this.assertMutable();
    const session = this.current();
    session.stepTicks(count);
    this.draw();
    this.emit();
    return session.snapshot();
  }
  configureCamera(settings: Partial<PlayCameraSettings>) {
    this.assertMutable();
    this.current().configureCamera(settings);
    this.draw();
    this.emit();
    return this.current().snapshot();
  }
  chooseSpawn(input: PlaySpawnRequest) {
    this.assertMutable();
    const report = this.current().chooseSpawn(input);
    this.emit({ report });
    return report;
  }
  useSpawn() {
    this.assertMutable();
    this.releaseVehicle();
    const report = this.current().useSpawn();
    this.held = {};
    this.draw();
    this.emit();
    return report;
  }
  prepareCapture(aspectRatio: number) {
    this.assertMutable();
    const session = this.current();
    this.captureSession = session;
    this.captureInputClear = false;
    let restore: (() => void) | undefined;
    try {
      restore = session.beginCameraCapture(aspectRatio);
      this.renderer().playCamera(session.camera());
      this.avatar?.update(session.snapshot());
    } catch (error) {
      restore?.();
      this.captureSession = undefined;
      try {
        this.renderer().playCamera(session.camera());
      } catch {
        /* Preserve the original camera preparation failure. */
      }
      throw error;
    }
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      if (this.session !== session) return;
      try {
        restore!();
      } finally {
        if (this.captureSession === session) this.captureSession = undefined;
      }
      if (this.captureInputClear) {
        this.captureInputClear = false;
        this.clearInput();
      }
      this.draw();
    };
  }
  releaseVehicle() {
    this.assertMutable();
    if (!this.state.vehicleControl) return;
    this.clearInput();
    this.emit({ vehicleControl: undefined });
  }
  interact() {
    this.assertMutable();
    ensure(!this.state.paused, "INVALID_INPUT", "Resume Play to interact");
    const report = this.current().snapshot();
    if (this.state.vehicleControl) {
      this.releaseVehicle();
      return;
    }
    const target = this.nearby(report);
    ensure(
      target?.available,
      "INVALID_INPUT",
      "Move closer to the authored joint or vehicle",
    );
    this.clearInput();
    if (target.kind === "vehicle") this.emit({ vehicleControl: target.rigId });
    else
      this.setJointTarget({
        rigId: target.rigId,
        jointId: target.jointId,
        target: target.target,
        speed: target.speed,
      });
  }
  setJointTarget(request: {
    rigId?: string;
    jointId: string;
    target: number;
    speed: number;
  }) {
    this.assertMutable();
    const report = this.current().setJointTarget(request);
    this.draw();
    this.emit();
    return report;
  }
  setMechanismJoint(id: string, value: number, rigId?: string) {
    this.assertMutable();
    const report = this.current().setMechanismJoint(id, value, rigId);
    this.draw();
    this.emit();
    return report;
  }
  setMechanismVehicleInput(
    input: { throttle: number; steering: number },
    rigId?: string,
  ) {
    this.assertMutable();
    const report = this.current().setMechanismVehicleInput(input, rigId);
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
      this.exit(true);
      this.emit({
        error: "The build changed. Enter Play again to refresh the world.",
      });
    }
  }
  exit(force = false) {
    if (!force) this.assertMutable();
    this.captureSession = undefined;
    this.captureInputClear = false;
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
      vehicleControl: undefined,
      interaction: undefined,
    });
  }
  dispose() {
    this.exit(true);
    this.listeners.clear();
  }
}
