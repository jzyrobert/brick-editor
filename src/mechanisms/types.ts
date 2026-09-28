import type { Transform, Vec3 } from "../core/types";
export type RigidGroup = {
  id: string;
  occurrenceIds: string[];
  /** Group frame in LDraw world coordinates at authored rest. */
  frame: Transform;
  restTransforms: Record<string, Transform>;
};
export type JointSpec = {
  id: string;
  bodyA: string;
  bodyB: string;
  kind: "fixed" | "revolute" | "prismatic" | "spherical";
  anchorA: Vec3;
  anchorB: Vec3;
  axisA?: Vec3;
  axisB?: Vec3;
  /** Degrees for revolute, LDU for prismatic. */
  limits?: [number, number];
  motor?: {
    mode: "position" | "velocity";
    target: number;
    maxEffort: { value: number; unit: "N" | "N*m" };
  };
};
/** All points are chassis-local LDU, with negative Y up. */
export type DriverSeatSpec = {
  id: string;
  profile: "brick-figure-open-seat-v1";
  pelvisPosition: Vec3;
  yawDegrees: number;
  accessPoint: Vec3;
  approachPosition: Vec3;
  /** Ordered standing-feet locations; the first safe exit wins. */
  exits: Array<{ position: Vec3; yawDegrees: number }>;
};
export type VehicleSpec = {
  driverSeat?: DriverSeatSpec;
  chassisGroup: string;
  wheels: Array<{
    groupId: string;
    axis: Vec3;
    radius: number;
    steering: boolean;
  }>;
  wheelbase: number;
  maxSteerDegrees: number;
  maxSpeed: number;
};
/**
 * Optional settings used only when Play simulates this rig dynamically. The
 * authored rig stays kinematic data; Play chooses the simulation per session.
 * Mass is kilograms, lengths are LDU, forces are simulation newtons at the
 * declared 0.02 m/LDU gameplay scale. None of this describes real clutch power.
 */
export type RigDynamics = {
  /** Per-group overrides. Root groups of non-vehicle rigs default to anchored. */
  groups?: Record<string, { massKg?: number; anchored?: boolean }>;
  /** Coulomb friction coefficient for this rig's colliders (default 0.7). */
  friction?: number;
  /** Ray-cast wheel suspension for dynamic vehicles. */
  suspension?: {
    /** Spring rest length, LDU. */
    restLength: number;
    /** Maximum compression travel, LDU. */
    travel: number;
    /** Spring stiffness (Rapier units: N/m per kilogram-ish; 5–200). */
    stiffness: number;
    /** Compression/relaxation damping factor (0.1–20). */
    damping: number;
  };
  /** Total engine force at full throttle, simulation N. */
  engineForce?: number;
};
export type MotionRig = {
  schemaVersion: 1;
  id: string;
  name: string;
  mode: "kinematic";
  groups: RigidGroup[];
  joints: JointSpec[];
  vehicle?: VehicleSpec;
  dynamics?: RigDynamics;
};
export type KinematicPose = {
  jointPositions: Record<string, number>;
  vehicle?: {
    position: Vec3;
    headingDegrees: number;
    steeringDegrees: number;
    wheelAngles: Record<string, number>;
  };
};
export type MechanismSnapshot = {
  sourceRevision: number;
  rigId: string;
  tick: number;
  simulationHz: 60;
  mode: "kinematic" | "dynamic";
  units: "LDU";
  scaleMetresPerLdu: 0.02;
  pose: KinematicPose;
  groupFrames: Record<string, Transform>;
  transforms: Record<string, Transform>;
  warnings: string[];
};
