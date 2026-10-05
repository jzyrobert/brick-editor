import { useEffect, useState } from "react";
import type { BrowserPlay } from "../play/browser";
import {
  PLAY_CAMERA_DEFAULTS,
  PLAY_CAMERA_LIMITS,
  type PlayCameraSettings,
  type PlaySnapshotReport,
} from "../play/types";
const degrees = (radians: number) => (radians * 180) / Math.PI;
const labels: Record<keyof PlayCameraSettings, string> = {
  eyeHeight: "Eye height (LDU)",
  fovDeg: "Field of view (degrees)",
  near: "Near plane (LDU)",
  followDistance: "Follow distance (LDU)",
  minPitch: "Minimum pitch (degrees)",
  maxPitch: "Maximum pitch (degrees)",
};
const keys = Object.keys(labels) as (keyof PlayCameraSettings)[];
const angular = (key: keyof PlayCameraSettings) =>
  key === "minPitch" || key === "maxPitch";
const draft = (settings: PlayCameraSettings) =>
  Object.fromEntries(
    keys.map((key) => [
      key,
      String(angular(key) ? degrees(settings[key]) : settings[key]),
    ]),
  ) as Record<keyof PlayCameraSettings, string>;
export function PlaySettings({
  play,
  report,
}: {
  play: BrowserPlay;
  report: PlaySnapshotReport;
}) {
  const [camera, setCamera] = useState(() => draft(report.cameraSettings)),
    [position, setPosition] = useState(() => report.position.map(String)),
    [yaw, setYaw] = useState(String(degrees(report.yaw))),
    [pitch, setPitch] = useState(String(degrees(report.pitch))),
    [message, setMessage] = useState("");
  const settingsKey = JSON.stringify(report.cameraSettings);
  useEffect(() => setCamera(draft(report.cameraSettings)), [settingsKey]);
  const number = (value: string, label: string) => {
    if (!value.trim() || !Number.isFinite(Number(value)))
      throw new Error(`Enter a finite number for ${label}.`);
    return Number(value);
  };
  const attempt = (action: () => unknown, success: string) => {
    try {
      const result = action();
      if (result instanceof Promise)
        void result.then(
          () => setMessage(success),
          (error) =>
            setMessage(error instanceof Error ? error.message : String(error)),
        );
      else setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <section className="play-settings" aria-label="Play session settings">
      <details>
        <summary>Camera settings</summary>
        <p className="muted">
          Camera changes apply only to this Play session. The character collider
          keeps its 72 LDU height.
        </p>
        {keys.map((key) => {
          const limits = PLAY_CAMERA_LIMITS[key];
          return (
            <label className="play-setting" key={key}>
              <span>{labels[key]}</span>
              <input
                aria-label={labels[key]}
                disabled={!!report.occupancy && key === "eyeHeight"}
                type="number"
                min={angular(key) ? degrees(limits.min) : limits.min}
                max={angular(key) ? degrees(limits.max) : limits.max}
                step={key === "near" ? 0.05 : 1}
                value={camera[key]}
                onChange={(e) =>
                  setCamera((values) => ({ ...values, [key]: e.target.value }))
                }
              />
            </label>
          );
        })}
        <button
          className="wide"
          onClick={() =>
            attempt(
              () =>
                play.configureCamera(
                  Object.fromEntries(
                    keys.map((key) => {
                      const value = number(camera[key], labels[key]),
                        limits = PLAY_CAMERA_LIMITS[key],
                        min = angular(key) ? degrees(limits.min) : limits.min,
                        max = angular(key) ? degrees(limits.max) : limits.max;
                      if (value < min || value > max)
                        throw new Error(
                          `${labels[key]} must be between ${Number(min.toFixed(2))} and ${Number(max.toFixed(2))}.`,
                        );
                      if (
                        key === "maxPitch" &&
                        value <= number(camera.minPitch, labels.minPitch)
                      )
                        throw new Error(
                          "Maximum pitch must be greater than minimum pitch (degrees).",
                        );
                      return [
                        key,
                        angular(key) ? (value * Math.PI) / 180 : value,
                      ];
                    }),
                  ) as PlayCameraSettings,
                ),
              "Camera settings applied to this session.",
            )
          }
        >
          Apply camera settings
        </button>
        <button
          className="wide"
          onClick={() =>
            attempt(
              () => play.configureCamera({ ...PLAY_CAMERA_DEFAULTS }),
              "Default camera settings restored.",
            )
          }
        >
          Reset camera settings
        </button>
        <p className="muted">
          Eye height is camera-only. Pitch limits constrain looking up and down.
          In tight or wide views, camera collision may shorten the follow
          distance or reduce the effective near plane.
        </p>
        {report.cameraSafety && (
          <p className="muted">
            Effective near plane: {report.cameraSafety.effectiveNear.toFixed(3)}{" "}
            LDU.
          </p>
        )}
      </details>
      {!report.occupancy && (
        <details>
          <summary>Safe spawn</summary>
          <p className="muted">
            Save a clear, supported feet position. Validation never moves you or
            edits the build. Returning to a saved spawn switches to Walk and
            stays paused.
          </p>
          <button
            className="wide"
            onClick={() =>
              attempt(
                () =>
                  play.chooseSpawn({
                    position: report.position,
                    yaw: report.yaw,
                    pitch: report.pitch,
                  }),
                "Current position validated and remembered for this session.",
              )
            }
          >
            Remember current safe position
          </button>
          <p>
            {report.spawn
              ? `Saved spawn: ${report.spawn.position.map((n) => Number(n.toFixed(2))).join(", ")} LDU`
              : "No validated spawn has been saved for this session."}
          </p>
          <button
            className="wide"
            disabled={!report.spawn}
            onClick={() =>
              attempt(
                () => play.useSpawn(),
                "Returned to the saved spawn in Walk mode. Resume when ready.",
              )
            }
          >
            Go to saved spawn
          </button>
          <details>
            <summary>Choose spawn coordinates</summary>
            <button
              className="wide"
              onClick={() => {
                setPosition(report.position.map(String));
                setYaw(String(degrees(report.yaw)));
                setPitch(String(degrees(report.pitch)));
                setMessage(
                  "Current feet coordinates copied. Validate to remember them.",
                );
              }}
            >
              Copy current coordinates
            </button>
            {(["X", "Y", "Z"] as const).map((axis, i) => (
              <label className="play-setting" key={axis}>
                <span>Feet {axis} (LDU)</span>
                <input
                  aria-label={`Spawn feet ${axis} (LDU)`}
                  type="number"
                  step="1"
                  value={position[i]}
                  onChange={(e) =>
                    setPosition((values) =>
                      values.map((n, j) => (j === i ? e.target.value : n)),
                    )
                  }
                />
              </label>
            ))}
            <label className="play-setting">
              <span>Yaw (degrees)</span>
              <input
                aria-label="Spawn yaw (degrees)"
                type="number"
                step="1"
                value={yaw}
                onChange={(e) => setYaw(e.target.value)}
              />
            </label>
            <label className="play-setting">
              <span>Pitch (degrees)</span>
              <input
                aria-label="Spawn pitch (degrees)"
                type="number"
                step="1"
                value={pitch}
                onChange={(e) => setPitch(e.target.value)}
              />
            </label>
            <p className="muted">
              Coordinates use LDraw space: negative Y is up. Unsupported or
              occupied positions are refused.
            </p>
            <button
              className="wide"
              onClick={() =>
                attempt(
                  () =>
                    play.chooseSpawn({
                      position: position.map((n, i) =>
                        number(n, ["X", "Y", "Z"][i]),
                      ) as [number, number, number],
                      yaw: (number(yaw, "yaw") * Math.PI) / 180,
                      pitch: (number(pitch, "pitch") * Math.PI) / 180,
                    }),
                  "Spawn coordinates validated and remembered. Your current position is unchanged.",
                )
              }
            >
              Validate and save spawn
            </button>
          </details>
        </details>
      )}
      {report.occupancy && (
        <p className="muted">
          Your view is fixed to the seat. Get out before choosing where to start
          walking or going back to a safe spot.
        </p>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
