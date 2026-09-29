import { ensure } from "../core/types";
/**
 * Desktop mouse-look preferences (saved per device). Sensitivity multiplies
 * the base rate of 0.0025 radians per mouse count (about 0.14 degrees), so
 * 1 turns a full circle in roughly 2,500 counts. Touch drag-to-look keeps its
 * own fixed rate.
 */
export type PlayLookSettings = { sensitivity: number; invertY: boolean };
export const PLAY_LOOK_DEFAULTS: Readonly<PlayLookSettings> = Object.freeze({
  sensitivity: 1,
  invertY: false,
});
export const PLAY_LOOK_LIMITS = Object.freeze({ min: 0.1, max: 5 });
export const MOUSE_RADIANS_PER_COUNT = 0.0025;
export function validatePlayLook(input: unknown): PlayLookSettings {
  ensure(
    input && typeof input === "object" && !Array.isArray(input),
    "INVALID_INPUT",
    "Invalid mouse look settings",
  );
  const value = input as Record<string, unknown>;
  ensure(
    Object.keys(value).every((k) => k === "sensitivity" || k === "invertY"),
    "INVALID_INPUT",
    "Unknown mouse look setting",
  );
  const sensitivity = value.sensitivity ?? PLAY_LOOK_DEFAULTS.sensitivity;
  ensure(
    typeof sensitivity === "number" &&
      Number.isFinite(sensitivity) &&
      sensitivity >= PLAY_LOOK_LIMITS.min &&
      sensitivity <= PLAY_LOOK_LIMITS.max,
    "INVALID_INPUT",
    `Mouse sensitivity must be between ${PLAY_LOOK_LIMITS.min} and ${PLAY_LOOK_LIMITS.max}`,
  );
  const invertY = value.invertY ?? PLAY_LOOK_DEFAULTS.invertY;
  ensure(
    typeof invertY === "boolean",
    "INVALID_INPUT",
    "Invert mouse Y must be true or false",
  );
  return { sensitivity, invertY };
}
/** Radians per mouse count for these settings. */
export function mouseLookRate(settings: PlayLookSettings) {
  return MOUSE_RADIANS_PER_COUNT * settings.sensitivity;
}
const storageKey = "brick-editor-play-look-v1";
export function loadPlayLook(): PlayLookSettings {
  try {
    return validatePlayLook(
      JSON.parse(localStorage.getItem(storageKey) || "{}"),
    );
  } catch {
    return { ...PLAY_LOOK_DEFAULTS };
  }
}
export function savePlayLook(settings: PlayLookSettings) {
  const checked = validatePlayLook(settings);
  try {
    localStorage.setItem(storageKey, JSON.stringify(checked));
    return true;
  } catch {
    return false;
  }
}
