import { useEffect, useMemo, useRef, useState } from "react";
import { PlayGripperControls } from "./PlayGripperControls";
import { Icon } from "./icons";
import type { PlayMechanismReport } from "../play/types";
import type { BrowserPlay } from "../play/browser";
import type { MotionRig } from "../mechanisms/types";
import { transmissionMap } from "../mechanisms/transmissions";

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
        play.clearInput();
        play.focusMechanism();
      }
    };
  }, [play, rig.id, onError]);
  const input = (value: number) => {
    if (!joint || !motor || !play.getState().active || play.getState().paused)
      return;
    attempt(() =>
      play.setMotor({
        rigId: rig.id,
        jointId: joint.id,
        enabled: true,
        input: value,
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
  const motorState = !motor
    ? ""
    : motor.status === "blocked"
      ? "Motor blocked"
      : motor.status === "at-limit"
        ? "At limit"
        : motor.input !== undefined
          ? motor.input === 0
            ? "Braking"
            : `${Math.round(Math.abs(motor.input) * 100)}% ${motor.input < 0 ? "reverse" : "forward"}`
          : motor.enabled
            ? "Running preset"
            : "Motor stopped";
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
        <div className="play-mechanism-viewbar">
          <span>Drag to orbit · pinch or scroll to zoom</span>
        </div>
        {controls.length > 1 && (
          <label className="play-control-picker">
            Part control
            <select
              aria-label="Part control"
              value={joint?.id}
              onChange={(e) => {
                cancelQueuedMove();
                play.clearInput();
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
            <div className="play-control-reading">
              <strong>{label(joint.id)}</strong>
              <output>
                {position.toFixed(1)}{" "}
                {joint.kind === "revolute" ? "degrees" : "LDU"}
              </output>
            </div>
            {motor ? (
              <>
                <div className="play-drive-buttons">
                  <button
                    type="button"
                    {...heldButton(-1, input)}
                    aria-label={`Hold ${label(joint.id).toLowerCase()} reverse`}
                  >
                    Reverse
                  </button>
                  <button
                    type="button"
                    onClick={() => input(0)}
                    aria-label="Brake motor"
                  >
                    Brake
                  </button>
                  <button
                    type="button"
                    {...heldButton(1, input)}
                    aria-label={`Hold ${label(joint.id).toLowerCase()} forward`}
                  >
                    Forward
                  </button>
                </div>
                <div className="play-drive-feedback">
                  <span>Release to brake</span>
                  <output role="status">{motorState}</output>
                </div>
                <details className="play-motor-settings">
                  <summary>Motor settings</summary>
                  <label className="play-motor-lever">
                    Speed and direction
                    <input
                      type="range"
                      aria-label="Motor speed and direction"
                      min={-1}
                      max={1}
                      step={0.05}
                      value={motor.input ?? 0}
                      onChange={(e) => input(Number(e.target.value))}
                      onPointerUp={() => input(0)}
                      onPointerCancel={() => input(0)}
                      onLostPointerCapture={() => input(0)}
                      onKeyUp={() => input(0)}
                      onBlur={() => input(0)}
                    />
                  </label>
                  <div className="play-motor-state">
                    <span>Use the motor's saved setting.</span>
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
                        ? "Run preset"
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
                {outputs.map(([id, ratio], i) => (
                  <p key={id}>
                    Output {i + 1}:{" "}
                    {(report.pose.jointPositions[id] ?? 0).toFixed(1)}{" "}
                    {rig.joints.find((j) => j.id === id)?.kind === "prismatic"
                      ? "LDU"
                      : "degrees"}
                    <span>
                      {" "}
                      {rig.joints.find((j) => j.id === id)?.kind === joint.kind
                        ? `${Math.abs(ratio).toFixed(2)}× speed · ${ratio < 0 ? "opposite direction" : "same direction"}`
                        : `${Math.abs(ratio).toFixed(2)} ${joint.kind === "revolute" ? "LDU per degree" : "degrees per LDU"}`}
                    </span>
                  </p>
                ))}
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
              {[
                [-1, "Hold reverse"],
                [1, "Hold forward"],
              ].map(([value, text]) => (
                <button
                  type="button"
                  key={text}
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
