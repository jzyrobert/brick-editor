/**
 * Complete official library in the parts picker: ranked search or category
 * browsing, rendered thumbnails from the sprite-sheet pack, pages of 60 cards
 * loaded as the list scrolls, and print/sticker variants folded under their
 * base part (a "+N" button on the card opens them).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { FullPackCatalogEntry } from "../catalog/full-pack";
import { displayTitle, searchFullLibrary } from "../catalog/search";
import {
  groupResults,
  printVariants,
  type PrintVariants,
} from "../catalog/print-variants";
import { Icon } from "./icons";
import { catalog } from "../catalog/catalog";
import { AtlasThumb, PartThumb } from "./PartThumbs";

const PAGE = 60;
let grouping:
  | {
      entries: FullPackCatalogEntry[];
      groups: PrintVariants;
      titles: Map<string, string>;
    }
  | undefined;
/** Variant groups and titles of the loaded list (computed once per list). */
function variantGroups(entries: FullPackCatalogEntry[]) {
  if (grouping?.entries !== entries)
    grouping = {
      entries,
      groups: printVariants(entries),
      titles: new Map(entries.map((e) => [e[0], e[1]])),
    };
  return grouping;
}

/** A part name whose sizes ("2 × 4", "1 × 2 × ⅔") never break across lines. */
function PartName({ name }: { name: string }) {
  return (
    <>
      {name.split(/(\d+(?: × [\d⅓⅔]+)+)/).map((piece, i) =>
        i % 2 ? (
          <span key={i} className="nowrap">
            {piece}
          </span>
        ) : (
          piece
        ),
      )}
    </>
  );
}

export function FullLibraryResults({
  entries,
  query,
  category,
  exclude,
  browse,
  chosen,
  color,
  onChoose,
}: {
  entries: FullPackCatalogEntry[];
  query: string;
  category?: string;
  exclude?: (id: string) => boolean;
  /** List every part when there is no query (category browsing). */
  browse: boolean;
  chosen: string;
  color?: string;
  onChoose: (id: string) => void;
}) {
  const { groups, titles } = variantGroups(entries);
  const [shown, setShown] = useState(PAGE);
  /** Base part whose print variants are open. */
  const [variantsOf, setVariantsOf] = useState<string>();
  const list = useRef<HTMLDivElement>(null);
  // Opening or closing variants shows the top of the list just below the
  // sticky search and filters (never hidden under them).
  const reveal = useRef(false);
  useEffect(() => {
    const el = list.current;
    if (!reveal.current || !el) return;
    reveal.current = false;
    const sticky = el.closest(".left-sidebar")?.querySelector(".parts-sticky");
    let scroller: HTMLElement | null = el.parentElement;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight)
      scroller = scroller.parentElement;
    if (!scroller) return;
    const top =
      el.getBoundingClientRect().top -
      (sticky?.getBoundingClientRect().bottom ??
        scroller.getBoundingClientRect().top) -
      8;
    if (top < 0) scroller.scrollTop += top;
  }, [variantsOf]);
  // A new query or category starts from the top, with variants closed.
  useEffect(() => {
    setShown(PAGE);
    setVariantsOf(undefined);
  }, [query, category, browse]);

  const cards = useMemo(() => {
    if (variantsOf) {
      const members = new Set([
        variantsOf,
        ...(groups.variantsOf.get(variantsOf) ?? []),
      ]);
      const inGroup = entries.filter((e) => members.has(e[0]));
      // Variants matching the search first, then the rest of the group.
      const matched = query.trim()
        ? searchFullLibrary(inGroup, query, { limit: Infinity })
        : [];
      const seen = new Set(matched.map((e) => e[0]));
      return [...matched, ...inGroup.filter((e) => !seen.has(e[0]))].map(
        (entry) => ({ entry, base: variantsOf, variants: 0 }),
      );
    }
    return groupResults(
      searchFullLibrary(entries, query, {
        limit: Infinity,
        exclude,
        category,
        browse,
      }),
      groups,
    );
  }, [entries, query, category, browse, exclude, variantsOf, groups]);

  // Next page when the end of the list comes into view.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (e) => {
        if (e.some((x) => x.isIntersecting))
          setShown((n) => Math.min(n + PAGE, cards.length));
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cards.length, shown]);

  const baseName = (id: string) => displayTitle(titles.get(id) ?? id);
  const card = ({
    entry: [id, title],
    base,
    variants,
  }: (typeof cards)[number]) => {
    const name = displayTitle(title);
    return (
      <div key={id} className="part-card-wrap">
        <button
          id={"part-" + id}
          className={"part-card " + (chosen === id ? "chosen" : "")}
          aria-pressed={chosen === id}
          title={name + " · " + id.replace(".dat", "")}
          onClick={() => onChoose(id)}
        >
          {/* A curated base (listed among its variants) has its own rendering. */}
          {Object.hasOwn(catalog, id) ? (
            <PartThumb part={catalog[id]} color={color} />
          ) : (
            <AtlasThumb id={id} color={color} />
          )}
          <strong>
            <PartName name={name} />
          </strong>
          <small>{id.replace(".dat", "")}</small>
          {chosen === id && (
            <span className="part-check">
              <Icon name="check" size={16} />
            </span>
          )}
        </button>
        {variants > 0 && (
          <button
            className="part-variants"
            aria-label={`Show ${variants} print and sticker variants of ${baseName(base)}`}
            title={`${variants} print and sticker variants`}
            onClick={() => {
              reveal.current = true;
              setVariantsOf(base);
              setShown(PAGE);
            }}
          >
            +{variants}
          </button>
        )}
      </div>
    );
  };

  return (
    <div ref={list} className="full-library-results">
      {variantsOf && (
        <div className="variants-head">
          <button
            className="variants-back"
            onClick={() => {
              reveal.current = true;
              setVariantsOf(undefined);
            }}
          >
            <Icon name="arrowLeft" size={16} /> All results
          </button>
          <span>
            Prints of {baseName(variantsOf)} · {cards.length}
          </span>
        </div>
      )}
      {cards.length ? (
        <div className="part-grid">{cards.slice(0, shown).map(card)}</div>
      ) : (
        <p className="muted" role="status">
          {query.trim()
            ? `No other official parts match “${query.trim()}”.`
            : "No parts in this category."}
        </p>
      )}
      {shown < cards.length && (
        <div ref={sentinel} className="full-library-more">
          <button onClick={() => setShown((n) => n + PAGE)}>
            Show more ({(cards.length - shown).toLocaleString("en")} left)
          </button>
        </div>
      )}
    </div>
  );
}

/** Number of cards (after variant grouping) a query or category shows. */
export function fullResultCount(
  entries: FullPackCatalogEntry[],
  query: string,
  options: {
    category?: string;
    exclude?: (id: string) => boolean;
    browse: boolean;
  },
) {
  return groupResults(
    searchFullLibrary(entries, query, { limit: Infinity, ...options }),
    variantGroups(entries).groups,
  ).length;
}
