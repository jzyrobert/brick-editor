import { useEffect, useState, useSyncExternalStore } from "react";
import {
  colorAvailabilityGeneration,
  colorGroupNames,
  colorGroups,
  loadColorAvailability,
  onColorAvailabilityChange,
  paletteColors,
  partAvailability,
  type PaletteColor,
} from "../catalog/color-availability";
import { Icon } from "./icons";

/** Re-renders when the colour availability pack arrives. */
export function useColorAvailability() {
  useEffect(() => {
    void loadColorAvailability().catch(() => {});
  }, []);
  return useSyncExternalStore(
    onColorAvailabilityChange,
    colorAvailabilityGeneration,
  );
}

/** A gentle note when the part is known not to come in the colour, else "". */
export function colourAvailabilityHint(
  partId: string,
  partName: string,
  code: string,
) {
  const a = partAvailability(partId);
  if (a.status !== "known" || a.colors.has(code)) return "";
  const name = paletteColors.find((c) => c.code === code)?.name ?? code;
  return `${partName} isn't made in ${name.toLowerCase()}. Fine for a design; the real part doesn't exist.`;
}

/**
 * Colour swatches for the held part. By default only colours the part has
 * really been made in (verified or derived availability); "Show all colours"
 * lists the rest, marked. A part without data shows every colour with a note.
 * The held colour is never changed here: when the part is not made in it, it
 * stays chosen with a hint.
 */
export function ColorPicker({
  color,
  onChoose,
  partId,
  partName,
}: {
  color: string;
  onChoose: (code: string) => void;
  partId: string;
  partName: string;
}) {
  useColorAvailability();
  const [showAll, setShowAll] = useState(false);
  const [more, setMore] = useState(false);
  const a = partAvailability(partId);
  const known = a.status === "known" ? a.colors : undefined;
  const made = (c: PaletteColor) => !known || known.has(c.code);
  const listed = (c: PaletteColor) => showAll || made(c) || c.code === color;
  const held = paletteColors.find((c) => c.code === color);
  const quick = paletteColors.filter(
    (c) => (c.quick || (c.code === color && !more)) && listed(c),
  );
  const others = paletteColors.filter((c) => !c.quick && listed(c));
  const hiddenOthers = others.filter((c) => c.code !== color || more).length;
  const madeCount = known
    ? paletteColors.filter((c) => known.has(c.code)).length
    : 0;
  const swatch = (c: PaletteColor) => {
    const unavailable = !made(c);
    const label = c.name + (unavailable ? " (not made in this part)" : "");
    return (
      <button
        key={c.code}
        aria-label={label}
        title={label}
        style={{ background: c.hex }}
        className={
          (color === c.code ? "chosen" : "") +
          (unavailable ? " unavailable" : "")
        }
        aria-pressed={color === c.code}
        onClick={() => onChoose(c.code)}
      >
        {color === c.code && <Icon name="check" size={18} />}
      </button>
    );
  };
  return (
    <>
      <div className="swatches" id="colour-swatches">
        {quick.map(swatch)}
        {hiddenOthers > 0 && (
          <button
            className="more-colours"
            aria-expanded={more}
            aria-label={
              more ? "Fewer colours" : `More colours (${hiddenOthers})`
            }
            title={more ? "Fewer colours" : "More colours"}
            onClick={() => setMore((v) => !v)}
          >
            {more ? "Less" : `+${hiddenOthers}`}
          </button>
        )}
      </div>
      {more &&
        colorGroups.map((g) => {
          // Colours the part is made in first, then (Show all) the rest.
          const list = others
            .filter((c) => c.group === g)
            .sort((x, y) => Number(!made(x)) - Number(!made(y)));
          return list.length ? (
            <div className="swatch-group" key={g}>
              <h3>{colorGroupNames[g]}</h3>
              <div className="swatches">{list.map(swatch)}</div>
            </div>
          ) : null;
        })}
      <p className="colour-note" data-availability={a.status}>
        {known ? (
          <>
            <span>
              Made in {madeCount} colour{madeCount === 1 ? "" : "s"}
            </span>
            <button
              className="text-button"
              aria-pressed={showAll}
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? "Only real colours" : "Show all colours"}
            </button>
          </>
        ) : a.status === "unknown" ? (
          <span>Colour availability unknown for this part</span>
        ) : null}
      </p>
      {known && held && !known.has(color) && (
        <p className="colour-hint" role="note">
          {partName} isn't made in {held.name.toLowerCase()}. You can still
          build with it.
        </p>
      )}
    </>
  );
}
