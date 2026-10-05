/**
 * Where the app fetches the Air pump sample's LDraw text: a hashed bundle
 * asset (precached by the offline snapshot), loaded only when opened.
 */
import url from "../../fixtures/ldraw/templates/air-pump.mpd?url";

export async function fetchAirPumpSource() {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load the Air pump sample");
  return res.text();
}
