import { ensure } from "../core/types";
import type { JointSpec } from "../mechanisms/types";
import { JOINT_TARGET_SPEED_LIMITS } from "./types";

export const KINEMATIC_MOTOR_RATE = Object.freeze({
  revolute: 90,
  prismatic: 40,
});

export function validateMotorInput(
  enabled: boolean,
  input?: number,
  power?: number,
) {
  ensure(
    typeof enabled === "boolean",
    "INVALID_INPUT",
    "Motor enabled must be boolean",
  );
  ensure(
    input === undefined ||
      (enabled && Number.isFinite(input) && Math.abs(input) <= 1),
    "INVALID_INPUT",
    "Live motor input requires an enabled motor and a value between -1 and 1.",
  );
  ensure(
    power === undefined || (Number.isFinite(power) && power >= 0 && power <= 1),
    "INVALID_INPUT",
    "Motor power must be a value between 0 and 1.",
  );
}

/** Session-only speed/direction and available effort. Source caps stay intact. */
export function effectiveMotor(
  joint: JointSpec,
  input?: number,
  maxSpeed = Infinity,
  power = 1,
) {
  const authored = joint.motor!;
  const spec =
    power === 1
      ? authored
      : {
          ...authored,
          maxEffort: {
            ...authored.maxEffort,
            value: authored.maxEffort.value * power,
          },
        };
  if (input === undefined) return spec;
  const kind = joint.kind as "revolute" | "prismatic";
  const speed = Math.min(
    spec.mode === "velocity" && spec.target !== 0
      ? Math.abs(spec.target)
      : KINEMATIC_MOTOR_RATE[kind],
    maxSpeed,
    JOINT_TARGET_SPEED_LIMITS[kind].max,
  );
  return { ...spec, mode: "velocity" as const, target: input * speed };
}
