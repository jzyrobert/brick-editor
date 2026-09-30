// Maintainer review of marketplace mappings beyond the curated catalogue.
//
//   npm run library:review-mappings                 worklist only
//   npm run library:review-mappings -- --limit 300  longer worklist
//   npm run library:review-mappings -- --accept 3068bp01.dat,4865b.dat
//   npm run library:review-mappings -- --reject 1234.dat --note "why"
//
// 1. Worklist (.local/mapping-worklist.json, not committed): the most common
//    official parts outside the curated catalogue, ranked by occurrences in
//    the bundled sample builds, then by how many Rebrickable set inventories
//    the part appears in (its Rebrickable part joined by scripts/part-joins.ts).
//    Each row carries the evidence a reviewer needs: the LDraw title and
//    category, the BrickLink number(s) the part file's own keywords state
//    (the derived mapping, or the ambiguous candidates), the Rebrickable part
//    and its name, Rebrickable mould/alternate relationships, a title check
//    and a proposal.
// 2. Decisions (scripts/mapping-review.json, committed): `--accept` promotes a
//    derived mapping to the reviewed tier with its evidence; `--reject` records
//    that it must stay derived (the note says why). The catalogue build
//    (scripts/build-parts.ts) copies accepted rows into mappings.json
//    `reviewed`, only while the LDraw file still states the same number.
//
// Evidence comes only from open data that may be redistributed: the LDraw
// part files' own keywords (CC BY 4.0) and Rebrickable's database downloads
// (free with attribution). Nothing is fetched from BrickLink: BrickLink's
// terms do not allow automated collection. A reviewed mapping is therefore
// "cross-checked" (two open sources agree), never "catalogue verified", and
// exports still ask for acknowledgement. Parts without a stated BrickLink
// number are listed for a person to check by hand in a browser; their item
// number is never made from the LDraw file name.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { catalog } from "../src/catalog/catalog";
import { template } from "../src/catalog/templates";
import { SAMPLE_TEMPLATES } from "../src/catalog/template-names";
import { registerScriptTemplatesFromDisk } from "./script-templates-node";
import { occurrences } from "../src/core/document";
import { fullLibraryLock } from "../src/catalog/full-library";
import { printVariants } from "../src/catalog/print-variants";
import {
  joinRebrickablePart,
  rebrickableKeywords,
  titlesAgree,
} from "./part-joins";
import { csv, readSnapshot, snapshotFile } from "./rebrickable-data";

export const REVIEW_FILE = "scripts/mapping-review.json";
export const REVIEW_METHOD = "ldraw-keyword+rebrickable-name";

export type ReviewDecision = {
  itemId: string;
  decision: "promote" | "reject";
  method: typeof REVIEW_METHOD;
  confidence: "cross-checked";
  evidence: {
    ldrawTitle: string;
    bricklinkKeyword: string;
    rebrickablePart: string;
    rebrickableName: string;
    rebrickableJoin: string;
    rebrickableSets: number;
    titleCheck: string;
  };
  reviewed: string;
  reviewer: string;
  note?: string;
};
export type ReviewFile = {
  note: string;
  library: string;
  rebrickable: string;
  parts: Record<string, ReviewDecision>;
};

export type WorkRow = {
  rank: number;
  part: string;
  title: string;
  category: string;
  status: "derived" | "ambiguous" | "unmapped" | "reviewed" | "rejected";
  samples: number;
  rebrickableSets: number;
  bricklink: string[];
  rebrickable?: { part: string; name: string; join: string };
  relationships: string[];
  titleCheck?: { agree: boolean; reason: string };
  proposal: "promote" | "check-by-hand" | "keep";
  why: string;
};

type Entry = readonly [string, string, string, string?];

/**
 * The proposal for one part: promote only a derived mapping (one stated
 * BrickLink number) whose number Rebrickable also uses for the part (the
 * part file names that Rebrickable number, or names none and Rebrickable has
 * the number), with agreeing titles and no Rebrickable mould family.
 */
export function propose(input: {
  entry: Entry;
  derived?: string;
  ambiguous?: string[];
  rbName: (part: string) => string | undefined;
  relationships: (part: string) => string[];
}): Pick<WorkRow, "proposal" | "why" | "titleCheck"> & { rb?: string } {
  const [, title, , keywords] = input.entry;
  if (input.ambiguous?.length)
    return {
      proposal: "check-by-hand",
      why: `The part file names ${input.ambiguous.length} BrickLink numbers; a person must choose.`,
    };
  if (!input.derived)
    return {
      proposal: "check-by-hand",
      why: "The part file states no BrickLink number; check the BrickLink catalogue by hand (never use the file name).",
    };
  const x = input.derived;
  const stated = rebrickableKeywords(keywords);
  if (stated.length > 1)
    return {
      proposal: "keep",
      why: "The part file names several Rebrickable numbers.",
    };
  if (stated.length === 1 && stated[0] !== x)
    return {
      proposal: "keep",
      why: `Rebrickable numbers it ${stated[0]}, not ${x}: no second source for the BrickLink number.`,
    };
  const name = input.rbName(x);
  if (name === undefined)
    return {
      proposal: "keep",
      why: `Rebrickable has no part ${x}: no second source.`,
    };
  const check = titlesAgree(title, name);
  if (!check.agree)
    return {
      proposal: "keep",
      why: `Titles disagree: ${check.reason}.`,
      titleCheck: check,
      rb: x,
    };
  const moulds = input.relationships(x).filter((r) => r.startsWith("M:"));
  if (moulds.length)
    return {
      proposal: "check-by-hand",
      why: `Rebrickable ${x} has mould variants (${moulds.join(", ")}); check which mould the LDraw file models.`,
      titleCheck: check,
      rb: x,
    };
  return {
    proposal: "promote",
    why: `LDraw keyword BrickLink ${x}; Rebrickable uses ${x} for "${name}" (${check.reason}).`,
    titleCheck: check,
    rb: x,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const limit = Number(flag("--limit") ?? 200);
  const today = new Date().toISOString().slice(0, 10);
  const reviewer = flag("--reviewer") ?? "maintainer";

  const root = `public/libraries/${fullLibraryLock.releaseId}/`;
  const manifest = JSON.parse(readFileSync(root + "manifest.json", "utf8"));
  const entries = (
    JSON.parse(readFileSync(root + manifest.catalog.path, "utf8")) as Entry[]
  ).filter(
    ([, title, category]) =>
      !title.startsWith("~") &&
      category !== "Moved" &&
      !/^Sticker/.test(category),
  );
  const byName = new Map(entries.map((e) => [e[0], e]));
  const derived = JSON.parse(
    readFileSync("src/catalog/mappings-derived.json", "utf8"),
  ) as { parts: Record<string, string>; ambiguous: Record<string, string[]> };
  const review: ReviewFile = existsSync(REVIEW_FILE)
    ? JSON.parse(readFileSync(REVIEW_FILE, "utf8"))
    : {
        note: "",
        library: fullLibraryLock.releaseId,
        rebrickable: "",
        parts: {},
      };

  // Rebrickable: names, relationships, set inventories per part.
  const snapshot = readSnapshot();
  const rbNames = new Map<string, string>();
  for (const r of csv(await snapshotFile(snapshot, "parts")))
    rbNames.set(r.part_num, r.name);
  const rel = new Map<string, string[]>();
  for (const r of csv(await snapshotFile(snapshot, "part_relationships"))) {
    if (r.rel_type !== "M" && r.rel_type !== "A") continue;
    for (const [a, b] of [
      [r.child_part_num, r.parent_part_num],
      [r.parent_part_num, r.child_part_num],
    ])
      rel.set(a, [...(rel.get(a) ?? []), r.rel_type + ":" + b]);
  }
  const sets = new Map<string, Set<string>>();
  for (const r of csv(await snapshotFile(snapshot, "inventory_parts"))) {
    let s = sets.get(r.part_num);
    if (!s) sets.set(r.part_num, (s = new Set()));
    s.add(r.inventory_id);
  }
  const setCount = (p: string) => sets.get(p)?.size ?? 0;

  // Sample builds: occurrences per official part.
  const samples = new Map<string, number>();
  registerScriptTemplatesFromDisk();
  for (const name of SAMPLE_TEMPLATES)
    for (const o of occurrences(template(name)))
      if (o.namespace === "official")
        samples.set(o.node.ref, (samples.get(o.node.ref) ?? 0) + 1);

  // Decisions.
  // A list, or @file with a comma-separated list.
  const list = (value = "") =>
    (value.startsWith("@") ? readFileSync(value.slice(1), "utf8") : value)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  const accept = list(flag("--accept"));
  const reject = list(flag("--reject"));
  const note = flag("--note");
  for (const name of [...accept, ...reject]) {
    const entry = byName.get(name);
    if (!entry) throw new Error("Unknown or unplaceable part " + name);
    const itemId = derived.parts[name];
    if (!itemId)
      throw new Error(
        `${name} has no derived mapping: its part file states no single BrickLink number, so there is nothing to review here (check it by hand and add it to the curated catalogue instead).`,
      );
    const p = propose({
      entry,
      derived: itemId,
      rbName: (x) => rbNames.get(x),
      relationships: (x) => rel.get(x) ?? [],
    });
    const promoting = accept.includes(name);
    if (promoting && p.proposal !== "promote")
      throw new Error(
        `${name} does not meet the promotion evidence rules: ${p.why}`,
      );
    review.parts[name] = {
      itemId,
      decision: promoting ? "promote" : "reject",
      method: REVIEW_METHOD,
      confidence: "cross-checked",
      evidence: {
        ldrawTitle: entry[1],
        bricklinkKeyword: itemId,
        rebrickablePart: p.rb ?? "",
        rebrickableName: p.rb ? (rbNames.get(p.rb) ?? "") : "",
        rebrickableJoin: p.rb
          ? rebrickableKeywords(entry[3]).includes(p.rb)
            ? "keyword"
            : "number"
          : "",
        rebrickableSets: p.rb ? setCount(p.rb) : 0,
        titleCheck: p.titleCheck?.reason ?? p.why,
      },
      reviewed: today,
      reviewer,
      ...(note ? { note } : {}),
    };
  }
  if (accept.length || reject.length) {
    review.note =
      "Reviewed marketplace mappings beyond the curated catalogue (scripts/review-mappings.ts). A promoted row is a derived mapping (the BrickLink number the LDraw part file states) that a reviewer checked against a second open source: Rebrickable uses the same number for the part and its name agrees with the LDraw title. Confidence is cross-checked, not catalogue verified: BrickLink pages are not fetched. Rejected rows stay derived.";
    review.library = fullLibraryLock.releaseId;
    review.rebrickable = snapshot.retrieved;
    review.parts = Object.fromEntries(
      Object.entries(review.parts).sort(([a], [b]) => a.localeCompare(b)),
    );
    writeFileSync(REVIEW_FILE, JSON.stringify(review, null, 2) + "\n");
  }

  const curated = new Set(Object.keys(catalog));
  const prints = printVariants(entries).baseOf;
  const rows: WorkRow[] = [];
  for (const entry of entries) {
    const [name, title, category, keywords] = entry;
    if (curated.has(name)) continue;
    const join = joinRebrickablePart({
      name,
      keywords,
      brickLinkItem: derived.parts[name],
      coloured: (p) => sets.has(p),
      exists: (p) => rbNames.has(p),
    });
    const rbSets = join ? setCount(join.rb) : 0;
    const sampleCount = samples.get(name) ?? 0;
    if (!sampleCount && !rbSets) continue;
    const p = propose({
      entry,
      derived: derived.parts[name],
      ambiguous: derived.ambiguous[name],
      rbName: (x) => rbNames.get(x),
      relationships: (x) => rel.get(x) ?? [],
    });
    const decided = review.parts[name];
    rows.push({
      rank: 0,
      part: name,
      title,
      category,
      status: decided
        ? decided.decision === "promote"
          ? "reviewed"
          : "rejected"
        : derived.ambiguous[name]
          ? "ambiguous"
          : derived.parts[name]
            ? "derived"
            : "unmapped",
      samples: sampleCount,
      rebrickableSets: rbSets,
      bricklink:
        derived.ambiguous[name] ??
        (derived.parts[name] ? [derived.parts[name]] : []),
      ...(join
        ? {
            rebrickable: {
              part: join.rb,
              name: rbNames.get(join.rb) ?? "",
              join: join.rule,
            },
          }
        : {}),
      relationships: join ? (rel.get(join.rb) ?? []) : [],
      ...(p.titleCheck ? { titleCheck: p.titleCheck } : {}),
      proposal: decided ? "keep" : p.proposal,
      why: decided
        ? `Decided ${decided.reviewed}: ${decided.decision}${decided.note ? " (" + decided.note + ")" : ""}`
        : p.why + (prints.has(name) ? " Printed variant." : ""),
    });
  }
  rows.sort(
    (a, b) =>
      b.samples - a.samples ||
      b.rebrickableSets - a.rebrickableSets ||
      a.part.localeCompare(b.part),
  );
  rows.forEach((r, i) => (r.rank = i + 1));

  mkdirSync(".local", { recursive: true });
  const top = rows.slice(0, limit);
  writeFileSync(
    ".local/mapping-worklist.json",
    JSON.stringify(
      {
        generated: today,
        library: fullLibraryLock.releaseId,
        rebrickable: snapshot.retrieved,
        ranking:
          "Occurrences in the bundled sample builds, then the number of Rebrickable set inventories the part's Rebrickable part appears in.",
        rows: top,
      },
      null,
      2,
    ) + "\n",
  );
  const count = (k: WorkRow["proposal"]) =>
    top.filter((r) => r.proposal === k).length;
  console.log(
    JSON.stringify(
      {
        worklist: ".local/mapping-worklist.json",
        rows: top.length,
        promote: count("promote"),
        checkByHand: count("check-by-hand"),
        keep: count("keep"),
        reviewed: Object.values(review.parts).filter(
          (r) => r.decision === "promote",
        ).length,
        accepted: accept.length,
        rejected: reject.length,
      },
      null,
      1,
    ),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
