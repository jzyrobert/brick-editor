import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  PART_THUMBNAILS_FORMAT,
  cellStyle,
  locateThumbnails,
  partThumbnailsLock,
  sheetPath,
  type PartThumbnailIndex,
} from "../../src/catalog/part-thumbnails";
import { groupResults, printVariants } from "../../src/catalog/print-variants";
import {
  fullLibraryCategories,
  searchFullLibrary,
} from "../../src/catalog/search";
import { fullLibraryLock } from "../../src/catalog/full-library";
import { catalog } from "../../src/catalog/catalog";
import {
  validatePartThumbnails,
  webpSize,
} from "../../scripts/validate-part-thumbnails";

const dir = `public/thumbnails/${partThumbnailsLock.packId}/`;
const indexBytes = readFileSync(dir + "index.json");
const index = JSON.parse(indexBytes.toString()) as PartThumbnailIndex;
const entries = JSON.parse(
  readFileSync(
    `public/libraries/${fullLibraryLock.releaseId}/catalog.json`,
    "utf8",
  ),
);

describe("complete-library thumbnail atlas", () => {
  it("is pinned by its lock and rendered from the current complete pack", () => {
    expect(createHash("sha256").update(indexBytes).digest("hex")).toBe(
      partThumbnailsLock.indexSha256,
    );
    expect(indexBytes.length).toBe(partThumbnailsLock.indexBytes);
    expect(index.format).toBe(PART_THUMBNAILS_FORMAT);
    expect(index.library).toEqual(fullLibraryLock);
  });

  it("passes the full validation (hashes, sheet sizes, coverage, no stray files)", () => {
    const report = validatePartThumbnails();
    expect(report.parts).toBeGreaterThan(23000);
    // Nearly every placeable part renders; the rest are listed, not hidden.
    expect(report.unrendered).toBeLessThan(50);
    expect(report.printed).toBeGreaterThan(5000);
    // Well within the deployment limits (20,000 files, 25 MiB per file).
    expect(report.files).toBeLessThan(1000);
    expect(report.bytes).toBeLessThan(40 * 1024 * 1024);
  });

  it("locates every part in exactly one cell of a sheet", () => {
    const where = locateThumbnails(index);
    const total = index.sheets.reduce((n, s) => n + s.parts.length, 0);
    expect(where.size).toBe(total);
    const dome = where.get("86500.dat")!;
    expect(index.sheets[dome.sheet].parts[dome.cell]).toBe("86500.dat");
    // Curated parts keep their own 128 px thumbnails.
    for (const id of Object.keys(catalog)) expect(where.has(id)).toBe(false);
    // Moved-to redirects are not parts.
    expect(where.has("4.dat")).toBe(false);
    expect(() =>
      locateThumbnails({
        ...index,
        sheets: [index.sheets[0], index.sheets[0]],
      }),
    ).toThrow(/listed twice/);
  });

  it("marks printed cells with a tint mask sheet of the same grid", () => {
    const where = locateThumbnails(index);
    const printed = [...where].filter(([, at]) => at.printed);
    expect(printed.length).toBeGreaterThan(5000);
    const [, at] = printed[0];
    const sheet = index.sheets[at.sheet];
    expect(sheet.mask).toBeDefined();
    const image = readFileSync(dir + sheetPath(sheet.image[0]));
    const mask = readFileSync(dir + sheetPath(sheet.mask![0]));
    expect(webpSize(mask)).toEqual(webpSize(image));
    // A plain part's mask is its own silhouette (no mask sheet needed).
    const plain = [...where].find(([, a]) => !a.printed)!;
    expect(plain[1].printed).toBe(false);
  });

  it("maps a cell to CSS sprite percentages that scale with the element", () => {
    const at = { sheet: 0, cell: 0, printed: false };
    expect(cellStyle(index, at)).toEqual({
      size: `${index.columns * 100}% ${index.columns * 100}%`,
      position: "0% 0%",
    });
    const last = index.columns * index.columns - 1;
    expect(cellStyle(index, { ...at, cell: last }).position).toBe("100% 100%");
    expect(cellStyle(index, { ...at, cell: 1 }).position).toBe(
      `${(1 / (index.columns - 1)) * 100}% 0%`,
    );
  });
});

describe("print variants in the picker", () => {
  const groups = printVariants(entries);
  it("groups prints and sticker variants under their base part", () => {
    expect(groups.baseOf.get("3001p01.dat")).toBe("3001.dat");
    expect(groups.baseOf.get("973p1a.dat")).toBe("973.dat");
    expect(groups.baseOf.get("3626bpa1.dat")).toBe("3626b.dat");
    expect(groups.baseOf.get("10202d01.dat")).toBe("10202.dat");
    // Through a moved-to redirect: 10.dat moved to 10a.dat.
    expect(groups.baseOf.get("10p01.dat")).toBe("10a.dat");
    // Plain parts are not variants of anything.
    expect(groups.baseOf.has("3001.dat")).toBe(false);
    expect(groups.baseOf.has("86500.dat")).toBe(false);
    expect(groups.variantsOf.get("973.dat")!.length).toBeGreaterThan(500);
  });
  it("folds ranked results into one card per base, keeping the best rank", () => {
    const ranked = searchFullLibrary(entries, "torso", { limit: Infinity });
    const cards = groupResults(ranked, groups);
    expect(cards.length).toBeLessThan(ranked.length);
    const bases = cards.map((c) => c.base);
    expect(new Set(bases).size).toBe(bases.length);
    const torso = cards.find((c) => c.base === "973.dat")!;
    expect(torso.variants).toBe(groups.variantsOf.get("973.dat")!.length);
    expect(ranked.indexOf(torso.entry)).toBe(
      ranked.findIndex((e) => (groups.baseOf.get(e[0]) ?? e[0]) === "973.dat"),
    );
  });
});

describe("complete-library browsing", () => {
  it("lists LDraw categories by size, without moved-to redirects", () => {
    const cats = fullLibraryCategories(entries);
    expect(cats[0]).toEqual({ name: "Minifig", count: expect.any(Number) });
    expect(cats.map((c) => c.name)).not.toContain("Moved");
    for (let i = 1; i < cats.length; i++)
      expect(cats[i - 1].count).toBeGreaterThanOrEqual(cats[i].count);
  });
  it("browses a category without a query, and searches within it", () => {
    expect(searchFullLibrary(entries, "")).toEqual([]);
    const dishes = searchFullLibrary(entries, "", {
      browse: true,
      category: "Dish",
      limit: Infinity,
    });
    expect(dishes.length).toBeGreaterThan(100);
    expect(dishes.every((e) => e[2] === "Dish")).toBe(true);
    const all = searchFullLibrary(entries, "", {
      browse: true,
      limit: Infinity,
    });
    expect(all.some((e) => e[1].startsWith("~Moved"))).toBe(false);
    const inverted = searchFullLibrary(entries, "4 x 4 inverted", {
      category: "Dish",
    });
    expect(inverted.length).toBeGreaterThan(0);
    expect(inverted.every((e) => e[2] === "Dish")).toBe(true);
  });
});
