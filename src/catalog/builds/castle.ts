/**
 * "Small castle": an original CC0 build from official LDraw parts.
 *
 * Four round corner towers with cone roofs and flags, 2-stud-thick grey
 * curtain walls in running bond with crenellations and a tiled wall walk, a
 * gate under an arch with a drawbridge over the moat, a courtyard with a well,
 * and a staircase of plate-high steps up to the wall walk. The gate faces −Z,
 * towards the editor's default camera.
 *
 * Play fit: the gate opening is 80 LDU wide and 96 LDU high; each stair step
 * rises one plate (8 LDU, the figure's step height) over a one-stud tread.
 * The drawbridge is an authored hinge (rig "drawbridge"): Play can raise it.
 * All parts are in the curated catalogue except the flags (Flag 2 × 2, 2335),
 * which come from the complete official library.
 */
import type { Project, Transform } from "../../core/types";
import { importLDraw } from "../../ldraw/io";
import { occurrences } from "../../core/document";
import type { MotionRig } from "../../mechanisms/types";
import {
  BRICK_2,
  Model,
  TILE_1,
  basis,
  bond,
  mpd,
  ringWall,
  straightWall,
} from "./kit";

const GREY = 71,
  DARK = 72,
  CONE = 272, // dark blue
  FLAG = 4,
  WOOD = 70,
  WATER = 33, // trans-dark blue
  PATH = 19,
  PATH_DARK = 28,
  LEAF = 2;
const COURSES = 5; // wall height: 5 bricks, wall-walk surface at level 16

/** Deterministic "random" mix of light and dark grey bricks. */
const stone = (c: number, n: number) =>
  (n * 7 + c * 3) % 11 === 0 ? DARK : GREY;

// Towers (4 × 4) centred on the corners of a 20 × 20 stud ring of walls.
const TOWERS: [number, number][] = [
  [-12, -10],
  [8, -10],
  [-12, 10],
  [8, 10],
];

function walls() {
  const m = new Model("castle-walls.ldr", "Curtain walls and gate");
  const common = {
    level: 0,
    courses: COURSES,
    thickness: 2 as const,
    color: stone,
  };
  // Front wall (z −9..−8) with the gate opening x −2..1, four courses high.
  straightWall(m, {
    ...common,
    alongX: true,
    at: -9,
    from: -8,
    to: 8,
    openings: [
      { from: -2, to: 2, c0: 0, c1: 4 },
      { from: -3, to: 3, c0: 4, c1: 5 },
    ],
  });
  straightWall(m, { ...common, alongX: true, at: 11, from: -8, to: 8 });
  straightWall(m, { ...common, alongX: false, at: -11, from: -6, to: 10 });
  straightWall(m, { ...common, alongX: false, at: 9, from: -6, to: 10 });
  // Gate: the course over the opening is an arch (outer row, rising above
  // the wall) and a 1 × 6 brick (inner row); the opening itself is removed
  // from course 4 below by re-laying that course.
  return m;
}

function towers() {
  const m = new Model("castle-towers.ldr", "Towers, cones and flags");
  for (const [x, z] of TOWERS) {
    for (let c = 0; c < 7; c++)
      m.put("87081.dat", c === 0 ? DARK : GREY, x, z, 3 * c);
    m.put("60474.dat", DARK, x, z, 21);
    m.put("3943b.dat", CONE, x, z, 22);
    m.put("87580.dat", CONE, x + 1, z + 1, 28);
    // Antenna on the jumper's centre stud, flag clipped near its top.
    const cx = x * 20 + 40,
      cz = z * 20 + 40;
    m.raw("3957a.dat", 0, [cx, -8 * 29 - 8, cz]);
    m.raw("2335.dat", FLAG, [cx, -8 * 29 - 8 - 80, cz], basis(90));
  }
  return m;
}

function battlements() {
  const m = new Model("castle-battlements.ldr", "Battlements and wall walk");
  const top = COURSES * 3;
  // Each wall: merlons (1 × 2 bricks) on the outer row every other pair of
  // studs, 1 × 2 tiles in the crenels, and a tiled walk on the inner row.
  const wall = (
    alongX: boolean,
    outer: number,
    inner: number,
    from: number,
    to: number,
    skip: (i: number) => boolean = () => false,
  ) => {
    for (let i = from; i < to; i += 2) {
      if (skip(i)) continue;
      const merlon = ((i - from) / 2) % 2 === 0;
      const ref = merlon ? "3004.dat" : "3069b.dat";
      m.put(
        ref,
        merlon ? GREY : DARK,
        alongX ? i : outer,
        alongX ? outer : i,
        top,
        alongX ? 0 : 90,
      );
    }
    let at = from;
    const runs: [number, number][] = [];
    for (let i = from; i < to; i++) {
      if (skip(i)) continue;
      const last = runs[runs.length - 1];
      if (last && last[1] === i) last[1] = i + 1;
      else runs.push([i, i + 1]);
    }
    for (const [s, e] of runs) {
      at = s;
      for (const len of bond(e - s, [1, 2, 3, 4, 6, 8], new Set())) {
        m.put(
          TILE_1[len],
          DARK,
          alongX ? at : inner,
          alongX ? inner : at,
          top,
          alongX ? 0 : 90,
        );
        at += len;
      }
    }
  };
  // Front wall: the gate crest replaces the battlements over x −3..2.
  wall(true, -9, -8, -8, 8, (i) => i >= -4 && i <= 3);
  wall(true, 12, 11, -8, 8);
  wall(false, -11, -10, -6, 10);
  wall(false, 10, 9, -6, 10);
  return m;
}

function gate() {
  const m = new Model("castle-gate.ldr", "Gatehouse arch and drawbridge");
  const top = COURSES * 3;
  // Arch 1 × 6 × 2 over the opening on the outer row (it rises a brick above
  // the wall), a 1 × 6 brick on the inner row.
  m.put("3307.dat", GREY, -3, -9, 12);
  m.put("3009.dat", GREY, -3, -8, 12);
  // Gate crest: raised to the arch's top, tied by a 2 × 8 plate, with merlons.
  m.put("3005.dat", GREY, -4, -9, top);
  m.put("3005.dat", GREY, 3, -9, top);
  m.put("3008.dat", GREY, -4, -8, top);
  m.put("3034.dat", DARK, -4, -9, top + 3);
  for (const x of [-4, -1, 2]) m.put("3004.dat", GREY, x, -9, top + 4);
  for (const x of [-2, 1]) m.put("3070b.dat", DARK, x, -9, top + 4);
  m.put("4162.dat", DARK, -4, -8, top + 4);
  // Floor of the gateway.
  m.put("3020.dat", PATH_DARK, -2, -9, 0);
  return m;
}

function drawbridge() {
  const m = new Model("castle-drawbridge.ldr", "Drawbridge");
  // A 4 × 6 plate lying across the moat, hinged at the gate (z = −9).
  m.put("3032.dat", WOOD, -2, -15, 0, 90);
  return m;
}

function grounds() {
  const m = new Model("castle-grounds.ldr", "Baseplate, moat and courtyard");
  m.raw("3811.dat", 2, [0, 0, 0]);
  // Moat across the front (z −14..−11), leaving room for the drawbridge.
  for (const z of [-14, -12])
    for (let x = -16; x < 16; x += 4)
      if (x + 4 <= -2 || x >= 2) m.put("87079.dat", WATER, x, z, 0);
  // Around the bridge, 2 × 2 tiles to fill x −4..−3 and 2..3.
  for (const z of [-14, -12]) {
    m.put("3068b.dat", WATER, -4, z, 0);
    m.put("3068b.dat", WATER, 2, z, 0);
  }
  // Path from the gate across the courtyard to the well.
  for (let z = -7; z < 1; z += 2)
    m.put(
      "87079.dat",
      z % 4 === 1 || z % 4 === -3 ? PATH : PATH_DARK,
      -2,
      z,
      0,
    );
  // Well: a round 4 × 4 brick ring, two posts and a little roof.
  m.put("87081.dat", DARK, -2, 1, 0);
  m.put("60474.dat", GREY, -2, 1, 3);
  m.put("3062b.dat", WOOD, -2, 2, 4);
  m.put("3062b.dat", WOOD, 1, 2, 4);
  m.put("3062b.dat", WOOD, -2, 2, 7);
  m.put("3062b.dat", WOOD, 1, 2, 7);
  m.put("3710.dat", WOOD, -2, 2, 10);
  m.put("3039.dat", 320, -2, 1, 11);
  m.put("3039.dat", 320, 0, 1, 11);
  // Barrels by the right wall.
  for (const [x, z, level] of [
    [7, 5, 0],
    [8, 5, 0],
    [8, 4, 0],
    [7, 4, 0],
    [8, 5, 3],
  ] as const)
    m.put("3062b.dat", WOOD, x, z, level);
  // Outside: pine trees and bushes.
  m.put("3471.dat", 288, 12, -6, 0);
  m.put("2435.dat", LEAF, 13, 1, 0);
  m.put("6255.dat", 10, 14, 5, 0);
  m.put("3471.dat", 288, -16, -6, 0);
  m.put("2435.dat", LEAF, -16, 1, 0);
  m.put("6255.dat", 10, -15, 5, 0);
  return m;
}

/** A small timber hall against the back wall, with a lean-to roof. */
function hall() {
  const m = new Model("castle-hall.ldr", "Great hall");
  ringWall(m, {
    x0: -6,
    x1: 1,
    z0: 7,
    z1: 10,
    level: 0,
    courses: 3,
    openings: [
      { side: "front", from: -3, to: -1, c0: 0, c1: 2 },
      { side: "front", from: -5, to: -3, c0: 1, c1: 3 },
      { side: "front", from: -1, to: 1, c0: 1, c1: 3 },
    ],
    color: (c) => (c === 0 ? DARK : 19),
  });
  // Windows either side of the doorway.
  for (const x of [-5, -1]) {
    m.put("60592.dat", WOOD, x, 7, 3);
    const line = m.lines[m.lines.length - 1].split(" ");
    m.lines.push(["1", "47", ...line.slice(2, 14), "60601.dat"].join(" "));
  }
  // Lean-to roof: two slope courses facing the courtyard, bricks behind.
  const roof = 320;
  for (let x = -7; x < 3; x += 2) m.put("3039.dat", roof, x, 6, 9);
  for (const z of [8, 9, 10])
    m.put(z === 8 ? "3008.dat" : "3008.dat", 19, -6, z, 9);
  for (let x = -7; x < 3; x += 2) m.put("3039.dat", roof, x, 7, 12);
  m.put("3007.dat", 19, -6, 9, 12);
  m.put("87079.dat", roof, -7, 9, 15);
  m.put("87079.dat", roof, -3, 9, 15);
  m.put("3068b.dat", roof, 1, 9, 15);
  return m;
}

/** Stairs up the inside of the left wall: one plate per step, one stud deep. */
function stairs() {
  const m = new Model("castle-stairs.ldr", "Stairs to the wall walk");
  // Step k (1..16) at z = −7 + k, x −9..−8, its top at plate level k.
  for (let L = 0; L <= 4; L++) {
    const z0 = 3 * L - 4; // first step whose top is at or above 3L + 3
    let at = z0;
    const lengths = Object.keys(BRICK_2).map(Number);
    const below = L % 2 ? new Set([2]) : new Set<number>();
    for (const len of bond(9 - z0 + 1, lengths, below)) {
      m.put(BRICK_2[len], GREY, -9, at, 3 * L, 90);
      at += len;
    }
  }
  for (let L = 0; L <= 5; L++) {
    const k1 = 3 * L + 1,
      k2 = 3 * L + 2;
    if (k2 <= 16) m.put("3022.dat", DARK, -9, -7 + k1, 3 * L);
    else if (k1 <= 16) m.put("3023b.dat", DARK, -9, -7 + k1, 3 * L);
    if (k2 <= 16) m.put("3023b.dat", DARK, -9, -7 + k2, 3 * L + 1);
  }
  return m;
}

export function castleSource() {
  return mpd(
    "small-castle.mpd",
    "Small castle",
    [
      "Original template build; official LDraw parts only.",
      "Gate faces -Z. Baseplate top is y = 0; one plate = 8 LDU.",
    ],
    [
      grounds(),
      walls(),
      gate(),
      battlements(),
      towers(),
      hall(),
      stairs(),
      drawbridge(),
    ],
  );
}

/** The castle with its drawbridge rig (raise it in Play). */
export function castleProject(): Project {
  const project = importLDraw(castleSource(), "small-castle.mpd");
  project.title = "Small castle";
  const all = occurrences(project);
  const find = (model: string, ref: string) => {
    const o = all.find((o) => o.modelId.includes(model) && o.node.ref === ref);
    if (!o) throw new Error(`Castle rig part ${ref} not found`);
    return o;
  };
  const gateFloor = find("castle-gate", "3020.dat"),
    bridge = find("castle-drawbridge", "3032.dat");
  // Hinge line: the bridge's inner top edge at the wall face (z = −180), so
  // the raised plate stands just outside the wall.
  const hinge: Transform = {
    position: [-20, -8, -180],
    basis: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  };
  const group = (id: string, o: (typeof all)[number]) => ({
    id,
    occurrenceIds: [o.id],
    frame: structuredClone(hinge),
    restTransforms: { [o.id]: structuredClone(o.transform) },
  });
  const rig: MotionRig = {
    schemaVersion: 1,
    id: "drawbridge",
    name: "Drawbridge",
    mode: "kinematic",
    groups: [group("gateway", gateFloor), group("bridge", bridge)],
    joints: [
      {
        id: "hinge",
        kind: "revolute",
        bodyA: "gateway",
        bodyB: "bridge",
        anchorA: [0, 0, 0],
        anchorB: [0, 0, 0],
        // Positive angles raise the bridge (about −X, towards −Y = up).
        axisA: [-1, 0, 0],
        axisB: [-1, 0, 0],
        limits: [0, 85],
      },
    ],
  };
  project.motionRigs = { drawbridge: rig };
  return project;
}
