// Checks the complete library's sprite-sheet thumbnail pack
// (public/thumbnails/<pack id>/, scripts/build-part-thumbnails.ts): the index
// matches its lock, every sheet matches its content address and size, every
// placeable part of the complete pack has exactly one cell (or is listed as
// unrendered), and nothing else is in the pack directory.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { catalog } from "../src/catalog/catalog";
import { fullLibraryLock } from "../src/catalog/full-library";
import type {
  FullPackCatalogEntry,
  FullPackIndex,
} from "../src/catalog/full-pack";
import {
  PART_THUMBNAILS_FORMAT,
  locateThumbnails,
  partThumbnailsLock,
  sheetPath,
  type PartThumbnailIndex,
} from "../src/catalog/part-thumbnails";

const hash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

/** Canvas size of a WebP file (VP8X, VP8L or VP8 bitstream). */
export function webpSize(b: Uint8Array) {
  const text = (from: number, n: number) =>
    String.fromCharCode(...b.subarray(from, from + n));
  if (text(0, 4) !== "RIFF" || text(8, 4) !== "WEBP")
    throw new Error("Not a WebP image");
  const chunk = text(12, 4);
  const u24 = (i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
  if (chunk === "VP8X") return { width: u24(24) + 1, height: u24(27) + 1 };
  if (chunk === "VP8L") {
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8 ")
    return {
      width: (b[26] | (b[27] << 8)) & 0x3fff,
      height: (b[28] | (b[29] << 8)) & 0x3fff,
    };
  throw new Error("Unknown WebP bitstream " + chunk);
}

export function validatePartThumbnails({
  publicRoot = "public/",
}: { publicRoot?: string } = {}) {
  const dir = `${publicRoot}thumbnails/${partThumbnailsLock.packId}/`;
  const raw = readFileSync(dir + "index.json");
  if (
    hash(raw) !== partThumbnailsLock.indexSha256 ||
    raw.length !== partThumbnailsLock.indexBytes
  )
    throw new Error("Part thumbnail index does not match its lock");
  const index = JSON.parse(raw.toString()) as PartThumbnailIndex;
  if (index.format !== PART_THUMBNAILS_FORMAT)
    throw new Error("Unknown part thumbnail format");
  if (index.packId !== partThumbnailsLock.packId)
    throw new Error("Part thumbnail pack id mismatch");
  if (
    index.library.releaseId !== fullLibraryLock.releaseId ||
    index.library.manifestSha256 !== fullLibraryLock.manifestSha256
  )
    throw new Error("Part thumbnails were rendered from another library");

  // Every placeable part (not curated, not a moved-to redirect, with bounds)
  // has one cell or is listed as unrendered; nothing else is listed.
  const fullDir = `${publicRoot}libraries/${fullLibraryLock.releaseId}/`;
  const manifest = JSON.parse(readFileSync(fullDir + "manifest.json", "utf8"));
  const fullIndex = JSON.parse(
    readFileSync(fullDir + manifest.index.path, "utf8"),
  ) as FullPackIndex;
  const entries = JSON.parse(
    readFileSync(fullDir + manifest.catalog.path, "utf8"),
  ) as FullPackCatalogEntry[];
  const placeable = new Set(
    entries
      .filter(
        ([id, title]) =>
          !title.startsWith("~Moved") &&
          !Object.hasOwn(catalog, id) &&
          !!fullIndex.parts[id]?.[1],
      )
      .map(([id]) => id),
  );
  const where = locateThumbnails(index);
  const unrendered = new Set(index.unrendered);
  for (const id of where.keys())
    if (!placeable.has(id))
      throw new Error("Thumbnail for a part the picker does not list: " + id);
  for (const id of unrendered)
    if (!placeable.has(id) || where.has(id))
      throw new Error("Bad unrendered entry: " + id);
  for (const id of placeable)
    if (!where.has(id) && !unrendered.has(id))
      throw new Error("Part has no thumbnail: " + id);

  // Sheets: content-addressed, pinned sizes, the grid the index declares.
  const expected = new Set<string>();
  let bytes = 0;
  index.sheets.forEach((s, n) => {
    const cells = s.parts.length;
    if (!cells || cells > index.columns * index.columns)
      throw new Error("Bad sheet cell count " + n);
    if (s.printed.some((c) => c < 0 || c >= cells))
      throw new Error("Printed cell out of range in sheet " + n);
    if (s.printed.length && !s.mask)
      throw new Error("Printed cells without a mask in sheet " + n);
    const rows = Math.ceil(cells / index.columns);
    for (const pin of [s.image, s.mask]) {
      if (!pin) continue;
      const [sha, size] = pin;
      const path = sheetPath(sha);
      expected.add(path);
      const b = readFileSync(dir + path);
      if (b.length !== size || hash(b) !== sha)
        throw new Error("Thumbnail sheet hash mismatch: " + path);
      const { width, height } = webpSize(b);
      if (width !== index.cell * index.columns || height !== index.cell * rows)
        throw new Error("Thumbnail sheet size mismatch: " + path);
      bytes += size;
    }
  });
  const present = existsSync(dir + "sheets")
    ? readdirSync(dir + "sheets").map((f) => "sheets/" + f)
    : [];
  for (const f of present)
    if (!expected.has(f)) throw new Error("Unlisted thumbnail file: " + f);
  for (const f of readdirSync(dir))
    if (f !== "index.json" && f !== "sheets")
      throw new Error("Unlisted thumbnail file: " + f);
  return {
    packId: index.packId,
    parts: where.size,
    unrendered: index.unrendered.length,
    printed: index.sheets.reduce((n, s) => n + s.printed.length, 0),
    sheets: index.sheets.length,
    files: expected.size + 1,
    bytes: bytes + raw.length,
  };
}
