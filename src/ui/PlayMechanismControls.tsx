import { useEffect, useRef } from "react";
import type { PlayVehicleCollisionReport } from "../play/types";
import type { BrowserPlay } from "../play/browser";
import type { MotionRig, MechanismSnapshot } from "../mechanisms/types";
export function PlayMechanismControls({
  play,
  rig,
  report,
  onError,
  choices = [rig],
  onRigChange,
  onOpenChange,
}: {
  play: BrowserPlay;
  rig: MotionRig;
  report: MechanismSnapshot & {
    blocked?: boolean;
    blockedReason?: string;
    vehicleCollision?: PlayVehicleCollisionReport;
  };
  onError: (message: string) => void;
  choices?: MotionRig[];
  onRigChange?: (rigId: string) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => () => onOpenChange?.(false), [onOpenChange]);
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
      play.setMechanismVehicleInput(
        {
          throttle,
          steering:
            (report.pose.vehicle?.steeringDegrees ?? 0) /
            (rig.vehicle?.maxSteerDegrees || 1),
        },
        rig.id,
      ),
    );
  };
  return (
    <details
      className="play-mechanism"
      ref={details}
      onToggle={(e) => {
        play.clearInput();
        onOpenChange?.(e.currentTarget.open);
        if (e.currentTarget.open) onRigChange?.(rig.id);
      }}
    >
      <summary>
        {choices.length > 1
          ? "Remote mechanism controls"
          : `${rig.name} controls`}
      </summary>
      <button
        className="wide"
        onClick={() => {
          play.clearInput();
          if (details.current) details.current.open = false;
        }}
      >
        Back to nearby actions
      </button>
      {choices.length > 1 && (
        <label>
          Remote mechanism
          <select
            aria-label="Remote mechanism"
            value={rig.id}
            onChange={(event) => {
              play.clearInput();
              onRigChange?.(event.target.value);
            }}
          >
            {choices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="play-remote-note">
        Advanced controls can move this mechanism from anywhere. Nearby actions
        remain available when you close this panel. Setting a joint here
        immediately positions it and cancels only that joint’s animated travel.
      </p>
      <p>
        Moving parts stop before touching you. Riding and pushing are not
        simulated. Your build stays unchanged.
      </p>
      {rig.vehicle && report.vehicleCollision && (
        <p role={report.vehicleCollision.supported ? undefined : "status"}>
          {report.vehicleCollision.supported
            ? "Vehicle movement stops before included build geometry. Conservative collision shapes may stop it before visible surfaces touch."
            : `Driving is unavailable: ${report.vehicleCollision.reason}`}
        </p>
      )}
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
                  play.setMechanismJoint(j.id, Number(e.target.value), rig.id),
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
              disabled={report.vehicleCollision?.supported === false}
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
                  play.setMechanismVehicleInput(
                    {
                      throttle: 0,
                      steering: Number(e.target.value),
                    },
                    rig.id,
                  ),
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
                disabled={report.vehicleCollision?.supported === false}
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
