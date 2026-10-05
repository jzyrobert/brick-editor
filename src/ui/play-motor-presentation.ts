import type { PlayMotorReport } from "../play/types";

/** Describe the simulated motor state, rather than its requested shaft angle. */
export function motorStatusText(motor?: PlayMotorReport): string {
  if (!motor?.enabled || motor.power === 0 || motor.status === "stopped")
    return "Motor off";
  if (motor.status === "blocked") return "Motor stalled";
  if (motor.status === "at-limit") return "At limit";
  if (motor.input === 0) return "Braking";
  if (motor.status === "holding") return "Holding";
  if (motor.input !== undefined)
    return `Running ${motor.input < 0 ? "reverse" : "forward"}`;
  return "Running on its own";
}
