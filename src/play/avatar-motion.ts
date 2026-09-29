/**
 * Procedural figure motion for Play (presentation state only; no physics).
 *
 * Limb swing follows the Minecraft humanoid pattern: a swing amount that
 * blends toward the current horizontal speed every tick, and hips/shoulders at
 * `cos(phase) * 1.4 * amount` with arms opposite the legs at a smaller
 * amplitude. Unlike Minecraft, the phase advances by distance actually
 * travelled after collision correction (spec 19.1.5), so feet never skate and
 * a character pushing into a wall settles to neutral.
 *
 * Heading policy (documented per spec): the body turns toward travel with a
 * critically damped spring; travel more than 100 degrees away from the look
 * direction walks backward facing forward (as in Minecraft); and the head may
 * look at most 50 degrees either side of the body — beyond that the body turns
 * with the head.
 *
 * Every function is pure and deterministic, so fixed-tick replays repeat
 * exactly and the renderer can interpolate two tick states.
 */
import { CHARACTER_PROFILE } from "./types";
export const AVATAR_MOTION = Object.freeze({
  /** Leg amplitude per unit swing amount (Minecraft: 1.4). */
  legSwing: 1.4,
  /** Arm amplitude per unit swing amount (Minecraft: 2 × 0.5). */
  armSwing: 1,
  /** Horizontal speed (LDU/s) at which the swing amount reaches 1. */
  fullSwingSpeed: 250,
  /** Per-60 Hz-tick blend of the swing amount (Minecraft 0.4 per 20 Hz tick). */
  swingBlend: 1 - Math.pow(0.6, 1 / 3),
  /** Critically damped body-turn smoothing time, seconds. */
  bodyTurnTime: 0.1,
  /** Head may yaw this far either side of the body (50 degrees). */
  headYawLimit: (50 * Math.PI) / 180,
  headPitchLimits: Object.freeze([-0.35, 0.45] as const),
  /** Travel further than this from the look direction walks backward. */
  backwardThreshold: (100 * Math.PI) / 180,
  /** Ticks without ground before the airborne pose starts blending in. */
  airDelayTicks: 4,
  airBlend: 0.2,
  flyBlend: 0.08,
  /** Gentle vertical bob while flying (LDU, visual only). */
  flyBob: 1.2,
  /** Idle arm sway (radians); Minecraft uses 0.05. */
  idleSway: 0.05,
});
export type AvatarMotionState = {
  /** Gait phase, radians in [0, 2π). */
  phase: number;
  /** Swing amount in [0, 1]. */
  amount: number;
  /** Body (root) yaw, radians. */
  body: number;
  bodyVelocity: number;
  /** Airborne pose weight in [0, 1] and its rise(0)/fall(1) mix. */
  air: number;
  fall: number;
  /** Flying pose weight in [0, 1]. */
  fly: number;
  airTicks: number;
  /** Seconds of simulated time (drives idle sway and fly bob). */
  time: number;
};
export type AvatarMotionEvidence = {
  /** Horizontal LDraw displacement applied this tick (X, Z), after collision. */
  dx: number;
  dz: number;
  /** LDraw vertical velocity, LDU/s (positive = falling, since up is -Y). */
  vy: number;
  grounded: boolean;
  flying: boolean;
  /** Flying close enough above a surface to run instead of hover. */
  nearGround: boolean;
  lookYaw: number;
  dt: number;
};
export const TAU = Math.PI * 2;
export function wrapAngle(angle: number) {
  const a = (((angle + Math.PI) % TAU) + TAU) % TAU;
  return a - Math.PI;
}
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
/** Shortest-path angle interpolation. */
export function lerpAngle(a: number, b: number, t: number) {
  return a + wrapAngle(b - a) * t;
}
/**
 * Critically damped spring toward an angle (the shortest way round). Stable
 * for any step, never overshoots, and continuous in velocity, so the figure
 * turns without the per-tick snapping that read as jitter.
 */
export function smoothDampAngle(
  current: number,
  target: number,
  velocity: number,
  smoothTime: number,
  dt: number,
): [number, number] {
  const omega = 2 / Math.max(1e-4, smoothTime),
    x = omega * dt,
    decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = wrapAngle(current - target),
    goal = current - change;
  const temp = (velocity + omega * change) * dt;
  let nextVelocity = (velocity - omega * temp) * decay;
  let value = goal + (change + temp) * decay;
  // Never overshoot the goal.
  if (goal - current > 0 === value > goal) {
    value = goal;
    nextVelocity = 0;
  }
  return [wrapAngle(value), nextVelocity];
}
/** Presentation smoothing of the feet height while walking (seconds). */
export const RIDE_SMOOTH_TIME = 0.18;
/** Critically damped spring toward a value (Game Programming Gems 4, 1.10). */
export function smoothDamp(
  current: number,
  target: number,
  velocity: number,
  smoothTime: number,
  dt: number,
): [number, number] {
  const omega = 2 / Math.max(1e-4, smoothTime),
    x = omega * dt,
    decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity + omega * change) * dt;
  let nextVelocity = (velocity - omega * temp) * decay;
  let value = target + (change + temp) * decay;
  if (target - current > 0 === value > target) {
    value = target;
    nextVelocity = 0;
  }
  return [value, nextVelocity];
}
export function initialMotion(body = 0): AvatarMotionState {
  return {
    phase: 0,
    amount: 0,
    body: wrapAngle(body),
    bodyVelocity: 0,
    air: 0,
    fall: 0,
    fly: 0,
    airTicks: 0,
    time: 0,
  };
}
/** The body yaw the figure turns toward this tick (see heading policy). */
export function bodyTarget(
  body: number,
  lookYaw: number,
  dx: number,
  dz: number,
  speed: number,
) {
  // Ignore contact-correction creep; only real travel turns the body.
  if (speed < 6) return body;
  const travel = Math.atan2(dx, -dz);
  return Math.abs(wrapAngle(travel - lookYaw)) > AVATAR_MOTION.backwardThreshold
    ? wrapAngle(travel + Math.PI)
    : travel;
}
/** Keep the head within its yaw limit by turning the body with it. */
export function followHead(body: number, lookYaw: number) {
  const limit = AVATAR_MOTION.headYawLimit,
    offset = wrapAngle(lookYaw - body);
  if (Math.abs(offset) <= limit) return { body, clamped: false };
  return {
    body: wrapAngle(lookYaw - Math.sign(offset) * limit),
    clamped: true,
  };
}
export function advanceMotion(
  state: AvatarMotionState,
  e: AvatarMotionEvidence,
): AvatarMotionState {
  const M = AVATAR_MOTION;
  const distance = Math.hypot(e.dx, e.dz),
    speed = distance / e.dt;
  const swinging = e.flying ? e.nearGround : true;
  const airborne = !e.flying && !e.grounded;
  const airTicks = airborne ? state.airTicks + 1 : 0;
  // Running jumps keep a reduced stride; hovering flight has none.
  const targetAmount = swinging
    ? Math.min(1, speed / M.fullSwingSpeed) *
      (airTicks > M.airDelayTicks ? 0.35 : 1)
    : 0;
  let [body, bodyVelocity] = smoothDampAngle(
    state.body,
    bodyTarget(state.body, e.lookYaw, e.dx, e.dz, speed),
    state.bodyVelocity,
    M.bodyTurnTime,
    e.dt,
  );
  const head = followHead(body, e.lookYaw);
  body = head.body;
  if (head.clamped) bodyVelocity = 0;
  return {
    phase:
      (state.phase + (TAU * distance) / CHARACTER_PROFILE.strideLength) % TAU,
    amount: state.amount + (targetAmount - state.amount) * M.swingBlend,
    body,
    bodyVelocity,
    air:
      state.air +
      ((airTicks > M.airDelayTicks ? 1 : 0) - state.air) * M.airBlend,
    fall: state.fall + (clamp((e.vy + 60) / 240, 0, 1) - state.fall) * 0.25,
    fly:
      state.fly +
      ((e.flying && !(e.nearGround && speed > 6) ? 1 : 0) - state.fly) *
        M.flyBlend,
    airTicks,
    time: state.time + e.dt,
  };
}
/** Interpolates two consecutive tick states for rendering between ticks. */
export function lerpMotion(
  a: AvatarMotionState,
  b: AvatarMotionState,
  t: number,
): AvatarMotionState {
  const mix = (x: number, y: number) => x + (y - x) * t;
  return {
    phase: lerpAngle(a.phase, b.phase, t),
    amount: mix(a.amount, b.amount),
    body: wrapAngle(lerpAngle(a.body, b.body, t)),
    bodyVelocity: mix(a.bodyVelocity, b.bodyVelocity),
    air: mix(a.air, b.air),
    fall: mix(a.fall, b.fall),
    fly: mix(a.fly, b.fly),
    airTicks: b.airTicks,
    time: mix(a.time, b.time),
  };
}
export type LimbAngles = {
  leftHip: number;
  rightHip: number;
  leftShoulder: number;
  rightShoulder: number;
  /** Hand turns about the wrists (the minifig hand's grip axis). */
  leftWrist: number;
  rightWrist: number;
};
type SwingAngles = Omit<LimbAngles, "leftWrist" | "rightWrist">;
/** Minecraft swing: legs opposite each other, arms opposite their legs. */
export function swingAngles(phase: number, amount: number): SwingAngles {
  const M = AVATAR_MOTION,
    c = Math.cos(phase);
  return {
    rightHip: c * M.legSwing * amount,
    leftHip: -c * M.legSwing * amount,
    rightShoulder: -c * M.armSwing * amount,
    leftShoulder: c * M.armSwing * amount,
  };
}
/** Limb angles for a motion state. Positive angles swing a limb forward. */
export function limbAngles(s: AvatarMotionState): LimbAngles {
  const M = AVATAR_MOTION;
  const swing = swingAngles(s.phase, s.amount);
  // Airborne: arms up and forward (more when falling), legs split slightly.
  const air: SwingAngles = {
    leftShoulder: 0.5 + 0.4 * s.fall,
    rightShoulder: 0.5 + 0.4 * s.fall,
    leftHip: 0.3 - 0.2 * s.fall,
    rightHip: -0.2 + 0.1 * s.fall,
  };
  // Flying: legs trail behind with a slow flutter, arms relaxed.
  const flutter = Math.sin(s.time * 2.4) * 0.06;
  const fly: SwingAngles = {
    leftHip: -0.3 + flutter,
    rightHip: -0.3 - flutter,
    leftShoulder: 0.15,
    rightShoulder: 0.15,
  };
  const sway = Math.sin(s.time * 1.34) * M.idleSway;
  const out = {} as SwingAngles;
  for (const k of [
    "leftHip",
    "rightHip",
    "leftShoulder",
    "rightShoulder",
  ] as const) {
    const ground = swing[k] + (air[k] - swing[k]) * s.air;
    out[k] = ground + (fly[k] - ground) * s.fly;
  }
  out.rightShoulder += sway;
  out.leftShoulder -= sway;
  // Hands follow a fifth of their arm's swing on the ground and turn outward
  // (mirrored) as the figure leaves it: open in a jump, relaxed in flight.
  const outward = 0.5 * s.air * (1 - s.fly) + 0.3 * s.fly;
  const follow = 0.2 * (1 - s.air) * (1 - s.fly);
  return {
    ...out,
    leftWrist: follow * out.leftShoulder + outward,
    rightWrist: follow * out.rightShoulder - outward,
  };
}
export function flyBob(s: AvatarMotionState) {
  return Math.sin(s.time * 2.1) * AVATAR_MOTION.flyBob * s.fly;
}
export function headAngles(s: AvatarMotionState, yaw: number, pitch: number) {
  const M = AVATAR_MOTION;
  return {
    headYaw: clamp(wrapAngle(yaw - s.body), -M.headYawLimit, M.headYawLimit),
    headPitch: clamp(pitch, M.headPitchLimits[0], M.headPitchLimits[1]),
  };
}
/**
 * Per-frame jitter metric: the largest second difference of a sampled
 * trajectory (units per frame²). Constant-velocity motion scores ~0; a
 * one-tick stall or a snapped heading scores about the per-frame step.
 */
export function jitter(samples: ArrayLike<number>[]) {
  let worst = 0;
  for (let i = 2; i < samples.length; i++) {
    let sum = 0;
    for (let k = 0; k < samples[i].length; k++) {
      const d = samples[i][k] - 2 * samples[i - 1][k] + samples[i - 2][k];
      sum += d * d;
    }
    worst = Math.max(worst, Math.sqrt(sum));
  }
  return worst;
}
/** Largest frame-to-frame change of an angle series (radians). */
export function angularJitter(angles: number[]) {
  let worst = 0;
  for (let i = 2; i < angles.length; i++)
    worst = Math.max(
      worst,
      Math.abs(
        wrapAngle(angles[i] - angles[i - 1]) -
          wrapAngle(angles[i - 1] - angles[i - 2]),
      ),
    );
  return worst;
}
