// Builds the colour-availability pack: for every placeable official part, the
// LDraw colours it has really been produced in, with provenance.
//   npm run library:colors              (from the pinned snapshot)
//   npm run library:colors -- --refresh (new Rebrickable + BrickLink snapshot)
//
// Sources (see docs/ARCHITECTURE.md "Colour availability"):
// - verified: the known colours BrickLink lists for each reviewed catalogue
//   item (scripts/bricklink-review.json), for curated parts only;
// - derived: Rebrickable's database downloads (elements.csv and
//   inventory_parts.csv: the colours each part_num was made in as an element
//   or appears in in a set inventory), joined by part number: the LDraw number
//   itself, else the BrickLink number of the part's reviewed or LDraw-keyword
//   mapping. No suffix is stripped and no mould is assumed equivalent: a part
//   no rule reaches has unknown availability.
// - colour identities: scripts/color-joins.ts (LEGO colour numbers recorded
//   by LDConfig and by BrickLink's colour guide; Rebrickable names).
//
// The raw CSVs are not committed: they are downloaded into
// .cache/rebrickable/<retrieved>/ and checked against the sha256 recorded in
// scripts/rebrickable-snapshot.json. Outputs:
//   scripts/color-joins.json             checked colour join table (evidence)
//   src/catalog/colors.json              picker palette (bundled)
//   src/catalog/color-availability.json  the pack (lazily loaded)
//   src/catalog/color-availability-lock.json
//   public/notices/REBRICKABLE.txt       attribution
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  colourGroup,
  joinBrickLink,
  joinRebrickable,
  parseLDConfig,
  type BrickLinkColour,
} from "./color-joins";
import {
  COLOR_AVAILABILITY_FORMAT,
  type ColorAvailabilityPack,
  type PackPart,
} from "../src/catalog/color-availability";

const refresh = process.argv.includes("--refresh");
const hash = (b: Uint8Array | string) =>
  createHash("sha256").update(b).digest("hex");
const AGENT = "Mozilla/5.0 (brick-editor colour availability build)";
const RB_BASE = "https://cdn.rebrickable.com/media/downloads/";
const RB_FILES = ["colors", "parts", "elements", "inventory_parts"] as const;
const SNAPSHOT = "scripts/rebrickable-snapshot.json";
const BL_COLOURS = "scripts/bricklink-colors.json";
const BL_GUIDE = "https://www.bricklink.com/catalogColors.asp";
const today = new Date().toISOString().slice(0, 10);

type Snapshot = {
  retrieved: string;
  source: string;
  license: string;
  files: Record<string, { url: string; sha256: string; bytes: number }>;
};
async function download(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": AGENT } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

// ---- 1. Pinned Rebrickable snapshot.
let snapshot: Snapshot | undefined = existsSync(SNAPSHOT)
  ? JSON.parse(readFileSync(SNAPSHOT, "utf8"))
  : undefined;
if (refresh || !snapshot) {
  const dir = `.cache/rebrickable/${today}/`;
  mkdirSync(dir, { recursive: true });
  const files: Snapshot["files"] = {};
  for (const f of RB_FILES) {
    const url = RB_BASE + f + ".csv.gz";
    const bytes = await download(url);
    writeFileSync(dir + f + ".csv.gz", bytes);
    files[f] = { url, sha256: hash(bytes), bytes: bytes.length };
  }
  snapshot = {
    retrieved: today,
    source: "https://rebrickable.com/downloads/",
    license:
      "Rebrickable database downloads, free to use with attribution to Rebrickable (https://rebrickable.com)",
    files,
  };
  writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2) + "\n");
  // BrickLink's colour guide: id, name, LEGO name and type of every colour.
  const page = new TextDecoder()
    .decode(await download(BL_GUIDE))
    .replaceAll('\\"', '"');
  const found = new Map<number, BrickLinkColour>();
  for (const m of page.matchAll(/\{"cntGear":[^{}]*?\}/g)) {
    const o = JSON.parse(m[0]);
    found.set(o.id, {
      id: o.id,
      name: o.name,
      ...(o.legoName ? { legoName: o.legoName } : {}),
      colorType: o.colorType,
    });
  }
  if (found.size < 150)
    throw new Error("BrickLink colour guide: only " + found.size + " colours");
  writeFileSync(
    BL_COLOURS,
    JSON.stringify(
      {
        retrieved: today,
        source: BL_GUIDE + " (redirects to the v2 colour guide)",
        note: "Factual colour identities (BrickLink id, name, LEGO name and number, colour type) read from BrickLink's public colour guide; used only to join colour identities.",
        colors: [...found.values()].sort((a, b) => a.id - b.id),
      },
      null,
      2,
    ) + "\n",
  );
}
const csvCache = `.cache/rebrickable/${snapshot.retrieved}/`;
/** Verified bytes of one snapshot file: cache, else the same URL (which
 * must still serve identical bytes; otherwise run with --refresh). */
async function rebrickable(name: string) {
  const f = snapshot!.files[name];
  const path = csvCache + name + ".csv.gz";
  let bytes = existsSync(path) ? new Uint8Array(readFileSync(path)) : undefined;
  if (!bytes || hash(bytes) !== f.sha256) {
    bytes = await download(f.url);
    if (hash(bytes) !== f.sha256)
      throw new Error(
        `${name}.csv.gz no longer matches the pinned snapshot of ${snapshot!.retrieved}; run with --refresh to take a new one`,
      );
    mkdirSync(csvCache, { recursive: true });
    writeFileSync(path, bytes);
  }
  return gunzipSync(bytes).toString("utf8");
}
/** Minimal RFC 4180 CSV reader (quoted fields, doubled quotes). */
function* csv(text: string) {
  let header: string[] | undefined;
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i <= text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === undefined) {
      if (ch === undefined && !field && !row.length) break;
      row.push(field.replace(/\r$/, ""));
      field = "";
      if (!header) header = row;
      else yield Object.fromEntries(header.map((h, j) => [h, row[j]]));
      row = [];
    } else field += ch;
  }
}

// ---- 2. Colour identities.
const catalogueLock = JSON.parse(readFileSync("src/catalog/data.json", "utf8"))
  .libraryLock as { releaseId: string; colorConfigSha256: string };
const ldconfigBytes = readFileSync(
  `public/libraries/${catalogueLock.releaseId}/LDConfig.ldr`,
);
if (hash(ldconfigBytes) !== catalogueLock.colorConfigSha256)
  throw new Error("LDConfig.ldr does not match the library lock");
const ldraw = parseLDConfig(ldconfigBytes.toString("utf8"));
const blGuide = JSON.parse(readFileSync(BL_COLOURS, "utf8")) as {
  retrieved: string;
  source: string;
  colors: BrickLinkColour[];
};
const toBrickLink = joinBrickLink(ldraw, blGuide.colors);
const rbColours = [...csv(await rebrickable("colors"))].map((r) => ({
  id: r.id,
  name: r.name,
}));
const rb = joinRebrickable(rbColours, ldraw, blGuide.colors, toBrickLink);
const blToLdraw = new Map(
  Object.entries(toBrickLink).map(([code, j]) => [j.bricklink, code]),
);

// ---- 3. Placeable parts of the pinned complete library.
const fullLock = JSON.parse(
  readFileSync("src/catalog/full-library-lock.json", "utf8"),
) as { releaseId: string; manifestSha256: string };
const fullRoot = `public/libraries/${fullLock.releaseId}/`;
const fullManifest = JSON.parse(
  readFileSync(fullRoot + "manifest.json", "utf8"),
);
if (hash(readFileSync(fullRoot + "manifest.json")) !== fullLock.manifestSha256)
  throw new Error("Complete library manifest does not match its lock");
const catalogBytes = readFileSync(fullRoot + fullManifest.catalog.path);
if (hash(catalogBytes) !== fullManifest.catalog.sha256)
  throw new Error("Complete library catalogue does not match its manifest");
const entries = (
  JSON.parse(catalogBytes.toString()) as [string, string, string, string?][]
).filter(
  ([, title, category]) => !title.startsWith("~Moved") && category !== "Moved",
);

// Reviewed (curated) BrickLink items and LDraw-keyword BrickLink numbers.
type Review = {
  itemId: string | null;
  retrieved: string;
  candidates: Record<string, { knownColors: number[] } | null>;
};
const reviews = JSON.parse(
  readFileSync("scripts/bricklink-review.json", "utf8"),
) as Record<string, Review>;
const derivedMappings = JSON.parse(
  readFileSync("src/catalog/mappings-derived.json", "utf8"),
) as { parts: Record<string, string> };

// ---- 4. Rebrickable colours per part_num.
const rbColoursOf = new Map<string, Set<string>>();
const unjoinedRb = new Map<string, number>();
const addRb = (part: string, colour: string) => {
  const j = rb.joins[colour];
  if (!j) {
    unjoinedRb.set(colour, (unjoinedRb.get(colour) ?? 0) + 1);
    return;
  }
  let set = rbColoursOf.get(part);
  if (!set) rbColoursOf.set(part, (set = new Set()));
  set.add(j.ldraw);
};
for (const r of csv(await rebrickable("elements")))
  addRb(r.part_num, r.color_id);
for (const r of csv(await rebrickable("inventory_parts")))
  addRb(r.part_num, r.color_id);
const rbParts = new Set(
  [...csv(await rebrickable("parts"))].map((r) => r.part_num),
);

// ---- 5. Per-part availability.
const byCode = (a: string, b: string) => Number(a) - Number(b);
const parts: Record<string, PackPart> = {};
const coverage = {
  placeable: entries.length,
  known: 0,
  verified: 0,
  derivedExact: 0,
  derivedByBrickLinkItem: 0,
  rebrickablePartWithoutColours: 0,
  unknown: 0,
  /** LDraw category → [placeable, known]. */
  byCategory: {} as Record<string, [number, number]>,
};
const droppedBrickLink = new Map<number, number>();
for (const [name, , category, keywords] of entries) {
  const number = name.replace(/\.dat$/, "");
  const entry: PackPart = {};
  const review = reviews[number];
  if (review?.itemId && review.candidates[review.itemId]) {
    const codes = new Set<string>();
    for (const bl of review.candidates[review.itemId]!.knownColors) {
      const code = blToLdraw.get(bl);
      if (code) codes.add(code);
      else droppedBrickLink.set(bl, (droppedBrickLink.get(bl) ?? 0) + 1);
    }
    entry.v = [...codes].sort(byCode).map(Number);
    entry.bl = review.itemId;
  }
  const brickLinkItem =
    review?.itemId ?? derivedMappings.parts[name] ?? undefined;
  void keywords;
  if (rbColoursOf.has(number)) {
    entry.d = [...rbColoursOf.get(number)!].sort(byCode).map(Number);
    entry.rb = number;
    coverage.derivedExact++;
  } else if (
    !rbParts.has(number) &&
    brickLinkItem &&
    brickLinkItem !== number &&
    rbColoursOf.has(brickLinkItem)
  ) {
    entry.d = [...rbColoursOf.get(brickLinkItem)!].sort(byCode).map(Number);
    entry.rb = brickLinkItem;
    coverage.derivedByBrickLinkItem++;
  } else if (rbParts.has(number)) coverage.rebrickablePartWithoutColours++;
  const row = (coverage.byCategory[category || "Other"] ??= [0, 0]);
  row[0]++;
  if (entry.v?.length || entry.d?.length) {
    parts[name] = entry;
    coverage.known++;
    row[1]++;
    if (entry.v?.length) coverage.verified++;
  } else coverage.unknown++;
}
coverage.byCategory = Object.fromEntries(
  Object.entries(coverage.byCategory).sort(
    (a, b) => b[1][0] - a[1][0] || a[0].localeCompare(b[0]),
  ),
);

// ---- 6. Palette: offered colours that appear in the availability data.
const partsPerColour = new Map<string, number>();
for (const p of Object.values(parts))
  for (const c of new Set([...(p.v ?? []), ...(p.d ?? [])]))
    partsPerColour.set(String(c), (partsPerColour.get(String(c)) ?? 0) + 1);
/** Favourites shown first (phones show these before "More colours"), with
 * the swatch names and tints earlier releases used. */
const QUICK: Record<string, { name: string; hex: string }> = {
  "4": { name: "Red", hex: "#c91a09" },
  "1": { name: "Blue", hex: "#0055bf" },
  "14": { name: "Yellow", hex: "#f2cd37" },
  "15": { name: "White", hex: "#ffffff" },
  "0": { name: "Black", hex: "#1b2a34" },
  "71": { name: "Light grey", hex: "#a0a5a9" },
  "72": { name: "Dark grey", hex: "#6c6e68" },
  "2": { name: "Green", hex: "#237841" },
  "19": { name: "Tan", hex: "#e4cd9e" },
  "47": { name: "Clear", hex: "#eef3f5" },
};
/** Favourite order (object keys that look like integers would sort). */
const QUICK_ORDER = ["4", "1", "14", "15", "0", "71", "72", "2", "19", "47"];
/** Display names where LDConfig's would collide with a favourite's. */
const RENAMED: Record<string, string> = {
  "7": "Old light grey",
  "8": "Old dark grey",
};
const sentence = (s: string) => {
  const t = s.replace(/_/g, " ").toLowerCase();
  return t[0].toUpperCase() + t.slice(1);
};
const GROUPS = ["basic", "earth", "pastel", "transparent", "metallic"];
const palette = ldraw
  .filter(
    (c) =>
      QUICK[c.code] ||
      (colourGroup(c) && (partsPerColour.get(c.code) ?? 0) > 0),
  )
  .map((c) => {
    const group = colourGroup(c)!;
    return {
      code: c.code,
      name: QUICK[c.code]?.name ?? RENAMED[c.code] ?? sentence(c.name),
      hex: QUICK[c.code]?.hex ?? c.hex.toLowerCase(),
      group,
      ...(group === "transparent" ? { transparent: true } : {}),
      ...(QUICK[c.code] ? { quick: true } : {}),
      parts: partsPerColour.get(c.code) ?? 0,
    };
  })
  .sort(
    (a, b) =>
      Number(!a.quick) - Number(!b.quick) ||
      (a.quick
        ? QUICK_ORDER.indexOf(a.code) - QUICK_ORDER.indexOf(b.code)
        : GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) ||
          b.parts - a.parts ||
          Number(a.code) - Number(b.code)),
  );

// Thumbnails pick glass by tint hex (src/ui/PartThumbs.tsx), so every swatch
// hex is unique: a colour whose LDConfig value equals an earlier swatch's
// (Trans Red and the favourite Red tint, for example) is nudged by one step
// of blue, which no one can see.
{
  const taken = new Set<string>();
  for (const c of palette) {
    let n = parseInt(c.hex.slice(1), 16);
    while (taken.has("#" + n.toString(16).padStart(6, "0")))
      n = (n & 0xff) === 0xff ? n - 1 : n + 1;
    c.hex = "#" + n.toString(16).padStart(6, "0");
    taken.add(c.hex);
  }
}

// ---- 7. Outputs.
const joins = {
  note: "Checked colour identity table (scripts/color-joins.ts). Every LDraw colour of the pinned LDConfig with its BrickLink and Rebrickable joins and the rule that made each.",
  ldconfig: {
    releaseId: catalogueLock.releaseId,
    sha256: catalogueLock.colorConfigSha256,
  },
  bricklinkGuide: { retrieved: blGuide.retrieved, source: blGuide.source },
  rebrickable: {
    retrieved: snapshot.retrieved,
    sha256: snapshot.files.colors.sha256,
  },
  colors: ldraw.map((c) => ({
    code: c.code,
    name: c.name,
    ...(c.legoIds.length ? { lego: c.legoIds } : {}),
    ...(toBrickLink[c.code] ? { bricklink: toBrickLink[c.code] } : {}),
    rebrickable: Object.entries(rb.joins)
      .filter(([, j]) => j.ldraw === c.code)
      .map(([id, j]) => ({ id, rule: j.rule })),
  })),
  rebrickableConflicts: rb.conflicts,
  rebrickableUnjoined: rbColours
    .filter((r) => !rb.joins[r.id])
    .map((r) => `${r.id} ${r.name}`),
};
writeFileSync(
  "scripts/color-joins.json",
  JSON.stringify(joins, null, 2) + "\n",
);

const packId = `rebrickable-${snapshot.retrieved}+bricklink-review+${fullLock.releaseId}`;
const pack: ColorAvailabilityPack = {
  format: COLOR_AVAILABILITY_FORMAT,
  packId,
  library: fullLock,
  sources: {
    verified: {
      provenance: "verified",
      source:
        "Known colours BrickLink lists for each individually reviewed catalogue item (scripts/bricklink-review.json)",
      retrieved: [...new Set(Object.values(reviews).map((r) => r.retrieved))]
        .sort()
        .join(", "),
    },
    derived: {
      provenance: "derived",
      source:
        "Rebrickable database downloads (elements.csv, inventory_parts.csv); attribution in public/notices/REBRICKABLE.txt",
      retrieved: snapshot.retrieved,
      sha256: Object.fromEntries(
        Object.entries(snapshot.files).map(([k, f]) => [k, f.sha256]),
      ),
    },
    colours:
      "LDraw ↔ BrickLink by LEGO colour number (LDConfig LEGOID, BrickLink colour guide); Rebrickable ↔ LDraw by BrickLink colour name or id-and-name (scripts/color-joins.json)",
  },
  rules: [
    "v: LDraw colours of the BrickLink item's known colours (reviewed catalogue parts only): produced, catalogue verified. A colour absent from v is known not produced per BrickLink's catalogue.",
    "d: LDraw colours Rebrickable records for part_num `rb` as an element or in a set inventory: produced, derived (not catalogue verified). A colour absent from d is not recorded, which is not proof it was never made.",
    "rb is the LDraw number itself when Rebrickable has that part_num; otherwise the BrickLink number of the part's reviewed or LDraw-keyword mapping, only when Rebrickable has no part with the LDraw number.",
    "No suffix is stripped and no mould variant is merged: Rebrickable's mould relationships only link its own numbers, never an LDraw number it lacks, so such parts stay unknown.",
    "Parts absent from `parts` have unknown availability.",
  ],
  coverage,
  parts,
};
const packText = JSON.stringify(pack) + "\n";
writeFileSync("src/catalog/color-availability.json", packText);
writeFileSync(
  "src/catalog/color-availability-lock.json",
  JSON.stringify(
    { packId, sha256: hash(packText), bytes: Buffer.byteLength(packText) },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  "src/catalog/colors.json",
  JSON.stringify(
    {
      note: "Picker palette (scripts/build-color-availability.ts): LDConfig colours offered in the colour picker, favourites first, then by group and by how many parts are made in them. Hex values are swatch tints (LDConfig VALUE, earlier releases' tints for favourites); the renderer uses LDConfig.",
      groups: GROUPS,
      colors: palette,
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  "public/notices/REBRICKABLE.txt",
  `Colour availability (src/catalog/color-availability.json, pack ${packId})\n` +
    `Derived colour lists are based on data from Rebrickable (https://rebrickable.com),\n` +
    `database downloads retrieved ${snapshot.retrieved} from ${snapshot.source}:\n` +
    Object.entries(snapshot.files)
      .map(([k, f]) => `  ${k}.csv.gz  sha256 ${f.sha256}  ${f.bytes} bytes`)
      .join("\n") +
    `\nRebrickable makes these downloads available for free use with attribution. Only\n` +
    `derived part/colour facts are distributed; the CSV files themselves are not.\n` +
    `Verified colour lists come from BrickLink's public catalogue pages for individually\n` +
    `reviewed items (scripts/bricklink-review.json); colour identities from LDraw's\n` +
    `LDConfig.ldr (CC BY 4.0) and BrickLink's public colour guide (retrieved ${blGuide.retrieved}).\n` +
    `LEGO is a trademark of the LEGO Group, which does not sponsor or endorse this software.\n`,
);
console.log(
  JSON.stringify(
    {
      packId,
      bytes: Buffer.byteLength(packText),
      coverage: { ...coverage, byCategory: undefined },
      palette: palette.length,
      paletteByGroup: Object.fromEntries(
        GROUPS.map((g) => [g, palette.filter((c) => c.group === g).length]),
      ),
      ldrawToBrickLink: Object.keys(toBrickLink).length,
      rebrickableJoined: Object.keys(rb.joins).length,
      rebrickableConflicts: rb.conflicts,
      droppedBrickLinkColours: Object.fromEntries(droppedBrickLink),
      unjoinedRebrickableRows: Object.fromEntries(
        [...unjoinedRb].sort((a, b) => b[1] - a[1]).slice(0, 15),
      ),
    },
    null,
    1,
  ),
);
