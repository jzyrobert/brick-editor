import { useEffect, useMemo, useRef, useState } from "react";
import { PlayGripperControls } from "./PlayGripperControls";
import { Icon } from "./icons";
import type { PlayMechanismReport } from "../play/types";
import type { BrowserPlay } from "../play/browser";
import type { MotionRig } from "../mechanisms/types";
import { transmissionMap } from "../mechanisms/transmissions";
import { motorStatusText } from "./play-motor-presentation";

export function mechanismControlJoints(
  rig: MotionRig,
  components = transmissionMap(rig),
) {
  const passive = new Set(
    rig.loopClosures?.flatMap((c) => c.dependentJointIds),
  );
  return rig.joints.filter((j) => {
    if (passive.has(j.id) || (j.kind !== "revolute" && j.kind !== "prismatic"))
      return false;
    const members = components.get(j.id);
    if (!members) return true;
    const driver =
      rig.joints.find((other) => members.has(other.id) && other.motor) ??
      rig.joints.find((other) => members.has(other.id));
    return j.id === driver?.id;
  });
}

export function PlayMechanismControls({
  play,
  rig,
  report,
  onError,
  choices = [rig],
  onRigChange,
  title,
  onClose,
  paused = false,
}: {
  play: BrowserPlay;
  rig: MotionRig;
  report: PlayMechanismReport;
  onError: (message: string) => void;
  choices?: MotionRig[];
  onRigChange?: (rigId: string) => void;
  title: string;
  onClose: () => void;
  paused?: boolean;
}) {
  const panel = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [hasMore, setHasMore] = useState(false);
  const updateScrollCue = () => {
    const el = content.current;
    if (el?.clientHeight)
      setHasMore(el.scrollHeight - el.scrollTop - el.clientHeight > 2);
  };
  const components = useMemo(() => transmissionMap(rig), [rig]);
  const controls = useMemo(
    () => mechanismControlJoints(rig, components),
    [rig, components],
  );
  const [selected, setSelected] = useState(controls[0]?.id ?? "");
  const joint = controls.find((j) => j.id === selected) ?? controls[0];
  const motor = joint && report.motors?.[joint.id];
  const [powers, setPowers] = useState<Record<string, number>>({});
  const directions = useRef<Record<string, number>>({});
  const power =
    powers[JSON.stringify([rig.id, joint?.id])] ?? motor?.power ?? 1;
  const dynamic = report.mode === "dynamic";
  const controlKey = JSON.stringify([rig.id, joint?.id]);
  const [manualDraft, setManualDraft] = useState<{
    key: string;
    value: number;
  }>();
  const pendingMove = useRef<
    | {
        rigId: string;
        jointId: string;
        target: number;
        speed: number;
      }
    | undefined
  >(undefined);
  const moveFrame = useRef<number | undefined>(undefined);
  const jointTarget = joint && report.jointTargets?.[joint.id];
  const cancelQueuedMove = () => {
    pendingMove.current = undefined;
    if (moveFrame.current !== undefined)
      cancelAnimationFrame(moveFrame.current);
    moveFrame.current = undefined;
  };
  useEffect(() => {
    // A late drag event must not move a previous rig after switching or pausing.
    cancelQueuedMove();
    setManualDraft(undefined);
    return cancelQueuedMove;
  }, [controlKey, paused]);
  useEffect(() => {
    if (
      manualDraft?.key === controlKey &&
      jointTarget?.target === manualDraft.value
    )
      setManualDraft(undefined);
  }, [controlKey, manualDraft, jointTarget]);
  const attempt = (fn: () => unknown) => {
    try {
      fn();
      onError("");
      return true;
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
      return false;
    }
  };
  const moveManual = (value: number) => {
    if (!joint || !play.getState().active || play.getState().paused) return;
    setManualDraft({ key: controlKey, value });
    // Keep only the newest intended position in a frame. Motion proceeds in
    // normal checked ticks; a large pointer jump never requests an instant arc.
    pendingMove.current = {
      rigId: rig.id,
      jointId: joint.id,
      target: value,
      speed: joint.kind === "revolute" ? 90 : 40,
    };
    if (moveFrame.current !== undefined) return;
    moveFrame.current = requestAnimationFrame(() => {
      moveFrame.current = undefined;
      const request = pendingMove.current;
      pendingMove.current = undefined;
      if (!request || !play.getState().active || play.getState().paused) {
        setManualDraft(undefined);
        return;
      }
      if (!attempt(() => play.setJointTarget(request)))
        setManualDraft(undefined);
    });
  };
  useEffect(() => {
    const hud = panel.current
      ?.closest(".play-overlay")
      ?.querySelector(".play-top");
    const frame = () => {
      updateScrollCue();
      const box = panel.current?.getBoundingClientRect();
      if (!box || !box.width || !box.height || !play.getState().active) return;
      try {
        play.focusMechanism(
          rig.id,
          {
            x: box.left,
            y: box.top,
            width: box.width,
            height: box.height,
          },
          hud ? hud.getBoundingClientRect().bottom + 12 : undefined,
        );
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e));
      }
    };
    frame();
    const observer = new ResizeObserver(frame);
    if (panel.current) observer.observe(panel.current);
    if (content.current) observer.observe(content.current);
    if (hud) observer.observe(hud);
    window.addEventListener("resize", frame);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", frame);
      if (play.getState().active) {
        const motors = play.snapshot().mechanisms?.[rig.id]?.motors;
        // Motors you drove stop when Controls close; one that starts by
        // itself (no input of yours) keeps running as it did before.
        for (const j of rig.joints)
          if (motors?.[j.id]?.enabled && motors[j.id]!.input !== undefined)
            play.setMotor({
              rigId: rig.id,
              jointId: j.id,
              enabled: true,
              input: 0,
              power: 1,
            });
        play.clearInput();
        play.focusMechanism();
      }
    };
  }, [play, rig.id, onError]);
  const input = (value: number, power = 1) => {
    if (!joint || !motor || !play.getState().active || play.getState().paused)
      return;
    attempt(() =>
      play.setMotor({
        rigId: rig.id,
        jointId: joint.id,
        enabled: true,
        input: value,
        power,
      }),
    );
  };
  const drive = (throttle: number) => {
    if (!play.getState().active || play.getState().paused) return;
    attempt(() =>
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
  const label = (id: string) => {
    const j = controls.find((j) => j.id === id)!;
    if (j.motor)
      return `Motor ${controls.filter((j) => j.motor).findIndex((j) => j.id === id) + 1}`;
    const same = controls.filter((c) => !c.motor && c.kind === j.kind);
    const named = !/^joint-\d+$/.test(j.id) ? j.id.replace(/[-_]/g, " ") : "";
    return named
      ? named[0].toUpperCase() + named.slice(1)
      : `${j.kind === "revolute" ? "Turning part" : "Sliding part"} ${same.findIndex((c) => c.id === id) + 1}`;
  };
  const heldButton = (value: number, send: (value: number) => void) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      send(value);
    },
    onPointerUp: () => send(0),
    onPointerCancel: () => send(0),
    onLostPointerCapture: () => send(0),
    onBlur: () => send(0),
    onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) send(value);
      }
    },
    onKeyUp: (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        send(0);
      }
    },
  });
  const multipleMotors = controls.length > 1 && controls.every((j) => j.motor);
  const motorState = motorStatusText(motor);
  const runningOthers = controls.filter((j) => {
    const drive = report.motors?.[j.id];
    return (
      j.id !== joint?.id &&
      drive?.enabled &&
      drive.power !== 0 &&
      drive.input !== 0
    );
  }).length;
  const position = joint ? (report.pose.jointPositions[joint.id] ?? 0) : 0;
  const base = Math.floor((position + 180) / 360) * 360;
  const outputs = joint
    ? [...(components.get(joint.id) ?? [])].filter(([id]) => id !== joint.id)
    : [];
  return (
    <section
      ref={panel}
      hidden={paused}
      className="play-mechanism"
      aria-label={title}
    >
      <div className="play-mechanism-head">
        <h2>{title}</h2>
        <button
          className="play-fit-build"
          type="button"
          onClick={() => play.fitMechanism()}
        >
          Fit build
        </button>
        <button
          className="play-key play-mechanism-close"
          aria-label={`Close ${title.toLowerCase()}`}
          title="Close"
          onClick={() => {
            cancelQueuedMove();
            onClose();
          }}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="play-mechanism-viewbar">
        <span>Drag to orbit · pinch or scroll to zoom</span>
      </div>
      {multipleMotors ? (
        <div
          className="play-motor-picker"
          role="group"
          aria-label="Motor controls"
        >
          {controls.map((j) => {
            const drive = report.motors?.[j.id];
            return (
              <button
                key={j.id}
                type="button"
                aria-pressed={joint?.id === j.id}
                onClick={() => setSelected(j.id)}
              >
                <strong>{label(j.id)}</strong>
                <span>
                  {/^Running/.test(motorStatusText(drive)) && (
                    <span
                      className={
                        "play-motor-spin" +
                        (drive?.input !== undefined && drive.input < 0
                          ? " is-reverse"
                          : "")
                      }
                      aria-hidden="true"
                    >
                      <Icon name="rotate" size={14} />
                    </span>
                  )}
                  {motorStatusText(drive)}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      <div
        ref={content}
        className="play-mechanism-content"
        onScroll={updateScrollCue}
      >
        {choices.length > 1 && (
          <label className="play-control-picker">
            Remote mechanism
            <select
              aria-label="Remote mechanism"
              value={rig.id}
              onChange={(e) => {
                cancelQueuedMove();
                play.clearInput();
                onRigChange?.(e.target.value);
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
        {!multipleMotors && controls.length > 1 && (
          <label className="play-control-picker">
            Part control
            <select
              aria-label="Part control"
              value={joint?.id}
              onChange={(e) => {
                cancelQueuedMove();
                setSelected(e.target.value);
              }}
            >
              {controls.map((j) => (
                <option key={j.id} value={j.id}>
                  {label(j.id)}
                </option>
              ))}
            </select>
          </label>
        )}
        {dynamic && report.grippers && (
          <PlayGripperControls
            play={play}
            rigId={rig.id}
            reports={report.grippers}
            onError={onError}
          />
        )}
        {joint && (
          <div className="play-joint-control" key={joint.id}>
            {!multipleMotors && (
              <div className="play-control-reading">
                <strong>{label(joint.id)}</strong>
                <output>
                  {motor && /^Running/.test(motorState) && (
                    // A turning mark: the rotor itself can be small on screen.
                    <span
                      className={
                        "play-motor-spin" +
                        (motor.input !== undefined && motor.input < 0
                          ? " is-reverse"
                          : "")
                      }
                      aria-hidden="true"
                    >
                      <Icon name="rotate" size={16} />
                    </span>
                  )}
                  {motor
                    ? motorState
                    : `${position.toFixed(1)} ${joint.kind === "revolute" ? "degrees" : "LDU"}`}
                </output>
              </div>
            )}
            {motor ? (
              <>
                <label className="play-motor-power">
                  <span>
                    Power <output>{Math.round(power * 100)}%</output>
                  </span>
                  <input
                    type="range"
                    aria-label={`${label(joint.id)} power`}
                    min={0}
                    max={1}
                    step={0.05}
                    value={power}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setPowers((previous) => ({
                        ...previous,
                        [controlKey]: value,
                      }));
                      const direction = motor.input
                        ? Math.sign(motor.input)
                        : motor.power === 0
                          ? (directions.current[controlKey] ?? 0)
                          : 0;
                      if (direction) input(direction * value, value);
                      // A motor that starts by itself keeps its own motion
                      // at the new power (it has no direction of yours).
                      else if (
                        motor.input === undefined &&
                        motor.enabled &&
                        play.getState().active &&
                        !play.getState().paused
                      )
                        attempt(() =>
                          play.setMotor({
                            rigId: rig.id,
                            jointId: joint.id,
                            enabled: true,
                            power: value,
                          }),
                        );
                    }}
                  />
                </label>
                <div className="play-drive-buttons">
                  <button
                    type="button"
                    onClick={() => {
                      directions.current[controlKey] = -1;
                      input(-power, power);
                    }}
                    aria-pressed={!!motor.input && motor.input < 0}
                    aria-label={`Run ${label(joint.id).toLowerCase()} reverse`}
                  >
                    Reverse
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      directions.current[controlKey] = 0;
                      input(0);
                    }}
                    aria-label="Brake motor"
                    aria-pressed={motor.input === 0}
                  >
                    Brake
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      directions.current[controlKey] = 1;
                      input(power, power);
                    }}
                    aria-pressed={!!motor.input && motor.input > 0}
                    aria-label={`Run ${label(joint.id).toLowerCase()} forward`}
                  >
                    Forward
                  </button>
                </div>
                <div className="play-drive-feedback">
                  <span>
                    {motor.input === undefined && motor.enabled && power > 0
                      ? "Starts by itself. Tap a button to take over."
                      : motor.input === 0 || !motor.enabled || power === 0
                        ? "Stopped. Tap Forward or Reverse to run it."
                        : "Keeps running until you brake or close controls."}
                  </span>
                </div>
                {runningOthers > 0 && (
                  <div className="play-motor-state play-other-motors">
                    <span>
                      {runningOthers} other{" "}
                      {runningOthers === 1 ? "motor is" : "motors are"} active.
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        attempt(() => {
                          for (const j of controls.filter((j) => j.motor))
                            play.setMotor({
                              rigId: rig.id,
                              jointId: j.id,
                              enabled: true,
                              input: 0,
                              power: 1,
                            });
                        })
                      }
                    >
                      Brake all
                    </button>
                  </div>
                )}
                <details className="play-motor-settings">
                  <summary>Motor settings</summary>
                  <p>
                    {dynamic
                      ? "Power limits speed and available motor force."
                      : "Power limits turning speed. Dynamic mode also simulates motor force."}
                  </p>
                  <div className="play-motor-state">
                    <span>Let the motor start by itself, as it was built.</span>
                    <button
                      type="button"
                      onClick={() =>
                        attempt(() =>
                          play.setMotor({
                            rigId: rig.id,
                            jointId: joint.id,
                            enabled:
                              motor.input !== undefined || !motor.enabled,
                          }),
                        )
                      }
                    >
                      {motor.input !== undefined || !motor.enabled
                        ? "Start by itself"
                        : "Stop motor"}
                    </button>
                  </div>
                </details>
              </>
            ) : (
              <label>
                Move this part
                <input
                  aria-label={`Explore joint ${joint.id}`}
                  type="range"
                  step={1}
                  min={
                    joint.limits?.[0] ??
                    (joint.kind === "revolute" ? base - 180 : -40)
                  }
                  max={
                    joint.limits?.[1] ??
                    (joint.kind === "revolute" ? base + 180 : 40)
                  }
                  value={Math.round(
                    manualDraft?.key === controlKey
                      ? manualDraft.value
                      : jointTarget?.status === "moving"
                        ? jointTarget.target
                        : position,
                  )}
                  onChange={(e) => moveManual(Number(e.target.value))}
                />
              </label>
            )}
            {!!outputs.length && (
              <details className="play-output-details">
                <summary>Linked outputs ({outputs.length})</summary>
                {outputs.map(([id, ratio], i) => {
                  const output = rig.joints.find((j) => j.id === id);
                  const bounded =
                    output?.kind === "prismatic" || output?.limits;
                  return (
                    <p key={id}>
                      Output {i + 1}:{" "}
                      {bounded || !motor
                        ? `${(report.pose.jointPositions[id] ?? 0).toFixed(1)} ${output?.kind === "prismatic" ? "LDU" : "degrees"}`
                        : motorStatusText({
                            ...motor,
                            input:
                              motor.input === undefined
                                ? undefined
                                : motor.input * Math.sign(ratio),
                          })}
                      <span>
                        {" "}
                        {output?.kind === joint.kind
                          ? `${Math.abs(ratio).toFixed(2)}× speed · ${ratio < 0 ? "opposite direction" : "same direction"}`
                          : `${Math.abs(ratio).toFixed(2)} ${joint.kind === "revolute" ? "LDU per degree" : "degrees per LDU"}`}
                      </span>
                    </p>
                  );
                })}
              </details>
            )}
          </div>
        )}
        {rig.vehicle && (
          <div className="play-vehicle-controls">
            {report.vehicleCollision?.supported === false && (
              <p role="status">
                Driving is unavailable: {report.vehicleCollision.reason}
              </p>
            )}
            <label>
              Steering
              <input
                aria-label="Explore vehicle steering"
                type="range"
                min={-1}
                max={1}
                step={0.05}
                disabled={report.vehicleCollision?.supported === false}
                value={
                  (report.pose.vehicle?.steeringDegrees ?? 0) /
                  rig.vehicle.maxSteerDegrees
                }
                onChange={(e) =>
                  attempt(() =>
                    play.setMechanismVehicleInput(
                      { throttle: 0, steering: Number(e.target.value) },
                      rig.id,
                    ),
                  )
                }
              />
            </label>
            <div className="play-drive-buttons">
              {/* Worded like the driving pads (Go / Back). */}
              {[
                [-1, "Hold reverse", "Hold to go back"],
                [1, "Hold forward", "Hold to go"],
              ].map(([value, name, text]) => (
                <button
                  type="button"
                  key={name}
                  aria-label={String(name)}
                  disabled={report.vehicleCollision?.supported === false}
                  {...heldButton(Number(value), drive)}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}
        {report.blocked && (
          <p role="status" className="play-control-blocked">
            {report.blockedReason ||
              "Motion blocked to keep the explorer clear."}
          </p>
        )}
      </div>
      {hasMore && (
        <div className="play-mechanism-scroll-cue">
          Scroll for more controls
          <Icon name="arrowDown" />
        </div>
      )}
    </section>
  );
}
