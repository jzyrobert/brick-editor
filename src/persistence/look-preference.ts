import { isLookName, type LookName } from "../render/look";

const KEY = "brick-editor-render-look";

/** The viewer's chosen render look; storage may be unavailable (private mode). */
export function loadLookPreference(): LookName {
  try {
    const value = localStorage.getItem(KEY);
    return isLookName(value) ? value : "standard";
  } catch {
    return "standard";
  }
}
export function saveLookPreference(value: LookName) {
  try {
    if (value === "standard") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, value);
    return true;
  } catch {
    return false;
  }
}
