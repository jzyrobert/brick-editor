/**
 * Colour names for build scripts and part search: the picker palette's names
 * (src/catalog/colors.json), common LDraw/BrickLink names as aliases, and
 * LDraw codes. Resolution is case-, space- and punctuation-insensitive.
 */
import {
  paletteColors,
  type PaletteColor,
} from "../catalog/color-availability";

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/gray/g, "grey")
    .replace(/[^a-z0-9]/g, "");

/** Well-known names that differ from the picker palette's. */
const ALIASES: Record<string, string> = {
  lightbluishgrey: "71",
  bluishgrey: "71",
  lbg: "71",
  grey: "71",
  mediumstonegrey: "71",
  darkbluishgrey: "72",
  dbg: "72",
  darkstonegrey: "72",
  transclear: "47",
  glass: "47",
  transparent: "47",
  brightred: "4",
  brightblue: "1",
  brightyellow: "14",
  brightorange: "25",
  reddishbrown: "70",
  brown: "70",
  darkbrown: "308",
  brickyellow: "19",
  beige: "19",
  sand: "19",
  earthblue: "272",
  navy: "272",
  earthgreen: "288",
  sandgreen: "378",
  sandblue: "379",
  terracotta: "366",
  translightblue: "43",
  water: "43",
  transdarkblue: "33",
  transred: "36",
  transyellow: "46",
  transorange: "57",
  transgreen: "34",
  transblack: "40",
  silver: "315",
  gold: "297",
  pearlgold: "297",
  flatsilver: "315",
};

let byName: Map<string, PaletteColor> | undefined;
const byCode = new Map<string, PaletteColor>();
function tables() {
  if (!byName) {
    byName = new Map();
    for (const c of paletteColors) {
      byName.set(norm(c.name), c);
      byCode.set(c.code, c);
    }
  }
  return byName;
}
/** Palette entry of an LDraw code (undefined for codes outside the picker). */
export const colourByCode = (code: string) => (tables(), byCode.get(code));
export const colourName = (code: string) =>
  colourByCode(code)?.name ?? "LDraw colour " + code;

/** Picker names that differ from the names the build prompt's Colours
 * section uses (BrickLink's); agents see one name for each colour. */
const AGENT_NAMES: Record<string, string> = {
  "71": "light bluish grey",
  "72": "dark bluish grey",
  "47": "trans-clear",
};
/** A colour as build agents see it in the part list, search results and
 * colour errors: the prompt's lower-case names, which the compiler accepts. */
export const agentColourName = (code: string) =>
  AGENT_NAMES[code] ??
  (colourByCode(code) ? colourName(code).toLowerCase() : colourName(code));

/** The colours most builds use, in the order agents see them (the prompt's
 * part list and colour error hints). */
export const COMMON_COLOURS = [
  "15",
  "0",
  "4",
  "1",
  "14",
  "2",
  "288",
  "19",
  "28",
  "70",
  "308",
  "71",
  "72",
  "320",
  "25",
  "322",
  "272",
  "27",
  "378",
  "297",
  "47",
  "43",
  "36",
  "46",
];

/** LDraw colour code for a name or code; undefined when unknown. */
export function resolveColourName(value: string | number): string | undefined {
  const names = tables();
  if (typeof value === "number")
    return Number.isInteger(value) && value >= 0 ? String(value) : undefined;
  const t = value.trim();
  if (/^\d+$/.test(t)) return t;
  if (/^0x2[0-9a-f]{6}$/i.test(t)) return t;
  const n = norm(t);
  return names.get(n)?.code ?? ALIASES[n];
}
/** Nearest known names for an unknown colour (for error messages). */
export function colourSuggestions(value: string, limit = 4) {
  const n = norm(value);
  const names = [...tables().values()].map((c) => c.name);
  return names
    .filter((name) => {
      const m = norm(name);
      return m.includes(n) || n.includes(m) || m.slice(0, 4) === n.slice(0, 4);
    })
    .slice(0, limit);
}
