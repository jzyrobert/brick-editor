import { useEffect, useState } from "react";
import {
  defaultShortcuts,
  shortcutLabels,
  validateShortcuts,
  type ShortcutAction,
  type Shortcuts,
} from "../edit/shortcuts";
export function ShortcutSettings({
  value,
  onChange,
}: {
  value: Shortcuts;
  onChange: (value: Shortcuts) => void;
}) {
  const [draft, setDraft] = useState(value),
    [message, setMessage] = useState("");
  useEffect(() => setDraft(value), [value]);
  return (
    <details className="shortcut-settings">
      <summary>Keyboard shortcuts</summary>
      <p className="muted">
        Mod means Ctrl on Windows/Linux or Command on Mac. Use a blank field to
        disable a shortcut. Browser-reserved keys may remain unavailable.
        Editing text never triggers these commands.
      </p>
      {(Object.keys(shortcutLabels) as ShortcutAction[]).map((action) => (
        <label key={action}>
          {shortcutLabels[action]}
          <input
            aria-label={shortcutLabels[action] + " shortcut"}
            value={draft[action]}
            maxLength={50}
            onChange={(e) =>
              setDraft((s) => ({ ...s, [action]: e.target.value }))
            }
          />
        </label>
      ))}
      <button
        onClick={() => {
          try {
            onChange(validateShortcuts(draft));
            setMessage("Shortcut settings applied.");
          } catch (error) {
            setMessage(error instanceof Error ? error.message : String(error));
          }
        }}
      >
        Apply shortcuts
      </button>
      <button
        onClick={() => {
          setDraft({ ...defaultShortcuts });
          onChange({ ...defaultShortcuts });
          setMessage("Default shortcuts restored.");
        }}
      >
        Restore default shortcuts
      </button>
      <p role="status">{message}</p>
    </details>
  );
}
