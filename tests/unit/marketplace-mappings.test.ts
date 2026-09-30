// Mapping provenance: reviewed (verified) catalogue mappings, derived
// mappings from the LDraw part files' own BrickLink keywords, and how an
// inventory treats each (spec §6.6).
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import mappings from "../../src/catalog/mappings.json";
import derivedTable from "../../src/catalog/mappings-derived.json";
import { catalog, mappingLock } from "../../src/catalog/catalog";
import { fullLibraryLock } from "../../src/catalog/full-library";
import {
  brickLinkKeywords,
  deriveKeywordMappings,
  keywordExclusion,
} from "../../scripts/marketplace-mappings";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { importLDraw } from "../../src/ldraw/io";
import { InventoryService } from "../../src/inventory/service";
import { template } from "../../src/catalog/templates";
import type { FullPackCatalogEntry } from "../../src/catalog/full-pack";

const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const fullCatalog = JSON.parse(
  readFileSync(
    `public/libraries/${fullLibraryLock.releaseId}/catalog.json`,
    "utf8",
  ),
) as FullPackCatalogEntry[];

describe("derived mapping rules", () => {
  it("reads only explicit BrickLink keywords", () => {
    expect(brickLinkKeywords("BrickLink 3861, Rebrickable 3861b")).toEqual([
      "3861",
    ]);
    expect(brickLinkKeywords("glass, windshield")).toEqual([]);
    expect(brickLinkKeywords(undefined)).toEqual([]);
    expect(brickLinkKeywords("Bricklink 4589b, BrickLink 4589b")).toEqual([
      "4589b",
    ]);
  });
  it("never maps stickers, ~ parts or moved stubs, and keeps two numbers ambiguous", () => {
    expect(keywordExclusion(["x.dat", "~Moved to 3861c", "Moved"])).toBe(
      "moved",
    );
    expect(keywordExclusion(["x.dat", "Sticker 1 x 2", "Sticker"])).toBe(
      "sticker",
    );
    expect(keywordExclusion(["x.dat", "~Door 1 x 4 x 5", "Door"])).toBe(
      "not-standalone",
    );
    const d = deriveKeywordMappings({
      catalog: [
        ["a.dat", "Brick 1 x 2", "Brick", "BrickLink 1, BrickLink 2"],
        ["b.dat", "Brick 1 x 3", "Brick", "BrickLink 7"],
        ["c.dat", "Brick 1 x 4", "Brick"],
        ["d.dat", "Brick 1 x 5", "Brick", "BrickLink 9"],
      ],
      library: { releaseId: "r", manifestSha256: "m" },
      curated: new Set(["d.dat"]),
      derivedDate: "2026-09-29",
    });
    expect(d.parts).toEqual({ "b.dat": "7" });
    expect(d.ambiguous).toEqual({ "a.dat": ["1", "2"] });
  });
  it("the shipped table is exactly what the rules derive from the pinned library", () => {
    const again = deriveKeywordMappings({
      catalog: fullCatalog,
      library: {
        releaseId: fullLibraryLock.releaseId,
        manifestSha256: fullLibraryLock.manifestSha256,
      },
      curated: new Set(Object.keys(catalog)),
      derivedDate: derivedTable.derivedDate,
    });
    expect(JSON.parse(JSON.stringify(again))).toEqual(derivedTable);
    // Every derived number is stated by that part's own keywords; none is a
    // file name with ".dat" stripped unless the keyword says so.
    const byName = new Map(fullCatalog.map((e) => [e[0], e]));
    for (const [name, item] of Object.entries(derivedTable.parts))
      expect(brickLinkKeywords(byName.get(name)![3]), name).toEqual([item]);
    expect(Object.hasOwn(derivedTable.parts, "3065.dat")).toBe(false);
    // Catalogue parts keep their reviewed decision (mapped or unmapped).
    for (const id of Object.keys(catalog))
      expect(Object.hasOwn(derivedTable.parts, id), id).toBe(false);
  });
  it("is pinned by hash inside the locked mapping pack", () => {
    expect(mappings.derived.sha256).toBe(
      hash(readFileSync(mappings.derived.path)),
    );
    expect(hash(readFileSync("src/catalog/mappings.json"))).toBe(
      mappingLock.mappingPackSha256,
    );
    const reviewedDate = Object.values(mappings.reviewed.parts)
      .map((r) => r.reviewed)
      .sort()
      .at(-1);
    expect(mappings.id).toBe(
      `curated-catalogue-4+reviewed-${reviewedDate}+${derivedTable.id}`,
    );
    expect(mappings.derived.mapped).toBe(
      Object.keys(derivedTable.parts).length,
    );
  });
  it("resolves three of the five formerly unmapped catalogue parts by review", () => {
    const parts = mappings.parts as Record<string, { itemId: string }>;
    expect(parts["official:3048b.dat"].itemId).toBe("3048c");
    expect(parts["official:14395.dat"].itemId).toBe("2339");
    expect(parts["official:6255.dat"].itemId).toBe("x8");
    expect(Object.keys(mappings.unmapped).sort()).toEqual([
      "official:3049b.dat",
      "official:3245c.dat",
    ]);
    // The newly curated parts are reviewed and mapped.
    for (const id of [
      "4600",
      "4624",
      "3641",
      "3788",
      "3823",
      "4079",
      "3829c01",
      "2335",
      "30179",
    ])
      expect(parts[`official:${id}.dat`]?.itemId, id).toBe(id);
    expect(parts["official:60616b.dat"].itemId).toBe("60616");
  });
});

describe("inventory with derived mappings", () => {
  const request = {
    expectedRevision: 0,
    format: "bricklink-wanted-xml" as const,
    scope: { kind: "all" as const },
  };
  it("blocks a derived mapping until accepted, then reports it as acknowledged", async () => {
    expect(registerFullLibraryFromDisk()).toBe(true);
    // 3861c: the LDraw file names BrickLink 3861.
    const p = importLDraw(
      "0 FILE t.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3861c.dat\n",
    );
    const service = new InventoryService();
    const blocked = await service.preview(p, request);
    expect(blocked.canExportComplete).toBe(false);
    expect(blocked.diagnostics.map((d) => d.code)).toContain("DERIVED_MAPPING");
    const accepted = await service.preview(p, {
      ...request,
      acceptDerivedMappings: true,
      acceptUnknownColors: true,
    });
    expect(accepted.canExportComplete).toBe(true);
    expect(accepted.rows).toEqual([
      expect.objectContaining({
        itemId: "3861",
        colorId: "5",
        quantity: 1,
        verification: "acknowledged",
      }),
    ]);
    // Colour existence stays unknown for a derived mapping.
    const colourOnly = await service.preview(p, {
      ...request,
      acceptDerivedMappings: true,
    });
    expect(colourOnly.diagnostics.map((d) => d.code)).toContain(
      "UNVERIFIED_PART_COLOR",
    );
  });
  it("never lends an official mapping to a project-local definition", async () => {
    const p = importLDraw(
      "0 FILE t.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3861c.dat\n0 NOFILE\n0 FILE 3861c.dat\n3 16 0 0 0 1 0 0 0 0 1\n",
    );
    const r = await new InventoryService().preview(p, {
      ...request,
      acceptDerivedMappings: true,
      acceptUnknownColors: true,
    });
    expect(r.rows).toEqual([]);
    expect(r.diagnostics.map((d) => d.code)).toContain(
      "NON_ORDERABLE_GEOMETRY",
    );
  });
  it("exports the roadster's newly curated parts as verified lots", async () => {
    const p = template("car");
    const r = await new InventoryService().preview(p, {
      ...request,
      expectedRevision: p.revision,
    });
    const items = new Set(r.rows.map((row) => row.itemId));
    for (const id of [
      "4600",
      "4624",
      "3641",
      "3788",
      "3823",
      "4079",
      "3829c01",
    ])
      expect(items, id).toContain(id);
    expect(r.diagnostics.filter((d) => d.code === "UNMAPPED_PART")).toEqual([]);
  });
});
