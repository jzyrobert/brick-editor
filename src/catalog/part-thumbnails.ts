/**
 * Sprite-sheet thumbnails of the complete official library's placeable parts
 * (scripts/build-part-thumbnails.ts). Pure data and lookup helpers shared by
 * the browser loader, the build and the validator.
 *
 * Trust chain: part-thumbnails-lock.json pins index.json by sha256; the index
 * pins every sheet by the sha256 of its bytes (sheets/<sha256>.webp).
 */
import lock from "./part-thumbnails-lock.json";

export const PART_THUMBNAILS_FORMAT = "brick-editor-part-thumbnails/1";
/** Directory under public/thumbnails/ (one per complete-library release). */
export const thumbnailPackId = "ldraw-full-2026-09-28";
export const partThumbnailsLock: {
  packId: string;
  indexSha256: string;
  indexBytes: number;
} = lock;

export type PartThumbnailSheet = {
  /** [sha256, bytes] of the WebP sheet: white bodies on transparent. */
  image: [string, number];
  /** [sha256, bytes] of the tint mask sheet, when any cell has a print. */
  mask?: [string, number];
  /** Part per cell, row-major. */
  parts: string[];
  /** Cells whose tint mask differs from the silhouette (print, fixed colours). */
  printed: number[];
};
export type PartThumbnailIndex = {
  format: typeof PART_THUMBNAILS_FORMAT;
  packId: string;
  /** The complete library the sheets were rendered from. */
  library: { releaseId: string; manifestSha256: string };
  /** Cell size (px) and cells per row. */
  cell: number;
  columns: number;
  sheets: PartThumbnailSheet[];
  /** Placeable parts the renderer could not draw (they keep an outline). */
  unrendered: string[];
};
export const sheetPath = (sha256: string) => `sheets/${sha256}.webp`;

export type PartThumbnailLocation = {
  sheet: number;
  cell: number;
  printed: boolean;
};
/** Part → sheet and cell. Throws on a part listed twice. */
export function locateThumbnails(index: PartThumbnailIndex) {
  const where = new Map<string, PartThumbnailLocation>();
  index.sheets.forEach((s, sheet) => {
    const printed = new Set(s.printed);
    s.parts.forEach((id, cell) => {
      if (where.has(id)) throw new Error("Thumbnail listed twice: " + id);
      where.set(id, { sheet, cell, printed: printed.has(cell) });
    });
  });
  return where;
}
/** CSS background/mask size and position (percentages) of one cell, so the
 * sprite scales with its element. */
export function cellStyle(
  index: PartThumbnailIndex,
  at: PartThumbnailLocation,
) {
  const columns = index.columns;
  const rows = Math.ceil(index.sheets[at.sheet].parts.length / columns);
  const col = at.cell % columns,
    row = Math.floor(at.cell / columns);
  const pct = (i: number, n: number) => (n > 1 ? (i / (n - 1)) * 100 : 0);
  return {
    size: `${columns * 100}% ${rows * 100}%`,
    position: `${pct(col, columns)}% ${pct(row, rows)}%`,
  };
}
