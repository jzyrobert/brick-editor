/**
 * "Lighthouse": an original CC0 build from official LDraw parts.
 *
 * A rocky island in a blue sea on a 32 × 32 baseplate: a sandy beach with a
 * wooden jetty and a rowing boat, stone steps up three tiers of rock, a
 * red-and-white striped lighthouse with a lamp, and a keeper's cottage whose
 * door opens outwards. Fronts face −Z, towards the default camera.
 *
 * Play: walk up the jetty and the beach, climb the steps (two plates each,
 * the last one plate) to the top of the island and go into the cottage.
 * The lamp stays static: its stored "lighthouse" velocity-motor rig has no
 * actual motor part or reviewed bearing. It remains a direct engine bench,
 * preserving the authored source geometry and rest poses.
 *
 * The rowing boat comes from the complete official library; every other
 * part is in the curated catalogue.
 */
import type { Project, Vec3 } from "../../core/types";
import { importLDraw } from "../../ldraw/io";
import { occurrences } from "../../core/document";
import type { MotionRig } from "../../mechanisms/types";
import {
  BRICK_1,
  BRICK_2,
  Model,
  basis,
  bond,
  door,
  gableRoof,
  glazed,
  mpd,
  ringWall,
} from "./kit";

const SEA = 1, // blue
  ROCK = 72,
  ROCK_LIGHT = 71,
  SAND = 19,
  GRASS = 2,
  STRIPE = [4, 15],
  WOOD = 70,
  WALL = 15,
  ROOF = 320,
  FRAME = 272, // dark blue
  LAMP = 46; // trans-yellow

/** Plate level of the island's grassy top. */
const TOP = 10;
// Lighthouse: tower of Round Bricks 4 × 4 at x 2..5, z 3..6 on the top.
const TOWER_COURSES = 10;
const GALLERY = TOP + 1 + 3 * TOWER_COURSES; // gallery plate level
/** The lamp's axis: the centre of the tower, at the lamp plate's underside. */
export const LAMP_AXIS: Vec3 = [80, -8 * (GALLERY + 4), 100];

/** A rectangle of 2-wide brick strips along X in running bond. */
function slab(
  m: Model,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  level: number,
  color: (n: number) => number,
  skip: (x: number, z: number) => boolean = () => false,
) {
  const lengths = Object.keys(BRICK_2).map(Number);
  const ones = Object.keys(BRICK_1).map(Number);
  let n = 0;
  for (let z = z0; z <= z1; z += 2) {
    const wide = z + 1 <= z1;
    const runs: [number, number][] = [];
    for (let x = x0; x <= x1; x++) {
      if (skip(x, z) || (wide && skip(x, z + 1))) continue;
      const last = runs[runs.length - 1];
      if (last && last[1] === x) last[1] = x + 1;
      else runs.push([x, x + 1]);
    }
    for (const [s, e] of runs) {
      let at = s;
      const below = new Set([4, 7].filter((j) => (z / 2) % 2 && j < e - s));
      for (const len of bond(e - s, wide ? lengths : ones, below)) {
        m.put((wide ? BRICK_2 : BRICK_1)[len], color(n++), at, z, level);
        at += len;
      }
    }
  }
}

const rock = (n: number) => ((n * 5) % 7 === 3 ? ROCK_LIGHT : ROCK);

// The stairs climb the front at x −2..1: rows −3, −2, −1 are steps on the
// rock tiers; row 0 is the grassy top.
const STAIR_X0 = -2,
  STAIR_X1 = 1;
const inStairs = (x: number, z: number) =>
  x >= STAIR_X0 && x <= STAIR_X1 && z >= -3 && z <= -1;

function island() {
  const m = new Model("lighthouse-island.ldr", "Rocky island");
  // Three tiers of rock, each a brick high and inset two studs, and grass
  // plates on the top (x −10..7, z 0..9).
  slab(m, -14, 11, -4, 13, 0, rock);
  slab(m, -12, 9, -2, 11, 3, rock);
  slab(m, -10, 7, 0, 9, 6, rock);
  for (const x of [-10, -4, 2]) m.put("3033.dat", GRASS, x, 0, TOP - 1, 90);
  // Rocky edges: 2 × 2 45° slopes facing outwards round each tier's
  // exposed two-stud rim (not on the steps).
  const rim = (
    x0: number,
    x1: number,
    z0: number,
    z1: number,
    level: number,
  ) => {
    for (let x = x0; x < x1; x += 2) {
      const steps = [x, x + 1].some(
        (c) => inStairs(c, z0) || inStairs(c, z0 + 1),
      );
      if (!steps) m.put("3039.dat", rock(x + level), x, z0, level, 0);
      m.put("3039.dat", rock(x + level + 1), x, z1 - 1, level, 180);
    }
    for (let z = z0 + 2; z < z1 - 1; z += 2) {
      m.put("3039.dat", rock(z + level), x0, z, level, 90);
      m.put("3039.dat", rock(z + level + 2), x1 - 1, z, level, 270);
    }
  };
  rim(-14, 11, -4, 13, 3); // tier 1's rim, round tier 2
  rim(-12, 9, -2, 11, 6); // tier 2's rim, round tier 3
  // Sandy beach along the front and a few rocks in the sea.
  m.put("3030.dat", SAND, -14, -8, 0);
  m.put("3030.dat", SAND, -4, -8, 0);
  m.put("3032.dat", SAND, 6, -8, 0);
  for (const [x, z, ref] of [
    [-16, -10, "3039.dat"],
    [-16, 4, "3003.dat"],
    [13, 6, "3039.dat"],
    [13, -3, "3062b.dat"],
    [8, -14, "3040b.dat"],
    [10, -12, "3062b.dat"],
  ] as const)
    m.put(ref, ROCK, x, z, 0);
  // Flowers on the top.
  for (const [x, z, c] of [
    [-10, 0, 14],
    [-9, 1, 5],
    [6, 8, 15],
    [7, 9, 14],
    [-10, 9, 4],
  ] as const)
    m.put("24866.dat", c, x, z, TOP);
  return m;
}

/** Steps up the front: two plates per row, the last one plate. */
function steps() {
  const m = new Model("lighthouse-steps.ldr", "Stone steps");
  // Row −3 on tier 1 (top 3): two plates → 5. Row −2 on tier 2 (top 6):
  // one plate → 7. Row −1 on tier 2: three plates → 9. Row 0 is the top.
  const plates: [number, number[]][] = [
    [-3, [3, 4]],
    [-2, [6]],
    [-1, [6, 7, 8]],
  ];
  for (const [z, levels] of plates)
    for (const level of levels)
      m.put(
        "3710.dat",
        level === levels[levels.length - 1] ? ROCK_LIGHT : ROCK,
        STAIR_X0,
        z,
        level,
      );
  return m;
}

function lighthouse() {
  const m = new Model("lighthouse-tower.ldr", "Lighthouse");
  m.put("3958.dat", ROCK_LIGHT, 1, 2, TOP); // base plate 6 × 6
  for (let c = 0; c < TOWER_COURSES; c++)
    m.put("87081.dat", STRIPE[Math.floor(c / 2) % 2], 2, 3, TOP + 1 + 3 * c);
  // Gallery: a 6 × 6 plate with lattice railings and four corner posts.
  m.put("3958.dat", ROCK, 1, 2, GALLERY);
  m.put("3633.dat", WALL, 2, 2, GALLERY + 1);
  m.put("3633.dat", WALL, 2, 7, GALLERY + 1);
  m.put("3633.dat", WALL, 1, 3, GALLERY + 1, 90);
  m.put("3633.dat", WALL, 6, 3, GALLERY + 1, 90);
  for (const [x, z] of [
    [1, 2],
    [6, 2],
    [1, 7],
    [6, 7],
  ] as const)
    for (let c = 0; c < 4; c++)
      m.put("3062b.dat", WALL, x, z, GALLERY + 1 + 3 * c);
  // Pedestal for the lamp.
  m.put("3941.dat", ROCK, 3, 4, GALLERY + 1);
  // Lamp-room roof: a 6 × 6 plate on the posts, a cone and a mast.
  const roof = GALLERY + 13;
  m.put("3958.dat", STRIPE[0], 1, 2, roof);
  m.put("3943b.dat", STRIPE[0], 2, 3, roof + 1);
  m.put("87580.dat", 0, 3, 4, roof + 7);
  m.raw("3957a.dat", 0, [80, -8 * (roof + 8) - 8, 100]);
  return m;
}

/** The lamp: a round plate on the pedestal, turned by the rig's motor. */
function lamp() {
  const m = new Model("lighthouse-lamp.ldr", "Lamp");
  const L = GALLERY + 4;
  m.put("60474.dat", 0, 2, 3, L);
  m.put("3941.dat", LAMP, 3, 4, L + 1);
  m.put("4070.dat", 47, 2, 4, L + 1, 90);
  m.put("4070.dat", 47, 5, 5, L + 1, 270);
  m.put("3941.dat", LAMP, 3, 4, L + 4);
  m.put("4032b.dat", 0, 3, 4, L + 7);
  return m;
}

function cottage() {
  const m = new Model("lighthouse-cottage.ldr", "Keeper's cottage");
  const X0 = -8,
    X1 = -1,
    Z0 = 2,
    Z1 = 7;
  ringWall(m, {
    x0: X0,
    x1: X1,
    z0: Z0,
    z1: Z1,
    level: TOP,
    courses: 6,
    openings: [
      { side: "front", from: -7, to: -3, c0: 0, c1: 6 },
      { side: "front", from: -3, to: -1, c0: 1, c1: 3 },
      { side: "left", from: 4, to: 6, c0: 1, c1: 3 },
      { side: "back", from: -6, to: -4, c0: 1, c1: 3 },
    ],
    color: (c) => (c === 0 ? ROCK_LIGHT : WALL),
  });
  door(m, {
    x: -7,
    z: Z0,
    level: TOP,
    frame: FRAME,
    door: FRAME,
    inside: false,
  });
  glazed(m, "60592.dat", FRAME, -3, Z0, TOP + 3, 0);
  glazed(m, "60592.dat", FRAME, X0, 4, TOP + 3, 90);
  glazed(m, "60592.dat", FRAME, -6, Z1, TOP + 3, 180);
  // Inside: a bed and a table, clear of the door's swing.
  m.put("3020.dat", 70, -3, 3, TOP, 90);
  m.put("3020.dat", 1, -3, 3, TOP + 1, 90);
  m.put("3941.dat", 70, -7, 5, TOP);
  m.put("3068b.dat", 15, -7, 5, TOP + 3);
  // Ceiling plate and a 45° roof.
  m.put("3036.dat", WALL, X0, Z0, TOP + 18);
  gableRoof(m, {
    x0: X0,
    x1: X1,
    z0: Z0,
    z1: Z1,
    level: TOP + 19,
    roof: ROOF,
    gable: WALL,
  });
  return m;
}

function harbour() {
  const m = new Model("lighthouse-harbour.ldr", "Sea, jetty and boat");
  m.raw("3811.dat", SEA, [0, 0, 0]);
  // Jetty: planks out from the beach, with mooring posts.
  m.put("3034.dat", WOOD, 4, -16, 0, 90);
  for (const z of [-16, -12]) {
    m.put("3062b.dat", WOOD, 3, z, 0);
    m.put("3062b.dat", WOOD, 6, z, 0);
  }
  m.raw("2551.dat", 15, [-100, -16, -280], basis(90));
  return m;
}

export function lighthouseSource() {
  return mpd(
    "lighthouse.mpd",
    "Lighthouse",
    [
      "Original template build; official LDraw parts only.",
      "Front faces -Z. Baseplate top is y = 0; one plate = 8 LDU.",
    ],
    [harbour(), island(), steps(), cottage(), lighthouse(), lamp()],
  );
}

/** The island with its turning lamp (the motor runs as Play starts). */
export function lighthouseProject(): Project {
  const project = importLDraw(lighthouseSource(), "lighthouse.mpd");
  project.title = "Lighthouse";
  const all = occurrences(project);
  const pedestal = all.find(
    (o) => o.modelId.includes("lighthouse-tower") && o.node.ref === "3941.dat",
  );
  const lampParts = all.filter((o) => o.modelId.includes("lighthouse-lamp"));
  if (!pedestal || !lampParts.length)
    throw new Error("Lighthouse rig parts not found");
  const group = (id: string, members: typeof all) => ({
    id,
    occurrenceIds: members.map((o) => o.id),
    frame: { position: [...LAMP_AXIS] as Vec3, basis: basis(0) },
    restTransforms: Object.fromEntries(
      members.map((o) => [o.id, structuredClone(o.transform)]),
    ),
  });
  const rig: MotionRig = {
    schemaVersion: 1,
    id: "lighthouse",
    name: "Lighthouse lamp",
    mode: "kinematic",
    groups: [group("tower", [pedestal]), group("lamp", lampParts)],
    joints: [
      {
        id: "turn",
        kind: "revolute",
        bodyA: "tower",
        bodyB: "lamp",
        anchorA: [0, 0, 0],
        anchorB: [0, 0, 0],
        axisA: [0, -1, 0],
        axisB: [0, -1, 0],
        motor: {
          mode: "velocity",
          target: 60,
          maxEffort: { value: 20, unit: "N*m" },
        },
      },
    ],
  };
  project.motionRigs = { lighthouse: rig };
  return project;
}
