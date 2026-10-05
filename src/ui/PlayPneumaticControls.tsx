import { Icon } from "./icons";
import type { BrowserPlay } from "../play/browser";
import type { PlayPneumaticReport } from "../play/types";
import {
  airPressureWord,
  pumpStatusText,
  rodReading,
} from "./play-pneumatic-presentation";
import "./play-pneumatic.css";

function Meter({
  label,
  value,
  text,
}: {
  label: string;
  value: number;
  text: string;
}) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      className="play-air-meter"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={text}
    >
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

/**
 * Air-circuit controls inside the mechanism Controls sheet: one pump
 * (latched, like a motor's Forward) and one three-way valve per cylinder,
 * named by what the rod does. Readings come from the simulated circuit.
 */
export function PlayPneumaticControls({
  play,
  rigId,
  report,
  onError,
}: {
  play: BrowserPlay;
  rigId: string;
  report: PlayPneumaticReport;
  onError: (message: string) => void;
}) {
  const send = (request: Parameters<BrowserPlay["setPneumatic"]>[0]) => {
    if (!play.getState().active || play.getState().paused) return;
    try {
      play.setPneumatic({ rigId, ...request });
      onError("");
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };
  const pumping = report.pumps.some((p) => p.pumping);
  const word = airPressureWord(report.pressure.level);
  const driven = report.valves.filter((v) => v.cylinderId);
  return (
    <div className="play-air">
      <div className="play-air-row">
        <strong>Air pressure</strong>
        <Meter label="Air pressure" value={report.pressure.level} text={word} />
        <output>{word}</output>
      </div>
      <button
        type="button"
        className="play-air-pump"
        aria-pressed={pumping}
        onClick={() => send({ pumping: !pumping })}
      >
        <Icon name="pump" />
        <span>{pumping ? "Stop pumping" : "Pump"}</span>
      </button>
      <p className="play-drive-feedback" role="status">
        {pumpStatusText(report)}
      </p>
      {driven.map((valve, i) => {
        const cylinder = report.cylinders.find(
          (c) => c.id === valve.cylinderId,
        )!;
        const name = driven.length > 1 ? `Cylinder ${i + 1}` : "Cylinder";
        const reading = rodReading(cylinder);
        return (
          <section
            className="play-air-cylinder"
            key={valve.id}
            aria-label={name}
          >
            <div className="play-air-row">
              <strong>{name}</strong>
              <Meter
                label={`${name} rod`}
                value={cylinder.extension}
                text={reading}
              />
              <output>{reading}</output>
            </div>
            <div
              className="play-drive-buttons play-air-valve"
              role="group"
              aria-label={`${name} valve`}
            >
              {(
                [
                  ["in", "Pull in"],
                  ["hold", "Hold"],
                  ["out", "Push out"],
                ] as const
              ).map(([position, text]) => (
                <button
                  type="button"
                  key={position}
                  aria-pressed={valve.position === position}
                  onClick={() => send({ valves: { [valve.id]: position } })}
                >
                  {text}
                </button>
              ))}
            </div>
          </section>
        );
      })}
      <details className="play-motor-settings">
        <summary>How the air works</summary>
        <p>
          Pumping pushes air into the tubes. The valve sends it to one end of
          the cylinder, so the rod slides out or in. Hold shuts the valve and
          keeps the rod where it is. Only the pump and cylinder rods move: the
          pump body, cylinder, valve and tubes stay put. Forces are a game
          setting, not real air pressure.
        </p>
      </details>
    </div>
  );
}
