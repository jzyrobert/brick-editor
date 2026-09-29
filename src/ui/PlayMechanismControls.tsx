import { useEffect, useState } from "react";
import { Icon } from "./icons";
import type {
  PlayMotorReport,
  PlayVehicleCollisionReport,
} from "../play/types";
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
    motors?: Record<string, PlayMotorReport>;
  };
  onError: (message: string) => void;
  choices?: MotionRig[];
  onRigChange?: (rigId: string) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const dynamic = report.mode === "dynamic";
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
  const title =
    choices.length > 1 ? "Remote mechanism controls" : `${rig.name} controls`;
  const toggle = (next: boolean) => {
    play.clearInput();
    setOpen(next);
    onOpenChange?.(next);
    if (next) onRigChange?.(rig.id);
  };
  return (
    <>
      <button
        className="play-key play-mechanism-key"
        aria-label={title}
        title={title}
        aria-expanded={open}
        onClick={() => toggle(!open)}
      >
        <Icon name={open ? "close" : "sliders"} />
      </button>
      {open && (
        <section className="play-mechanism" aria-label={title}>
          <div className="play-mechanism-head">
            <h2>{title}</h2>
          </div>
          <button className="wide" onClick={() => toggle(false)}>
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
            Advanced controls can move this mechanism from anywhere. Nearby
            actions remain available when you close this panel.{" "}
            {dynamic
              ? "Setting a joint here drives it to that angle with its motor."
              : "Setting a joint here immediately positions it and cancels only that joint’s animated travel."}
          </p>
          <p>
            {dynamic
              ? "Dynamic physics: joints move through motors, loose parts fall and can be pushed. Your build stays unchanged."
              : "Moving parts stop before touching you. Riding and pushing are not simulated. Your build stays unchanged."}
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
              <div key={j.id} className="play-joint-control">
                <label>
                  {j.id}: {(report.pose.jointPositions[j.id] ?? 0).toFixed(1)}{" "}
                  {j.kind === "revolute" ? "degrees" : "LDU"}
                  <input
                    aria-label={`Explore joint ${j.id}`}
                    type="range"
                    min={j.limits?.[0] ?? -180}
                    max={j.limits?.[1] ?? 180}
                    step={1}
                    value={Math.round(report.pose.jointPositions[j.id] ?? 0)}
                    onChange={(e) =>
                      attempt(() =>
                        dynamic
                          ? play.setJointTarget({
                              rigId: rig.id,
                              jointId: j.id,
                              target: Number(e.target.value),
                              speed: j.kind === "revolute" ? 90 : 40,
                            })
                          : play.setMechanismJoint(
                              j.id,
                              Number(e.target.value),
                              rig.id,
                            ),
                      )
                    }
                  />
                </label>
                {report.motors?.[j.id] && (
                  <button
                    type="button"
                    aria-pressed={report.motors[j.id].enabled}
                    onClick={() =>
                      attempt(() =>
                        play.setMotor({
                          rigId: rig.id,
                          jointId: j.id,
                          enabled: !report.motors![j.id].enabled,
                        }),
                      )
                    }
                  >
                    {report.motors[j.id].enabled ? "Stop motor" : "Start motor"}
                    <small>
                      {" "}
                      · {report.motors[j.id].status.replace("-", " ")}
                    </small>
                  </button>
                )}
              </div>
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
              {report.blockedReason ||
                "Motion blocked to keep the explorer clear."}
            </p>
          )}
        </section>
      )}
    </>
  );
}
