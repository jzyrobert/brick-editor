import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import type { BrowserPlay } from "../play/browser";
import type { PlaySnapshotReport } from "../play/types";

type Trains = NonNullable<PlaySnapshotReport["trains"]>;

/** A short two-tone horn from WebAudio (no sound files). */
function horn() {
  try {
    const Context =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Context) return;
    const audio = new Context();
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, audio.currentTime + 0.04);
    gain.gain.setValueAtTime(0.12, audio.currentTime + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.7);
    gain.connect(audio.destination);
    for (const hz of [311, 370]) {
      const tone = audio.createOscillator();
      tone.type = "sawtooth";
      tone.frequency.value = hz;
      tone.connect(gain);
      tone.start();
      tone.stop(audio.currentTime + 0.72);
    }
    setTimeout(() => void audio.close(), 900);
  } catch {
    /* Sound is a nicety; the train runs without it. */
  }
}

const STATUS: Record<Trains["trains"][number]["status"], string> = {
  stopped: "Stopped",
  running: "Running",
  "end-of-track": "End of the track",
  blocked: "Blocked",
  waiting: "Waiting",
};

/**
 * Keys for the train on a desktop (the mouse is captured for look while
 * playing): G go/stop, R reverse, C ride along, H horn, P the first points.
 * A key the player has bound to another Play action keeps that action.
 */
export const TRAIN_KEYS = {
  go: "G",
  reverse: "R",
  ride: "C",
  horn: "H",
  points: "P",
} as const;

/**
 * Train driving controls in Play. At rest they are one chip: the train's
 * status and Go/Stop, so one tap starts the train. The chip opens a drawer
 * with the less-used controls (reverse, speed, ride along, horn, points,
 * next train), which stays open while riding. Everything is at least 44 px.
 */
export function PlayTrainControls({
  play,
  trains,
  onError,
  bound = [],
  driveKeys,
  showKeys = false,
  expanded,
  onExpandedChange,
}: {
  play: BrowserPlay;
  trains: Trains;
  onError: (message: string) => void;
  /** Keys already bound to Play actions (they keep them). */
  bound?: string[];
  /**
   * The Play keys that drive a ridden train (forward/backward work the
   * lever, jump brakes), shown on a desktop while riding.
   */
  driveKeys?: { faster: string; slower: string; brake: string };
  /** Show the key hints (a fine pointer is present). */
  showKeys?: boolean;
  /** The drawer of less-used controls is open (kept across a pause). */
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
}) {
  const setExpanded = onExpandedChange;
  const [index, setIndex] = useState(0);
  const [level, setLevel] = useState(0.6);
  const [backwards, setBackwards] = useState(false);
  const train = trains.trains[Math.min(index, trains.trains.length - 1)];
  const attempt = (fn: () => unknown) => {
    try {
      fn();
      onError("");
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };
  const moving = !!train && train.throttle !== 0;
  const drive = (throttle: number) =>
    train &&
    attempt(() => play.setTrainThrottle({ trainId: train.id, throttle }));
  const riding = !!train && trains.riding === train.id;
  const actions = {
    go: () => drive(moving ? 0 : (backwards ? -1 : 1) * level),
    reverse: () => {
      const next = !backwards;
      setBackwards(next);
      if (moving) drive((next ? -1 : 1) * level);
    },
    ride: () =>
      train &&
      attempt(() => play.rideTrain({ trainId: riding ? null : train.id })),
    horn,
    points: () => {
      const s = trains.switches[0];
      if (s) attempt(() => play.setPoints({ occurrenceId: s.occurrenceId }));
    },
  };
  const latest = useRef(actions);
  latest.current = actions;
  const boundKeys = bound.map((k) => k.toUpperCase()).join(",");
  useEffect(() => {
    const taken = new Set(boundKeys.split(","));
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      const action = (
        Object.keys(TRAIN_KEYS) as Array<keyof typeof TRAIN_KEYS>
      ).find((a) => TRAIN_KEYS[a] === key);
      if (!action || taken.has(key)) return;
      e.preventDefault();
      latest.current[action]();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [boundKeys]);
  // The slider and Reverse follow the train's throttle, however it was set
  // (the driver's keys move it while riding).
  const throttle = train?.throttle ?? 0;
  useEffect(() => {
    if (throttle === 0) return;
    setLevel(
      Math.max(0.2, Math.min(1, Math.round(Math.abs(throttle) * 20) / 20)),
    );
    setBackwards(throttle < 0);
  }, [throttle]);
  // Riding a train shows that train's controls.
  useEffect(() => {
    if (trains.riding) {
      const ridden = trains.trains.findIndex((t) => t.id === trains.riding);
      if (ridden >= 0) setIndex(ridden);
    }
  }, [trains.riding]);
  if (!train) return null;
  const open = expanded || riding;
  const key = (action: keyof typeof TRAIN_KEYS) =>
    showKeys && !bound.some((k) => k.toUpperCase() === TRAIN_KEYS[action]) ? (
      <kbd aria-hidden="true">{TRAIN_KEYS[action]}</kbd>
    ) : null;
  const speedStuds = Math.round(Math.abs(train.speed) / 20);
  const caption =
    train.reason ??
    (train.status === "running"
      ? `${STATUS.running} · ${speedStuds} studs/s${train.speed < 0 ? " backwards" : ""}`
      : STATUS[train.status]);
  const summary = (
    <>
      <Icon name="train" size={16} />
      <span className="play-train-status" role="status">
        {train.name} · {caption}
      </span>
    </>
  );
  return (
    <section
      className={"play-train" + (open ? " is-open" : "")}
      aria-label="Train controls"
    >
      <div className="play-train-row">
        {riding ? (
          // Riding: the driver's controls stay open; the ride ends from the
          // contextual action (Get off) or C.
          <div className="play-train-chip">{summary}</div>
        ) : (
          <button
            className="play-train-chip"
            aria-expanded={open}
            aria-controls="play-train-drawer"
            title={open ? "Fewer train controls" : "More train controls"}
            onClick={() => setExpanded(!expanded)}
          >
            {summary}
            <i className="play-train-chevron" aria-hidden="true" />
          </button>
        )}
        <button
          className={"play-train-go" + (moving ? " is-running" : "")}
          aria-label={moving ? "Stop the train" : "Start the train"}
          aria-keyshortcuts={TRAIN_KEYS.go}
          onClick={actions.go}
        >
          <Icon name={moving ? "stop" : "resume"} />
          <span>{moving ? "Stop" : "Go"}</span>
          {key("go")}
        </button>
      </div>
      {open && (
        <div className="play-train-drawer" id="play-train-drawer">
          {/* Direction and speed, then the labelled extras. */}
          <div className="play-train-row play-train-drive">
            <button
              className="play-train-key"
              aria-label="Reverse direction"
              aria-pressed={backwards}
              aria-keyshortcuts={TRAIN_KEYS.reverse}
              title={`Reverse (${TRAIN_KEYS.reverse})`}
              onClick={actions.reverse}
            >
              <Icon name="reverse" />
              <span>Reverse</span>
              {key("reverse")}
            </button>
            <div className="play-train-speed">
              <input
                type="range"
                aria-label="Train speed"
                min={0.2}
                max={1}
                step={0.05}
                value={level}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setLevel(next);
                  if (moving) drive((backwards ? -1 : 1) * next);
                }}
              />
            </div>
          </div>
          {riding && showKeys && driveKeys && (
            <p className="play-train-drive-keys">
              <kbd>{driveKeys.faster || "—"}</kbd> faster ·{" "}
              <kbd>{driveKeys.slower || "—"}</kbd> slower, then reverse ·{" "}
              <kbd>{driveKeys.brake || "—"}</kbd> brake
            </p>
          )}
          <div className="play-train-row play-train-extras">
            {!riding && (
              <button
                className="play-train-key"
                aria-label="Ride along"
                aria-keyshortcuts={TRAIN_KEYS.ride}
                title={`Ride along (${TRAIN_KEYS.ride})`}
                onClick={actions.ride}
              >
                <Icon name="seat" />
                <span>Ride along</span>
                {key("ride")}
              </button>
            )}
            <button
              className="play-train-key"
              aria-label="Sound the horn"
              aria-keyshortcuts={TRAIN_KEYS.horn}
              title={`Horn (${TRAIN_KEYS.horn})`}
              onClick={horn}
            >
              <Icon name="horn" />
              <span>Horn</span>
              {key("horn")}
            </button>
            {trains.switches.slice(0, 2).map((s, i) => (
              <button
                key={s.occurrenceId}
                className="play-train-key play-train-points"
                aria-label={`Points ${trains.switches.length > 1 ? i + 1 + " " : ""}set to ${s.route}; switch to ${s.route === "straight" ? "branch" : "straight"}`}
                aria-keyshortcuts={i === 0 ? TRAIN_KEYS.points : undefined}
                title={
                  s.occupied
                    ? "A train is on these points"
                    : `Switch points${i === 0 ? ` (${TRAIN_KEYS.points})` : ""}`
                }
                disabled={s.occupied}
                onClick={() =>
                  attempt(() =>
                    play.setPoints({ occurrenceId: s.occurrenceId }),
                  )
                }
              >
                <Icon name="points" />
                <span>
                  {s.route === "straight"
                    ? "Points: straight"
                    : "Points: branch"}
                </span>
                {i === 0 && key("points")}
              </button>
            ))}
            {trains.trains.length > 1 && (
              <button
                className="play-train-key"
                aria-label={`Next train (now ${train.name})`}
                title={train.name}
                onClick={() => setIndex((index + 1) % trains.trains.length)}
              >
                <Icon name="train" />
                <span>Next train</span>
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
