/**
 * Colour availability: which LDraw colours a part has really been produced in
 * (scripts/build-color-availability.ts). LDraw itself does not record this.
 *
 * Trust chain: color-availability-lock.json pins color-availability.json by
 * sha256 (checked by `npm run library:validate` and the unit tests); the pack
 * is bundled as its own chunk and loaded on first use, so it works offline.
 *
 * Per part, `v` lists colours a reviewed BrickLink catalogue item is known in
 * (verified: a colour not listed is known not produced) and `d` colours
 * Rebrickable records for the part (derived: a colour not listed is only
 * "not recorded"). A part without an entry has unknown availability.
 */
import lock from "./color-availability-lock.json";
import palette from "./colors.json";

export const COLOR_AVAILABILITY_FORMAT = "brick-editor-color-availability/1";
export const colorAvailabilityLock: {
  packId: string;
  sha256: string;
  bytes: number;
} = lock;

export type PackPart = {
  /** Verified colours (LDraw codes) of BrickLink item `bl`. */
  v?: number[];
  bl?: string;
  /** Derived colours (LDraw codes) of Rebrickable part_num `rb`. */
  d?: number[];
  rb?: string;
  /** How `rb` was joined (scripts/part-joins.ts): absent when it is the LDraw
   * number itself; "k" the Rebrickable number the LDraw file states (printed
   * variants join this way), "b" the part's BrickLink number, "m" a checked
   * mould-table row. */
  j?: "k" | "b" | "m";
};
export type ColorAvailabilityPack = {
  format: typeof COLOR_AVAILABILITY_FORMAT;
  packId: string;
  library: { releaseId: string; manifestSha256: string };
  sources: Record<string, unknown>;
  rules: string[];
  coverage: Record<string, unknown>;
  /** Official reference name ("3001.dat") → availability. */
  parts: Record<string, PackPart>;
};

export type ColorGroup =
  | "basic"
  | "earth"
  | "pastel"
  | "transparent"
  | "metallic";
export type PaletteColor = {
  code: string;
  name: string;
  hex: string;
  group: ColorGroup;
  /** Drawn see-through (LDConfig ALPHA). */
  transparent?: boolean;
  /** A favourite: shown first, and on phones before "More colours". */
  quick?: boolean;
  /** Placeable parts known in this colour. */
  parts: number;
};
export const paletteColors = palette.colors as PaletteColor[];
export const colorGroups = palette.groups as ColorGroup[];
export const colorGroupNames: Record<ColorGroup, string> = {
  basic: "Basic",
  earth: "Earth",
  pastel: "Pastel",
  transparent: "Transparent",
  metallic: "Metallic & pearl",
};

/** Existence of one part/colour combination. */
export type ColorExistence =
  /** Listed by BrickLink's catalogue for the reviewed item. */
  | "verified"
  /** Recorded by Rebrickable (not catalogue verified). */
  | "derived"
  /** A reviewed item BrickLink does not list in this colour. */
  | "not-produced"
  /** Data exists for the part, but no source records this colour. */
  | "not-recorded"
  /** No availability data for the part (or the pack is not loaded). */
  | "unknown";

export type PartAvailability =
  | { status: "loading" | "unknown" }
  | {
      status: "known";
      /** Every colour known to exist (verified ∪ derived). */
      colors: Set<string>;
      verified?: Set<string>;
      derived?: Set<string>;
      bricklinkItem?: string;
      rebrickablePart?: string;
    };

let pack: ColorAvailabilityPack | undefined;
let load: Promise<ColorAvailabilityPack> | undefined;
let failed = false;
const memo = new Map<string, PartAvailability>();
const listeners = new Set<() => void>();
let generation = 0;
export const colorAvailabilityGeneration = () => generation;
export function onColorAvailabilityChange(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Uses an already parsed pack (the CLI and tests pass the JSON directly). */
export function registerColorAvailability(p: ColorAvailabilityPack) {
  if (p.format !== COLOR_AVAILABILITY_FORMAT || p.packId !== lock.packId)
    throw new Error("Unsupported colour availability pack");
  pack = p;
  memo.clear();
  generation++;
  for (const l of [...listeners]) l();
}
/** Loads the pack once (its own lazily loaded chunk). */
export function loadColorAvailability(): Promise<ColorAvailabilityPack> {
  if (pack) return Promise.resolve(pack);
  return (load ??= import("./color-availability.json")
    .then((m) => {
      registerColorAvailability(
        (m.default ?? m) as unknown as ColorAvailabilityPack,
      );
      return pack!;
    })
    .catch((e) => {
      load = undefined;
      failed = true;
      generation++;
      for (const l of [...listeners]) l();
      throw e;
    }));
}
export const colorAvailabilityLoaded = () => !!pack;

const codes = (list?: number[]) =>
  list?.length ? new Set(list.map(String)) : undefined;
/** What is known about the colours a part was produced in. */
export function partAvailability(ref: string): PartAvailability {
  if (!pack) return { status: failed ? "unknown" : "loading" };
  const hit = memo.get(ref);
  if (hit) return hit;
  const entry = pack.parts[ref.toLowerCase()] ?? pack.parts[ref];
  let result: PartAvailability;
  if (!entry) result = { status: "unknown" };
  else {
    const verified = codes(entry.v),
      derived = codes(entry.d);
    result = {
      status: "known",
      colors: new Set([...(verified ?? []), ...(derived ?? [])]),
      ...(verified ? { verified, bricklinkItem: entry.bl } : {}),
      ...(derived ? { derived, rebrickablePart: entry.rb } : {}),
    };
  }
  memo.set(ref, result);
  return result;
}
/** Existence of a part in a colour, per the pack's provenance rules. */
export function colorExistence(ref: string, code: string): ColorExistence {
  const a = partAvailability(ref);
  if (a.status !== "known") return "unknown";
  if (a.verified?.has(code)) return "verified";
  if (a.derived?.has(code)) return "derived";
  return a.verified ? "not-produced" : "not-recorded";
}
/** Whether the part is known to exist in the colour (false only when data
 * exists and no source records it). */
export function madeIn(ref: string, code: string) {
  const e = colorExistence(ref, code);
  return e !== "not-produced" && e !== "not-recorded";
}
