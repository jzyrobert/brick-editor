import { expect, it } from "vitest";
import type { PlayPneumaticReport } from "../../src/play/types";
import {
  airPressureWord,
  pumpStatusText,
  rodReading,
} from "../../src/ui/play-pneumatic-presentation";

const report = (
  pump: Partial<PlayPneumaticReport["pumps"][number]>,
  position: "out" | "hold" | "in" = "hold",
): PlayPneumaticReport => ({
  profile: "source-pneumatic-circuit-v1",
  pumps: [
    {
      id: '["p"]',
      pumping: false,
      strokes: 0,
      status: "idle",
      pushedIn: 0.5,
      ...pump,
    },
  ],
  pressure: { supplyGaugePa: 0, level: 0 },
  valves: [{ id: '["v"]', cylinderId: '["c"]', position }],
  cylinders: [
    {
      id: '["c"]',
      extension: 0,
      extensionLdu: 0,
      strokeLdu: 130,
      moving: false,
    },
  ],
});

it("names air pressure in plain words", () => {
  expect([0, 0.02, 0.5, 0.95].map(airPressureWord)).toEqual([
    "None",
    "Low",
    "Medium",
    "Full",
  ]);
});

it("explains the pump's state without engineering terms", () => {
  expect(pumpStatusText(report({}))).toBe(
    "Tap Pump to push air into the tubes.",
  );
  expect(
    pumpStatusText(report({ pumping: true, strokes: 1, status: "pumping" })),
  ).toBe("Pumping · 1 stroke");
  expect(
    pumpStatusText(report({ pumping: true, strokes: 3, status: "pumping" })),
  ).toBe("Pumping · 3 strokes");
  expect(pumpStatusText(report({ pumping: true, status: "stalled" }))).toBe(
    "Full: set the valve to let the air move the rod.",
  );
  expect(
    pumpStatusText(report({ pumping: true, status: "stalled" }, "out")),
  ).toBe("Full: the rod is at its end or pushing something heavy.");
});

it("reads the rod as a percentage of its retained stroke", () => {
  expect(
    rodReading({
      id: '["c"]',
      extension: 0.474,
      extensionLdu: 61.6,
      strokeLdu: 130,
      moving: true,
    }),
  ).toBe("Rod out 47% · moving");
});
