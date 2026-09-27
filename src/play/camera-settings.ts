import { ensure } from "../core/types";
import {
  PLAY_CAMERA_DEFAULTS,
  PLAY_CAMERA_LIMITS,
  type PlayCameraSettings,
} from "./types";
export function resolvePlayCameraSettings(
  input: Partial<PlayCameraSettings> = {},
  previous: PlayCameraSettings = PLAY_CAMERA_DEFAULTS,
): PlayCameraSettings {
  ensure(
    input && typeof input === "object" && !Array.isArray(input),
    "INVALID_INPUT",
    "Camera settings must be an object",
  );
  const result = { ...previous };
  for (const [name, value] of Object.entries(input)) {
    ensure(
      Object.hasOwn(PLAY_CAMERA_LIMITS, name),
      "INVALID_INPUT",
      "Unknown Play camera setting: " + name,
    );
    const key = name as keyof PlayCameraSettings,
      range = PLAY_CAMERA_LIMITS[key];
    ensure(
      typeof value === "number" &&
        Number.isFinite(value) &&
        value >= range.min &&
        value <= range.max,
      "INVALID_INPUT",
      `${name} must be between ${range.min} and ${range.max}`,
    );
    result[key] = value;
  }
  ensure(
    result.minPitch < result.maxPitch,
    "INVALID_INPUT",
    "Minimum pitch must be less than maximum pitch",
  );
  return result;
}
/** A sphere around the camera encloses all four near-plane corners. Cap the
 * effective near plane at very wide aspects so the volume fits actor clearance. */
export function playCameraSafety(
  settings: PlayCameraSettings,
  aspectRatio: number,
) {
  ensure(
    Number.isFinite(aspectRatio) && aspectRatio > 0 && aspectRatio <= 100000,
    "INVALID_INPUT",
    "Camera aspect ratio must be positive and bounded",
  );
  const tangent = Math.tan((settings.fovDeg * Math.PI) / 360);
  const factor = Math.sqrt(
    1 + tangent * tangent * (1 + aspectRatio * aspectRatio),
  );
  const effectiveNear = Math.min(settings.near, 7.5 / factor);
  return {
    aspectRatio,
    effectiveNear,
    collisionRadius: Math.max(4, effectiveNear * factor),
  };
}
