import { useEffect, useState } from "react";
import {
  defaultPlayKeys,
  playKeyLabels,
  validatePlayKeys,
  type PlayKeys,
  type PlayKeyAction,
} from "../play/keys";
export function PlayKeySettings({
  value,
  onChange,
}: {
  value: PlayKeys;
  onChange: (value: PlayKeys) => boolean;
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
  return (
    <details className="play-key-settings">
      <summary>Play keyboard controls</summary>
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
      <p role="status">{message}</p>
    </details>
  );
}
