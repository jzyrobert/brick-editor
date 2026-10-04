import {
  prepareMechanicalProposal,
  reviewedProposalProject,
} from "../mechanisms/proposal-entry";
import type { MechanicalProposalRequest } from "../mechanisms/mechanical-proposals";
import { seatPoint } from "./seated-profile";
import {
  resolvePlayWorldProfile,
  validatePlayWorldProfile,
} from "./world-profile";
import type { SceneAdapter } from "../render/adapter";
import type { Project } from "../core/types";
import {
  mechanismViewGeometry,
  mechanismHeldView,
  mechanismOverviewCamera,
  mechanismUsableRect,
  type MechanismViewGeometry,
  type ViewRect,
} from "./mechanism-view";
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
  PlaySeatRequest,
  PlayMotorRequest,
  PlayGrabRequest,
  PlayGripRequest,
  PlayPosedModel,
  AvatarPose,
} from "./types";
import type { Vec3 } from "../core/types";
import { posedLDraw } from "../mechanisms/posed-export";
import type { PlaySession } from "./session";
import {
  nearbyInteraction,
  nearbyPoints,
  nearbyTrain,
  type PlayInteraction,
} from "./interaction";
import { occurrences } from "../core/document";
import { deriveDoorRigs, type DerivedDoors } from "./auto-doors";
import { deriveTrains, occurrenceBounds, type DerivedTrains } from "./trains";
import type { CollisionSnapshot } from "./types";
import type { DynamicRigSource } from "./dynamics";
import { BrickAvatar, loadAvatarGeometry } from "./avatar";
import {
  prepareFullLibrary,
  unresolvedCuratedRefs,
} from "../catalog/full-library-loader";
import { fullLibraryGeneration } from "../catalog/full-library";
import { PLAY_CAMERA_LIMITS } from "./types";

const ZOOM_KEY = "brick-editor-play-zoom-v1";
/** The follow distance last chosen by zoom in this tab, if valid. */
function storedZoom() {
  try {
    const value = Number(sessionStorage.getItem(ZOOM_KEY));
    const { min, max } = PLAY_CAMERA_LIMITS.followDistance;
    return sessionStorage.getItem(ZOOM_KEY) !== null &&
      Number.isFinite(value) &&
      value >= min &&
      value <= max
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}
function storeZoom(distance: number) {
  try {
    sessionStorage.setItem(ZOOM_KEY, String(distance));
  } catch {
    // Storage may be unavailable (private mode); zoom still works.
  }
}

/** Wall time a realtime frame may spend on catch-up physics ticks. */
export const PLAY_FRAME_TICK_BUDGET_MS = 10;

export type PlayViewState = {
  active: boolean;
  paused: boolean;
  loading: boolean;
  report?: PlaySnapshotReport;
  error?: string;
  vehicleControl?: string;
  interaction?: PlayInteraction;
  mechanismOverview?: string;
};
/** Owns browser lifetime, never authoring state. API sessions are manual-tick by default. */
export class BrowserPlay {
  private session?: PlaySession;
  /** Authored rigs for the active session. Sessions end whenever the source
   * revision changes, so one snapshot per entry is exact; reading the live
   * project per frame would deep-copy the whole document every frame. */
  private sessionRigs: Project["motionRigs"] = {};
  private mechanismViews: Record<string, MechanismViewGeometry> = {};
  private overview?: {
    rigId: string;
    yaw: number;
    pitch: number;
    zoom: number;
    panel?: ViewRect;
    topInset?: number;
  };
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
  private lastVisual = "";
  /** Mechanism pose last applied (rounded), to skip unchanged re-poses. */
  private lastScene = "";
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
  getSessionRigs = () => this.sessionRigs;
  async enterProposal(
    input: MechanicalProposalRequest,
    request: PlayRequest = {},
    physics: "kinematic" | "dynamic" = "kinematic",
  ) {
    this.assertMutable();
    const entryEpoch = this.epoch;
    const source = this.project?.();
    ensure(source, "INVALID_INPUT", "Mechanism review requires a project.");
    const proposal = await prepareMechanicalProposal(
      source,
      input,
      () => this.revision() === source.revision,
    );
    ensure(
      entryEpoch === this.epoch,
      "INVALID_INPUT",
      "Mechanism entry cancelled.",
    );
    const copy = reviewedProposalProject(source, input, proposal);
    ensure(
      physics === "kinematic" || physics === "dynamic",
      "INVALID_INPUT",
      "Choose Kinematic or Dynamic physics.",
    );
    ensure(
      !request.rigId && !request.rigIds && !request.dynamicRigIds,
      "INVALID_INPUT",
      "The reviewed proposal selects its own rig.",
    );
    return this.enterPrepared(
      {
        ...request,
        rigId: proposal.rig!.id,
        ...(physics === "dynamic" ? { dynamicRigIds: [proposal.rig!.id] } : {}),
        cameraMode: "third-person",
      },
      copy,
    );
  }
  async enter(request: PlayRequest = {}) {
    return this.enterPrepared(request);
  }
  private async enterPrepared(request: PlayRequest, sessionProject?: Project) {
    this.assertMutable();
    // The wheel/pinch zoom distance carries over to later entries in this
    // browser tab (sessionStorage), unless the request sets its own.
    const zoom = storedZoom();
    if (
      zoom !== undefined &&
      request.cameraSettings?.followDistance === undefined
    )
      request = {
        ...request,
        cameraSettings: { ...request.cameraSettings, followDistance: zoom },
      };
    this.beforeEnter();
    this.exit();
    const epoch = ++this.epoch;
    this.emit({ loading: true, error: undefined });
    // The figure's parts (a small precached pack) compile while the world's
    // collision is collected; a failure only leaves third person without it.
    const figure = loadAvatarGeometry().catch((e: unknown) =>
      e instanceof Error ? e : new Error(String(e)),
    );
    try {
      const r = this.renderer();
      const project = sessionProject ?? this.project?.();
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
      const authored = rigIds.map((id) => {
        const rig =
          project?.motionRigs && Object.hasOwn(project.motionRigs, id)
            ? project.motionRigs[id]
            : undefined;
        ensure(rig, "INVALID_INPUT", "Unknown authored Play rig");
        return rig;
      });
      const dynamicRigIds = request.dynamicRigIds ?? [];
      ensure(
        Array.isArray(dynamicRigIds) &&
          dynamicRigIds.every((id) => rigIds.includes(id)),
        "INVALID_INPUT",
        "dynamicRigIds must name requested authored rigs",
      );
      // One occurrence expansion serves door derivation and every rig check.
      const all = project ? occurrences(project) : [];
      const lookup = new Map(all.map((o) => [o.id, o]));
      let derived: DerivedDoors | undefined;
      if (project && request.autoDoors !== false) {
        derived = deriveDoorRigs(project, {
          all,
          included: worldProfile
            ? new Set(worldProfile.includedOccurrenceIds)
            : undefined,
          reserved: new Set(
            Object.values(project.motionRigs ?? {}).flatMap((rig) =>
              rig.groups.flatMap((group) => group.occurrenceIds),
            ),
          ),
          maxRigs: 32 - authored.length,
          maxGroups:
            128 - authored.reduce((sum, rig) => sum + rig.groups.length, 0),
        });
        if (!derived.doors.length && !derived.skipped.length)
          derived = undefined;
      }
      const sourceProject =
        project && derived
          ? {
              ...project,
              motionRigs: { ...project.motionRigs, ...derived.rigs },
            }
          : project;
      const rigs = [...authored, ...Object.values(derived?.rigs ?? {})];
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
      // Official parts outside the curated pack load on demand. A failed or
      // interrupted download leaves them missing, which turns collision off
      // for the whole world; retry now and re-render before collecting the
      // collision snapshot, so walking is not refused for a transient fault.
      if (project) await this.loadOnDemandParts(project, r);
      ensure(epoch === this.epoch, "INVALID_INPUT", "Play entry cancelled");
      // Trains on official track (session-only). Their parts leave the
      // static world and move as whole cars.
      let trains: DerivedTrains | undefined;
      if (project && request.trains !== false) {
        trains = deriveTrains({
          all,
          included: worldProfile
            ? new Set(worldProfile.includedOccurrenceIds)
            : undefined,
          reserved: new Set(ids),
          bounds: occurrenceBounds(project),
        });
        if (!trains.graph.pieces.length) trains = undefined;
      }
      const [{ PlaySession }, geometry] = await Promise.all([
        import("./session"),
        r.playGeometry({
          include: worldProfile?.includedOccurrenceIds,
          exclude: [...ids, ...(trains?.occurrenceIds ?? [])],
        }),
      ]);
      const trainMeshes: Record<string, CollisionSnapshot> = {};
      for (const train of trains?.trains ?? [])
        for (const [i, car] of train.cars.entries()) {
          trainMeshes[`${train.id}/${i}`] = await r.playGeometry({
            include: [
              ...car.occurrenceIds,
              ...car.bogies.flatMap((b) => b.occurrenceIds),
            ],
          });
          ensure(epoch === this.epoch, "INVALID_INPUT", "Play entry cancelled");
        }
      const mechanismSources: PlayMechanismSource[] = [];
      let triangles = 0;
      for (const rig of rigs) {
        const groups: PlayMechanismSource["groups"] = {};
        const members: DynamicRigSource["members"] = {};
        const dynamic = dynamicRigIds.includes(rig.id);
        for (const group of rig.groups) {
          if (dynamic || group.occurrenceIds.length <= 512)
            for (const id of group.occurrenceIds) {
              members[id] = await r.playGeometry({ include: [id] });
              ensure(
                epoch === this.epoch,
                "INVALID_INPUT",
                "Play entry cancelled",
              );
            }
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
        mechanismSources.push({
          project: sourceProject!,
          rigId: rig.id,
          groups,
          lookup,
          ...(Object.keys(members).length ===
          rig.groups.flatMap((g) => g.occurrenceIds).length
            ? { members }
            : {}),
        });
        this.mechanismViews[rig.id] = mechanismViewGeometry(rig, groups);
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
      const figureGeometry = await figure;
      ensure(epoch === this.epoch, "INVALID_INPUT", "Play entry cancelled");
      const sessionRequest: PlayRequest = { ...request };
      if (derived && Object.keys(derived.rigs).length) {
        delete sessionRequest.rigId;
        sessionRequest.rigIds = rigs.map((rig) => rig.id);
      }
      const session = await PlaySession.create(
        collisionSnapshot,
        sessionRequest,
        mechanismSources,
        derived
          ? { doors: derived.doors, skipped: derived.skipped }
          : undefined,
        trains ? { derived: trains, meshes: trainMeshes } : undefined,
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
      const doorRigs = structuredClone(derived?.rigs ?? {});
      // Mirror each door's decided swing so nearby actions use the same limits.
      for (const door of session.snapshot().autoDoors?.doors ?? []) {
        const joint = doorRigs[door.rigId]?.joints.find(
          (j) => j.id === door.jointId,
        );
        if (joint)
          joint.limits =
            door.swing === "both"
              ? [-90, 90]
              : door.swing === "positive"
                ? [0, 90]
                : door.swing === "negative"
                  ? [-90, 0]
                  : [0, 0];
      }
      this.sessionRigs = { ...(project?.motionRigs ?? {}), ...doorRigs };
      this.held = {};
      if (rigs.length || trains?.trains.length)
        this.restorePose = r.beginTransientPose();
      this.restore = r.beginPlayView(worldProfile?.includedOccurrenceIds);
      this.avatar = new BrickAvatar();
      if (figureGeometry instanceof Error)
        console.warn("Play figure unavailable: " + figureGeometry.message);
      else this.avatar.attach(figureGeometry);
      this.lastVisual = "";
      this.lastScene = "";
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
  private async loadOnDemandParts(project: Project, r: SceneAdapter) {
    if (!unresolvedCuratedRefs(project).size) return;
    const before = fullLibraryGeneration();
    // Resolves to a message instead of throwing; still-missing parts are then
    // named by the collision snapshot's warning.
    await prepareFullLibrary(project);
    if (fullLibraryGeneration() !== before) await r.update(project);
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
    const transforms =
      mechanisms.length || report.trains?.trains.length
        ? Object.assign(
            {},
            ...mechanisms.map((m) => m.transforms),
            this.session.trainTransforms(),
          )
        : undefined;
    const interpolate = this.realtime && !this.state.paused;
    const camera = this.overviewCamera() ?? this.session.camera(interpolate);
    // The figure uses the same interpolation factor as the camera, so both
    // move together between fixed ticks instead of the figure juddering.
    const view = this.session.presentation(interpolate);
    const figureShown =
      !this.overview &&
      report.avatarVisible &&
      report.cameraMode === "third-person";
    // Only redraw when something Play controls on screen changed; standing still
    // (or paused) no longer re-renders the whole world every animation frame.
    // Values are compared at 1/1000 precision: ground snapping jitters a resting
    // character by ~1e-6 LDU per tick, which is invisible but would defeat this.
    // The hidden figure is left out, and its idle sway is compared coarsely
    // (1/100 radian), so an idle third-person view redraws only a few times a
    // second rather than every frame.
    const visual =
      JSON.stringify(
        [
          r.cameraChanges,
          camera,
          transforms,
          figureShown,
          report.cameraMode,
          figureShown ? view.position : undefined,
        ],
        (_, value) =>
          typeof value === "number" ? Math.round(value * 1000) / 1000 : value,
      ) +
      (figureShown
        ? JSON.stringify(view.avatar, (_, value) =>
            typeof value === "number" ? Math.round(value * 100) / 100 : value,
          )
        : "");
    if (visual !== this.lastVisual) {
      this.lastVisual = visual;
      // Shadows depend on the scene, not the camera: a frame where only the
      // camera (or the figure, which casts no shadow) moved reuses the cached
      // shadow map of the Realistic/Photo looks. Moving parts re-render it.
      const scene = JSON.stringify(transforms ?? null, (_, value) =>
        typeof value === "number" ? Math.round(value * 1000) / 1000 : value,
      );
      const sceneChanged = scene !== this.lastScene;
      this.lastScene = scene;
      if (transforms && sceneChanged) r.applyTransientPose(transforms);
      r.playCamera(camera);
      // camera() is read-only, so one snapshot serves the avatar, pose and UI.
      this.avatar?.update(
        this.overview ? { ...report, avatarVisible: false } : report,
        view,
      );
      r.invalidate({ cameraOnly: !sceneChanged });
    }
    this.trace(camera.position, view);
    this.state = {
      ...this.state,
      report,
      interaction: this.nearby(report),
    };
  }
  private nearby(report: PlaySnapshotReport) {
    if (report.occupancy || report.trains?.riding) return undefined;
    const rigs = this.sessionRigs;
    // The nearest target the explorer can act on wins; points and doors
    // beside the track come before the train itself at equal reach.
    return [
      nearbyPoints(report),
      this.nearbyRig(report, rigs),
      nearbyTrain(report),
    ]
      .filter((target): target is PlayInteraction => !!target)
      .sort(
        (a, b) =>
          Number(b.available) - Number(a.available) || a.distance - b.distance,
      )[0];
  }
  private nearbyRig(
    report: PlaySnapshotReport,
    rigs: Project["motionRigs"],
  ): PlayInteraction | undefined {
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
      .map((target) => {
        const seat = rigs[target.rigId]?.vehicle?.driverSeat;
        if (target.kind !== "vehicle" || !seat) return target;
        const mechanism = report.mechanisms?.[target.rigId] ?? report.mechanism;
        const frame =
          mechanism!.groupFrames[rigs[target.rigId].vehicle!.chassisGroup];
        const access = seatPoint(frame, seat.accessPoint);
        const distance = Math.hypot(
          ...access.map((value, index) => value - report.position[index]),
        );
        const eligibility = this.current().seatInteractionHint({
          rigId: target.rigId,
          seatId: seat.id,
        });
        return {
          ...target,
          label: "Get in",
          distance,
          available: eligibility.eligible,
          blockedReason: eligibility.reason,
        };
      })
      .sort(
        (a, b) =>
          Number(b.available) - Number(a.available) || a.distance - b.distance,
      )[0];
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
        PLAY_FRAME_TICK_BUDGET_MS,
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
    if (this.overview) {
      // Controls operate the assembly; explorer movement waits until leaving.
      session.setInput(input);
      session.setInput({});
    } else if (this.state.vehicleControl) {
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
  /**
   * Turns the view by a pointer movement in CSS pixels. Touch drag uses the
   * default 0.004 rad/px; desktop mouse look passes its own sensitivity and
   * optional inverted Y (see look-settings.ts).
   */
  look(
    dx: number,
    dy: number,
    options: { radiansPerPixel?: number; invertY?: boolean } = {},
  ) {
    if (!this.session || this.state.paused || this.captureSession) return;
    const s = this.session.snapshot();
    const k = options.radiansPerPixel ?? 0.004;
    if (this.overview) {
      this.overview.yaw -= dx * k;
      this.overview.pitch = Math.max(
        -1.35,
        Math.min(
          1.35,
          this.overview.pitch + dy * k * (options.invertY ? -1 : 1),
        ),
      );
      this.draw();
      return;
    }
    this.setInput({
      ...this.held,
      yaw: s.yaw - dx * k,
      pitch: s.pitch - dy * k * (options.invertY ? -1 : 1),
    });
    this.draw();
  }
  private frames: Array<{
    t: number;
    /** Simulated seconds shown by this frame. */
    time: number;
    camera: Vec3;
    figure: Vec3;
    heading: number;
    pose: AvatarPose;
  }> = [];
  private trace(
    camera: Vec3,
    view: { position: Vec3; avatar: AvatarPose; time: number },
  ) {
    if (!this.realtime || this.state.paused) return;
    this.frames.push({
      t: performance.now(),
      time: view.time,
      camera: [...camera],
      figure: [...view.position],
      heading: view.avatar.heading,
      pose: { ...view.avatar },
    });
    if (this.frames.length > 600)
      this.frames.splice(0, this.frames.length - 600);
  }
  /**
   * Diagnostics: the camera position and interpolated figure root/pose drawn
   * in recent realtime frames (for smoothness tests; not a stable API).
   */
  /** The drawn Play figure (diagnostics for tests; not a stable contract). */
  figure() {
    return this.avatar?.describe();
  }
  frameTrace(clear = false) {
    const frames = this.frames.map((f) => structuredClone(f));
    if (clear) this.frames = [];
    return frames;
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
    const report = this.current().configureCamera(settings);
    if (settings.followDistance !== undefined)
      storeZoom(report.cameraSettings.followDistance);
    this.draw();
    this.emit();
    return this.current().snapshot();
  }
  /**
   * Scroll-wheel or pinch zoom of the third-person camera: `factor` below 1
   * zooms in. Past the closest distance it switches to first person, and
   * zooming out of first person returns to third person (session.ts).
   */
  zoom(factor: number) {
    if (!this.session || this.state.paused || this.captureSession) return;
    if (this.overview) {
      ensure(
        Number.isFinite(factor) && factor > 0,
        "INVALID_INPUT",
        "Zoom factor must be positive.",
      );
      this.overview.zoom = Math.max(
        0.25,
        Math.min(16, this.overview.zoom * factor),
      );
      this.draw();
      this.emit();
      return this.session.snapshot();
    }
    const report = this.session.zoomCamera(factor);
    storeZoom(report.cameraSettings.followDistance);
    this.draw();
    this.emit();
    return report;
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
    this.lastVisual = "";
    this.lastScene = "";
    let restore: (() => void) | undefined;
    try {
      restore = session.beginCameraCapture(aspectRatio);
      this.renderer().playCamera(
        this.overviewCamera(aspectRatio) ?? session.camera(),
      );
      const report = session.snapshot();
      this.avatar?.update(
        this.overview ? { ...report, avatarVisible: false } : report,
      );
    } catch (error) {
      restore?.();
      this.captureSession = undefined;
      try {
        this.renderer().playCamera(this.overviewCamera() ?? session.camera());
      } catch {
        /* Preserve the original camera preparation failure. */
      }
      throw error;
    }
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      // The capture camera replaced the live one; the next draw must restore it.
      this.lastVisual = "";
      this.lastScene = "";
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
  vehicleSeatEligibility(request: PlaySeatRequest) {
    return this.current().vehicleSeatEligibility(request);
  }
  enterVehicle(request: PlaySeatRequest) {
    this.assertMutable();
    const report = this.current().enterVehicle(request);
    this.clearInput();
    this.overview = undefined;
    this.emit({ vehicleControl: undefined, mechanismOverview: undefined });
    this.draw();
    this.emit();
    return report;
  }
  exitVehicle(input: { exitIndex?: number } = {}) {
    this.assertMutable();
    try {
      const report = this.current().exitVehicle(input);
      this.held = {};
      this.draw();
      this.emit();
      return report;
    } catch (error) {
      this.held = {};
      this.draw();
      this.emit();
      throw error;
    }
  }
  controlVehicle(rigId: string) {
    this.assertMutable();
    const report = this.current().snapshot();
    ensure(!report.occupancy, "INVALID_INPUT", "Exit vehicle first");
    const mechanism =
      report.mechanisms?.[rigId] ??
      (report.mechanism?.rigId === rigId ? report.mechanism : undefined);
    ensure(
      mechanism?.pose.vehicle &&
        mechanism.vehicleCollision?.supported !== false,
      "INVALID_INPUT",
      mechanism?.vehicleCollision?.reason ?? "Unknown supported active vehicle",
    );
    this.clearInput();
    this.overview = undefined;
    this.draw();
    this.emit({ vehicleControl: rigId, mechanismOverview: undefined });
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
    if (report.occupancy) {
      this.exitVehicle();
      return;
    }
    if (this.state.vehicleControl) {
      this.releaseVehicle();
      return;
    }
    const target = this.nearby(report);
    ensure(
      target?.available,
      "INVALID_INPUT",
      target?.blockedReason ?? "Move closer to the authored joint or vehicle",
    );
    this.clearInput();
    if (target.kind === "points") {
      this.setPoints({ occurrenceId: target.occurrenceId });
      return;
    }
    if (target.kind === "train") {
      this.rideTrain({ trainId: target.trainId });
      return;
    }
    if (target.kind === "vehicle") {
      const seat =
        report.mechanisms?.[target.rigId]?.mode === "dynamic"
          ? undefined
          : this.sessionRigs[target.rigId]?.vehicle?.driverSeat;
      if (seat) this.enterVehicle({ rigId: target.rigId, seatId: seat.id });
      else this.controlVehicle(target.rigId);
    } else
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
  /** Train throttle −1..1 of full speed (negative backwards). */
  setTrainThrottle(input: { trainId?: string; throttle: number }) {
    this.assertMutable();
    const report = this.current().setTrainThrottle(input);
    this.draw();
    this.emit();
    return report;
  }
  stopTrain(input: { trainId?: string } = {}) {
    this.assertMutable();
    const report = this.current().stopTrain(input);
    this.draw();
    this.emit();
    return report;
  }
  setPoints(input: { occurrenceId: string; route?: "straight" | "branch" }) {
    this.assertMutable();
    const report = this.current().setPoints(input);
    this.draw();
    this.emit();
    return report;
  }
  /** Ride along with a train (`trainId: null` ends the ride). */
  rideTrain(input: { trainId?: string | null } = {}) {
    this.assertMutable();
    const report = this.current().rideTrain(input);
    this.clearInput();
    this.overview = undefined;
    this.emit({ vehicleControl: undefined, mechanismOverview: undefined });
    this.lastVisual = "";
    this.draw();
    this.emit();
    return report;
  }
  setMotor(request: PlayMotorRequest) {
    this.assertMutable();
    const report = this.current().setMotor(request);
    this.draw();
    this.emit();
    return report;
  }
  grab(request: PlayGrabRequest) {
    this.assertMutable();
    const session = this.current();
    ensure(!this.state.paused, "INVALID_INPUT", "Resume Play to grab a part");
    const report = session.grab(request);
    this.draw();
    this.emit();
    return report;
  }
  release(request: PlayGripRequest) {
    this.assertMutable();
    const session = this.current();
    ensure(
      !this.state.paused,
      "INVALID_INPUT",
      "Resume Play to release a part",
    );
    const report = session.release(request);
    this.draw();
    this.emit();
    return report;
  }
  /**
   * Static posed LDraw snapshot of every active mechanism (including derived
   * doors and dynamic bodies). Rest-pose export and the project are untouched.
   */
  exportPosedModel(): PlayPosedModel {
    const report = this.current().snapshot();
    const project = this.project?.();
    ensure(
      project && project.revision === report.sourceRevision,
      "REVISION_CONFLICT",
      "Posed export needs the Play source revision",
    );
    const mechanisms = Object.values(report.mechanisms ?? {});
    const transforms = Object.assign(
      {},
      ...mechanisms.map((mechanism) => mechanism.transforms),
      this.current().trainTransforms(),
    );
    const posed = posedLDraw(project, transforms);
    return {
      format: "ldraw-mpd",
      text: posed.text,
      sourceRevision: report.sourceRevision,
      tick: report.tick,
      rigIds: [
        ...mechanisms.map((mechanism) => mechanism.rigId),
        ...(report.trains?.trains.map((t) => t.id) ?? []),
      ].sort(),
      posedOccurrenceIds: posed.posedOccurrenceIds,
      warnings: [
        ...posed.warnings,
        ...(mechanisms.some((mechanism) =>
          Object.values(mechanism.grippers ?? {}).some((grip) => grip.held),
        )
          ? [
              "Held parts export at their current pose; temporary Play attachment joints are not included.",
            ]
          : []),
      ],
    };
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
  /** Static collision size after compaction (diagnostics, not the snapshot contract). */
  collisionStats() {
    return this.current().collisionStats();
  }
  snapshot() {
    return this.current().snapshot();
  }
  camera() {
    this.current();
    return this.overviewCamera() ?? this.current().camera();
  }
  /** Browser presentation only: no authored pose or explorer camera changes. */
  focusMechanism(rigId?: string, panel?: ViewRect, clearTop?: number) {
    this.assertMutable();
    if (!this.session) return;
    if (rigId !== undefined) {
      ensure(
        this.mechanismViews[rigId],
        "INVALID_INPUT",
        "Unknown active mechanism.",
      );
      if (this.overview?.rigId !== rigId) {
        this.clearInput();
        this.overview = {
          rigId,
          yaw: Math.PI / 5,
          pitch: Math.PI / 7,
          zoom: 1,
        };
      }
      const rect = this.renderer().renderer.domElement.getBoundingClientRect();
      this.overview.panel = panel
        ? { ...panel, x: panel.x - rect.left, y: panel.y - rect.top }
        : undefined;
      this.overview.topInset =
        clearTop === undefined ? 0 : Math.max(0, clearTop - rect.top);
    } else {
      this.clearInput();
      this.overview = undefined;
    }
    this.draw();
    this.emit({ mechanismOverview: rigId });
  }
  fitMechanism() {
    if (!this.overview || this.captureSession) return;
    this.overview.zoom = 1;
    this.draw();
  }
  private overviewCamera(captureAspect?: number) {
    if (!this.session || !this.overview) return;
    const s = this.session.snapshot();
    const rig = s.mechanisms?.[this.overview.rigId];
    if (!rig) return;
    const canvas = this.renderer().renderer.domElement;
    const height = Math.max(1, canvas.clientHeight);
    const width = captureAspect
      ? height * captureAspect
      : Math.max(1, canvas.clientWidth);
    const heldView = mechanismHeldView(
      this.overview.rigId,
      this.mechanismViews,
      s.mechanisms!,
    );
    return mechanismOverviewCamera(
      heldView.geometry,
      heldView,
      { width, height },
      mechanismUsableRect(
        width,
        height,
        captureAspect ? undefined : this.overview.panel,
        captureAspect ? 0 : this.overview.topInset,
      ),
      this.overview,
      s.cameraSettings.fovDeg,
    );
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
    this.lastVisual = "";
    this.lastScene = "";
    this.frames = [];
    ++this.epoch;
    cancelAnimationFrame(this.raf);
    this.clearInput();
    if (document.pointerLockElement) void document.exitPointerLock();
    this.session?.dispose();
    this.session = undefined;
    this.sessionRigs = {};
    this.mechanismViews = {};
    this.overview = undefined;
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
      mechanismOverview: undefined,
    });
  }
  dispose() {
    this.exit(true);
    this.listeners.clear();
  }
}
