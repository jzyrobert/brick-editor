// Official LEGO set models from the LDraw Official Model Repository (OMR).
//
// The model files stay on library.ldraw.org. It sends no CORS headers, so the
// app fetches them through a same-origin, allowlisted, edge-cached proxy
// (functions/api/omr/[file].ts on Cloudflare Pages; the Vite dev and preview
// servers proxy the same path). Only a small metadata index is committed
// (src/catalog/omr-index.json, built by scripts/build-omr-index.ts from the
// public set listing). See docs/OFFICIAL-MODELS.md.
//
// This module is pure: the Pages Function, the build script and the app all
// import it.

/** Where the OMR model files live upstream. */
export const OMR_UPSTREAM = "https://library.ldraw.org/library/omr/";
/** Same-origin proxy path (relative to the app's base URL). */
export const OMR_PROXY_PATH = "api/omr/";
/** Public set page on library.ldraw.org (the attribution link). */
export const omrSetPage = (id: number) =>
  `https://library.ldraw.org/omr/sets/${id}`;
export const OMR_HOME = "https://library.ldraw.org/omr";
export const OMR_LICENSE_NAME = "CC BY 2.0";
export const OMR_LICENSE_URL = "https://creativecommons.org/licenses/by/2.0/";

export type OmrSet = {
  /** Set number with variant, e.g. "10002-1". */
  number: string;
  name: string;
  /** Theme path as the OMR lists it, e.g. "Train > 9V". */
  theme: string;
  year: number;
  /** Model files in the OMR for this set (main model plus alternates). */
  models: number;
  /** OMR set page id (library.ldraw.org/omr/sets/<id>). */
  id: number;
};

/** Committed index: rows are `[number, name, theme, year, models, id]`. */
export type OmrIndexFile = {
  source: string;
  retrieved: string;
  license: string;
  count: number;
  sets: [string, string, string, number, number, number][];
};

export function decodeOmrIndex(file: OmrIndexFile): OmrSet[] {
  return file.sets.map(([number, name, theme, year, models, id]) => ({
    number,
    name,
    theme,
    year,
    models,
    id,
  }));
}

/** File name of a set's main model. The OMR names every main model after
 * its set number (alternates add a suffix and are not offered). */
export const omrFileName = (set: Pick<OmrSet, "number">) => `${set.number}.mpd`;

/** Model file names the proxy forwards: a plain OMR file name, no path. */
export function omrFileAllowed(name: string) {
  return (
    name.length <= 120 && /^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:mpd|ldr)$/.test(name)
  );
}

const fold = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/** Search by set number, name, theme or year. Every query word must match
 * (a word matches the start of a number, or appears in the name, theme or
 * year). Exact and prefix set-number matches rank first, then name matches,
 * then newer sets. */
export function searchOmr(sets: OmrSet[], query: string, limit = 30) {
  const words = fold(query)
    .split(/[\s,]+/)
    .filter(Boolean);
  if (!words.length) return [];
  const scored: { set: OmrSet; score: number }[] = [];
  for (const set of sets) {
    const number = set.number.toLowerCase(),
      bare = number.replace(/-\d+$/, ""),
      name = fold(set.name),
      theme = fold(set.theme),
      year = String(set.year);
    let score = 0,
      ok = true;
    for (const w of words) {
      if (number === w || bare === w) score += 100;
      else if (number.startsWith(w)) score += 50;
      else if (new RegExp("\\b" + escape(w)).test(name)) score += 20;
      else if (name.includes(w)) score += 10;
      else if (theme.includes(w)) score += 5;
      else if (year === w) score += 5;
      else {
        ok = false;
        break;
      }
    }
    if (ok) scored.push({ set, score });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.set.year - a.set.year ||
      a.set.number.localeCompare(b.set.number, "en", { numeric: true }),
  );
  return scored.slice(0, limit).map((s) => s.set);
}
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type OmrAttribution = {
  /** Set number the file is for, when it names one. */
  setNumber?: string;
  /** `0 Name:` of the main model. */
  name?: string;
  /** Authors from the header (`0 Author:`), in order, without duplicates. */
  authors: string[];
  /** The file's own licence line (`0 !LICENSE`). */
  license: string;
};

/** Attribution read from an OMR file's header: its first (main) model's
 * header with a CCAL/CC BY licence, marked `0 !LDRAW_ORG Model` or named
 * after a set number. Returns undefined
 * for files that are not OMR models. The header lines stay in the file (and
 * in the project, which exports them unchanged). */
export function omrAttribution(
  lines: readonly string[],
): OmrAttribution | undefined {
  let files = 0,
    official = false,
    license = "",
    name: string | undefined;
  const authors: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (/^0\s+FILE\s/i.test(line)) {
      if (++files > 1) break;
      continue;
    }
    if (/^[1-5]\s/.test(line)) break; // The header ends at the first content.
    let m: RegExpMatchArray | null;
    if (/^0\s+!LDRAW_ORG\s+Model\b/i.test(line)) official = true;
    else if ((m = line.match(/^0\s+!LICENSE\s+(.+)$/i))) license = m[1].trim();
    else if ((m = line.match(/^0\s+Name:\s*(.+)$/i))) name ??= m[1].trim();
    else if ((m = line.match(/^0\s+Author:\s*(.+)$/i))) {
      const a = m[1].trim();
      if (a && !authors.includes(a)) authors.push(a);
    }
  }
  const setNumber = name?.match(/^(\d+[A-Za-z]*(?:-\d+)?)(?![\w-])/)?.[1];
  // Some OMR files omit `!LDRAW_ORG Model`; their Name is the set number.
  if (!(official || setNumber) || !/\b(?:CCAL|CC BY)\b/i.test(license))
    return undefined;
  return { setNumber, name, authors, license };
}

/** One-line credit, e.g. "TotalyWicked · CC BY 2.0 · LDraw OMR". */
export function omrCredit(a: OmrAttribution) {
  return `${a.authors.length ? a.authors.join(", ") : "Unknown author"} · ${OMR_LICENSE_NAME} · LDraw OMR`;
}

/** Plain-text check that proxied bytes are an LDraw file, not an HTML error
 * page: the first nonblank line is an LDraw line. */
export function looksLikeLDraw(text: string) {
  const first = text.replace(/^﻿/, "").match(/^\s*(\S.*)$/m)?.[1] ?? "";
  return /^[0-5](?:\s|$)/.test(first);
}
