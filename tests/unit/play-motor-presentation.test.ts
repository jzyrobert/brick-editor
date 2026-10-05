import { describe, expect, it } from "vitest";
import { motorStatusText } from "../../src/ui/play-motor-presentation";
import type { PlayMotorReport } from "../../src/play/types";

const motor: PlayMotorReport = {
  enabled: true,
  mode: "velocity",
  target: 90,
  status: "running",
  units: "degrees",
  targetUnits: "degrees/s",
  simulation: "kinematic-rate",
  input: 0.25,
  power: 0.25,
};
describe("motor state presentation", () => {
  it("shows the actual stopped, holding, stalled and limit states before requested direction", () => {
    expect(motorStatusText(motor)).toBe("Running forward");
    expect(motorStatusText({ ...motor, input: -0.5 })).toBe("Running reverse");
    expect(motorStatusText({ ...motor, status: "holding" })).toBe("Holding");
    expect(motorStatusText({ ...motor, status: "blocked" })).toBe(
      "Motor stalled",
    );
    expect(motorStatusText({ ...motor, status: "at-limit" })).toBe("At limit");
    expect(motorStatusText({ ...motor, status: "stopped" })).toBe("Motor off");
    expect(motorStatusText({ ...motor, power: 0 })).toBe("Motor off");
    expect(motorStatusText({ ...motor, enabled: false })).toBe("Motor off");
  });
  it("distinguishes an explicit brake from a saved setting holding its target", () => {
    expect(motorStatusText({ ...motor, input: 0, status: "holding" })).toBe(
      "Braking",
    );
    expect(
      motorStatusText({ ...motor, input: undefined, status: "holding" }),
    ).toBe("Holding");
    expect(motorStatusText({ ...motor, input: undefined })).toBe(
      "Running on its own",
    );
  });
});
