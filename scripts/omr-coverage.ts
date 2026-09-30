// Reports how well LDraw OMR set models resolve against the committed complete
// LDraw pack: for a deterministic sample of the index (or the set numbers
// given), fetch each main model from library.ldraw.org (politely, one at a
// time with a pause), import it offline and count unresolved part references,
// embedded (unofficial) parts, STEP lines and header attribution.
//
//   npm run omr:coverage -- [--sample 50] [--output report.json] [set ...]
import { writeFileSync } from "node:fs";
import { importLDraw } from "../src/ldraw/io";
import {
  OMR_UPSTREAM,
  decodeOmrIndex,
  omrAttribution,
  omrFileName,
  type OmrIndexFile,
} from "../src/catalog/omr";
import indexFile from "../src/catalog/omr-index.json";
import { registerFullLibraryFromDisk } from "./full-library-node";

const USER_AGENT =
  "brick-editor OMR coverage check (+https://bricks.robertj.in; 1 req/2 s)";
const PAUSE_MS = 2000;

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const value = args[i + 1];
  args.splice(i, 2);
  return value;
};
const sampleSize = Number(flag("--sample") ?? 50);
const output = flag("--output");
const sets = decodeOmrIndex(indexFile as unknown as OmrIndexFile);
const chosen = args.length
  ? args.map((n) => {
      const set = sets.find((s) => s.number === n);
      if (!set) throw new Error("Not in the OMR index: " + n);
      return set;
    })
  : Array.from(
      { length: Math.min(sampleSize, sets.length) },
      (_, i) => sets[Math.floor(((i + 0.5) * sets.length) / sampleSize)],
    );

if (!registerFullLibraryFromDisk())
  throw new Error("The complete LDraw pack is not built (public/libraries)");

type Row = {
  set: string;
  status: "ok" | "missing-file" | "error";
  bytes?: number;
  parts?: number;
  missingRefs?: string[];
  missingUses?: number;
  embeddedParts?: number;
  steps?: number;
  authors?: string[];
  error?: string;
};
const rows: Row[] = [];
for (const [i, set] of chosen.entries()) {
  if (i) await new Promise((r) => setTimeout(r, PAUSE_MS));
  const res = await fetch(OMR_UPSTREAM + omrFileName(set), {
    headers: { "User-Agent": USER_AGENT },
  });
  if (res.status === 404) {
    rows.push({ set: set.number, status: "missing-file" });
    console.log(set.number, "no main model file");
    continue;
  }
  try {
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    const p = importLDraw(text, omrFileName(set), { profile: "desktop" });
    const missing = new Map<string, number>();
    let parts = 0,
      embedded = 0;
    for (const m of Object.values(p.models)) {
      if (m.classification === "custom") embedded++;
      for (const n of m.nodes)
        if (n.kind === "part" && !p.models[n.ref]) {
          parts++;
          const ref = n.ref;
          if (
            p.diagnostics.some(
              (d) =>
                d.code === "REFERENCE_MISSING" &&
                (d.details as { ref?: string })?.ref === ref,
            )
          )
            missing.set(ref, (missing.get(ref) ?? 0) + 1);
        }
    }
    const steps = text
      .split(/\r?\n/)
      .filter((l) => /^\s*0\s+(?:ROT)?STEP\b/i.test(l)).length;
    const row: Row = {
      set: set.number,
      status: "ok",
      bytes: text.length,
      parts,
      missingRefs: [...missing.keys()],
      missingUses: [...missing.values()].reduce((a, b) => a + b, 0),
      embeddedParts: embedded,
      steps,
      authors: omrAttribution(text.split(/\r?\n/, 400))?.authors ?? [],
    };
    rows.push(row);
    console.log(
      set.number,
      `${parts} part lines, ${row.missingUses} unresolved (${missing.size} distinct), ${embedded} embedded, ${steps} steps, by ${row.authors!.join(", ") || "?"}`,
    );
  } catch (e) {
    rows.push({ set: set.number, status: "error", error: String(e) });
    console.log(set.number, "error", String(e));
  }
}
const ok = rows.filter((r) => r.status === "ok");
const summary = {
  sampled: rows.length,
  opened: ok.length,
  missingFile: rows.filter((r) => r.status === "missing-file").length,
  errors: rows.filter((r) => r.status === "error").length,
  fullyResolved: ok.filter((r) => !r.missingRefs!.length).length,
  partLines: ok.reduce((n, r) => n + r.parts!, 0),
  unresolvedLines: ok.reduce((n, r) => n + r.missingUses!, 0),
  withSteps: ok.filter((r) => r.steps! > 0).length,
  withAuthor: ok.filter((r) => r.authors!.length > 0).length,
  withEmbeddedParts: ok.filter((r) => r.embeddedParts! > 0).length,
  distinctMissing: [...new Set(ok.flatMap((r) => r.missingRefs!))].sort(),
};
console.log(JSON.stringify(summary, null, 2));
if (output) writeFileSync(output, JSON.stringify({ summary, rows }, null, 2));
