// Colour identity joins between LDraw (LDConfig codes), BrickLink colour ids
// and Rebrickable colour ids, used by the colour-availability pack
// (scripts/build-color-availability.ts) and the marketplace mapping pack
// (scripts/build-parts.ts). Pure functions over factual tables; the checked
// result is committed as scripts/color-joins.json.
//
// Join rules (conservative: an ambiguous or conflicting join is left out):
// - LDraw → BrickLink by LEGO colour number: LDConfig records the LEGO
//   number(s) of most colours (`0 // LEGOID 194 - Medium Stone Grey`);
//   BrickLink's colour guide records the LEGO number of each colour
//   (`legoName: "Medium Stone Grey - 194"`). Exactly one non-Modulex
//   BrickLink colour with one of those numbers joins. Modulex colours use a
//   separate numbering and never join by number.
// - LDraw colours without a LEGO number join a BrickLink colour only by an
//   identical normalised name (case, "_"/"-"/spaces and grey/gray ignored),
//   when exactly one BrickLink colour has it and no other LDraw colour already
//   joined it.
// - Rebrickable → LDraw: (a) through BrickLink: Rebrickable uses BrickLink's
//   colour names, so an identical normalised name picks one BrickLink colour,
//   which joins to LDraw as above; (b) directly: the Rebrickable id equals the
//   LDraw code and the names are identical; (c) only when (a) and (b) find
//   nothing: the name equals the LEGO name LDConfig records for exactly one
//   LDraw colour. When (a) and (b) disagree the colour is not joined.

export type LDrawColour = {
  code: string;
  /** LDConfig name (underscores). */
  name: string;
  /** LDConfig VALUE, e.g. "#B40000". */
  hex: string;
  alpha?: number;
  /** LDConfig finish keyword or material, lower case; "solid" when none. */
  finish: string;
  /** LEGO colour numbers and name from the preceding LEGOID comment. */
  legoIds: string[];
  legoName?: string;
};
export type BrickLinkColour = {
  id: number;
  name: string;
  /** BrickLink's LEGO name, "Name - number". */
  legoName?: string;
  /** BrickLink colour type (1 solid, 2 transparent, …, 10 Modulex). */
  colorType: number;
};
export type RebrickableColour = { id: string; name: string };

export function parseLDConfig(text: string): LDrawColour[] {
  const out: LDrawColour[] = [];
  let lego: { ids: string[]; name: string } | undefined;
  for (const line of text.split(/\r?\n/)) {
    const l = /^0\s+\/\/\s*LEGOID\s+(.*?)\s+-\s+(.*?)\s*$/.exec(line);
    if (l) {
      lego = { ids: l[1].split("/").map((s) => s.trim()), name: l[2] };
      continue;
    }
    const m =
      /^0\s+!COLOUR\s+(\S+)\s+CODE\s+(\d+)\s+VALUE\s+(#[0-9A-Fa-f]{6})\s+EDGE\s+\S+(.*)$/.exec(
        line,
      );
    if (!m) continue;
    const rest = m[4];
    const alpha = /ALPHA\s+(\d+)/.exec(rest);
    const finish =
      /\bMATERIAL\s+(\w+)/.exec(rest)?.[1].toLowerCase() ??
      /\b(CHROME|PEARLESCENT|RUBBER|MATTE_METALLIC|METAL)\b/
        .exec(rest)?.[1]
        .toLowerCase() ??
      (alpha ? "transparent" : "solid");
    out.push({
      code: m[2],
      name: m[1],
      hex: m[3].toUpperCase(),
      ...(alpha ? { alpha: Number(alpha[1]) } : {}),
      finish,
      legoIds: lego?.ids ?? [],
      ...(lego ? { legoName: lego.name } : {}),
    });
    lego = undefined;
  }
  return out;
}

export const normColourName = (s: string) =>
  s
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/grey/g, "gray")
    .replace(/\s+/g, " ")
    .trim();

const legoNumber = (legoName?: string) =>
  /-\s*(\d+)\s*$/.exec(legoName ?? "")?.[1];

export type BrickLinkJoin = {
  bricklink: number;
  rule: "lego-id" | "name";
};
/** LDraw code → BrickLink colour (only unambiguous joins). */
export function joinBrickLink(
  ldraw: LDrawColour[],
  bricklink: BrickLinkColour[],
): Record<string, BrickLinkJoin> {
  const byLego = new Map<string, number[]>();
  for (const c of bricklink) {
    if (c.colorType === 10) continue;
    const n = legoNumber(c.legoName);
    if (n) byLego.set(n, [...(byLego.get(n) ?? []), c.id]);
  }
  const out: Record<string, BrickLinkJoin> = {};
  for (const c of ldraw) {
    const ids = new Set(c.legoIds.flatMap((n) => byLego.get(n) ?? []));
    if (ids.size === 1)
      out[c.code] = { bricklink: [...ids][0], rule: "lego-id" };
  }
  // A BrickLink colour two LDraw codes reach by number is ambiguous.
  const count = new Map<number, number>();
  for (const j of Object.values(out))
    count.set(j.bricklink, (count.get(j.bricklink) ?? 0) + 1);
  for (const [code, j] of Object.entries(out))
    if (count.get(j.bricklink)! > 1) delete out[code];
  const claimed = new Set(Object.values(out).map((j) => j.bricklink));
  for (const c of ldraw) {
    if (c.legoIds.length || out[c.code]) continue;
    const same = bricklink.filter(
      (b) =>
        b.colorType !== 10 && normColourName(b.name) === normColourName(c.name),
    );
    if (same.length === 1 && !claimed.has(same[0].id)) {
      out[c.code] = { bricklink: same[0].id, rule: "name" };
      claimed.add(same[0].id);
    }
  }
  return out;
}

export type RebrickableJoin = {
  ldraw: string;
  rule: "bricklink-name" | "id-and-name" | "lego-name";
};
/** Rebrickable colour id → LDraw code, plus the colours left out on conflict. */
export function joinRebrickable(
  rebrickable: RebrickableColour[],
  ldraw: LDrawColour[],
  bricklink: BrickLinkColour[],
  ldrawToBrickLink: Record<string, BrickLinkJoin>,
) {
  const blToLdraw = new Map<number, string[]>();
  for (const [code, j] of Object.entries(ldrawToBrickLink))
    blToLdraw.set(j.bricklink, [...(blToLdraw.get(j.bricklink) ?? []), code]);
  const blByName = new Map<string, number[]>();
  for (const b of bricklink) {
    const k = normColourName(b.name);
    blByName.set(k, [...(blByName.get(k) ?? []), b.id]);
  }
  const ldByCode = new Map(ldraw.map((c) => [c.code, c]));
  const ldByLegoName = new Map<string, string[]>();
  for (const c of ldraw)
    if (c.legoName) {
      const k = normColourName(c.legoName);
      ldByLegoName.set(k, [...(ldByLegoName.get(k) ?? []), c.code]);
    }
  const joins: Record<string, RebrickableJoin> = {};
  const conflicts: Record<string, string> = {};
  for (const r of rebrickable) {
    const name = normColourName(r.name);
    const bl = blByName.get(name) ?? [];
    const viaCodes = bl.length === 1 ? (blToLdraw.get(bl[0]) ?? []) : [];
    const via = viaCodes.length === 1 ? viaCodes[0] : undefined;
    const same = ldByCode.get(r.id);
    const direct =
      same && normColourName(same.name) === name ? same.code : undefined;
    if (via && direct && via !== direct) {
      conflicts[r.id] =
        `${r.name}: BrickLink name joins LDraw ${via}, id and name join LDraw ${direct}`;
      continue;
    }
    if (via) joins[r.id] = { ldraw: via, rule: "bricklink-name" };
    else if (direct) joins[r.id] = { ldraw: direct, rule: "id-and-name" };
    else {
      const lego = ldByLegoName.get(name) ?? [];
      if (lego.length === 1)
        joins[r.id] = { ldraw: lego[0], rule: "lego-name" };
    }
  }
  return { joins, conflicts };
}

/** Palette groups of the colour picker. */
export type ColourGroup =
  | "basic"
  | "earth"
  | "pastel"
  | "transparent"
  | "metallic";
const EXCLUDED_NAME =
  /^(Main_Colour|Edge_Colour|Modulex_|Rubber_|Canvas_|Opal_|Glitter_|Speckle_|Milky_|Glow_|Trans_Sticker|Magnet|Electric_|Fluorescent_|Obsolete_|Trans_Black_IR_Lens)/;
/** The picker group of an LDraw colour, or null when it is not offered
 * (inherited/edge codes, rubber, fabric, Modulex, speciality materials). */
export function colourGroup(c: LDrawColour): ColourGroup | null {
  if (EXCLUDED_NAME.test(c.name)) return null;
  if (["chrome", "pearlescent", "metal", "matte_metallic"].includes(c.finish))
    return "metallic";
  if (c.finish === "transparent") return "transparent";
  if (c.finish !== "solid") return null;
  if (
    /Tan|Brown|Nougat|Sand|Olive|Rust|Ochre|Earth|Dark_Orange|Dark_Red|Dark_Yellow|Umber|Sienna|Fabuland/.test(
      c.name,
    )
  )
    return "earth";
  const r = parseInt(c.hex.slice(1, 3), 16) / 255,
    g = parseInt(c.hex.slice(3, 5), 16) / 255,
    b = parseInt(c.hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const grey = max - min < 0.1;
  if (
    !grey &&
    (light > 0.72 || /^(Very_)?Light_|Lavender|Pastel|Aqua/.test(c.name))
  )
    return "pastel";
  return "basic";
}
