import { ensure } from "../core/types";
export const defaultShortcuts = {
  select: "V",
  place: "B",
  paint: "C",
  move: "G",
  rotate: "R",
  focus: "F",
  remove: "Delete",
  undo: "Mod+Z",
  redo: "Mod+Shift+Z",
  copy: "Mod+C",
  cut: "Mod+X",
  paste: "Mod+V",
  duplicate: "Mod+D",
  cancel: "Escape",
} as const;
export type ShortcutAction = keyof typeof defaultShortcuts;
export type Shortcuts = Record<ShortcutAction, string>;
export const shortcutLabels: Record<ShortcutAction, string> = {
  select: "Select tool",
  place: "Place tool",
  paint: "Paint tool",
  move: "Move handles",
  rotate: "Rotate handles",
  focus: "Fit build",
  remove: "Delete selection",
  undo: "Undo",
  redo: "Redo",
  copy: "Copy selection",
  cut: "Cut selection",
  paste: "Paste in place",
  duplicate: "Duplicate selection",
  cancel: "Cancel",
};
export function normalizeShortcut(value: string) {
  if (!value.trim()) return "";
  const tokens = value
      .trim()
      .split("+")
      .map((s) => s.trim()),
    key = tokens.pop()!;
  const aliases: Record<string, string> = {
    ctrl: "Mod",
    cmd: "Mod",
    meta: "Mod",
    mod: "Mod",
    alt: "Alt",
    shift: "Shift",
  };
  const modifiers = tokens.map((t) => aliases[t.toLowerCase()]);
  ensure(
    modifiers.every(Boolean) && new Set(modifiers).size === modifiers.length,
    "INVALID_INPUT",
    "Use each of Mod, Alt and Shift at most once",
  );
  const named = [
    "Delete",
    "Backspace",
    "Escape",
    "Space",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
  ];
  const normalized = /^[a-z0-9]$/i.test(key)
    ? key.toUpperCase()
    : named.find((n) => n.toLowerCase() === key.toLowerCase());
  ensure(
    normalized,
    "INVALID_INPUT",
    "Use a letter, digit, Delete, Backspace, Escape, Space or arrow key",
  );
  return [
    ...["Mod", "Alt", "Shift"].filter((m) => modifiers.includes(m)),
    normalized,
  ].join("+");
}
export function validateShortcuts(input: unknown): Shortcuts {
  ensure(
    input && typeof input === "object" && !Array.isArray(input),
    "INVALID_INPUT",
    "Invalid shortcut settings",
  );
  const value = input as Record<string, unknown>,
    result = {} as Shortcuts,
    used = new Set<string>();
  ensure(
    Object.keys(value).length === Object.keys(defaultShortcuts).length,
    "INVALID_INPUT",
    "Shortcut settings must name each action",
  );
  for (const action of Object.keys(defaultShortcuts) as ShortcutAction[]) {
    ensure(
      typeof value[action] === "string" &&
        (value[action] as string).length <= 50,
      "INVALID_INPUT",
      "Invalid shortcut for " + shortcutLabels[action],
    );
    const binding = normalizeShortcut(value[action] as string);
    ensure(
      !binding || !used.has(binding),
      "INVALID_INPUT",
      "Shortcut already assigned: " + binding,
    );
    if (binding) used.add(binding);
    result[action] = binding;
  }
  return result;
}
const key = "brick-editor-shortcuts-v1";
export function loadShortcuts(): Shortcuts {
  try {
    return validateShortcuts(JSON.parse(localStorage.getItem(key) || "null"));
  } catch {
    return { ...defaultShortcuts };
  }
}
export function saveShortcuts(input: Shortcuts) {
  const value = validateShortcuts(input);
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function shortcutAction(
  event: Pick<
    KeyboardEvent,
    "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
  >,
  bindings: Shortcuts,
): ShortcutAction | undefined {
  const key = event.key === " " ? "Space" : event.key;
  let chord: string;
  try {
    chord = normalizeShortcut(
      [
        event.ctrlKey || event.metaKey ? "Mod" : "",
        event.altKey ? "Alt" : "",
        event.shiftKey ? "Shift" : "",
        key,
      ]
        .filter(Boolean)
        .join("+"),
    );
  } catch {
    return;
  }
  return (Object.keys(bindings) as ShortcutAction[]).find(
    (action) => bindings[action] && bindings[action] === chord,
  );
}
