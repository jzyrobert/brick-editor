import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { BrowserPlay } from "../play/browser";
import "./play.css";

export function PlayPanel({
  play,
  bookmark,
  exit,
  children,
}: {
  play: BrowserPlay;
  bookmark: () => void;
  exit: () => void;
  children?: React.ReactNode;
}) {
  const state = useSyncExternalStore(play.subscribe, play.getState);
  const [message, setMessage] = useState("");
  const [run, setRun] = useState(false);
  const [stick, setStick] = useState([0, 0]);
  const keys = useRef(new Set<string>()),
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
            (keys.current.has("d") ? 1 : 0) -
            (keys.current.has("a") ? 1 : 0),
        ),
      ),
      moveZ: Math.max(
        -1,
        Math.min(
          1,
          move.current.z +
            (keys.current.has("w") ? 1 : 0) -
            (keys.current.has("s") ? 1 : 0),
        ),
      ),
      vertical:
        (jump.current || keys.current.has(" ") ? 1 : 0) -
        (down.current || keys.current.has("control") ? 1 : 0),
      jump: jump.current || keys.current.has(" "),
      run: run || keys.current.has("shift"),
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
  useEffect(() => {
    input();
  }, [run]);
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable=true]",
        )
      ) {
        clear();
        return;
      }
      if (!play.getState().active) return;
      const key = e.key.toLowerCase();
      if (
        [
          "w",
          "a",
          "s",
          "d",
          " ",
          "shift",
          "control",
          "f",
          "v",
          "escape",
        ].includes(key)
      )
        e.preventDefault();
      else return;
      if (key === "escape") {
        clear();
        play.pause(true);
        return;
      }
      if (play.getState().paused) return;
      if (!e.repeat && key === "f")
        attempt(() =>
          play.setLocomotion(
            play.snapshot().locomotion === "walk" ? "fly-noclip" : "walk",
          ),
        );
      else if (!e.repeat && key === "v")
        attempt(() =>
          play.setCameraMode(
            play.snapshot().cameraMode === "first-person"
              ? "third-person"
              : "first-person",
          ),
        );
      else {
        keys.current.add(key);
        input();
      }
    };
    const keyup = (e: KeyboardEvent) => {
      keys.current.delete(e.key.toLowerCase());
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
      if ((e.target as HTMLElement).matches("input,textarea,select")) clear();
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
  }, [play, run]);
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
          Your build stays unchanged. A temporary ground plane supports
          exploration. Character height: 72 LDU.
        </p>
        <button
          className="primary wide"
          disabled={state.loading}
          onClick={() => attempt(() => play.enter({ realtime: true }))}
        >
          {state.loading ? "Preparing your world…" : "Enter Play"}
        </button>
        {state.loading && <button onClick={() => play.exit()}>Cancel</button>}
        <p role="status">{message || state.error}</p>
        {children}
      </div>
    );
  const report = state.report!;
  return (
    <div className={"play-overlay" + (state.paused ? " is-paused" : "")}>
      <div className="play-top">
        <div>
          <strong>
            {report.locomotion === "walk"
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
            Respawn safely
          </button>
          <button onClick={() => attempt(bookmark)}>
            Save this view to Photo
          </button>
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
            WASD move · drag to look · Space jump · F fly · V camera
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
              Move
            </span>
          </div>
          <div className="play-actions">
            <button aria-pressed={run} onClick={() => setRun(!run)}>
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
              >
                Down
              </button>
            )}
          </div>
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
      {message && (
        <div className="play-message" role="status">
          {message}
        </div>
      )}
    </div>
  );
}
