import type { Editor } from "../core/commands";
import { ensure } from "../core/types";
import {
  effectiveResourceProfile,
  resourceLimits,
  type DeviceHints,
  type ResourcePreference,
} from "../core/resource-profile";

const KEY = "brick-editor-resource-profile";

export function deviceHints(): DeviceHints {
  const coarsePointer =
    typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  const screenShortSide =
    typeof screen === "object" && screen
      ? Math.min(screen.width, screen.height)
      : Infinity;
  const memory = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory;
  return {
    coarsePointer,
    screenShortSide,
    ...(typeof memory === "number" ? { deviceMemory: memory } : {}),
  };
}
export function loadResourcePreference(): ResourcePreference {
  try {
    const value = localStorage.getItem(KEY);
    return value === "desktop" || value === "mobile" ? value : "auto";
  } catch {
    return "auto";
  }
}
function saveResourcePreference(value: ResourcePreference) {
  try {
    if (value === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, value);
    return true;
  } catch {
    return false;
  }
}

/** Status plus the current document's cost against both profiles, for impact display. */
export function resourceStatus(editor: Editor) {
  const effective = effectiveResourceProfile(
    loadResourcePreference(),
    deviceHints(),
  );
  const leaves = editor.materialization.estimate.metrics.leafCount;
  return {
    ...effective,
    active: editor.resourceProfile,
    project: {
      occurrences: leaves,
      fitsMobile: leaves <= resourceLimits("mobile").occurrences,
      fitsDesktop: leaves <= resourceLimits("desktop").occurrences,
      availability: editor.materialization.status,
    },
  };
}

/**
 * Apply a stored or new preference. Choosing limits above what this device was
 * detected to support needs explicit acknowledgement of the resource impact; a
 * preference loaded at startup was acknowledged when it was chosen.
 */
export function applyResourcePreference(
  editor: Editor,
  preference: ResourcePreference,
  options: { acknowledgeImpact?: boolean; persist?: boolean } = {},
) {
  ensure(
    preference === "auto" ||
      preference === "desktop" ||
      preference === "mobile",
    "INVALID_INPUT",
    "Resource profile must be auto, desktop or mobile",
  );
  const effective = effectiveResourceProfile(preference, deviceHints());
  ensure(
    !effective.raisedAboveDevice || options.acknowledgeImpact === true,
    "INVALID_INPUT",
    "Desktop limits on this device can exhaust its memory; acknowledge the expected impact to continue.",
    { resource: "profile", detected: effective.detected },
  );
  editor.setResourceProfile(effective.profile);
  const saved = options.persist === false || saveResourcePreference(preference);
  return { ...resourceStatus(editor), saved };
}
