// Colour availability: the hash-locked pack of colours each part was really
// made in, its colour-identity joins, provenance and how inventories use it.
import { describe, expect, it, beforeAll } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import packJson from "../../src/catalog/color-availability.json";
import joinTable from "../../scripts/color-joins.json";
import blGuide from "../../scripts/bricklink-colors.json";
import mappings from "../../src/catalog/mappings.json";
import derivedMappings from "../../src/catalog/mappings-derived.json";
import {
  COLOR_AVAILABILITY_FORMAT,
  colorAvailabilityLock,
  colorExistence,
  madeIn,
  paletteColors,
  partAvailability,
  registerColorAvailability,
  type ColorAvailabilityPack,
} from "../../src/catalog/color-availability";
import { fullLibraryLock } from "../../src/catalog/full-library";
import {
  colourGroup,
  joinBrickLink,
  joinRebrickable,
  parseLDConfig,
  type BrickLinkColour,
} from "../../scripts/color-joins";
import { InventoryService } from "../../src/inventory/service";
import { importLDraw } from "../../src/ldraw/io";
import { validateColorAvailability } from "../../scripts/validate-color-availability";

const pack = packJson as unknown as ColorAvailabilityPack;
const sha = (b: Buffer | string) =>
  createHash("sha256").update(b).digest("hex");
const ldconfig = parseLDConfig(
  readFileSync(
    `public/libraries/${fullLibraryLock.releaseId}/LDConfig.ldr`,
    "utf8",
  ),
);
beforeAll(() => registerColorAvailability(pack));

describe("colour availability pack", () => {
  it("is hash locked and bound to the complete library", () => {
    const bytes = readFileSync("src/catalog/color-availability.json");
    expect(sha(bytes)).toBe(colorAvailabilityLock.sha256);
    expect(bytes.length).toBe(colorAvailabilityLock.bytes);
    expect(pack.format).toBe(COLOR_AVAILABILITY_FORMAT);
    expect(pack.packId).toBe(colorAvailabilityLock.packId);
    expect(pack.library).toEqual(fullLibraryLock);
    expect(validateColorAvailability().parts).toBe(
      Object.keys(pack.parts).length,
    );
  });
  it("records the pinned Rebrickable snapshot it was derived from", () => {
    const snapshot = JSON.parse(
      readFileSync("scripts/rebrickable-snapshot.json", "utf8"),
    );
    const derived = pack.sources.derived as {
      retrieved: string;
      sha256: Record<string, string>;
    };
    expect(derived.retrieved).toBe(snapshot.retrieved);
    for (const f of ["colors", "parts", "elements", "inventory_parts"])
      expect(derived.sha256[f]).toMatch(/^[0-9a-f]{64}$/);
    expect(readFileSync("public/notices/REBRICKABLE.txt", "utf8")).toContain(
      "Rebrickable (https://rebrickable.com)",
    );
  });
  it("knows Brick 2 × 4 (3001): verified and derived colours with provenance", () => {
    const a = partAvailability("3001.dat");
    expect(a.status).toBe("known");
    if (a.status !== "known") return;
    expect(a.bricklinkItem).toBe("3001");
    expect(a.rebrickablePart).toBe("3001");
    for (const code of ["0", "1", "4", "14", "15", "71", "72", "19"])
      expect(colorExistence("3001.dat", code), code).toBe("verified");
    // BrickLink lists no Light Green (17) or Light Blue (9) 2 × 4 brick and
    // Rebrickable records none either: known not produced.
    expect(colorExistence("3001.dat", "17")).toBe("not-produced");
    expect(colorExistence("3001.dat", "9")).toBe("not-produced");
    expect(madeIn("3001.dat", "17")).toBe(false);
    // Recorded only by Rebrickable: derived, not catalogue verified.
    const derivedOnly = [...a.derived!].filter((c) => !a.verified!.has(c));
    expect(derivedOnly.length).toBeGreaterThan(0);
    for (const c of derivedOnly)
      expect(colorExistence("3001.dat", c)).toBe("derived");
  });
  it("marks parts without a verified list as not recorded, not as never made", () => {
    // Technic Brick 1 × 1 with Hole: outside the curated catalogue.
    expect(pack.parts["6541.dat"].v).toBeUndefined();
    expect(colorExistence("6541.dat", "4")).toBe("derived");
    expect(colorExistence("6541.dat", "17")).toBe("not-recorded");
  });
  it("leaves parts no join rule reaches unknown", () => {
    // A printed brick: LDraw 3001p01 is BrickLink 3001pb079; Rebrickable
    // has neither number, and the base part's colours are not lent to it.
    expect(pack.parts["3001p01.dat"]).toBeUndefined();
    expect(partAvailability("3001p01.dat").status).toBe("unknown");
    expect(colorExistence("3001p01.dat", "4")).toBe("unknown");
    expect(madeIn("3001p01.dat", "4")).toBe(true);
  });
  it("joins part numbers only exactly or through a stated BrickLink number", () => {
    const reviewed = mappings.parts as Record<string, { itemId: string }>;
    const derived = derivedMappings.parts as Record<string, string>;
    let viaItem = 0;
    for (const [name, p] of Object.entries(pack.parts)) {
      if (p.v) expect(p.bl, name).toBe(reviewed["official:" + name].itemId);
      if (!p.rb) continue;
      const number = name.replace(/\.dat$/, "");
      if (p.rb === number) continue;
      viaItem++;
      expect(
        [reviewed["official:" + name]?.itemId, derived[name]],
        name,
      ).toContain(p.rb);
    }
    expect(viaItem).toBeGreaterThan(100);
    // 27c names BrickLink 27 in its own keywords.
    expect(pack.parts["27c.dat"].rb).toBe("27");
  });
  it("covers the common bricks, plates and tiles", () => {
    for (const part of [
      "3001",
      "3003",
      "3004",
      "3005",
      "3010",
      "3020",
      "3022",
      "3023b",
      "3024",
      "3062b",
      "3069b",
      "3040b",
      "3039",
    ])
      expect(partAvailability(part + ".dat").status, part).toBe("known");
    const coverage = pack.coverage as { known: number; placeable: number };
    expect(coverage.known).toBeGreaterThan(5000);
    expect(coverage.placeable).toBeGreaterThan(20000);
  });
});

describe("colour identity joins", () => {
  const bl = blGuide.colors as BrickLinkColour[];
  const toBl = joinBrickLink(ldconfig, bl);
  it("reproduces the hand-checked favourites table by LEGO colour number", () => {
    const expected = {
      "0": 11,
      "1": 7,
      "2": 6,
      "4": 5,
      "14": 3,
      "15": 1,
      "19": 2,
      "40": 13,
      "47": 12,
      "71": 86,
      "72": 85,
    };
    for (const [code, id] of Object.entries(expected)) {
      expect(toBl[code], code).toEqual({ bricklink: id, rule: "lego-id" });
      expect((mappings.colors as Record<string, string>)[code]).toBe(
        String(id),
      );
    }
    // Orange (LEGO 106) and Dark Red (LEGO 154 "New Dark Red").
    expect(toBl["25"].bricklink).toBe(4);
    expect(toBl["320"].bricklink).toBe(59);
  });
  it("never joins Modulex colours by number or two LDraw codes to one colour", () => {
    const modulex = new Set(
      bl.filter((c) => c.colorType === 10).map((c) => c.id),
    );
    const seen = new Set<number>();
    for (const j of Object.values(toBl)) {
      expect(modulex.has(j.bricklink)).toBe(false);
      expect(seen.has(j.bricklink)).toBe(false);
      seen.add(j.bricklink);
    }
  });
  it("drops a Rebrickable colour whose name and id rules disagree", () => {
    const ld = parseLDConfig(
      "0 // LEGOID 200 - Lemon Metallic\n0 !COLOUR Lemon_Metallic CODE 200 VALUE #82A866 EDGE #333333 PEARLESCENT\n0 !COLOUR Metallic_Green CODE 81 VALUE #899B5F EDGE #333333 METAL\n",
    );
    const guide: BrickLinkColour[] = [
      {
        id: 70,
        name: "Metallic Green",
        legoName: "Lemon Metallic - 200",
        colorType: 6,
      },
    ];
    const r = joinRebrickable(
      [{ id: "81", name: "Metallic Green" }],
      ld,
      guide,
      joinBrickLink(ld, guide),
    );
    expect(r.joins).toEqual({});
    expect(Object.keys(r.conflicts)).toEqual(["81"]);
    // The committed table records the same exclusion for the real data.
    expect(Object.keys(joinTable.rebrickableConflicts)).toContain("81");
  });
  it("joins Rebrickable colours through BrickLink names", () => {
    const code = (rb: string) =>
      joinTable.colors.find((c) =>
        c.rebrickable.some((r: { id: string }) => r.id === rb),
      )?.code;
    expect(code("71")).toBe("71"); // Light Bluish Gray
    expect(code("179")).toBe("315"); // Flat Silver
    expect(code("182")).toBe("57"); // Trans-Orange
    expect(code("1050")).toBe("353"); // Coral
    expect(code("9999")).toBeUndefined(); // [No Color/Any Color]
  });
});

describe("picker palette", () => {
  it("puts ten favourites first, then grouped colours real parts come in", () => {
    const quick = paletteColors.filter((c) => c.quick);
    expect(quick.map((c) => c.code)).toEqual([
      "4",
      "1",
      "14",
      "15",
      "0",
      "71",
      "72",
      "2",
      "19",
      "47",
    ]);
    expect(paletteColors.slice(0, 10)).toEqual(quick);
    expect(new Set(paletteColors.map((c) => c.code)).size).toBe(
      paletteColors.length,
    );
    expect(new Set(paletteColors.map((c) => c.name)).size).toBe(
      paletteColors.length,
    );
    const groups = new Set(paletteColors.map((c) => c.group));
    for (const g of ["basic", "earth", "pastel", "transparent", "metallic"])
      expect(groups.has(g as never), g).toBe(true);
    expect(paletteColors.length).toBeGreaterThan(80);
    // Speciality materials, rubber and Modulex are not offered.
    const byCode = new Map(ldconfig.map((c) => [c.code, c]));
    for (const c of paletteColors)
      expect(colourGroup(byCode.get(c.code)!), c.code).toBe(c.group);
    for (const code of ["16", "24", "256", "30001", "117", "132", "360"])
      expect(
        paletteColors.some((c) => c.code === code),
        code,
      ).toBe(false);
  });
});

describe("inventory colour existence", () => {
  const request = {
    expectedRevision: 0,
    format: "bricklink-wanted-xml" as const,
    scope: { kind: "all" as const },
  };
  it("marks verified, derived and known-not-produced combinations", async () => {
    const p = importLDraw(
      "0 FILE t.ldr\n" +
        "1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n" +
        "1 72 80 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n" +
        "1 17 160 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n",
    );
    const service = new InventoryService();
    const r = await service.preview(p, {
      ...request,
      acceptUnknownColors: true,
    });
    expect(r.rows).toEqual([
      expect.objectContaining({
        itemId: "3001",
        colorId: "5",
        colorExistence: "verified",
        verification: "verified",
      }),
      expect.objectContaining({
        itemId: "3001",
        colorId: "85",
        colorExistence: "verified",
      }),
    ]);
    // Light Green 3001 is known not produced: accepting unknown colours does
    // not lift it.
    const invalid = r.diagnostics.filter(
      (d) => d.code === "INVALID_PART_COLOR",
    );
    expect(invalid).toHaveLength(1);
    expect(invalid[0].severity).toBe("error");
    expect(invalid[0].message).toContain("Light green");
    expect(r.canExportComplete).toBe(false);
  });
});
