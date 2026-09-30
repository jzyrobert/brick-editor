// Builds src/catalog/omr-index.json, the small metadata index of the LDraw
// Official Model Repository (set number, name, theme, year, model count and
// OMR page id) from its public set listing, https://library.ldraw.org/omr/sets.
// The model files themselves are not downloaded: the app fetches them live
// through the same-origin proxy (docs/OFFICIAL-MODELS.md).
//
// Politeness: one listing page at a time (25 sets per page, about 60 pages),
// with a pause between requests and an identifying User-Agent. Run by hand
// when the OMR grows; the index is committed, not rebuilt in CI.
//
//   npm run omr:index
import { writeFileSync } from "node:fs";
import type { OmrIndexFile } from "../src/catalog/omr";

const LISTING = "https://library.ldraw.org/omr/sets";
const USER_AGENT =
  "brick-editor OMR index builder (+https://bricks.robertj.in; one-off, 1 req/1.5 s)";
const PAUSE_MS = 1500;
const OUTPUT = new URL("../src/catalog/omr-index.json", import.meta.url);

const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};
const text = (html: string) =>
  html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[\da-f]+|\w+);/gi, (m, e: string) =>
      e[0] === "#"
        ? String.fromCodePoint(
            e[1] === "x" || e[1] === "X"
              ? parseInt(e.slice(2), 16)
              : Number(e.slice(1)),
          )
        : (entities[e.toLowerCase()] ?? m),
    )
    .replace(/\s+/g, " ")
    .trim();

type Row = OmrIndexFile["sets"][number];

/** Rows of one listing page (Filament table cells keyed
 * `table.record.<id>.column.<column>`), plus the total the page reports. */
export function parseOmrListing(html: string): { rows: Row[]; total?: number } {
  const cells = new Map<number, Record<string, string>>();
  const cell =
    /<td\b[^>]*wire:key="[^"]*\.table\.record\.(\d+)\.column\.([\w.]+)"[^>]*>([\s\S]*?)<\/td>/g;
  for (const m of html.matchAll(cell)) {
    const id = Number(m[1]);
    const row = cells.get(id) ?? {};
    row[m[2]] = text(m[3]);
    cells.set(id, row);
  }
  const rows: Row[] = [];
  for (const [id, c] of cells) {
    const number = c.number ?? "";
    if (!/^[\w.]+-\d+$/.test(number)) continue;
    rows.push([
      number,
      c.name ?? "",
      c["theme.name"] ?? "",
      Number(c.year) || 0,
      Number(c.models_count) || 1,
      id,
    ]);
  }
  const total = html.match(/of\s+([\d,]+)\s+results/)?.[1];
  return { rows, total: total ? Number(total.replace(/,/g, "")) : undefined };
}

async function main() {
  const rows = new Map<string, Row>();
  let total: number | undefined;
  for (let page = 1; page < 200; page++) {
    const res = await fetch(`${LISTING}?page=${page}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) throw new Error(`Listing page ${page}: HTTP ${res.status}`);
    const parsed = parseOmrListing(await res.text());
    total ??= parsed.total;
    for (const r of parsed.rows) rows.set(r[0], r);
    process.stdout.write(`page ${page}: ${rows.size}/${total ?? "?"}\n`);
    if (!parsed.rows.length || (total && rows.size >= total)) break;
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  if (!total || rows.size < total)
    throw new Error(`Read ${rows.size} of ${total ?? "?"} sets`);
  const sets = [...rows.values()].sort((a, b) =>
    a[0].localeCompare(b[0], "en", { numeric: true }),
  );
  const index: OmrIndexFile = {
    source: LISTING,
    retrieved: new Date().toISOString().slice(0, 10),
    license:
      "Set facts from the LDraw.org OMR listing. Model files are CC BY 2.0 (CCAL 2.0); each credits its author.",
    count: sets.length,
    sets,
  };
  // One set per line: small diffs when the OMR grows.
  writeFileSync(
    OUTPUT,
    '{\n  "source": ' +
      JSON.stringify(index.source) +
      ',\n  "retrieved": ' +
      JSON.stringify(index.retrieved) +
      ',\n  "license": ' +
      JSON.stringify(index.license) +
      ',\n  "count": ' +
      index.count +
      ',\n  "sets": [\n' +
      sets.map((s) => "    " + JSON.stringify(s)).join(",\n") +
      "\n  ]\n}\n",
  );
  console.log(`Wrote ${sets.length} sets to ${OUTPUT.pathname}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
