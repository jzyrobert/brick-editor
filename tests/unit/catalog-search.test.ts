import { describe, expect, it } from "vitest";
import { catalog, catalogCategoryOrder } from "../../src/catalog/catalog";
import {
  catalogCategories,
  inCategory,
  relatedParts,
  searchCatalog,
} from "../../src/catalog/search";

const parts = Object.values(catalog);
const ids = (list: { id: string }[]) => list.map((p) => p.id);
const search = (query: string, category?: string) =>
  ids(searchCatalog(parts, { query, category }));

describe("catalogue search", () => {
  it("ranks exact part numbers, then sizes, in any notation", () => {
    expect(search("3001")[0]).toBe("3001.dat");
    // Marketplace numbers that differ from the LDraw file are searchable too.
    expect(search("4073")[0]).toBe("6141.dat");
    const twoByFour = search("2x4");
    expect(twoByFour.slice(0, 2)).toEqual(["3001.dat", "3020.dat"]);
    expect(twoByFour).toEqual(expect.arrayContaining(["87079.dat"]));
    expect(search("brick 2 × 4")[0]).toBe("3001.dat");
    expect(search("plate 2 × 2")[0]).toBe("3022.dat");
    // Rotated footprint and prefix tokens.
    expect(search("4x2 pla")[0]).toBe("3020.dat");
    // A partly typed size still narrows.
    expect(search("1x")).toContain("3005.dat");
    expect(search("1x")).not.toContain("3001.dat");
    expect(search("")).toHaveLength(parts.length);
    expect(search("zzzz")).toHaveLength(0);
  });
  it("finds shapes by name and keyword", () => {
    expect(search("slope 45 2x2")[0]).toBe("3039.dat");
    expect(search("window")).toEqual(
      expect.arrayContaining(["60592.dat", "60594.dat"]),
    );
    expect(search("glass")).toEqual(expect.arrayContaining(["60601.dat"]));
    expect(search("roof")).toContain("3039.dat");
    expect(search("cheese")).toEqual(["54200.dat", "85984.dat"]);
    expect(search("arch 1x4")[0]).toBe("3659.dat");
  });
  it("filters by category, tags and favourites", () => {
    expect(catalogCategories(parts, catalogCategoryOrder)).toEqual(
      catalogCategoryOrder,
    );
    expect(catalogCategoryOrder.slice(0, 4)).toEqual([
      "Bricks",
      "Plates",
      "Tiles",
      "Slopes",
    ]);
    const plates = search("", "Plates");
    expect(plates).toContain("3020.dat");
    // Round plates are listed under Round and also under Plates.
    expect(plates).toContain("4032b.dat");
    expect(inCategory(catalog["4032b.dat"], "Round")).toBe(true);
    expect(search("", "Slopes")).not.toContain("3001.dat");
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
