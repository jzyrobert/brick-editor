import { ensure } from "../core/types";
export const defaultPlayKeys = {
  forward: "W",
  backward: "S",
  left: "A",
  right: "D",
  run: "Shift",
  jump: "Space",
  down: "Control",
  fly: "F",
  camera: "V",
} as const;
export type PlayKeyAction = keyof typeof defaultPlayKeys;
export type PlayKeys = Record<PlayKeyAction, string>;
export const playKeyLabels: Record<PlayKeyAction, string> = {
  forward: "Move forward",
  backward: "Move backward",
  left: "Move left",
  right: "Move right",
  run: "Hold to run",
  jump: "Jump / fly up",
  down: "Fly down",
  fly: "Switch walk / fly",
  camera: "Switch camera",
};
const named = [
  "Space",
  "Shift",
  "Control",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Enter",
];
export function normalizePlayKey(value: string) {
  const key = value.trim();
  if (!key) return "";
  const normalized = /^[a-z0-9]$/i.test(key)
    ? key.toUpperCase()
    : named.find((n) => n.toLowerCase() === key.toLowerCase());
  ensure(
    normalized,
    "INVALID_INPUT",
    "Use a single letter, digit, arrow key, Space, Shift, Control or Enter. Escape always pauses.",
  );
  return normalized;
}
export function validatePlayKeys(input: unknown): PlayKeys {
  ensure(
    input && typeof input === "object" && !Array.isArray(input),
    "INVALID_INPUT",
    "Invalid Play key settings",
  );
  const value = input as Record<string, unknown>,
    result = {} as PlayKeys,
    seen = new Set<string>();
  ensure(
    Object.keys(value).length === Object.keys(defaultPlayKeys).length,
    "INVALID_INPUT",
    "Play key settings must name each action",
  );
  for (const action of Object.keys(defaultPlayKeys) as PlayKeyAction[]) {
    ensure(
      typeof value[action] === "string" && value[action].length <= 20,
      "INVALID_INPUT",
      "Invalid Play key for " + playKeyLabels[action],
    );
    const key = normalizePlayKey(value[action]);
    ensure(
      !key || !seen.has(key),
      "INVALID_INPUT",
      "Play key already assigned: " + key,
    );
    if (key) seen.add(key);
    result[action] = key;
  }
  return result;
}
export function playKeyAction(
  key: string,
  bindings: PlayKeys,
): PlayKeyAction | undefined {
  let normalized: string;
  try {
    normalized = normalizePlayKey(key === " " ? "Space" : key);
  } catch {
    return;
  }
  return (Object.keys(bindings) as PlayKeyAction[]).find(
    (a) => bindings[a] && bindings[a] === normalized,
  );
}
const storageKey = "brick-editor-play-keys-v1";
export function loadPlayKeys(): PlayKeys {
  try {
    return validatePlayKeys(
      JSON.parse(localStorage.getItem(storageKey) || "null"),
    );
  } catch {
    return { ...defaultPlayKeys };
  }
}
export function savePlayKeys(keys: PlayKeys) {
  const checked = validatePlayKeys(keys);
  try {
    localStorage.setItem(storageKey, JSON.stringify(checked));
    return true;
  } catch {
    return false;
  }
}
