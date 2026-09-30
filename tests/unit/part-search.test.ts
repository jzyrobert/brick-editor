import { beforeAll, describe, expect, it } from "vitest";
import {
  PART_ROLES,
  parseSize,
  roleParts,
  searchParts,
} from "../../src/build-script/part-search";
import { partSpec } from "../../src/catalog/extended";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { registerAgentData } from "../../scripts/build-script-cli";

beforeAll(() => {
  expect(registerFullLibraryFromDisk()).toBe(true);
  registerAgentData();
});
const top = (query: string, extra = {}) =>
  searchParts({ query, limit: 5, ...extra }).map((r) => r.id);

describe("agent part search", () => {
  it("answers builder slang and roles first", () => {
    expect(top("cheese slope")[0]).toBe("54200.dat");
    expect(top("headlight brick")[0]).toBe("4070.dat");
    expect(top("SNOT")).toEqual(
      expect.arrayContaining(["87087.dat", "4070.dat"]),
    );
    expect(top("window 1x2x3 with glass")[0]).toBe("60593.dat");
    expect(top("door 1x4x6")[0]).toBe("60596.dat");
    expect(top("lamp post")[0]).toBe("2039.dat");
    // A role word inside a longer query only narrows it.
    expect(top("arch 1x6")[0]).toBe("3455.dat");
    expect(top("arch 1x6")).not.toContain("3659.dat");
    // Every role names parts that exist.
    for (const [role, ids] of Object.entries(PART_ROLES))
      expect(
        ids.some((id) => partSpec(id)),
        role,
      ).toBe(true);
  });

  it("ranks curated, common parts above printed variants", () => {
    expect(top("1x2 tile")[0]).toBe("3069b.dat");
    expect(top("brick 2x4")[0]).toBe("3001.dat");
    const results = searchParts({ query: "brick 2x4", limit: 30 });
    const printed = results.findIndex((r) => /p\d/.test(r.id));
    const firstLibrary = results.findIndex((r) => !r.curated);
    expect(results[0].curated).toBe(true);
    if (printed >= 0) expect(printed).toBeGreaterThan(firstLibrary);
    // Loose matches when nothing matches every word.
    const loose = searchParts({ query: "bougainvillea flower", limit: 3 });
    expect(loose[0]).toMatchObject({ id: "24866.dat", partial: true });
  });

  it("filters by size, colour availability, category and connectors", () => {
    const tiles = searchParts({
      size: parseSize("1x2x1"),
      category: "Tiles",
      limit: 50,
    });
    expect(tiles.length).toBeGreaterThan(1);
    for (const r of tiles) {
      expect([r.size.w, r.size.d].sort()).toEqual([1, 2]);
      expect(r.size.h).toBe(1);
    }
    expect(parseSize("2x4x1b")).toEqual({ w: 2, d: 4, h: 3 });
    const tan = searchParts({
      query: "brick",
      size: { w: 2, d: 4, h: 3 },
      colour: "tan",
      availableInColour: true,
      limit: 50,
    });
    expect(tan[0].id).toBe("3001.dat");
    for (const r of tan) expect(["verified", "derived"]).toContain(r.inColour);
    const snaps = searchParts({ query: "slope", connectable: true, limit: 50 });
    for (const r of snaps) expect(r.verified).toBe(true);
    const curated = searchParts({ query: "palm", scope: "curated" });
    expect(curated).toEqual([]);
    expect(searchParts({ query: "palm tree" })[0].id).toBe("2518c01.dat");
    expect(() => searchParts({ query: "brick", colour: "blurple" })).toThrow(
      /Unknown colour/,
    );
  });

  it("returns compact, deterministic results", () => {
    const [r] = searchParts({ query: "3001", limit: 1 });
    expect(r).toMatchObject({
      id: "3001.dat",
      name: "Brick 2 × 4",
      size: { w: 4, d: 2, h: 3 },
      category: "Bricks",
      curated: true,
      verified: true,
      bricklink: "3001",
    });
    expect(r.colours).toBeGreaterThan(50);
    expect(r.thumbnail).toMatch(/^thumbnails\//);
    const lib = searchParts({ query: "barrel 2x2", limit: 1 })[0];
    expect(lib.curated).toBe(false);
    expect(lib.thumbnail).toMatch(/sheets\/.*#xywh=\d+,\d+,\d+,\d+$/);
    expect(searchParts({ query: "window", limit: 10 })).toEqual(
      searchParts({ query: "window", limit: 10 }),
    );
    expect(roleParts("cheese slope")).toEqual(["54200.dat", "85984.dat"]);
    expect(roleParts("red cheese slope")).toEqual([]);
  });
});
