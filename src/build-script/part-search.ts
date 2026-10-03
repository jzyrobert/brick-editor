/**
 * Agent-facing part search (automation `parts.search`, `brick-cli parts
 * search`, and `{find: ...}` part references in build scripts).
 *
 * Covers the curated catalogue and, once registered, the complete official
 * library. Ranking is deterministic: text relevance (numbers, name words,
 * keywords, categories, builder slang such as "cheese slope" or "SNOT"),
 * then curated parts, then commonly produced parts (colours known to exist),
 * then connector-verified parts; printed, sticker, Duplo and obsolete variants
 * rank last. Ties break on the part number.
 */
import { catalog, type CatalogPart } from "../catalog/catalog";
import { fullCatalog, registeredFullLibrary } from "../catalog/full-library";
import { partSpec } from "../catalog/extended";
import { displayTitle, tokens } from "../catalog/search";
import {
  colorExistence,
  partAvailability,
  type ColorExistence,
} from "../catalog/color-availability";
import { connectorStatus } from "../catalog/connectors";
import {
  thumbnailPackId,
  sheetPath,
  type PartThumbnailIndex,
} from "../catalog/part-thumbnails";
import { resolveColourName } from "./palette";

export type PartSearchRequest = {
  query?: string;
  category?: string;
  /** Footprint in studs (either order) and height in plates (brick = 3). */
  size?: { w?: number; d?: number; h?: number };
  colour?: string | number;
  /** Only parts known to be produced in `colour`. */
  availableInColour?: boolean;
  /** Only parts with verified connector data (they snap and count for
   * connectivity checks). */
  connectable?: boolean;
  /** "curated" limits the search to the 224-part catalogue. */
  scope?: "all" | "curated";
  limit?: number;
};
export type PartSearchResult = {
  id: string;
  name: string;
  size: { w: number; d: number; h: number };
  category: string;
  curated: boolean;
  /** Colours the part is known to be produced in (0: no data). */
  colours: number;
  /** Existence in the requested colour, when one was given. */
  inColour?: ColorExistence;
  /** Verified connectors (snapping, connectivity); null: not loaded. */
  verified: boolean | null;
  bricklink?: string;
  /** Relative URL: a thumbnail image, or a sprite sheet with a
   * #xywh=x,y,w,h media fragment for complete-library parts. */
  thumbnail?: string;
  score: number;
  /** Set when no part matched every query word (a looser match). */
  partial?: boolean;
};

/** Builder slang and roles → parts that answer them (boosted to the top). */
export const PART_ROLES: Record<string, string[]> = {
  "cheese slope": ["54200.dat", "85984.dat"],
  // Things built from parts: what builders use for them.
  bell: ["30151a.dat", "3942c.dat", "3943b.dat"],
  lantern: ["37776.dat", "65581.dat", "4081b.dat"],
  "stone lantern": ["3062b.dat", "4589.dat", "3942c.dat", "4081b.dat"],
  cheese: ["54200.dat", "85984.dat"],
  "headlight brick": ["4070.dat"],
  "erling brick": ["4070.dat"],
  snot: [
    "87087.dat",
    "4070.dat",
    "47905.dat",
    "11211.dat",
    "30414.dat",
    "4733.dat",
    "99781.dat",
    "99780.dat",
    "44728.dat",
  ],
  "snot brick": ["87087.dat", "4070.dat", "47905.dat", "11211.dat"],
  bracket: ["99781.dat", "99780.dat", "44728.dat", "2436b.dat"],
  jumper: ["3794b.dat", "87580.dat"],
  roof: ["3039.dat", "3037.dat", "3038.dat", "3040b.dat", "3043.dat"],
  "roof tile": ["3039.dat", "3040b.dat"],
  ridge: ["3043.dat", "3044b.dat"],
  "roof ridge": ["3043.dat", "3044b.dat"],
  "roof corner": ["3045.dat", "3046.dat"],
  window: ["60592.dat", "60593.dat", "60594.dat"],
  "window 1x2x2": ["60592.dat"],
  "window 1x2x3": ["60593.dat"],
  "window 1x4x3": ["60594.dat"],
  "window 1x2x2 with glass": ["60592.dat"],
  "window 1x2x3 with glass": ["60593.dat"],
  "window 1x4x3 with glass": ["60594.dat"],
  shutter: ["60608.dat", "60607.dat"],
  door: ["60596.dat", "60616a.dat"],
  "door 1x4x6": ["60596.dat", "60616a.dat"],
  "door frame": ["60596.dat", "60599.dat"],
  arch: ["3659.dat", "6182.dat", "3455.dat", "2339.dat"],
  column: ["3062b.dat", "3941.dat", "2453b.dat", "14716.dat"],
  pillar: ["2453b.dat", "3062b.dat", "3941.dat"],
  railing: ["3633.dat", "3185.dat", "30055.dat"],
  fence: ["33303.dat", "3185.dat", "3633.dat"],
  tree: ["3470.dat", "3471.dat", "2435.dat"],
  "pine tree": ["3471.dat", "2435.dat"],
  "palm tree": ["2518c01.dat"],
  bush: ["6255.dat", "2423.dat", "2417.dat"],
  flower: ["24866.dat", "3742.dat", "33291.dat"],
  grass: ["32607.dat", "6255.dat"],
  "lamp post": ["2039.dat", "11062.dat"],
  "street lamp": ["2039.dat", "11062.dat"],
  lamp: ["4081b.dat", "2039.dat"],
  baseplate: ["3811.dat", "4186.dat", "3857.dat", "3867.dat"],
  water: ["3068b.dat", "87079.dat", "60474.dat"],
  wheel: ["4624.dat", "3641.dat"],
  tyre: ["3641.dat"],
  tire: ["3641.dat"],
  chimney: ["3003.dat", "2877.dat"],
  barrel: ["2489.dat"],
  antenna: ["3957a.dat"],
  flag: ["2335.dat"],
  tap: ["4599b.dat"],
  seat: ["4079.dat"],
  cone: ["4589.dat", "3942c.dat", "3943b.dat"],
  dome: ["553.dat", "3262.dat", "4740.dat"],
  ladder: ["4175.dat"],
  log: ["30136.dat"],
  masonry: ["98283.dat"],
  grille: ["2877.dat", "2412b.dat"],
  // Found wanting while writing the cathedral, harbour and town samples.
  "pointed arch": ["13965.dat"],
  "gothic arch": ["13965.dat"],
  spire: ["3685.dat", "3684a.dat", "4460b.dat", "3942c.dat"],
  "spire corner": ["3685.dat"],
  sail: ["u9494c01.dat", "85651c01.dat"],
  clock: ["3003p0b.dat", "3960p09.dat", "4150p03.dat"],
  "train base": ["92088.dat"],
  bogie: ["2878c01.dat"],
  "train front": ["2924bc01.dat"],
  track: ["53401.dat", "53400.dat"],
};
/** Word-level synonyms: a query word also matches these words. */
const SYNONYMS: Record<string, string[]> = {
  roof: ["slope"],
  railing: ["fence"],
  balustrade: ["fence", "spindled"],
  pillar: ["column", "round", "support"],
  column: ["round", "support"],
  cylinder: ["round"],
  tire: ["tyre"],
  tyre: ["tire"],
  lamppost: ["lamppost", "lamp"],
  glass: ["glass", "pane", "windscreen"],
  grey: ["gray"],
  gray: ["grey"],
  wedge: ["wedge", "wing"],
  panel: ["panel", "wall"],
  plant: ["plant", "flower", "leaves"],
  corner: ["corner", "convex"],
};
const PENALISED =
  /pattern|sticker|duplo|fabuland|quatro|primo|minifig torso|minifig head\b|constraction|technic panel/i;
/** Categories that rarely answer a building search (figures, other
 * systems, stickers): demoted unless the query names them. */
const DEMOTED_CATEGORY =
  /^(minifig|figure|duplo|primo|quatro|fabuland|sticker|znap|bionicle|hose|electric)/i;

type Entry = {
  id: string;
  name: string;
  category: string;
  keywords: string;
  curated: boolean;
  obsolete: boolean;
  order: number;
};
type Indexed = Entry & {
  numbers: string[];
  words: string[];
  other: string[];
  size: { w: number; d: number; h: number } | null;
};

/** Size of a part: footprint in studs and body height in plates. */
export function partSize(spec: CatalogPart) {
  const b = spec.bounds;
  const top = spec.studded ? b.min[1] + 4 : b.min[1];
  return {
    w: Math.max(1, Math.round(spec.width / 20)),
    d: Math.max(1, Math.round(spec.depth / 20)),
    h: Math.max(0, Math.round((b.max[1] - top) / 8)),
  };
}

let curatedIndex: Indexed[] | undefined;
let fullIndex: Indexed[] | undefined;
let fullSource: unknown;
function index(entry: Entry): Indexed {
  const spec = partSpec(entry.id);
  const size = spec ? partSize(spec) : null;
  const dims = size
    ? [
        `${size.w}×${size.d}`,
        `${size.d}×${size.w}`,
        ...(size.h % 3 === 0 && size.h > 0
          ? [
              `${size.w}×${size.d}×${size.h / 3}`,
              `${size.d}×${size.w}×${size.h / 3}`,
            ]
          : []),
      ]
    : [];
  const aliases = Object.hasOwn(catalog, entry.id)
    ? (catalog[entry.id].aliases ?? [])
    : [];
  return {
    ...entry,
    numbers: tokens([entry.id, ...aliases].join(" ")),
    words: tokens(entry.name),
    other: tokens(
      [
        entry.category,
        entry.category.replace(/s$/i, ""),
        entry.keywords,
        ...dims,
      ].join(" "),
    ),
    size,
  };
}
function curatedEntries() {
  return (curatedIndex ??= Object.values(catalog).map((p, order) =>
    index({
      id: p.id,
      name: p.name,
      category: p.category,
      keywords: [p.keywords ?? "", ...(p.tags ?? [])].join(" "),
      curated: true,
      obsolete: false,
      order,
    }),
  ));
}
function fullEntries() {
  const entries = fullCatalog();
  if (!entries || !registeredFullLibrary()) return [];
  if (fullIndex && fullSource === entries) return fullIndex;
  fullSource = entries;
  fullIndex = [];
  entries.forEach(([id, title, category, keywords], order) => {
    if (title.startsWith("~Moved") || Object.hasOwn(catalog, id)) return;
    fullIndex!.push(
      index({
        id,
        name: displayTitle(title.replace(/^[~=_|]+/, "")),
        category,
        keywords: keywords ?? "",
        curated: false,
        obsolete: /^[~=_|]/.test(title),
        order: 1000 + order,
      }),
    );
  });
  return fullIndex;
}

/** Relevance of a part; 0 when a query word matches nothing, unless
 * `partial` (then words that match add up, at a discount). */
function relevance(e: Indexed, query: string[], partial = false) {
  let total = 0,
    missed = 0;
  for (const q of query) {
    const alternatives = [q, ...(SYNONYMS[q] ?? [])];
    let best = 0;
    for (const a of alternatives) {
      for (const n of e.numbers)
        best = Math.max(
          best,
          n === a ? 100 : n.startsWith(a) && a.length > 1 ? 30 : 0,
        );
      e.words.forEach((w, i) => {
        if (w === a) best = Math.max(best, 12 - Math.min(i, 4));
        else if (w.startsWith(a)) best = Math.max(best, 8 - Math.min(i, 4));
      });
      for (const w of e.other)
        best = Math.max(best, w === a ? 5 : w.startsWith(a) ? 2 : 0);
    }
    if (!best) {
      if (!partial) return 0;
      missed++;
    }
    total += best;
  }
  return partial ? (missed < query.length ? total / 2 : 0) : total;
}
/**
 * Parts a query phrase names through a role or builder slang, best first.
 * `exact`: the whole query is the role ("cheese slope"); otherwise a role
 * phrase is part of a longer query ("arch 1x6") and only narrows it.
 */
export function roleMatch(query: string): { ids: string[]; exact: boolean } {
  const q = tokens(query).join(" ");
  const keys = Object.keys(PART_ROLES).sort((a, b) => b.length - a.length);
  for (const key of keys)
    if (tokens(key).join(" ") === q)
      return { ids: PART_ROLES[key], exact: true };
  const ids: string[] = [];
  for (const key of keys) {
    const k = tokens(key).join(" ");
    if (
      q.startsWith(k + " ") ||
      q.endsWith(" " + k) ||
      q.includes(" " + k + " ")
    )
      for (const id of PART_ROLES[key]) if (!ids.includes(id)) ids.push(id);
  }
  return { ids, exact: false };
}
/** Role parts of an exact role phrase (empty for other queries). */
export const roleParts = (query: string) => {
  const m = roleMatch(query);
  return m.exact ? m.ids : [];
};

let thumbnailIndex: PartThumbnailIndex | undefined;
let thumbnailWhere: Map<string, number[]> | undefined;
/** Lets complete-library results carry sprite-sheet thumbnail URLs. */
export function registerSearchThumbnails(index: PartThumbnailIndex) {
  thumbnailIndex = index;
  thumbnailWhere = new Map();
  index.sheets.forEach((s, sheet) =>
    s.parts.forEach((id, cell) => thumbnailWhere!.set(id, [sheet, cell])),
  );
}
function thumbnailOf(e: Indexed) {
  if (e.curated) return catalog[e.id].thumbnail || undefined;
  const at = thumbnailWhere?.get(e.id);
  if (!at || !thumbnailIndex) return undefined;
  const [sheet, cell] = at;
  const c = thumbnailIndex.cell,
    cols = thumbnailIndex.columns;
  return (
    `thumbnails/${thumbnailPackId}/${sheetPath(thumbnailIndex.sheets[sheet].image[0])}` +
    `#xywh=${(cell % cols) * c},${Math.floor(cell / cols) * c},${c},${c}`
  );
}

/** Ranked search (see the module comment). */
export function searchParts(
  request: PartSearchRequest = {},
  partial = false,
): PartSearchResult[] {
  const limit = Math.max(1, Math.min(request.limit ?? 20, 200));
  const query = tokens(request.query ?? "");
  const roles = request.query
    ? roleMatch(request.query)
    : { ids: [], exact: false };
  const code =
    request.colour === undefined
      ? undefined
      : resolveColourName(request.colour);
  if (request.colour !== undefined && code === undefined)
    throw new Error("Unknown colour " + JSON.stringify(request.colour));
  const pool = [
    ...curatedEntries(),
    ...(request.scope === "curated" ? [] : fullEntries()),
  ];
  const category = request.category?.toLowerCase();
  const size = request.size;
  const results: (PartSearchResult & { order: number })[] = [];
  for (const e of pool) {
    const role = roles.ids.indexOf(e.id);
    let score = query.length ? relevance(e, query, partial) : 1;
    if (role >= 0 && roles.exact) score = Math.max(score, 1) + 200 - role * 5;
    else if (role >= 0 && score) score += 30 - role;
    if (!score) continue;
    if (
      category &&
      e.category.toLowerCase() !== category &&
      !(
        e.curated &&
        catalog[e.id].tags?.some((t) => t.toLowerCase() === category)
      )
    )
      continue;
    if (size) {
      if (!e.size) continue;
      const { w, d, h } = size;
      if (w !== undefined && d !== undefined) {
        const a = [w, d].sort((x, y) => x - y).join(),
          b = [e.size.w, e.size.d].sort((x, y) => x - y).join();
        if (a !== b) continue;
      } else if (
        (w !== undefined && e.size.w !== w && e.size.d !== w) ||
        (d !== undefined && e.size.w !== d && e.size.d !== d)
      )
        continue;
      if (h !== undefined && e.size.h !== h) continue;
    }
    const availability = partAvailability(e.id);
    const colours =
      availability.status === "known" ? availability.colors.size : 0;
    const inColour = code ? colorExistence(e.id, code) : undefined;
    if (
      request.availableInColour &&
      code &&
      inColour !== "verified" &&
      inColour !== "derived"
    )
      continue;
    const status = connectorStatus(e.id);
    const loaded = !status.reasons.some((r) =>
      r.startsWith("No derived connector data loaded"),
    );
    const verified = status.verified ? true : loaded ? false : null;
    if (request.connectable && !verified) continue;
    const text = e.name + " " + e.category;
    const slangQuery = query.join(" ");
    const penalty =
      (PENALISED.test(text) && !PENALISED.test(slangQuery) ? 25 : 0) +
      (/\d[a-z]?(p|d|pb|pr)[0-9a-z]+\.dat$/i.test(e.id) ? 10 : 0) +
      (e.obsolete ? 8 : 0) +
      (/c\d\d\.dat$/.test(e.id) ? 3 : 0) +
      (DEMOTED_CATEGORY.test(e.category) &&
      !query.some((w) =>
        e.category.toLowerCase().startsWith(w.toLowerCase().slice(0, 5)),
      )
        ? 15
        : 0);
    score +=
      (e.curated ? 20 : 0) +
      Math.min(12, 2 * Math.log2(1 + colours)) +
      (verified ? 2 : 0) +
      (code && (inColour === "verified" || inColour === "derived") ? 4 : 0) -
      penalty;
    const bricklink =
      availability.status === "known" ? availability.bricklinkItem : undefined;
    const thumbnail = thumbnailOf(e);
    results.push({
      id: e.id,
      name: e.name,
      size: e.size ?? { w: 0, d: 0, h: 0 },
      category: e.category,
      curated: e.curated,
      colours,
      ...(inColour ? { inColour } : {}),
      verified,
      ...(bricklink ? { bricklink } : {}),
      ...(thumbnail ? { thumbnail } : {}),
      score: Math.round(score * 100) / 100,
      order: e.order,
    });
  }
  results.sort(
    (a, b) =>
      b.score - a.score ||
      a.order - b.order ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  // Nothing matches every word: rank parts matching some of them.
  if (!results.length && !partial && query.length > 1)
    return searchParts(request, true).map((r) => ({ ...r, partial: true }));
  // Penalised near-misses (printed torsos, other systems) never pad a list
  // that has real matches.
  const kept = results.some((r) => r.score > 0)
    ? results.filter((r) => r.score > 0)
    : results;
  return kept.slice(0, limit).map(({ order: _order, ...r }) => r);
}

/** Parses "1x4", "1x4x3" (plates) or "1x4x1b" (bricks) into a size filter. */
export function parseSize(text: string): PartSearchRequest["size"] {
  const m = /^(\d+)\s*[x×*]\s*(\d+)(?:\s*[x×*]\s*(\d+)(b?))?$/i.exec(
    text.trim(),
  );
  if (!m)
    throw new Error(
      `Size must look like 2x4, 2x4x3 (plates) or 2x4x1b (bricks)`,
    );
  const h = m[3] === undefined ? undefined : Number(m[3]) * (m[4] ? 3 : 1);
  return {
    w: Number(m[1]),
    d: Number(m[2]),
    ...(h !== undefined ? { h } : {}),
  };
}
