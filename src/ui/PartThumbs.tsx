import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { colors, type CatalogPart } from "../catalog/catalog";
import {
  onPartThumbnailsChange,
  partThumbnail,
  partThumbnailsGeneration,
} from "../catalog/part-thumbnails-loader";

/** Palette colours drawn as glass (LDConfig ALPHA): thumbnails show the part
 * see-through in them, whatever the part's usual colour. */
const transparentHex = new Set(
  colors.filter((c) => c.transparent).map((c) => c.hex.toLowerCase()),
);
export const isGlassTint = (hex?: string) =>
  !!hex && transparentHex.has(hex.toLowerCase());

const thumbClass = (color: string | undefined, extra = "") =>
  "part-thumb" + (isGlassTint(color) ? " glass" : "") + extra;

/** Static rendering of the part (white body), tinted to the held colour; a
 * transparent colour shows it as glass. Complete-library parts come from the
 * sprite-sheet pack, with any print left untinted. */
export function PartThumb({
  part,
  color,
}: {
  part: CatalogPart;
  color?: string;
}) {
  if (part.extended) return <AtlasThumb id={part.id} color={color} />;
  return <CuratedThumb part={part} color={color} />;
}

function CuratedThumb({ part, color }: { part: CatalogPart; color?: string }) {
  const src = import.meta.env.BASE_URL + part.thumbnail;
  // The tint mask reuses the image only once the lazy <img> has loaded it, so
  // off-screen cards fetch nothing.
  const [loaded, setLoaded] = useState<string>();
  if (!part.thumbnail) return <GenericThumb />;
  return (
    <span
      className={thumbClass(color, loaded === src ? " loaded" : "")}
      style={
        {
          "--tint": color ?? "#bac4cb",
          ...(loaded === src
            ? { "--thumb": `url("${new URL(src, location.href).href}")` }
            : {}),
        } as CSSProperties
      }
    >
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(src)}
      />
    </span>
  );
}

/** Neutral outline for parts without a rendering: never a picture of some
 * other part. */
export function GenericThumb() {
  return (
    <span className="part-thumb generic" aria-hidden="true">
      <svg viewBox="0 0 48 48">
        <path d="M8 16 24 8l16 8v16l-16 8-16-8Z M8 16l16 8 16-8 M24 24v16" />
      </svg>
    </span>
  );
}

// One observer for every atlas thumbnail: a card asks for its sheet only once
// it comes near the viewport.
const seen = new WeakMap<Element, () => void>();
let observer: IntersectionObserver | undefined;
function observe(el: Element, onVisible: () => void) {
  if (typeof IntersectionObserver === "undefined") {
    onVisible();
    return () => {};
  }
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries)
        if (e.isIntersecting) {
          seen.get(e.target)?.();
          seen.delete(e.target);
          observer!.unobserve(e.target);
        }
    },
    { rootMargin: "200px" },
  );
  seen.set(el, onVisible);
  observer.observe(el);
  return () => {
    seen.delete(el);
    observer?.unobserve(el);
  };
}

/** A complete-library part's cell of its sprite sheet. */
export function AtlasThumb({ id, color }: { id: string; color?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  useSyncExternalStore(onPartThumbnailsChange, partThumbnailsGeneration);
  useEffect(
    () =>
      ref.current ? observe(ref.current, () => setVisible(true)) : undefined,
    [],
  );
  const thumb = partThumbnail(id, visible);
  if (thumb.status === "none") return <GenericThumb />;
  const ready = thumb.status === "ready";
  return (
    <span
      ref={ref}
      className={thumbClass(
        color,
        " atlas" +
          (ready ? " loaded" : "") +
          (ready && thumb.printed ? " printed" : ""),
      )}
      data-part={id}
      aria-hidden="true"
      style={
        {
          "--tint": color ?? "#bac4cb",
          ...(ready
            ? {
                "--sheet": `url("${thumb.image}")`,
                "--thumb": `url("${thumb.mask}")`,
                "--cell-size": thumb.size,
                "--cell-pos": thumb.position,
              }
            : {}),
        } as CSSProperties
      }
    >
      <i />
    </span>
  );
}
