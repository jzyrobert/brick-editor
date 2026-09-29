/**
 * Print and sticker variants of the complete official library, grouped under
 * their base part for the parts picker. LDraw names a printed part after its
 * base with a `p…` pattern suffix (3001p01, 3626bpa1, 3068bpr0001) and a part
 * with stickers applied with a `d…` suffix (10202d01); an assembly suffix
 * (`c01`) may follow. A variant is grouped only when its base is itself a
 * part of the library (following a "~Moved to" redirect).
 */
type Entry = readonly [string, string, string, string?];

export type PrintVariants = {
  /** Variant id → base id. */
  baseOf: Map<string, string>;
  /** Base id → its variants in library order. */
  variantsOf: Map<string, string[]>;
};

const SUFFIX = /^[pd][0-9a-z]+(?:c\d+)?$/;

export function printVariants(entries: readonly Entry[]): PrintVariants {
  const titles = new Map(entries.map((e) => [e[0], e[1]]));
  /** A redirect's target, else the id itself, if it is a listed part. */
  const resolve = (id: string) => {
    const title = titles.get(id);
    if (title === undefined) return undefined;
    const moved = /^~Moved to\s+(\S+)/.exec(title);
    if (!moved) return id;
    const target = moved[1].toLowerCase().replace(/\.dat$/, "") + ".dat";
    return titles.has(target) && !titles.get(target)!.startsWith("~Moved")
      ? target
      : undefined;
  };
  const baseOf = new Map<string, string>();
  const variantsOf = new Map<string, string[]>();
  for (const [id, title] of entries) {
    if (title.startsWith("~Moved")) continue;
    const stem = id.replace(/\.dat$/, "");
    // The longest stem that names a part: the closest base.
    for (let k = stem.length - 2; k >= 1; k--) {
      const c = stem[k];
      if (c !== "p" && c !== "d") continue;
      if (!SUFFIX.test(stem.slice(k))) continue;
      const base = resolve(stem.slice(0, k) + ".dat");
      if (!base || base === id) continue;
      baseOf.set(id, base);
      break;
    }
  }
  // Bases that are variants themselves (a sticker on a printed part) group
  // under the root part.
  for (const [id, base] of baseOf) {
    let root = base;
    for (let i = 0; i < 8 && baseOf.has(root); i++) root = baseOf.get(root)!;
    baseOf.set(id, root);
    const list = variantsOf.get(root);
    if (list) list.push(id);
    else variantsOf.set(root, [id]);
  }
  return { baseOf, variantsOf };
}

/** One card of grouped results: the best-ranked entry of its group, the
 * group's base and how many variants the base has in the whole library. */
export type GroupedResult<E extends Entry = Entry> = {
  entry: E;
  base: string;
  variants: number;
};
/** Collapses ranked results so each base part and its variants take one card
 * (the best-ranked member); order follows each group's best rank. */
export function groupResults<E extends Entry>(
  ranked: readonly E[],
  groups: PrintVariants,
): GroupedResult<E>[] {
  const out: GroupedResult<E>[] = [];
  const seen = new Set<string>();
  for (const entry of ranked) {
    const base = groups.baseOf.get(entry[0]) ?? entry[0];
    if (seen.has(base)) continue;
    seen.add(base);
    out.push({
      entry,
      base,
      variants: groups.variantsOf.get(base)?.length ?? 0,
    });
  }
  return out;
}
