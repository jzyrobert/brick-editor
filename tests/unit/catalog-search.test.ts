import { describe, expect, it } from "vitest";
import { catalog } from "../../src/catalog/catalog";
import {
  catalogCategories,
  relatedParts,
  searchCatalog,
} from "../../src/catalog/search";

const parts = Object.values(catalog);
const ids = (list: { id: string }[]) => list.map((p) => p.id);

describe("catalogue search", () => {
  it("matches names, numbers, categories and sizes in any notation", () => {
    expect(ids(searchCatalog(parts, { query: "3001" }))).toEqual(["3001.dat"]);
    expect(ids(searchCatalog(parts, { query: "2x4" }))).toEqual([
      "3001.dat",
      "3020.dat",
    ]);
    expect(ids(searchCatalog(parts, { query: "plate 2 × 2" }))).toEqual([
      "3022.dat",
    ]);
    // Rotated footprint and prefix tokens.
    expect(ids(searchCatalog(parts, { query: "4x2 pla" }))).toEqual([
      "3020.dat",
    ]);
    expect(searchCatalog(parts, { query: "brick" })).toHaveLength(4);
    // A partly typed size still narrows.
    expect(ids(searchCatalog(parts, { query: "1x" }))).toEqual([
      "3004.dat",
      "3005.dat",
    ]);
    expect(searchCatalog(parts, { query: "window" })).toHaveLength(0);
    expect(searchCatalog(parts, { query: "" })).toHaveLength(parts.length);
  });
  it("filters by category and favourites", () => {
    expect(catalogCategories(parts)).toEqual(["Bricks", "Plates"]);
    expect(ids(searchCatalog(parts, { category: "Plates" }))).toEqual([
      "3020.dat",
      "3022.dat",
    ]);
    expect(
      ids(
        searchCatalog(parts, {
          favouritesOnly: true,
          favourites: new Set(["3005.dat"]),
        }),
      ),
    ).toEqual(["3005.dat"]);
    expect(
      searchCatalog(parts, { favouritesOnly: true, favourites: new Set() }),
    ).toHaveLength(0);
  });
  it("relates the same footprint first, then shared-side siblings", () => {
    expect(ids(relatedParts(parts, catalog["3001.dat"]))[0]).toBe("3020.dat");
    expect(ids(relatedParts(parts, catalog["3022.dat"]))[0]).toBe("3003.dat");
    expect(ids(relatedParts(parts, catalog["3001.dat"]))).not.toContain(
      "3001.dat",
    );
    expect(relatedParts(parts, undefined)).toEqual([]);
  });
});
