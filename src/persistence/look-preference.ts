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
const GRID_KEY = "brick-editor-grid-hidden";
/** Whether the editor grid overlay shows (default on). */
export function loadGridPreference(): boolean {
  try {
    return localStorage.getItem(GRID_KEY) !== "1";
  } catch {
    return true;
  }
}
export function saveGridPreference(visible: boolean) {
  try {
    if (visible) localStorage.removeItem(GRID_KEY);
    else localStorage.setItem(GRID_KEY, "1");
    return true;
  } catch {
    return false;
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
