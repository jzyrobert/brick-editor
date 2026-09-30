/**
 * Where the app fetches the build-script samples' LDraw text: Vite emits each
 * file as a hashed bundle asset (so the offline snapshot precaches it) and
 * this module is only loaded when one of them is opened.
 */
import townUrl from "../../fixtures/ldraw/templates/market-town.mpd?url";
import cathedralUrl from "../../fixtures/ldraw/templates/cathedral.mpd?url";
import harbourUrl from "../../fixtures/ldraw/templates/harbour.mpd?url";
import type { ScriptTemplateName } from "./script-templates";

const URLS: Record<ScriptTemplateName, string> = {
  town: townUrl,
  cathedral: cathedralUrl,
  harbour: harbourUrl,
};

export async function fetchScriptTemplateSource(name: ScriptTemplateName) {
  const res = await fetch(URLS[name]);
  if (!res.ok) throw new Error(`Could not load the ${name} sample`);
  return res.text();
}
