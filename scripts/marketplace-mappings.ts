// Derived marketplace mappings for official parts beyond the curated,
// individually reviewed catalogue mappings (scripts/build-parts.ts).
//
// Source: the LDraw library's own part metadata. LDraw part authors record a
// part's BrickLink number as a `0 !KEYWORDS BrickLink <item>` line when it
// differs from the LDraw number; the complete pack's catalog.json carries
// every part's keywords. The data is CC BY 4.0 like the rest of the library,
// ships offline and needs no marketplace access, so the build may
// redistribute it. Rules (spec §6.6):
// - only an explicit keyword maps a part; a part without one stays unmapped
//   (an item number is never made by stripping ".dat" or a suffix);
// - two different BrickLink numbers for one part are ambiguous, not mapped;
// - stickers (sold on sheets), "~" parts (not standalone in LDraw's own
//   classification) and moved-part stubs are not mapped;
// - no colour is verified for a derived mapping: part/colour existence is
//   unknown until reviewed, so exports need the unknown-colour acknowledgement,
//   and the mapping itself is reported as derived, not verified.
import type { FullPackCatalogEntry } from "../src/catalog/full-pack";

export type DerivedMappings = {
  id: string;
  version: number;
  confidence: "derived";
  license: string;
  source: string;
  library: { releaseId: string; manifestSha256: string };
  derivedDate: string;
  rules: string;
  /** Official reference name → BrickLink part item number. */
  parts: Record<string, string>;
  /** Parts naming more than one BrickLink number (a user must choose). */
  ambiguous: Record<string, string[]>;
  coverage: {
    officialParts: number;
    mapped: number;
    ambiguous: number;
    excluded: Record<string, number>;
    /** LDraw category → [parts, mapped]. */
    byCategory: Record<string, [number, number]>;
  };
};

const ITEM = /^[\w.-]+$/;
/** BrickLink numbers a part's keywords name, in order, without duplicates. */
export function brickLinkKeywords(keywords: string | undefined) {
  const ids: string[] = [];
  for (const k of (keywords ?? "").split(",")) {
    const m = /^\s*bricklink\s+(\S+)\s*$/i.exec(k);
    if (m && !ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
}

/** Why a part is not mapped from its keywords at all, or null. */
export function keywordExclusion(entry: FullPackCatalogEntry) {
  const [, title, category] = entry;
  if (/^~Moved to /i.test(title) || category === "Moved") return "moved";
  if (/^Sticker/.test(category)) return "sticker";
  if (title.startsWith("~")) return "not-standalone";
  return null;
}

export function deriveKeywordMappings(options: {
  catalog: FullPackCatalogEntry[];
  library: { releaseId: string; manifestSha256: string };
  /** Parts with a curated (reviewed) mapping or decision: left to it. */
  curated: Set<string>;
  derivedDate: string;
}): DerivedMappings {
  const parts: Record<string, string> = {};
  const ambiguous: Record<string, string[]> = {};
  const excluded: Record<string, number> = {};
  const byCategory: Record<string, [number, number]> = {};
  for (const entry of options.catalog) {
    const [name, , category, keywords] = entry;
    const row = (byCategory[category || "Other"] ??= [0, 0]);
    row[0]++;
    if (options.curated.has(name)) continue;
    const ids = brickLinkKeywords(keywords).filter((id) => ITEM.test(id));
    if (!ids.length) continue;
    const why = keywordExclusion(entry);
    if (why) {
      excluded[why] = (excluded[why] ?? 0) + 1;
      continue;
    }
    if (ids.length > 1) {
      ambiguous[name] = ids;
      continue;
    }
    parts[name] = ids[0];
    row[1]++;
  }
  return {
    id: "ldraw-keywords-" + options.library.releaseId,
    version: 1,
    confidence: "derived",
    license:
      "CC BY 4.0: part metadata of the LDraw.org Parts Library (see the complete pack's NOTICE.txt and CAreadme.txt); correspondences taken unmodified from each part file's !KEYWORDS line",
    source: `!KEYWORDS "BrickLink <item>" lines of the official LDraw part files in ${options.library.releaseId} (manifest sha256 ${options.library.manifestSha256})`,
    library: options.library,
    derivedDate: options.derivedDate,
    rules:
      "An explicit BrickLink keyword maps a part; no keyword, no mapping (numbers are never made from file names). Two different numbers: ambiguous. Stickers, ~ parts and moved stubs are not mapped. No colour is verified; every derived mapping is reported as derived, not catalogue verified.",
    parts,
    ambiguous,
    coverage: {
      officialParts: options.catalog.length,
      mapped: Object.keys(parts).length,
      ambiguous: Object.keys(ambiguous).length,
      excluded,
      byCategory: Object.fromEntries(
        Object.entries(byCategory).sort(
          (a, b) => b[1][0] - a[1][0] || a[0].localeCompare(b[0]),
        ),
      ),
    },
  };
}
