import type { MechanismSnapshot } from "../mechanisms/types";
import type { Vec3, Basis, Transform, Occurrence } from "../core/types";
import type { PlayTrainsReport } from "./trains";
/** Public coordinates are LDraw LDU: up is -Y. Angles are radians. */
export type PlayLocomotion = "walk" | "fly-noclip";
export type PlayCameraMode = "first-person" | "third-person";
export type PlayWorldProfile = { excludedLayerIds: string[] };
export type ResolvedPlayWorldProfile = PlayWorldProfile & {
  includedOccurrenceIds: string[];
};
export type CollisionSnapshot = {
  worldProfile?: ResolvedPlayWorldProfile;
  revision: number;
  vertices: Float32Array;
  indices: Uint32Array;
  bounds: { min: Vec3; max: Vec3 };
  warnings?: string[];
  unsupported?: boolean;
};
/** Canonical geometry captured from the actual occurrence's compiled prototype.
 * Internal session buffers are read-only and may be shared by identical prototypes.
 * `frame` is the authored part-local → world LDraw transform, never a live pose. */
export type PlayMemberLocalGeometry = {
  readonly revision: number;
  readonly occurrenceId: string;
  readonly namespace: Occurrence["namespace"];
  readonly frame: Transform;
  readonly vertices: Float64Array;
  readonly indices: Uint32Array;
  readonly bounds: { min: Vec3; max: Vec3 };
  readonly unsupported?: boolean;
  readonly warnings?: string[];
};
export const PLAY_CAMERA_DEFAULTS = Object.freeze({
  /** The figure's printed eyes (CHARACTER_PROFILE.eyeHeight). */
  eyeHeight: 86,
  fovDeg: 65,
  near: 0.5,
  followDistance: 160,
  minPitch: -1.48,
  maxPitch: 1.48,
});
export type PlayCameraSettings = {
  [K in keyof typeof PLAY_CAMERA_DEFAULTS]: number;
};
export const PLAY_CAMERA_LIMITS = Object.freeze({
  eyeHeight: { min: 16, max: 100 },
  fovDeg: { min: 30, max: 100 },
  near: { min: 0.05, max: 2 },
  followDistance: { min: 24, max: 400 },
  minPitch: { min: -1.48, max: 0 },
  maxPitch: { min: 0, max: 1.48 },
});
/**
 * Scroll-wheel / pinch zoom range of the third-person follow distance (LDU).
 * The closest keeps the camera outside the figure; zooming in past it
 * switches to first person.
 */
export const PLAY_ZOOM_LIMITS = Object.freeze({ min: 40, max: 400 });
export type PlaySpawnRequest = { position: Vec3; yaw?: number; pitch?: number };
export type PlaySpawn = { position: Vec3; yaw: number; pitch: number };
export type PlayRequest = {
  worldProfile?: PlayWorldProfile;
  cameraSettings?: Partial<PlayCameraSettings>;
  rigId?: string;
  rigIds?: string[];
  /** Active rigs simulated with dynamic rigid bodies instead of kinematic poses. */
  dynamicRigIds?: string[];
  /**
   * Hinge official LDraw door leaves automatically (default true). Derived
   * rigs are session-only and never written to the project.
   */
  autoDoors?: boolean;
  /**
   * Run trains standing on official LDraw track (default true). Derived
   * trains are session-only and never written to the project.
   */
  trains?: boolean;
  locomotion?: PlayLocomotion;
  cameraMode?: PlayCameraMode;
  position?: Vec3;
  yaw?: number;
  pitch?: number;
  ground?: boolean;
  realtime?: boolean;
};
export type PlayInput = {
  /** Right and forward in camera-relative space, each [-1,1]. */
  moveX?: number;
  moveZ?: number;
  vertical?: number;
  run?: boolean;
  jump?: boolean;
  /** Absolute look angles (radians), useful for deterministic replay. */
  yaw?: number;
  pitch?: number;
};
export type PlayTeleportRequest = {
  position: Vec3;
  policy?: "safe" | "free-flight";
  yaw?: number;
  pitch?: number;
};
/**
 * The explicit Play character profile (LDU, LDU/s) at the true scale of the
 * Play figure, an assembly of official LDraw minifig parts (avatar-assembly.ts):
 * the collider is as tall as the figure with its hair (103 LDU), its radius is
 * the torso's half-width at the shoulders and the figure's half-depth (973 is
 * 24 LDU across at the top, torso and legs 20–22.5 deep), and the eye is at the
 * printed eyes. LDraw doors and buildings are designed for this figure, so
 * nothing is rescaled to fit an opening. The hips and hanging arms (38–64 LDU
 * across) are wider than the capsule and may brush a wall the figure slides
 * along, as a real minifig's would; two-stud gaps (40 LDU) stay passable.
 * Speeds are the former 72 LDU profile's scaled by the height ratio (×1.45);
 * gravity stays physical at the declared LDU scale; stairs of one brick still
 * step up.
 */
export const CHARACTER_PROFILE = Object.freeze({
  id: "ldraw-minifig-v1",
  radius: 12,
  height: 104,
  eyeHeight: 86,
  stepHeight: 24,
  maxSlopeDegrees: 45,
  walkSpeed: 145,
  runSpeed: 245,
  flySpeed: 230,
  jumpSpeed: 230,
  gravity: 490,
  strideLength: 85,
  scaleMetresPerLdu: 0.02,
});
/** Presentation pose of the figure (radians; positive limb angles swing
 * forward). Computed from fixed-tick motion state; see avatar-motion.ts. */
export type AvatarPose = {
  state: "idle" | "walk" | "run" | "jump" | "fall" | "fly" | "seated";
  /** Body (root) yaw. */
  heading: number;
  /** Actual seated chassis orientation in LDraw axes; absent on foot. */
  basis?: Basis;
  /** Gait phase: advances 2π per stride of travelled distance. */
  phase: number;
  /** Swing amount in [0, 1], blended toward horizontal speed each tick. */
  swing: number;
  headYaw: number;
  headPitch: number;
  /** Visual-only vertical offset of the figure while hovering (LDU, +up). */
  bob: number;
  leftHip: number;
  rightHip: number;
  leftShoulder: number;
  rightShoulder: number;
  /** Hand turn about each wrist (the hand's grip axis). */
  leftWrist: number;
  rightWrist: number;
};
export const JOINT_TARGET_SPEED_LIMITS = Object.freeze({
  revolute: { min: 0.001, max: 3600 },
  prismatic: { min: 0.001, max: 10000 },
});
export type PlayJointTargetRequest = {
  rigId?: string;
  jointId: string;
  target: number;
  speed: number;
};
export type PlayJointTargetReport = {
  current: number;
  target: number;
  speed: number;
  status: "moving" | "blocked" | "complete";
  units: "degrees" | "LDU";
  speedUnits: "degrees/s" | "LDU/s";
  blockedReason?: string;
};
export type PlayVehicleCollisionReport = {
  profile: "source-boxes-v1";
  units: "metres";
  supported: boolean;
  status: "ready" | "blocked" | "unsupported";
  reason?: string;
  obstacle?: { sourceId: string; triangleIndex: number };
};
export type PlayMotorRequest = {
  rigId?: string;
  jointId: string;
  enabled: boolean;
  /** Session-only speed/direction, -1..1. Zero brakes; omit to use defaults. */
  input?: number;
};
/**
 * Authored joint motors in Play. Kinematic rigs travel at a declared rate
 * (position motors at 90 degrees/s or 40 LDU/s; velocity motors at their
 * target); dynamic rigs drive Rapier joint motors limited by maxEffort.
 */
export type PlayMotorReport = {
  mode: "position" | "velocity";
  target: number;
  enabled: boolean;
  status: "running" | "holding" | "blocked" | "at-limit" | "stopped";
  units: "degrees" | "LDU";
  targetUnits: "degrees" | "LDU" | "degrees/s" | "LDU/s";
  simulation: "kinematic-rate" | "dynamic-motor";
  blockedReason?: string;
  /** Present while using a live speed/direction override. */
  input?: number;
};
export type PlayDynamicsReport = {
  engine: string;
  /** Simulation gravity, metres/second squared. */
  gravity: number;
  bodies: Record<
    string,
    {
      anchored: boolean;
      massKg: number;
      colliders: number;
      sleeping: boolean;
      /** LDU/second, LDraw axes. */
      linearVelocity: Vec3;
      /** Degrees/second. */
      angularSpeed: number;
    }
  >;
  /** Read-only free cylindrical coordinates; not scalar actuator controls. */
  bearings?: Record<string, { translationLdu: number; angleDegrees: number }>;
  wheels?: Record<
    string,
    {
      contact: boolean;
      /** LDU. */
      suspensionLength: number;
      steeringDegrees: number;
      rotationDegrees: number;
    }
  >;
  /** Forward chassis speed, LDU/second. */
  speed?: number;
};
export type PlayMechanismReport = MechanismSnapshot & {
  blocked: boolean;
  blockedReason?: string;
  jointTargets: Record<string, PlayJointTargetReport>;
  vehicleCollision?: PlayVehicleCollisionReport;
  motors?: Record<string, PlayMotorReport>;
  dynamics?: PlayDynamicsReport;
  grippers?: Record<string, PlayGripperReport>;
};
/** Native-session actions never write held state into the authored project. */
export type PlayGripTarget = { rigId: string; groupId: string };
export type PlayGripRequest = { rigId: string; gripperId: string };
export type PlayGrabRequest = PlayGripRequest & { target: PlayGripTarget };
export type PlayGripCandidate = PlayGripTarget & {
  massKg: number;
  distanceLdu: number;
};
export type PlayGripperReport = {
  groupId: string;
  anchorWorldLdu: Vec3;
  state: "empty" | "ready" | "holding";
  candidates: PlayGripCandidate[];
  held?: PlayGripTarget & { massKg: number };
};
/** Static posed snapshot; the authored project is never changed. */
export type PlayPosedModel = {
  format: "ldraw-mpd";
  text: string;
  sourceRevision: number;
  tick: number;
  rigIds: string[];
  posedOccurrenceIds: string[];
  warnings: string[];
};
export type PlaySeatRequest = { rigId: string; seatId: string };
export type PlaySeatEligibility = PlaySeatRequest & {
  eligible: boolean;
  reason?: string;
};
export type PlayOccupancy = PlaySeatRequest & {
  profile: "brick-figure-open-seat-v1";
  pelvisWorldLdu: Vec3;
  avatarRootWorldLdu: Vec3;
  effectiveEyeWorldLdu: Vec3;
  localLookYaw: number;
  localLookPitch: number;
};
/** Free swing direction of an automatic door, decided from the Play world. */
export type PlayAutoDoorSwing = "both" | "positive" | "negative" | "blocked";
export type PlayAutoDoorsReport = {
  doors: Array<{
    rigId: string;
    jointId: string;
    occurrenceId: string;
    part: string;
    anchorOccurrenceId: string;
    pivot: Vec3;
    axis: Vec3;
    leaf: Vec3;
    swing: PlayAutoDoorSwing;
  }>;
  skipped: Array<{ occurrenceId: string; part: string; reason: string }>;
};
export type PlaySnapshotReport = {
  autoDoors?: PlayAutoDoorsReport;
  /** Running trains on official track (session-only; docs/PLAY-TRAINS.md). */
  trains?: PlayTrainsReport & { riding?: string };
  occupancy?: PlayOccupancy;
  positionAnchor: "standing-feet" | "seated-avatar-root";
  mechanism?: PlayMechanismReport;
  mechanisms?: Record<string, PlayMechanismReport>;
  worldProfile: ResolvedPlayWorldProfile;
  cameraSettings: PlayCameraSettings;
  cameraSafety: {
    aspectRatio: number;
    effectiveNear: number;
    collisionRadius: number;
  };
  spawn?: PlaySpawn;
  sourceRevision: number;
  tick: number;
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  pitch: number;
  grounded: boolean;
  locomotion: PlayLocomotion;
  cameraMode: PlayCameraMode;
  collisionReady: boolean;
  avatarReady: boolean;
  avatarVisible: boolean;
  profile: typeof CHARACTER_PROFILE;
  units: "LDU";
  simulationHz: 60;
  warnings: string[];
  avatar: AvatarPose;
};
