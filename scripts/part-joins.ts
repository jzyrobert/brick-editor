// LDraw ↔ Rebrickable part joins for colour availability
// (scripts/build-color-availability.ts). Pure functions, unit tested.
//
// Rebrickable and LDraw number many parts the same way, but printed parts
// differ (LDraw 3068bp01, Rebrickable 3068bpr0001) and so do some moulds
// (LDraw 4738a is Rebrickable 4738b). A join is therefore taken, in order:
//
//   k  keyword: the Rebrickable number the LDraw part file itself states in a
//      `0 !KEYWORDS Rebrickable <part_num>` entry (exactly one such number).
//      This is how printed variants join (LDraw `p` suffixes, Rebrickable
//      `pr` suffixes): only when the LDraw author recorded the number.
//   =  exact: Rebrickable has a part_num equal to the LDraw number.
//   b  BrickLink: the BrickLink number of the part's reviewed or LDraw-keyword
//      mapping, only when Rebrickable has no part with the LDraw number.
//   m  mould table: a hand-checked row of scripts/mould-joins.json (an
//      unjoined plain LDraw part whose number differs only by a mould letter
//      from a Rebrickable part that has mould (M) or alternate (A)
//      relationships), accepted only when the titles describe the same mould.
//
// Nothing else joins: no suffix is stripped, no print borrows its base part's
// colours and no mould is assumed equivalent without a checked row.

export type JoinRule = "k" | "=" | "b" | "m";

/** Rebrickable numbers a part's keywords name, in order, without duplicates. */
export function rebrickableKeywords(keywords: string | undefined) {
  const ids: string[] = [];
  for (const k of (keywords ?? "").split(",")) {
    const m = /^\s*rebrickable\s+(\S+)\s*$/i.exec(k);
    if (m && !ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
}

export type MouldRow = {
  ldraw: string;
  rebrickable: string;
  ldrawTitle: string;
  rebrickableName: string;
  /** Rebrickable relationships of the candidate's mould family. */
  relationships: string[];
  decision: "accept" | "reject" | "pending";
  note?: string;
  /** Date of the human decision. */
  checked?: string;
};

/**
 * The Rebrickable part a placeable LDraw part joins to, and the rule.
 * `coloured(part_num)` says whether Rebrickable records any colour for it;
 * `exists(part_num)` whether Rebrickable has the part at all.
 */
export function joinRebrickablePart(input: {
  name: string;
  keywords?: string;
  brickLinkItem?: string;
  mould?: Map<string, string>;
  coloured: (part: string) => boolean;
  exists: (part: string) => boolean;
}): { rb: string; rule: JoinRule } | null {
  const number = input.name.replace(/\.dat$/i, "");
  const stated = rebrickableKeywords(input.keywords);
  if (stated.length === 1 && input.coloured(stated[0]))
    return { rb: stated[0], rule: "k" };
  // A file naming several Rebrickable numbers is ambiguous, and one naming a
  // different number Rebrickable records no colours for says the LDraw
  // number is not Rebrickable's: no join at all, not even an exact one.
  if (stated.length > 1 || (stated.length === 1 && stated[0] !== number))
    return null;
  if (input.coloured(number)) return { rb: number, rule: "=" };
  if (
    !input.exists(number) &&
    input.brickLinkItem &&
    input.brickLinkItem !== number &&
    input.coloured(input.brickLinkItem)
  )
    return { rb: input.brickLinkItem, rule: "b" };
  const mould = input.mould?.get(input.name);
  if (mould && !input.exists(number) && input.coloured(mould))
    return { rb: mould, rule: "m" };
  return null;
}

/**
 * Candidates for the mould table: placeable plain LDraw parts (digits with at
 * most one mould letter) that no other rule joins, that Rebrickable does not
 * have and whose file names no Rebrickable number, where a Rebrickable part
 * with the same digits (bare or with a mould letter) has mould (M) or
 * alternate (A) relationships. Every candidate still needs a human decision.
 */
export function mouldCandidates(input: {
  entries: readonly (readonly [string, string, string, string?])[];
  joined: Set<string>;
  exists: (part: string) => boolean;
  rbName: (part: string) => string | undefined;
  /** Rebrickable part_num → "M:other" / "A:other" relationships. */
  relationships: Map<string, string[]>;
}): MouldRow[] {
  const rows: MouldRow[] = [];
  for (const [name, title, category, keywords] of input.entries) {
    if (input.joined.has(name) || title.startsWith("~")) continue;
    if (/^(Moved|Sticker)/.test(category)) continue;
    const m = /^(\d+)([a-z]?)\.dat$/.exec(name);
    if (!m) continue;
    const number = m[1] + m[2];
    if (input.exists(number) || rebrickableKeywords(keywords).length) continue;
    for (const letter of ["", ..."abcdefgh"]) {
      const rb = m[1] + letter;
      if (rb === number || !input.exists(rb)) continue;
      const rel = input.relationships.get(rb);
      if (!rel?.length) continue;
      rows.push({
        ldraw: name,
        rebrickable: rb,
        ldrawTitle: title,
        rebrickableName: input.rbName(rb) ?? "",
        relationships: [...rel].sort(),
        decision: "pending",
      });
    }
  }
  return rows;
}

/** Candidates merged with earlier decisions (by LDraw and Rebrickable part). */
export function mergeMouldDecisions(
  candidates: MouldRow[],
  previous: MouldRow[],
): MouldRow[] {
  const key = (r: MouldRow) => r.ldraw + "|" + r.rebrickable;
  const earlier = new Map(previous.map((r) => [key(r), r]));
  return candidates.map((c) => {
    const p = earlier.get(key(c));
    return p
      ? {
          ...c,
          decision: p.decision,
          ...(p.note ? { note: p.note } : {}),
          ...(p.checked ? { checked: p.checked } : {}),
        }
      : c;
  });
}

/** Accepted rows, refusing an LDraw part accepted for two Rebrickable parts. */
export function acceptedMoulds(rows: MouldRow[]) {
  const out = new Map<string, string>();
  for (const r of rows) {
    if (r.decision !== "accept") continue;
    if (out.has(r.ldraw) && out.get(r.ldraw) !== r.rebrickable)
      throw new Error("Mould table accepts two parts for " + r.ldraw);
    out.set(r.ldraw, r.rebrickable);
  }
  return out;
}

const STOP = new Set([
  "with",
  "without",
  "and",
  "for",
  "the",
  "type",
  "part",
  "pattern",
  "print",
  "printed",
  "modified",
  "special",
]);
const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/×/g, " x ")
    .replace(/[^a-z0-9./ ]+/g, " ")
    .replace(/(\d)\s*x\s*(?=\d)/g, "$1 x ")
    .replace(/\s+/g, " ")
    .trim();
/** Each "a x b [x c]" dimension group, its numbers sorted (LDraw writes
 * 1 x 2 where Rebrickable may write 2 x 1). */
function dimensions(s: string) {
  return [
    ...s.matchAll(
      /(\d+(?:\.\d+)?(?: \d\/\d)?)(?: x (\d+(?:\.\d+)?(?: \d\/\d)?))+/g,
    ),
  ]
    .map((m) =>
      m[0]
        .split(" x ")
        .map((n) => n.trim())
        .sort()
        .join(" x "),
    )
    .sort();
}
const words = (s: string) =>
  new Set(
    s.split(" ").filter((w) => w.length >= 3 && !/^\d/.test(w) && !STOP.has(w)),
  );
/** "with X" in one title and "without X" in the other. */
function negationConflict(a: string, b: string) {
  const w = (s: string, k: string) =>
    new Set(
      [...s.matchAll(new RegExp(`\\b${k} (\\w+)`, "g"))].map((m) => m[1]),
    );
  const aWith = w(a, "with"),
    aWithout = w(a, "without"),
    bWith = w(b, "with"),
    bWithout = w(b, "without");
  for (const x of aWith) if (bWithout.has(x)) return x;
  for (const x of aWithout) if (bWith.has(x)) return x;
  return null;
}

/**
 * Whether an LDraw title and a Rebrickable part name plausibly describe the
 * same part: equal dimension groups (both or neither), no "with X" against
 * "without X", and at least one shared descriptive word. A lead for review
 * and a precondition for promotion, never proof on its own.
 */
export function titlesAgree(
  ldrawTitle: string,
  rebrickableName: string,
): { agree: boolean; reason: string } {
  const a = normalise(ldrawTitle.replace(/^[~=_]+/, "")),
    b = normalise(rebrickableName);
  const da = dimensions(a),
    db = dimensions(b);
  if (da.join("|") !== db.join("|"))
    return {
      agree: false,
      reason: `dimensions differ (${da.join(", ") || "none"} / ${db.join(", ") || "none"})`,
    };
  const conflict = negationConflict(a, b);
  if (conflict)
    return { agree: false, reason: `"with ${conflict}" against "without"` };
  const wa = words(a),
    wb = words(b);
  const shared = [...wa].filter(
    (w) => wb.has(w) || wb.has(w + "s") || wb.has(w.replace(/s$/, "")),
  );
  if (!shared.length) return { agree: false, reason: "no shared words" };
  return {
    agree: true,
    reason: `${da.length ? "same dimensions, " : ""}shared: ${shared.slice(0, 4).join(", ")}`,
  };
}
