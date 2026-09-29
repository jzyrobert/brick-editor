// Builds the placeable catalogue, the library bundle, the curated marketplace
// mapping pack, their locks and the LDraw notices from the fetched library pack
// (scripts/fetch-library.py), the curated part list (scripts/catalog-parts.json)
// and the reviewed BrickLink evidence (scripts/bricklink-review.json).
// Run `npm run library:bounds` afterwards, then `npm run library:connectors`
// (connector pack and snapVerified flags), then build-thumbnails.ts.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { sourceBounds, sourceDependencies } from "../src/core/spatial";
import { deriveKeywordMappings } from "./marketplace-mappings";

type Options = {
  tags?: string[];
  keywords?: string;
  glass?: boolean;
  /** Stud footprint when protrusions (handles, clips, leaves) widen the box. */
  footprint?: [number, number];
  /** Local x/z offset (0 or 10 LDU) that puts the body on the stud grid. */
  align?: [number, number];
};
type Review = {
  name: string;
  itemId: string | null;
  note?: string;
  retrieved: string;
  candidates: Record<
    string,
    {
      title: string;
      knownColors: number[];
      source: string;
      colorSource: string;
    } | null
  >;
};
const spec = JSON.parse(readFileSync("scripts/catalog-parts.json", "utf8")) as {
  libraryRelease: string;
  categories: string[];
  parts: [string, string, string, Options][];
};
const reviews = JSON.parse(
  readFileSync("scripts/bricklink-review.json", "utf8"),
) as Record<string, Review>;
const release = spec.libraryRelease;
const root = `public/libraries/${release}/`;
const digest = (s: string | Buffer) =>
  createHash("sha256").update(s).digest("hex");
const previous = existsSync("src/catalog/data.json")
  ? JSON.parse(readFileSync("src/catalog/data.json", "utf8"))
  : undefined;

// 1. Pack manifest: exact per-file hashes, plus one byte-exact bundle (every file
// concatenated in manifest order) so the renderer loads the pack in one request.
const manifest = JSON.parse(readFileSync(root + "manifest.json", "utf8"));
const chunks: Buffer[] = [];
for (const f of manifest.files) {
  const bytes = readFileSync(root + f.path);
  f.sha256 = digest(bytes);
  f.bytes = bytes.length;
  chunks.push(bytes);
}
const bundle = Buffer.concat(chunks);
writeFileSync(root + "bundle.txt", bundle);
manifest.bundle = {
  path: "bundle.txt",
  sha256: digest(bundle),
  bytes: bundle.length,
  layout: "Concatenation of every file's exact bytes in manifest order",
};
writeFileSync(root + "manifest.json", JSON.stringify(manifest, null, 2) + "\n");

// 2. Dimensions from real source bounds (LDU, LDraw axes: −Y up, origin on the
// body top for ordinary parts). Footprint snaps to whole studs.
const sources: Record<string, string> = Object.fromEntries(
  manifest.files
    .filter((f: { path: string }) => f.path !== "LDConfig.ldr")
    .map((f: { path: string }) => [
      f.path.replace(/^(parts|p)\//, ""),
      readFileSync(root + f.path, "utf8"),
    ]),
);
const closure = sourceDependencies(sources).transitive;
const fileHash = Object.fromEntries(
  manifest.files.map((f: { path: string; sha256: string }) => [
    f.path.replace(/^(parts|p)\//, ""),
    f.sha256,
  ]),
);
const round = (n: number) => Math.round(n * 1000) / 1000;
const studs = (extent: number) => Math.max(1, Math.round(extent / 20)) * 20;
const rectangular = /^(Brick|Plate) \d+ × \d+$/;
/** Grid phase of one axis: the body edge nearest a 10-LDU line must land on a
 * stud-cell boundary (a multiple of 20), so the origin sits at 0 or 10 mod 20. */
const phase = (min: number, max: number) => {
  const off = (v: number) => Math.abs(v - Math.round(v / 10) * 10);
  const edge = off(max) < off(min) ? max : min;
  const r = (((-edge % 20) + 20) % 20) / 10;
  return Math.round(r) % 2 ? 10 : 0;
};
const categories = new Set(spec.categories);

// 3. Marketplace mapping: only individually reviewed BrickLink identities; a
// colour is verified for an item only if BrickLink lists it among the item's
// known colours. LDraw → BrickLink colour identities come from the checked
// join table (scripts/color-joins.ts: LEGO colour numbers recorded by LDConfig
// and BrickLink's colour guide), written by `npm run library:colors`.
const colorJoins = JSON.parse(
  readFileSync("scripts/color-joins.json", "utf8"),
) as { colors: { code: string; bricklink?: { bricklink: number } }[] };
const paletteToBrickLink: Record<string, string> = Object.fromEntries(
  colorJoins.colors
    .filter((c) => c.bricklink)
    .map((c) => [c.code, String(c.bricklink!.bricklink)]),
);
const mappedParts: Record<
  string,
  { itemId: string; verifiedColors: string[]; source: string }
> = {};
const unmapped: Record<string, string> = {};

const dependencyHash = (id: string) =>
  digest(
    [...closure[id]]
      .sort()
      .map((ref) => ref + ":" + fileHash[ref])
      .join("\n"),
  );
const unchangedSnap = (id: string) => {
  const before = previous?.catalog?.[id];
  return (
    !!before?.snapVerified &&
    before.geometryHash === fileHash[id] &&
    before.dependencyHash === dependencyHash(id)
  );
};
const catalog = Object.fromEntries(
  spec.parts.map(([number, name, category, options]) => {
    const id = number + ".dat";
    if (!categories.has(category)) throw new Error("Unknown category " + id);
    for (const tag of options.tags ?? [])
      if (!categories.has(tag)) throw new Error("Unknown tag " + tag);
    const box = sourceBounds(sources, id);
    if (!box) throw new Error("No geometry " + id);
    const review = reviews[number];
    if (!review) throw new Error("No BrickLink review for " + id);
    let aliases: string[] = [];
    if (review.itemId) {
      const evidence = review.candidates[review.itemId];
      if (!evidence) throw new Error("Unreviewed item " + review.itemId);
      mappedParts["official:" + id] = {
        itemId: review.itemId,
        verifiedColors: Object.entries(paletteToBrickLink)
          .filter(([, bl]) => evidence.knownColors.includes(Number(bl)))
          .map(([code]) => code),
        source: evidence.source,
      };
      if (review.itemId !== number) aliases = [review.itemId];
    } else unmapped["official:" + id] = review.note ?? "Not reviewed";
    return [
      id,
      {
        id,
        name,
        width: options.footprint
          ? options.footprint[0] * 20
          : studs(box.max[0] - box.min[0]),
        depth: options.footprint
          ? options.footprint[1] * 20
          : studs(box.max[2] - box.min[2]),
        align: options.align ?? [
          phase(box.min[0], box.max[0]),
          phase(box.min[2], box.max[2]),
        ],
        // Placement rests the part's lowest point on the plane.
        height: round(box.max[1]),
        category,
        ...(options.tags?.length ? { tags: options.tags } : {}),
        ...(options.keywords ? { keywords: options.keywords } : {}),
        ...(aliases.length ? { aliases } : {}),
        // A stud row rises 4 LDU above the body top at the origin.
        studded: Math.abs(box.min[1] + 4) < 0.01,
        fillable: rectangular.test(name),
        ...(options.glass ? { glass: true } : {}),
        bounds: {
          min: box.min.map(round),
          max: box.max.map(round),
        },
        source: "official",
        // Set by build-connectors.ts (npm run library:connectors); kept
        // while the part's geometry and dependency closure are unchanged.
        snapVerified: unchangedSnap(id),
        inventoryBoundary: true,
        geometryHash: fileHash[id],
        dependencyHash: dependencyHash(id),
        thumbnail: `thumbnails/${release}/${number}.webp`,
      },
    ];
  }),
);
// Derived mappings for every other official part, from the LDraw part files'
// own BrickLink keywords (scripts/marketplace-mappings.ts). Written as a
// separate file pinned here by hash, so the pack stays one locked identity
// while the app loads the large table only when an inventory is built.
const fullLock = JSON.parse(
  readFileSync("src/catalog/full-library-lock.json", "utf8"),
);
const fullRoot = `public/libraries/${fullLock.releaseId}/`;
const fullManifest = JSON.parse(
  readFileSync(fullRoot + "manifest.json", "utf8"),
);
const fullCatalogBytes = readFileSync(fullRoot + fullManifest.catalog.path);
if (digest(fullCatalogBytes) !== fullManifest.catalog.sha256)
  throw new Error("Complete library catalogue does not match its manifest");
const derived = deriveKeywordMappings({
  catalog: JSON.parse(fullCatalogBytes.toString()),
  library: {
    releaseId: fullLock.releaseId,
    manifestSha256: fullLock.manifestSha256,
  },
  curated: new Set(Object.keys(catalog)),
  derivedDate: "2026-09-29",
});
writeFileSync(
  "src/catalog/mappings-derived.json",
  JSON.stringify(derived) + "\n",
);
// A new complete-library release changes the derived table, and with it the
// pack's identity; the previous pack is then retired (kept in scripts/retired/).
const mapping = {
  id: "curated-catalogue-4+" + derived.id,
  version: 4,
  license:
    "CC0-1.0 (original curated factual correspondences); derived table CC BY 4.0 (LDraw part metadata, see derived.license)",
  verifiedDate: "2026-09-29",
  source:
    "Individually reviewed public BrickLink catalogue pages (title and known colours per item, scripts/bricklink-review.json); no bulk catalogue copied. Colour identities: scripts/color-joins.json (LEGO colour numbers in LDConfig and BrickLink's colour guide)",
  colorSource: "https://v2.bricklink.com/catalog/color-guide",
  parts: mappedParts,
  unmapped,
  colors: paletteToBrickLink,
  derived: {
    id: derived.id,
    path: "src/catalog/mappings-derived.json",
    sha256: digest(readFileSync("src/catalog/mappings-derived.json")),
    confidence: derived.confidence,
    license: derived.license,
    source: derived.source,
    mapped: derived.coverage.mapped,
    ambiguous: derived.coverage.ambiguous,
  },
};
if (
  previous?.mappingLock &&
  previous.mappingLock.mappingPackId !== mapping.id
) {
  const retiredFile = `scripts/retired/mappings-${previous.mappingLock.mappingPackId}.json`;
  if (!existsSync(retiredFile))
    writeFileSync(retiredFile, readFileSync("src/catalog/mappings.json"));
}
writeFileSync(
  "src/catalog/mappings.json",
  JSON.stringify(mapping, null, 2) + "\n",
);

// 4. Locks. A superseded release's lock is retained (never silently dropped) so
// projects pinned to it can be checked against this pack and re-pinned with a
// record of the previous lock. Rebuilding the same release just replaces it.
const lock = {
  releaseId: manifest.releaseId,
  manifestSha256: digest(readFileSync(root + "manifest.json")),
  colorConfigSha256: digest(readFileSync(root + "LDConfig.ldr")),
};
const mappingLock = {
  mappingPackId: mapping.id,
  mappingPackSha256: digest(readFileSync("src/catalog/mappings.json")),
};
const retire = <T extends Record<string, string>>(
  list: T[] | undefined,
  old: T | undefined,
  key: keyof T,
  current: T,
) =>
  [...(list ?? []), ...(old && old[key] !== current[key] ? [old] : [])].filter(
    (l, i, all) =>
      l[key] !== current[key] && all.findIndex((m) => m[key] === l[key]) === i,
  );
writeFileSync(
  "src/catalog/data.json",
  JSON.stringify(
    {
      categories: spec.categories,
      catalog,
      libraryLock: lock,
      retiredLibraryLocks: retire(
        previous?.retiredLibraryLocks,
        previous?.libraryLock,
        "releaseId",
        lock,
      ),
      mappingLock,
      // Rewritten by build-connectors.ts, which must run after this script.
      ...(previous?.connectorLock
        ? { connectorLock: previous.connectorLock }
        : {}),
      retiredMappingLocks: retire(
        previous?.retiredMappingLocks,
        previous?.mappingLock,
        "mappingPackId",
        mappingLock,
      ),
    },
    null,
    2,
  ) + "\n",
);

// 5. Notices: every distributed file with its authors and licence.
writeFileSync(
  "public/notices/LDRAW.txt",
  `LDraw official library subset (${release}); originals retain author and licence headers.\nCC BY 4.0: https://creativecommons.org/licenses/by/4.0/\nLDraw.org Parts Library agreement: see LDRAW-CAreadme.txt\nSource: https://library.ldraw.org/\nNo geometry modifications. See library manifest for individual authors and hashes.\nCatalogue thumbnails are renderings of these unmodified files.\nConnectors (studs, side studs, jumper studs, anti-studs, hinge pins and sockets) and body occupancy boxes in connector pack ldraw-derived-connectors-2 (src/catalog/connectors.json) are derived from these files by scripts/build-connectors.ts and carry this attribution.\nConnectors and occupancy boxes for the complete official library (public/libraries/connectors-ldraw-full-*/, scripts/build-full-connectors.ts) are derived from the complete library's files in the same way and carry the same attribution.\nDerived marketplace mappings (src/catalog/mappings-derived.json) are the BrickLink numbers the official part files state in their own !KEYWORDS lines (LDraw.org Parts Library metadata, CC BY 4.0), taken unmodified.\nThe complete official library (public/libraries/ldraw-full-*/, loaded on demand for parts outside this subset) is the unmodified official complete.zip content; see its NOTICE.txt, CAreadme.txt and CAlicense4.txt. Every file keeps its own author and licence header.\nThe Play figure is assembled at runtime from unmodified official minifig part files in their own pack (public/libraries/avatar-minifig-*/, scripts/build-avatar-pack.ts); see LDRAW-AVATAR.txt for its files, authors and licences.\n` +
    manifest.files
      .map(
        (f: { path: string; authors: string[]; license: string[] }) =>
          `${f.path}: ${f.authors.join("; ")} — ${f.license.join("; ")}`,
      )
      .join("\n") +
    "\n",
);
console.log(
  JSON.stringify({
    release,
    parts: Object.keys(catalog).length,
    files: manifest.files.length,
    bundleBytes: bundle.length,
    mapped: Object.keys(mappedParts).length,
    unmapped: Object.keys(unmapped).length,
    derivedMapped: derived.coverage.mapped,
    derivedAmbiguous: derived.coverage.ambiguous,
  }),
);
