import type { MechanismSnapshot } from "../mechanisms/types";
import type { Vec3 } from "../core/types";
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
export const PLAY_CAMERA_DEFAULTS = Object.freeze({
  eyeHeight: 64,
  fovDeg: 65,
  near: 0.5,
  followDistance: 120,
  minPitch: -1.48,
  maxPitch: 1.48,
});
export type PlayCameraSettings = {
  [K in keyof typeof PLAY_CAMERA_DEFAULTS]: number;
};
export const PLAY_CAMERA_LIMITS = Object.freeze({
  eyeHeight: { min: 16, max: 64 },
  fovDeg: { min: 30, max: 100 },
  near: { min: 0.05, max: 2 },
  followDistance: { min: 24, max: 400 },
  minPitch: { min: -1.48, max: 0 },
  maxPitch: { min: 0, max: 1.48 },
});
export type PlaySpawnRequest = { position: Vec3; yaw?: number; pitch?: number };
export type PlaySpawn = { position: Vec3; yaw: number; pitch: number };
export type PlayRequest = {
  worldProfile?: PlayWorldProfile;
  cameraSettings?: Partial<PlayCameraSettings>;
  rigId?: string;
  rigIds?: string[];
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
export const CHARACTER_PROFILE = Object.freeze({
  id: "original-brick-figure-v1",
  radius: 8,
  height: 72,
  eyeHeight: 64,
  stepHeight: 8,
  maxSlopeDegrees: 45,
  walkSpeed: 100,
  runSpeed: 170,
  flySpeed: 160,
  jumpSpeed: 190,
  gravity: 490,
  strideLength: 65,
  scaleMetresPerLdu: 0.02,
});
export type AvatarPose = {
  state: "idle" | "walk" | "run" | "jump" | "fall" | "seated";
  heading: number;
  phase: number;
  headYaw: number;
  leftHip: number;
  rightHip: number;
  leftShoulder: number;
  rightShoulder: number;
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
export type PlayMechanismReport = MechanismSnapshot & {
  blocked: boolean;
  blockedReason?: string;
  jointTargets: Record<string, PlayJointTargetReport>;
  vehicleCollision?: PlayVehicleCollisionReport;
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
export type PlaySnapshotReport = {
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
