import type { CatalogPart } from "./catalog";

/** Normalise "2x4", "2 × 4" and "2*4" to the same "2×4" token. */
export function tokens(text: string) {
  return (
    text
      .toLowerCase()
      .replace(/\.dat\b/g, "")
      // One token per size, so "2 × 2" never matches the 2 and × of "2 × 4".
      .replace(/(\d)\s*[x×*]\s*(?=\d)/g, "$1×")
      .replace(/(\d)\s*[x×*](?=\s|$)/g, "$1×")
      .split(/[\s,/()–-]+/)
      .filter(Boolean)
  );
}
type Indexed = {
  /** Part and marketplace numbers: an exact hit ranks first. */
  numbers: string[];
  name: string[];
  other: string[];
};
const index = new WeakMap<CatalogPart, Indexed>();
function indexed(part: CatalogPart): Indexed {
  let entry = index.get(part);
  if (!entry) {
    const studs = `${part.depth / 20} × ${part.width / 20}`;
    const categories = [part.category, ...(part.tags ?? [])];
    entry = {
      numbers: tokens([part.id, ...(part.aliases ?? [])].join(" ")),
      name: tokens(part.name),
      other: tokens(
        [
          ...categories,
          ...categories.map((c) => c.replace(/s$/i, "")),
          studs,
          `${part.width / 20} × ${part.depth / 20}`,
          part.keywords ?? "",
          part.glass ? "glass transparent clear" : "",
          part.height >= 24 ? "tall" : "flat thin",
        ].join(" "),
      ),
    };
    index.set(part, entry);
  }
  return entry;
}
/** Relevance of one part for the query tokens, or 0 when a token has no match. */
function score(part: CatalogPart, query: string[]) {
  const { numbers, name, other } = indexed(part);
  let total = 0;
  for (const q of query) {
    let best = 0;
    for (const n of numbers)
      best = Math.max(best, n === q ? 100 : n.startsWith(q) ? 30 : 0);
    name.forEach((w, i) => {
      // Earlier name words ("Slope" in "Slope 45° 2 × 2") say more about the part.
      if (w === q) best = Math.max(best, 12 - Math.min(i, 4));
      else if (w.startsWith(q)) best = Math.max(best, 8 - Math.min(i, 4));
    });
    for (const w of other)
      best = Math.max(best, w === q ? 4 : w.startsWith(q) ? 2 : 0);
    if (!best) return 0;
    total += best;
  }
  return total;
}

export type CatalogFilter = {
  query?: string;
  category?: string;
  favouritesOnly?: boolean;
  favourites?: ReadonlySet<string>;
};
export function inCategory(part: CatalogPart, category: string) {
  return part.category === category || !!part.tags?.includes(category);
}
/**
 * Every query token must prefix-match a part number, a name word or a keyword
 * (so "pla 2x" finds plates). With a query, exact numbers rank first, then name
 * matches; ties keep catalogue order.
 */
export function searchCatalog(
  parts: readonly CatalogPart[],
  filter: CatalogFilter = {},
) {
  const query = tokens(filter.query ?? "");
  const matches = parts
    .map((part, order) => ({ part, order, score: query.length ? 0 : 1 }))
    .filter((m) => {
      if (filter.category && !inCategory(m.part, filter.category)) return false;
      if (filter.favouritesOnly && !filter.favourites?.has(m.part.id))
        return false;
      if (query.length) m.score = score(m.part, query);
      return m.score > 0;
    });
  if (query.length)
    matches.sort((a, b) => b.score - a.score || a.order - b.order);
  return matches.map((m) => m.part);
}
/** Categories in the given palette order, then any others alphabetically. */
export function catalogCategories(
  parts: readonly CatalogPart[],
  order: readonly string[] = [],
) {
  const used = new Set(parts.flatMap((p) => [p.category, ...(p.tags ?? [])]));
  return [
    ...order.filter((c) => used.has(c)),
    ...[...used].filter((c) => !order.includes(c)).sort(),
  ];
}
/** LDraw title spacing ("Brick  2 x  4") in the catalogue's style ("Brick 2 × 4"). */
export function displayTitle(title: string) {
  return title
    .replace(/\s+/g, " ")
    .replace(/(\d) x (?=\d)/g, "$1 × ")
    .trim();
}
type FullEntry = readonly [string, string, string, string?];
const fullIndex = new WeakMap<FullEntry, Indexed>();
/**
 * Ranked search over the complete official library's part list (the "All LDraw
 * parts" scope): the same token rules as the catalogue, over number, title,
 * category and keywords. Moved-to redirects are left out (their targets are
 * listed); `exclude` drops parts the caller already shows; `category` keeps
 * one LDraw category. Without a query, `browse` lists every part (of the
 * category) in library order; otherwise an empty query finds nothing.
 */
export function searchFullLibrary(
  entries: readonly FullEntry[],
  query: string,
  {
    limit = 60,
    exclude,
    category,
    browse = false,
  }: {
    limit?: number;
    exclude?: (id: string) => boolean;
    category?: string;
    browse?: boolean;
  } = {},
) {
  const q = tokens(query);
  if (!q.length && !browse) return [];
  const hits: { entry: FullEntry; score: number; order: number }[] = [];
  entries.forEach((entry, order) => {
    if (entry[1].startsWith("~Moved") || exclude?.(entry[0])) return;
    if (category !== undefined && entry[2] !== category) return;
    let idx = fullIndex.get(entry);
    if (!idx) {
      idx = {
        numbers: tokens(entry[0]),
        name: tokens(entry[1].replace(/^[~=_|]+/, "")),
        other: tokens(entry[2] + " " + (entry[3] ?? "")),
      };
      fullIndex.set(entry, idx);
    }
    let total = 0;
    for (const t of q) {
      let best = 0;
      for (const n of idx.numbers)
        best = Math.max(best, n === t ? 100 : n.startsWith(t) ? 30 : 0);
      idx.name.forEach((w, i) => {
        if (w === t) best = Math.max(best, 12 - Math.min(i, 4));
        else if (w.startsWith(t)) best = Math.max(best, 8 - Math.min(i, 4));
      });
      for (const w of idx.other)
        best = Math.max(best, w === t ? 4 : w.startsWith(t) ? 2 : 0);
      if (!best) return;
      total += best;
    }
    // Obsolete (~), alias (=) and similar variants rank after plain parts.
    if (/^[~=_|]/.test(entry[1])) total -= 3;
    hits.push({ entry, score: total, order });
  });
  hits.sort((a, b) => b.score - a.score || a.order - b.order);
  return hits.slice(0, limit).map((h) => h.entry);
}
/** LDraw categories of the complete library with their part counts, largest
 * first (moved-to redirects are not parts). */
export function fullLibraryCategories(entries: readonly FullEntry[]) {
  const counts = new Map<string, number>();
  for (const e of entries)
    if (!e[1].startsWith("~Moved"))
      counts.set(e[2], (counts.get(e[2]) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([name, count]) => ({ name, count }));
}
/** Same footprint in other categories, then same category with a shared side. */
export function relatedParts(
  parts: readonly CatalogPart[],
  part: CatalogPart | undefined,
  limit = 4,
) {
  if (!part) return [];
  const footprint = (p: CatalogPart) =>
    [p.width, p.depth].sort((a, b) => a - b).join("×");
  const same = parts.filter(
    (p) => p.id !== part.id && footprint(p) === footprint(part),
  );
  const sibling = parts.filter(
    (p) =>
      p.id !== part.id &&
      p.category === part.category &&
      !same.includes(p) &&
      (p.width === part.width ||
        p.depth === part.depth ||
        p.width === part.depth ||
        p.depth === part.width),
  );
  return [...same, ...sibling].slice(0, limit);
}
