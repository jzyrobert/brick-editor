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
 * Train driving controls in Play: Go/Stop, a speed slider, reverse, ride
 * along, horn and the points. One tap starts the train; everything is at
 * least 44 px for fingers.
 */
export function PlayTrainControls({
  play,
  trains,
  onError,
  bound = [],
  showKeys = false,
}: {
  play: BrowserPlay;
  trains: Trains;
  onError: (message: string) => void;
  /** Keys already bound to Play actions (they keep them). */
  bound?: string[];
  /** Show the key hints (a fine pointer is present). */
  showKeys?: boolean;
}) {
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
  if (!train) return null;
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
  return (
    <section className="play-train" aria-label="Train controls">
      <div className="play-train-row">
        {trains.trains.length > 1 && (
          <button
            className="play-train-key"
            aria-label={`Next train (now ${train.name})`}
            title={train.name}
            onClick={() => setIndex((index + 1) % trains.trains.length)}
          >
            <Icon name="train" />
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
        <div className="play-train-speed">
          <input
            type="range"
            aria-label="Train speed"
            min={0.2}
            max={1}
            step={0.1}
            value={level}
            onChange={(e) => {
              const next = Number(e.target.value);
              setLevel(next);
              if (moving) drive((backwards ? -1 : 1) * next);
            }}
          />
        </div>
        <button
          className="play-train-key"
          aria-label="Reverse direction"
          aria-pressed={backwards}
          aria-keyshortcuts={TRAIN_KEYS.reverse}
          title={`Reverse (${TRAIN_KEYS.reverse})`}
          onClick={actions.reverse}
        >
          <Icon name="reverse" />
        </button>
        <button
          className="play-train-key"
          aria-label={riding ? "Stop riding along" : "Ride along"}
          aria-pressed={riding}
          aria-keyshortcuts={TRAIN_KEYS.ride}
          title={`${riding ? "Stop riding" : "Ride along"} (${TRAIN_KEYS.ride})`}
          onClick={actions.ride}
        >
          <Icon name="camera" />
        </button>
        <button
          className="play-train-key"
          aria-label="Sound the horn"
          aria-keyshortcuts={TRAIN_KEYS.horn}
          title={`Horn (${TRAIN_KEYS.horn})`}
          onClick={horn}
        >
          <Icon name="horn" />
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
              attempt(() => play.setPoints({ occurrenceId: s.occurrenceId }))
            }
          >
            <Icon name="points" />
            <span aria-hidden="true">{s.route === "straight" ? "│" : "╱"}</span>
          </button>
        ))}
      </div>
      <p className="play-train-status" role="status">
        {train.name} · {caption}
      </p>
    </section>
  );
}
