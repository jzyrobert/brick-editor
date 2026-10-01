import { useEffect, useState } from "react";
import {
  defaultPlayKeys,
  playKeyLabels,
  validatePlayKeys,
  type PlayKeys,
  type PlayKeyAction,
} from "../play/keys";
import {
  PLAY_LOOK_LIMITS,
  validatePlayLook,
  type PlayLookSettings,
} from "../play/look-settings";
export function PlayKeySettings({
  value,
  onChange,
  look,
  onLookChange,
}: {
  value: PlayKeys;
  onChange: (value: PlayKeys) => boolean;
  look?: PlayLookSettings;
  onLookChange?: (value: PlayLookSettings) => boolean;
}) {
  const [draft, setDraft] = useState(value),
    [message, setMessage] = useState("");
  useEffect(() => setDraft(value), [value]);
  const apply = (keys: PlayKeys) => {
    try {
      const checked = validatePlayKeys(keys);
      setMessage(
        onChange(checked)
          ? "Play keys saved on this device."
          : "Play keys applied for this session; browser storage is unavailable.",
      );
      setDraft(checked);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };
  const changeLook = (patch: Partial<PlayLookSettings>) => {
    if (!look || !onLookChange) return;
    try {
      const checked = validatePlayLook({ ...look, ...patch });
      setMessage(
        onLookChange(checked)
          ? "Mouse look saved on this device."
          : "Mouse look applied for this session; browser storage is unavailable.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <details className="play-key-settings">
      <summary>Play keyboard and mouse controls</summary>
      <p>
        Use single keys, such as W or ArrowUp. Blank disables a key binding.
        Escape always pauses. Touch controls stay available. Browser and system
        shortcuts may take priority.
      </p>
      {(Object.keys(playKeyLabels) as PlayKeyAction[]).map((action) => (
        <label key={action}>
          {playKeyLabels[action]}
          <input
            aria-label={playKeyLabels[action] + " Play key"}
            value={draft[action]}
            maxLength={20}
            onChange={(e) => setDraft({ ...draft, [action]: e.target.value })}
          />
        </label>
      ))}
      <div className="play-key-buttons">
        <button onClick={() => apply(draft)}>Apply Play keys</button>
        <button onClick={() => apply({ ...defaultPlayKeys })}>
          Restore Play keys
        </button>
      </div>
      {look && onLookChange && (
        <fieldset className="play-look-settings">
          <legend>Mouse look</legend>
          <p>
            On a computer, click the view to look with the mouse. Press Escape
            to release the pointer. Scroll or pinch to zoom the third-person
            camera; zoom all the way in for first person.
          </p>
          <label>
            Mouse sensitivity · {look.sensitivity.toFixed(1)}×
            <input
              type="range"
              aria-label="Mouse sensitivity"
              min={PLAY_LOOK_LIMITS.min}
              max={PLAY_LOOK_LIMITS.max}
              step={0.1}
              value={look.sensitivity}
              onChange={(e) =>
                changeLook({ sensitivity: Number(e.target.value) })
              }
            />
          </label>
          <label className="play-look-invert">
            <input
              type="checkbox"
              checked={look.invertY}
              onChange={(e) => changeLook({ invertY: e.target.checked })}
            />
            Invert mouse up and down
          </label>
        </fieldset>
      )}
      <p role="status">{message}</p>
    </details>
  );
}
