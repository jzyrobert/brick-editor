import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  extractConnectors,
  verifyConnectors,
} from "../../src/catalog/connector-extract";
import {
  decodeConnectors,
  decodeOccupancy,
  encodeConnectors,
  type Connector,
} from "../../src/catalog/connector-pack";
import {
  connectorCoverage,
  connectorLock,
  connectorPackMatchesLibrary,
  connectorStatus,
  hingeData,
  verifiedConnectors,
} from "../../src/catalog/connectors";
import pack from "../../src/catalog/connectors.json";
import { catalog, libraryLock } from "../../src/catalog/catalog";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import {
  connectedAssembly,
  connectedGroups,
  connectionGraph,
} from "../../src/core/connectivity";
import {
  sceneConnectors,
  snapPlacement,
  studWorkplane,
} from "../../src/edit/snap";
import {
  defaultWorkplane,
  placeBasis,
  placementOnPlane,
} from "../../src/edit/workplane";
import { rotationY } from "../../src/core/math";

const root = `public/libraries/${libraryLock.releaseId}/`;
const manifest = JSON.parse(readFileSync(root + "manifest.json", "utf8"));
const sources: Record<string, string> = {};
for (const f of manifest.files)
  if (f.path !== "LDConfig.ldr")
    sources[f.path.replace(/^(parts|p)\//, "")] = readFileSync(
      root + f.path,
      "utf8",
    );
const extract = (id: string) =>
  extractConnectors(sources, id, catalog[id].bounds, catalog[id].align);
const cells = (list: Connector[], kind: Connector["kind"]) =>
  list
    .filter((c) => c.kind === kind)
    .map((c) => c.p.join(" "))
    .sort();
const grid = (xs: number[], y: number, zs: number[]) =>
  xs.flatMap((x) => zs.map((z) => [x, y, z].join(" "))).sort();

describe("connector extraction from LDraw geometry", () => {
  it("finds a 2 × 4 brick's studs and its full underside", () => {
    const e = extract("3001.dat");
    expect(cells(e.connectors, "stud")).toEqual(
      grid([-30, -10, 10, 30], 0, [-10, 10]),
    );
    expect(cells(e.connectors, "antistud")).toEqual(
      grid([-30, -10, 10, 30], 24, [-10, 10]),
    );
    // Studs point up (LDraw −Y); receptors open downward.
    for (const c of e.connectors)
      expect(c.axis).toEqual(c.kind === "stud" ? [0, -1, 0] : [0, 1, 0]);
    expect(e.tubes).toBe(3); // three underside tubes corroborate the cells
    expect(verifyConnectors(catalog["3001.dat"], e)).toMatchObject({
      verified: true,
      rule: "full-underside",
    });
  });
  it("handles plates, tiles and a 1 × 1 brick without tubes", () => {
    const plate = extract("3024.dat");
    expect(cells(plate.connectors, "stud")).toEqual(["0 0 0"]);
    expect(cells(plate.connectors, "antistud")).toEqual(["0 8 0"]);
    const tile = extract("3070b.dat");
    expect(cells(tile.connectors, "stud")).toEqual([]);
    expect(cells(tile.connectors, "antistud")).toEqual(["0 8 0"]);
    expect(verifyConnectors(catalog["3070b.dat"], tile).verified).toBe(true);
    const brick = extract("3005.dat");
    expect(brick.tubes).toBe(0);
    expect(cells(brick.connectors, "antistud")).toEqual(["0 24 0"]);
  });
  it("keeps a slope's studs on its flat row while the whole underside accepts studs", () => {
    const e = extract("3039.dat");
    expect(cells(e.connectors, "stud")).toHaveLength(2);
    expect(cells(e.connectors, "antistud")).toHaveLength(4);
    const studZ = new Set(
      e.connectors.filter((c) => c.kind === "stud").map((c) => c.p[2]),
    );
    expect(studZ.size).toBe(1); // one row
    expect(verifyConnectors(catalog["3039.dat"], e).rule).toBe(
      "full-underside",
    );
  });
  it("matches round parts' receptors to their studs and leaves outside corners empty", () => {
    const round = extract("3062b.dat");
    expect(cells(round.connectors, "antistud")).toEqual(["0 24 0"]);
    const big = extract("60474.dat");
    expect(cells(big.connectors, "stud")).toHaveLength(12);
    expect(cells(big.connectors, "antistud")).toHaveLength(12);
    expect(big.cells.filter((c) => c.state !== "receptor")).toHaveLength(4);
    expect(verifyConnectors(catalog["60474.dat"], big)).toMatchObject({
      verified: true,
      rule: "matched-outline",
    });
  });
  it("verifies a baseplate as a solid base and rejects unsupported families", () => {
    const base = extract("3867.dat");
    expect(cells(base.connectors, "stud")).toHaveLength(256);
    expect(cells(base.connectors, "antistud")).toHaveLength(0);
    expect(verifyConnectors(catalog["3867.dat"], base).rule).toBe("solid-base");
    // Brackets and hinge bricks are other families: their side studs are
    // recorded, the parts stay unverified.
    const bracket = extract("99781.dat");
    expect(
      bracket.connectors.some((c) => c.kind === "stud" && c.axis[2] === -1),
    ).toBe(true);
    expect(connectorStatus("99781.dat").verified).toBe(false);
    expect(connectorStatus("3937.dat").reasons.join(" ")).toMatch(/hinge/);
    // A plate with a clip, a door frame's glass and a Technic plate's holes too.
    for (const id of ["4081b.dat", "60601.dat", "3709b.dat"])
      expect(connectorStatus(id).verified, id).toBe(false);
  });
  it("uses the body geometry, not the conservative catalogue box, for the base", () => {
    // The catalogue box of a curved slope reaches 4.5 LDU past its geometry;
    // its receptor plane is the real underside (the part's origin is its base).
    expect(catalog["11477.dat"].bounds.max[1]).toBeCloseTo(4.486, 3);
    const e = extract("11477.dat");
    expect(e.bottom).toBe(0);
    expect(cells(e.connectors, "antistud")).toEqual(["0 0 -10"]);
  });
  it("puts a stretched stud's connection one stud height below its top", () => {
    // 4287a's second and third studs are stud2a stretched 4× and 1.5× down into
    // the part; their tops are at −4 like the first stud's.
    const e = extract("4287a.dat");
    expect(cells(e.connectors, "stud")).toEqual([
      "0 0 -20",
      "0 0 -40",
      "0 0 0",
    ]);
  });
});

describe("connector families", () => {
  it("jumper plates: one stud centred between cells over a full underside", () => {
    const one = extract("3794b.dat");
    expect(cells(one.connectors, "stud")).toEqual(["0 0 0"]);
    expect(cells(one.connectors, "antistud")).toEqual(["-10 8 0", "10 8 0"]);
    expect(verifyConnectors(catalog["3794b.dat"], one).rule).toBe("jumper");
    const two = extract("87580.dat");
    expect(cells(two.connectors, "stud")).toEqual(["0 0 0"]);
    expect(cells(two.connectors, "antistud")).toEqual(
      grid([-10, 10], 8, [-10, 10]),
    );
    expect(verifyConnectors(catalog["87580.dat"], two).rule).toBe("jumper");
  });
  it("side-stud bricks: studs straight out of a face, 10 LDU below the top", () => {
    const side = (id: string) =>
      extract(id)
        .connectors.filter((c) => c.kind === "stud" && c.axis[1] === 0)
        .map((c) => c.p.join(" ") + " > " + c.axis.join(" "))
        .sort();
    expect(side("87087.dat")).toEqual(["0 10 -10 > 0 0 -1"]);
    expect(side("47905.dat")).toEqual(["0 10 -10 > 0 0 -1", "0 10 10 > 0 0 1"]);
    expect(side("4733.dat")).toEqual([
      "-10 10 0 > -1 0 0",
      "0 10 -10 > 0 0 -1",
      "0 10 10 > 0 0 1",
      "10 10 0 > 1 0 0",
    ]);
    expect(side("30414.dat")).toEqual(
      [-30, -10, 10, 30].map((x) => `${x} 10 -10 > 0 0 -1`).sort(),
    );
    // A headlight brick's stud stands in a recess half a plate deep.
    expect(side("4070.dat")).toEqual(["0 10 -6 > 0 0 -1"]);
    for (const id of [
      "87087.dat",
      "47905.dat",
      "4733.dat",
      "4070.dat",
      "11211.dat",
      "30414.dat",
    ])
      expect(connectorStatus(id).rule, id).toBe("side-studs");
  });
  it("partial undersides: arches, inverted and curved slopes", () => {
    // Arch 1 × 4: four studs on top, receptors only under its two legs.
    const arch = extract("3659.dat");
    expect(cells(arch.connectors, "stud")).toEqual(
      grid([-30, -10, 10, 30], 0, [0]),
    );
    expect(cells(arch.connectors, "antistud")).toEqual(["-30 24 0", "30 24 0"]);
    expect(verifyConnectors(catalog["3659.dat"], arch).rule).toBe(
      "partial-underside",
    );
    // Inverted slope 2 × 2: four studs, receptors under the flat back row only.
    const inverted = extract("3660b.dat");
    expect(cells(inverted.connectors, "stud")).toEqual(
      grid([-10, 10], 0, [-20, 0]),
    );
    expect(cells(inverted.connectors, "antistud")).toEqual(
      grid([-10, 10], 24, [0]),
    );
    expect(verifyConnectors(catalog["3660b.dat"], inverted).rule).toBe(
      "partial-underside",
    );
    // Arch 1 × 5 × 4: studs on four levels, each seated with room above.
    const tall = extract("2339.dat");
    expect(new Set(tall.connectors.map((c) => c.p[1]))).toEqual(
      new Set([0, 8, 24, 48, 96]),
    );
    expect(
      tall.connectors.every(
        (c) => c.kind !== "stud" || (c.seated && c.exposed),
      ),
    ).toBe(true);
    expect(connectorStatus("2339.dat").rule).toBe("partial-underside");
    for (const id of [
      "11477.dat",
      "15068.dat",
      "50950.dat",
      "4490.dat",
      "6182.dat",
    ])
      expect(connectorStatus(id).rule, id).toBe("partial-underside");
  });
  it("hinged doors and frames: pins and sockets from the geometry", () => {
    // Door 1 × 4 × 6: pins on the axis x = z = 0 leave the leaf at y = 4 and 136.
    for (const id of ["60616a.dat", "60623.dat"]) {
      const e = extract(id);
      expect(e.pins, id).toMatchObject({
        top: [0, 4, 0],
        bottom: [0, 136, 0],
        axis: [0, -1, 0],
      });
      expect(connectorStatus(id).rule).toBe("hinge-leaf");
      expect(hingeData(id)?.hinge).toMatchObject({
        axis: [0, -1, 0],
        pivot: [0, 70, 0],
        pins: [
          [0, 4, 0],
          [0, 136, 0],
        ],
      });
      // The verified list is the two pins; the handle studs are not in it.
      expect(verifiedConnectors(id)!.map((c) => c.kind)).toEqual([
        "pin",
        "pin",
      ]);
    }
    // Door Frame 1 × 4 × 6: a socket pair at each post, x = ±32, z = 5,
    // opening under the lintel (y = 4) and on the sill (y = 136).
    expect(extract("60596.dat").sockets).toEqual([
      { top: [-32, 4, 5], bottom: [-32, 136, 5], depth: 8 },
      { top: [32, 4, 5], bottom: [32, 136, 5], depth: 8 },
    ]);
    // Door Frame 2 × 4 × 6: the same pair at z = −15.
    expect(hingeData("60599.dat")?.sockets?.map((s) => s.top)).toEqual([
      [-32, 4, -15],
      [32, 4, -15],
    ]);
    // Frames stay stud-verified and add the sockets to their connectors.
    expect(
      verifiedConnectors("60596.dat")!.filter((c) => c.kind === "socket"),
    ).toHaveLength(4);
  });
  it("body occupancy: tight boxes per stud cell, studs excluded", () => {
    expect(extract("3001.dat").occupancy).toEqual([
      { min: [-40, 0, -20], max: [40, 24, 20] },
    ]);
    // The headlight brick's recess stays free above its lip.
    expect(extract("4070.dat").occupancy).toEqual([
      { min: [-10, 0, -6], max: [10, 20, 10] },
      { min: [-10, 20, -10], max: [10, 24, 10] },
    ]);
    // Under the arch's opening the boxes step with the curve.
    const arch = extract("3659.dat").occupancy;
    expect(arch[0]).toEqual({ min: [-40, 0, -10], max: [40, 12, 10] });
    expect(
      arch.every(
        (b) =>
          b.max[1] <= 12 ||
          Math.abs(b.min[0]) >= 11 ||
          Math.abs(b.max[0]) >= 11,
      ),
    ).toBe(true);
    // A door's pins beyond the leaf are not occupancy (they sit in sockets).
    const door = extract("60616a.dat").occupancy;
    expect(Math.min(...door.map((b) => b.min[1]))).toBeGreaterThanOrEqual(4);
    expect(Math.max(...door.map((b) => b.max[1]))).toBeLessThanOrEqual(136);
  });
});

describe("connector pack", () => {
  it("is hash-locked to data.json and bound to the pinned library", () => {
    const bytes = readFileSync("src/catalog/connectors.json");
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      connectorLock.connectorPackSha256,
    );
    expect(connectorLock.connectorPackId).toBe(pack.id);
    expect(connectorPackMatchesLibrary).toBe(true);
    expect(pack.library.manifestSha256).toBe(libraryLock.manifestSha256);
    expect(pack.licence).toMatch(/CC BY 4.0/);
  });
  it("is exactly what the extractor derives today, and snapVerified agrees", () => {
    let verified = 0;
    for (const [id, part] of Object.entries(catalog)) {
      const e = extract(id);
      const v = verifyConnectors(part, e);
      const entry = (pack.parts as Record<string, any>)[id];
      expect(entry.verified, id).toBe(v.verified);
      const listed = e.connectors.filter(
        (c) => v.rule !== "hinge-leaf" || c.kind === "pin",
      );
      expect(decodeConnectors(entry), id).toEqual(
        decodeConnectors(encodeConnectors(listed)),
      );
      expect(decodeOccupancy(entry.occupancy), id).toEqual(e.occupancy);
      expect(entry.sockets ?? [], id).toEqual(e.sockets);
      expect(part.snapVerified, id).toBe(v.verified);
      if (v.verified) verified++;
    }
    expect(verified).toBe(connectorCoverage.verified);
    // 164 of the first 214; the catalogue release adding the roadster's,
    // flag's and door/frame parts verifies 60616b (hinge leaf), 30179 and
    // the seat 4079 (full underside).
    expect(verified).toBe(167);
    expect(connectorCoverage.byRule).toEqual({
      "full-underside": 120,
      "matched-outline": 9,
      "solid-base": 4,
      "partial-underside": 21,
      "side-studs": 6,
      jumper: 2,
      "hinge-leaf": 5,
    });
  }, 120000);
  it("round-trips the compact encoding, including sideways connectors", () => {
    const list: Connector[] = [
      { kind: "stud", p: [-30, 0, 10], axis: [0, -1, 0] },
      { kind: "stud", p: [-10, 0, 10], axis: [0, -1, 0] },
      { kind: "stud", p: [30, 0, 10], axis: [0, -1, 0] },
      { kind: "antistud", p: [0, 24, 0], axis: [0, 1, 0] },
      { kind: "stud", p: [10, 12, 0], axis: [1, 0, 0] },
    ];
    const encoded = encodeConnectors(list);
    expect(encoded.runs).toHaveLength(3);
    expect(encoded.other).toHaveLength(1);
    const key = (c: Connector) => JSON.stringify(c);
    expect(decodeConnectors(encoded).map(key).sort()).toEqual(
      list.map(key).sort(),
    );
  });
});

const ldr = (lines: string[]) =>
  importLDraw("0 FILE t.ldr\n" + lines.join("\n"));
const line = (
  x: number,
  y: number,
  z: number,
  ref: string,
  basis = "1 0 0 0 1 0 0 0 1",
) => `1 4 ${x} ${y} ${z} ${basis} ${ref}`;

describe("connector snapping", () => {
  const p = ldr([line(0, 0, 0, "3001.dat")]);
  const scene = sceneConnectors(p);
  it("pulls a nearby proposal onto the studs below", () => {
    const r = snapPlacement("3001.dat", rotationY(0), [7, -24, 3], scene)!;
    expect(r.position).toEqual([0, -24, 0]);
    expect(r.contacts).toBe(8);
    expect(r.targetIds).toEqual([occurrences(p)[0].id]);
    // A one-stud offset proposal stays offset: it is already connected.
    expect(
      snapPlacement("3001.dat", rotationY(0), [20, -24, 0], scene)!,
    ).toMatchObject({ position: [20, -24, 0], contacts: 6 });
  });
  it("respects a 90° turn", () => {
    const r = snapPlacement("3010.dat", rotationY(90), [12, -24, 4], scene)!;
    expect(r.contacts).toBe(2); // a 1 × 4 across a 2-wide brick
    expect(Math.abs(r.position[0] - 10) % 20).toBe(0);
    expect(r.position[1]).toBe(-24);
  });
  it("snaps a part underneath so its studs enter the anti-studs", () => {
    const r = snapPlacement("3020.dat", rotationY(0), [3, 24, -2], scene)!;
    expect(r.position).toEqual([0, 24, 0]);
    expect(r.contacts).toBe(8);
  });
  it("leaves side-by-side and unverified placements to the bounds fallback", () => {
    expect(snapPlacement("3001.dat", rotationY(0), [80, 0, 0], scene)).toBe(
      null,
    );
    expect(snapPlacement("99781.dat", rotationY(0), [0, -24, 0], scene)).toBe(
      null,
    );
    expect(verifiedConnectors("99781.dat")).toBe(null);
  });
  it("rejects connections that would push the part through another body", () => {
    // Two stacked bricks; beside the lower one a new brick could reach the
    // upper brick's anti-studs only by passing through the lower brick.
    const q = ldr([line(0, 0, 0, "3001.dat"), line(0, -24, 0, "3001.dat")]);
    const s = sceneConnectors(q);
    expect(s.occupants).toHaveLength(2);
    expect(
      snapPlacement("3001.dat", rotationY(0), [80, 0, 0], s, [0, -1, 0]),
    ).toBe(null);
    // Without body data the same proposal would have snapped under it.
    const loose = snapPlacement(
      "3001.dat",
      rotationY(0),
      [80, 0, 0],
      { ...s, occupants: undefined },
      [0, -1, 0],
    );
    expect(loose?.position).toEqual([60, 0, 0]);
  });
  it("snaps onto off-grid targets", () => {
    const off = ldr([line(3.5, 0, 1.25, "3003.dat")]);
    const r = snapPlacement(
      "3003.dat",
      rotationY(0),
      [0, -24, 0],
      sceneConnectors(off),
    )!;
    expect(r.position).toEqual([3.5, -24, 1.25]);
  });
});

describe("connectivity", () => {
  it("groups stud-connected parts and reports floating and uncovered ones", () => {
    const p = ldr([
      line(0, 0, 0, "3001.dat"),
      line(20, -24, 0, "3001.dat"), // on top, one stud along
      line(0, -8, 200, "3024.dat"), // floating
      line(0, 24, 0, "3020.dat"), // plate under the first brick
      line(0, -48, 0, "3001.dat", "1 0 0 0 0.7071 -0.7071 0 0.7071 0.7071"), // tilted
      line(0, 0, 400, "mystery.dat"),
    ]);
    const all = occurrences(p);
    const graph = connectionGraph(p, all);
    expect(graph.covered).toHaveLength(4);
    expect(graph.uncovered).toEqual([all[4].id, all[5].id]);
    const groups = connectedGroups(graph);
    expect(groups.map((g) => g.length)).toEqual([3, 1]);
    expect(groups[1]).toEqual([all[2].id]);
    expect(graph.contacts).toBe(6 + 8);
    const assembly = connectedAssembly(p, [all[1].id], all);
    expect(new Set(assembly.occurrenceIds)).toEqual(
      new Set([all[0].id, all[1].id, all[3].id]),
    );
    expect(connectedAssembly(p, [all[5].id], all)).toEqual({
      occurrenceIds: [all[5].id],
      uncoveredSeeds: [all[5].id],
    });
  });
  it("does not connect parts that merely touch or are rotated about a stud", () => {
    // Side by side: touching, no stud contact.
    const beside = ldr([line(0, 0, 0, "3001.dat"), line(80, 0, 0, "3001.dat")]);
    expect(connectedGroups(connectionGraph(beside))).toHaveLength(2);
    // Half a stud off: no receptor coincides with a stud.
    const shifted = ldr([
      line(0, 0, 0, "3001.dat"),
      line(10, -24, 0, "3001.dat"),
    ]);
    expect(connectionGraph(shifted).contacts).toBe(0);
    // A 90° turn on top still connects through the shared studs.
    const turned = ldr([
      line(0, 0, 0, "3001.dat"),
      line(0, -24, 0, "3001.dat", "0 0 1 0 1 0 -1 0 0"),
    ]);
    expect(connectionGraph(turned).contacts).toBe(4);
  });
  it("feeds verified groups into the health check and query coverage", async () => {
    const { modelHealth } = await import("../../src/core/health");
    const p = ldr([line(0, 0, 0, "3001.dat"), line(0, -24, 0, "3001.dat")]);
    const c = modelHealth(p).checks.find((c) => c.id === "connectivity")!;
    expect(c).toMatchObject({ status: "ok", basis: "exact", count: 0 });
    expect(c.detail).toContain("8 stud connections");
  });
});

describe("connector workplanes", () => {
  it("puts the plane on the nearest stud, with a grid that keeps parts on that part's studs", () => {
    // A 2 × 4 brick turned 90° and moved off the world grid.
    const p = ldr([line(5, -8, 3, "3001.dat", "0 0 1 0 1 0 -1 0 0")]);
    const [o] = occurrences(p);
    const found = studWorkplane(o, [16, -8, 22], defaultWorkplane())!;
    expect(found.stud.kind).toBe("stud");
    expect(found.plane.normal).toEqual([0, -1, 0]);
    // The plane lies on the stud base (the brick's top at y = −8).
    expect(found.plane.origin[1]).toBe(-8);
    // Place a new brick on that plane at the stud: it connects without snapping.
    const placed = placementOnPlane(
      found.stud.p,
      found.plane,
      catalog["3001.dat"].height,
      0,
      catalog["3001.dat"].align,
    );
    const basis = placeBasis(found.plane, 0);
    const scene = sceneConnectors(p);
    const snapped = snapPlacement("3001.dat", basis, placed.position, scene)!;
    expect(snapped.position).toEqual(
      placed.position.map((n) => Math.round(n * 1000) / 1000),
    );
    // Centred on the tapped corner stud, half the new brick overlaps it.
    expect(snapped.contacts).toBe(4);
  });
  it("refuses parts without verified studs", () => {
    const p = ldr([line(0, 0, 0, "3070b.dat")]);
    expect(
      studWorkplane(occurrences(p)[0], [0, 0, 0], defaultWorkplane()),
    ).toBe(null);
  });
});
