import type { PlayPneumaticReport } from "../play/types";

/** Plain words for the supply pressure a hand pump has built. */
export function airPressureWord(level: number) {
  if (level < 0.01) return "None";
  if (level < 0.35) return "Low";
  if (level < 0.8) return "Medium";
  return "Full";
}

/** What the pump is doing, in a short sentence for the controls sheet. */
export function pumpStatusText(report: PlayPneumaticReport) {
  const pumps = report.pumps;
  if (!pumps.some((p) => p.pumping))
    return "Tap Pump to push air into the tubes.";
  const strokes = pumps.reduce((n, p) => n + p.strokes, 0);
  if (pumps.some((p) => p.status === "stalled"))
    return report.valves.some((v) => v.position !== "hold")
      ? "Full: the rod is at its end or pushing something heavy."
      : "Full: set the valve to let the air move the rod.";
  return `Pumping · ${strokes} ${strokes === 1 ? "stroke" : "strokes"}`;
}

/** Cylinder rod position as a short reading. */
export function rodReading(cylinder: PlayPneumaticReport["cylinders"][number]) {
  const percent = Math.round(cylinder.extension * 100);
  return `Rod out ${percent}%${cylinder.moving ? " · moving" : ""}`;
}
