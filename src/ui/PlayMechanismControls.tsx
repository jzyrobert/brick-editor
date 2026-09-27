import type { BrowserPlay } from "../play/browser";
import type { MotionRig, MechanismSnapshot } from "../mechanisms/types";
export function PlayMechanismControls({
  play,
  rig,
  report,
  onError,
}: {
  play: BrowserPlay;
  rig: MotionRig;
  report: MechanismSnapshot & { blocked?: boolean; blockedReason?: string };
  onError: (message: string) => void;
}) {
  const attempt = (fn: () => unknown) => {
    try {
      fn();
      onError("");
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };
  const drive = (throttle: number) => {
    if (!play.getState().active) return;
    return attempt(() =>
      play.setMechanismVehicleInput({
        throttle,
        steering:
          (report.pose.vehicle?.steeringDegrees ?? 0) /
          (rig.vehicle?.maxSteerDegrees || 1),
      }),
    );
  };
  return (
    <details
      className="play-mechanism"
      onToggle={(e) => {
        if (!e.currentTarget.open) play.clearInput();
      }}
    >
      <summary>{rig.name} controls</summary>
      <p>
        Moving parts stop before touching you. Vehicles can pass through the
        build; riding and pushing are not simulated. Your build stays unchanged.
      </p>
      {rig.joints
        .filter((j) => j.kind === "revolute" || j.kind === "prismatic")
        .map((j) => (
          <label key={j.id}>
            {j.id}: {(report.pose.jointPositions[j.id] ?? 0).toFixed(1)}{" "}
            {j.kind === "revolute" ? "degrees" : "LDU"}
            <input
              aria-label={`Explore joint ${j.id}`}
              type="range"
              min={j.limits?.[0] ?? -180}
              max={j.limits?.[1] ?? 180}
              step={1}
              value={report.pose.jointPositions[j.id] ?? 0}
              onChange={(e) =>
                attempt(() =>
                  play.setMechanismJoint(j.id, Number(e.target.value)),
                )
              }
            />
          </label>
        ))}
      {rig.vehicle && (
        <>
          <label>
            Steering
            <input
              aria-label="Explore vehicle steering"
              type="range"
              min={-1}
              max={1}
              step={0.05}
              value={
                (report.pose.vehicle?.steeringDegrees ?? 0) /
                rig.vehicle.maxSteerDegrees
              }
              onChange={(e) =>
                attempt(() =>
                  play.setMechanismVehicleInput({
                    throttle: 0,
                    steering: Number(e.target.value),
                  }),
                )
              }
            />
          </label>
          <div className="play-drive-buttons">
            {[
              [-1, "Hold reverse"],
              [1, "Hold forward"],
            ].map(([value, label]) => (
              <button
                key={label}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  drive(Number(value));
                }}
                onPointerUp={() => drive(0)}
                onPointerCancel={() => drive(0)}
                onLostPointerCapture={() => drive(0)}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    drive(Number(value));
                  }
                }}
                onKeyUp={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    drive(0);
                  }
                }}
                onBlur={() => drive(0)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
      {report.blocked && (
        <p role="status">
          {report.blockedReason || "Motion blocked to keep the explorer clear."}
        </p>
      )}
    </details>
  );
}
