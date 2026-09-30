// "Snap together" building (Place and Move accept only parts that connect):
// a per-device tool setting, on unless this device turned it off.
const KEY = "brick-editor-snap-together";

export function loadConnectedPreference(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}
export function saveConnectedPreference(on: boolean) {
  try {
    if (on) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, "off");
    return true;
  } catch {
    return false;
  }
}
