import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  extractConnectors,
  verifyConnectors,
} from "../../src/catalog/connector-extract";
import {
  decodeConnectors,
  encodeConnectors,
  type Connector,
} from "../../src/catalog/connector-pack";
import {
  connectorCoverage,
  connectorLock,
  connectorPackMatchesLibrary,
  connectorStatus,
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
    // Side studs are recorded but not validated.
    const side = extract("87087.dat");
    expect(
      side.connectors.some((c) => c.axis[1] !== -1 && c.kind === "stud"),
    ).toBe(true);
    expect(verifyConnectors(catalog["87087.dat"], side).verified).toBe(false);
    // Jumper studs sit between cells; brackets and hinges are other families.
    expect(connectorStatus("3794b.dat").verified).toBe(false);
    expect(connectorStatus("99781.dat").verified).toBe(false);
    expect(connectorStatus("3937.dat").reasons.join(" ")).toMatch(/hinge/);
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
      expect(decodeConnectors(entry), id).toEqual(
        decodeConnectors(encodeConnectors(e.connectors)),
      );
      expect(part.snapVerified, id).toBe(v.verified);
      if (v.verified) verified++;
    }
    expect(verified).toBe(connectorCoverage.verified);
    expect(verified).toBeGreaterThanOrEqual(120);
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
    expect(snapPlacement("87087.dat", rotationY(0), [0, -24, 0], scene)).toBe(
      null,
    );
    expect(verifiedConnectors("87087.dat")).toBe(null);
  });
  it("rejects connections that would push the part through another body", () => {
    // Two stacked bricks; beside the lower one a new brick could reach the
    // upper brick's anti-studs only by passing through the lower brick.
    const q = ldr([line(0, 0, 0, "3001.dat"), line(0, -24, 0, "3001.dat")]);
    const s = sceneConnectors(q);
    expect(s.bodies).toHaveLength(2);
    expect(
      snapPlacement("3001.dat", rotationY(0), [80, 0, 0], s, [0, -1, 0]),
    ).toBe(null);
    // Without body data the same proposal would have snapped under it.
    const loose = snapPlacement(
      "3001.dat",
      rotationY(0),
      [80, 0, 0],
      { ...s, bodies: undefined },
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
