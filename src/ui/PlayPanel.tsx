import { physicalPlayEligibility } from "../mechanisms/physical-play";
import { occurrences } from "../core/document";
import { PlayMechanismSetup, type MechanismReview } from "./PlayMechanismSetup";
import type { Editor } from "../core/commands";
import { PlaySeatEntry } from "./PlaySeatEntry";
import { PlayWorldSettings } from "./PlayWorldSettings";
import type { Layer } from "../core/types";
import { PlaySettings } from "./PlaySettings";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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
import { ModeMenu } from "./ModeMenu";
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
import {
  PlayMechanismControls,
  mechanismControlJoints,
} from "./PlayMechanismControls";
import { PlayTrainControls } from "./PlayTrainControls";
import { promptVisible } from "../play/interaction";
import { pinchZoomFactor, wheelZoomFactor } from "../play/zoom-input";
import { Icon, type IconName } from "./icons";
import {
  choosePortrait,
  enterPlayScreen,
  isPlayPhone,
  isPortrait,
  leavePlayScreen,
  portraitWasChosen,
} from "./play-screen";

/** Full stick deflection, in CSS px from where the thumb landed. */
const STICK_TRAVEL = 44;

export function PlayPanel({
  play,
  bookmark,
  exit,
  children,
  rigs: authoredRigs = {},
  editor,
  selection = [],
  layers = {},
  playHint,
}: {
  play: BrowserPlay;
  bookmark: () => void;
  exit: () => void;
  children?: React.ReactNode;
  rigs?: Record<string, MotionRig>;
  editor?: Editor;
  selection?: string[];
  layers?: Record<string, Layer>;
  /** The build's one-line Play hint (project.scene.playHint). */
  playHint?: string;
}) {
  const state = useSyncExternalStore(play.subscribe, play.getState);
  const rigReview = useMemo(() => {
    if (!editor) return { usable: authoredRigs, unavailable: [] as string[] };
    const project = editor.snapshot;
    const all = occurrences(project);
    const usable: Record<string, MotionRig> = {};
    const unavailable: string[] = [];
    for (const rig of Object.values(authoredRigs)) {
      const result = physicalPlayEligibility(project, rig, all);
      if (result.eligible) usable[rig.id] = rig;
      else unavailable.push(`${rig.name}: ${result.reason}`);
    }
    return { usable, unavailable };
  }, [authoredRigs, editor, editor?.snapshot]);
  const rigs = state.active ? play.getSessionRigs() : rigReview.usable;
  const [message, setMessage] = useState("");
  const topRow = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const row = topRow.current,
      tools = row
        ?.closest(".app")
        ?.querySelector<HTMLElement>(".model-tools-toggle");
    if (!row || !tools) return;
    const reserveTools = () => {
      const controls = tools.getBoundingClientRect(),
        top = row.getBoundingClientRect();
      if (controls.width)
        row.style.setProperty(
          "--play-status-width",
          `${Math.max(44, controls.left - top.left - 8)}px`,
        );
      else row.style.removeProperty("--play-status-width");
    };
    reserveTools();
    const observer = new ResizeObserver(reserveTools);
    observer.observe(row);
    observer.observe(tools);
    window.addEventListener("resize", reserveTools);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", reserveTools);
    };
  }, [state.active]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [mechanismReview, setMechanismReview] = useState<MechanismReview>();
  const [rigId, setRigId] = useState("");
  const [mechanismMode, setMechanismMode] = useState<
    "all" | "single" | "static"
  >("all");
  const [remoteRigId, setRemoteRigId] = useState("");
  // A build whose rigs ask for it (dynamics.startDynamic) starts in Dynamic.
  const startDynamic = Object.values(rigs).some(
    (rig) => rig.dynamics?.startDynamic,
  );
  const [physics, setPhysics] = useState<"kinematic" | "dynamic">(
    startDynamic ? "dynamic" : "kinematic",
  );
  useEffect(() => {
    setPhysics(startDynamic ? "dynamic" : "kinematic");
  }, [startDynamic]);
  const [remoteOpen, setRemoteOpen] = useState(false);
  const independentRigIds = useMemo(
    () =>
      new Set(
        Object.values(rigs)
          .filter((rig) => mechanismControlJoints(rig).length)
          .map((rig) => rig.id),
      ),
    [rigs],
  );
  const [trainOpen, setTrainOpen] = useState(false);
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
  const [floating, setFloating] = useState<{ x: number; y: number } | null>(
    null,
  );
  const stickRing = useRef<HTMLDivElement>(null),
    stickOrigin = useRef<{ x: number; y: number } | null>(null);
  const [rotateAsk, setRotateAsk] = useState(false);
  const [looked, setLooked] = useState(false);
  const keys = useRef(new Set<PlayKeyAction>()),
    move = useRef({ x: 0, z: 0 }),
    jump = useRef(false),
    down = useRef(false);
  const stickPointer = useRef<number | null>(null),
    lookPointer = useRef<{ id: number; x: number; y: number } | null>(null),
    // A second finger on the view turns a look drag into a pinch zoom.
    pinch = useRef<{ id: number; x: number; y: number; spread: number } | null>(
      null,
    );
  /** A finger lifts: a pinch ends without resuming a look drag (no jump). */
  const endPointer = (id: number) => {
    if (
      pinch.current &&
      (pinch.current.id === id || lookPointer.current?.id === id)
    ) {
      pinch.current = null;
      lookPointer.current = null;
      return;
    }
    if (lookPointer.current?.id === id) lookPointer.current = null;
  };
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
        if (!play.getState().mechanismOverview) clear();
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
      if (play.getState().mechanismOverview) return;
      if (!e.repeat && action === "interact") {
        clear();
        // While riding, the action gets off the train.
        attempt(() =>
          play.snapshot().trains?.riding
            ? play.rideTrain({ trainId: null })
            : play.interact(),
        );
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
      if (!document.pointerLockElement && !play.getState().mechanismOverview)
        pause();
      else setLockRefused(false);
    };
    const lockError = () => setLockRefused(true);
    const mouse = (e: MouseEvent) => {
      if (document.pointerLockElement)
        play.look(e.movementX, e.movementY, mouseLook());
    };
    // Wheel and trackpad pinch (ctrl+wheel) zoom the third-person camera.
    // Over the view or with the mouse captured, the page never scrolls or
    // zooms instead.
    const wheel = (e: WheelEvent) => {
      const s = play.getState();
      if (!s.active || s.paused) return;
      const overView =
        e.target instanceof Element && !!e.target.closest(".play-look");
      if (!document.pointerLockElement && !overView) return;
      e.preventDefault();
      play.zoom(wheelZoomFactor(e));
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
        ) &&
        !play.getState().mechanismOverview
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
    document.addEventListener("wheel", wheel, { passive: false });
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
      document.removeEventListener("wheel", wheel);
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
  // Phones: ask to rotate to landscape once Play is running in portrait.
  useEffect(() => {
    if (!state.active) {
      setRotateAsk(false);
      setRemoteOpen(false);
      setTrainOpen(false);
      leavePlayScreen();
    }
  }, [state.active]);
  // Successful API context changes also leave the mechanism sheet. A refused
  // seat or train request leaves these fields and the selected controls intact.
  useEffect(() => {
    if (
      state.vehicleControl ||
      state.report?.occupancy ||
      state.report?.trains?.riding
    )
      setRemoteOpen(false);
  }, [
    state.vehicleControl,
    state.report?.occupancy,
    state.report?.trains?.riding,
  ]);
  useEffect(() => {
    if (state.active && state.mechanismOverview) setRemoteOpen(true);
  }, [state.active, state.mechanismOverview]);
  useEffect(() => () => leavePlayScreen(), []);
  useEffect(() => {
    if (!rotateAsk || typeof matchMedia !== "function") return;
    const landscape = matchMedia("(orientation: landscape)");
    const turned = () => {
      if (landscape.matches) setRotateAsk(false);
    };
    turned();
    landscape.addEventListener?.("change", turned);
    return () => landscape.removeEventListener?.("change", turned);
  }, [rotateAsk]);
  // The build's Play hint shows for a few seconds once per session.
  const [hintDone, setHintDone] = useState(false);
  useEffect(() => {
    if (!state.active) {
      setHintDone(false);
      return;
    }
    const timer = setTimeout(() => setHintDone(true), 6000);
    return () => clearTimeout(timer);
  }, [state.active]);
  // The look hint shows until the first look drag, or a few seconds. It
  // waits for the build's own hint so the two never share the screen.
  const lookHintDue = !playHint || hintDone;
  useEffect(() => {
    if (!state.active || looked || !lookHintDue) return;
    const timer = setTimeout(() => setLooked(true), 6000);
    return () => clearTimeout(timer);
  }, [state.active, looked, lookHintDue]);
  /** Floating stick: a touch inside the resting ring steers from its centre;
   * a touch anywhere else in the left thumb zone moves the ring under the
   * thumb and steers from there. */
  const releaseStick = (e: React.PointerEvent) => {
    if (stickPointer.current !== e.pointerId) return;
    stickPointer.current = null;
    stickOrigin.current = null;
    move.current = { x: 0, z: 0 };
    setStick([0, 0]);
    setFloating(null);
    input();
  };
  const stickMove = (e: React.PointerEvent) => {
    const origin = stickOrigin.current;
    if (stickPointer.current !== e.pointerId || !origin) return;
    let x = (e.clientX - origin.x) / STICK_TRAVEL,
      z = -(e.clientY - origin.y) / STICK_TRAVEL;
    const length = Math.max(1, Math.hypot(x, z));
    x /= length;
    z /= length;
    move.current = { x, z };
    setStick([x, z]);
    input();
  };
  const stickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const ring = stickRing.current;
    if (stickPointer.current !== null || !ring) return;
    const r = ring.getBoundingClientRect(),
      zone = e.currentTarget.getBoundingClientRect(),
      radius = r.width / 2;
    let x = r.left + radius,
      y = r.top + radius;
    if (Math.hypot(e.clientX - x, e.clientY - y) > radius) {
      // Keep the moved ring inside the zone.
      x = Math.min(
        zone.right - radius,
        Math.max(zone.left + radius, e.clientX),
      );
      y = Math.min(
        zone.bottom - radius,
        Math.max(zone.top + radius, e.clientY),
      );
      setFloating({ x: x - zone.left, y: y - zone.top });
    }
    stickPointer.current = e.pointerId;
    stickOrigin.current = { x, y };
    ring.setPointerCapture?.(e.pointerId);
    stickMove(e);
  };
  const toggleCamera = () =>
    attempt(() =>
      play.setCameraMode(
        play.snapshot().cameraMode === "first-person"
          ? "third-person"
          : "first-person",
      ),
    );
  const toggleFly = () =>
    attempt(() =>
      play.setLocomotion(
        play.snapshot().locomotion === "walk" ? "fly-noclip" : "walk",
      ),
    );
  /** A hold-to-act round key (Jump/Up, Down) that works with several fingers. */
  const hold = (flag: React.MutableRefObject<boolean>) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      flag.current = true;
      input();
    },
    onPointerUp: () => {
      flag.current = false;
      input();
    },
    onPointerCancel: () => {
      flag.current = false;
      input();
    },
    onLostPointerCapture: () => {
      flag.current = false;
      input();
    },
  });
  const startHint = playHint && <p className="play-intro-hint">{playHint}</p>;
  const mechanismChoice = (
    <>
      {!!rigReview.unavailable.length && (
        <details>
          <summary>
            Connections need review ({rigReview.unavailable.length})
          </summary>
          {rigReview.unavailable.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
        </details>
      )}
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
          <summary>
            Mechanism physics ·{" "}
            {physics === "dynamic" ? "Dynamic" : "Kinematic"}
          </summary>
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
            Dynamic physics simulates each rigid group as one body. Loose parts
            fall and can be pushed; cars ride on sprung wheels. Simulated masses
            and forces are not real brick strength.
          </p>
        </details>
      )}
    </>
  );
  const worldSettings = (
    <PlayWorldSettings
      layers={layers}
      excluded={excludedLayerIds}
      ground={ground}
      onExcluded={setExcludedLayerIds}
      onGround={setGround}
    />
  );
  const enterPlay = (
    <>
      <button
        className="primary wide"
        disabled={state.loading}
        onClick={() => {
          wantLock.current = true;
          setLooked(false);
          if (isPlayPhone()) {
            enterPlayScreen();
            setRotateAsk(isPortrait() && !portraitWasChosen());
          }
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
    </>
  );
  const keySettings = (
    <PlayKeySettings
      value={bindings}
      onChange={changeBindings}
      look={look}
      onLookChange={changeLook}
    />
  );
  if (!state.active)
    return (
      <>
        {!setupOpen && (
          <div className="play-entry">
            <div>
              <strong>Ready to explore?</strong>
              <p>Walk around at minifigure scale.</p>
            </div>
            <div className="play-entry-actions">
              {enterPlay}
              <button
                className="play-entry-settings"
                aria-label="Play settings"
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen((open) => !open)}
              >
                <Icon name="inspector" size={20} />
              </button>
            </div>
          </div>
        )}
        {settingsOpen && (
          <ModeMenu
            menu="Play"
            label="Play"
            className="mode-card play-intro"
            sections={{
              hint: startHint,
              mechanisms: (
                <>
                  {!setupOpen && mechanismChoice}
                  {editor && !setupOpen && (
                    <button className="wide" onClick={() => setSetupOpen(true)}>
                      Set up a mechanism
                    </button>
                  )}
                  {editor && setupOpen && (
                    <PlayMechanismSetup
                      editor={editor}
                      play={play}
                      review={mechanismReview}
                      onReview={setMechanismReview}
                      onClose={() => setSetupOpen(false)}
                      selection={selection}
                      playRequest={{
                        ground,
                        worldProfile: {
                          excludedLayerIds: excludedLayerIds.filter(
                            (id) => !!layers[id],
                          ),
                        },
                      }}
                    />
                  )}
                  {!setupOpen && children}
                </>
              ),
              world: worldSettings,
              keys: keySettings,
            }}
          />
        )}
      </>
    );
  const report = state.report!;
  const occupied = report.occupancy;
  const mechanisms =
    report.mechanisms ??
    (report.mechanism ? { [report.mechanism.rigId]: report.mechanism } : {});
  const activeRigs = Object.values(rigs).filter(
    (rig) =>
      !!mechanisms[rig.id] &&
      (independentRigIds.has(rig.id) ||
        Object.keys(mechanisms[rig.id].grippers ?? {}).length > 0 ||
        (rig.vehicle &&
          mechanisms[rig.id].vehicleCollision?.supported !== false)),
  );
  const nearbyRigId = state.interaction?.rigId;
  const activeRigId = activeRigs.some((rig) => rig.id === remoteRigId)
    ? remoteRigId
    : nearbyRigId && activeRigs.some((rig) => rig.id === nearbyRigId)
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

  const walking = report.locomotion === "walk";
  const firstPerson =
    !state.mechanismOverview && report.cameraMode === "first-person";
  const inVehicle = !!(state.vehicleControl || occupied);
  const status: { icon: IconName; text: string } = state.mechanismOverview
    ? { icon: "hand", text: "Controlling mechanism" }
    : occupied
      ? {
          icon: "wheel",
          text: "Driving · " + (rigs[occupied.rigId]?.name ?? "driver seat"),
        }
      : state.vehicleControl
        ? { icon: "wheel", text: "Controlling vehicle · on foot" }
        : report.trains?.riding
          ? {
              icon: "train",
              text:
                "Riding · " +
                (report.trains.trains.find(
                  (t) => t.id === report.trains!.riding,
                )?.name ?? "train"),
            }
          : walking
            ? { icon: "play", text: "Walking" }
            : { icon: "fly", text: "Flying · through walls" };
  const interactIcon: IconName =
    state.vehicleControl || state.interaction?.kind === "vehicle"
      ? "wheel"
      : state.interaction?.kind === "points"
        ? "points"
        : state.interaction?.kind === "train"
          ? "train"
          : /door/i.test(state.interaction?.label ?? "")
            ? "door"
            : "hand";
  const trains = report.trains?.trains.length ? report.trains : undefined;
  const riding = !!report.trains?.riding;
  const showTrains = !!trains && !state.paused && !inVehicle && !remoteOpen;
  const keyHint = (key: string) =>
    finePointer && key ? <kbd aria-hidden="true">{key}</kbd> : null;
  // Offer the build controls only when a usable mechanism is active.
  const canRemote =
    !inVehicle &&
    !riding &&
    !!activeRigId &&
    !!rigs[activeRigId] &&
    !!mechanisms[activeRigId];
  const remoteTitle =
    activeRigs.length > 1
      ? "Remote controls"
      : `${rigs[activeRigId ?? ""]?.name ?? "Mechanism"} controls`;
  // The contextual action shows only when there is something to do here
  // (or a nearby reason why not): never a greyed "move closer" prompt.
  const showPrompt =
    !state.paused &&
    (!remoteOpen || inVehicle) &&
    (inVehicle || riding || promptVisible(state.interaction));

  return (
    <div
      className={
        "play-overlay" +
        (state.paused ? " is-paused" : "") +
        (occupied ? " is-seated" : "") +
        (showTrains ? " has-train" : "") +
        (showTrains && (trainOpen || riding) ? " has-train-open" : "") +
        (inVehicle ? " is-vehicle" : "") +
        (riding ? " is-riding" : "") +
        (finePointer ? " has-mouse" : "") +
        (locked ? " is-locked" : "")
      }
    >
      <div
        ref={lookLayer}
        className="play-look"
        aria-label={
          finePointer
            ? "Click to look around with the mouse"
            : "Drag to look around"
        }
        onPointerDown={(e) => {
          const first = lookPointer.current;
          if (
            !state.paused &&
            first &&
            !pinch.current &&
            e.pointerType === "touch"
          ) {
            e.currentTarget.setPointerCapture(e.pointerId);
            pinch.current = {
              id: e.pointerId,
              x: e.clientX,
              y: e.clientY,
              spread: Math.hypot(e.clientX - first.x, e.clientY - first.y),
            };
            return;
          }
          if (state.paused || lookPointer.current) return;
          setLooked(true);
          // Desktop: a click captures the mouse; dragging still works if the
          // browser refuses pointer lock.
          if (e.pointerType === "mouse") requestLock();
          e.currentTarget.setPointerCapture(e.pointerId);
          lookPointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          const p = lookPointer.current,
            two = pinch.current;
          if (p && two && (p.id === e.pointerId || two.id === e.pointerId)) {
            const moved = p.id === e.pointerId ? p : two;
            moved.x = e.clientX;
            moved.y = e.clientY;
            const spread = Math.hypot(p.x - two.x, p.y - two.y);
            play.zoom(pinchZoomFactor(two.spread, spread));
            two.spread = spread;
            return;
          }
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
        onPointerUp={(e) => endPointer(e.pointerId)}
        onPointerCancel={() => {
          lookPointer.current = null;
          pinch.current = null;
          play.clearInput();
        }}
        onLostPointerCapture={(e) => endPointer(e.pointerId)}
      />
      {firstPerson && <span className="play-crosshair" aria-hidden="true" />}
      <div ref={topRow} className="play-top">
        <div className="play-status-slab">
          <button
            className="play-key play-menu-key"
            aria-label={state.paused ? "Resume" : "Pause"}
            title={state.paused ? "Resume" : "Pause and menu"}
            onClick={() => {
              clear();
              play.pause(!state.paused);
            }}
          >
            <Icon name={state.paused ? "resume" : "pause"} />
          </button>
          <span className="play-status">
            <Icon name={status.icon} size={16} />
            <span>{status.text}</span>
          </span>
          {canRemote && !remoteOpen && !state.paused && (
            <button
              className="play-key play-controls-key"
              type="button"
              aria-label="Open mechanism controls"
              onClick={() => {
                clear();
                play.focusMechanism(activeRigId!);
                document.exitPointerLock?.();
                setRemoteRigId(activeRigId!);
                setRemoteOpen(true);
              }}
            >
              <Icon name="sliders" size={18} />
              <span>Controls</span>
            </button>
          )}
        </div>
      </div>
      {canRemote && remoteOpen && (
        <PlayMechanismControls
          play={play}
          rig={rigs[activeRigId!]}
          report={mechanisms[activeRigId!]}
          choices={activeRigs}
          title={remoteTitle}
          paused={state.paused}
          onClose={() => {
            clear();
            setRemoteOpen(false);
          }}
          onRigChange={(id) => {
            clear();
            setRemoteRigId(id);
          }}
          onError={setMessage}
        />
      )}
      {showTrains && (
        <PlayTrainControls
          play={play}
          trains={trains!}
          onError={setMessage}
          bound={Object.values(bindings)}
          driveKeys={{
            faster: bindings.forward,
            slower: bindings.backward,
            brake: bindings.jump,
          }}
          showKeys={finePointer}
          expanded={trainOpen}
          onExpandedChange={setTrainOpen}
        />
      )}
      {state.paused ? (
        <div
          className="play-menu"
          role="dialog"
          aria-labelledby="play-menu-title"
        >
          <span className="play-menu-handle" aria-hidden="true" />
          <div className="play-menu-head">
            <h2 id="play-menu-title">Take a breather.</h2>
            <p>Movement is paused.</p>
            <p className="play-menu-state">
              <Icon name={status.icon} size={16} />
              {status.text} · {firstPerson ? "first person" : "third person"}
            </p>
          </div>
          <button
            className="primary play-resume"
            onClick={() => {
              play.pause(false);
              requestLock();
            }}
          >
            <Icon name="resume" />
            {remoteOpen
              ? "Resume controls"
              : occupied
                ? "Resume driving"
                : "Resume exploring"}
          </button>
          <div className="play-menu-grid">
            {!occupied && !remoteOpen && (
              <button
                className="play-tile"
                aria-keyshortcuts={bindings.fly || undefined}
                onClick={toggleFly}
              >
                <Icon name={walking ? "fly" : "play"} size={24} />
                <span>{walking ? "Fly through walls" : "Switch to Walk"}</span>
                {keyHint(bindings.fly)}
              </button>
            )}
            {!remoteOpen && (
              <button
                className="play-tile"
                aria-keyshortcuts={bindings.camera || undefined}
                onClick={toggleCamera}
              >
                <Icon name={firstPerson ? "play" : "eye"} size={24} />
                <span>{firstPerson ? "Third person" : "First person"}</span>
                {keyHint(bindings.camera)}
              </button>
            )}
            {!remoteOpen && (
              <button
                className="play-tile"
                disabled={!!occupied}
                onClick={() =>
                  attempt(() => {
                    play.respawn();
                    play.pause(false);
                  })
                }
              >
                <Icon name="rotate" size={24} />
                <span>Recover last safe position</span>
              </button>
            )}
            <button className="play-tile" onClick={() => attempt(bookmark)}>
              <Icon name="photo" size={24} />
              <span>Save this view to Photo</span>
            </button>
            {canRemote && (
              <button
                className="play-tile"
                onClick={() => {
                  clear();
                  setRemoteRigId(activeRigId!);
                  setRemoteOpen(!remoteOpen);
                  play.pause(false);
                }}
              >
                <Icon name="sliders" size={24} />
                <span>{remoteOpen ? "Back to exploring" : remoteTitle}</span>
              </button>
            )}
          </div>
          {inVehicle && (
            <p className="play-menu-note">
              {occupied
                ? "Seated driver: the joystick or movement keys drive and steer."
                : "The joystick or movement keys drive and steer. You stay on foot; included walls and other rigs can stop the vehicle."}
            </p>
          )}
          {!remoteOpen && <PlaySettings play={play} report={report} />}
          <PlayKeySettings
            value={bindings}
            onChange={changeBindings}
            look={look}
            onLookChange={changeLook}
          />
          <p role="status" className="play-menu-note">
            {message ||
              report.warnings
                .map((w) =>
                  w.startsWith("Session-only ground")
                    ? "A temporary floor keeps you from falling; your build is unchanged."
                    : w,
                )
                .join(" ")}
          </p>
          <button
            className="play-exit"
            onClick={() => {
              play.exit();
              exit();
            }}
          >
            <Icon name="exit" />
            Exit Play
          </button>
        </div>
      ) : (
        <>
          {finePointer && !locked && !remoteOpen && (
            <div className="play-hint play-lock-hint">
              {lockRefused
                ? "Drag to look around · Esc to pause"
                : "Click to look around · Esc to release"}
            </div>
          )}
          <div
            className="play-hint play-keys-hint"
            hidden={remoteOpen || (finePointer && !locked)}
          >
            {riding ? (
              // Driving a train: the lever and the brake.
              <>
                {bindings.forward || "—"}/{bindings.backward || "—"} speed ·{" "}
                {bindings.jump || "—"} brake ·{" "}
              </>
            ) : (
              <>
                {bindings.forward || "—"}/{bindings.left || "—"}/
                {bindings.backward || "—"}/{bindings.right || "—"}{" "}
                {occupied ? "drive" : "move"} ·{" "}
              </>
            )}
            {locked ? "mouse to look · Esc to release" : "drag to look"} ·{" "}
            {!occupied && !riding && (
              <>
                {bindings.jump || "—"} jump · {bindings.fly || "—"} fly ·{" "}
              </>
            )}
            {bindings.camera || "—"} camera · {bindings.interact || "—"}{" "}
            interact
          </div>
          {playHint && !hintDone && !remoteOpen && (
            <div className="play-start-hint" role="status">
              {playHint}
            </div>
          )}
          {!finePointer && !looked && !remoteOpen && lookHintDue && (
            <div className="play-look-hint" aria-hidden="true">
              <Icon name="hand" size={16} />
              Drag to look
            </div>
          )}
          {/* Riding a train ignores walking input: no stick or actions. */}
          {!riding && !remoteOpen && (
            <div
              className="play-stick-zone"
              onPointerDown={stickDown}
              onPointerMove={stickMove}
              onPointerUp={releaseStick}
              onPointerCancel={releaseStick}
              onLostPointerCapture={releaseStick}
            >
              <div
                ref={stickRing}
                className={
                  "play-stick" +
                  (floating ? " is-floating" : "") +
                  (floating || stick[0] || stick[1] ? " is-held" : "")
                }
                role="group"
                aria-label="Movement joystick"
                style={
                  floating ? { left: floating.x, top: floating.y } : undefined
                }
              >
                <span
                  className="play-stick-knob"
                  style={{
                    transform: `translate(${stick[0] * 34}px,${-stick[1] * 34}px)`,
                  }}
                >
                  {inVehicle ? "Drive" : "Move"}
                </span>
              </div>
            </div>
          )}
          {!inVehicle && !remoteOpen && !riding && (
            <div className="play-actions">
              <button
                className="play-round play-run"
                aria-pressed={run}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setRun((value) => !value);
                }}
                onClick={(e) => {
                  if (e.detail === 0) setRun((value) => !value);
                }}
              >
                <Icon name="run" />
                <span>Run</span>
              </button>
              {!walking && (
                <button className="play-round play-down" {...hold(down)}>
                  <Icon name="arrowDown" />
                  <span>Down</span>
                </button>
              )}
              <button className="play-round play-jump" {...hold(jump)}>
                <Icon name={walking ? "jump" : "arrowUp"} size={24} />
                <span>{walking ? "Jump" : "Up"}</span>
              </button>
            </div>
          )}
        </>
      )}
      {showPrompt && (
        <div className="play-interaction">
          {riding && !inVehicle ? (
            <button
              className="play-prompt"
              aria-keyshortcuts={bindings.interact || undefined}
              onClick={() => {
                clear();
                attempt(() => play.rideTrain({ trainId: null }));
              }}
            >
              <Icon name="exit" />
              Get off train
              {keyHint(bindings.interact)}
            </button>
          ) : occupied ? (
            <>
              {message && (
                <small className="play-note" role="status">
                  {message}
                </small>
              )}
              {nearbyReport?.blocked && (
                <small className="play-note" role="status">
                  {nearbyReport.blockedReason}
                </small>
              )}
              <button
                className="play-prompt"
                onClick={() => {
                  clear();
                  attempt(() => play.exitVehicle({}));
                }}
              >
                <Icon name="exit" />
                Get out
              </button>
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
              {!state.vehicleControl && state.interaction?.blockedReason ? (
                <small className="play-note" role="status">
                  {state.interaction.blockedReason}
                </small>
              ) : (
                nearbyReport?.blocked && (
                  <small className="play-note" role="status">
                    {nearbyReport.blockedReason}
                  </small>
                )
              )}
              {!state.vehicleControl && state.interaction?.progress && (
                <small className="play-caption">
                  {state.interaction.progress}
                </small>
              )}
              <button
                className="play-prompt"
                disabled={
                  !state.vehicleControl && !state.interaction?.available
                }
                title={
                  state.vehicleControl ? undefined : state.interaction?.name
                }
                aria-keyshortcuts={bindings.interact || undefined}
                onClick={() => {
                  clear();
                  attempt(() => play.interact());
                }}
              >
                <Icon name={interactIcon} />
                {state.vehicleControl
                  ? "Stop driving"
                  : state.interaction?.label}
                {keyHint(bindings.interact)}
              </button>
            </>
          )}
        </div>
      )}
      {message &&
        !state.paused &&
        !occupied &&
        !(seatRig && showPrompt && !state.vehicleControl && !remoteOpen) && (
          <div className="play-message" role="status">
            {message}
          </div>
        )}
      {rotateAsk && (
        <div
          className="play-rotate"
          role="dialog"
          aria-modal="true"
          aria-labelledby="play-rotate-title"
        >
          <div className="play-rotate-card">
            <svg
              className="play-rotate-art"
              viewBox="0 0 96 96"
              aria-hidden="true"
              focusable="false"
            >
              <path
                className="play-rotate-arrow"
                d="M18 44a30 30 0 0 1 22-25"
              />
              <path className="play-rotate-arrow" d="M34 14l6 5-5 6" />
              <g className="play-rotate-phone">
                <rect x="34" y="26" width="28" height="50" rx="5" />
                <path d="M44 70h8" />
              </g>
            </svg>
            <h2 id="play-rotate-title">Rotate your phone for the best view</h2>
            <p>
              Play fits best sideways: more of your build on screen, and a thumb
              on each side.
            </p>
            <button
              autoFocus
              onClick={() => {
                choosePortrait();
                setRotateAsk(false);
              }}
            >
              Play in portrait anyway
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
