// Doors as official LDraw OMR models author them (docs/PLAY-PHYSICS.md,
// "Doors in official models"). The fixture is original (CC0): it reproduces
// the patterns found in OMR sets such as 21318-1 Tree House, 10264-1 Corner
// Garage, 374-1 Fire Station and 376-2 Town House with Garden, not their
// content: nested submodels placed with rotations rounded to three decimals,
// a door authored ajar, window panes and shutters, a mirrored door and an
// embedded copy of an official part.
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import doorTable from "../../src/play/door-parts.json";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { nearlyPhysical, orthonormalized, physical } from "../../src/core/math";
import { deriveDoorRigs } from "../../src/play/auto-doors";
import { doorCandidate, type DoorHinge } from "../../src/play/door-derive";
import { validateRig } from "../../src/mechanisms/kinematic";
import { PlaySession } from "../../src/play/session";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { officialSources } from "../helpers/official-geometry";

const table = doorTable as unknown as {
  hinges: Record<string, DoorHinge>;
  excluded: Record<string, { title: string; reason: string }>;
};

/** Original CC0 fixture: see its comments and fixtures/PROVENANCE.md. */
const source = readFileSync("fixtures/ldraw/omr-doors.mpd", "utf8");

beforeAll(() => {
  expect(registerFullLibraryFromDisk()).toBe(true);
});
const derive = () => {
  const project = importLDraw(source, "door-study.mpd");
  const all = occurrences(project);
  return {
    project,
    all,
    derived: deriveDoorRigs(project, {
      all,
      reserved: new Set(),
      maxRigs: 32,
      maxGroups: 128,
    }),
  };
};

describe("hinged leaf table coverage", () => {
  it("selects doors, panes, shutters, gates and trapdoors, never frames or assemblies", () => {
    expect(doorCandidate("Door  1 x  4 x  6 with Window", "Door")).toBe(true);
    expect(doorCandidate("Window  1 x  2 x  3 Shutter", "Window")).toBe(true);
    expect(doorCandidate("Window  1 x  2 x  3 Pane", "Window")).toBe(true);
    expect(doorCandidate("Gate  1 x  4 x  2", "Fence")).toBe(true);
    expect(doorCandidate("Plate  4 x  5 Trap Door", "Plate")).toBe(true);
    expect(doorCandidate("Door  1 x  4 x  6 Frame", "Door")).toBe(false);
    expect(doorCandidate("Glass for Window  1 x  4 x  6", "Glass")).toBe(false);
    expect(doorCandidate("Gate  1 x  4 x  2 Base", "Fence")).toBe(false);
    expect(
      doorCandidate("Brick  1 x  1 x  2 with Shutter Holder", "Brick"),
    ).toBe(false);
    expect(
      doorCandidate(
        "Container Cupboard  2 x  6 x  7 with Blue Doors (Complete)",
        "Container",
      ),
    ).toBe(false);
    expect(doorCandidate("~Moved to 3861c", "Moved")).toBe(false);
  });

  it("hinges the leaves the old title filter missed", () => {
    // Doors "with Window" were dropped as windows.
    for (const part of ["40241", "64390", "30073", "30074", "4247a"])
      expect(table.hinges[part]?.axis).toEqual([0, -1, 0]);
    // Window panes and shutters swing on their origin edge.
    expect(table.hinges["3856"]).toMatchObject({
      rule: "origin-edge",
      leaf: [0, 0, -1],
    });
    expect(table.hinges["3582"]).toMatchObject({ rule: "origin-edge" });
    expect(table.hinges["3854"]!.pins).toEqual([
      [0, 0, 0],
      [0, 60, 0],
    ]);
    // Tilting panes of the rounded-top window turn on their side pins.
    expect(table.hinges["30046"]).toMatchObject({
      rule: "hinge-pins",
      axis: [1, 0, 0],
    });
    // Gates and trapdoors.
    expect(table.hinges["3186"]).toMatchObject({ axis: [0, -1, 0] });
    expect(table.hinges["30042"]).toMatchObject({
      rule: "flap-edge",
      axis: [0, 0, 1],
      leaf: [1, 0, 0],
    });
    // A door with no geometric hinge rule takes the connector pack's pins.
    expect(table.hinges["671"]).toMatchObject({
      rule: "connector-pins",
      axis: [0, -1, 0],
    });
    // Roller and garage doors stay explained exclusions.
    expect(table.excluded["4218b"].reason).toMatch(/Slides or lifts/);
  });
});

describe("doors in official models", () => {
  it("accepts rotations rounded to LDraw's decimals, never mirrors", () => {
    const rounded = {
      position: [0, 0, 0] as [number, number, number],
      basis: [0.661, 0, -0.75, 0, 1, 0, 0.75, 0, 0.661] as [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ],
    };
    expect(physical(rounded)).toBe(false);
    expect(nearlyPhysical(rounded)).toBe(true);
    expect(physical(orthonormalized(rounded))).toBe(true);
    expect(
      nearlyPhysical({
        position: [0, 0, 0],
        basis: [-1, 0, 0, 0, 1, 0, 0, 0, 1],
      }),
    ).toBe(false);
  });

  it("recognises every door, pane and shutter through nested, rounded placements", () => {
    const { project, all, derived } = derive();
    const ref = (id: string) => all.find((o) => o.id === id)!.node.ref;
    const hinged = derived.doors
      .map((d) => `${d.part}>${ref(d.anchorOccurrenceId)}`)
      .sort();
    expect(hinged).toEqual(
      [
        // The embedded copy hinges as the official door it copies.
        "60623>60596.dat",
        ...Array(2).fill([
          "60623>60596.dat",
          "3854>3853.dat",
          "3854>3853.dat",
          "3582>3581.dat",
        ]),
      ]
        .flat()
        .sort(),
    );
    expect(derived.skipped).toEqual([
      expect.objectContaining({
        part: "60616a",
        reason: "Mirrored doors cannot hinge",
      }),
    ]);
    // Rigs validate against the project despite the rounded matrices.
    const withRigs = { ...project, motionRigs: derived.rigs };
    for (const rig of Object.values(derived.rigs))
      expect(() => validateRig(withRigs, rig)).not.toThrow();
  });

  it("lets a door authored ajar close to its frame as well as open", async () => {
    const { project, derived } = derive();
    const door = derived.doors.find(
      (d) => d.part === "60623" && /^\["n\d+","n\d+"\]$/.test(d.occurrenceId),
    )!;
    const rigs = { [door.rigId]: derived.rigs[door.rigId] };
    const { geometry, sources } = await officialSources(project, rigs, {
      min: [-700, -300, -1000],
      max: [500, 0, 300],
    });
    const play = await PlaySession.create(
      geometry,
      { rigIds: [door.rigId], position: [0, -0.3, 300] },
      sources.filter((s) => s.rigId === door.rigId),
      {
        doors: derived.doors.filter((d) => d.rigId === door.rigId),
        skipped: [],
      },
    );
    const report = play.snapshot().autoDoors!.doors;
    const mine = report.find((d) => d.occurrenceId === door.occurrenceId)!;
    // Open further (towards +Z, away from the frame) and close back in.
    expect(mine.swing).toBe("both");
    const limits = (target: number) => {
      try {
        play.setJointTarget({
          rigId: door.rigId,
          jointId: door.jointId,
          target,
          speed: 90,
        });
        return true;
      } catch {
        return false;
      }
    };
    expect(limits(-30)).toBe(true);
    expect(limits(-60)).toBe(false);
    expect(limits(40)).toBe(true);
    play.dispose();
  });
});
