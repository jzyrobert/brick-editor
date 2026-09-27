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
      .split(/[\s,]+/)
      .filter(Boolean)
  );
}
function haystack(part: CatalogPart) {
  const studs = `${part.depth / 20} × ${part.width / 20}`;
  const singular = part.category.replace(/s$/i, "");
  return tokens(
    [
      part.name,
      part.id,
      part.category,
      singular,
      studs,
      `${part.width / 20} × ${part.depth / 20}`,
      part.height >= 24 ? "tall" : "flat thin",
    ].join(" "),
  );
}

export type CatalogFilter = {
  query?: string;
  category?: string;
  favouritesOnly?: boolean;
  favourites?: ReadonlySet<string>;
};
/** Every query token must prefix-match some part token (so "pla 2x" finds plates). */
export function searchCatalog(
  parts: readonly CatalogPart[],
  filter: CatalogFilter = {},
) {
  const query = tokens(filter.query ?? "");
  return parts.filter((part) => {
    if (filter.category && part.category !== filter.category) return false;
    if (filter.favouritesOnly && !filter.favourites?.has(part.id)) return false;
    const words = haystack(part);
    return query.every((q) => words.some((w) => w.startsWith(q)));
  });
}
export function catalogCategories(parts: readonly CatalogPart[]) {
  return [...new Set(parts.map((p) => p.category))].sort();
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
