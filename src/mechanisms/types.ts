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
export type MotionRig = {
  schemaVersion: 1;
  id: string;
  name: string;
  mode: "kinematic";
  groups: RigidGroup[];
  joints: JointSpec[];
  vehicle?: VehicleSpec;
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
  mode: "kinematic";
  units: "LDU";
  scaleMetresPerLdu: 0.02;
  pose: KinematicPose;
  groupFrames: Record<string, Transform>;
  transforms: Record<string, Transform>;
  warnings: string[];
};
