import { PlayWorldSettings } from "./PlayWorldSettings";
import type { Layer } from "../core/types";
import { PlaySettings } from "./PlaySettings";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { BrowserPlay } from "../play/browser";
import "./play.css";
import type { MotionRig } from "../mechanisms/types";
import {
  loadPlayKeys,
  savePlayKeys,
  playKeyAction,
  type PlayKeyAction,
  type PlayKeys,
} from "../play/keys";
import { PlayKeySettings } from "./PlayKeySettings";
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
  const [excludedLayerIds, setExcludedLayerIds] = useState<string[]>([]);
  const [ground, setGround] = useState(true);
  const [bindings, setBindings] = useState(loadPlayKeys);
  const bindingRef = useRef(bindings);
  bindingRef.current = bindings;
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
    const lock = () => {
      if (!document.pointerLockElement) pause();
    };
    const mouse = (e: MouseEvent) => {
      if (document.pointerLockElement) play.look(e.movementX, e.movementY);
    };
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
    document.addEventListener("mousemove", mouse);
    document.addEventListener("focusin", focus);
    return () => {
      clear();
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("pointerlockchange", lock);
      document.removeEventListener("mousemove", mouse);
      document.removeEventListener("focusin", focus);
    };
  }, [play]);
  useEffect(() => {
    if (state.paused) clear();
  }, [state.paused]);
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
        <span className="eyebrow">EXPLORE YOUR BUILD</span>
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
              value={rigs[rigId] ? rigId : ""}
              onChange={(e) => setRigId(e.target.value)}
            >
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
            Choose a mechanism above, then move near its joint or vehicle and
            press {bindings.interact || "the on-screen action"}. One rig is
            active per session.
          </p>
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
          onClick={() =>
            attempt(() =>
              play.enter({
                realtime: true,
                ground,
                worldProfile: {
                  excludedLayerIds: excludedLayerIds.filter(
                    (id) => !!layers[id],
                  ),
                },
                ...(rigs[rigId] ? { rigId } : {}),
              }),
            )
          }
        >
          {state.loading ? "Preparing your world…" : "Enter Play"}
        </button>
        {state.loading && <button onClick={() => play.exit()}>Cancel</button>}
        <p role="status">{message || state.error}</p>
        <PlayKeySettings value={bindings} onChange={changeBindings} />
        {children}
      </div>
    );
  const report = state.report!;
  return (
    <div className={"play-overlay" + (state.paused ? " is-paused" : "")}>
      <div className="play-top">
        <div>
          <strong>
            {state.vehicleControl
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
        className="play-look"
        aria-label="Drag to look around"
        onPointerDown={(e) => {
          if (state.paused || lookPointer.current) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          lookPointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          const p = lookPointer.current;
          if (!p || p.id !== e.pointerId) return;
          play.look(e.clientX - p.x, e.clientY - p.y);
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
          <button className="primary" onClick={() => play.pause(false)}>
            Resume exploring
          </button>
          <button
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
          <PlayKeySettings value={bindings} onChange={changeBindings} />
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
          <div className="play-hint">
            {bindings.forward || "—"}/{bindings.left || "—"}/
            {bindings.backward || "—"}/{bindings.right || "—"} move · drag to
            look · {bindings.jump || "—"} jump · {bindings.fly || "—"} fly ·{" "}
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
              {state.vehicleControl ? "Drive" : "Move"}
            </span>
          </div>
          {!state.vehicleControl && (
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
        <button
          className="play-mouse-lock"
          onClick={() =>
            attempt(() =>
              document
                .querySelector<HTMLElement>(".play-look")!
                .requestPointerLock(),
            )
          }
        >
          Lock mouse
        </button>
      </div>
      {!state.paused && (state.interaction || state.vehicleControl) && (
        <div className="play-interaction">
          <button
            disabled={!state.vehicleControl && !state.interaction?.available}
            onClick={() => {
              clear();
              attempt(() => play.interact());
            }}
          >
            {state.vehicleControl
              ? "Release vehicle"
              : state.interaction?.available
                ? state.interaction.label
                : "Move closer to interact"}
            {bindings.interact && <kbd>{bindings.interact}</kbd>}
          </button>
          <small>
            {state.vehicleControl
              ? "Joystick or movement keys drive and steer. You stay on foot; vehicles can pass through the build."
              : state.interaction?.name}
          </small>
          {report.mechanism?.blocked && (
            <small role="status">{report.mechanism.blockedReason}</small>
          )}
        </div>
      )}
      {!state.paused &&
        !state.vehicleControl &&
        report.mechanism &&
        rigs[report.mechanism.rigId] && (
          <PlayMechanismControls
            play={play}
            rig={rigs[report.mechanism.rigId]}
            report={report.mechanism}
            onError={setMessage}
          />
        )}
      {message && (
        <div className="play-message" role="status">
          {message}
        </div>
      )}
    </div>
  );
}
