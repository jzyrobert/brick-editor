import { PlaySeatEntry } from "./PlaySeatEntry";
import { PlayWorldSettings } from "./PlayWorldSettings";
import type { Layer } from "../core/types";
import { PlaySettings } from "./PlaySettings";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { BrowserPlay } from "../play/browser";
import "./play.css";
import type { MotionRig } from "../mechanisms/types";
import type { PlaySnapshotReport } from "../play/types";
import {
  loadPlayKeys,
  savePlayKeys,
  playKeyAction,
  type PlayKeyAction,
  type PlayKeys,
} from "../play/keys";
import { PlayKeySettings } from "./PlayKeySettings";
import {
  loadPlayLook,
  mouseLookRate,
  savePlayLook,
  type PlayLookSettings,
} from "../play/look-settings";

/** Desktop pointer (mouse or trackpad): mouse look uses pointer lock. */
const finePointerQuery = "(hover: hover) and (pointer: fine)";
const hasFinePointer = () =>
  typeof matchMedia === "function" && matchMedia(finePointerQuery).matches;
import { PlayMechanismControls } from "./PlayMechanismControls";

export function PlayPanel({
  play,
  bookmark,
  exit,
  children,
  rigs = {},
  layers = {},
}: {
  play: BrowserPlay;
  bookmark: () => void;
  exit: () => void;
  children?: React.ReactNode;
  rigs?: Record<string, MotionRig>;
  layers?: Record<string, Layer>;
}) {
  const state = useSyncExternalStore(play.subscribe, play.getState);
  const [message, setMessage] = useState("");
  const [rigId, setRigId] = useState("");
  const [mechanismMode, setMechanismMode] = useState<
    "all" | "single" | "static"
  >("all");
  const [remoteRigId, setRemoteRigId] = useState("");
  const [physics, setPhysics] = useState<"kinematic" | "dynamic">("kinematic");
  const [remoteOpen, setRemoteOpen] = useState(false);
  let allOption = "__all_mechanisms__";
  while (rigs[allOption]) allOption += "_";
  const [excludedLayerIds, setExcludedLayerIds] = useState<string[]>([]);
  const [ground, setGround] = useState(true);
  const [bindings, setBindings] = useState(loadPlayKeys);
  const bindingRef = useRef(bindings);
  bindingRef.current = bindings;
  const [look, setLook] = useState<PlayLookSettings>(loadPlayLook);
  const lookRef = useRef(look);
  lookRef.current = look;
  const changeLook = (next: PlayLookSettings) => {
    setLook(next);
    lookRef.current = next;
    return savePlayLook(next);
  };
  const [finePointer, setFinePointer] = useState(hasFinePointer);
  const [locked, setLocked] = useState(false);
  // Set when the browser refuses pointer lock (e.g. an iframe without
  // permission, or automation): the hint then offers drag-to-look instead.
  const [lockRefused, setLockRefused] = useState(false);
  const lookLayer = useRef<HTMLDivElement>(null);
  const wantLock = useRef(false);
  const mouseLook = () => ({
    radiansPerPixel: mouseLookRate(lookRef.current),
    invertY: lookRef.current.invertY,
  });
  /** Capture the mouse for look (desktop only). Must run in a user gesture;
   * failure leaves drag-to-look working. */
  const requestLock = () => {
    const target = lookLayer.current;
    if (!hasFinePointer() || !target || document.pointerLockElement === target)
      return;
    try {
      const result = target.requestPointerLock?.() as unknown;
      if (result instanceof Promise)
        result.then(
          () => setLockRefused(false),
          () => setLockRefused(true),
        );
    } catch {
      setLockRefused(true);
    }
  };
  const [run, setRun] = useState(false);
  const runRef = useRef(run);
  runRef.current = run;
  const [stick, setStick] = useState([0, 0]);
  const keys = useRef(new Set<PlayKeyAction>()),
    move = useRef({ x: 0, z: 0 }),
    jump = useRef(false),
    down = useRef(false);
  const stickPointer = useRef<number | null>(null),
    lookPointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const attempt = (fn: () => unknown) => {
    try {
      const result = fn();
      if (result instanceof Promise)
        void result.catch((e) => setMessage(e.message));
      else setMessage("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };
  const input = () => {
    if (!play.getState().active || play.getState().paused) return;
    play.setInput({
      moveX: Math.max(
        -1,
        Math.min(
          1,
          move.current.x +
            (keys.current.has("right") ? 1 : 0) -
            (keys.current.has("left") ? 1 : 0),
        ),
      ),
      moveZ: Math.max(
        -1,
        Math.min(
          1,
          move.current.z +
            (keys.current.has("forward") ? 1 : 0) -
            (keys.current.has("backward") ? 1 : 0),
        ),
      ),
      vertical:
        (jump.current || keys.current.has("jump") ? 1 : 0) -
        (down.current || keys.current.has("down") ? 1 : 0),
      jump: jump.current || keys.current.has("jump"),
      run: runRef.current || keys.current.has("run"),
    });
  };
  /** Say why a world opened in Fly (e.g. missing parts), not just that it did. */
  const explainFly = (report: PlaySnapshotReport) => {
    if (report.collisionReady) return;
    const reason = report.warnings
      .filter((w) => !w.startsWith("Session-only ground"))
      .join(" ");
    setMessage(reason || "Walking is off for this world. Fly still works.");
  };
  const clear = () => {
    keys.current.clear();
    move.current = { x: 0, z: 0 };
    jump.current = false;
    down.current = false;
    stickPointer.current = null;
    lookPointer.current = null;
    setStick([0, 0]);
    play.clearInput();
  };
  const changeBindings = (next: PlayKeys) => {
    clear();
    bindingRef.current = next;
    setBindings(next);
    return savePlayKeys(next);
  };
  useEffect(() => {
    input();
  }, [run]);
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && play.getState().active) {
        e.preventDefault();
        clear();
        play.pause(true);
        return;
      }
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=textbox]",
        )
      ) {
        clear();
        return;
      }
      if (
        (e.key === " " || e.key === "Enter") &&
        (e.target as HTMLElement).closest("button,summary,a")
      )
        return;
      if (!play.getState().active) return;
      if (e.isComposing || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase(),
        action = playKeyAction(e.key, bindingRef.current);
      if (key !== "escape" && !action) return;
      e.preventDefault();
      if (key === "escape") {
        clear();
        play.pause(true);
        return;
      }
      if (play.getState().paused) return;
      if (!e.repeat && action === "interact") {
        clear();
        attempt(() => play.interact());
      } else if (!e.repeat && action === "fly")
        attempt(() =>
          play.setLocomotion(
            play.snapshot().locomotion === "walk" ? "fly-noclip" : "walk",
          ),
        );
      else if (!e.repeat && action === "camera")
        attempt(() =>
          play.setCameraMode(
            play.snapshot().cameraMode === "first-person"
              ? "third-person"
              : "first-person",
          ),
        );
      else if (
        action &&
        action !== "fly" &&
        action !== "camera" &&
        action !== "interact"
      ) {
        keys.current.add(action);
        input();
      }
    };
    const keyup = (e: KeyboardEvent) => {
      const action = playKeyAction(e.key, bindingRef.current);
      if (action) keys.current.delete(action);
      input();
    };
    const pause = () => {
      clear();
      if (play.getState().active) play.pause(true);
    };
    const visibility = () => {
      if (document.hidden) pause();
    };
    // Esc releases pointer lock (the browser handles that key itself), which
    // pauses Play so every button is reachable again.
    const lock = () => {
      setLocked(!!document.pointerLockElement);
      if (!document.pointerLockElement) pause();
      else setLockRefused(false);
    };
    const lockError = () => setLockRefused(true);
    const mouse = (e: MouseEvent) => {
      if (document.pointerLockElement)
        play.look(e.movementX, e.movementY, mouseLook());
    };
    const media =
      typeof matchMedia === "function"
        ? matchMedia(finePointerQuery)
        : undefined;
    const pointerKind = () => setFinePointer(!!media?.matches);
    const focus = (e: FocusEvent) => {
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=textbox]",
        )
      )
        clear();
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("pointerlockchange", lock);
    document.addEventListener("pointerlockerror", lockError);
    media?.addEventListener?.("change", pointerKind);
    document.addEventListener("mousemove", mouse);
    document.addEventListener("focusin", focus);
    return () => {
      clear();
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("pointerlockchange", lock);
      document.removeEventListener("pointerlockerror", lockError);
      media?.removeEventListener?.("change", pointerKind);
      document.removeEventListener("mousemove", mouse);
      document.removeEventListener("focusin", focus);
    };
  }, [play]);
  useEffect(() => {
    if (state.paused) clear();
  }, [state.paused]);
  // Entering Play from a click captures the mouse straight away on desktop
  // (the layer only exists once the session is active).
  useEffect(() => {
    if (state.active && wantLock.current) {
      wantLock.current = false;
      requestLock();
    }
  }, [state.active]);
  const releaseStick = (e: React.PointerEvent) => {
    if (stickPointer.current !== e.pointerId) return;
    stickPointer.current = null;
    move.current = { x: 0, z: 0 };
    setStick([0, 0]);
    input();
  };
  const stickMove = (e: React.PointerEvent) => {
    if (stickPointer.current !== e.pointerId) return;
    const b = e.currentTarget.getBoundingClientRect();
    let x = (e.clientX - b.left - b.width / 2) / (b.width * 0.32),
      z = -(e.clientY - b.top - b.height / 2) / (b.height * 0.32);
    const length = Math.max(1, Math.hypot(x, z));
    x /= length;
    z /= length;
    move.current = { x, z };
    setStick([x, z]);
    input();
  };
  if (!state.active)
    return (
      <div className="mode-card play-intro">
        <h2>Step inside.</h2>
        <p>
          Walk through your model or fly through walls. Switch to third person
          to see your brick figure.
        </p>
        <p className="muted">
          Your build stays unchanged. Choose which layers and ground to explore
          below. Character height: 72 LDU.
        </p>
        {Object.keys(rigs).length > 0 && (
          <label>
            Explore with mechanism
            <select
              aria-label="Explore with mechanism"
              value={
                mechanismMode === "all"
                  ? allOption
                  : mechanismMode === "single" && rigs[rigId]
                    ? rigId
                    : ""
              }
              onChange={(e) => {
                setMechanismMode(
                  e.target.value === allOption
                    ? "all"
                    : e.target.value
                      ? "single"
                      : "static",
                );
                if (e.target.value && e.target.value !== allOption)
                  setRigId(e.target.value);
              }}
            >
              <option value={allOption}>
                All mechanisms ({Object.keys(rigs).length})
              </option>
              <option value="">Static build</option>
              {Object.values(rigs).map((rig) => (
                <option key={rig.id} value={rig.id}>
                  {rig.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {Object.keys(rigs).length > 0 && (
          <p className="muted">
            Move near a joint or vehicle, then press{" "}
            {bindings.interact || "the on-screen action"} or tap its action. All
            mechanisms lets you interact with the whole build in one session.
            Static build keeps every part still.
          </p>
        )}
        {Object.keys(rigs).length > 0 && mechanismMode !== "static" && (
          <details className="play-world-settings play-physics-settings">
            <summary>Mechanism physics</summary>
            <label>
              <input
                type="radio"
                name="play-physics"
                checked={physics === "kinematic"}
                onChange={() => setPhysics("kinematic")}
              />
              Kinematic · parts follow their joints exactly
            </label>
            <label>
              <input
                type="radio"
                name="play-physics"
                checked={physics === "dynamic"}
                onChange={() => setPhysics("dynamic")}
              />
              Dynamic · gravity, motors, suspension and pushing
            </label>
            <p>
              Dynamic physics simulates each rigid group as one body. Loose
              parts fall and can be pushed; cars ride on sprung wheels.
              Simulated masses and forces are not real brick strength.
            </p>
          </details>
        )}
        <PlayWorldSettings
          layers={layers}
          excluded={excludedLayerIds}
          ground={ground}
          onExcluded={setExcludedLayerIds}
          onGround={setGround}
        />
        <button
          className="primary wide"
          disabled={state.loading}
          onClick={() => {
            wantLock.current = true;
            attempt(() =>
              play
                .enter({
                  realtime: true,
                  ground,
                  worldProfile: {
                    excludedLayerIds: excludedLayerIds.filter(
                      (id) => !!layers[id],
                    ),
                  },
                  ...(mechanismMode === "all" && Object.keys(rigs).length
                    ? {
                        rigIds: Object.keys(rigs),
                        ...(physics === "dynamic"
                          ? { dynamicRigIds: Object.keys(rigs).slice(0, 14) }
                          : {}),
                      }
                    : mechanismMode === "single" && rigs[rigId]
                      ? {
                          rigId,
                          ...(physics === "dynamic"
                            ? { dynamicRigIds: [rigId] }
                            : {}),
                        }
                      : {}),
                  // Static build keeps every part still, doors included.
                  ...(mechanismMode === "static" && Object.keys(rigs).length
                    ? { autoDoors: false }
                    : {}),
                })
                .then(explainFly),
            );
          }}
        >
          {state.loading ? "Preparing your world…" : "Enter Play"}
        </button>
        {state.loading && <button onClick={() => play.exit()}>Cancel</button>}
        <p role="status">{message || state.error}</p>
        <PlayKeySettings
          value={bindings}
          onChange={changeBindings}
          look={look}
          onLookChange={changeLook}
        />
        {children}
      </div>
    );
  const report = state.report!;
  const occupied = report.occupancy;
  const mechanisms =
    report.mechanisms ??
    (report.mechanism ? { [report.mechanism.rigId]: report.mechanism } : {});
  const activeRigs = Object.values(rigs).filter((rig) => !!mechanisms[rig.id]);
  const nearbyRigId = state.interaction?.rigId;
  const activeRigId = mechanisms[remoteRigId]
    ? remoteRigId
    : nearbyRigId && mechanisms[nearbyRigId]
      ? nearbyRigId
      : activeRigs[0]?.id;
  const seatRig =
    state.interaction?.kind === "vehicle" &&
    rigs[state.interaction.rigId]?.vehicle?.driverSeat
      ? rigs[state.interaction.rigId]
      : undefined;
  const nearbyReport = occupied
    ? mechanisms[occupied.rigId]
    : state.vehicleControl
      ? mechanisms[state.vehicleControl]
      : nearbyRigId
        ? mechanisms[nearbyRigId]
        : report.mechanism;

  return (
    <div
      className={
        "play-overlay" +
        (state.paused ? " is-paused" : "") +
        (occupied ? " is-seated" : "") +
        (finePointer ? " has-mouse" : "") +
        (locked ? " is-locked" : "")
      }
    >
      <div className="play-top">
        <div>
          <strong>
            {occupied
              ? "Driving · " + (rigs[occupied.rigId]?.name ?? "driver seat")
              : state.vehicleControl
                ? "Controlling vehicle · on foot"
                : report.locomotion === "walk"
                  ? "Walking"
                  : "Flying · pass through walls"}
          </strong>
          <small>
            {report.cameraMode === "first-person"
              ? "First person"
              : "Third person"}{" "}
            · build unchanged
          </small>
        </div>
        <button
          onClick={() => {
            clear();
            play.pause(!state.paused);
          }}
        >
          {state.paused ? "Resume" : "Pause"}
        </button>
        <button
          onClick={() => {
            play.exit();
            exit();
          }}
        >
          Exit Play
        </button>
      </div>
      <div
        ref={lookLayer}
        className="play-look"
        aria-label={
          finePointer
            ? "Click to look around with the mouse"
            : "Drag to look around"
        }
        onPointerDown={(e) => {
          if (state.paused || lookPointer.current) return;
          // Desktop: a click captures the mouse; dragging still works if the
          // browser refuses pointer lock.
          if (e.pointerType === "mouse") requestLock();
          e.currentTarget.setPointerCapture(e.pointerId);
          lookPointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          const p = lookPointer.current;
          if (!p || p.id !== e.pointerId) return;
          if (document.pointerLockElement) return; // Raw mouse deltas drive look.
          play.look(
            e.clientX - p.x,
            e.clientY - p.y,
            e.pointerType === "mouse" ? mouseLook() : undefined,
          );
          p.x = e.clientX;
          p.y = e.clientY;
        }}
        onPointerUp={(e) => {
          if (lookPointer.current?.id === e.pointerId)
            lookPointer.current = null;
        }}
        onPointerCancel={() => {
          lookPointer.current = null;
          play.clearInput();
        }}
        onLostPointerCapture={(e) => {
          if (lookPointer.current?.id === e.pointerId)
            lookPointer.current = null;
        }}
      />
      <span className="play-crosshair" aria-hidden="true">
        +
      </span>
      {state.paused ? (
        <div className="play-menu">
          <h2>Take a breather.</h2>
          <p>Movement is paused.</p>
          <button
            className="primary"
            onClick={() => {
              play.pause(false);
              requestLock();
            }}
          >
            {occupied ? "Resume driving" : "Resume exploring"}
          </button>
          <button
            disabled={!!occupied}
            onClick={() =>
              attempt(() => {
                play.respawn();
                play.pause(false);
              })
            }
          >
            Recover last safe position
          </button>
          <button onClick={() => attempt(bookmark)}>
            Save this view to Photo
          </button>
          <PlaySettings play={play} report={report} />
          <PlayKeySettings
            value={bindings}
            onChange={changeBindings}
            look={look}
            onLookChange={changeLook}
          />
          <p role="status">
            {message ||
              report.warnings
                .map((w) =>
                  w.startsWith("Session-only ground")
                    ? "A temporary floor keeps you from falling; your build is unchanged."
                    : w,
                )
                .join(" ")}
          </p>
        </div>
      ) : (
        <>
          {finePointer && !locked && (
            <div className="play-hint play-lock-hint">
              {lockRefused
                ? "Drag to look around · Esc to pause"
                : "Click to look around · Esc to release"}
            </div>
          )}
          <div
            className="play-hint play-keys-hint"
            hidden={finePointer && !locked}
          >
            {bindings.forward || "—"}/{bindings.left || "—"}/
            {bindings.backward || "—"}/{bindings.right || "—"}{" "}
            {occupied ? "drive" : "move"} ·{" "}
            {locked ? "mouse to look · Esc to release" : "drag to look"} ·{" "}
            {!occupied && (
              <>
                {bindings.jump || "—"} jump · {bindings.fly || "—"} fly ·{" "}
              </>
            )}
            {bindings.camera || "—"} camera · {bindings.interact || "—"}{" "}
            interact
          </div>
          <div
            className="play-stick"
            role="group"
            aria-label="Movement joystick"
            onPointerDown={(e) => {
              if (stickPointer.current !== null) return;
              stickPointer.current = e.pointerId;
              e.currentTarget.setPointerCapture(e.pointerId);
              stickMove(e);
            }}
            onPointerMove={stickMove}
            onPointerUp={releaseStick}
            onPointerCancel={releaseStick}
            onLostPointerCapture={releaseStick}
          >
            <span
              style={{
                transform: `translate(${stick[0] * 30}px,${-stick[1] * 30}px)`,
              }}
            >
              {state.vehicleControl || occupied ? "Drive" : "Move"}
            </span>
          </div>
          {!state.vehicleControl && !occupied && (
            <div className="play-actions">
              <button
                aria-pressed={run}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setRun((value) => !value);
                }}
                onClick={(e) => {
                  if (e.detail === 0) setRun((value) => !value);
                }}
              >
                Run
              </button>
              <button
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  jump.current = true;
                  input();
                }}
                onPointerUp={() => {
                  jump.current = false;
                  input();
                }}
                onPointerCancel={() => {
                  jump.current = false;
                  input();
                }}
                onLostPointerCapture={() => {
                  jump.current = false;
                  input();
                }}
              >
                {report.locomotion === "walk" ? "Jump" : "Up"}
              </button>
              {report.locomotion === "fly-noclip" && (
                <button
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    down.current = true;
                    input();
                  }}
                  onPointerUp={() => {
                    down.current = false;
                    input();
                  }}
                  onPointerCancel={() => {
                    down.current = false;
                    input();
                  }}
                  onLostPointerCapture={() => {
                    down.current = false;
                    input();
                  }}
                >
                  Down
                </button>
              )}
            </div>
          )}
        </>
      )}
      <div className="play-bottom">
        {!occupied && (
          <button
            onClick={() =>
              attempt(() =>
                play.setLocomotion(
                  report.locomotion === "walk" ? "fly-noclip" : "walk",
                ),
              )
            }
          >
            {report.locomotion === "walk"
              ? "Fly through walls"
              : "Switch to Walk"}
          </button>
        )}
        <button
          onClick={() =>
            attempt(() =>
              play.setCameraMode(
                report.cameraMode === "first-person"
                  ? "third-person"
                  : "first-person",
              ),
            )
          }
        >
          {report.cameraMode === "first-person"
            ? "Third person"
            : "First person"}
        </button>
      </div>
      {!state.paused &&
        (!remoteOpen || state.vehicleControl || occupied) &&
        (state.interaction || state.vehicleControl || occupied) && (
          <div className="play-interaction">
            {occupied ? (
              <>
                <button
                  onClick={() => {
                    clear();
                    attempt(() => play.exitVehicle({}));
                  }}
                >
                  Exit vehicle
                </button>
                <small>
                  Seated driver · use the joystick to drive and steer.
                </small>
                {message && <small role="status">{message}</small>}
                {nearbyReport?.blocked && (
                  <small role="status">{nearbyReport.blockedReason}</small>
                )}
              </>
            ) : !state.vehicleControl && seatRig ? (
              <PlaySeatEntry
                play={play}
                rig={seatRig}
                report={report}
                message={message}
                eligibility={{
                  eligible: state.interaction?.available ?? false,
                  reason: state.interaction?.blockedReason,
                }}
                action={(fn) => {
                  clear();
                  attempt(fn);
                }}
              />
            ) : (
              <>
                <button
                  disabled={
                    !state.vehicleControl && !state.interaction?.available
                  }
                  onClick={() => {
                    clear();
                    attempt(() => play.interact());
                  }}
                >
                  {state.vehicleControl
                    ? "Release vehicle"
                    : state.interaction?.available
                      ? state.interaction.label
                      : state.interaction?.kind === "vehicle" &&
                          state.interaction.blockedReason
                        ? "Vehicle unavailable"
                        : "Move closer to interact"}
                  {bindings.interact && <kbd>{bindings.interact}</kbd>}
                </button>
                <small>
                  {state.vehicleControl
                    ? "Joystick or movement keys drive and steer. You stay on foot; included walls and other rigs can stop the vehicle."
                    : state.interaction?.name}
                </small>
                {!state.vehicleControl && state.interaction?.progress && (
                  <small>{state.interaction.progress}</small>
                )}
                {!state.vehicleControl && state.interaction?.blockedReason ? (
                  <small role="status">{state.interaction.blockedReason}</small>
                ) : (
                  nearbyReport?.blocked && (
                    <small role="status">{nearbyReport.blockedReason}</small>
                  )
                )}
              </>
            )}
          </div>
        )}
      {!state.paused &&
        !state.vehicleControl &&
        !occupied &&
        activeRigId &&
        rigs[activeRigId] &&
        mechanisms[activeRigId] && (
          <PlayMechanismControls
            play={play}
            rig={rigs[activeRigId]}
            report={mechanisms[activeRigId]}
            choices={activeRigs}
            onOpenChange={setRemoteOpen}
            onRigChange={(id) => {
              clear();
              setRemoteRigId(id);
            }}
            onError={setMessage}
          />
        )}
      {message &&
        !occupied &&
        !(seatRig && !state.vehicleControl && !remoteOpen) && (
          <div className="play-message" role="status">
            {message}
          </div>
        )}
    </div>
  );
}
