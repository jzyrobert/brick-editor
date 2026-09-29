// Connectors and occupancy derived from the complete official library
// (scripts/build-full-connectors.ts): pack integrity, hand-checked
// derivations of parts outside the catalogue, the registry that snapping,
// clash tests and health read, and the naming rules the verifier sees.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { deriveEntry, readFullPack } from "../../scripts/build-full-connectors";
import {
  SAMPLE_PARTS,
  validateFullConnectors,
} from "../../scripts/validate-full-connectors";
import {
  fullLibraryDir,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import {
  catalogueStyleTitle,
  fullPartSpec,
  shardOf,
  verifierCategory,
} from "../../src/catalog/full-connector-pack";
import { fullConnectorLock } from "../../src/catalog/full-connectors";
import { fullLibraryLock } from "../../src/catalog/full-library";
import {
  connectorStatus,
  hingeData,
  partOccupancy,
  verifiedConnectors,
} from "../../src/catalog/connectors";
import { decodeConnectors } from "../../src/catalog/connector-pack";
import { importLDraw } from "../../src/ldraw/io";
import { connectionGraph } from "../../src/core/connectivity";
import { rotationY } from "../../src/core/math";
import { sceneConnectors, snapCandidates } from "../../src/edit/snap";

const pack = readFullPack(fullLibraryDir(), fullLibraryLock.manifestSha256);
const titles = new Map(pack.catalog.map((c) => [c[0], c]));
const derive = (name: string) => {
  const [, title = "", category = ""] = titles.get(name) ?? [];
  return deriveEntry(
    pack.sources(name),
    name,
    title,
    category,
    pack.index.parts[name][1],
  );
};
const kinds = (e: ReturnType<typeof derive>) =>
  decodeConnectors(e).map((c) => [c.kind, ...c.p, ...c.axis].join(" "));

describe("naming rules for complete-library parts", () => {
  it("reads LDraw titles in the catalogue's style and maps categories", () => {
    expect(catalogueStyleTitle("Brick  2 x  4")).toBe("Brick 2 × 4");
    expect(
      catalogueStyleTitle("Brick  1 x  2 x  2 with Inside Axle Holder"),
    ).toBe("Brick 1 × 2 × 2 with Inside Axle Holder");
    expect(catalogueStyleTitle("~Moved to 3861c")).toBe("Moved to 3861c");
    expect(verifierCategory("Slope")).toBe("Slopes");
    expect(verifierCategory("Door")).toBe("Windows & doors");
    expect(verifierCategory("Hinge")).toBe("Brackets & hinges");
    expect(verifierCategory("Minifig")).toBe("Minifig");
    // Footprint and grid phase from bounds, as extended.ts derives them.
    expect(
      fullPartSpec("Brick  1 x  2", "Brick", [-20, -4, -10, 20, 24, 10]),
    ).toEqual({
      name: "Brick 1 × 2",
      category: "Bricks",
      width: 40,
      depth: 20,
      align: [0, 10],
    });
  });
});

describe("derivation of parts outside the catalogue (hand-checked)", () => {
  it("Brick 1 × 2 without bottom tube (3065): two studs over two receptors", () => {
    const e = derive("3065.dat");
    expect(e).toMatchObject({ verified: true, rule: "full-underside" });
    // Studs on the top face (y 0), receptors on the base 24 LDU (3 plates) down.
    expect(kinds(e).sort()).toEqual(
      [
        "antistud -10 24 0 0 1 0",
        "antistud 10 24 0 0 1 0",
        "stud -10 0 0 0 -1 0",
        "stud 10 0 0 0 -1 0",
      ].sort(),
    );
    // One box: the brick body below its studs.
    expect(e.occupancy).toEqual([-20, 0, -10, 20, 24, 10]);
  });
  it("Tile 2 × 2 without groove (3068a): four receptors, no studs", () => {
    const e = derive("3068a.dat");
    expect(e).toMatchObject({ verified: true, rule: "full-underside" });
    expect(kinds(e).sort()).toEqual(
      [
        "antistud -10 8 -10 0 1 0",
        "antistud -10 8 10 0 1 0",
        "antistud 10 8 -10 0 1 0",
        "antistud 10 8 10 0 1 0",
      ].sort(),
    );
  });
  it("Door 1 × 2 × 3 (60614) and window pane 3854: hinge pins 60 LDU apart", () => {
    for (const name of ["60614.dat", "3854.dat"]) {
      const e = derive(name);
      expect(e, name).toMatchObject({ verified: true, rule: "hinge-leaf" });
      expect(e.hinge, name).toMatchObject({
        axis: [0, -1, 0],
        pivot: [0, 30, 0],
        pins: [
          [0, 0, 0],
          [0, 60, 0],
        ],
      });
    }
  });
  it("leaves parts unverified with a reason when no rule proves them", () => {
    // Wheel-pin plate: a hand-modelled stud-sized cylinder and an off-grid base.
    expect(derive("4600.dat").reasons!.join(" ")).toMatch(/cylinder/);
    // The grooved door has no pins beyond its leaf: not claimed.
    expect(derive("3644.dat").verified).toBe(false);
    // A flag's clips are not a supported family.
    expect(derive("2335.dat").verified).toBe(false);
  });
  it("derives catalogue parts exactly as the curated pack does", () => {
    const curated = JSON.parse(
      readFileSync("src/catalog/connectors.json", "utf8"),
    ).parts;
    for (const name of ["3001.dat", "60616a.dat", "30179.dat"]) {
      const e = derive(name);
      expect(e.verified, name).toBe(curated[name].verified);
      expect(e.runs, name).toEqual(curated[name].runs);
      expect(e.occupancy, name).toEqual(curated[name].occupancy);
    }
  });
});

describe("pack integrity", () => {
  it("is locked, bound to the complete pack and reproduces sample entries", () => {
    const r = validateFullConnectors({
      librariesDir: "public/libraries/",
      lock: fullConnectorLock,
      full: fullLibraryLock,
      samples: [...SAMPLE_PARTS, "3068a.dat"],
    });
    expect(r.id).toBe("connectors-" + fullLibraryLock.releaseId);
    expect(r.parts).toBe(Object.keys(pack.index.parts).length);
    expect(r.shards).toBe(256);
    // Coverage recorded when the pack was built (docs/CONNECTORS.md).
    expect(r.verified).toBe(5168);
  }, 120000);
  it("assigns shards by a stable name hash", () => {
    expect(shardOf("3001.dat", 256)).toBe(shardOf("3001.dat", 256));
    const spread = new Set(
      Object.keys(pack.index.parts)
        .slice(0, 2000)
        .map((n) => shardOf(n, 256)),
    );
    expect(spread.size).toBeGreaterThan(240);
  });
});

describe("registry used by snapping, clash tests and health", () => {
  it("serves complete-library parts once registered; catalogue parts keep the curated pack", () => {
    expect(verifiedConnectors("3065.dat")).toBeNull();
    expect(registerFullLibraryFromDisk()).toBe(true);
    expect(
      verifiedConnectors("3065.dat")!
        .map((c) => c.kind)
        .sort(),
    ).toEqual(["antistud", "antistud", "stud", "stud"]);
    expect(partOccupancy("3065.dat")).toEqual([
      { min: [-20, 0, -10], max: [20, 24, 10] },
    ]);
    expect(connectorStatus("3065.dat")).toMatchObject({
      source: "complete-library",
      verified: true,
      rule: "full-underside",
    });
    expect(connectorStatus("3001.dat").source).toBeUndefined();
    expect(hingeData("60614.dat")?.hinge?.pins).toEqual([
      [0, 0, 0],
      [0, 60, 0],
    ]);
    // An unverified part still has occupancy for clash tests and health.
    expect(verifiedConnectors("4600.dat")).toBeNull();
    expect(partOccupancy("4600.dat")!.length).toBeGreaterThan(0);
  });
  it("snaps a non-catalogue brick onto a catalogue brick and connects it", () => {
    registerFullLibraryFromDisk();
    const p = importLDraw(
      "0 FILE t.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n",
    );
    const fits = snapCandidates(
      "3065.dat",
      rotationY(0),
      [4, -24, 6],
      sceneConnectors(p),
    );
    // A 1 × 2 brick seats on one of the 2 × 4 brick's stud rows (z ±10).
    expect(fits[0]).toMatchObject({ position: [0, -24, 10], contacts: 2 });
    const joined = importLDraw(
      "0 FILE t.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n1 1 0 -24 10 1 0 0 0 1 0 0 0 1 3065.dat\n",
    );
    const graph = connectionGraph(joined);
    expect(graph.covered.length).toBe(2);
    expect(graph.contacts).toBe(2);
  });
});
