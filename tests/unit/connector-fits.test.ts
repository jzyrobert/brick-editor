// Connector fits beyond upright studs: side studs, jumpers, hinged doors in
// frames, occupancy clash tests, candidate cycling and hysteresis.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { extractConnectors } from "../../src/catalog/connector-extract";
import { hingeData } from "../../src/catalog/connectors";
import { catalog, libraryLock } from "../../src/catalog/catalog";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { connectedGroups, connectionGraph } from "../../src/core/connectivity";
import { determinant, mv, physical, rotationY } from "../../src/core/math";
import type { Basis, Vec3 } from "../../src/core/types";
import {
  chooseFit,
  clashes,
  hingeCandidates,
  hingeSeats,
  localOccupancy,
  orientTo,
  orientedCandidates,
  sceneConnectors,
  SNAP_HYSTERESIS,
  snapCandidates,
  snapPlacement,
  studWorkplane,
} from "../../src/edit/snap";
import { defaultWorkplane } from "../../src/edit/workplane";

const ldr = (lines: string[]) =>
  importLDraw("0 FILE t.ldr\n" + lines.join("\n"));
const I = "1 0 0 0 1 0 0 0 1";
const line = (x: number, y: number, z: number, ref: string, basis = I) =>
  `1 4 ${x} ${y} ${z} ${basis} ${ref}`;
const basisText = (b: Basis) =>
  b.map((n) => Math.round(n * 1e6) / 1e6).join(" ");
const identity: Basis = [1, 0, 0, 0, 1, 0, 0, 0, 1];
/** Adds a fitted part to the scene text and returns the connection graph. */
const withFit = (
  lines: string[],
  ref: string,
  fit: { position: Vec3; basis: Basis },
) => {
  const p = ldr([...lines, line(...fit.position, ref, basisText(fit.basis))]);
  return connectionGraph(p);
};

describe("orientation onto a connector", () => {
  it("turns local ±Y onto the wanted direction, stays rigid and spins about it", () => {
    for (const want of [
      [0, 0, -1],
      [1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
    ] as Vec3[])
      for (const spin of [0, 90, 180, 270]) {
        const b = orientTo([0, 1, 0], want, spin);
        expect(physical({ position: [0, 0, 0], basis: b })).toBe(true);
        expect(determinant(b)).toBeCloseTo(1, 9);
        mv(b, [0, 1, 0]).forEach((v, i) => expect(v).toBeCloseTo(want[i], 9));
        // A stud's own axis (−Y) lands opposite.
        mv(b, [0, -1, 0]).forEach((v, i) => expect(v).toBeCloseTo(-want[i], 9));
      }
    // At spin 0 on a side stud the part's x axis is horizontal and its z axis up.
    const b = orientTo([0, 1, 0], [0, 0, 1], 0);
    expect(mv(b, [1, 0, 0]).map((n) => Math.round(n))).toEqual([1, 0, 0]);
    expect(mv(b, [0, 0, 1]).map((n) => Math.round(n))).toEqual([0, -1, 0]);
  });
});

describe("side-stud fits", () => {
  const brick = [line(0, 0, 0, "87087.dat")];
  const scene = sceneConnectors(ldr(brick));
  const tap = { point: [0, 10, -10] as Vec3, normal: [0, 0, -1] as Vec3 };
  it("seats a 1 × 1 plate on a brick's side stud with its up axis along the stud", () => {
    const fits = orientedCandidates("3024.dat", 0, tap, scene);
    expect(fits).toHaveLength(1);
    const [fit] = fits;
    // Plate underside against the face at z = −10, the plate out to z = −18.
    expect(fit.position).toEqual([0, 10, -18]);
    expect(mv(fit.basis, [0, -1, 0]).map((n) => Math.round(n))).toEqual([
      0, 0, -1,
    ]);
    expect(fit.contacts).toBe(1);
    const graph = withFit(brick, "3024.dat", fit);
    expect(graph.contacts).toBe(1);
    expect(connectedGroups(graph)).toHaveLength(1);
  });
  it("prefers the fit using more side studs, and cycles through the others", () => {
    const wall = [line(0, 0, 0, "30414.dat")];
    const s = sceneConnectors(ldr(wall));
    const fits = orientedCandidates(
      "3023b.dat",
      0,
      { point: [-30, 10, -10], normal: [0, 0, -1] },
      s,
    );
    // A 1 × 2 plate across the first two side studs, lying horizontally.
    expect(fits[0]).toMatchObject({ position: [-20, 10, -18], contacts: 2 });
    expect(fits.length).toBeGreaterThan(1);
    expect(new Set(fits.map((f) => f.position.join(","))).size).toBe(
      fits.length,
    );
    expect(withFit(wall, "3023b.dat", fits[0]).contacts).toBe(2);
    // Spun a quarter turn the plate stands upright and meets one stud.
    const upright = orientedCandidates(
      "3023b.dat",
      90,
      { point: [-30, 10, -10], normal: [0, 0, -1] },
      s,
    );
    expect(upright[0].contacts).toBe(1);
  });
  it("lets a plate into a headlight brick's recess but not through its lip", () => {
    const head = sceneConnectors(ldr([line(0, 0, 0, "4070.dat")]));
    const t = { point: [0, 10, -8] as Vec3, normal: [0, 0, -1] as Vec3 };
    // 1 × 1 plate: its underside on the recessed face (z = −6).
    expect(orientedCandidates("3024.dat", 0, t, head)[0].position).toEqual([
      0, 10, -14,
    ]);
    // A 1 × 2 plate standing upright fits only reaching up past the top;
    // hanging down it would pass through the lip under the recess: refused.
    const standing = orientedCandidates("3023b.dat", 90, t, head);
    expect(standing).toHaveLength(1);
    expect(Math.abs(mv(standing[0].basis, [1, 0, 0])[1])).toBeCloseTo(1, 9);
    expect(standing[0].position).toEqual([0, 0, -14]);
  });
  it("ignores the top studs (the upright snap handles those) and unverified parts", () => {
    expect(
      orientedCandidates(
        "3024.dat",
        0,
        { point: [0, 0, 0], normal: [0, -1, 0] },
        scene,
      ),
    ).toEqual([]);
    expect(orientedCandidates("99781.dat", 0, tap, scene)).toEqual([]);
  });
  it("gives side studs their own workplane", () => {
    const [o] = occurrences(ldr(brick));
    const found = studWorkplane(o, [0, 10, -12], defaultWorkplane())!;
    expect(found.plane.normal).toEqual([0, 0, -1]);
    expect(found.stud.p).toEqual([0, 10, -10]);
  });
});

describe("jumper fits", () => {
  it("offsets a part half a stud through a jumper plate", () => {
    const p = ldr([line(0, 0, 0, "3001.dat"), line(0, -8, 10, "3794b.dat")]);
    const graph = connectionGraph(p);
    expect(graph.contacts).toBe(2); // the jumper's two receptors on the brick
    // A 1 × 1 brick on the jumper stud sits between the brick's studs.
    const r = snapPlacement(
      "3005.dat",
      rotationY(0),
      [4, -32, 14],
      sceneConnectors(p),
    )!;
    expect(r.position).toEqual([0, -32, 10]);
    expect(r.contacts).toBe(1);
  });
});

describe("hinged doors in frames", () => {
  const frame = [line(0, 0, 0, "60596.dat")];
  const scene = sceneConnectors(ldr(frame));
  it("seats a door closed in the frame, hinge nearest the tap first", () => {
    const fits = hingeCandidates("60616a.dat", { point: [-30, 70, 5] }, scene);
    expect(fits).toHaveLength(2);
    // Hinge on the left post: door origin on the socket axis, leaf towards +x.
    expect(fits[0]).toMatchObject({
      position: [-32, 0, 5],
      basis: identity,
      contacts: 2,
    });
    // Hinge on the right post: turned half round, leaf towards −x.
    expect(fits[1].position).toEqual([32, 0, 5]);
    expect(fits[1].basis).toEqual(
      rotationY(180).map((n) => Math.round(n) || 0),
    );
    const graph = withFit(frame, "60616a.dat", fits[0]);
    expect(graph.contacts).toBe(2);
    expect(graph.hingeContacts).toBe(2);
    expect(connectedGroups(graph)).toHaveLength(1);
    // Tapping near the right post offers that hinge first.
    expect(
      hingeCandidates("60616a.dat", { point: [31, 70, 5] }, scene)[0].position,
    ).toEqual([32, 0, 5]);
  });
  it("follows a turned, off-grid frame and the 2 × 4 × 6 frame", () => {
    const turned = [line(3, -8, 7, "60596.dat", "0 0 1 0 1 0 -1 0 0")];
    const [fit] = hingeCandidates(
      "60623.dat",
      { point: [8, 62, 39] },
      sceneConnectors(ldr(turned)),
    );
    // Socket (−32, 4, 5) turned 90° about y lands at (3 + 5, −4, 7 + 32).
    expect(fit.position).toEqual([8, -8, 39]);
    expect(fit.basis).toEqual([0, 0, 1, 0, 1, 0, -1, 0, 0]);
    const wide = hingeCandidates(
      "60616a.dat",
      { point: [-32, 70, -15] },
      sceneConnectors(ldr([line(0, 0, 0, "60599.dat")])),
    );
    expect(wide[0].position).toEqual([-32, 0, -15]);
  });
  it("refuses a door that would pass through another part, and parts that are not leaves", () => {
    const blocked = sceneConnectors(
      ldr([...frame, line(0, 120, 5, "3005.dat")]),
    );
    expect(
      hingeCandidates("60616a.dat", { point: [-30, 70, 5] }, blocked),
    ).toEqual([]);
    expect(hingeCandidates("3001.dat", { point: [-30, 70, 5] }, scene)).toEqual(
      [],
    );
    // A pane's pins are 60 LDU apart: it does not fit a 132 LDU door opening.
    expect(
      hingeCandidates("60608.dat", { point: [-30, 70, 5] }, scene),
    ).toEqual([]);
  });
});

describe("hinge seats in a frame outside the catalogue", () => {
  // Door Frame 1 × 4 × 6 Type 1 (30179): official files kept as a fixture
  // (fixtures/PROVENANCE.md), resolved against the pinned catalogue pack.
  const dir = "fixtures/ldraw-parts/door-frame-30179/";
  const files: Record<string, string> = {
    "parts/30179.dat":
      "bb3f30bc35d6d355a4cf532ea50d080acce0950cc322bcd5c25d2098cc53294a",
    "p/stud9.dat":
      "f3327f6fe913601613eca9cd5bc4c674317906fa5cec9efcaa139dcd8eb4d8d3",
    "p/9-16edge.dat":
      "5d9e98308232980f596c14e0a6e1d9d4e97fc472a6ada152ae5f4ee6eb504868",
    "p/3-8ndis.dat":
      "eb139765fe92ae387b96c41c57802c81e6369574fe4497ac721298d73d09d77d",
    "p/2-4ring1.dat":
      "a04bfc7ffeeb56f92a83aaa60429939e896facb5a407f93a50f24fd1b2b1706d",
  };
  it("derives four socket pairs and seats the catalogue doors in each", () => {
    const sources: Record<string, string> = {};
    const root = `public/libraries/${libraryLock.releaseId}/`;
    const manifest = JSON.parse(readFileSync(root + "manifest.json", "utf8"));
    for (const f of manifest.files)
      if (f.path !== "LDConfig.ldr")
        sources[f.path.replace(/^(parts|p)\//, "")] = readFileSync(
          root + f.path,
          "utf8",
        );
    for (const [path, sha] of Object.entries(files)) {
      const bytes = readFileSync(dir + path);
      expect(createHash("sha256").update(bytes).digest("hex"), path).toBe(sha);
      expect(bytes.toString()).toMatch(/!LICENSE Licensed under CC BY/);
      sources[path.replace(/^(parts|p)\//, "")] = bytes.toString();
    }
    const frame = extractConnectors(
      sources,
      "30179.dat",
      catalog["60596.dat"].bounds,
      [0, 10],
    );
    // Holes for a door hung at the front or the back, on either post.
    expect(frame.sockets.map((s) => [s.top, s.bottom])).toEqual(
      [
        [-32, -6],
        [-32, 6],
        [32, -6],
        [32, 6],
      ].map(([x, z]) => [
        [x, 4, z],
        [x, 136, z],
      ]),
    );
    const door = hingeData("60616a.dat")!.hinge!;
    const boxes = localOccupancy("60616a.dat")!;
    const centre = [0, 1, 2].map(
      (i) =>
        (Math.min(...boxes.map((b) => b.min[i])) +
          Math.max(...boxes.map((b) => b.max[i]))) /
        2,
    ) as Vec3;
    const seats = frame.sockets.flatMap((s) =>
      hingeSeats(
        { top: door.pins[0], bottom: door.pins[1], centre },
        {
          transform: { position: [0, 0, 0], basis: identity },
          box: frame.body,
        },
        { top: s.top, bottom: s.bottom, axis: [0, 1, 0] },
      ),
    );
    // One closed seat per socket pair: leaf towards the opening's middle.
    expect(seats).toEqual([
      { position: [-32, 0, -6], basis: identity },
      { position: [-32, 0, 6], basis: identity },
      {
        position: [32, 0, -6],
        basis: rotationY(180).map((n) => Math.round(n) || 0),
      },
      {
        position: [32, 0, 6],
        basis: rotationY(180).map((n) => Math.round(n) || 0),
      },
    ]);
    // A window pane's pins (60 LDU apart) do not fit a door frame (132).
    const pane = hingeData("60608.dat")!.hinge!;
    expect(
      frame.sockets.flatMap((s) =>
        hingeSeats(
          { top: pane.pins[0], bottom: pane.pins[1], centre: pane.pivot },
          {
            transform: { position: [0, 0, 0], basis: identity },
            box: frame.body,
          },
          { top: s.top, bottom: s.bottom, axis: [0, 1, 0] },
        ),
      ),
    ).toEqual([]);
  });
});

describe("occupancy clash tests", () => {
  it("lets a plate stand under an arch's opening but not in its crown", () => {
    const arch = sceneConnectors(ldr([line(0, 0, 0, "3659.dat")]));
    const at = (y: number) =>
      clashes(
        "3024.dat",
        { position: [0, y, 0], basis: identity },
        arch.occupants!,
      );
    expect(at(16)).toBe(false); // plate from y 16 to 24, under the curve
    expect(at(8)).toBe(true); // plate from y 8 to 16 cuts into the crown
  });
  it("compares turned parts exactly and tilted ones conservatively", () => {
    const s = sceneConnectors(ldr([line(0, 0, 0, "3001.dat")]));
    const turned = { position: [0, -24, 0] as Vec3, basis: rotationY(90) };
    expect(clashes("3001.dat", turned, s.occupants!)).toBe(false);
    expect(
      clashes(
        "3001.dat",
        { position: [0, -20, 0], basis: rotationY(90) },
        s.occupants!,
      ),
    ).toBe(true);
    const tilt = rotationY(30);
    expect(
      clashes("3001.dat", { position: [0, -25, 0], basis: tilt }, s.occupants!),
    ).toBe(false);
  });
});

describe("fit cycling and hysteresis", () => {
  const p = ldr([line(0, 0, 0, "3001.dat")]);
  const scene = sceneConnectors(p);
  const fits = snapCandidates("3001.dat", rotationY(0), [7, -24, 3], scene);
  it("ranks every connecting fit nearest first", () => {
    expect(fits[0]).toMatchObject({ position: [0, -24, 0], contacts: 8 });
    // One stud across in each direction: straight on, and shifted in x or z.
    expect(fits.map((f) => f.position)).toEqual([
      [0, -24, 0],
      [20, -24, 0],
      [0, -24, 20],
    ]);
    for (let i = 1; i < fits.length; i++)
      expect(fits[i].distance).toBeGreaterThanOrEqual(fits[i - 1].distance);
    expect(fits.every((f) => f.contacts > 0)).toBe(true);
    expect(new Set(fits.map((f) => f.position.join(","))).size).toBe(
      fits.length,
    );
  });
  it("keeps the previous fit until another is nearer by more than the hysteresis", () => {
    const second = fits[1];
    expect(second.distance - fits[0].distance).toBeLessThanOrEqual(
      SNAP_HYSTERESIS,
    );
    expect(chooseFit(fits, { position: second.position })).toBe(1);
    const far = fits.findIndex(
      (f) => f.distance - fits[0].distance > SNAP_HYSTERESIS,
    );
    expect(far).toBeGreaterThan(0);
    expect(chooseFit(fits, { position: fits[far].position })).toBe(0);
    expect(chooseFit(fits, { position: [999, 0, 0] })).toBe(0);
    expect(chooseFit([], null)).toBe(-1);
    // snapPlacement applies the same rule.
    expect(
      snapPlacement("3001.dat", rotationY(0), [7, -24, 3], scene, [0, -1, 0], {
        position: second.position,
      })!.position,
    ).toEqual(second.position);
  });
  it("does not flicker between two nearly equidistant fits as the proposal moves", () => {
    // Sweep a proposal across the boundary between two fits one stud apart.
    let shown: Vec3 | null = null;
    const seen: string[] = [];
    for (let x = 4; x <= 16; x += 1) {
      const list = snapCandidates("3001.dat", rotationY(0), [x, -24, 0], scene);
      const i = chooseFit(list, shown ? { position: shown } : null);
      shown = list[i].position;
      seen.push(shown.join(","));
    }
    // Without hysteresis the fit would switch at x = 10; with it, it switches
    // only once the other is nearer by more than SNAP_HYSTERESIS.
    const switches = seen.filter((v, i) => i && v !== seen[i - 1]).length;
    expect(switches).toBe(1);
    // The first fit is kept while x ≤ 20 − x + SNAP_HYSTERESIS, i.e. to x = 13.
    expect(SNAP_HYSTERESIS).toBe(6);
    expect(seen.lastIndexOf("0,-24,0")).toBe(13 - 4);
    expect(seen.indexOf("20,-24,0")).toBe(14 - 4);
  });
});

describe("model health with hinge and side-stud connections", () => {
  it("counts hinge pins apart from studs", async () => {
    const { modelHealth } = await import("../../src/core/health");
    const p = ldr([line(0, 0, 0, "60596.dat"), line(-32, 0, 5, "60616a.dat")]);
    const c = modelHealth(p).checks.find((c) => c.id === "connectivity")!;
    expect(c).toMatchObject({ status: "ok", basis: "exact", count: 0 });
    expect(c.detail).toContain("0 stud connections, 2 hinge pins");
  });
});
