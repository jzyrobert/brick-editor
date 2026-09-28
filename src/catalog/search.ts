import type { CatalogPart } from "./catalog";

/** Normalise "2x4", "2 × 4" and "2*4" to the same "2×4" token. */
function tokens(text: string) {
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
