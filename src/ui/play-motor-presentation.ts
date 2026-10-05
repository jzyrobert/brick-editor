import type { PlayMotorReport } from "../play/types";

/** Describe the simulated motor state, rather than its requested shaft angle. */
export function motorStatusText(motor?: PlayMotorReport): string {
  // One word for "not turning": Stopped (the brake, no power or a stop).
  if (!motor?.enabled) return "Motor off";
  if (motor.power === 0) return "Stopped · power 0%";
  if (motor.status === "stopped") return "Stopped";
  if (motor.status === "blocked") return "Motor stalled";
  if (motor.status === "at-limit") return "At limit";
  if (motor.input === 0) return "Stopped";
  if (motor.status === "holding") return "Holding";
  if (motor.input !== undefined)
    return `Running ${motor.input < 0 ? "reverse" : "forward"}`;
  return "Running (starts by itself)";
}
