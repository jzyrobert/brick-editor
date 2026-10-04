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
  kind: "fixed" | "revolute" | "prismatic" | "spherical" | "cylindrical";
  anchorA: Vec3;
  anchorB: Vec3;
  axisA?: Vec3;
  axisB?: Vec3;
  /** Optional rotational resistance of a free spherical joint (Dynamic only). */
  angularResistance?: { maxTorqueNm: number; dampingNmSeconds: number };
  /** Optional axial stops for a free cylindrical bearing, LDU from rest. */
  translationLimitsLdu?: [number, number];
  /** Explicit ideal bearing overlap, local to the joint axis/anchor. */
  mating?: { radiusLdu: number; halfLengthLdu: number };
  /** Degrees for revolute, LDU for prismatic. */
  limits?: [number, number];
  motor?: {
    mode: "position" | "velocity";
    target: number;
    maxEffort: { value: number; unit: "N" | "N*m" };
    /** Reviewed physical motor case and keyed output; absent means legacy metadata. */
    binding?: { occurrenceId: string; profile: "power-functions-motor-m-v1" };
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
/** Explicit grasp point for reversible native Play attachments. No automatic
 * shape/insertion recognition or persistence of held payloads is implied. */
export type GripperSpec = {
  id: string;
  groupId: string;
  anchor: Vec3;
  captureRadiusLdu: number;
  maxPayloadMassKg: number;
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
  /** Play starts with Dynamic mechanism physics chosen when any rig in the
   * build sets this (the player can still pick Kinematic). */
  startDynamic?: boolean;
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
  /** Ideal spur/rack meshes, separate from their carrier mounting joints. */
  transmissions?: Transmission[];
  /** Explicit planar revolute closure edges; tree joints remain acyclic. */
  loopClosures?: PlanarLoopClosure[];
  /** Physical springs/ropes between local attachment points, Dynamic only. */
  forceLinks?: ForceLink[];
  /** Authored capture zones; held state and native fixed joints are session-only. */
  grippers?: GripperSpec[];
  vehicle?: VehicleSpec;
  dynamics?: RigDynamics;
};
export type SpurTransmission = {
  id: string;
  kind: "spur";
  jointA: string;
  jointB: string;
  teethA: number;
  teethB: number;
  /** Sign of the two shaft axes in their shared carrier frame. */
  axisSign: 1 | -1;
};
export type RackTransmission = {
  id: string;
  kind: "rack";
  /** Revolute pinion, in unwrapped degrees. */
  jointA: string;
  /** Guided prismatic rack, in LDU. */
  jointB: string;
  /** Signed travel per radian, in LDU; sign follows the declared joint axes. */
  pitchRadiusLdu: number;
  teethA?: never;
  teethB?: never;
  axisSign?: never;
};
export type Transmission = SpurTransmission | RackTransmission;
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

export type PlanarLoopClosure = {
  id: string;
  kind: "revolute";
  bodyA: string;
  bodyB: string;
  anchorA: Vec3;
  anchorB: Vec3;
  axisA: Vec3;
  axisB: Vec3;
  mating?: { radiusLdu: number; halfLengthLdu: number };
  /** Passive tree coordinates solved for closure; never independently driven. */
  dependentJointIds: string[];
};

export type ForceLink = {
  id: string;
  bodyA: string;
  bodyB: string;
  anchorA: Vec3;
  anchorB: Vec3;
} & (
  | {
      kind: "spring";
      restLengthLdu: number;
      stiffnessNewtonsPerMetre: number;
      dampingNewtonsSecondsPerMetre: number;
    }
  | { kind: "rope"; maxLengthLdu: number }
);
