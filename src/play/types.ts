import type { MechanismSnapshot } from "../mechanisms/types";
import type { Vec3 } from "../core/types";
/** Public coordinates are LDraw LDU: up is -Y. Angles are radians. */
export type PlayLocomotion = "walk" | "fly-noclip";
export type PlayCameraMode = "first-person" | "third-person";
export type CollisionSnapshot = {
  revision: number;
  vertices: Float32Array;
  indices: Uint32Array;
  bounds: { min: Vec3; max: Vec3 };
  warnings?: string[];
  unsupported?: boolean;
};
export type PlayRequest = {
  rigId?: string;
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
  state: "idle" | "walk" | "run" | "jump" | "fall";
  heading: number;
  phase: number;
  headYaw: number;
  leftHip: number;
  rightHip: number;
  leftShoulder: number;
  rightShoulder: number;
};
export type PlaySnapshotReport = {
  mechanism?: MechanismSnapshot & { blocked: boolean; blockedReason?: string };
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
