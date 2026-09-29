/**
 * "Corner café": an original CC0 build from official LDraw parts.
 *
 * A street-corner café on a 32 × 32 baseplate: a road with a dashed centre
 * line, a pavement with parasol tables, lampposts and a bicycle, a corner
 * garden, and an 18 × 12 stud café: a glazed shopfront, a "Café" sign over a
 * panelled door, tables with coffee cups, a counter, and a staircase up to a
 * room over the café that opens onto a roof terrace under a striped awning.
 * The shopfront faces −Z, towards the default camera.
 *
 * Play: open the door (E or tap; it swings out over the pavement), walk in,
 * climb the stairs to the room upstairs and go out through its door onto
 * the terrace. Each step rises two plates (16 LDU) over a one-stud tread,
 * the last one plate; the stairwell is open above the flight.
 *
 * The lampposts, bicycle, sign, menu board and coffee-cup tiles come from
 * the complete official library; everything else is in the curated
 * catalogue.
 */
import type { Project } from "../../core/types";
import { importLDraw } from "../../ldraw/io";
import {
  BRICK_2,
  Model,
  TILE_1,
  basis,
  bond,
  door,
  gableRoof,
  glazed,
  joints,
  mpd,
  ringWall,
  straightWall,
} from "./kit";

const PAVEMENT = 71,
  ROAD = 72,
  LINE = 15,
  WALL = 19, // tan
  FOUNDATION = 72,
  FRAME = 288, // dark green
  DOOR = 288,
  FLOOR = 15,
  SLAB = 72,
  STAIR = 70, // reddish brown
  STEP = 19,
  PARAPET = 15,
  AWNING = [4, 15], // red and white stripes
  ROOF = 320, // dark red
  WOOD = 70,
  LEAF = 2,
  BRIGHT_LEAF = 10;

// Café footprint: x −12..5, z −4..7; front wall at z = −4 faces −Z.
const X0 = -12,
  X1 = 5,
  Z0 = -4,
  Z1 = 7;
const COURSES = 7;
/** Plate level of the terrace slab (its top is one plate higher). */
export const CAFE_SLAB = 3 * COURSES;
// Stairs along the back wall (rows 5..6), rising towards −X: step i (1..10)
// at x = 1 − i, its top at plate level 1 + 2i; the slab (top level 22) is
// one plate above the last step.
const STAIR_Z = 5,
  STEPS = 10;
/** The upstairs room covers rows 2..7; the terrace is in front of it. */
const ROOM_Z0 = 2;

function groundFloor() {
  const m = new Model("cafe-ground-floor.ldr", "Café ground floor");
  ringWall(m, {
    x0: X0,
    x1: X1,
    z0: Z0,
    z1: Z1,
    level: 0,
    courses: COURSES,
    openings: [
      { side: "front", from: -11, to: -7, c0: 1, c1: 4 }, // window
      { side: "front", from: -5, to: -1, c0: 0, c1: 7 }, // door + sign
      { side: "front", from: 1, to: 5, c0: 1, c1: 4 }, // window
      { side: "right", from: 0, to: 4, c0: 1, c1: 4 }, // corner window
      { side: "left", from: 0, to: 2, c0: 1, c1: 4 },
      { side: "back", from: 1, to: 3, c0: 2, c1: 4 },
    ],
    color: (c) => (c === 0 ? FOUNDATION : WALL),
  });
  for (const x of [-11, -9, 1, 3]) glazed(m, "60593.dat", FRAME, x, Z0, 3, 0);
  for (const z of [0, 2]) glazed(m, "60593.dat", FRAME, X1, z, 3, 270);
  glazed(m, "60593.dat", FRAME, X0, 0, 3, 90);
  glazed(m, "60592.dat", FRAME, 1, Z1, 6, 180);
  door(m, {
    x: -5,
    z: Z0,
    level: 0,
    frame: FRAME,
    door: DOOR,
    inside: false,
    leaf: "60623.dat",
  });
  // The sign over the door.
  m.put("3010p20.dat", 15, -5, Z0, 18);
  // Floor: white plates inside the walls (x −11..4, z −3..6).
  m.put("3033.dat", FLOOR, -11, -3, 0, 90);
  m.put("3033.dat", FLOOR, -5, -3, 0, 90);
  m.put("3030.dat", FLOOR, 1, -3, 0, 90);
  return m;
}

/** Counter, tables and stools. */
function interior() {
  const m = new Model("cafe-interior.ldr", "Café interior");
  // Counter along the left wall with a coffee machine and a cake board.
  m.put("3001.dat", 320, -11, -2, 1, 90);
  m.put("3003.dat", 320, -11, 2, 1);
  m.put("3001.dat", 320, -11, -2, 4, 90);
  m.put("3003.dat", 320, -11, 2, 4);
  m.put("3022.dat", 15, -11, -2, 7);
  m.put("3068b.dat", 15, -11, 0, 7);
  m.put("3068bp25.dat", 15, -11, 2, 7);
  m.put("3004.dat", 0, -11, -2, 8, 90);
  m.put("2412b.dat", 72, -11, -2, 11, 90);
  m.put("4599b.dat", 71, -10, -2, 8, 90);
  m.put("2454adfa.dat", 15, -11, 4, 1, 90);
  // Three tables (a round 2 × 2 brick with a coffee-cup tile) and stools.
  for (const [x, z] of [
    [-8, 1],
    [1, -1],
    [1, 2],
  ] as const) {
    m.put("3941.dat", 70, x, z, 1);
    m.put("3068bp25.dat", 15, x, z, 4);
    m.put("3062b.dat", 4, x - 1, z, 1);
    m.put("3062b.dat", 4, x + 2, z + 1, 1);
  }
  return m;
}

/** Stairs from the café floor up to the terrace, in bonded brick courses. */
function stairs() {
  const m = new Model("cafe-stairs.ldr", "Stairs to the terrace");
  const top = (i: number) => 1 + 2 * i; // plate level of step i's top
  const lengths = Object.keys(BRICK_2).map(Number);
  let below = new Set<number>();
  for (let c = 0; 1 + 3 * (c + 1) <= top(STEPS); c++) {
    // Steps whose top is at or above this course's top: x −9 .. 1 − i0.
    let i0 = 1;
    while (top(i0) < 4 + 3 * c) i0++;
    const from = 1 - STEPS,
      to = 1 - i0; // inclusive cells
    const local = new Set([...below].filter((p) => p > 0 && p < to - from + 1));
    const pieces = bond(to - from + 1, lengths, local);
    let at = from;
    for (const len of pieces) {
      m.put(BRICK_2[len], STAIR, at, STAIR_Z, 1 + 3 * c);
      at += len;
    }
    below = joints(pieces);
  }
  // Top up each step with 2 × 1 plates to its height; tan tread on top.
  for (let i = 1; i <= STEPS; i++) {
    const x = 1 - i;
    let level = 1 + 3 * Math.floor((top(i) - 1) / 3);
    while (level < top(i)) {
      m.put(
        "3023b.dat",
        level === top(i) - 1 ? STEP : STAIR,
        x,
        STAIR_Z,
        level,
        90,
      );
      level++;
    }
  }
  return m;
}

/** Terrace slab, awning, parapets, stairwell railing and furniture. */
function terrace() {
  const m = new Model("cafe-terrace.ldr", "Roof terrace");
  const S = CAFE_SLAB;
  // Slab over the walls, open above the stairs (x −9..0, rows 5..6).
  m.put("3028.dat", SLAB, -12, -4, S); // 6 × 12, rows −4..1
  m.put("3958.dat", SLAB, 0, -4, S);
  m.put("4282.dat", SLAB, -12, 2, S); // 2 × 16, rows 2..3
  m.put("3022.dat", SLAB, 4, 2, S);
  m.put("60479.dat", SLAB, -12, 4, S);
  m.put("3666.dat", SLAB, 0, 4, S);
  m.put("3021.dat", SLAB, -12, 5, S); // landing x −12..−10
  m.put("3795.dat", SLAB, 0, 5, S); // over the first step
  m.put("60479.dat", SLAB, -12, 7, S);
  m.put("3666.dat", SLAB, 0, 7, S);
  // Awning: 33° slopes in red and white stripes along the front edge.
  for (let x = X0, n = 0; x < X1; x += 2, n++)
    m.put("3298.dat", AWNING[n % 2], x, Z0 - 2, S + 1);
  // Terrace parapets: one brick with a tile cap along the sides.
  for (const x of [X0, X1]) {
    straightWall(m, {
      alongX: false,
      at: x,
      from: Z0 + 1,
      to: ROOM_Z0,
      level: S + 1,
      courses: 1,
      thickness: 1,
      color: () => PARAPET,
    });
    m.put(TILE_1[4], 72, x, Z0 + 1, S + 4, 90);
    m.put(TILE_1[1], 72, x, Z0 + 5, S + 4);
  }
  // Two parasol tables with stools, clear of the room door's swing.
  parasolTable(m, -3, -2, S + 1, 4);
  parasolTable(m, 2, -2, S + 1, 15);
  // Flower boxes by the right-hand parapet.
  m.put("3004.dat", 70, X1 - 1, -3, S + 1, 90);
  m.put("24866.dat", 5, X1 - 1, -3, S + 4);
  m.put("24866.dat", 14, X1 - 1, -2, S + 4);
  return m;
}

/**
 * A round cafe table (a 2 x 2 round brick) under a parasol (an inverted
 * 4 x 4 dish on a pole of round bricks, centred on a jumper), with two
 * stools, at cells x..x+1, z..z+1 on plate level `level`.
 */
function parasolTable(
  m: Model,
  x: number,
  z: number,
  level: number,
  color: number,
) {
  m.put("3941.dat", 15, x, z, level);
  m.put("87580.dat", 15, x, z, level + 3);
  const cx = x * 20 + 20,
    cz = z * 20 + 20;
  for (let c = 0; c < 3; c++)
    m.raw("3062b.dat", 71, [cx, -8 * (level + 4 + 3 * c) - 24, cz]);
  m.raw("3960.dat", color, [cx, -8 * (level + 13) - 16, cz]);
  m.put("3062b.dat", 1, x - 1, z, level);
  m.put("3062b.dat", 1, x + 2, z + 1, level);
}

/**
 * The upstairs room at the back of the terrace (rows 2..7): white walls
 * with a panelled door out to the terrace, windows, a ceiling and a 45 degree
 * roof. The stairs arrive inside it, behind a railing round the stairwell.
 */
function upperRoom() {
  const m = new Model("cafe-upper-room.ldr", "Upstairs room and roof");
  const L = CAFE_SLAB + 1;
  ringWall(m, {
    x0: X0,
    x1: X1,
    z0: ROOM_Z0,
    z1: Z1,
    level: L,
    courses: 6,
    openings: [
      { side: "front", from: -11, to: -7, c0: 0, c1: 6 }, // door
      { side: "front", from: -4, to: -2, c0: 1, c1: 3 },
      { side: "front", from: 0, to: 2, c0: 1, c1: 3 },
      { side: "front", from: 3, to: 5, c0: 1, c1: 3 },
      { side: "back", from: -9, to: -7, c0: 2, c1: 4 },
      { side: "back", from: 0, to: 2, c0: 2, c1: 4 },
      { side: "right", from: 4, to: 6, c0: 1, c1: 3 },
    ],
    color: (c) => (c === 5 ? 72 : PARAPET),
  });
  door(m, {
    x: -11,
    z: ROOM_Z0,
    level: L,
    frame: FRAME,
    door: DOOR,
    inside: false,
    leaf: "60623.dat",
  });
  for (const x of [-4, 0, 3])
    glazed(m, "60592.dat", FRAME, x, ROOM_Z0, L + 3, 0);
  for (const x of [-9, 0]) glazed(m, "60592.dat", FRAME, x, Z1, L + 6, 180);
  glazed(m, "60592.dat", FRAME, X1, 4, L + 3, 270);
  // Railing round the stairwell (x -9..-1, rows 5..6).
  m.put("3185.dat", 15, -9, 4, L);
  m.put("3185.dat", 15, -5, 4, L);
  m.put("87552.dat", 15, -1, 4, L);
  m.put("87552.dat", 15, 0, 5, L, 90);
  // Ceiling and a 45 degree roof, ridge along X.
  const top = L + 18;
  for (const x of [-12, -6, 0]) m.put("3958.dat", SLAB, x, ROOM_Z0, top);
  gableRoof(m, {
    x0: X0,
    x1: X1,
    z0: ROOM_Z0,
    z1: Z1,
    level: top + 1,
    roof: ROOF,
    gable: PARAPET,
  });
  return m;
}

function street() {
  const m = new Model("cafe-street.ldr", "Street and pavement");
  m.raw("3811.dat", PAVEMENT, [0, 0, 0]);
  // Road: rows −16..−13, dashed centre line on row −14.
  for (let x = -16; x < 16; x += 4) {
    m.put("87079.dat", ROAD, x, -16, 0);
    m.put("2431.dat", (x / 4) % 2 ? LINE : ROAD, x, -14, 0);
    m.put("2431.dat", ROAD, x, -13, 0);
  }
  // Pavement: parasols, lampposts, a bicycle and planted trees.
  parasolTable(m, -10, -9, 0, 15);
  parasolTable(m, 2, -9, 0, 4);
  m.raw("723.dat", 72, [-290, 0, -200], basis(0));
  m.raw("723.dat", 72, [250, 0, -200], basis(0));
  m.raw("4719c01.dat", 1, [250, -52, -120], basis(90));
  // Corner garden to the right of the café: a tree, flower bed and bench.
  for (const [x, z] of [
    [8, 2],
    [12, 2],
  ] as const) {
    m.put("3001.dat", 72, x, z, 0);
    m.put("3001.dat", 72, x, z + 2, 0);
  }
  m.put("3470.dat", LEAF, 8, -2, 0);
  m.put("3031.dat", 70, 12, -2, 0);
  for (const [x, z, c] of [
    [12, -2, 5],
    [13, -1, 14],
    [14, -2, 4],
    [15, -1, 13],
  ] as const)
    m.put("24866.dat", c, x, z, 1);
  m.put("3020.dat", WOOD, 8, 2, 3);
  m.put("3020.dat", WOOD, 12, 2, 3);
  m.put("3471.dat", BRIGHT_LEAF, 11, 8, 0);
  m.put("2435.dat", LEAF, 7, 10, 0);
  return m;
}

export function cafeSource() {
  return mpd(
    "corner-cafe.mpd",
    "Corner café",
    [
      "Original template build; official LDraw parts only.",
      "Front faces -Z. Baseplate top is y = 0; one plate = 8 LDU.",
    ],
    [street(), groundFloor(), interior(), stairs(), terrace(), upperRoom()],
  );
}

export function cafeProject(): Project {
  const project = importLDraw(cafeSource(), "corner-cafe.mpd");
  project.title = "Corner café";
  return project;
}
